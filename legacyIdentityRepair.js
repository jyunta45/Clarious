// ======================================
// LEGACY IDENTITY REPAIR
// One-time fix for users who completed onboarding
// before the identity sync system existed
// ======================================

import { seedMemoryFromOnboarding } from './onboardingIdentitySync.js';

export async function repairLegacyIdentity({ userRecord, callModel, db, userData, eq }) {
  if (!userRecord) return false;
  if (userRecord.memorySeeded) return false;
  if (!userRecord.answers || Object.keys(userRecord.answers).length === 0) return false;
  if (userRecord.stage !== 'chat') return false;

  try {
    const baseMemory = {
      goals: [],
      recurringStruggles: [],
      strengths: [],
      decisionPatterns: [],
      identityDirection: "",
      lastUpdated: null
    };

    const { memory: seededMemory } = await seedMemoryFromOnboarding(
      userRecord.answers,
      baseMemory,
      callModel
    );

    await db.update(userData).set({
      memories: seededMemory,
      memorySeeded: true,
      updatedAt: new Date()
    }).where(eq(userData.userId, userRecord.userId));

    return true;
  } catch (err) {
    return false;
  }
}
