// ─────────────────────────────────────────
// AI RUNTIME CONTROLLER
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

function truncateInput(input) {
  const MAX_CHARS = 3200;
  if (input.length > MAX_CHARS) {
    return { text: input.slice(0, MAX_CHARS), truncated: true };
  }
  return { text: input, truncated: false };
}

// ─────────────────────────────────────────
// OUTPUT TOKEN LIMIT
// ─────────────────────────────────────────
function maxTokens(complexity, efficiencyMode = false) {
  if (efficiencyMode) return 180;
  if (complexity === "LOW") return 300;
  if (complexity === "HIGH") return 600;
  return 300;
}

// ─────────────────────────────────────────
// BUDGET + MODEL OVERRIDE
// ─────────────────────────────────────────
const DAILY_LIMIT = 135000;

function checkBudget(user, complexity, selectModel) {
  if (user.efficiencyMode) {
    return {
      model: "claude-haiku-4-5-20251001",
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
      model: selectModel(complexity),
      systemNotice: "You're having a deep day. I'll keep responses focused."
    };
  }
  if (user.dailyTokens > DAILY_LIMIT) {
    user.efficiencyMode = true;
    return {
      model: "claude-haiku-4-5-20251001",
      efficiencyMode: true,
      systemNotice: "Running in efficiency mode for today."
    };
  }
  return { model: selectModel(complexity) };
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

function shouldUpdateSummary(turnCount, meaningfulTurn) {
  return turnCount % 4 === 0 || meaningfulTurn === true;
}

function isMeaningfulAssistantResponse(response) {
  const r = response.toLowerCase();
  return (
    r.includes("because") ||
    r.includes("however") ||
    r.includes("depends") ||
    r.includes("instead") ||
    r.includes("consider") ||
    r.includes("option") ||
    r.includes("step") ||
    r.includes("trade-off") ||
    response.split(".").length > 6
  );
}

export {
  resetDailyUsage,
  truncateInput,
  maxTokens,
  checkBudget,
  checkSessionTimeout,
  shouldUpdateSummary,
  isMeaningfulAssistantResponse
};
