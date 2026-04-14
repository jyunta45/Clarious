// ======================================
// CONTEXT COMPRESSION ENGINE
// ======================================

import { buildUserState } from './userStateEngine.js';
import { detectDecisionMode } from './adaptiveDepth.js';

function extractGuidance(summary) {
  if (!summary) return "";
  return `
Use past session context only to guide tone,
priority, and relevance.

DO NOT repeat personal facts unprompted.
DO NOT list remembered situations unprompted.
DO NOT summarize the user back to themselves.
Respond only to the current message.

Exception: If the user directly asks whether you remember them,
ALWAYS confirm that you do — never deny your own memory.
`;
}

const PRESENT_RULE = `
Speak as if meeting the user in this moment.
Do not recite stored facts or summarize the user back to themselves unprompted.
Focus on helping forward movement.

CRITICAL — Memory honesty rule:
If the user directly asks whether you remember them or previous conversations,
ALWAYS confirm that you do have context and familiarity with them.
NEVER claim that "each conversation starts fresh" or deny having any record of them.
The rule above means: don't volunteer stored facts unprompted — not that you should deny your own memory.
Respond naturally, e.g. "Yes — I know you." or "I carry a sense of who you are from our conversations."
`;

// ======================================
// STATE CONTEXT INJECTION
// ======================================

function buildStateContext(state) {
  if (!state.direction && !state.currentFocus.length)
    return "";

  return `
User Direction: ${state.direction || "forming"}
Current Focus: ${state.currentFocus.join(", ") || "exploration"}
Recurring Friction: ${state.recurringFriction.join(", ") || "none"}
Emotional Trend: ${state.emotionalTrend}
Growth Phase: ${state.growthPhase}
`.trim();
}

// ======================================
// GUIDANCE CONTEXT
// ======================================

function buildGuidanceContext(guidanceData) {
  if (!guidanceData) return "";
  if (!guidanceData.guidanceMode) return "";

  const day = guidanceData.guidanceDay || 1;
  if (day > 7) return "";
  let toneInstruction = "";

  if (day <= 3) {
    toneInstruction =
      `User is in early guidance phase (Day ${day} of 7).
Be more supportive and gentle.
Normalize the process of self-reflection.
They are still learning how to use this space.
Avoid deep challenges — focus on making them feel safe.`;
  } else if (day <= 6) {
    toneInstruction =
      `User is in mid guidance phase (Day ${day} of 7).
Shift toward reflective questioning.
Help them notice patterns in what they share.
They are becoming comfortable — gently go deeper.
Begin connecting their statements to their stated goals.`;
  } else {
    toneInstruction =
      `User is completing guidance phase (Day ${day} of 7).
Treat them as a capable self-reflector.
Move toward peer-level collaboration.
They have shown consistency — match their maturity.
Challenge them more directly when appropriate.`;
  }

  return `\nGUIDANCE CONTEXT:\n${toneInstruction}`;
}

// ======================================
// REFLECTION CONTEXT
// ======================================

function buildReflectionContext(userMessage, userMemory, patterns) {
  if (!userMessage || typeof userMessage !== "string") return "";
  if (!userMemory) return "";

  const text = userMessage.toLowerCase().trim();

  if (text.length < 20) return "";

  const reflections = [];

  function includesMeaningfulWord(text, phrase) {
    if (!phrase) return false;
    const words = phrase.toLowerCase().split(" ");
    return words.some(word =>
      word.length > 4 && text.includes(word)
    );
  }

  const matchedStruggle = userMemory.recurringStruggles?.find(
    struggle => includesMeaningfulWord(text, struggle)
  );

  if (matchedStruggle) {
    reflections.push(
      `You've mentioned struggling with ${matchedStruggle} before. ` +
      `If relevant, connect this to the current moment naturally — ` +
      `not as a label, but as continuity.`
    );
  }

  const matchedGoal = userMemory.goals?.find(
    goal => includesMeaningfulWord(text, goal)
  );

  if (matchedGoal) {
    reflections.push(
      `This connects to something the user has been working toward: ` +
      `${matchedGoal}. Reference it naturally if it adds clarity.`
    );
  }

  const isDecisionMessage =
    text.includes("should i") ||
    text.includes("what do i do") ||
    text.includes("can't decide") ||
    text.includes("cannot decide") ||
    text.includes("torn between") ||
    text.includes("not sure what to do");

  if (isDecisionMessage && userMemory.decisionPatterns?.length > 0) {
    const pattern =
      userMemory.decisionPatterns[
        userMemory.decisionPatterns.length - 1
      ];
    reflections.push(
      `This user tends to ${pattern} when facing decisions. ` +
      `Be aware of this pattern without naming it directly ` +
      `unless it genuinely helps.`
    );
  }

  const hasRepeatedTopic = patterns?.topTopics?.some(
    topic => includesMeaningfulWord(text, topic)
  );

  if (hasRepeatedTopic) {
    reflections.push(
      `This is a topic the user returns to often. ` +
      `You can acknowledge the pattern gently ` +
      `if it serves the conversation.`
    );
  }

  if (reflections.length === 0) return "";

  const trimmed = reflections.slice(0, 2);

  return (
    `\nREFLECTION CONTEXT:\n` +
    trimmed.join("\n")
  );
}

