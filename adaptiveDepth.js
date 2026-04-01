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
    // Stuck / looping
    "going in circles", "keep going back", "can't make up my mind",
    "i can't decide", "back and forth", "can't move forward",
    // Ambiguous multi-direction
    "torn between", "not sure which", "two options", "multiple paths",
    "don't know which direction", "which way to go",
    // Synthesis / deep reasoning
    "how does this connect", "make sense of all", "underlying reason",
    "what's really going on", "root cause", "bigger picture",
  ];

  const mediumSignals = [
    "part of me", "can't seem to",
    "i keep", "been thinking about",
    "feeling lost", "feeling confused",
    "fear of", "pressure to",
    "getting worse", "keeps coming back",
    "career decision", "wrong direction",
    "what if i", "my future", "stuck in",
    // Multi-directional
    "both options", "pros and cons", "on one hand",
    "another part of me", "at the same time",
    // Synthesis
    "put this together", "how to reconcile", "conflicting",
    "not sure if", "keep wondering",
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

function detectDecisionMode(message) {
  if (!message || typeof message !== "string") return false;

  const text = message.toLowerCase();
  const decisionPhrases = [
    "should i",
    "what should i do",
    "i can't decide",
    "i'm unsure about",
    "which option",
    "what would you do",
    "help me decide",
    "i don't know whether",
    "torn between",
    "not sure if i should",
    "is it worth",
    "making the right choice",
    "which is better",
    "i keep going back and forth"
  ];

  return decisionPhrases.some(phrase =>
    text.includes(phrase)
  );
}

export { buildAdaptivePrompt, detectComplexity, selectModel, detectDecisionMode };
