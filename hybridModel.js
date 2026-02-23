// ======================================
// HYBRID MODEL INTELLIGENCE CONTROLLER
// Sonnet (default) + Opus (deep moments)
// With Opus Cooldown Protection
// ======================================

const hybridDB = new Map();

function initHybridUser(userId) {
  if (!hybridDB.has(userId)) {
    hybridDB.set(userId, {
      opusActive: false,
      opusTurnsRemaining: 0,
      lastTopic: ""
    });
  }

  return hybridDB.get(userId);
}


// ======================================
// COMPLEXITY DETECTION
// ======================================
function detectComplexity(message) {

  let score = 0;
  const text = message.toLowerCase();

  if (/purpose|meaning|who am i|future|life direction/.test(text))
    score++;

  if (/torn|confused|lost|fear|anxious|stuck/.test(text))
    score++;

  if (/on one hand|part of me|but also|however/.test(text))
    score++;

  if (message.length > 250)
    score++;

  return score;
}


// ======================================
// MODEL SELECTION WITH COOLDOWN
// ======================================
function chooseModel(userId, message) {

  const user = initHybridUser(userId);

  const complexityScore = detectComplexity(message);

  if (complexityScore >= 3 && !user.opusActive) {

    user.opusActive = true;
    user.opusTurnsRemaining = 2;

    console.log("Opus activated");

    return "opus";
  }

  if (user.opusActive) {

    if (user.opusTurnsRemaining > 0) {
      user.opusTurnsRemaining--;
      return "opus";
    }

    user.opusActive = false;
    console.log("Returning to Sonnet");
  }

  return "sonnet";
}

// ======================================
// HIGH ATTENTION SIGNAL
// ======================================
function buildAttentionLayer(modelChoice) {

  if (modelChoice === "opus") {
    return `
High Attention Mode Active:

- Treat this moment as psychologically important.
- Slow reasoning slightly before responding.
- Prioritize depth and clarity over speed.
- Offer fewer insights, but make them precise.
- Speak with careful consideration.
`;
  }

  return `
Standard Attention Mode:
Maintain calm, efficient conversational flow.
`;
}

export { chooseModel, buildAttentionLayer };
