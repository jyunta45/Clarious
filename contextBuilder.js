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
// GUIDANCE CONTEXT
// ======================================

function buildGuidanceContext(guidanceData) {
  if (!guidanceData) return "";
  if (!guidanceData.guidanceMode) return "";

  const day = guidanceData.guidanceDay || 1;
  if (day > 7) return "";
  let toneInstruction = "";

  if (day <= 3) {
    toneInstruction =
      `User is in early guidance phase (Day ${day} of 7).
Be more supportive and gentle.
Normalize the process of self-reflection.
They are still learning how to use this space.
Avoid deep challenges — focus on making them feel safe.`;
  } else if (day <= 6) {
    toneInstruction =
      `User is in mid guidance phase (Day ${day} of 7).
Shift toward reflective questioning.
Help them notice patterns in what they share.
They are becoming comfortable — gently go deeper.
Begin connecting their statements to their stated goals.`;
  } else {
    toneInstruction =
      `User is completing guidance phase (Day ${day} of 7).
Treat them as a capable self-reflector.
Move toward peer-level collaboration.
They have shown consistency — match their maturity.
Challenge them more directly when appropriate.`;
  }

  return `\nGUIDANCE CONTEXT:\n${toneInstruction}`;
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
  relationshipDepth,
  guidanceData
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
  const guidanceBlock = buildGuidanceContext(guidanceData);
  const combinedBlocks = [stateBlock, guidanceBlock].filter(b => b).join("\n\n");
  const finalSystem = combinedBlocks
    ? enhancedSystem + "\n\n" + combinedBlocks
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
