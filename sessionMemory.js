// ======================================
// SESSION MEMORY ENGINE (PRODUCTION SAFE)
// ======================================

const sessionStore = new Map();

// -----------------------------
// SIGNAL DETECTION
// -----------------------------
function containsEmotionalSignal(text) {

  const signals = [
    "feel",
    "stuck",
    "confused",
    "lost",
    "worried",
    "anxious",
    "decision",
    "should i",
    "don't know",
    "struggling"
  ];

  const t = text.toLowerCase();
  return signals.some(s => t.includes(s));
}


// -----------------------------
// ASSISTANT REASONING SIGNAL
// -----------------------------
function assistantMeaningful(response) {

  const r = response.toLowerCase();

  return (
    r.includes("because") ||
    r.includes("however") ||
    r.includes("depends") ||
    r.includes("instead") ||
    r.includes("consider") ||
    r.includes("option") ||
    response.length > 250
  );
}


// -----------------------------
// MEANINGFUL TURN CHECK
// -----------------------------
function isMeaningful(userMsg, assistantMsg) {

  if (!userMsg || !assistantMsg) return false;

  return (
    userMsg.length >= 80 ||
    containsEmotionalSignal(userMsg) ||
    assistantMeaningful(assistantMsg)
  );
}


// -----------------------------
// INIT SESSION
// -----------------------------
function initSession(userId) {

  if (!sessionStore.has(userId)) {
    sessionStore.set(userId, {
      turns: [],
      meaningfulTurns: 0,
      rollingSummary: "",
      lastSessionSummary: ""
    });
  }

  return sessionStore.get(userId);
}


// -----------------------------
// STORE TURN
// -----------------------------
function storeTurn(userId, userMsg, assistantMsg) {

  const session = initSession(userId);

  session.turns.push({
    user: userMsg,
    assistant: assistantMsg
  });

  if (isMeaningful(userMsg, assistantMsg)) {
    session.meaningfulTurns++;
  }

  if (session.turns.length > 12) {
    session.turns.shift();
  }
}


// -----------------------------
// ROLLING SUMMARY
// (FAST MODEL SHOULD CALL THIS)
// -----------------------------
function buildRollingSummary(turns) {

  if (!turns.length) return "";

  const recent = turns.slice(-10)
    .map(t => `User: ${t.user}\nAssistant: ${t.assistant}`)
    .join("\n");

  return `
Summarize the conversation below in 3–5 sentences.

Capture:
- user's current focus
- emotional tone
- unresolved question
- assistant role

Be factual.
No prediction.
No interpretation.
No motivational language.

${recent}
`;
}


// -----------------------------
// FINAL SESSION MEMORY
// -----------------------------
function finalizeSession(userId) {

  const session = initSession(userId);

  if (session.meaningfulTurns < 3) {
    session.lastSessionSummary =
      "No significant session context to carry forward.";
    return;
  }

  session.lastSessionSummary =
    session.rollingSummary || "";
}


// -----------------------------
// INJECTION AT SESSION START
// -----------------------------
function getSessionInjection(userId) {

  const session = initSession(userId);

  if (
    !session.lastSessionSummary ||
    session.lastSessionSummary ===
      "No significant session context to carry forward."
  ) {
    return "";
  }

  return `
Previous session context:
${session.lastSessionSummary}
`;
}


export {
  sessionStore,
  storeTurn,
  buildRollingSummary,
  finalizeSession,
  getSessionInjection
};
