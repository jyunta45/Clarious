import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';
import pg from 'pg';
import { db } from './db/index.js';
import { users, userData } from './shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import { buildAdaptivePrompt, detectComplexity, selectModel } from './adaptiveDepth.js';
import { updateIdentity, buildIdentityPrompt } from './identityLayer.js';
import { buildCalmAuthorityPrompt } from './calmAuthority.js';
import { buildCapabilityLayer, THAI_LANGUAGE_RULES, THAI_LANGUAGE_RULES_MINIMAL } from './capabilityLayer.js';
import { buildAttentionLayer } from './hybridModel.js';
import { resetDailyUsage, truncateInput, checkBudget, maxTokens as getMaxTokens, checkSessionTimeout, shouldUpdateSummary, isMeaningfulAssistantResponse } from './utils/aiController.js';
import { buildContinuityLayer, initMemory, loadMemoryFromDB, shouldUpdateMemory, buildMemoryExtractionPrompt, mergeExtractedMemory, getMemoryForSave, extractOpenLoop, resolveMatchingLoop, generateMemoryDigest } from './continuityEngine.js';
import { sessionStore, storeTurn, buildRollingSummary, finalizeSession, getSessionInjection } from './sessionMemory.js';
import { buildContext, detectDeepTopic, detectConversationPhase } from './contextBuilder.js';
import { seedMemoryFromOnboarding } from './onboardingIdentitySync.js';
import { detectIdentityShift } from './identityShiftDetector.js';
import { cooldownPassed } from './identityCooldown.js';
import { runHaikuMemoryMerge } from './memoryMerge.js';
import { repairLegacyIdentity } from './legacyIdentityRepair.js';
import { buildOpeningMessage } from './openingMessageEngine.js';
import {
  buildAcknowledgmentPrompt, shouldCompleteOnboarding,
  getDefaultOnboardingProgress, QUESTIONS, Q11_CHIPS,
  INITIAL_MESSAGES, COMPLETION_MESSAGES, SKIP_MESSAGES
} from './onboardingEngine.js';

function detectThai(message) {
  if (!message || typeof message !== 'string') return false;
  return /[\u0E00-\u0E7F]/.test(message);
}

const CJK_LANGS = ['th'];

function phaseTokenLimit(phase, chatMode, userLang) {
  const isThai = userLang === 'th';

  // EN base | TH explicit
  if (chatMode === 'daily')    return isThai ? 800  : 400;
  if (phase === 'opening')     return isThai ? 800  : 400;
  if (phase === 'exploration') return isThai ? 1000 : 600;
  return                              isThai ? 1400 : 900; // decision
}

var __app_dirname;
try { __app_dirname = path.dirname(fileURLToPath(import.meta.url)); } catch(e) { __app_dirname = __dirname || process.cwd(); }

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const app = express();

app.get('/health', (req, res) => { res.status(200).send('ok'); });

// ── STRIPE WEBHOOK — must be before express.json() ───────────────────────────
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      console.log("WEBHOOK RECEIVED");
      console.log("SESSION:", session);
      console.log("METADATA:", session.metadata);
      console.log("USER ID FROM METADATA:", session.metadata?.userId);

      const userId = Number(session.metadata?.userId);
      if (userId) {
        // Upsert: creates the row if missing, updates tier if it exists
        await db.insert(userData)
          .values({
            userId: userId,
            tier: 'partner',
            tierUpdatedAt: new Date().toISOString(),
            stripeCustomerId: session.customer || '',
            stripeSubscriptionId: session.subscription || '',
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: userData.userId,
            set: {
              tier: 'partner',
              tierUpdatedAt: new Date().toISOString(),
              stripeCustomerId: session.customer || '',
              stripeSubscriptionId: session.subscription || '',
              updatedAt: new Date()
            }
          });
        console.log('[STRIPE] User', userId, 'upgraded to PARTNER (upsert)');
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const [existing] = await db.select().from(userData)
        .where(eq(userData.stripeSubscriptionId, subscription.id));
      if (existing) {
        await db.update(userData).set({
          tier: 'free',
          tierUpdatedAt: new Date().toISOString(),
          updatedAt: new Date()
        }).where(eq(userData.stripeSubscriptionId, subscription.id));
        console.log('[STRIPE] Subscription cancelled, user downgraded to FREE');
      }
    } else {
      console.log('[STRIPE] Unhandled event type:', event.type);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[STRIPE WEBHOOK ERROR]', err.message || err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '2mb' }));

app.use(express.static(path.join(__app_dirname, 'public')));

const runtimeUsers = new Map();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, keepAlive: true, keepAliveInitialDelayMillis: 10000 });
pool.on('error', (err) => { console.error('[DB] Pool error:', err.message); });

const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

const SESSION_SECRET = process.env.SESSION_SECRET || 'clarus-dev-secret';
const AUTH_COOKIE = 'clarious_uid';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // seconds

function signUid(uid) {
  const val = String(uid);
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(val).digest('hex');
  return val + '.' + sig;
}

