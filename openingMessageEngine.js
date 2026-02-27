// ======================================
// OPENING MESSAGE ENGINE
// ======================================

const fallbackOpenings = [
  {
    text: `What's been taking most of your attention lately?`,
    type: "fallback",
    chips: [
      "Something at work",
      "A personal situation",
      "A decision I'm sitting on",
      "Just thinking out loud"
    ]
  },
  {
    text: `What's on your mind today?`,
    type: "fallback",
    chips: [
      "Something specific",
      "General check-in",
      "I want to think something through",
      "Not sure yet"
    ]
  },
  {
    text: `What would make today feel worthwhile?`,
    type: "fallback",
    chips: [
      "One clear win",
      "Getting unstuck on something",
      "Some clarity",
      "Just showing up"
    ]
  },
  {
    text: `Where are you starting from today?`,
    type: "fallback",
    chips: [
      "Good place",
      "Bit off track",
      "Uncertain",
      "Ready to move"
    ]
  }
];

function buildFallbackOpening(lastMessage) {
  const available = fallbackOpenings.filter(
    f => f.text !== lastMessage
  );
  const index =
    Math.floor(Date.now() / 86400000) % available.length;
  return available[index];
}

function _buildOpeningMessage(params) {
  const { userName, lang, memories, patterns } = params || {};

  const hasGoals = memories && memories.goals && memories.goals.length > 0;
  const hasStruggles = memories && memories.recurringStruggles && memories.recurringStruggles.length > 0;
  const topGoal = hasGoals ? memories.goals[0] : null;
  const topStruggle = hasStruggles ? memories.recurringStruggles[0] : null;

  const frequentTopics = patterns && patterns.topics ? Object.entries(patterns.topics).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]) : [];

  if (topGoal && topStruggle) {
    return {
      text: `You've been working toward "${topGoal}" while navigating "${topStruggle}". Where are things standing today?`,
      type: "personalized",
      chips: [
        "Making progress",
        "Feeling stuck",
        "Something changed",
        "Different topic"
      ]
    };
  }

  if (topGoal) {
    return {
      text: `Last time we talked about "${topGoal}". How's that moving?`,
      type: "personalized",
      chips: [
        "Good progress",
        "Hit a wall",
        "Changed direction",
        "Something else today"
      ]
    };
  }

  if (frequentTopics.length > 0) {
    return {
      text: `You've been thinking about ${frequentTopics.join(' and ')} lately. Want to continue there or go somewhere new?`,
      type: "personalized",
      chips: [
        "Continue where we left off",
        "Something new",
        "Just checking in",
        "Need help deciding"
      ]
    };
  }

  return buildFallbackOpening(null);
}

export function buildOpeningMessage(params) {
  try {
    const opening = _buildOpeningMessage(params);

    if (opening.text === params.userData?.lastOpeningMessage) {
      return buildFallbackOpening(
        params.userData?.lastOpeningMessage
      );
    }

    return opening;
  } catch (error) {
    return buildFallbackOpening(
      params?.userData?.lastOpeningMessage
    );
  }
}

export { buildFallbackOpening };