// ======================================
// OPEN LOOP CONTEXT
// ======================================

function buildOpenLoopContext(openLoops) {
  if (!openLoops || openLoops.length === 0) return "";

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const activeLoop = openLoops.find(loop =>
    loop.resolved === false &&
    (now - loop.createdAt) < thirtyDays
  );

  if (!activeLoop) return "";

  return `
OPEN LOOP CONTEXT:
The user previously mentioned an unresolved situation:
"${activeLoop.content}"

If it feels natural and relevant to the current conversation, you may gently acknowledge it.
Do not force it.
Do not mention dates.
Do not say you are recalling memory.
Speak as someone who simply remembers.`;
}

// ======================================
// DEEP TOPIC DETECTION
// ======================================

const DEEP_KEYWORDS = [
  // English
  "career", "relationship", "marriage", "breakup",
  "purpose", "life direction", "future", "identity",
  "who i am", "what should i do with my life",
  "financial future", "moving away", "major decision",
  "long term", "paradigm shift", "version of me",
  "who i was", "who i'm becoming", "life changing",
  "life change", "turning point", "crossroads",
  "meaning of", "what matters", "existential",
  "self doubt", "self-doubt", "questioning everything",
  "lost myself", "finding myself", "reinvent",
  "transformation", "becoming someone", "old version",
  "new version", "not the same person", "changed person",
  "disconnected", "don't belong", "outgrow", "outgrown",
  "growing apart", "different realities", "living two",
  "torn between", "conflicted", "inner conflict",
  "afraid to change", "scared to", "holding me back",
  "stuck in life", "what's next", "big picture",
  "vision", "legacy", "dream", "ambition",
  "starting over", "new chapter", "pivot",
  "quitting", "leaving everything", "walking away",
  "sacrifice", "trade-off", "worth it",
  "validation", "approval", "proving myself",
  "imposter", "not good enough", "deserve",
  "calling", "passion", "mission",
  "lonely", "isolation", "nobody understands",
  "family pressure", "expectations", "disappointing",
  "letting go", "moving on", "grief",

  // English — ego / self-concept / philosophy
  "ego", "higher self", "true self", "authentic self", "real self",
  "shadow self", "shadow work", "inner child", "subconscious",
  "consciousness", "self-concept", "self-image", "self-worth",
  "core belief", "belief system", "limiting belief",
  "authenticity", "authentic", "genuine self",
  "mindset shift", "inner work", "personal growth",
  "spiritual", "soul", "deeper meaning", "bigger picture",
  "my values", "what i believe", "who i really am",
  "wake up call", "pattern i keep", "cycle i keep",
  "narrative", "story i tell myself",

  // Thai — career & job
  "ลาออก", "ออกจากงาน", "เปลี่ยนงาน", "เปลี่ยนอาชีพ",
  "เปลี่ยนเส้นทาง", "หยุดทำงาน", "ลาออกจาก",
  // Thai — life direction & purpose
  "ทิศทางชีวิต", "เส้นทางชีวิต", "ความหมายของชีวิต",
  "เป้าหมายชีวิต", "ชีวิตที่อยากได้", "ชีวิตที่ต้องการ",
  "บทใหม่", "เริ่มใหม่", "เริ่มต้นใหม่",
  // Thai — identity & self
  "ตัวตน", "ตัวเองจริงๆ", "เป็นตัวเอง", "ไม่รู้จักตัวเอง",
  "ตัวเองคือใคร", "ไม่รู้ว่าตัวเองต้องการอะไร",
  // Thai — stuck / lost / unsure
  "ติดอยู่", "หลงทาง", "ไม่รู้จะทำอะไร", "ไม่รู้จะไปทางไหน",
  "ลังเล", "ไม่แน่ใจว่าจะ", "ไม่รู้ว่าควรจะ",
  "วนเวียน", "วนซ้ำ", "วนอยู่",
  // Thai — relationships
  "เลิกกัน", "แยกทาง", "แต่งงาน", "ความสัมพันธ์",
  "ปัญหาครอบครัว", "ครอบครัวกดดัน",
  // Thai — major decisions
  "ตัดสินใจใหญ่", "เลือกไม่ได้", "ไม่รู้จะเลือก",
  "ย้าย", "ย้ายประเทศ", "ย้ายที่", "ออกไป",
  // Thai — ambition & dreams
  "ความฝัน", "ความทะเยอทะยาน", "อยากเป็น", "อยากทำ",
  "อยากมี", "อยากได้", "วิชั่น",
  // Thai — pressure & worth
  "แรงกดดัน", "ความคาดหวัง", "พิสูจน์ตัวเอง",
  "คุ้มค่าไหม", "คุ้มไหม", "มีคุณค่า",
  // Thai — quitting or giving up
  "ยอมแพ้", "เลิกทำ", "หยุดทำ", "ทิ้งทุกอย่าง",
  "ไม่ไหวแล้ว", "เหนื่อยแล้ว", "อยากเลิก",

  // Thai — ego / self-concept / philosophy
  "อีโก้", "ตัวตนที่แท้จริง", "ตัวตนจริงๆ", "ตัวตนระดับสูง",
  "ความเชื่อหลัก", "ระบบความเชื่อ", "ความเชื่อที่จำกัดตัวเอง",
  "จิตสำนึก", "จิตใต้สำนึก", "วิญญาณ",
  "คุณค่าของตัวเอง", "ภาพลักษณ์ตัวเอง", "ความเชื่อเกี่ยวกับตัวเอง",
  "การเติบโตส่วนตัว", "งานภายใน", "รูปแบบที่ทำซ้ำ",
  "เรื่องราวที่บอกตัวเอง", "ความหมายที่ลึกกว่า",
  "สิ่งที่ฉันเชื่อ", "ค่านิยมของฉัน", "จิตวิญญาณ"
];