function verifyUid(signed) {
  if (!signed || typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const val = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  let expected;
  try {
    expected = Buffer.from(crypto.createHmac('sha256', SESSION_SECRET).update(val).digest('hex'));
    const provided = Buffer.from(sig);
    if (expected.length !== provided.length) return null;
    if (!crypto.timingSafeEqual(expected, provided)) return null;
  } catch(e) { return null; }
  const id = parseInt(val, 10);
  return isNaN(id) ? null : id;
}

function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function setAuthCookie(res, uid) {
  const signed = signUid(uid);
  res.setHeader('Set-Cookie',
    `${AUTH_COOKIE}=${encodeURIComponent(signed)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`
  );
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly`);
}

app.use(function(req, res, next) {
  if (!req.path.startsWith('/api')) return next();
  const cookies = parseCookieHeader(req.headers.cookie);
  const raw = cookies[AUTH_COOKIE];
  const uid = verifyUid(raw);
  req.session = {
    userId: uid,
    guestMsgCount: 0,
    lastActive: null,
    openLoopCreatedThisSession: false,
    save: function(cb) { if (cb) cb(null); },
    destroy: function(cb) { clearAuthCookie(res); if (cb) cb(); },
  };
  req.sessionID = raw ? raw.slice(0, 16) : 'guest_' + Math.random().toString(36).slice(2);
  next();
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (existing.length > 0) return res.status(409).json({ error: 'Account already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      passwordHash
    }).returning();

    await db.insert(userData).values({ userId: user.id });

    req.session.userId = user.id;
    setAuthCookie(res, user.id);
    res.json({ ok: true, email: user.email });
  } catch(e) {
    console.error('[SIGNUP ERROR]', e.message || e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.userId = user.id;
    setAuthCookie(res, user.id);
    const [udata] = await db.select().from(userData).where(eq(userData.userId, user.id));
    const tier = udata ? (udata.tier || 'free') : 'free';
    res.json({ ok: true, email: user.email, tier });
  } catch(e) {
    console.error('[LOGIN ERROR]', e.message || e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const userId = req.session.userId ? String(req.session.userId) : null;
  if (userId) finalizeSession(userId);
  clearAuthCookie(res);
  res.json({ ok: true });
});

const ADMIN_EMAIL = 'jyunta45@gmail.com';

async function isAdminSession(req) {
  if (!req.session || !req.session.userId) return false;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    return user && user.email === ADMIN_EMAIL;
  } catch { return false; }
}

// ── ADMIN SELF-RESTORE (works in all environments, admin email only) ──────────
app.post('/api/restore', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    if (!user || user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await db.insert(userData)
      .values({ userId: req.session.userId, tier: 'partner', tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userData.userId,
        set: { tier: 'partner', tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() }
      });
    console.log('[RESTORE] Admin', user.email, 'restored to PARTNER');
    res.json({ success: true, tier: 'partner' });
  } catch (e) {
    console.error('[RESTORE ERROR]', e.message || e);
    res.status(500).json({ error: e.message });
  }
});

// ── DEV TIER TESTING (non-production, or admin in production) ─────────────────
app.post('/api/dev/upgrade', async (req, res) => {
  const admin = await isAdminSession(req);
  if (process.env.NODE_ENV === 'production' && !admin) {
    return res.status(403).json({ error: 'Forbidden in production' });
  }
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    await db.insert(userData)
      .values({ userId: req.session.userId, tier: 'partner', tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userData.userId,
        set: { tier: 'partner', tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() }
      });
    console.log('[DEV] User', req.session.userId, 'upgraded to PARTNER');
    res.json({ success: true, tier: 'partner' });
  } catch (e) {
    console.error('[DEV UPGRADE ERROR]', e.message || e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dev/downgrade', async (req, res) => {
  const admin = await isAdminSession(req);
  if (process.env.NODE_ENV === 'production' && !admin) {
    return res.status(403).json({ error: 'Forbidden in production' });
  }
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    await db.insert(userData)
      .values({ userId: req.session.userId, tier: 'free', tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userData.userId,
        set: { tier: 'free', tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() }
      });
    console.log('[DEV] User', req.session.userId, 'downgraded to FREE');
    res.json({ success: true, tier: 'free' });
  } catch (e) {
    console.error('[DEV DOWNGRADE ERROR]', e.message || e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dev/reset-count', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden in production' });
  }
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await db.update(userData).set({
      msgCount: 0,
      msgCountDate: yesterday.toISOString().slice(0, 10),
      updatedAt: new Date()
    }).where(eq(userData.userId, req.session.userId));
    console.log('[DEV] User', req.session.userId, 'daily count reset');
    res.json({ success: true, msgCount: 0 });
  } catch (e) {
    console.error('[DEV RESET ERROR]', e.message || e);
    res.status(500).json({ error: e.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── ADMIN: manual tier fix (protected by ADMIN_SECRET env var) ────────────────
app.post('/api/admin/set-tier', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { email, tier } = req.body;
  if (!email || !['free', 'partner'].includes(tier)) {
    return res.status(400).json({ error: 'email and tier (free|partner) required' });
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return res.status(404).json({ error: 'User not found' });
    await db.insert(userData)
      .values({ userId: user.id, tier, tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userData.userId,
        set: { tier, tierUpdatedAt: new Date().toISOString(), updatedAt: new Date() }
      });
    console.log('[ADMIN] Set tier for', email, '→', tier);
    res.json({ success: true, email, tier });
  } catch (e) {
    console.error('[ADMIN SET-TIER ERROR]', e.message || e);
    res.status(500).json({ error: e.message });
  }
});

// ── STRIPE CHECKOUT ───────────────────────────────────────────────────────────
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    console.log("Creating checkout session...");
    console.log("User ID:", req.session.userId);
    console.log("Price ID:", process.env.STRIPE_FOUNDING_PRICE);

    const priceId = process.env.STRIPE_FOUNDING_PRICE;

    console.log("DEBUG PRICE VALUE:", priceId);

    if (!priceId) {
      console.error("ERROR: STRIPE_FOUNDING_PRICE is missing");
      return res.status(500).json({ error: "Missing Stripe price ID" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: 'https://clarious.org?success=true',
      cancel_url: 'https://clarious.org?canceled=true',
      metadata: {
        userId: req.session.userId.toString(),
      },
    });

    console.log("Stripe session:", session);

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    console.error('[STRIPE CHECKOUT ERROR]', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));

    const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    if (user) {
      await db.execute(
        sql`UPDATE users SET reset_token = ${resetToken}, reset_token_expires = ${expires} WHERE id = ${user.id}`
      );
    }

    res.json({ ok: true, code: resetToken, message: 'Reset code generated. Use it to set a new password.' });
  } catch(e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code, and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (!user) return res.status(400).json({ error: 'Invalid email or code' });

    const result = await db.execute(
      sql`SELECT reset_token, reset_token_expires FROM users WHERE id = ${user.id}`
    );
    const row = result.rows && result.rows[0];
    if (!row || !row.reset_token || row.reset_token !== code.toUpperCase()) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }
    if (new Date(row.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.execute(
      sql`UPDATE users SET password_hash = ${passwordHash}, reset_token = NULL, reset_token_expires = NULL WHERE id = ${user.id}`
    );

    res.json({ ok: true, message: 'Password has been reset. You can now log in.' });
  } catch(e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});


app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    if (!user) return res.json({ loggedIn: false });
    const [data] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
    const tier = data ? data.tier : 'free';
    res.json({ loggedIn: true, email: user.email, tier: tier });
  } catch(e) {
    res.json({ loggedIn: false });
  }
});

app.get('/api/data', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  try {
    const [data] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
    if (!data) {
      const [newData] = await db.insert(userData).values({ userId: req.session.userId }).returning();
      return res.json(newData);
    }
    // Auto-migrate: existing users who completed old form onboarding are marked complete
    if (!data.onboardingComplete && (data.stage === 'chat' || (data.answers && Object.keys(data.answers).length > 0))) {
      await db.update(userData).set({
        onboardingComplete: true,
        onboardingMode: 'legacy',
        updatedAt: new Date()
      }).where(eq(userData.userId, req.session.userId));
      data.onboardingComplete = true;
    }
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: 'Failed to load data' });
  }
});

app.post('/api/data', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  try {
    const { answers, messages, stage, step, lang, mirror, identity_profile, memories, mood_log, thread_summaries, last_active_date } = req.body;
    const updateFields = { updatedAt: new Date() };
    if (answers !== undefined) updateFields.answers = answers;
    if (messages !== undefined) updateFields.messages = messages;
    if (stage !== undefined) updateFields.stage = stage;
    if (step !== undefined) updateFields.step = String(step);
    if (lang !== undefined) updateFields.lang = lang;
    if (mirror !== undefined) updateFields.mirror = mirror;
    if (identity_profile !== undefined) updateFields.identityProfile = identity_profile;
    if (memories !== undefined) updateFields.memories = memories;
    if (mood_log !== undefined) updateFields.moodLog = mood_log;
    if (thread_summaries !== undefined) updateFields.threadSummaries = thread_summaries;
    if (last_active_date !== undefined) updateFields.lastActiveDate = last_active_date;
    if (req.body.patterns !== undefined) updateFields.patterns = req.body.patterns;
    if (req.body.onboarding_complete !== undefined) updateFields.onboardingComplete = req.body.onboarding_complete;
    if (req.body.onboarding_progress !== undefined) updateFields.onboardingProgress = req.body.onboarding_progress;
    if (req.body.deep_session_id !== undefined) updateFields.deepSessionId = req.body.deep_session_id;
    if (req.body.deep_session_summaries !== undefined) updateFields.deepSessionSummaries = req.body.deep_session_summaries;
    // onboardingState is server-managed exclusively through /api/onboarding-chat — never accept from client

    const existing = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
    if (existing.length === 0) {
      updateFields.userId = req.session.userId;
      await db.insert(userData).values(updateFields);
    } else {
      await db.update(userData).set(updateFields).where(eq(userData.userId, req.session.userId));
    }

    if (stage === 'chat' && answers && Object.keys(answers).length > 0) {
      const record = existing.length > 0 ? existing[0] : null;
      if (record && !record.memorySeeded) {
        try {
          async function callModel(model, systemPrompt, userContent) {
            const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: model,
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userContent }]
              })
            });
            const data = await apiRes.json();
            return data.content && data.content[0] ? data.content[0].text : '{}';
          }

          const baseMemory = {
            goals: [],
            recurringStruggles: [],
            strengths: [],
            decisionPatterns: [],
            identityDirection: "",
            lastUpdated: null
          };

          const { memory: seededMemory } = await seedMemoryFromOnboarding(
            answers,
            baseMemory,
            callModel
          );

          await db.update(userData).set({
            memories: seededMemory,
            memorySeeded: true,
            updatedAt: new Date()
          }).where(eq(userData.userId, req.session.userId));
        } catch(e) { console.error('[MEMORY SEED ERROR]', e.message || e); }
      }
    }

    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// ─── CONVERSATIONAL ONBOARDING ────────────────────────────────────────────────
app.post('/api/onboarding-chat', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  try {
    const { message, lang } = req.body;
    const safeLang = ['en', 'th'].includes(lang) ? lang : 'en';
    // Questions: use TH if available, fall back to EN
    const qList = QUESTIONS[safeLang] || QUESTIONS.en;

    const [uData] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
    let onboardingState = (uData && uData.onboardingState) ? { ...uData.onboardingState } : {};
    let onboardingProgress = (uData && uData.onboardingProgress && Object.keys(uData.onboardingProgress).length > 0)
      ? { ...uData.onboardingProgress }
      : getDefaultOnboardingProgress();

    // ── SKIP ────────────────────────────────────────────────────────────────
    if (message === '__skip__') {
      await db.update(userData).set({
        onboardingComplete: true,
        onboardingState: {},
        guidanceMode: true,
        guidanceDay: 1,
        stage: 'chat',
        updatedAt: new Date()
      }).where(eq(userData.userId, req.session.userId));
      return res.json({
        text: SKIP_MESSAGES[safeLang] || SKIP_MESSAGES.en,
        onboardingComplete: true
      });
    }

    // ── MIGRATE old-format state ──────────────────────────────────────────────
    // Old formats used currentCategory or totalExchanges — map to new questionIndex
    if (!onboardingState.started && onboardingState.currentCategory) {
      const oldExchanges = (onboardingState.exchangeCount || 0);
      onboardingState = {
        started: true,
        questionIndex: Math.min(Math.floor(oldExchanges / 1.5), 10)
      };
    } else if (onboardingState.started && typeof onboardingState.totalExchanges !== 'undefined'
               && typeof onboardingState.questionIndex === 'undefined') {
      // Had totalExchanges — map to questionIndex
      onboardingState = {
        started: true,
        questionIndex: Math.min(onboardingState.totalExchanges || 0, 10)
      };
    }

    // ── START (first interaction) ────────────────────────────────────────────
    // User's first message is their name — save it, then ask Q0 personally
    if (!onboardingState.started) {
      const q0 = qList[0];
      const isSystemAction = message === '__start__' || message === '__continue__';
      let preferredName = null;
      if (!isSystemAction) {
        const raw = message.trim();
        // Try to detect "My name is X", "I'm X", "Call me X", "I am X", "ผมชื่อ X", "ชื่อ X" etc.
        const namePatterns = [
          /(?:my name is|call me|i['']m|i am|they call me)\s+([^\s,!.?]+)/i,
          /(?:ผมชื่อ|ฉันชื่อ|ชื่อ|เรียกว่า|เรียกผมว่า)\s*([^\s,!.?]+)/,
        ];
        let extracted = null;
        for (const p of namePatterns) {
          const m = raw.match(p);
          if (m && m[1]) { extracted = m[1]; break; }
        }
        if (extracted) {
          preferredName = extracted;
        } else if (raw.split(/\s+/).length <= 3) {
          // Short message (1-3 words) — treat whole thing or first word as name
          // Capitalise first letter to clean up e.g. "john" → "John"
          const firstWord = raw.split(/\s+/)[0];
          preferredName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
        } else {
          // Long message — can't reliably extract; skip name rather than save a wrong word
          preferredName = null;
        }
      }
      if (preferredName) onboardingProgress.preferredName = preferredName;
      const initialFn = INITIAL_MESSAGES[safeLang] || INITIAL_MESSAGES.en;
      const text = initialFn(q0, preferredName);
      onboardingState = { started: true, questionIndex: 0 };
      await db.update(userData).set({
        onboardingState,
        onboardingProgress,
        updatedAt: new Date()
      }).where(eq(userData.userId, req.session.userId));
      return res.json({ text, onboardingComplete: false });
    }

    // ── REGULAR EXCHANGE ─────────────────────────────────────────────────────
    // questionIndex = the question that was LAST ASKED (user just answered it)
    const lastAskedIndex = onboardingState.questionIndex || 0;
    const nextQuestionIndex = lastAskedIndex + 1;

    let responseText = '';
    let newOnboardingComplete = false;
    let responseChips = null;

    if (shouldCompleteOnboarding(nextQuestionIndex)) {
      // User answered the last question (Q11, index 10) — complete onboarding
      newOnboardingComplete = true;
      onboardingState = {};
      responseText = COMPLETION_MESSAGES[safeLang] || COMPLETION_MESSAGES.en;

    } else {
      // Ask the next pre-written question
      const nextQuestion = qList[nextQuestionIndex];

      // Build prompt: acknowledge briefly + ask next question verbatim
      const systemPrompt = buildAcknowledgmentPrompt(safeLang, nextQuestion);

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 350,
          system: systemPrompt,
          messages: [{ role: 'user', content: message || '...' }]
        })
      });
      const data = await apiRes.json();
      responseText = (data.content && data.content[0]) ? data.content[0].text.trim() : nextQuestion;

      // If this is Q11 (index 10), return choice chips
      if (nextQuestionIndex === 10) {
        responseChips = (Q11_CHIPS[safeLang] || Q11_CHIPS.en);
      }

      onboardingState = { started: true, questionIndex: nextQuestionIndex };
    }

    // Save state
    const updateFields = {
      onboardingState,
      onboardingProgress,
      updatedAt: new Date()
    };
    if (newOnboardingComplete) {
      updateFields.onboardingComplete = true;
      updateFields.onboardingCompletedAt = String(Date.now());
      updateFields.guidanceMode = true;
      updateFields.guidanceDay = 1;
      updateFields.stage = 'chat';
    }
    await db.update(userData).set(updateFields).where(eq(userData.userId, req.session.userId));

    res.json({
      text: responseText,
      onboardingComplete: newOnboardingComplete,
      chips: responseChips
    });

  } catch(e) {
    console.error('[ONBOARDING CHAT ERROR]', e.message || e);
    res.status(500).json({ error: 'Failed to process onboarding message' });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/opening-message', async (req, res) => {
  try {
    const openingMode = req.query.mode || 'deep';
    const rawLocalHour = parseInt(req.query.localHour, 10);
    const localHour = (!isNaN(rawLocalHour) && rawLocalHour >= 0 && rawLocalHour <= 23) ? rawLocalHour : new Date().getHours();
    const queryLang = ['en', 'th'].includes(req.query.lang) ? req.query.lang : null;
    let params = { userData: {}, mode: openingMode, localHour, lang: queryLang || 'en' };
    let uData = null;
    if (req.session.userId) {
      const [row] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
      uData = row;
      if (uData) {
        const habits = uData.patterns?.habits || [];
        params = {
          userMemory: uData.memories || {},
          sessionSummary: null,
          habits: habits,
          lastActiveAt: uData.lastActiveAt || uData.lastActiveDate || null,
          guidanceDay: uData.guidanceDay || 1,
          lang: queryLang || uData.lang || 'en',
          userData: { lastOpeningMessage: uData.lastOpeningMessage },
          openLoops: uData.openLoops || [],
          mode: openingMode,
          localHour,
          name: uData.onboardingProgress?.preferredName || uData.answers?.name || uData.identityProfile?.name || null
        };
      }
    }
    if (uData && req.session.userId) {
      await updateGuidanceDay(req.session.userId);
      const [refreshed] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
      if (refreshed) {
        uData = refreshed;
        params.guidanceDay = refreshed.guidanceDay || 1;
        params.lastActiveAt = refreshed.lastActiveAt || refreshed.lastActiveDate || null;
      }
    }

    // If user was redirected from Daily with a topic, open with a direct question about it
    const shiftContext = req.query.context ? decodeURIComponent(req.query.context) : null;
    let contextualOpeningText = null;
    if (shiftContext && openingMode === 'deep') {
      const lang = (uData && uData.lang) || 'en';
      const isThai = lang === 'th';
      const contextPrompt = isThai
        ? `คุณคือ Clarious — thinking partner ที่เงียบสงบและฉลาด\n\nผู้ใช้เพิ่งย้ายจาก Daily tab มาที่ Deep Thinking tab เพราะสิ่งที่พูดถึง:\n"${shiftContext}"\n\nเขียนประโยคเปิดบทสนทนา Deep Thinking 1-2 ประโยคเท่านั้น\nรับรู้สิ่งที่เขาพูด แล้วถามคำถามที่ตรงจุดและลึกที่สุดเพื่อเริ่มต้น\nอย่าทำซ้ำสิ่งที่เขาพูด ถามในสิ่งที่สำคัญกว่า\nใช้ภาษาไทยธรรมชาติ ไม่ใช้ markdown`
        : `You are Clarious — a calm, intelligent thinking partner.\n\nThe user just moved from Daily tab into Deep Thinking because of what they said:\n"${shiftContext}"\n\nWrite a 1-2 sentence opening for this Deep Thinking session only.\nAcknowledge what brought them here, then ask the single most important question to get started.\nDo not repeat back what they said. Ask what matters most.\nPlain text, no markdown.`;
      try {
        const ctxRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: contextPrompt }] })
        });
        const ctxData = await ctxRes.json();
        contextualOpeningText = ctxData?.content?.[0]?.text?.trim() || null;
      } catch(e) { /* fallback to generic */ }
    }

    const opening = buildOpeningMessage(params);
    if (shiftContext && openingMode === 'deep') {
      // Always clear chips when user arrived with context — they already know what they want to discuss
      opening.chips = null;
      if (contextualOpeningText) opening.text = contextualOpeningText;
    }

    // Part 5 — Personalized Haiku greeting (post-onboarding)
    // Day 9+: all tiers get memory-aware greeting. Days 2-8: free tier gets simple name/goal greeting.
    if (uData && uData.onboardingComplete === true && !contextualOpeningText) {
      const greetLang = queryLang || uData.lang || 'en';
      const isThai = greetLang === 'th';
      const guidanceComplete = (uData.guidanceDay || 0) > 8;
      const digest = uData.memoryDigest || '';
      const userName = uData.onboardingProgress?.preferredName || uData.answers?.name || uData.identityProfile?.name || '';
      let greetPrompt = '';

      if (guidanceComplete && digest) {
        // Established user — personalized greeting using memory digest
        const hourNote = localHour >= 5 && localHour <= 11 ? 'morning'
          : localHour >= 12 && localHour <= 17 ? 'afternoon' : 'evening';
        greetPrompt = isThai
          ? `คุณคือ Clarious\n\nรู้เกี่ยวกับผู้ใช้:\n${digest}\n\n${userName ? `เรียกเขาว่า "${userName}" — ต้องเริ่มด้วยการทักชื่อเขา` : 'ไม่รู้ชื่อ'}\nช่วงเวลา: ${hourNote}\n\n1-2 ประโยค อบอุ่น อ้างอิงสิ่งที่รู้จริงเกี่ยวกับเขา จบด้วยการเชิญแบบเปิดกว้าง ไม่ถามคำถามชัดเจน ภาษาไทยธรรมชาติ ไม่ใช้ markdown`
          : `You are Clarious.\n\nWhat you know about this user:\n${digest}\n\n${userName ? `Their name is ${userName}. You MUST open by addressing them as "${userName}".` : 'Name unknown.'}\nTime of day: ${hourNote}\n\n1-2 sentences. Warm. Reference something real from their context. End with a soft open invitation — no pointed question. Plain text only.`;
      } else if ((uData.tier === 'free' || !uData.tier) && uData.lastActiveAt && !guidanceComplete && userName) {
        // Free tier, still in guidance phase — simple name/goal greeting (only when name is known)
        const userGoal = uData.answers?.goal || uData.answers?.['0'] || '';
        const userFocus = uData.identityProfile?.currentFocus || uData.answers?.focus || '';
        greetPrompt = isThai
          ? `สร้างคำทักทายอบอุ่น 1-2 ประโยค\n\nต้องขึ้นต้นด้วยการทักชื่อ "${userName}" ก่อนเสมอ\nเป้าหมาย: ${userGoal}\nโฟกัส: ${userFocus}\n\nทำให้รู้สึกเหมือนกลับมาพบกันอีกครั้ง เชิญชวนให้แชร์สิ่งที่อยู่ในใจ ตอบเป็นภาษาไทยเท่านั้น`
          : `Generate a warm 1-2 sentence greeting.\n\nYou MUST start by addressing the user as "${userName}".\nGoal: ${userGoal}\nFocus: ${userFocus}\n\nMake it feel like reconnecting. Invite them to share what is on their mind. Plain text only.`;
      } else if (guidanceComplete && !digest && userName) {
        // Established user but no memory digest yet — warm name + time-of-day greeting
        const hourNote = localHour >= 5 && localHour <= 11 ? 'morning'
          : localHour >= 12 && localHour <= 17 ? 'afternoon' : 'evening';
        greetPrompt = isThai
          ? `1-2 ประโยคสั้น ทักทาย "${userName}" อบอุ่น ช่วงเวลา ${hourNote} ชวนให้แชร์สิ่งที่ค้างใจ ไม่ถามคำถามตรงๆ ภาษาไทยธรรมชาติ ไม่ใช้ markdown`
          : `Write 1-2 short sentences. Warmly greet "${userName}" for the ${hourNote}. End with a gentle open invitation — no direct question. Plain text only.`;
      }

      if (greetPrompt) {
        try {
          const greetRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100, messages: [{ role: 'user', content: greetPrompt }] })
          });
          const greetData = await greetRes.json();
          const greetText = greetData?.content?.[0]?.text?.trim();
          if (greetText) opening.text = greetText;
        } catch(e) { /* fallback to static opening */ }
      }
    }

    let stallNudge = null;
    if (uData && uData.guidanceMode) {
      const openedMultiple = (uData.guidanceDayOpenCount || 0) >= 2;
      const notEngaged = !uData.userSentMessageToday;
      if (openedMultiple && notEngaged) {
        const nudges = {
          en: "A quick message today keeps your progress moving.",
          th: "ส่งข้อความสั้นๆ วันนี้ เพื่อให้ความก้าวหน้าของคุณไม่หยุด"
        };
        const lang = uData.lang || 'en';
        stallNudge = nudges[lang] || nudges.en;
      }
      await db.update(userData).set({
        guidanceDayOpenCount: (uData.guidanceDayOpenCount || 0) + 1,
        updatedAt: new Date()
      }).where(eq(userData.userId, req.session.userId));
    }

    if (req.session.userId) {
      const updateFields = {
        lastOpeningMessage: opening.text,
        updatedAt: new Date()
      };
      await db.update(userData).set(updateFields).where(eq(userData.userId, req.session.userId));
    }
    res.json({ ...opening, nudge: stallNudge || null });
  } catch(e) {
    res.json({ text: "What's on your mind today?", type: "fallback", chips: ["Something specific", "General check-in", "Not sure yet"], nudge: null });
  }
});

// QUESTION CONTROL SYSTEM
// ======================================

const questionMemory = new Map();

function countQuestions(text) {
  return (text.match(/\?/g) || []).length;
}

function enforceQuestionLimit(text) {
  if (countQuestions(text) <= 1) return text;

  let found = 0;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '?') {
      found++;
      if (found <= 1) {
        result += '?';
      } else {
        result += '.';
      }
    } else {
      result += text[i];
    }
  }
  return result;
}

function extractLastQuestion(text) {
  const match = text.match(/([^.!?\n]*\?)/g);
  if (match && match.length > 0) {
    return match[match.length - 1].trim();
  }
  return null;
}

function detectResponseMode(text) {
  const hasQuestion = countQuestions(text) > 0;
  if (hasQuestion) return 'clarification';

  const sentences = text.split(/[.!]\s+/).filter(s => s.length > 10);
  if (sentences.length === 0) return 'reflection';

  let scores = { insight: 0, guidance: 0, challenge: 0, synthesis: 0, advancement: 0, reflection: 0 };

  const lower = text.toLowerCase();
  const insightPhrases = ['i notice', 'pattern here', 'seems like', 'what stands out', 'underlying', 'root of', 'real issue'];
  const guidancePhrases = ['one approach', 'you might', 'i\'d suggest', 'worth trying', 'a practical step', 'start by', 'focus on'];
  const challengePhrases = ['have you considered', 'worth examining', 'flip side', 'another angle', 'what if the opposite', 'blind spot'];
  const synthesisPhrases = ['connecting', 'ties together', 'bigger picture', 'thread between', 'common theme', 'pulling together'];
  const advancePhrases = ['next step', 'moving forward', 'from here', 'action you can take', 'concrete move', 'way forward'];

  for (const p of insightPhrases) if (lower.includes(p)) scores.insight += 2;
  for (const p of guidancePhrases) if (lower.includes(p)) scores.guidance += 2;
  for (const p of challengePhrases) if (lower.includes(p)) scores.challenge += 2;
  for (const p of synthesisPhrases) if (lower.includes(p)) scores.synthesis += 2;
  for (const p of advancePhrases) if (lower.includes(p)) scores.advancement += 2;

  let best = 'reflection';
  let bestScore = 0;
  for (const [mode, score] of Object.entries(scores)) {
    if (score > bestScore) { bestScore = score; best = mode; }
  }
  return best;
}

function detectEmotionalDepth(userMessage) {
  const strongEmotional = ['scared', 'afraid', 'anxious', 'overwhelmed', 'hopeless', 'exhausted', 'broken', 'crying', 'grief', 'depressed'];
  const mildEmotional = ['worried', 'frustrated', 'confused', 'hurt', 'angry', 'sad', 'lonely', 'lost', 'stuck'];
  const msg = userMessage.toLowerCase();
  let strongCount = 0;
  let mildCount = 0;
  for (const word of strongEmotional) {
    if (msg.includes(word)) strongCount++;
  }
  for (const word of mildEmotional) {
    if (msg.includes(word)) mildCount++;
  }
  return strongCount >= 1 && (strongCount + mildCount) >= 2;
}

function buildQuestionControlLayer(userId, userMessage) {
  const mem = questionMemory.get(userId);

  let avoidRepeat = '';
  let cooldownRule = '';
  let pacingRule = '';
  let emotionalRule = '';

  if (mem && mem.lastQuestion) {
    avoidRepeat = `\nAvoid asking questions similar to: "${mem.lastQuestion}"\n`;
  }

  if (mem && mem.turnsSinceQuestion !== undefined && mem.turnsSinceQuestion < 2) {
    cooldownRule = `\nA question was asked recently. Prefer reflection, insight, or synthesis instead of questioning this turn.\n`;
  }

  if (mem && mem.lastMode) {
    pacingRule = `\nYour last interaction style was "${mem.lastMode}". If possible, vary your approach — but if the situation genuinely calls for the same style again, that is acceptable.\n`;
  }

  if (detectEmotionalDepth(userMessage || '')) {
    emotionalRule = `\nThe user's message contains deep emotional or reflective content. Prefer statements over questions. Allow processing space. Do not interrogate emotion.\n`;
  }

  return `
Response modes (pick ONE silently): Reflection | Insight | Clarification | Guidance | Challenge | Synthesis | Advancement

Every response must: increase clarity, reveal something unnoticed, or move forward. No filler.

Questions: Only when progress is blocked. Max ONE per response. Often best with none.
${avoidRepeat}${cooldownRule}${emotionalRule}${pacingRule}
LANGUAGE: Respond entirely in the user's language. Never mix languages. Never append English to non-English responses.
`;
}

