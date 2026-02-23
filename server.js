import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import bcrypt from 'bcrypt';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { db } from './db/index.js';
import { users, userData } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { buildAdaptivePrompt } from './adaptiveDepth.js';
import { updateIdentity, buildIdentityPrompt } from './identityLayer.js';
import { buildCalmAuthorityPrompt } from './calmAuthority.js';
import { buildCapabilityLayer } from './capabilityLayer.js';
import { buildAttentionLayer } from './hybridModel.js';
import { resetDailyUsage, truncateInput, getDepthScore, checkBudget, maxTokens as getMaxTokens, checkSessionTimeout, shouldUpdateSummary, isMeaningfulAssistantResponse } from './utils/aiController.js';
import { buildContinuityLayer } from './continuityEngine.js';
import { sessionStore, storeTurn, buildRollingSummary, finalizeSession, getSessionInjection } from './sessionMemory.js';
import { buildContext, needsGroundingQuestion, groundingQuestion } from './contextBuilder.js';

var __app_dirname;
try { __app_dirname = path.dirname(fileURLToPath(import.meta.url)); } catch(e) { __app_dirname = __dirname || process.cwd(); }

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__app_dirname, 'public')));

const runtimeUsers = new Map();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PgSession = connectPgSimple(session);

const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'life-assistant-dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
}));

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
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

function addIntentAnchor(response, userMessage) {
  const sentenceCount = response.split(".").length;
  if (sentenceCount > 3) {
    return response +
      "\n\nJust to make this useful — what part of this matters most for you right now?";
  }
  return response;
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

    const depth = getDepthScore(userMsg);

    const budgetState = checkBudget(runtimeUser, depth);
    const modelChoice = budgetState.model;
    const efficiencyMode = budgetState.efficiencyMode || false;

    const modelName = modelChoice === 'haiku'
      ? 'claude-haiku-4-5-20251001'
      : modelChoice === 'sonnet'
      ? 'claude-sonnet-4-20250514'
      : 'claude-opus-4-20250514';

    const tokenLimit = getMaxTokens(depth, efficiencyMode);

    const conversation = req.body.messages || [];
    const wantStream = req.body.stream === true;

    const now = new Date();
    const timeContext = `\nCurrent date: ${now.toDateString()}\nThe assistant exists in the present moment with the user.\nIf asked about time, assume awareness of the current year.\n`;
    updateIdentity(userId, userMsg);
    const identityLayer = buildIdentityPrompt(userId);
    const calmLayer = buildCalmAuthorityPrompt(userMsg);
    const adaptiveLayer = buildAdaptivePrompt(userId, userMsg);
    const capabilityLayer = buildCapabilityLayer(userMsg);
    const attentionLayer = buildAttentionLayer(modelChoice);
    const continuityLayer = buildContinuityLayer(userId, userMsg);
    const sessionLayer = getSessionInjection(userId);
    let truncationNotice = '';
    if (truncated) {
      truncationNotice = '\nNote: The user sent a long message. Focus on the core of what they shared.\n';
    }
    let budgetNotice = '';
    if (budgetState.systemNotice) {
      budgetNotice = '\n' + budgetState.systemNotice + '\n';
    }
    const enhancedSystem = sessionLayer + '\n\n' + timeContext + '\n\n' + identityLayer + '\n\n' + calmLayer + '\n\n' + adaptiveLayer + '\n\n' + capabilityLayer + '\n\n' + attentionLayer + '\n\n' + continuityLayer + '\n\n' + truncationNotice + budgetNotice + (req.body.system || '');

    const sessionSummary = sessionStore.has(userId) ? sessionStore.get(userId).rollingSummary : '';
    const builtMessages = buildContext({
      enhancedSystem,
      conversation,
      rollingSummary: sessionSummary
    });
    const systemContent = builtMessages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const chatMessages = builtMessages.filter(m => m.role !== 'system');

    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

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
          stream: true,
          system: systemContent,
          messages: chatMessages
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        res.write('data: ' + JSON.stringify({ type: 'error', error: errData }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';

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

      const anchoredReply = addIntentAnchor(fullReply, userMsg);
      if (anchoredReply !== fullReply) {
        const anchorText = anchoredReply.slice(fullReply.length);
        res.write('data: ' + JSON.stringify({ text: anchorText }) + '\n\n');
        fullReply = anchoredReply;
      }

      if (needsGroundingQuestion(userMsg)) {
        if (!req.session.lastGrounding || Date.now() - req.session.lastGrounding >= 180000) {
          const gq = groundingQuestion();
          fullReply += '\n\n' + gq;
          res.write('data: ' + JSON.stringify({ text: '\n\n' + gq }) + '\n\n');
          req.session.lastGrounding = Date.now();
        }
      }

      storeTurn(userId, userMsg, fullReply);

      const estimatedInput = systemContent.length / 4 + chatMessages.reduce((s, m) => s + (m.content || '').length / 4, 0);
      const estimatedOutput = fullReply.length / 4;
      runtimeUser.dailyTokens += Math.ceil(estimatedInput + estimatedOutput);
      req.session.lastActive = Date.now();

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
          } catch(e) {}
        }
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
      assistantReply = addIntentAnchor(assistantReply, userMsg);

      if (needsGroundingQuestion(userMsg)) {
        if (!req.session.lastGrounding || Date.now() - req.session.lastGrounding >= 180000) {
          const gq = groundingQuestion();
          assistantReply += '\n\n' + gq;
          if (data.content && data.content[0]) {
            data.content[0].text = assistantReply;
          }
          req.session.lastGrounding = Date.now();
        }
      }

      storeTurn(userId, userMsg, assistantReply);

      if (data.usage) {
        runtimeUser.dailyTokens += (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0);
      }
      req.session.lastActive = Date.now();

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
          } catch(e) {}
        }
      }

      res.json(data);
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__app_dirname, 'public', 'index.html'));
});

const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, '0.0.0.0', () => console.log('Running on port ' + PORT));
