# Life Assistant

## Overview

This is a "Life Assistant" web application — a Jarvis-style personal AI chatbot that uses Claude (Anthropic's API) to provide AI-powered coaching. The app features:
- A 37-question onboarding questionnaire across 8 sections
- A personalized "mirror" profile summary
- A persistent chat interface with streaming AI responses
- User accounts with database persistence
- Multi-language support (English, Japanese, Spanish, Thai, Korean)

The architecture is a simple Express server with a single-file vanilla HTML/CSS/JS frontend.

## User Preferences

- Preferred communication style: Simple, everyday language
- AI personality: Jarvis-style — supportive, intelligent, concise. Never lectures or judges.
- Cost-effective operation: Flexible response length matching question complexity
- Keep vanilla JS approach (no React migration), single HTML file for simplicity

## System Architecture

### Active Architecture

- **Server**: Express.js server (`server.js`) running on port 5000 that:
  - Serves static files from `public/`
  - Provides `/api/chat` POST endpoint with streaming (SSE) support
  - Authentication endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
  - Data persistence endpoints: `/api/data` (GET/POST)
  - Uses express-session with connect-pg-simple for session storage
  - Uses bcrypt for password hashing
  - Smart token management (300-800 tokens based on question complexity)
  - Auto-trims chat history to last 16 messages

- **Database**: PostgreSQL with Drizzle ORM
  - `users` table: id, email, password_hash, created_at
  - `user_data` table: id, user_id (unique FK), answers (JSONB), messages (JSONB), stage, step, lang, mirror, tier, msg_count, msg_count_date, identity_profile (JSONB), memories (JSONB), mood_log (JSONB), thread_summaries (JSONB), last_active_date, patterns (JSONB), updated_at
  - Session storage: `session` table (auto-created by connect-pg-simple)
  - Schema in `shared/schema.ts`, connection in `db/index.ts`
  - Push schema with: `npx drizzle-kit push --dialect postgresql --schema ./shared/schema.ts --url "$DATABASE_URL"`

- **Frontend**: Single-file vanilla HTML/CSS/JS (`public/index.html`) with:
  - Auth screen (login/signup/guest mode) shown before app
  - Multi-step onboarding questionnaire (37 questions, 8 sections)
  - Progress tracking through the questionnaire
  - "Mirror" summary page
  - Streaming chat interface (SSE-based, text appears word-by-word)
  - Conversation threads with auto-naming, quick-action buttons, daily check-in banner
  - Voice input (Web Speech API microphone) and voice output (TTS on AI responses)
  - User tier system: Guest (10 msgs), Free (50/day), Subscriber (200/day)
  - Dark theme with purple/pink gradient accents, Playfair Display and DM Sans fonts
  - Language switcher persistent across all screens
  - Data saves to both localStorage (offline) and server (when logged in) with debounced sync

- **AI Integration**: Anthropic Claude API (`claude-sonnet-4-20250514`) via Express proxy. Streaming via SSE. API key stored as `ANTHROPIC_API_KEY` environment variable.

- **Entry Point**: `server/index.ts` imports `server.js`. Running `npm run dev` starts the Express server.

### Key Design Decisions

1. **API Key Proxying**: Express server proxies Anthropic API so key stays server-side
2. **Single-file Frontend**: Entire UI in one HTML file — fast to iterate, fully portable
3. **Dual Storage**: localStorage for offline/guest, PostgreSQL for logged-in users
4. **Session-based Auth**: express-session with PostgreSQL store, bcrypt passwords
5. **Streaming**: Server-Sent Events for real-time AI response rendering

## Recent Changes

- **2026-02-21**: Visible Personal Evolution / Growth panel: monthly evolution summary (days active, messages, topics, habit rates, mood trend), pattern insights (human-readable sentences from raw data), habit consistency trends (4-week completion rate bars), mood journey visualization (dot-line trend), milestone detection and celebration badges (streak milestones, days active, memory count, all-habits-done). Gold "Growth" button in chat header. Mutually exclusive with Patterns panel. Zero API cost. All 5 languages.
- **2026-02-21**: Habit integration: add/track daily habits with streak counting, best-streak tracking, goal linking, completion progress. Habits section in Patterns panel with checkboxes, add-habit form, remove. habitsPromptBlock() injects habit status into AI system prompt. Proactive trigger when habits are unchecked. All stored in existing patterns JSONB (no new columns). Zero API cost. All 5 languages.
- **2026-02-21**: Controlled proactivity triggers: context-aware check-in banner shows different messages based on conditions: inactivity (2+ days away: "still moving toward your goal?"), goal drift (3+ repeated challenges: "want to redesign your approach?"), unchecked habits ("you have habits to check off"), daily alignment (default: "what's one action today that moves you forward?"). All 5 languages. Both visible UI banners and AI prompt injection. Zero API cost.
- **2026-02-21**: Pattern tracking system: topic frequency detection (8 categories: work, health, relationships, money, goals, learning, creativity, habits), recurring challenge identification, activity heatmap (hourly usage patterns), goal progress tracking, weekly topic trends. Visual Patterns dashboard panel accessible from chat header. Pattern insights injected into AI system prompt. Stored in new JSONB `patterns` column.
- **2026-02-21**: Advanced AI memory systems: structured identity profiles (8 categories), memory extraction (6 fact types via regex), memory retrieval (keyword matching, top 3 results), mood tracking (sentiment scoring, 30-day rolling log), behavioral triggers (absence detection, mood trends, goal follow-ups), thread summarization (stored per-thread during context compression). All persisted in 5 new JSONB columns.
- **2026-02-21**: Added voice input (Web Speech API microphone) and voice output (TTS auto-read on AI responses)
- **2026-02-21**: Added user tier system: Guest (10 msgs/session), Free (50 msgs/day), Subscriber (200 msgs/day) with server-side tracking
- **2026-02-21**: Added conversation threads, quick-action buttons, context compression, daily check-in, mobile UX
- **2026-02-21**: Added database + user accounts (PostgreSQL, Drizzle ORM, express-session, bcrypt auth, data persistence API, auth UI with guest mode)
- **2026-02-21**: Implemented streaming responses via SSE
- **2026-02-21**: Added multi-language support (EN, JA, ES, TH, KO)
- **2026-02-21**: Redesigned AI personality to Jarvis-style (supportive, no lecturing)
- **2026-02-21**: Smart token management for cost optimization

## External Dependencies

- **Anthropic Claude API**: Core AI. Requires `ANTHROPIC_API_KEY`. Model: `claude-sonnet-4-20250514`.
- **Google Fonts**: Playfair Display and DM Sans
- **PostgreSQL**: User data persistence. Uses `DATABASE_URL` environment variable.
- **Express.js**: Web server, port 5000, bound to `0.0.0.0`
- **bcrypt**: Password hashing
- **express-session + connect-pg-simple**: Session management with PostgreSQL store

## Feature Roadmap

- [x] Streaming responses (SSE)
- [x] Database + user accounts
- [x] Quick-action buttons in chat
- [x] Conversation threads/topics
- [x] Context compression (summarize old messages)
- [x] Better mobile UX
- [x] Daily check-in
- [x] Voice input (Web Speech API)
- [x] Voice output (TTS auto-read)
- [x] User tier system (guest/free/subscriber)
- [ ] Payment integration (Stripe)
- [ ] Premium cloud voices (OpenAI TTS)
- [ ] Admin panel for tier management
