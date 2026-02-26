// ======================================
// IDENTITY EXTRACTION ENGINE
// Used by onboarding seed + identity shift merge
// ======================================

const IDENTITY_EXTRACTION_PROMPT = `
You are updating long-term user identity memory.

Extract ONLY stable, identity-level information.

VALID updates include:
- Long-term goals
- Persistent struggles
- Demonstrated strengths
- Decision-making patterns
- Directional identity change ("I want to become...", "From now on...")

IGNORE:
- Temporary emotions
- Momentary frustration
- Hypothetical thinking
- Testing statements
- Doubts or uncertainty

Rules:
- Never overwrite existing memory.
- Only append genuinely new information.
- Avoid duplicates.
- Prefer long-term direction over short-term state.

Return JSON:

{
  "goals": [],
  "recurring_struggles": [],
  "strengths": [],
  "decision_patterns": [],
  "identity_direction": [],
  "confidence": 0.0
}

Confidence represents how stable and intentional the identity change appears.
Range: 0.0-1.0
`;

export async function seedMemoryFromOnboarding(
  onboardingAnswers,
  memory,
  callModel
) {
  const result = await callModel(
    "claude-haiku-4-5-20251001",
    IDENTITY_EXTRACTION_PROMPT,
    JSON.stringify(onboardingAnswers)
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return memory;

  const parsed = JSON.parse(jsonMatch[0]);

  function addUnique(arr, value) {
    if (!value) return;
    if (!arr.some(v => v.toLowerCase() === value.toLowerCase())) {
      arr.push(value);
    }
  }

  function addUniqueArray(targetArr, sourceArr) {
    if (!Array.isArray(sourceArr)) return;
    for (const item of sourceArr) {
      addUnique(targetArr, item);
    }
  }

  addUniqueArray(memory.goals, parsed.goals);
  addUniqueArray(memory.recurringStruggles, parsed.recurring_struggles);
  addUniqueArray(memory.strengths, parsed.strengths);
  addUniqueArray(memory.decisionPatterns, parsed.decision_patterns);

  if (parsed.identity_direction) {
    if (Array.isArray(parsed.identity_direction) && parsed.identity_direction.length > 0) {
      memory.identityDirection = parsed.identity_direction[parsed.identity_direction.length - 1];
    } else if (typeof parsed.identity_direction === 'string') {
      memory.identityDirection = parsed.identity_direction;
    }
  }

  memory.lastUpdated = Date.now();

  return { memory, confidence: parsed.confidence || 0 };
}
