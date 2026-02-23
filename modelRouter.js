// =====================================
// MODEL ROUTER — COST CONTROL ENGINE
// =====================================

function detectDepth(message = "") {

  const text = message.toLowerCase();
  let score = 0;

  if (
    text.includes("purpose") ||
    text.includes("life") ||
    text.includes("future") ||
    text.includes("who am i")
  ) score++;

  if (
    text.includes("lost") ||
    text.includes("confused") ||
    text.includes("stuck") ||
    text.includes("torn")
  ) score++;

  if (
    text.includes("however") ||
    text.includes("depends") ||
    text.includes("on one hand")
  ) score++;

  if (message.length > 300) score++;

  return score;
}

function chooseModel(message) {

  const depth = detectDepth(message);

  if (depth >= 3) {
    return "opus";
  }

  if (depth >= 1) {
    return "sonnet";
  }

  return "haiku";
}

export { chooseModel };
