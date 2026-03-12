import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import session from 'express-session';
import bcrypt from 'bcrypt';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { db } from './db/index.js';
import { users, userData } from './shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import { buildAdaptivePrompt, detectComplexity, selectModel } from './adaptiveDepth.js';
import { updateIdentity, buildIdentityPrompt } from './identityLayer.js';
import { buildCalmAuthorityPrompt } from './calmAuthority.js';
import { buildCapabilityLayer } from './capabilityLayer.js';
import { buildAttentionLayer } from './hybridModel.js';
import { resetDailyUsage, truncateInput, checkBudget, maxTokens as getMaxTokens, checkSessionTimeout, shouldUpdateSummary, isMeaningfulAssistantResponse } from './utils/aiController.js';
import { buildContinuityLayer, initMemory, loadMemoryFromDB, shouldUpdateMemory, buildMemoryExtractionPrompt, mergeExtractedMemory, getMemoryForSave, extractOpenLoop, resolveMatchingLoop } from './continuityEngine.js';
import { sessionStore, storeTurn, buildRollingSummary, finalizeSession, getSessionInjection } from './sessionMemory.js';
import { buildContext, detectDeepTopic } from './contextBuilder.js';
import { seedMemoryFromOnboarding } from './onboardingIdentitySync.js';
import { detectIdentityShift } from './identityShiftDetector.js';
import { cooldownPassed } from './identityCooldown.js';
import { runHaikuMemoryMerge } from './memoryMerge.js';
import { repairLegacyIdentity } from './legacyIdentityRepair.js';
import { buildOpeningMessage } from './openingMessageEngine.js';

var __app_dirname;
try { __app_dirname = path.dirname(fileURLToPath(import.meta.url)); } catch(e) { __app_dirname = __dirname || process.cwd(); }

const app = express();

app.get('/health', (req, res) => { res.status(200).send('ok'); });

app.use(express.json({ limit: '2mb' }));

app.use(express.static(path.join(__app_dirname, 'public')));

const runtimeUsers = new Map();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
pool.on('error', (err) => { console.error('[SESSION DB] Pool error:', err.message); });
const PgSession = connectPgSimple(session);

const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

const sessionMiddleware = session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'life-assistant-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
});

app.use(function(req, res, next) {
  if (req.path.startsWith('/api')) {
    return sessionMiddleware(req, res, next);
  }
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
    res.json({ ok: true, email: user.email });
  } catch(e) {
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
    res.json({ ok: true, email: user.email });
  } catch(e) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const userId = req.session.userId ? String(req.session.userId) : null;
  if (userId) finalizeSession(userId);
  req.session.destroy(() => res.json({ ok: true }));
});

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

