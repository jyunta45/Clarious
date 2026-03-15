// ======================================
// ONBOARDING ENGINE
// Controls conversational onboarding flow.
// The AI only generates natural language.
// The engine decides all structural moves.
// ======================================

export const CATEGORY_ORDER = [
  'whoYouAre',
  'whatDrivesYou',
  'insecurities',
  'goals',
  'obstacles',
  'resources',
  'lifestyle',
  'decisionMaking'
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

export const CATEGORY_DISPLAY_NAMES = {
  en: {
    whoYouAre: 'your day-to-day life',
    whatDrivesYou: 'what drives you',
    insecurities: 'your challenges',
    goals: 'your goals',
    obstacles: 'what holds you back',
    resources: 'your strengths and resources',
    lifestyle: 'your lifestyle',
    decisionMaking: 'how you think and decide'
  },
  ja: {
    whoYouAre: 'あなたの日常',
    whatDrivesYou: 'あなたを動かすもの',
    insecurities: 'あなたの課題',
    goals: 'あなたの目標',
    obstacles: 'あなたを止めるもの',
    resources: 'あなたの強みとリソース',
    lifestyle: 'あなたのライフスタイル',
    decisionMaking: 'あなたの思考と決断'
  },
  es: {
    whoYouAre: 'tu día a día',
    whatDrivesYou: 'lo que te motiva',
    insecurities: 'tus desafíos',
    goals: 'tus metas',
    obstacles: 'lo que te frena',
    resources: 'tus fortalezas y recursos',
    lifestyle: 'tu estilo de vida',
    decisionMaking: 'cómo piensas y decides'
  },
  th: {
    whoYouAre: 'ชีวิตประจำวันของคุณ',
    whatDrivesYou: 'สิ่งที่ขับเคลื่อนคุณ',
    insecurities: 'ความท้าทายของคุณ',
    goals: 'เป้าหมายของคุณ',
    obstacles: 'สิ่งที่ฉุดคุณไว้',
    resources: 'จุดแข็งและทรัพยากรของคุณ',
    lifestyle: 'ไลฟ์สไตล์ของคุณ',
    decisionMaking: 'วิธีคิดและตัดสินใจของคุณ'
  },
  ko: {
    whoYouAre: '일상',
    whatDrivesYou: '동기',
    insecurities: '도전',
    goals: '목표',
    obstacles: '장애물',
    resources: '강점과 자원',
    lifestyle: '생활 방식',
    decisionMaking: '사고와 결정 방식'
  }
};

export const LANG_NAMES = {
  en: 'English',
  ja: 'Japanese',
  es: 'Spanish',
  th: 'Thai',
  ko: 'Korean'
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
  th: "นั่นคือทุกอย่างที่ต้องรู้ตอนนี้\n\nตอนนี้เห็นภาพชัดขึ้นมากว่าคุณอยู่ตรงไหนและกำลังมุ่งไปที่ไหน\n\nพื้นที่นี้เป็นของคุณแล้ว — ใช้ยังไงก็ได้ที่รู้สึกดี",
  ko: "지금 필요한 건 다 알았어요.\n\n지금 어디에 있고 무엇을 향해 가고 있는지 훨씬 명확해졌어요.\n\n이제 이 공간은 당신의 것 — 편한 방식으로 사용하세요."
};

export function getResumeMessage(lang, lastCategory) {
  const displayNames = CATEGORY_DISPLAY_NAMES[lang] || CATEGORY_DISPLAY_NAMES.en;
  const categoryName = displayNames[lastCategory] || lastCategory;
  const msgs = {
    en: `Welcome back. Last time we were talking about ${categoryName}.\n\nWould you like to continue, or start using the app now?`,
    ja: `おかえりなさい。前回は${categoryName}について話していました。\n\n続けますか？それともアプリを使い始めますか？`,
    es: `Bienvenido/a de vuelta. La última vez estábamos hablando de ${categoryName}.\n\n¿Te gustaría continuar, o empezar a usar la app ahora?`,
    th: `ยินดีต้อนรับกลับมา ครั้งล่าสุดเราคุยเรื่อง${categoryName}\n\nอยากคุยต่อ หรือเริ่มใช้แอปเลยดี?`,
    ko: `다시 오셨군요. 지난번에는 ${categoryName}에 대해 이야기하고 있었어요.\n\n계속하시겠어요, 아니면 지금 앱을 사용하시겠어요?`
  };
  return msgs[lang] || msgs.en;
}

export function buildFreeFlowingOnboardingPrompt(lang, totalExchangeCount) {
  const langName = LANG_NAMES[lang] || 'English';
  const isEarly = totalExchangeCount <= 3;
  const isLate = totalExchangeCount >= 9;

  return `You are Clarus — a calm, intelligent personal coach having a first real conversation with someone new.

Your goal is to genuinely get to know this person through natural conversation. Over the course of this chat, you want to understand:
- Who they are and what their daily life looks like
- What drives them and what they want to feel proud of
- Where they feel behind or self-conscious
- Their goals and where they want to be
- What holds them back or gets in their way
- What they are genuinely good at
- How they live and work day to day
- How they make decisions and what they want from this space

How to do this:
- Read the conversation history carefully before responding
- CRITICAL: Look at every question already asked in the history. NEVER ask the same question again, even rephrased
- Always respond to what they actually said first — acknowledge it genuinely before moving forward
- Then ask ONE natural follow-up question that either goes deeper into something new OR gently opens an area not yet covered
- If they don't want to answer something, that is completely fine — acknowledge it warmly and move to something else
- If they ask YOU a question or go off topic, answer naturally and briefly, then return to getting to know them
- Never ask more than one question at a time
- Never sound like a form, a survey, or a structured interview
- Move between topics naturally when the moment feels right${isLate ? '\n- You have covered a lot of ground. Begin wrapping up naturally — make your next question the last one before a warm close.' : ''}${isEarly ? '\n- The conversation has already started. Continue from where it left off — do NOT ask about anything already covered in the history above.' : ''}

Rules:
- Do NOT mention categories, topics, onboarding, or any structure
- Do NOT re-introduce yourself — you are already in the conversation
- Do NOT repeat or rephrase any question already in the conversation history
- Sound like a real person who is genuinely curious
- Keep responses under 80 words
- Respond entirely in ${langName}${lang === 'th' ? `

THAI VOCABULARY — ABSOLUTE RULES:
วันปกติ ✅ — NEVER วันธรรมชาติ ❌
ตามปกติ ✅ — NEVER ตามธรรมชาติ ❌
ชีวิตประจำวัน ✅ — NEVER ชีวิตธรรมชาติ ❌
ความรู้สึก ✅ — NEVER อารมณ์ภายใน ❌
ทำงาน ✅ — NEVER ประกอบอาชีพ ❌
คุย ✅ — NEVER สนทนา ❌
Always use ครับ — NEVER ค่ะ
Never use ผม or ฉัน as self-reference` : ''}`;
}

export function getNextCategory(currentCategory) {
  const idx = CATEGORY_ORDER.indexOf(currentCategory);
  if (idx === -1 || idx >= CATEGORY_ORDER.length - 1) return null;
  return CATEGORY_ORDER[idx + 1];
}

export function shouldCompleteOnboarding(totalExchangeCount) {
  return totalExchangeCount >= 12;
}

export function buildInitialQuestionPrompt(lang) {
  const langName = LANG_NAMES[lang] || 'English';
  return `You are Clarus, a calm, intelligent personal coach starting a first conversation with someone new.

Ask ONE warm, natural opening question about their daily life — what they do and what a typical day looks like for them.

Rules:
- Sound completely natural, like a real person asking a genuine question
- Do NOT sound like an intake form or questionnaire
- Do NOT introduce yourself again — just ask the question
- Keep it to 1-2 sentences maximum
- Respond entirely in ${langName}${lang === 'th' ? `

THAI VOCABULARY — ABSOLUTE RULES:
วันปกติ ✅ — NEVER วันธรรมชาติ ❌
ตามปกติ ✅ — NEVER ตามธรรมชาติ ❌
ชีวิตประจำวัน ✅ — NEVER ชีวิตธรรมชาติ ❌
ทำงาน ✅ — NEVER ประกอบอาชีพ ❌
Always use ครับ — NEVER ค่ะ
Never use ผม or ฉัน as self-reference` : ''}`;
}

export function getDefaultOnboardingProgress() {
  return {
    whoYouAre: false,
    whatDrivesYou: false,
    insecurities: false,
    goals: false,
    obstacles: false,
    resources: false,
    lifestyle: false,
    decisionMaking: false,
    lastCategoryDiscussed: null
  };
}
