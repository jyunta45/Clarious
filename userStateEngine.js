// ======================================
// USER STATE ENGINE
// Single authority for AI context injection
// ======================================

export function buildUserState({
  memory,
  sessionSummary,
  moodTrend,
  patterns,
  relationshipDepth
}) {
  const mem = memory || {};

  return {
    direction:
      mem.identityDirection || null,

    currentFocus:
      mem.goals?.slice(-2) || [],

    recurringFriction:
      mem.recurringStruggles?.slice(-2) || [],

    emotionalTrend:
      moodTrend || "stable",

    decisionStyle:
      mem.decisionPatterns?.slice(-1)[0] || null,

    growthPhase: inferGrowthPhase(mem, patterns),

    relationshipDepth
  };
}

function inferGrowthPhase(memory, patterns) {
  if (!memory.identityDirection)
    return "exploring";

  if (memory.goals?.length > 2)
    return "executing";

  if (memory.recurringStruggles?.length > 2)
    return "restructuring";

  return "developing";
}
