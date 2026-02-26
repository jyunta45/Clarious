// ======================================
// IDENTITY UPDATE COOLDOWN GUARD
// ======================================

export function cooldownPassed(lastUpdate) {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  if (!lastUpdate) return true;

  return Date.now() - new Date(lastUpdate).getTime() > SIX_HOURS;
}
