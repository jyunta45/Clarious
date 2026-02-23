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

function buildContext({
  enhancedSystem,
  conversation,
  rollingSummary
}) {

  const TURN_THRESHOLD = 6;
  const RECENT_LIMIT = 4;

  let messages = [];

  messages.push({
    role: "system",
    content: enhancedSystem
  });

  messages.push({
    role: "system",
    content: PRESENT_RULE
  });

  if (conversation.length <= TURN_THRESHOLD) {

    messages.push(...conversation);

    return messages;
  }

  if (
    rollingSummary &&
    rollingSummary !==
      "No significant session context to carry forward."
  ) {
    messages.push({
      role: "system",
      content: extractGuidance(rollingSummary)
    });
  }

  const recentMessages =
    conversation.slice(-RECENT_LIMIT);

  messages.push(...recentMessages);

  return messages;
}

function needsGroundingQuestion(userMessage) {
  const triggers = [
    "difference",
    "better",
    "why",
    "compare",
    "unique",
    "chatgpt",
    "gemini"
  ];

  const msg = userMessage.toLowerCase();
  return triggers.some(t => msg.includes(t));
}

function groundingQuestion() {
  const questions = [
    "What decision are you thinking through right now?",
    "What feels most unclear for you today?",
    "What are you trying to move forward on?",
    "Where do you feel stuck lately?",
    "What matters most for you right now?"
  ];

  return questions[
    Math.floor(Math.random() * questions.length)
  ];
}

export { buildContext, needsGroundingQuestion, groundingQuestion };
