// ======================================
// MEMORY MERGE — With confidence gate
// ======================================

import { seedMemoryFromOnboarding } from './onboardingIdentitySync.js';

export async function runHaikuMemoryMerge({ userId, message, existingMemory, callModel }) {
  if (message.length < 40) return existingMemory;

  const baseMemory = existingMemory || {
    goals: [],
    recurringStruggles: [],
    strengths: [],
    decisionPatterns: [],
    identityDirection: "",
    lastUpdated: null
  };

  const { memory: updatedMemory, confidence } = await seedMemoryFromOnboarding(
    { currentMessage: message },
    baseMemory,
    callModel
  );

  if (!confidence || confidence < 0.7) {
    return existingMemory;
  }

  return updatedMemory;
}
