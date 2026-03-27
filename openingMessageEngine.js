// openingMessageEngine.js — COMPLETE FINAL VERSION WITH i18n

// ── TRANSLATIONS ─────────────────────────────

const T = {
  fallback: {
    en: [
      { text: "What's been taking most of your attention lately?", chips: ["Something at work", "A personal situation", "A decision I'm sitting on", "Just thinking out loud"] },
      { text: "What's on your mind today?", chips: ["Something specific", "General check-in", "I want to think something through", "Not sure yet"] },
      { text: "What would make today feel worthwhile?", chips: ["One clear win", "Getting unstuck on something", "Some clarity", "Just showing up"] },
      { text: "Where are you starting from today?", chips: ["Good place", "Bit off track", "Uncertain", "Ready to move"] }
    ],
    th: [
      { text: "ช่วงนี้มีอะไรที่ดึงความสนใจคุณมากที่สุด?", chips: ["เรื่องงาน", "เรื่องส่วนตัว", "การตัดสินใจที่ยังค้างอยู่", "แค่คิดเล่นๆ"] },
      { text: "วันนี้มีอะไรอยู่ในใจ?", chips: ["เรื่องเฉพาะเจาะจง", "เช็คอินทั่วไป", "อยากคิดเรื่องหนึ่งให้ลึก", "ยังไม่แน่ใจ"] },
      { text: "อะไรจะทำให้วันนี้รู้สึกคุ้มค่า?", chips: ["ชัยชนะเล็กๆ หนึ่งอย่าง", "ปลดล็อคบางอย่าง", "ความชัดเจนสักนิด", "แค่มาถึงก็ดีแล้ว"] },
      { text: "วันนี้คุณเริ่มต้นจากจุดไหน?", chips: ["จุดที่ดี", "หลุดทางนิดหน่อย", "ไม่แน่ใจ", "พร้อมเดินหน้า"] }
    ],
  },

  guidance: {
    en: {
      1: { text: "This space is yours now.\n\nWhenever something's on your mind — a question, a problem, something you want to think through — just say it.\n\nClarious is here.", chips: ["I have something to share", "I have a question", "Want to think something through", "Just looking around"] },
      2: { text: "You've started using this space.\n\nNow the habit builds.\n\nWhat's the one move that matters most today?", chips: ["My top priority today", "Something I keep avoiding", "A goal I'm working on", "Not sure yet"] },
      3: { text: "You're building a habit of checking in.\n\nThat alone is more than most people do.\n\nWhat's feeling clearer — and what still feels foggy?", chips: ["Starting to get clearer on something", "Still foggy about something", "Both honestly", "Let's explore it"] },
      4: { text: "Four days in.\n\nI've been paying attention.\n\nWhat pattern are you starting to notice about yourself?", chips: ["I notice I keep...", "I tend to avoid...", "I'm strongest when...", "I'm not sure yet"] },
      5: { text: "You've been showing up consistently.\n\nConsistency is data.\n\nWhat does it tell you about what actually matters to you?", chips: ["What I keep coming back to", "What I actually care about", "What's been distracting me", "Something shifted"] },
      6: { text: "One more day before this space becomes fully yours.\n\nWhat's one thing you'd want to revisit from this week?", chips: ["A conversation worth revisiting", "Something unresolved", "A win I didn't acknowledge", "Something I learned"] },
      7: { text: "Seven days.\n\nYou know how this works now.\n\nWhat do you want to use this space for today?", chips: ["Something I want to work on", "A decision I'm facing", "How I'm feeling today", "Let's just talk"] },
      8: { text: "You don't need guided prompts anymore.\n\nYou've built a real thinking habit here.\n\nThis space now adapts fully to you.\n\nWhat's on your mind today?", chips: ["Something I want to explore", "A decision I'm sitting on", "How I'm feeling today", "Let's just talk"] }
    },
    th: {
      1: { text: "พื้นที่นี้เป็นของคุณแล้วครับ\n\nมีอะไรอยากถามหรืออยากแชร์ บอกได้เลย\n\nClarious คอยอยู่ตรงนี้เสมอครับ", chips: ["มีเรื่องอยากเล่า", "มีคำถาม", "อยากคิดอะไรสักอย่าง", "แค่แวะมา"] },
      2: { text: "คุณเริ่มใช้พื้นที่นี้แล้ว\n\nนิสัยกำลังก่อตัว\n\nวันนี้สิ่งที่สำคัญที่สุดที่ต้องทำคืออะไร?", chips: ["สิ่งสำคัญที่สุดวันนี้", "สิ่งที่หลีกเลี่ยงมาตลอด", "เป้าหมายที่กำลังทำอยู่", "ยังไม่แน่ใจ"] },
      3: { text: "คุณกำลังสร้างนิสัยการเช็คอิน\n\nแค่นั้นก็มากกว่าที่คนส่วนใหญ่ทำแล้ว\n\nอะไรเริ่มชัดขึ้น — และอะไรยังมัว?", chips: ["บางอย่างเริ่มชัดขึ้น", "ยังมัวอยู่เรื่องหนึ่ง", "ทั้งสองอย่างเลย", "ลองสำรวจดู"] },
      4: { text: "สี่วันแล้ว\n\nผมสังเกตมาตลอด\n\nคุณเริ่มเห็นรูปแบบอะไรของตัวเองบ้าง?", chips: ["สังเกตว่าตัวเองชอบ...", "มักจะหลีกเลี่ยง...", "แข็งแกร่งที่สุดตอน...", "ยังไม่แน่ใจ"] },
      5: { text: "คุณมาอย่างสม่ำเสมอ\n\nความสม่ำเสมอคือข้อมูล\n\nมันบอกอะไรเกี่ยวกับสิ่งที่สำคัญจริงๆ สำหรับคุณ?", chips: ["สิ่งที่กลับมาคิดถึงเสมอ", "สิ่งที่ใส่ใจจริงๆ", "สิ่งที่ทำให้เสียสมาธิ", "มีอะไรเปลี่ยนไป"] },
      6: { text: "อีกหนึ่งวัน พื้นที่นี้จะเป็นของคุณเต็มที่\n\nมีอะไรจากสัปดาห์นี้ที่อยากกลับมาทบทวน?", chips: ["บทสนทนาที่ควรทบทวน", "เรื่องที่ยังไม่จบ", "ชัยชนะที่ยังไม่ได้ยอมรับ", "สิ่งที่เรียนรู้"] },
      7: { text: "เจ็ดวัน\n\nคุณรู้วิธีใช้พื้นที่นี้แล้ว\n\nวันนี้อยากใช้ทำอะไร?", chips: ["สิ่งที่อยากทำ", "การตัดสินใจที่กำลังเผชิญ", "ความรู้สึกวันนี้", "แค่อยากคุย"] },
      8: { text: "คุณไม่ต้องการคำแนะนำนำทางอีกต่อไป\n\nคุณสร้างนิสัยการคิดที่แท้จริงขึ้นมาแล้ว\n\nพื้นที่นี้ปรับตัวตามคุณเต็มที่แล้ว\n\nวันนี้มีอะไรอยู่ในใจ?", chips: ["สิ่งที่อยากสำรวจ", "การตัดสินใจที่ยังค้าง", "ความรู้สึกวันนี้", "แค่อยากคุย"] }
    },
  },

  returning: {
    en: {
      withFocus: (days, focus) => ({ text: `You've been away for ${days} day${days > 1 ? 's' : ''}.\n\nLast time you were working on ${focus}.\n\nWhere does that stand now?`, chips: ["Catch you up on what happened", "I need to get back on track", "Something changed", "Let's review my direction"] }),
      generic: (days) => ({ text: `You've been away for ${days} day${days > 1 ? 's' : ''}.\n\nWhat's been taking your attention?`, chips: ["A lot happened", "I need to reset", "Something changed for me", "Just checking back in"] })
    },
    th: {
      withFocus: (days, focus) => ({ text: `คุณหายไป ${days} วัน\n\nครั้งล่าสุดคุณกำลังทำเรื่อง${focus}\n\nตอนนี้เป็นยังไงบ้าง?`, chips: ["เล่าให้ฟังว่าเกิดอะไรขึ้น", "ต้องกลับเข้าทาง", "มีอะไรเปลี่ยนไป", "มาทบทวนทิศทาง"] }),
      generic: (days) => ({ text: `คุณหายไป ${days} วัน\n\nช่วงนี้มีอะไรดึงความสนใจไป?`, chips: ["เกิดเรื่องเยอะ", "ต้องรีเซ็ต", "มีอะไรเปลี่ยนไป", "แค่กลับมาเช็คอิน"] })
    },
  },

  habit: {
    en: (name) => ({ text: `You missed "${name}" yesterday.\n\nNot a judgment — what got in the way?`, chips: ["Reset momentum today", "Let's figure out what happened", "Adjust the habit", "Something else came up"] }),
    th: (name) => ({ text: `เมื่อวานคุณพลาด "${name}"\n\nไม่ได้ตัดสิน — มีอะไรมาขวาง?`, chips: ["เริ่มใหม่วันนี้", "มาดูกันว่าเกิดอะไรขึ้น", "ปรับนิสัย", "มีเรื่องอื่นเข้ามา"] }),
  },

  latenight: {
    en: { text: "You're up late.\n\nWhat's on your mind?", chips: ["Can't sleep — something's on my mind", "Working late on something", "Just needed to talk", "Help me wind down"] },
    th: { text: "ดึกแล้วนะ\n\nมีอะไรอยู่ในใจ?", chips: ["นอนไม่หลับ — มีเรื่องค้างใจ", "ทำงานดึก", "แค่อยากคุย", "ช่วยให้ผ่อนคลายหน่อย"] },
  },

  morning: {
    en: {
      withGoal: (goal) => ({ text: `Morning. You're working toward ${goal}.\n\nWhat's today's move?`, chips: ["Help me plan today", "I'm struggling with something", "Accountability check", "Just talk"] }),
      generic: { text: "What matters most to move forward today?", chips: ["Help me plan today", "I'm struggling with something", "Accountability check", "Just talk"] }
    },
    th: {
      withGoal: (goal) => ({ text: `สวัสดีตอนเช้า คุณกำลังมุ่งไปที่${goal}\n\nวันนี้จะทำอะไร?`, chips: ["ช่วยวางแผนวันนี้", "กำลังมีปัญหาบางอย่าง", "เช็คความก้าวหน้า", "แค่อยากคุย"] }),
      generic: { text: "วันนี้สิ่งที่สำคัญที่สุดเพื่อก้าวไปข้างหน้าคืออะไร?", chips: ["ช่วยวางแผนวันนี้", "กำลังมีปัญหาบางอย่าง", "เช็คความก้าวหน้า", "แค่อยากคุย"] }
    },
  },

  afternoon: {
    en: { text: "How is today tracking compared to what you intended?", chips: ["I'm behind on something", "Need to refocus", "Decision I'm sitting on", "Check in on my habits"] },
    th: { text: "วันนี้เป็นไปตามที่ตั้งใจไว้ไหม?", chips: ["ล่าช้ากว่ากำหนด", "ต้องโฟกัสใหม่", "มีการตัดสินใจค้างอยู่", "เช็คนิสัยประจำวัน"] },
  },

  evening: {
    en: { text: "What's one thing that moved forward today —\nand one thing worth carrying into tomorrow?", chips: ["Review my day", "Something's bothering me", "Tomorrow's intention", "What patterns do you see?"] },
    th: { text: "วันนี้อะไรก้าวหน้าไปบ้าง —\nและอะไรที่ควรพาไปต่อพรุ่งนี้?", chips: ["ทบทวนวันนี้", "มีเรื่องรบกวนใจ", "ตั้งใจสำหรับพรุ่งนี้", "เห็นรูปแบบอะไรบ้าง?"] },
  }
};