const GROUNDING_TRIGGERS = ["difference", "compare", "better", "why", "how come", "what's the point", "does it matter"];
const GROUNDING_COOLDOWN = 180000;
const groundingTimestamps = new Map();

const GROUNDING_QUESTIONS = {
  en: [
    "What decision are you facing right now?",
    "What feels most unclear today?",
    "What are you trying to move forward on?",
    "Where do you feel stuck recently?"
  ],
  th: [
    "ตอนนี้คุณกำลังเผชิญกับการตัดสินใจอะไรอยู่?",
    "วันนี้อะไรที่รู้สึกไม่ชัดเจนที่สุด?",
    "คุณกำลังพยายามผลักดันเรื่องอะไรให้ก้าวหน้า?",
    "ช่วงนี้คุณรู้สึกติดอยู่ตรงไหน?"
  ],
};

function needsGroundingQuestion(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return false;
  const msg = userMessage.toLowerCase();
  if (msg.split(/\s+/).length < 5) return false;
  return GROUNDING_TRIGGERS.some(t => msg.includes(t));
}

function groundingQuestion(lang) {
  const questions = GROUNDING_QUESTIONS[lang] || GROUNDING_QUESTIONS.en;
  return questions[Math.floor(Math.random() * questions.length)];
}

function shouldAskGrounding(userId) {
  const last = groundingTimestamps.get(userId) || 0;
  return Date.now() - last > GROUNDING_COOLDOWN;
}

