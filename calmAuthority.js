function buildCalmAuthorityPrompt(userMessage = "") {
  const emotionalSignals = ["stress","anxious","panic","confused","lost","overthinking","tired","frustrated","afraid","worried"];
  const message = userMessage.toLowerCase();
  const isUnstable = emotionalSignals.some(w => message.includes(w));

  if (isUnstable) {
    return `
Regulation Mode: User shows emotional distress.
- Slow pacing, shorter sentences
- Ground in clarity, reduce intensity
- Reassure through logic, not emotion
- Never mirror panic
`;
  }

  return `
Tone: Composed confidence. Clear and efficient. Guide, don't impress.
`;
}

export { buildCalmAuthorityPrompt };
