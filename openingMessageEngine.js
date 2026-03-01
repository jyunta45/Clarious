// openingMessageEngine.js — COMPLETE FINAL VERSION

// ── FALLBACK POOL ─────────────────────────────

const fallbackOpenings = [
  {
    text: `What's been taking most of your attention lately?`,
    type: "fallback",
    chips: [
      "Something at work",
      "A personal situation",
      "A decision I'm sitting on",
      "Just thinking out loud"
    ]
  },
  {
    text: `What's on your mind today?`,
    type: "fallback",
    chips: [
      "Something specific",
      "General check-in",
      "I want to think something through",
      "Not sure yet"
    ]
  },
  {
    text: `What would make today feel worthwhile?`,
    type: "fallback",
    chips: [
      "One clear win",
      "Getting unstuck on something",
      "Some clarity",
      "Just showing up"
    ]
  },
  {
    text: `Where are you starting from today?`,
    type: "fallback",
    chips: [
      "Good place",
      "Bit off track",
      "Uncertain",
      "Ready to move"
    ]
  }
];

function buildFallbackOpening(lastMessage) {
  const available = fallbackOpenings.filter(
    f => f.text !== lastMessage
  );
  const index =
    Math.floor(Date.now() / 86400000) % available.length;
  return available[index];
}

// ── GUIDANCE MESSAGES (Day 1-8) ───────────────

const guidanceMessages = {
  1: {
    text: `This is your thinking space.\n\nNo right answers. No performance.\n\nWhat's one thing on your mind right now — big or small?`,
    chips: [
      "Something at work",
      "A personal decision",
      "How I'm feeling",
      "Just thinking out loud"
    ]
  },
  2: {
    text: `You've started using this space.\n\nNow the habit builds.\n\nWhat's the one move that matters most today?`,
    chips: [
      "My top priority today",
      "Something I keep avoiding",
      "A goal I'm working on",
      "Not sure yet"
    ]
  },
  3: {
    text: `You're building a habit of checking in.\n\nThat alone is more than most people do.\n\nWhat's feeling clearer — and what still feels foggy?`,
    chips: [
      "Starting to get clearer on something",
      "Still foggy about something",
      "Both honestly",
      "Let's explore it"
    ]
  },
  4: {
    text: `Four days in.\n\nI've been paying attention.\n\nWhat pattern are you starting to notice about yourself?`,
    chips: [
      "I notice I keep...",
      "I tend to avoid...",
      "I'm strongest when...",
      "I'm not sure yet"
    ]
  },
  5: {
    text: `You've been showing up consistently.\n\nConsistency is data.\n\nWhat does it tell you about what actually matters to you?`,
    chips: [
      "What I keep coming back to",
      "What I actually care about",
      "What's been distracting me",
      "Something shifted"
    ]
  },
  6: {
    text: `One more day before this space becomes fully yours.\n\nWhat's one thing you'd want to revisit from this week?`,
    chips: [
      "A conversation worth revisiting",
      "Something unresolved",
      "A win I didn't acknowledge",
      "Something I learned"
    ]
  },
  7: {
    text: `Seven days.\n\nYou know how this works now.\n\nWhat do you want to use this space for today?`,
    chips: [
      "Something I want to work on",
      "A decision I'm facing",
      "How I'm feeling today",
      "Let's just talk"
    ]
  },
  8: {
    text: `You don't need guided prompts anymore.\n\nYou've built a real thinking habit here.\n\nThis space now adapts fully to you.\n\nWhat's on your mind today?`,
    chips: [
      "Something I want to explore",
      "A decision I'm sitting on",
      "How I'm feeling today",
      "Let's just talk"
    ]
  }
};

// ── PUBLIC WRAPPER ────────────────────────────

export function buildOpeningMessage(params) {
  try {
    const opening = _buildOpeningMessage(params);

    if (opening.text === params.userData?.lastOpeningMessage) {
      return buildFallbackOpening(
        params.userData?.lastOpeningMessage
      );
    }

    return opening;
  } catch (error) {
    return buildFallbackOpening(
      params?.userData?.lastOpeningMessage
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
  userData
}) {
  const now = new Date();
  const hour = now.getHours();
  const daysAway = lastActiveAt
    ? (Date.now() - new Date(lastActiveAt)) / 86400000
    : 0;
  const isMorning = hour >= 5 && hour <= 11;

  if (daysAway >= 2) {
    const days = Math.floor(daysAway);
    if (sessionSummary?.focus) {
      return {
        text: `You've been away for ${days} day${days > 1 ? 's' : ''}.\n\nLast time you were working on ${sessionSummary.focus}.\n\nWhere does that stand now?`,
        type: "returning",
        chips: [
          "Catch you up on what happened",
          "I need to get back on track",
          "Something changed",
          "Let's review my direction"
        ]
      };
    }
    return {
      text: `You've been away for ${days} day${days > 1 ? 's' : ''}.\n\nWhat's been taking your attention?`,
      type: "returning",
      chips: [
        "A lot happened",
        "I need to reset",
        "Something changed for me",
        "Just checking back in"
      ]
    };
  }

  if (guidanceDay >= 1 && guidanceDay <= 7) {
    const message = guidanceMessages[guidanceDay];
    return {
      text: message.text,
      type: "guidance",
      day: guidanceDay,
      chips: message.chips
    };
  }

  if (guidanceDay === 8) {
    return {
      text: guidanceMessages[8].text,
      type: "transition",
      chips: guidanceMessages[8].chips
    };
  }

  const userEstablished = userMemory?.goals?.length > 0;
  const missedHabit = userEstablished &&
    habits?.find(h =>
      h.completedYesterday === false &&
      h.streak > 2
    );

  if (missedHabit) {
    return {
      text: `You missed "${missedHabit.name}" yesterday.\n\nNot a judgment — what got in the way?`,
      type: "habit",
      chips: [
        "Reset momentum today",
        "Let's figure out what happened",
        "Adjust the habit",
        "Something else came up"
      ]
    };
  }

  if (hour >= 0 && hour < 5) {
    return {
      text: `You're up late.\n\nWhat's on your mind?`,
      type: "latenight",
      chips: [
        "Can't sleep — something's on my mind",
        "Working late on something",
        "Just needed to talk",
        "Help me wind down"
      ]
    };
  }

  if (isMorning) {
    const focus = userMemory?.goals?.slice(-1)[0] || null;
    return {
      text: focus
        ? `Morning. You're working toward ${focus}.\n\nWhat's today's move?`
        : `What matters most to move forward today?`,
      type: "morning",
      chips: [
        "Help me plan today",
        "I'm struggling with something",
        "Accountability check",
        "Just talk"
      ]
    };
  }

  if (hour >= 12 && hour <= 17) {
    return {
      text: `How is today tracking compared to what you intended?`,
      type: "afternoon",
      chips: [
        "I'm behind on something",
        "Need to refocus",
        "Decision I'm sitting on",
        "Check in on my habits"
      ]
    };
  }

  return {
    text: `What's one thing that moved forward today —\nand one thing worth carrying into tomorrow?`,
    type: "evening",
    chips: [
      "Review my day",
      "Something's bothering me",
      "Tomorrow's intention",
      "What patterns do you see?"
    ]
  };
}

export { buildFallbackOpening };
