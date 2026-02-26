// ======================================
// IDENTITY SHIFT DETECTOR (ZERO AI COST)
// ======================================

export function detectIdentityShift(message) {
  const identitySignals = [
    "i want to become",
    "i changed my goal",
    "i no longer want",
    "my priority now",
    "i decided to",
    "from now on",
    "i'm focusing on",
    "i realized i should",
    "my direction is"
  ];

  const msg = message.toLowerCase();

  return identitySignals.some(signal =>
    msg.includes(signal)
  );
}
