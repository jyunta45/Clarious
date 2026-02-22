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

var __app_dirname;
try { __app_dirname = path.dirname(fileURLToPath(import.meta.url)); } catch(e) { __app_dirname = __dirname || process.cwd(); }

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__app_dirname, 'public')));

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

    const userMsg = req.body.messages && req.body.messages.length > 0
      ? req.body.messages[req.body.messages.length - 1].content || ''
      : '';

    const wordCount = userMsg.trim().split(/\s+/).length;
    const isDeepQuestion = /plan|strategy|how to|step.?by.?step|explain|detail|breakdown|analyze|help me with|guide/i.test(userMsg);

    let maxTokens = 300;
    if (wordCount > 30 || isDeepQuestion) maxTokens = 600;
    if (wordCount > 80) maxTokens = 800;
    if (req.body.max_tokens) maxTokens = Math.min(req.body.max_tokens, 1000);

    const messages = req.body.messages || [];
    const trimmedMessages = messages.length > 16 ? messages.slice(messages.length - 16) : messages;
    const wantStream = req.body.stream === true;

    const userId = req.session.userId ? String(req.session.userId) : 'guest_' + req.sessionID;
    const adaptiveLayer = buildAdaptivePrompt(userId, userMsg);
    updateIdentity(userId, userMsg);
    const identityLayer = buildIdentityPrompt(userId);
    const enhancedSystem = (req.body.system || '') + '\n\n' + adaptiveLayer + '\n\n' + identityLayer;

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
          model: 'claude-sonnet-4-20250514',
          max_tokens: maxTokens,
          stream: true,
          system: enhancedSystem,
          messages: trimmedMessages
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
                res.write('data: ' + JSON.stringify({ text: event.delta.text }) + '\n\n');
              }
            } catch(e) {}
          }
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
          model: 'claude-sonnet-4-20250514',
          max_tokens: maxTokens,
          system: enhancedSystem,
          messages: trimmedMessages
        })
      });
      const data = await response.json();
      res.json(data);
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, '0.0.0.0', () => console.log('Running on port ' + PORT));
