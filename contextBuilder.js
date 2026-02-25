// ======================================
// CONTEXT COMPRESSION ENGINE
// ======================================

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
// MEMORY CONTEXT INJECTION (NEW)
// ======================================

function buildMemoryContext(memory) {
  if (!memory) return "";
  if (!memory.identityDirection && (!memory.goals || memory.goals.length === 0)) return "";

  const goals = (memory.goals || []).slice(-3).join(", ");
  const struggles = (memory.recurringStruggles || []).slice(-2).join(", ");

  return `
User is working toward: ${memory.identityDirection || "direction still forming"}
Current focus: ${goals || "exploration"}
Recurring friction: ${struggles || "none consistently observed"}
`.trim();
}

// ======================================
// CONTEXT BUILDER
// ======================================

function buildContext({
  enhancedSystem,
  conversation,
  rollingSummary,
  userMemory
}) {
  const TURN_THRESHOLD = 6;
  const RECENT_LIMIT = 4;

  let messages = [];

  const memoryBlock = buildMemoryContext(userMemory);
  const finalSystem = memoryBlock
    ? enhancedSystem + "\n\n" + memoryBlock
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

export { buildContext, buildMemoryContext };