function markGroundingAsked(userId) {
  groundingTimestamps.set(userId, Date.now());
}

function replyAlreadyHasQuestion(text) {
  if (!text) return false;
  const lastChunk = text.slice(-200);
  return /\?\s*$/.test(lastChunk.trim());
}

async function updateGuidanceDay(userId) {
  try {
    const [uGuidance] = await db.select().from(userData).where(eq(userData.userId, userId));
    if (!uGuidance || !uGuidance.guidanceMode) return;

    const today = new Date().toDateString();
    if (uGuidance.lastGuidanceDate === today) return;

    const daysAway = uGuidance.lastActiveAt
      ? (Date.now() - new Date(uGuidance.lastActiveAt).getTime()) / 86400000
      : 0;

    if (daysAway >= 2) {
      await db.update(userData).set({
        lastActiveAt: new Date().toISOString(),
        updatedAt: new Date()
      }).where(eq(userData.userId, userId));
      return;
    }

    if (!uGuidance.userSentMessageToday) return;

    const newDay = (uGuidance.guidanceDay || 0) + 1;
    const updateFields = {
      guidanceDay: newDay,
      lastGuidanceDate: today,
      lastActiveAt: new Date().toISOString(),
      userSentMessageToday: false,
      guidanceDayOpenCount: 0,
      updatedAt: new Date()
    };

    if (newDay > 7) {
      updateFields.guidanceMode = false;
      updateFields.guidanceDay = 8;
      const existingMem = uGuidance.memories && typeof uGuidance.memories === 'object' && !Array.isArray(uGuidance.memories)
        ? uGuidance.memories : {};
      if (!existingMem.meta) existingMem.meta = {};
      existingMem.meta.guidanceCompleted = true;
      existingMem.meta.guidanceCompletedAt = new Date().toISOString();
      existingMem.meta.leadershipStyle = "collaborative_autonomous";
      updateFields.memories = existingMem;
    }

    await db.update(userData).set(updateFields).where(eq(userData.userId, userId));
  } catch(e) { console.error('[SAVE DATA ERROR]', e.message || e); }
}

