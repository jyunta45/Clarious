// ======================================
// ONBOARDING ENGINE
// Fixed 11-question sequential structure.
// Claude only acknowledges + reads next question.
// No free-flowing question generation.
// ======================================

export const CATEGORY_ORDER = [
  'whoYouAre', 'whatDrivesYou', 'insecurities', 'goals',
  'obstacles', 'resources', 'lifestyle', 'decisionMaking'
];

export const CATEGORY_INFO = {
  whoYouAre: {
    description: 'Understanding who the user is — what they do, their age, and what a typical day looks like for them.',
    keyTopics: ['their work or how they spend time', 'a sense of their daily life', 'basic context about who they are'],
    openerKey: 'whoYouAreOpener'
  },
  whatDrivesYou: {
    description: 'What motivates them — what they want to feel proud of, what they are tired of dealing with, and the feeling they are working toward.',
    keyTopics: ['what they want to feel proud of', 'what they are tired of', 'the feeling or state they are chasing'],
    openerKey: 'whatDrivesYouOpener'
  },
  insecurities: {
    description: 'Where they feel self-conscious — areas of life they feel behind in, and what affects how they show up.',
    keyTopics: ['areas of self-consciousness', 'where they feel behind or insufficient', 'what holds them back internally'],
    openerKey: 'insecuritiesOpener'
  },
  goals: {
    description: 'Their goals and direction — where they want to be in 5-10 years, what they are building right now, and where their time goes that it should not.',
    keyTopics: ['long-term direction', 'what they are actively building', 'time going to the wrong things'],
    openerKey: 'goalsOpener'
  },
  obstacles: {
    description: 'What is in their way — habits holding them back, things they keep avoiding, and what they have tried that did not work.',
    keyTopics: ['habits that hold them back', 'things they keep avoiding', 'past attempts that failed'],
    openerKey: 'obstaclesOpener'
  },
  resources: {
    description: 'What they have to work with — their financial situation, what they are genuinely good at, the biggest obstacle between them and their goals, and their daily focus capacity.',
    keyTopics: ['financial situation', 'genuine strengths', 'biggest constraint', 'hours of real focus per day'],
    openerKey: 'resourcesOpener'
  },
  lifestyle: {
    description: 'How they live and work — their sleep schedule, when they do their best work, and how they operate day to day.',
    keyTopics: ['sleep schedule', 'when they are most productive', 'how they work best'],
    openerKey: 'lifestyleOpener'
  },
  decisionMaking: {
    description: 'How they make decisions and see themselves — how they handle big choices, what matters most to their identity, how they respond to setbacks, how direct they want coaching to be, and what they want most from this space.',
    keyTopics: ['how they make big decisions', 'what defines their identity', 'how they handle failure', 'preferred coaching style', 'what they want from this space'],
    openerKey: 'decisionMakingOpener'
  }
};

export const LANG_NAMES = {
  en: 'English',
  ja: 'Japanese',
  es: 'Spanish',
  th: 'Thai',
  ko: 'Korean'
};

// ── 11 pre-written questions ──────────────────────────────────────────────────
export const QUESTIONS = {
  en: [
    "What does a typical day look like for you — what takes up most of your time?",
    "Is this work something you chose, or did you fall into it?",
    "What's one thing that, if you achieved it this year, you'd feel genuinely proud of?",
    "Right now, what are you most worn down by — and wish you could escape from?",
    "Is there an area of your life where you feel behind where you thought you'd be?",
    "What's the main goal you're actively working toward right now?",
    "Is there a habit or pattern you feel is holding you back?",
    "What are you genuinely good at — something that sets you apart and comes naturally to you?",
    "How's your sleep and energy — what time of day do you work best?",
    "When you face a big decision, what does your thinking process usually look like before you decide?",
    "What's the most important thing that defines who you are?"
  ],
  th: [
    "วันปกติของคุณเป็นยังไง — ส่วนใหญ่ใช้เวลาไปกับอะไร",
    "งานที่ทำอยู่นี่ เลือกเองหรือว่ามันค่อยๆ เกิดขึ้นมาเอง",
    "อะไรคือสิ่งที่ถ้าคุณบรรลุได้ในปีนี้ แล้วจะรู้สึกภูมิใจกับตัวเองจริงๆ",
    "ตอนนี้มีอะไรที่รู้สึกเหนื่อย แล้วอยากหลุดพ้นออกจากมันมากที่สุด",
    "มีด้านไหนในชีวิตที่รู้สึกว่ายังไม่ถึงที่คิดไว้",
    "ตอนนี้เป้าหมายหลักที่กำลังมุ่งอยู่คืออะไร",
    "มีนิสัยหรือแพทเทิร์นอะไรที่คิดว่ามันฉุดรั้งตัวเองอยู่ไหม",
    "คิดว่าตัวเองมีดีและเก่งด้านไหน — ที่ต่างจากคนอื่น และทำได้โดยไม่ต้องฝืน",
    "การนอนหลับและพลังงานตอนนี้เป็นยังไง — ช่วงไหนของวันทำงานได้ดีที่สุด",
    "เวลาที่ต้องตัดสินใจเรื่องใหญ่ ปกติมีรูปแบบการคิดยังไงก่อนที่จะตัดสินใจ",
    "อะไรคือสิ่งที่สำคัญที่สุดที่บ่งบอกถึงตัวคุณ"
  ]
};

