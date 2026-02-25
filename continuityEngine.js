// ======================================
// CONTINUITY LOOP ENGINE + MEMORY SYSTEM
// ======================================

const continuityDB = new Map();
const memoryDB = new Map();

// ======================================
// CONTINUITY LOOPS (EXISTING)
// ======================================

function initUser(userId) {
  if (!continuityDB.has(userId)) {
    continuityDB.set(userId, {
      openLoops: []
    });
  }
  return continuityDB.get(userId);
}

function detectOpenLoop(message) {
  const triggers = [
    "I want to", "I'm trying to", "I struggle",
    "I feel stuck", "my goal", "I hope",
    "I want to become", "I'm afraid", "I need to change"
  ];
  return triggers.some(t =>
    message.toLowerCase().includes(t.toLowerCase())
  );
}

function storeLoop(userId, message) {
  if (!detectOpenLoop(message)) return;
  const user = initUser(userId);
  user.openLoops.push({ text: message, timestamp: Date.now() });
  if (user.openLoops.length > 10) user.openLoops.shift();
}

function recallLoop(userId) {
  const user = initUser(userId);
  if (!user.openLoops.length) return null;
  if (Math.random() > 0.25) return null;
  const randomLoop = user.openLoops[Math.floor(Math.random() * user.openLoops.length)];
  return randomLoop.text;
}

function buildContinuityLayer(userId, message) {
  storeLoop(userId, message);
  const recalled = recallLoop(userId);
  if (!recalled) return "";
  return `
Continuity Awareness:

The user previously expressed:
"${recalled}"

If naturally relevant, gently reconnect this past intention
without forcing discussion or sounding like a reminder.
`;
}

// ======================================
// STRUCTURED MEMORY SYSTEM (NEW)
// ======================================

function initMemory(userId) {
  if (!memoryDB.has(userId)) {
    memoryDB.set(userId, {
      goals: [],
      recurringStruggles: [],
      strengths: [],
      decisionPatterns: [],
      identityDirection: "",
      lastUpdated: null
    });
  }
  return memoryDB.get(userId);
}

function loadMemoryFromDB(userId, storedMemory) {
  if (!storedMemory) return;
  const mem = initMemory(userId);
  if (storedMemory.goals && Array.isArray(storedMemory.goals)) {
    for (const g of storedMemory.goals) addUnique(mem.goals, g);
  }
  if (storedMemory.recurringStruggles && Array.isArray(storedMemory.recurringStruggles)) {
    for (const s of storedMemory.recurringStruggles) addUnique(mem.recurringStruggles, s);
  }
  if (storedMemory.strengths && Array.isArray(storedMemory.strengths)) {
    for (const s of storedMemory.strengths) addUnique(mem.strengths, s);
  }
  if (storedMemory.decisionPatterns && Array.isArray(storedMemory.decisionPatterns)) {
    for (const d of storedMemory.decisionPatterns) addUnique(mem.decisionPatterns, d);
  }
  if (storedMemory.identityDirection) {
    mem.identityDirection = storedMemory.identityDirection;
  }
  if (storedMemory.lastUpdated) {
    mem.lastUpdated = storedMemory.lastUpdated;
  }
}

function addUnique(arr, value) {
  if (!value || typeof value !== 'string') return;
  if (!arr.some(v => v.toLowerCase() === value.toLowerCase())) {
    arr.push(value);
  }
}

function shouldUpdateMemory(userId, complexity, session) {
  if (complexity !== "HIGH") return false;
  if (session && session.memoryUpdatedThisSession) return false;
  const mem = initMemory(userId);
  if (mem.lastUpdated) {
    const sixHours = 6 * 60 * 60 * 1000;
    if (Date.now() - mem.lastUpdated < sixHours) return false;
  }
  return true;
}

function buildMemoryExtractionPrompt(userMessage) {
  return `Extract only explicitly stated facts from the user message below.
Return JSON only. Use null for anything not clearly expressed.
Do NOT infer or assume.

{
  "goal": null,
  "recurringStruggle": null,
  "strength": null,
  "decisionPattern": null,
  "identityDirection": null
}

User message:
"${userMessage}"`;
}

function mergeExtractedMemory(userId, extracted, session) {
  const mem = initMemory(userId);
  if (extracted.goal) addUnique(mem.goals, extracted.goal);
  if (extracted.recurringStruggle) addUnique(mem.recurringStruggles, extracted.recurringStruggle);
  if (extracted.strength) addUnique(mem.strengths, extracted.strength);
  if (extracted.decisionPattern) addUnique(mem.decisionPatterns, extracted.decisionPattern);
  if (extracted.identityDirection) mem.identityDirection = extracted.identityDirection;

  if (mem.goals.length > 10) mem.goals = mem.goals.slice(-10);
  if (mem.recurringStruggles.length > 8) mem.recurringStruggles = mem.recurringStruggles.slice(-8);
  if (mem.strengths.length > 8) mem.strengths = mem.strengths.slice(-8);
  if (mem.decisionPatterns.length > 8) mem.decisionPatterns = mem.decisionPatterns.slice(-8);

  mem.lastUpdated = Date.now();
  if (session) session.memoryUpdatedThisSession = true;
}

function getMemoryForSave(userId) {
  return initMemory(userId);
}

export {
  buildContinuityLayer,
  initMemory,
  loadMemoryFromDB,
  shouldUpdateMemory,
  buildMemoryExtractionPrompt,
  mergeExtractedMemory,
  getMemoryForSave
};
