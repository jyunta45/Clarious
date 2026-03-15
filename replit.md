# Clarus

## Overview

This project is "Clarus", a Jarvis-style personal AI coach built on Anthropic's Claude API. Its core purpose is to provide AI-powered coaching through a personalized, persistent chat interface. Key features include a conversational onboarding experience (replacing the old form), user accounts with database persistence, and multi-language support (English, Japanese, Spanish, Thai, Korean). The application aims to be a supportive and intelligent partner for users navigating various aspects of their lives.

## User Preferences

- Preferred communication style: Simple, everyday language
- AI personality: Jarvis-style — supportive, intelligent, concise. Never lectures or judges.
- Cost-effective operation: Flexible response length matching question complexity
- Keep vanilla JS approach (no React migration), single HTML file for simplicity

## System Architecture

The application utilizes a simple Express.js server as its backend and a single-file vanilla HTML/CSS/JS frontend.

The **Express.js server** (`server.js`) handles:
- Serving static files.
- Providing API endpoints for chat (streaming via Server-Sent Events), user authentication (`signup`, `login`, `logout`, `me`), and data persistence (`data`).
- Session management using `express-session` with `connect-pg-simple` for PostgreSQL storage.
- Password hashing with `bcrypt`.
- Smart token management (300-800 tokens) and automatic chat history trimming to the last 16 messages for cost efficiency.
- AI model routing based on complexity: Claude Haiku for low complexity, Claude Sonnet for high complexity.
- Advanced AI memory systems including structured identity profiles, memory extraction, mood tracking, and behavioral triggers.

The **PostgreSQL database**, managed with Drizzle ORM, stores:
- User accounts (`users` table).
- Comprehensive user data (`user_data` table) including questionnaire answers, chat messages, progression stage, language, personalized "mirror" summary, messaging statistics, identity profile, memories, mood logs, thread summaries, activity patterns, and open loops.
- Session information (`session` table).

The **Frontend** (`public/index.html`) features:
- An authentication screen with login, signup, and guest modes.
- A sequential onboarding experience: 11 pre-written questions asked one by one (no AI question generation). Q1 is sent as a hardcoded initial message. For Q2-Q11 Claude writes a 1-sentence acknowledgment then asks the next question verbatim. Q11 includes tappable choice chips (ครอบครัว, การงาน, ค่านิยม, etc.). State tracks `questionIndex` (0-10). Max tokens 350. No history stored — repetition is structurally impossible. Users can skip at any time.
- A persistent chat interface with streaming AI responses, conversation threads, quick-action buttons, and a daily check-in banner.
- Voice input (Web Speech API) and voice output (TTS) for AI responses.
- A user tier system (Guest, Free, Subscriber) with corresponding message limits.
- A dark theme with purple/pink accents, using Playfair Display and DM Sans fonts.
- Multi-language support with a persistent language switcher.
- Dual data storage: `localStorage` for offline access and server sync for logged-in users.
- Two-tab conversation mode ("Daily" for personal life, "Deep Thinking" for life direction) with mode-aware backend processing and mode-shift detection.
- A 7-day guided onboarding system with adaptive guidance based on user engagement.
- Visible Personal Evolution / Growth panel for monthly summaries, pattern insights, and habit consistency.
- Pattern tracking system for topic frequency, recurring challenges, and activity heatmaps.
- Controlled proactivity triggers for context-aware check-ins.
- Grounding question system: appends focusing questions when user messages are vague/abstract (3-minute cooldown, Deep Thinking mode only, multi-language, skipped if AI already asked a question).

**Key Design Decisions**:
- **API Key Proxying**: The server proxies the Anthropic API to secure the API key.
- **Single-file Frontend**: Simplifies development and deployment.
- **Dual Storage**: Provides a seamless experience for both guest and logged-in users.
- **Session-based Authentication**: Robust user authentication with PostgreSQL for session storage.
- **Streaming**: Uses Server-Sent Events for a real-time, dynamic user experience.

## External Dependencies

- **Anthropic Claude API**: For AI coaching, utilizing `claude-haiku-4-5-20251001` and `claude-sonnet-4-20250514` models. Requires `ANTHROPIC_API_KEY`.
- **Google Fonts**: For `Playfair Display` and `DM Sans` typefaces.
- **PostgreSQL**: The primary database for all persistent data, configured via `DATABASE_URL`.
- **Express.js**: The core web framework for the backend.
- **bcrypt**: Used for secure password hashing.
- **express-session** and **connect-pg-simple**: For session management and storing session data in PostgreSQL.