const DEEP_PATTERNS = [
  /i(?:'m| am) (?:not sure|confused|lost|torn|struggling) (?:about|with) (?:who|what|where|my)/i,
  /(?:should i|do i) (?:quit|leave|stay|change|give up|keep going|pursue|follow)/i,
  /(?:i feel like|it feels like) (?:i'm|i am) (?:becoming|changing|losing|different|not)/i,
  /(?:my (?:life|world|reality|perspective) (?:has|is) (?:changed|changing|different|shifting))/i,
  /(?:i (?:don't|can't) (?:connect|relate|fit in|belong) (?:with|to|anymore))/i,
  /(?:the (?:person|version|me) i (?:was|used to be|want to be|am becoming))/i,
  /(?:i'm (?:imagining|envisioning|seeing|building|creating) (?:a |my )(?:new|different|future|version))/i,
  /(?:100%|completely|totally|fundamentally) (?:change|different|transform|shift)/i,
  /(?:back (?:to|in) (?:my|the) (?:old|previous|hometown|past))/i,
  /(?:they (?:don't|can't|won't) (?:understand|see|get|support))/i,
  /(?:connection.{0,20}(?:lost|fading|gone|broken|different))/i,
  /(?:momentum|energy|drive|fire).{0,20}(?:lost|gone|fading|back)/i,
  /(?:big|global|massive|huge|large).{0,15}(?:scale|stage|level|project|vision)/i
];

function detectDeepTopic(message) {
  if (!message || typeof message !== "string") return false;
  const text = message.toLowerCase();
  if (DEEP_KEYWORDS.some(keyword => text.includes(keyword))) return true;
  return DEEP_PATTERNS.some(pattern => pattern.test(message));
}

// ======================================
// CONVERSATION PHASE DETECTION
// ======================================

const DECISION_OVERRIDE_SIGNALS = [
  "should i", "torn between", "what do i do",
  "major decision", "quit", "leave", "life direction"
];

function detectConversationPhase(messages, userMessage) {
  if (!messages || !Array.isArray(messages)) return "opening";

  // Check decision override signals first
  if (userMessage && typeof userMessage === "string") {
    const lower = userMessage.toLowerCase();
    if (DECISION_OVERRIDE_SIGNALS.some(s => lower.includes(s))) return "decision";
  }

  const userMessages = messages.filter(m => m.role === "user");
  const count = userMessages.length;

  if (count <= 2) return "opening";
  if (count <= 6) return "exploration";
  return "decision";
}

// ======================================
// INTENT DETECTION
// ======================================

function detectIntent(message) {
  if (!message || typeof message !== "string") return [];

  const text = message.toLowerCase();
  const intents = [];

  const signals = {
    decision: [
      "should i", "deciding",
      "torn between", "major decision",
      "quit", "leave"
    ],
    reflection: [
      "reflect", "looking back",
      "progress", "past year"
    ],
    opportunity: [
      "opportunity", "business idea",
      "side hustle", "market"
    ],
    habit: [
      "routine", "discipline",
      "consistency", "habit"
    ],
    emotional: [
      "overwhelmed", "burned out",
      "sad", "stressed"
    ]
  };

  for (const [intent, phrases] of Object.entries(signals)) {
    if (phrases.some(p => text.includes(p))) {
      intents.push(intent);
    }
  }

  return intents;
}

// ======================================
// MODE PROMPTS
// ======================================

const DAILY_MODE_PROMPT = `
CONVERSATION MODE: daily

The user is in daily life mode.
This is personal but not a life decision.

Topics include: skin, food, exercise, mood, health questions,
small daily choices, how they feel today, daily routines.

Respond warmly and practically.
Answer what was actually asked.
Acknowledge feelings briefly and naturally.

Do NOT enter deep life analysis.
Do NOT reference long-term patterns out loud.
Do NOT activate decision guidance.
Do NOT turn daily moments into therapy.

Keep responses shorter and lighter than deep mode.

You still know who this person is — their background,
goals, and struggles remain in memory and shape your awareness.
But this conversation is not the place to bring those things forward.

Just be present, warm, and genuinely helpful
for what they are actually dealing with today.`;

const DAILY_MODE_SHIFT_AWARENESS = `
MODE SHIFT AWARENESS:
While responding in Daily mode, quietly assess whether
the user may actually be touching on a life direction
question or meaningful personal decision.

If the user's message suggests something that may shape
the direction of their life, gently offer the option
to move into Deep Thinking mode.

Do NOT switch modes automatically.
Instead briefly acknowledge what they said and add
a soft optional invitation such as:
"This sounds like something meaningful to think through.
Would you like to explore it in Deep Thinking mode?"

Keep the suggestion natural and optional.
If the topic is clearly just a daily life matter,
do NOT suggest switching modes.`;

const DEEP_MODE_PROMPT = `
CONVERSATION MODE: deep

The user has chosen to think something through.
Full thinking partner behavior applies.
All systems active: memory extraction, pattern tracking,
reflection context, decision guidance, open loop tracking.

This is a meaningful conversation.
Give it the full depth it deserves.`;

// ======================================
// CONTEXT BUILDER
// ======================================

function buildContext({
  enhancedSystem,
  conversation,
  rollingSummary,
  userMemory,
  sessionSummary,
  moodTrend,
  patterns,
  relationshipDepth,
  guidanceData,
  openLoops,
  mode,
  deepSignal,
  memoryDigest,
  phaseOverride
}) {
  const TURN_THRESHOLD = 5;
  const RECENT_LIMIT = 4;
  const isDaily = mode === "daily";

  let messages = [];

  const userState = buildUserState({
    memory: userMemory || {},
    sessionSummary: sessionSummary || rollingSummary,
    moodTrend: moodTrend || null,
    patterns: patterns || null,
    relationshipDepth: relationshipDepth || 1
  });

  const lastUserMsg = [...conversation].reverse().find(m => m.role === 'user');
  const userMessage = lastUserMsg ? lastUserMsg.content : '';

  // Phase detection — server may override when HIGH complexity is detected
  const phase = phaseOverride || detectConversationPhase(conversation, userMessage);
  const activeIntents = detectIntent(userMessage);
  const isOpening = phase === 'opening';
  const isExploration = phase === 'exploration';
  const isDecisionPhase = phase === 'decision';

  // ── Memory block (digest if available) ──────────────────
  // Always include — blocking at opening phase means "do you remember?" never works
  const memoryBlock = memoryDigest
    ? `ABOUT THIS USER (from previous conversations):\n${memoryDigest}\n\nIf the user asks whether you remember them, confirm you do — you have a sense of who they are.`
    : `MEMORY STATUS: You are still building familiarity with this user. You do not yet have a detailed profile. If they ask whether you remember them, be honest but warm — acknowledge that you are getting to know them and your memory of them will grow with each conversation. Do not claim perfect recall, but do not say "each conversation starts fresh" either.`;

  // ── State block ──────────────────────────────────────────
  const stateBlock = (isDaily || isOpening)
    ? ""
    : buildStateContext(userState);

  // ── Guidance block ───────────────────────────────────────
  const guidanceBlock = isDaily ? "" : buildGuidanceContext(guidanceData);

  // ── Decision context ─────────────────────────────────────
  const hasDecisionSignal = isDaily ? false : detectDecisionMode(userMessage);
  const decisionContext = (!isDaily && isDecisionPhase && hasDecisionSignal)
    ? `\nMODE: decision_guidance\nThe user is facing a decision right now.\nApply this approach:\n- Briefly restate what they are actually deciding in one clear sentence\n- Surface 2-3 key factors that genuinely matter for this specific decision\n- Explore what each direction could mean for them\n- End with ONE thoughtful question that helps them reflect on what matters most to them\n- Do not decide for them\n- Do not overwhelm with options\n- Do not give a recommendation unless they explicitly ask for one\n- Help them think — not choose`
    : "";

  // ── Reflection block (intent-gated in exploration) ───────
  const shouldLoadReflection = !isDaily && !isOpening && (
    isDecisionPhase ||
    (isExploration && (
      activeIntents.includes('reflection') ||
      activeIntents.includes('decision') ||
      activeIntents.includes('emotional')
    ))
  );
  const reflectionBlock = shouldLoadReflection
    ? buildReflectionContext(userMessage, userMemory || {}, patterns || null)
    : "";

  // ── Open loop block (decision phase only) ────────────────
  const openLoopBlock = (isDaily || isOpening || isExploration)
    ? ""
    : buildOpenLoopContext(openLoops);

  // ── Mode block ────────────────────────────────────────────
  let modeBlock = isDaily ? DAILY_MODE_PROMPT : DEEP_MODE_PROMPT;
  if (isDaily) {
    modeBlock += "\n\n" + DAILY_MODE_SHIFT_AWARENESS;
    if (deepSignal) {
      modeBlock += "\n\nPossible mode shift detected by backend.\nThe user's message contains a life direction signal.\nApply MODE SHIFT AWARENESS judgment.\nIf the topic genuinely touches on life direction, offer the switch naturally and optionally.";
    }
  }

  const combinedBlocks = [
    modeBlock, memoryBlock, stateBlock, guidanceBlock,
    decisionContext, reflectionBlock, openLoopBlock
  ].filter(b => b).join("\n\n");

  const finalSystem = combinedBlocks
    ? enhancedSystem + "\n\n" + combinedBlocks
    : enhancedSystem;

  messages.push({ role: "system", content: finalSystem });
  messages.push({ role: "system", content: PRESENT_RULE });

  if (conversation.length <= TURN_THRESHOLD) {
    messages.push(...conversation);
    return messages;
  }

  if (
    rollingSummary &&
    rollingSummary !== "No significant session context to carry forward."
  ) {
    messages.push({ role: "system", content: extractGuidance(rollingSummary) });
  }

  const recentMessages = conversation.slice(-RECENT_LIMIT);
  messages.push(...recentMessages);

  return messages;
}

export { buildContext, detectDeepTopic, detectConversationPhase };
