// ─────────────────────────────────────────
// AI RUNTIME CONTROLLER
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// DAILY RESET (call first on every request)
// ─────────────────────────────────────────
function resetDailyUsage(user) {
  const today = new Date().toDateString();
  if (user.lastUsageDate !== today) {
    user.dailyTokens = 0;
    user.softWarnedToday = false;
    user.efficiencyMode = false;
    user.lastUsageDate = today;
  }
}

// ─────────────────────────────────────────
// INPUT TRUNCATION
// ─────────────────────────────────────────
function truncateInput(input) {
  const MAX_CHARS = 3200;
  if (input.length > MAX_CHARS) {
    return { text: input.slice(0, MAX_CHARS), truncated: true };
  }
  return { text: input, truncated: false };
}

// ─────────────────────────────────────────
// DECISION LANGUAGE DETECTION
// ─────────────────────────────────────────
function hasDecisionLanguage(text) {
  return (
    text.includes("should i") ||
    text.includes("what should") ||
    text.includes("decide") ||
    text.includes("choose") ||
    text.includes("not sure") ||
    text.includes("i wonder")
  );
}

// ─────────────────────────────────────────
// DEPTH SCORING
// ─────────────────────────────────────────
const depthKeywords = [
  "anxious","depressed","stuck","confused",
  "purpose","meaning","afraid","failure",
  "lost","change","worth it","don't know"
];

function getDepthScore(message) {
  let score = 0;
  const m = message.toLowerCase();
  if (message.split(" ").length > 150) score++;
  if (depthKeywords.some(k => m.includes(k))) score++;
  if (hasDecisionLanguage(m)) score++;
  return Math.min(score, 3);
}

// ─────────────────────────────────────────
// MODEL SELECTION
// ─────────────────────────────────────────
function selectModel(depth) {
  if (depth === 0) return "haiku";
  if (depth <= 2) return "sonnet";
  return "opus";
}

// ─────────────────────────────────────────
// BUDGET + MODEL SELECTION
// ─────────────────────────────────────────
const DAILY_LIMIT = 135000;

function checkBudget(user, currentDepth) {
  if (user.efficiencyMode) {
    return {
      model: "haiku",
      efficiencyMode: true,
      systemNotice: "Running in efficiency mode for today."
    };
  }
  if (
    user.dailyTokens > DAILY_LIMIT * 0.80 &&
    !user.softWarnedToday
  ) {
    user.softWarnedToday = true;
    return {
      model: selectModel(currentDepth),
      systemNotice:
        "You're having a deep day. I'll keep responses focused."
    };
  }
  if (user.dailyTokens > DAILY_LIMIT) {
    user.efficiencyMode = true;
    return {
      model: "haiku",
      efficiencyMode: true,
      systemNotice: "Running in efficiency mode for today."
    };
  }
  return { model: selectModel(currentDepth) };
}

// ─────────────────────────────────────────
// OUTPUT TOKEN LIMIT
// ─────────────────────────────────────────
function maxTokens(depth, efficiencyMode = false) {
  if (efficiencyMode) return 180;
  if (depth === 0) return 200;
  if (depth <= 2) return 400;
  return 600;
}

// ─────────────────────────────────────────
// SESSION TIMEOUT
// ─────────────────────────────────────────
const SESSION_TIMEOUT = 10 * 60 * 1000;

function checkSessionTimeout(session) {
  if (Date.now() - session.lastActive > SESSION_TIMEOUT) {
    session.messages = [];
  }
}

// ─────────────────────────────────────────
// SUMMARY UPDATE TRIGGER
// ─────────────────────────────────────────
function shouldUpdateSummary(turnCount, meaningfulTurn) {
  return turnCount % 4 === 0 || meaningfulTurn === true;
}

// ─────────────────────────────────────────
// MEANINGFUL TURN DETECTION
// ─────────────────────────────────────────
function isMeaningfulAssistantResponse(response) {
  const r = response.toLowerCase();
  return (
    r.includes("because")   ||
    r.includes("however")   ||
    r.includes("depends")   ||
    r.includes("instead")   ||
    r.includes("consider")  ||
    r.includes("option")    ||
    r.includes("step")      ||
    r.includes("trade-off") ||
    response.split(".").length > 6
  );
}

export {
  resetDailyUsage,
  truncateInput,
  getDepthScore,
  checkBudget,
  selectModel,
  maxTokens,
  checkSessionTimeout,
  shouldUpdateSummary,
  isMeaningfulAssistantResponse
};