// ── Q11 (index 10) choice chips ───────────────────────────────────────────────
export const Q11_CHIPS = {
  th: ["ครอบครัว", "การงาน", "ค่านิยม / หลักการ", "เสรีภาพ", "ความสัมพันธ์", "การเติบโต"],
  en: ["Family", "Career", "Values / Principles", "Freedom", "Relationships", "Growth"]
};

// ── Hardcoded initial message (no Claude call — 100% reliable) ────────────────
export const INITIAL_MESSAGES = {
  en: (q) => `Good to meet you.\n\n${q}`,
  th: (q) => `ยินดีที่ได้คุยด้วยครับ\n\n${q}`,
  ja: (q) => `はじめまして。\n\n${q}`,
  es: (q) => `Encantado de conocerte.\n\n${q}`,
  ko: (q) => `반갑습니다.\n\n${q}`
};

export const START_MESSAGES = {
  en: "Good to meet you.\n\nBefore we dive into anything serious, I'd like to understand a little about your world.\n\nIt won't take long, and you can pause whenever you want.",
  ja: "はじめまして。\n\n本格的な話に入る前に、あなたのことを少し理解したいと思います。\n\n時間はかかりません。いつでも止められます。",
  es: "Mucho gusto.\n\nAntes de entrar en cosas serias, me gustaría entender un poco tu mundo.\n\nNo llevará mucho tiempo, y puedes pausar cuando quieras.",
  th: "ยินดีที่ได้รู้จัก\n\nก่อนจะเข้าเรื่องจริงจัง อยากทำความรู้จักคุณสักนิดก่อน\n\nไม่นานหรอก และหยุดพักเมื่อไหร่ก็ได้",
  ko: "반갑습니다.\n\n본격적인 이야기 전에, 먼저 당신에 대해 조금 알고 싶어요.\n\n오래 걸리지 않고, 언제든지 멈출 수 있어요."
};

export const SKIP_MESSAGES = {
  en: "No problem. You can always come back to this later.\n\nThis space is yours — use it however feels right.",
  ja: "了解です。いつでも戻れますよ。\n\nこのスペースはあなたのもの — 好きなように使ってください。",
  es: "Sin problema. Siempre puedes volver a esto más tarde.\n\nEste espacio es tuyo — úsalo como te parezca.",
  th: "ไม่เป็นไร กลับมาทีหลังได้เสมอ\n\nพื้นที่นี้เป็นของคุณ — ใช้ยังไงก็ได้ที่รู้สึกดี",
  ko: "괜찮아요. 언제든지 나중에 돌아올 수 있어요.\n\n이 공간은 당신의 것 — 편한 방식으로 사용하세요."
};

export const COMPLETION_MESSAGES = {
  en: "That's everything I needed to know for now.\n\nI have a much clearer picture of where you are and what you're working toward.\n\nThis space is yours now — use it however feels right.",
  ja: "今必要なことはこれで全部です。\n\nあなたが今どこにいて、何を目指しているかがずっとよくわかりました。\n\nこのスペースはもうあなたのもの — 好きなように使ってください。",
  es: "Eso es todo lo que necesitaba saber por ahora.\n\nTengo una imagen mucho más clara de dónde estás y hacia dónde vas.\n\nEste espacio es tuyo ahora — úsalo como te parezca.",
  th: "นั่นคือทุกอย่างที่ต้องรู้ตอนนี้ครับ\n\nตอนนี้เห็นภาพชัดขึ้นมากว่าคุณอยู่ตรงไหนและกำลังมุ่งไปที่ไหน\n\nพื้นที่นี้เป็นของคุณแล้ว — ใช้ยังไงก็ได้ที่รู้สึกดีครับ",
  ko: "지금 필요한 건 다 알았어요.\n\n지금 어디에 있고 무엇을 향해 가고 있는지 훨씬 명확해졌어요.\n\n이제 이 공간은 당신의 것 — 편한 방식으로 사용하세요."
};