app.get('/api/opening-message', async (req, res) => {
  try {
    const openingMode = req.query.mode || 'deep';
    let params = { userData: {}, mode: openingMode };
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
          lang: uData.lang || 'en',
          userData: { lastOpeningMessage: uData.lastOpeningMessage },
          openLoops: uData.openLoops || [],
          mode: openingMode
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

    const opening = buildOpeningMessage(params);

    let stallNudge = null;
    if (uData && uData.guidanceMode) {
      const openedMultiple = (uData.guidanceDayOpenCount || 0) >= 2;
      const notEngaged = !uData.userSentMessageToday;
      if (openedMultiple && notEngaged) {
        const nudges = {
          en: "A quick message today keeps your progress moving.",
          ja: "今日ひとことメッセージを送るだけで、前に進み続けられます。",
          es: "Un mensaje rápido hoy mantiene tu progreso en marcha.",
          th: "ส่งข้อความสั้นๆ วันนี้ เพื่อให้ความก้าวหน้าของคุณไม่หยุด",
          ko: "오늘 짧은 메시지 하나가 당신의 성장을 이어갑니다."
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
  ja: [
    "今、どんな決断に直面していますか？",
    "今日、一番はっきりしないことは何ですか？",
    "今、何を前に進めようとしていますか？",
    "最近、どこで行き詰まっていますか？"
  ],
  es: [
    "¿Qué decisión estás enfrentando ahora mismo?",
    "¿Qué es lo que se siente más confuso hoy?",
    "¿Qué estás tratando de avanzar?",
    "¿Dónde te sientes atascado últimamente?"
  ],
  th: [
    "ตอนนี้คุณกำลังเผชิญกับการตัดสินใจอะไรอยู่?",
    "วันนี้อะไรที่รู้สึกไม่ชัดเจนที่สุด?",
    "คุณกำลังพยายามผลักดันเรื่องอะไรให้ก้าวหน้า?",
    "ช่วงนี้คุณรู้สึกติดอยู่ตรงไหน?"
  ],
  ko: [
    "지금 어떤 결정을 앞두고 있나요?",
    "오늘 가장 불분명하게 느껴지는 것은 무엇인가요?",
    "지금 무엇을 앞으로 나아가게 하려고 하고 있나요?",
    "최근에 어디서 막혀 있다고 느끼나요?"
  ]
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
    if (req.session.userId) {
      const [data] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
      tier = data ? data.tier : 'free';
      const today = new Date().toISOString().slice(0, 10);
      const currentCount = (data && data.msgCountDate === today) ? data.msgCount : 0;
      const limit = tier === 'subscriber' ? 200 : 50;
      if (currentCount >= limit) {
        return res.status(429).json({ error: 'limit', limit: limit });
      }
      await db.update(userData).set({
        msgCount: data && data.msgCountDate === today ? currentCount + 1 : 1,
        msgCountDate: today,
        userSentMessageToday: true,
        guidanceDayOpenCount: 0,
        lastActiveAt: new Date().toISOString(),
        updatedAt: new Date()
      }).where(eq(userData.userId, req.session.userId));
    } else {
      if (!req.session.guestMsgCount) req.session.guestMsgCount = 0;
      if (req.session.guestMsgCount >= 10) {
        return res.status(429).json({ error: 'limit', limit: 10 });
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

    if (chatMode === 'daily' && complexity !== 'HIGH') {
      modelName = 'claude-haiku-4-5-20251001';
    }

    const deepSignal = chatMode === 'daily' ? detectDeepTopic(userMsg) : false;

    let userLang = 'en';
    if (req.session.userId) {
      try {
        const [langData] = await db.select({ lang: userData.lang }).from(userData).where(eq(userData.userId, req.session.userId));
        if (langData && langData.lang) userLang = langData.lang;
      } catch(e) { console.error('[LANG FETCH ERROR]', e.message || e); }
    }

    const tokenLimit = getMaxTokens(complexity, efficiencyMode, userLang);

    const conversation = req.body.messages || [];
    const wantStream = req.body.stream === true;

    let userMemoryData = null;
    let userOpenLoops = [];
    let userPatterns = null;
    if (req.session.userId) {
      const [uData] = await db.select().from(userData).where(eq(userData.userId, req.session.userId));
      if (uData) {
        if (uData.memories) loadMemoryFromDB(userId, uData.memories);
        if (uData.openLoops) userOpenLoops = uData.openLoops;
        if (uData.patterns) userPatterns = uData.patterns;
      }
    }
    const userMemory = initMemory(userId);

    const now = new Date();
    const timeContext = `\nCurrent date: ${now.toDateString()}\nThe assistant exists in the present moment with the user.\nIf asked about time, assume awareness of the current year.\n`;
    updateIdentity(userId, userMsg);
    const identityLayer = buildIdentityPrompt(userId);
    const calmLayer = buildCalmAuthorityPrompt(userMsg);
    const adaptiveLayer = buildAdaptivePrompt(userId, userMsg);
    const capabilityLayer = buildCapabilityLayer();
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
    const enhancedSystem = sessionLayer + '\n\n' + timeContext + '\n\n' + identityLayer + '\n\n' + calmLayer + '\n\n' + adaptiveLayer + '\n\n' + capabilityLayer + '\n\n' + attentionLayer + '\n\n' + continuityLayer + '\n\n' + questionControlLayer + '\n\n' + truncationNotice + budgetNotice + (req.body.system || '');

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
      deepSignal
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
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: tokenLimit,
          system: systemContent,
          messages: chatMessages
        })
      });
      const data = await response.json();
      let assistantReply = data.content && data.content[0] ? data.content[0].text || '' : '';
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