// ── FALLBACK POOL ─────────────────────────────

function buildFallbackOpening(lastMessage, lang) {
  const pool = T.fallback[lang] || T.fallback.en;
  const available = pool.filter(f => f.text !== lastMessage);
  const index = Math.floor(Date.now() / 86400000) % available.length;
  const chosen = available[index];
  return { ...chosen, type: "fallback" };
}

// ── PUBLIC WRAPPER ────────────────────────────

export function buildOpeningMessage(params) {
  try {
    const lang = params.lang || 'en';
    const opening = _buildOpeningMessage(params);

    if (opening.text === params.userData?.lastOpeningMessage) {
      return buildFallbackOpening(
        params.userData?.lastOpeningMessage,
        lang
      );
    }

    return opening;
  } catch (error) {
    return buildFallbackOpening(
      params?.userData?.lastOpeningMessage,
      params?.lang || 'en'
    );
  }
}

// ── PRIVATE BUILDER ───────────────────────────

function _buildOpeningMessage({
  userMemory,
  sessionSummary,
  habits,
  lastActiveAt,
  guidanceDay,
  lang,
  userData,
  openLoops,
  mode,
  localHour,
  name
}) {
  const L = lang || 'en';
  const now = new Date();
  const hour = (localHour !== undefined && localHour >= 0 && localHour <= 23) ? localHour : now.getHours();
  const daysAway = lastActiveAt
    ? (Date.now() - new Date(lastActiveAt)) / 86400000
    : 0;
  const isMorning = hour >= 5 && hour <= 11;
  const isDaily = mode === "daily";

  // Day 1 (just finished onboarding) — open invitation regardless of mode or time
  if (guidanceDay === 1) {
    const gLang = T.guidance[L] || T.guidance.en;
    const message = gLang[1];
    let text = message.text;
    if (name) {
      // Inject name into the opening line
      if (L === 'th') {
        text = text.replace('พื้นที่นี้เป็นของคุณแล้วครับ', `พื้นที่นี้เป็นของคุณแล้วครับ ${name}`);
      } else {
        text = text.replace('This space is yours now.', `This space is yours now, ${name}.`);
      }
    }
    return { text, type: "guidance", day: 1, chips: message.chips };
  }

  if (isDaily) {
    if (hour >= 0 && hour < 5) {
      const ln = T.latenight[L] || T.latenight.en;
      return { ...ln, type: "latenight" };
    }
    if (isMorning) {
      const m = T.morning[L] || T.morning.en;
      return { ...m.generic, type: "morning" };
    }
    if (hour >= 12 && hour <= 17) {
      const a = T.afternoon[L] || T.afternoon.en;
      return { ...a, type: "afternoon" };
    }
    const e = T.evening[L] || T.evening.en;
    return { ...e, type: "evening" };
  }

  if (daysAway >= 2) {
    const days = Math.floor(daysAway);
    const ret = T.returning[L] || T.returning.en;
    let msg = sessionSummary?.focus
      ? ret.withFocus(days, sessionSummary.focus)
      : ret.generic(days);
    if (name) {
      const greet = L === 'th'
        ? `สวัสดีครับ ${name}\n\n`
        : `Good to have you back, ${name}.\n\n`;
      msg = { ...msg, text: greet + msg.text };
    }
    return { ...msg, type: "returning" };
  }

  if (guidanceDay >= 1 && guidanceDay <= 7) {
    const gLang = T.guidance[L] || T.guidance.en;
    const message = gLang[guidanceDay];
    return {
      text: message.text,
      type: "guidance",
      day: guidanceDay,
      chips: message.chips
    };
  }

  if (guidanceDay === 8) {
    const gLang = T.guidance[L] || T.guidance.en;
    return {
      text: gLang[8].text,
      type: "transition",
      chips: gLang[8].chips
    };
  }

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const shouldReferenceLoop = Math.random() < 0.20;
  const activeLoop = openLoops?.find(loop =>
    loop.resolved === false &&
    (Date.now() - loop.createdAt) < thirtyDays
  );

  if (shouldReferenceLoop && activeLoop && activeLoop.content && isMorning) {
    const loopTexts = {
      en: { prefix: "You were thinking about", suffix: "recently.\n\nHas anything shifted on that?", chips: ["Still unresolved", "Something changed", "I made a decision", "Not ready to talk about it"] },
      th: { prefix: "เมื่อเร็วๆ นี้คุณกำลังคิดเรื่อง", suffix: "\n\nมีอะไรเปลี่ยนไปบ้าง?", chips: ["ยังไม่ได้แก้", "มีอะไรเปลี่ยน", "ตัดสินใจแล้ว", "ยังไม่พร้อมพูดเรื่องนี้"] },
    };
    const lt = loopTexts[L] || loopTexts.en;
    return {
      text: `${lt.prefix} ${activeLoop.content} ${lt.suffix}`,
      type: "open_loop",
      chips: lt.chips
    };
  }

  const userEstablished = userMemory?.goals?.length > 0;
  const missedHabit = userEstablished &&
    habits?.find(h =>
      h.completedYesterday === false &&
      h.streak > 2
    );

  if (missedHabit) {
    const habitFn = T.habit[L] || T.habit.en;
    const msg = habitFn(missedHabit.name);
    return { ...msg, type: "habit" };
  }

  if (hour >= 0 && hour < 5) {
    const ln = T.latenight[L] || T.latenight.en;
    return { ...ln, type: "latenight" };
  }

  if (isMorning) {
    const m = T.morning[L] || T.morning.en;
    const focus = userMemory?.goals?.slice(-1)[0] || null;
    if (focus) {
      const msg = m.withGoal(focus);
      return { ...msg, type: "morning" };
    }
    return { ...m.generic, type: "morning" };
  }

  if (hour >= 12 && hour <= 17) {
    const a = T.afternoon[L] || T.afternoon.en;
    return { ...a, type: "afternoon" };
  }

  const e = T.evening[L] || T.evening.en;
  return { ...e, type: "evening" };
}

export { buildFallbackOpening };