export function getResumeMessage(lang, lastCategory) {
  const msgs = {
    en: `Welcome back.\n\nWould you like to continue where we left off, or start using the app now?`,
    th: `ยินดีต้อนรับกลับมาครับ\n\nอยากคุยต่อ หรือเริ่มใช้แอปเลยดี?`,
    ja: `おかえりなさい。\n\n続けますか？それともアプリを使い始めますか？`,
    es: `Bienvenido/a de vuelta.\n\n¿Te gustaría continuar, o empezar a usar la app ahora?`,
    ko: `다시 오셨군요.\n\n계속하시겠어요, 아니면 지금 앱을 사용하시겠어요?`
  };
  return msgs[lang] || msgs.en;
}

// ── Acknowledgment prompt ─────────────────────────────────────────────────────
// Claude's ONLY job: react briefly to what the user said, then ask the next question verbatim.
export function buildAcknowledgmentPrompt(lang, nextQuestion) {
  const langName = LANG_NAMES[lang] || 'English';
  const thaiRules = lang === 'th' ? `
THAI CHARACTER RULES — MANDATORY:

IDENTITY: Clarious is male. Always ครับ — NEVER ค่ะ. Never use ผม or ฉัน as self-reference. Use นี่ ("นี่ว่า...") or Clarious by name when introducing.

REGISTER: Follow the user — never lead. Start at formal ครับ register unless user goes casual first.
กู is ONLY allowed when user explicitly uses กู or มึง — casual words like เรา, เฮ่ย, ได้ๆ, นะ do NOT unlock กู.
กู/มึง and ครับ NEVER appear in the same response.

VOCABULARY — BANNED:
วันธรรมชาติ → วันปกติ
ตามธรรมชาติ (daily) → ตามปกติ
ชีวิตธรรมชาติ → ชีวิตประจำวัน
อารมณ์ภายใน → ความรู้สึก
ประกอบอาชีพ → ทำงาน
สนทนา → คุย
ลูก → ห้ามเด็ดขาด ใช้ แหละ แทน

PARTICLES: ว่ะ ห้ามจบประโยค. ปะครับ ห้าม. Never invent particles.
TONE: Warm, calm, measured. Short sentences. Never over-expressive.
FORMATTING: No --- dividers, no ** bold, no ## headings. One continuous flow.` : '';

  return `You are Clarious — a calm, intelligent personal coach.

The user just answered your previous question. Your job now:
1. Write ONE short sentence that shows you heard something SPECIFIC from their answer — reference a detail they actually mentioned
2. Then ask the next question below, word for word, exactly as written — do not change it, do not add to it

Next question to ask:
"${nextQuestion}"

Rules:
- Acknowledgment = exactly 1 sentence. No more.
- Pick up on ONE specific thing they said (a word, situation, feeling, detail). Do NOT use generic filler.
- BANNED phrases: "ชัดเจนเลยครับ", "ชัดเจน", "รับทราบครับ", "โอเคครับ รับทราบ", "I see", "Got it", "I understand"
- Every acknowledgment must feel different — never repeat the same phrase twice
- Then the question exactly as written above. Nothing after it.
- Do not ask anything else. Do not go deeper. Do not comment further.
- Respond entirely in ${langName}

Example acknowledgment patterns (adapt to what they actually said):
Thai: "โปรเจกต์ส่วนตัว — ฟังดูน่าสนใจมากครับ" / "ฟังดูเหนื่อยพอสมควรเลยนะครับ" / "จัดการได้ดีมากเลยครับ" / "หนักพอสมควรเลยนะครับ" / "ออกกำลังกายตั้งแต่เช้า — วินัยจริงครับ" / "ฟังดูมีระเบียบดีครับ"
English: "Solo project — sounds like it gives you real ownership." / "That sounds like a heavy load." / "You've got a clear structure going." / "Running your own thing — that takes real commitment."
${thaiRules}`;
}

export function getNextCategory(currentCategory) {
  const idx = CATEGORY_ORDER.indexOf(currentCategory);
  if (idx === -1 || idx >= CATEGORY_ORDER.length - 1) return null;
  return CATEGORY_ORDER[idx + 1];
}

// Complete after all 11 questions answered (indices 0-10, nextIndex would be 11)
export function shouldCompleteOnboarding(nextQuestionIndex) {
  return nextQuestionIndex >= 11;
}

export function getDefaultOnboardingProgress() {
  return {
    whoYouAre: false, whatDrivesYou: false, insecurities: false,
    goals: false, obstacles: false, resources: false,
    lifestyle: false, decisionMaking: false, lastCategoryDiscussed: null
  };
}
