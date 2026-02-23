// ======================================
// CONTEXT COMPRESSION ENGINE
// ======================================

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
      content:
        "Conversation summary:\n" + rollingSummary
    });
  }

  const recentMessages =
    conversation.slice(-RECENT_LIMIT);

  messages.push(...recentMessages);

  return messages;
}

export { buildContext };
