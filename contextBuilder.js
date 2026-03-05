// ======================================
// CONTEXT COMPRESSION ENGINE
// ======================================

import { buildUserState } from './userStateEngine.js';
import { detectDecisionMode } from './adaptiveDepth.js';

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
// REFLECTION CONTEXT
// ======================================

function buildReflectionContext(userMessage, userMemory, patterns) {
  if (!userMessage || typeof userMessage !== "string") return "";
  if (!userMemory) return "";

  const text = userMessage.toLowerCase().trim();

  if (text.length < 20) return "";

  const reflections = [];

  function includesMeaningfulWord(text, phrase) {
    if (!phrase) return false;
    const words = phrase.toLowerCase().split(" ");
    return words.some(word =>
      word.length > 4 && text.includes(word)
    );
  }

  const matchedStruggle = userMemory.recurringStruggles?.find(
    struggle => includesMeaningfulWord(text, struggle)
  );

  if (matchedStruggle) {
    reflections.push(
      `You've mentioned struggling with ${matchedStruggle} before. ` +
      `If relevant, connect this to the current moment naturally — ` +
      `not as a label, but as continuity.`
    );
  }

  const matchedGoal = userMemory.goals?.find(
    goal => includesMeaningfulWord(text, goal)
  );

  if (matchedGoal) {
    reflections.push(
      `This connects to something the user has been working toward: ` +
      `${matchedGoal}. Reference it naturally if it adds clarity.`
    );
  }

  const isDecisionMessage =
    text.includes("should i") ||
    text.includes("what do i do") ||
    text.includes("can't decide") ||
    text.includes("cannot decide") ||
    text.includes("torn between") ||
    text.includes("not sure what to do");

  if (isDecisionMessage && userMemory.decisionPatterns?.length > 0) {
    const pattern =
      userMemory.decisionPatterns[
        userMemory.decisionPatterns.length - 1
      ];
    reflections.push(
      `This user tends to ${pattern} when facing decisions. ` +
      `Be aware of this pattern without naming it directly ` +
      `unless it genuinely helps.`
    );
  }

  const hasRepeatedTopic = patterns?.topTopics?.some(
    topic => includesMeaningfulWord(text, topic)
  );

  if (hasRepeatedTopic) {
    reflections.push(
      `This is a topic the user returns to often. ` +
      `You can acknowledge the pattern gently ` +
      `if it serves the conversation.`
    );
  }

  if (reflections.length === 0) return "";

  const trimmed = reflections.slice(0, 2);

  return (
    `\nREFLECTION CONTEXT:\n` +
    trimmed.join("\n")
  );
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

  const lastUserMsg = [...conversation].reverse().find(m => m.role === 'user');
  const userMessage = lastUserMsg ? lastUserMsg.content : '';
  const isDecision = detectDecisionMode(userMessage);

  const decisionContext = isDecision
    ? `\nMODE: decision_guidance\nThe user is facing a decision right now.\nApply this approach:\n- Briefly restate what they are actually deciding in one clear sentence\n- Surface 2-3 key factors that genuinely matter for this specific decision\n- Explore what each direction could mean for them\n- End with ONE thoughtful question that helps them reflect on what matters most to them\n- Do not decide for them\n- Do not overwhelm with options\n- Do not give a recommendation unless they explicitly ask for one\n- Help them think — not choose`
    : "";

  const stateBlock = buildStateContext(userState);
  const guidanceBlock = buildGuidanceContext(guidanceData);
  const reflectionBlock = buildReflectionContext(userMessage, userMemory || {}, patterns || null);
  const combinedBlocks = [stateBlock, guidanceBlock, decisionContext, reflectionBlock].filter(b => b).join("\n\n");
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
