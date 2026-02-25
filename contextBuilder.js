// ======================================
// CONTEXT COMPRESSION ENGINE
// ======================================

import { buildUserState } from './userStateEngine.js';

function extractGuidance(summary) {
  if (!summary) return "";
  return `
Use past session context only to guide tone,
priority, and relevance.

DO NOT repeat personal facts.
DO NOT list remembered situations.
DO NOT summarize the user back to themselves.
Respond only to the current message.
`;
}

const PRESENT_RULE = `
Speak as if meeting the user in this moment.
Never sound like recalling stored knowledge.
Focus on helping forward movement.
`;

// ======================================
// STATE CONTEXT INJECTION
// ======================================

function buildStateContext(state) {
  if (!state.direction && !state.currentFocus.length)
    return "";

  return `
User Direction: ${state.direction || "forming"}
Current Focus: ${state.currentFocus.join(", ") || "exploration"}
Recurring Friction: ${state.recurringFriction.join(", ") || "none"}
Emotional Trend: ${state.emotionalTrend}
Growth Phase: ${state.growthPhase}
`.trim();
}

// ======================================
// CONTEXT BUILDER
// ======================================

function buildContext({
  enhancedSystem,
  conversation,
  rollingSummary,
  userMemory,
  sessionSummary,
  moodTrend,
  patterns,
  relationshipDepth
}) {
  const TURN_THRESHOLD = 6;
  const RECENT_LIMIT = 4;

  let messages = [];

  const userState = buildUserState({
    memory: userMemory || {},
    sessionSummary: sessionSummary || rollingSummary,
    moodTrend: moodTrend || null,
    patterns: patterns || null,
    relationshipDepth: relationshipDepth || 1
  });

  const stateBlock = buildStateContext(userState);
  const finalSystem = stateBlock
    ? enhancedSystem + "\n\n" + stateBlock
    : enhancedSystem;

  messages.push({ role: "system", content: finalSystem });
  messages.push({ role: "system", content: PRESENT_RULE });

  if (conversation.length <= TURN_THRESHOLD) {
    messages.push(...conversation);
    return messages;
  }

  if (
    rollingSummary &&
    rollingSummary !== "No significant session context to carry forward."
  ) {
    messages.push({ role: "system", content: extractGuidance(rollingSummary) });
  }

  const recentMessages = conversation.slice(-RECENT_LIMIT);
  messages.push(...recentMessages);

  return messages;
}

export { buildContext };
