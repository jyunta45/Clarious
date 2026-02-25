// ===============================
// ADAPTIVE DEPTH ENGINE
// ===============================

const relationshipDB = new Map();

function initUser(userId) {
  if (!relationshipDB.has(userId)) {
    relationshipDB.set(userId, {
      conversationCount: 0,
      depthLevel: 1,
      memories: [],
      preferences: {}
    });
  }
  return relationshipDB.get(userId);
}

function updateDepth(userId) {
  const user = initUser(userId);
  user.conversationCount++;
  if (user.conversationCount > 50) user.depthLevel = 5;
  else if (user.conversationCount > 30) user.depthLevel = 4;
  else if (user.conversationCount > 15) user.depthLevel = 3;
  else if (user.conversationCount > 5) user.depthLevel = 2;
  else user.depthLevel = 1;
  return user.depthLevel;
}

function storeMemory(userId, message) {
  const user = initUser(userId);
  if (!message || message.length < 20) return;
  user.memories.push({
    text: message,
    keywords: extractKeywords(message),
    time: Date.now()
  });
  if (user.memories.length > 40) user.memories.shift();
}

function extractKeywords(text) {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 4);
}

function recallRelevantMemory(userId, message) {
  const user = initUser(userId);
  const msgKeys = extractKeywords(message);
  let bestMatch = null;
  let bestScore = 0;
  for (const mem of user.memories) {
    const overlap = mem.keywords.filter(k => msgKeys.includes(k)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = mem;
    }
  }
  return bestMatch?.text || null;
}

function relationshipTone(depth) {
  switch (depth) {
    case 1: return "Professional, helpful, neutral.";
    case 2: return "Slightly warm and encouraging.";
    case 3: return "Familiar and supportive.";
    case 4: return "Understands user's patterns and goals.";
    case 5: return "Trusted companion tone with continuity awareness.";
    default: return "Helpful assistant.";
  }
}

function buildAdaptivePrompt(userId, userMessage) {
  const depth = updateDepth(userId);
  storeMemory(userId, userMessage);
  const recalled = recallRelevantMemory(userId, userMessage);
  const tone = relationshipTone(depth);
  let memorySection = "";
  if (recalled) {
    memorySection = `Relevant past context from user:\n"${recalled}"\n`;
  }
  return `
${memorySection}
Relationship depth level: ${depth}

Communication style:
${tone}

Respond with continuity awareness while remaining natural.
`;
}

// ===============================
// COMPLEXITY DETECTION (UPGRADED)
// ===============================

function detectComplexity(message) {
  const text = message.toLowerCase().trim();
  const wordCount = text.split(/\s+/).length;
  let score = 0;

  if (wordCount < 12) return "LOW";

  const strongSignals = [
    "i don't know what", "should i quit",
    "important choice", "no hope",
    "losing myself", "don't see the point",
    "feels pointless", "not sure who i am",
  ];

  const mediumSignals = [
    "part of me", "can't seem to",
    "i keep", "been thinking about",
    "feeling lost", "feeling confused",
    "fear of", "pressure to",
    "getting worse", "keeps coming back",
    "career decision", "wrong direction",
    "what if i", "my future", "stuck in"
  ];

  for (const s of strongSignals) {
    if (text.includes(s)) {
      score += 2;
      if (score >= 3) return "HIGH";
    }
  }

  for (const s of mediumSignals) {
    if (text.includes(s)) {
      score += 1;
      if (score >= 3) return "HIGH";
    }
  }

  if (wordCount > 80) score += 2;
  if (wordCount > 140) score += 1;

  return score >= 3 ? "HIGH" : "LOW";
}

// ===============================
// MODEL ROUTER
// ===============================

function selectModel(complexity) {
  return complexity === "HIGH"
    ? "claude-sonnet-4-20250514"
    : "claude-haiku-4-5-20251001";
}

export { buildAdaptivePrompt, detectComplexity, selectModel };
