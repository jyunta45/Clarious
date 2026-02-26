// ======================================
// MEMORY MERGE — Reuses onboarding extraction
// ======================================

import { seedMemoryFromOnboarding } from './onboardingIdentitySync.js';

export async function runHaikuMemoryMerge({ userId, message, existingMemory, callModel }) {
  const baseMemory = existingMemory || {
    goals: [],
    recurringStruggles: [],
    strengths: [],
    decisionPatterns: [],
    identityDirection: "",
    lastUpdated: null
  };

  return await seedMemoryFromOnboarding(
    { currentMessage: message },
    baseMemory,
    callModel
  );
}