app.post('/api/chat', async (req, res) => {
  try {
    let tier = 'guest';
    let shouldNudge = false;
    let newMsgCount = 0;
    if (req.session.userId) {
      try {
        const [data] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
        tier = data ? (data.tier || 'free') : 'free';
        const today = new Date().toISOString().slice(0, 10);
        const isNewDay = !data || data.msgCountDate !== today;
        const currentCount = isNewDay ? 0 : (data.msgCount || 0);
        const dailyLimit = tier === 'partner' ? 30 : 10;

        // ── LIMIT CHECK — must return before any AI processing ──
        if (currentCount >= dailyLimit) {
          return res.status(429).json({
            limitReached: true,
            tier,
            message: tier === 'free'
              ? 'You have reached your limit for today. Upgrade to Partner to get 30 messages per day and persistent memory.'
              : 'You have reached your 30 messages for today. Come back tomorrow.'
          });
        }

        // ── ONLY reached if under limit ──
        newMsgCount = currentCount + 1;

        // Free tier: clear conversation history on new day
        if (isNewDay && tier === 'free') {
          const freeResetUserId = String(req.session.userId);
          if (sessionStore.has(freeResetUserId)) {
            const sess = sessionStore.get(freeResetUserId);
            sess.rollingSummary = '';
            sess.turns = [];
          }
          await db.update(userData).set({
            messages: [],
            threadSummaries: {},
            msgCount: newMsgCount,
            msgCountDate: today,
            userSentMessageToday: true,
            guidanceDayOpenCount: 0,
            lastActiveAt: new Date().toISOString(),
            updatedAt: new Date()
          }).where(eq(userData.userId, req.session.userId));
        } else {
          await db.update(userData).set({
            msgCount: newMsgCount,
            msgCountDate: today,
            userSentMessageToday: true,
            guidanceDayOpenCount: 0,
            lastActiveAt: new Date().toISOString(),
            updatedAt: new Date()
          }).where(eq(userData.userId, req.session.userId));
        }

        // Nudge when free user is close to limit
        if (tier === 'free' && newMsgCount >= 8 && newMsgCount < dailyLimit) {
          shouldNudge = true;
        }
      } catch(dbErr) {
        console.error('[TIER FETCH ERROR]', dbErr.message || dbErr);
        tier = 'free';
      }
    } else {
      if (!req.session.guestMsgCount) req.session.guestMsgCount = 0;
      if (req.session.guestMsgCount >= 10) {
        return res.status(429).json({ error: 'limit', limit: 10, limitReached: true, tier: 'guest', message: 'You have reached your limit. Create an account to continue.' });
      }
      req.session.guestMsgCount++;
    }

    const userId = req.session.userId ? String(req.session.userId) : 'guest_' + req.sessionID;

    if (!runtimeUsers.has(userId)) {
      runtimeUsers.set(userId, {
        dailyTokens: 0,
        softWarnedToday: false,
        efficiencyMode: false,
        lastUsageDate: new Date().toDateString()
      });
    }
    const runtimeUser = runtimeUsers.get(userId);

    resetDailyUsage(runtimeUser);

    if (!req.session.lastActive) req.session.lastActive = Date.now();
    checkSessionTimeout(req.session);
    req.session.lastActive = Date.now();

    const rawMsg = req.body.messages && req.body.messages.length > 0
      ? req.body.messages[req.body.messages.length - 1].content || ''
      : '';

    const { text: userMsg, truncated } = truncateInput(rawMsg);
    if (truncated && req.body.messages && req.body.messages.length > 0) {
      req.body.messages[req.body.messages.length - 1].content = userMsg;
    }

    if (req.session.userId) {
      try {
        const [uDataRepair] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
        if (uDataRepair && !uDataRepair.memorySeeded && uDataRepair.answers && Object.keys(uDataRepair.answers).length > 0 && uDataRepair.stage === 'chat') {
          async function callModelForRepair(model, systemPrompt, userContent) {
            const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: model,
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userContent }]
              })
            });
            const d = await apiRes.json();
            return d.content && d.content[0] ? d.content[0].text : '{}';
          }
          await repairLegacyIdentity({ userRecord: uDataRepair, callModel: callModelForRepair, db, userData, eq });
        }
      } catch(e) { console.error('[LEGACY REPAIR ERROR]', e.message || e); }
    }

    if (req.session.userId && detectIdentityShift(userMsg)) {
      try {
        const [uDataShift] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
        if (uDataShift && cooldownPassed(uDataShift.lastIdentityUpdate)) {
          async function callModelForShift(model, systemPrompt, userContent) {
            const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: model,
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userContent }]
              })
            });
            const d = await apiRes.json();
            return d.content && d.content[0] ? d.content[0].text : '{}';
          }

          const existingMem = uDataShift.memories && typeof uDataShift.memories === 'object' && !Array.isArray(uDataShift.memories)
            ? uDataShift.memories
            : { goals: [], recurringStruggles: [], strengths: [], decisionPatterns: [], identityDirection: "", lastUpdated: null };

          const updatedMem = await runHaikuMemoryMerge({
            userId: req.session.userId,
            message: userMsg,
            existingMemory: existingMem,
            callModel: callModelForShift
          });

          await db.update(userData).set({
            memories: updatedMem,
            lastIdentityUpdate: new Date(),
            updatedAt: new Date()
          }).where(eq(userData.userId, req.session.userId));
        }
      } catch(e) { console.error('[IDENTITY SHIFT ERROR]', e.message || e); }
    }

    const chatMode = req.body.mode || 'deep';
    const complexity = detectComplexity(userMsg);

    const budgetState = checkBudget(runtimeUser, complexity, selectModel);
    let modelName = budgetState.model;
    const efficiencyMode = budgetState.efficiencyMode || false;

    const deepSignal = chatMode === 'daily' ? detectDeepTopic(userMsg) : false;

    let userLang = 'en';
    if (req.session.userId) {
      try {
        const [langData] = await db.select({ lang: userData.lang }).from(userData).where(eq(userData.userId, req.session.userId));
        if (langData && langData.lang) userLang = langData.lang;
      } catch(e) { console.error('[LANG FETCH ERROR]', e.message || e); }
    }

    const conversation = req.body.messages || [];
    const wantStream = req.body.stream === true;

    // Phase-based routing and token limits
    const phase = detectConversationPhase(conversation, userMsg);

    if (!efficiencyMode) {
      const wordCount = userMsg.trim().split(/\s+/).filter(Boolean).length;
      const isThaiDeep = chatMode === 'deep' && userLang === 'th';
      if (isThaiDeep) {
        // Thai Deep: Sonnet only when ALL THREE conditions are true
        modelName = (phase === 'decision' && complexity === 'HIGH' && wordCount >= 20)
          ? 'claude-sonnet-4-5-20251001'
          : 'claude-haiku-4-5-20251001';
      } else {
        // EN and others: Sonnet only when deep mode AND message is genuinely HIGH complexity
        // (stuck/looping, ambiguous multi-direction, synthesis, or deep reasoning required)
        // Decision phase alone is NOT sufficient — simple decision-phase messages use Haiku
        modelName = (chatMode === 'deep' && complexity === 'HIGH')
          ? 'claude-sonnet-4-5-20251001'
          : 'claude-haiku-4-5-20251001';
      }
    }

    // HIGH complexity in deep mode always gets decision-level token budget (900)
    const effectivePhase = (chatMode === 'deep' && complexity === 'HIGH') ? 'decision' : phase;
    let tokenLimit = efficiencyMode
      ? getMaxTokens(complexity, true, userLang)
      : phaseTokenLimit(effectivePhase, chatMode, userLang);

    // Part 7 — Token budget protection for free users
    if (tier === 'free' && runtimeUser.dailyTokens > 40000) {
      modelName = 'claude-haiku-4-5-20251001';
      tokenLimit = Math.min(tokenLimit, 150);
    } else if (tier === 'free' && runtimeUser.dailyTokens > 32000) {
      modelName = 'claude-haiku-4-5-20251001';
      tokenLimit = Math.min(tokenLimit, 300);
    }

    let userMemoryData = null;
    let userOpenLoops = [];
    let userPatterns = null;
    let userMemoryDigest = null;
    if (req.session.userId) {
      try {
        const [uData] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
        if (uData) {
          if (uData.memories) loadMemoryFromDB(userId, uData.memories);
          if (uData.openLoops) userOpenLoops = uData.openLoops;
          if (uData.patterns) userPatterns = uData.patterns;
          if (uData.memoryDigest) userMemoryDigest = uData.memoryDigest;
        }
      } catch(dbErr) {
        console.error('[MEMORY LOAD ERROR]', dbErr.message || dbErr);
      }
    }
    const userMemory = initMemory(userId);

    const now = new Date();
    const timeContext = `\nCurrent date: ${now.toDateString()}\nThe assistant exists in the present moment with the user.\nIf asked about time, assume awareness of the current year.\n`;
    updateIdentity(userId, userMsg);
    const identityLayer = buildIdentityPrompt(userId);
    const calmLayer = buildCalmAuthorityPrompt(userMsg);
    const adaptiveLayer = buildAdaptivePrompt(userId, userMsg);
    const capabilityLayer = buildCapabilityLayer(chatMode, conversation, userMsg);
    const thaiBlock = detectThai(userMsg)
      ? '\n\n' + (chatMode === 'deep' ? THAI_LANGUAGE_RULES : THAI_LANGUAGE_RULES_MINIMAL)
      : '';
    const attentionLayer = buildAttentionLayer(complexity === "HIGH" ? "opus" : "sonnet");
    const continuityLayer = buildContinuityLayer(userId, userMsg);
    const questionControlLayer = buildQuestionControlLayer(userId, userMsg);
    const sessionLayer = getSessionInjection(userId);
    let truncationNotice = '';
    if (truncated) {
      truncationNotice = '\nNote: The user sent a long message. Focus on the core of what they shared.\n';
    }
    let budgetNotice = '';
    if (budgetState.systemNotice) {
      budgetNotice = '\n' + budgetState.systemNotice + '\n';
    }
    const enhancedSystem = sessionLayer + '\n\n' + timeContext + '\n\n' + identityLayer + '\n\n' + calmLayer + '\n\n' + adaptiveLayer + '\n\n' + capabilityLayer + thaiBlock + '\n\n' + attentionLayer + '\n\n' + continuityLayer + '\n\n' + questionControlLayer + '\n\n' + truncationNotice + budgetNotice + (req.body.system || '');

    let guidanceData = null;
    if (req.session.userId) {
      try {
        const [gData] = await db.select({ guidanceMode: userData.guidanceMode, guidanceDay: userData.guidanceDay }).from(userData).where(eq(userData.userId, req.session.userId));
        if (gData) guidanceData = gData;
      } catch(e) { console.error('[GUIDANCE FETCH ERROR]', e.message || e); }
    }

    const sessionSummary = sessionStore.has(userId) ? sessionStore.get(userId).rollingSummary : '';
    const builtMessages = buildContext({
      enhancedSystem,
      conversation,
      rollingSummary: sessionSummary,
      userMemory,
      guidanceData,
      openLoops: userOpenLoops,
      patterns: userPatterns,
      mode: chatMode,
      deepSignal,
      memoryDigest: userMemoryDigest,
      phaseOverride: effectivePhase
    });
    const systemContent = builtMessages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const chatMessages = builtMessages.filter(m => m.role !== 'system');

    if (chatMessages.length === 0) {
      console.error('[CHAT ERROR] No chat messages after buildContext. conversation length:', conversation.length);
      if (wantStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.flushHeaders();
        res.write('data: ' + JSON.stringify({ type: 'error', error: { message: 'Empty conversation' } }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      return res.status(400).json({ error: 'No messages provided' });
    }

    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      async function callAnthropicStream() {
        return fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: tokenLimit,
            stream: true,
            system: systemContent,
            messages: chatMessages
          })
        });
      }

      const estimatedSystemTokens = Math.ceil(systemContent.length / 4);
      const estimatedMsgTokens = Math.ceil(chatMessages.reduce((s, m) => s + (m.content || '').length / 4, 0));
      console.log('[CHAT] model=' + modelName + ' tokens=' + tokenLimit + ' system~' + estimatedSystemTokens + ' msgs~' + estimatedMsgTokens + ' lang=' + (userLang || 'en') + ' msgs=' + chatMessages.length);

      let response = await callAnthropicStream();

      if (!response.ok && (response.status === 529 || response.status === 503 || response.status === 500)) {
        console.log('[CHAT] Retrying after', response.status);
        await new Promise(r => setTimeout(r, 2000));
        response = await callAnthropicStream();
      }

      if (!response.ok && response.status === 529) {
        console.log('[CHAT] Retry 2 after 529');
        await new Promise(r => setTimeout(r, 3000));
        response = await callAnthropicStream();
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown API error' }));
        console.error('[CHAT ERROR] API response not OK:', response.status, JSON.stringify(errData));
        res.write('data: ' + JSON.stringify({ type: 'error', error: errData }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (!dataStr || dataStr === '[DONE]') continue;
              try {
                const event = JSON.parse(dataStr);
                if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
                  fullReply += event.delta.text;
                  res.write('data: ' + JSON.stringify({ text: event.delta.text }) + '\n\n');
                } else if (event.type === 'error') {
                  console.error('[STREAM ERROR]', JSON.stringify(event));
                }
              } catch(e) {}
            }
          }
        }

        if (buffer.trim()) {
          const remaining = buffer.split('\n');
          for (const line of remaining) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (!dataStr || dataStr === '[DONE]') continue;
              try {
                const event = JSON.parse(dataStr);
                if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
                  fullReply += event.delta.text;
                  res.write('data: ' + JSON.stringify({ text: event.delta.text }) + '\n\n');
                }
              } catch(e) {}
            }
          }
        }
      } catch(streamErr) {
        console.error('[STREAM READ ERROR]', streamErr.message || streamErr);
      }

      try {
        fullReply = enforceQuestionLimit(fullReply);
        const detectedMode = detectResponseMode(fullReply);
        const lastQ = extractLastQuestion(fullReply);
        const prevMem = questionMemory.get(userId) || {};
        questionMemory.set(userId, {
          lastQuestion: lastQ || prevMem.lastQuestion || null,
          turnsSinceQuestion: lastQ ? 0 : (prevMem.turnsSinceQuestion || 0) + 1,
          lastMode: detectedMode
        });
        storeTurn(userId, userMsg, fullReply);

        const estimatedInput = systemContent.length / 4 + chatMessages.reduce((s, m) => s + (m.content || '').length / 4, 0);
        const estimatedOutput = fullReply.length / 4;
        runtimeUser.dailyTokens += Math.ceil(estimatedInput + estimatedOutput);
        req.session.lastActive = Date.now();
      } catch(postErr) {
        console.error('[POST-STREAM ERROR]', postErr.message || postErr);
      }

      if (chatMode !== 'daily' && shouldUpdateMemory(userId, complexity, req.session)) {
        try {
          const extractPrompt = buildMemoryExtractionPrompt(userMsg);
          const memRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 200,
              messages: [{ role: 'user', content: extractPrompt }]
            })
          });
          const memData = await memRes.json();
          if (memData.content && memData.content[0]) {
            const rawText = memData.content[0].text || '';
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extracted = JSON.parse(jsonMatch[0]);
              mergeExtractedMemory(userId, extracted, req.session);
              if (req.session.userId) {
                const memToSave = getMemoryForSave(userId);
                await db.update(userData).set({
                  memories: memToSave,
                  updatedAt: new Date()
                }).where(eq(userData.userId, req.session.userId));
                // Background digest generation — non-blocking
                const _digestUid = req.session.userId;
                const _digestMem = { ...memToSave };
                setTimeout(async () => {
                  try {
                    const digest = await generateMemoryDigest(_digestMem, async (model, _s, prompt) => {
                      const r = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
                        body: JSON.stringify({ model, max_tokens: 150, messages: [{ role: 'user', content: prompt }] })
                      });
                      const d = await r.json();
                      return d.content && d.content[0] ? d.content[0].text : null;
                    });
                    if (digest) await db.update(userData).set({ memoryDigest: digest, memoryDigestUpdatedAt: Date.now().toString(), updatedAt: new Date() }).where(eq(userData.userId, _digestUid));
                  } catch(e) { console.error('[DIGEST ERROR]', e.message); }
                }, 0);
              }
            }
          }
        } catch(e) { console.error('[MEMORY EXTRACT ERROR]', e.message || e); }
      }

      if (Math.random() < 0.2 && sessionStore.has(userId)) {
        const session = sessionStore.get(userId);
        if (session.turns.length >= 6) {
          const summaryPrompt = buildRollingSummary(session.turns);
          try {
            const sumRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                messages: [{ role: 'user', content: summaryPrompt }]
              })
            });
            const sumData = await sumRes.json();
            if (sumData.content && sumData.content[0]) {
              session.rollingSummary = sumData.content[0].text || '';
            }
          } catch(e) { console.error('[ROLLING SUMMARY ERROR]', e.message || e); }
        }
      }

      if (chatMode !== 'daily' && req.session.userId) {
        try {
          let updatedLoops = resolveMatchingLoop(userMsg, userOpenLoops);
          const newLoop = extractOpenLoop(userMsg, updatedLoops, req.session.openLoopCreatedThisSession);
          if (newLoop) {
            updatedLoops.push(newLoop);
            req.session.openLoopCreatedThisSession = true;
          }
          if (JSON.stringify(updatedLoops) !== JSON.stringify(userOpenLoops)) {
            await db.update(userData).set({
              openLoops: updatedLoops,
              updatedAt: new Date()
            }).where(eq(userData.userId, req.session.userId));
          }
        } catch(e) { console.error('[OPEN LOOP ERROR]', e.message || e); }
      }

      if (deepSignal) {
        res.write('data: ' + JSON.stringify({ type: 'meta', suggestModeShift: true }) + '\n\n');
      }

      if (shouldNudge) {
        const nudgeMsg = userLang === 'th'
          ? 'คุณใกล้ถึงขีดจำกัดวันนี้แล้ว อัปเกรดเป็น Partner เพื่อรับ 30 ข้อความและบริบทต่อเนื่อง'
          : "You're close to today's limit. Upgrade to Partner for 30 messages and continuous context.";
        res.write('data: ' + JSON.stringify({ type: 'meta', nudge: true, nudgeMessage: nudgeMsg }) + '\n\n');
      }

      if (chatMode !== 'daily' && needsGroundingQuestion(userMsg) && shouldAskGrounding(userId) && !replyAlreadyHasQuestion(fullReply)) {
        const gq = groundingQuestion(userLang);
        const groundingText = '\n\n' + gq;
        res.write('data: ' + JSON.stringify({ text: groundingText }) + '\n\n');
        markGroundingAsked(userId);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05'
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: tokenLimit,
          system: systemContent,
          messages: chatMessages,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }]
        })
      });
      const data = await response.json();
      const textBlock = data.content && data.content.find(b => b.type === 'text');
      let assistantReply = textBlock ? textBlock.text || '' : (data.content && data.content[0] ? data.content[0].text || '' : '');
      assistantReply = enforceQuestionLimit(assistantReply);

      const detectedMode2 = detectResponseMode(assistantReply);
      const lastQ = extractLastQuestion(assistantReply);
      const prevMem2 = questionMemory.get(userId) || {};
      questionMemory.set(userId, {
        lastQuestion: lastQ || prevMem2.lastQuestion || null,
        turnsSinceQuestion: lastQ ? 0 : (prevMem2.turnsSinceQuestion || 0) + 1,
        lastMode: detectedMode2
      });

      if (data.content && data.content[0]) {
        data.content[0].text = assistantReply;
      }

      storeTurn(userId, userMsg, assistantReply);

      if (data.usage) {
        runtimeUser.dailyTokens += (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0);
      }
      req.session.lastActive = Date.now();

      if (chatMode !== 'daily' && shouldUpdateMemory(userId, complexity, req.session)) {
        try {
          const extractPrompt = buildMemoryExtractionPrompt(userMsg);
          const memRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 200,
              messages: [{ role: 'user', content: extractPrompt }]
            })
          });
          const memData2 = await memRes.json();
          if (memData2.content && memData2.content[0]) {
            const rawText = memData2.content[0].text || '';
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extracted = JSON.parse(jsonMatch[0]);
              mergeExtractedMemory(userId, extracted, req.session);
              if (req.session.userId) {
                const memToSave = getMemoryForSave(userId);
                await db.update(userData).set({
                  memories: memToSave,
                  updatedAt: new Date()
                }).where(eq(userData.userId, req.session.userId));
                // Background digest generation — non-blocking
                const _digestUid2 = req.session.userId;
                const _digestMem2 = { ...memToSave };
                setTimeout(async () => {
                  try {
                    const digest = await generateMemoryDigest(_digestMem2, async (model, _s, prompt) => {
                      const r = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
                        body: JSON.stringify({ model, max_tokens: 150, messages: [{ role: 'user', content: prompt }] })
                      });
                      const d = await r.json();
                      return d.content && d.content[0] ? d.content[0].text : null;
                    });
                    if (digest) await db.update(userData).set({ memoryDigest: digest, memoryDigestUpdatedAt: Date.now().toString(), updatedAt: new Date() }).where(eq(userData.userId, _digestUid2));
                  } catch(e) { console.error('[DIGEST ERROR]', e.message); }
                }, 0);
              }
            }
          }
        } catch(e) { console.error('[MEMORY EXTRACT ERROR]', e.message || e); }
      }

      if (Math.random() < 0.2 && sessionStore.has(userId)) {
        const session = sessionStore.get(userId);
        if (session.turns.length >= 6) {
          const summaryPrompt = buildRollingSummary(session.turns);
          try {
            const sumRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                messages: [{ role: 'user', content: summaryPrompt }]
              })
            });
            const sumData = await sumRes.json();
            if (sumData.content && sumData.content[0]) {
              session.rollingSummary = sumData.content[0].text || '';
            }
          } catch(e) { console.error('[ROLLING SUMMARY ERROR]', e.message || e); }
        }
      }

      if (chatMode !== 'daily' && req.session.userId) {
        try {
          let updatedLoops = resolveMatchingLoop(userMsg, userOpenLoops);
          const newLoop = extractOpenLoop(userMsg, updatedLoops, req.session.openLoopCreatedThisSession);
          if (newLoop) {
            updatedLoops.push(newLoop);
            req.session.openLoopCreatedThisSession = true;
          }
          if (JSON.stringify(updatedLoops) !== JSON.stringify(userOpenLoops)) {
            await db.update(userData).set({
              openLoops: updatedLoops,
              updatedAt: new Date()
            }).where(eq(userData.userId, req.session.userId));
          }
        } catch(e) { console.error('[OPEN LOOP ERROR]', e.message || e); }
      }

      if (deepSignal) {
        data.suggestModeShift = true;
      }

      if (shouldNudge) {
        const nudgeMsg = userLang === 'th'
          ? 'คุณใกล้ถึงขีดจำกัดวันนี้แล้ว อัปเกรดเป็น Partner เพื่อรับ 30 ข้อความและบริบทต่อเนื่อง'
          : "You're close to today's limit. Upgrade to Partner for 30 messages and continuous context.";
        data.nudge = true;
        data.nudgeMessage = nudgeMsg;
      }

      if (chatMode !== 'daily' && needsGroundingQuestion(userMsg) && shouldAskGrounding(userId) && !replyAlreadyHasQuestion(assistantReply)) {
        const gq = groundingQuestion(userLang);
        if (data.content && data.content[0]) {
          data.content[0].text += '\n\n' + gq;
        }
        markGroundingAsked(userId);
      }

      res.json(data);
    }
  } catch(e) {
    console.error('[CHAT FATAL]', e.message || e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    } else if (!res.writableEnded) {
      res.write('data: ' + JSON.stringify({ type: 'error', error: { message: e.message } }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

app.post('/api/deep-summary', async (req, res) => {
  const { messages, lang } = req.body;
  if (!messages || messages.length === 0) return res.json({ summary: '' });
  const msgs = messages.slice(-20);
  const conversation = msgs.map(m => `${m.role === 'user' ? 'User' : 'Clarious'}: ${m.content}`).join('\n\n');
  const systemPrompt = lang === 'th'
    ? 'สรุปการสนทนาต่อไปนี้เป็น 2-3 ประโยค เน้นหัวข้อหลักและข้อสรุปสำคัญที่เกิดขึ้น ตอบเป็นภาษาไทย'
    : 'Summarize this deep thinking conversation in 2-3 concise sentences. Focus on the core topic explored and any key insight or clarity reached. Be direct and specific.';
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system: systemPrompt,
        messages: [{ role: 'user', content: conversation }]
      })
    });
    const data = await apiRes.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';
    res.json({ summary: text });
  } catch (e) {
    console.error('[DEEP SUMMARY ERROR]', e.message || e);
    res.json({ summary: '' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__app_dirname, 'public', 'index.html'));
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

export { app };

const PORT = parseInt(process.env.PORT || '5000', 10);

const server = app.listen(PORT, '0.0.0.0', () => console.log('Running on port ' + PORT));

function gracefulShutdown(signal) {
  console.log(`[SHUTDOWN] ${signal} received — closing server...`);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed');
    pool.end(() => {
      console.log('[SHUTDOWN] Database pool closed');
      process.exit(0);
    });
  });
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced exit after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
