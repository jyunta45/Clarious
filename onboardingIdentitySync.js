// ======================================
// ONBOARDING → MEMORY SEED
// Runs once after onboarding completion
// ======================================

export async function seedMemoryFromOnboarding(
  onboardingAnswers,
  memory,
  callModel
) {
  const prompt = `
Extract ONLY explicitly stated facts from the onboarding answers below.
Do NOT infer.
Return JSON only.

{
  "goal": null,
  "recurringStruggle": null,
  "strength": null,
  "decisionPattern": null,
  "identityDirection": null
}
`;

  const result = await callModel(
    "claude-haiku-4-5-20251001",
    prompt,
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

  if (parsed.goal)
    addUnique(memory.goals, parsed.goal);

  if (parsed.recurringStruggle)
    addUnique(memory.recurringStruggles, parsed.recurringStruggle);

  if (parsed.strength)
    addUnique(memory.strengths, parsed.strength);

  if (parsed.decisionPattern)
    addUnique(memory.decisionPatterns, parsed.decisionPattern);

  if (parsed.identityDirection)
    memory.identityDirection = parsed.identityDirection;

  memory.lastUpdated = Date.now();

  return memory;
}
