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
    ja: [
      { text: "最近、一番気になっていることは何ですか？", chips: ["仕事のこと", "個人的なこと", "迷っている決断", "なんとなく考えていること"] },
      { text: "今日、何が頭にありますか？", chips: ["具体的なこと", "全体的な振り返り", "じっくり考えたいこと", "まだわからない"] },
      { text: "今日を充実させるために何が必要ですか？", chips: ["ひとつの成果", "行き詰まりの解消", "少しの明確さ", "まずは来てみた"] },
      { text: "今日はどんな状態からスタートしますか？", chips: ["いい感じ", "少しずれている", "不確か", "動く準備はできている"] }
    ],
    es: [
      { text: "¿Qué ha estado ocupando más tu atención últimamente?", chips: ["Algo del trabajo", "Una situación personal", "Una decisión pendiente", "Solo pensando en voz alta"] },
      { text: "¿Qué tienes en mente hoy?", chips: ["Algo específico", "Revisión general", "Quiero pensar algo a fondo", "No estoy seguro/a"] },
      { text: "¿Qué haría que hoy valiera la pena?", chips: ["Un logro claro", "Desbloquear algo", "Algo de claridad", "Solo estar presente"] },
      { text: "¿Desde dónde empiezas hoy?", chips: ["Buen lugar", "Un poco desviado/a", "Incierto/a", "Listo/a para avanzar"] }
    ],
    th: [
      { text: "ช่วงนี้มีอะไรที่ดึงความสนใจคุณมากที่สุด?", chips: ["เรื่องงาน", "เรื่องส่วนตัว", "การตัดสินใจที่ยังค้างอยู่", "แค่คิดเล่นๆ"] },
      { text: "วันนี้มีอะไรอยู่ในใจ?", chips: ["เรื่องเฉพาะเจาะจง", "เช็คอินทั่วไป", "อยากคิดเรื่องหนึ่งให้ลึก", "ยังไม่แน่ใจ"] },
      { text: "อะไรจะทำให้วันนี้รู้สึกคุ้มค่า?", chips: ["ชัยชนะเล็กๆ หนึ่งอย่าง", "ปลดล็อคบางอย่าง", "ความชัดเจนสักนิด", "แค่มาถึงก็ดีแล้ว"] },
      { text: "วันนี้คุณเริ่มต้นจากจุดไหน?", chips: ["จุดที่ดี", "หลุดทางนิดหน่อย", "ไม่แน่ใจ", "พร้อมเดินหน้า"] }
    ],
    ko: [
      { text: "요즘 가장 신경 쓰이는 게 뭐예요?", chips: ["일 관련", "개인적인 상황", "결정을 못 내리고 있는 것", "그냥 생각 정리"] },
      { text: "오늘 머릿속에 뭐가 있어요?", chips: ["구체적인 것", "전반적인 점검", "깊이 생각해보고 싶은 것", "아직 잘 모르겠어요"] },
      { text: "오늘을 보람차게 만들려면 뭐가 필요할까요?", chips: ["확실한 성과 하나", "막힌 것 해소", "약간의 명확함", "일단 와본 것만으로도"] },
      { text: "오늘은 어떤 상태에서 시작하나요?", chips: ["좋은 상태", "좀 벗어난 느낌", "불확실해요", "움직일 준비 됐어요"] }
    ]
  },

  guidance: {
    en: {
      1: { text: "This is your thinking space.\n\nNo right answers. No performance.\n\nWhat's one thing on your mind right now — big or small?", chips: ["Something at work", "A personal decision", "How I'm feeling", "Just thinking out loud"] },
      2: { text: "You've started using this space.\n\nNow the habit builds.\n\nWhat's the one move that matters most today?", chips: ["My top priority today", "Something I keep avoiding", "A goal I'm working on", "Not sure yet"] },
      3: { text: "You're building a habit of checking in.\n\nThat alone is more than most people do.\n\nWhat's feeling clearer — and what still feels foggy?", chips: ["Starting to get clearer on something", "Still foggy about something", "Both honestly", "Let's explore it"] },
      4: { text: "Four days in.\n\nI've been paying attention.\n\nWhat pattern are you starting to notice about yourself?", chips: ["I notice I keep...", "I tend to avoid...", "I'm strongest when...", "I'm not sure yet"] },
      5: { text: "You've been showing up consistently.\n\nConsistency is data.\n\nWhat does it tell you about what actually matters to you?", chips: ["What I keep coming back to", "What I actually care about", "What's been distracting me", "Something shifted"] },
      6: { text: "One more day before this space becomes fully yours.\n\nWhat's one thing you'd want to revisit from this week?", chips: ["A conversation worth revisiting", "Something unresolved", "A win I didn't acknowledge", "Something I learned"] },
      7: { text: "Seven days.\n\nYou know how this works now.\n\nWhat do you want to use this space for today?", chips: ["Something I want to work on", "A decision I'm facing", "How I'm feeling today", "Let's just talk"] },
      8: { text: "You don't need guided prompts anymore.\n\nYou've built a real thinking habit here.\n\nThis space now adapts fully to you.\n\nWhat's on your mind today?", chips: ["Something I want to explore", "A decision I'm sitting on", "How I'm feeling today", "Let's just talk"] }
    },
    ja: {
      1: { text: "ここはあなたの思考スペースです。\n\n正解も、評価もありません。\n\n今、頭にあることをひとつ — 大きくても小さくても。", chips: ["仕事のこと", "個人的な決断", "今の気持ち", "なんとなく考えていること"] },
      2: { text: "このスペースを使い始めましたね。\n\nここから習慣が生まれます。\n\n今日一番大事な一手は何ですか？", chips: ["今日の最優先事項", "ずっと避けていること", "取り組んでいる目標", "まだわからない"] },
      3: { text: "チェックインの習慣ができてきています。\n\nそれだけで多くの人よりも先を行っています。\n\n何が明確になってきて、何がまだ曖昧ですか？", chips: ["何かが明確になってきた", "まだ曖昧なことがある", "正直、両方", "一緒に探ってみたい"] },
      4: { text: "4日目。\n\n私はずっと注意を払っています。\n\n自分自身について気づき始めたパターンはありますか？", chips: ["繰り返していることがある...", "避けがちなことがある...", "こういう時が一番強い...", "まだわからない"] },
      5: { text: "一貫して来てくれていますね。\n\n一貫性はデータです。\n\nそれはあなたにとって本当に大切なことについて何を教えていますか？", chips: ["繰り返し戻ってくるもの", "本当に大切にしていること", "気を散らされていたもの", "何かが変わった"] },
      6: { text: "あと1日で、このスペースは完全にあなたのものになります。\n\n今週から振り返りたいことはひとつありますか？", chips: ["振り返る価値のある会話", "未解決のこと", "認めていなかった成果", "学んだこと"] },
      7: { text: "7日間。\n\n使い方はもうわかっていますね。\n\n今日、このスペースを何に使いたいですか？", chips: ["取り組みたいこと", "直面している決断", "今日の気持ち", "ただ話したい"] },
      8: { text: "もうガイド付きのプロンプトは必要ありません。\n\n本物の思考習慣がここに生まれました。\n\nこのスペースは完全にあなたに適応します。\n\n今日、何が頭にありますか？", chips: ["探求したいこと", "迷っている決断", "今日の気持ち", "ただ話したい"] }
    },
    es: {
      1: { text: "Este es tu espacio para pensar.\n\nSin respuestas correctas. Sin presiones.\n\n¿Qué tienes en mente ahora mismo — grande o pequeño?", chips: ["Algo del trabajo", "Una decisión personal", "Cómo me siento", "Solo pensando en voz alta"] },
      2: { text: "Has empezado a usar este espacio.\n\nAhora el hábito se construye.\n\n¿Cuál es el movimiento más importante hoy?", chips: ["Mi prioridad de hoy", "Algo que sigo evitando", "Un objetivo en el que trabajo", "No estoy seguro/a"] },
      3: { text: "Estás creando el hábito de hacer check-in.\n\nEso solo ya es más de lo que hace la mayoría.\n\n¿Qué se siente más claro — y qué sigue borroso?", chips: ["Algo empieza a aclararse", "Algo sigue borroso", "Ambos, honestamente", "Explorémoslo"] },
      4: { text: "Cuatro días.\n\nHe estado prestando atención.\n\n¿Qué patrón empiezas a notar sobre ti mismo/a?", chips: ["Noto que sigo...", "Tiendo a evitar...", "Soy más fuerte cuando...", "Aún no estoy seguro/a"] },
      5: { text: "Has sido constante.\n\nLa constancia es información.\n\n¿Qué te dice sobre lo que realmente te importa?", chips: ["A lo que sigo volviendo", "Lo que realmente me importa", "Lo que me ha distraído", "Algo cambió"] },
      6: { text: "Un día más antes de que este espacio sea completamente tuyo.\n\n¿Hay algo de esta semana que quieras revisar?", chips: ["Una conversación que vale la pena revisar", "Algo sin resolver", "Un logro que no reconocí", "Algo que aprendí"] },
      7: { text: "Siete días.\n\nYa sabes cómo funciona esto.\n\n¿Para qué quieres usar este espacio hoy?", chips: ["Algo en lo que quiero trabajar", "Una decisión que enfrento", "Cómo me siento hoy", "Solo hablemos"] },
      8: { text: "Ya no necesitas indicaciones guiadas.\n\nHas construido un verdadero hábito de reflexión aquí.\n\nEste espacio ahora se adapta completamente a ti.\n\n¿Qué tienes en mente hoy?", chips: ["Algo que quiero explorar", "Una decisión pendiente", "Cómo me siento hoy", "Solo hablemos"] }
    },
    th: {
      1: { text: "นี่คือพื้นที่คิดของคุณ\n\nไม่มีคำตอบที่ถูกหรือผิด ไม่มีการตัดสิน\n\nตอนนี้มีอะไรอยู่ในใจสักอย่าง — เล็กหรือใหญ่ก็ได้?", chips: ["เรื่องงาน", "การตัดสินใจส่วนตัว", "ความรู้สึกตอนนี้", "แค่คิดเล่นๆ"] },
      2: { text: "คุณเริ่มใช้พื้นที่นี้แล้ว\n\nนิสัยกำลังก่อตัว\n\nวันนี้สิ่งที่สำคัญที่สุดที่ต้องทำคืออะไร?", chips: ["สิ่งสำคัญที่สุดวันนี้", "สิ่งที่หลีกเลี่ยงมาตลอด", "เป้าหมายที่กำลังทำอยู่", "ยังไม่แน่ใจ"] },
      3: { text: "คุณกำลังสร้างนิสัยการเช็คอิน\n\nแค่นั้นก็มากกว่าที่คนส่วนใหญ่ทำแล้ว\n\nอะไรเริ่มชัดขึ้น — และอะไรยังมัว?", chips: ["บางอย่างเริ่มชัดขึ้น", "ยังมัวอยู่เรื่องหนึ่ง", "ทั้งสองอย่างเลย", "ลองสำรวจดู"] },
      4: { text: "สี่วันแล้ว\n\nผมสังเกตมาตลอด\n\nคุณเริ่มเห็นรูปแบบอะไรของตัวเองบ้าง?", chips: ["สังเกตว่าตัวเองชอบ...", "มักจะหลีกเลี่ยง...", "แข็งแกร่งที่สุดตอน...", "ยังไม่แน่ใจ"] },
      5: { text: "คุณมาอย่างสม่ำเสมอ\n\nความสม่ำเสมอคือข้อมูล\n\nมันบอกอะไรเกี่ยวกับสิ่งที่สำคัญจริงๆ สำหรับคุณ?", chips: ["สิ่งที่กลับมาคิดถึงเสมอ", "สิ่งที่ใส่ใจจริงๆ", "สิ่งที่ทำให้เสียสมาธิ", "มีอะไรเปลี่ยนไป"] },
      6: { text: "อีกหนึ่งวัน พื้นที่นี้จะเป็นของคุณเต็มที่\n\nมีอะไรจากสัปดาห์นี้ที่อยากกลับมาทบทวน?", chips: ["บทสนทนาที่ควรทบทวน", "เรื่องที่ยังไม่จบ", "ชัยชนะที่ยังไม่ได้ยอมรับ", "สิ่งที่เรียนรู้"] },
      7: { text: "เจ็ดวัน\n\nคุณรู้วิธีใช้พื้นที่นี้แล้ว\n\nวันนี้อยากใช้ทำอะไร?", chips: ["สิ่งที่อยากทำ", "การตัดสินใจที่กำลังเผชิญ", "ความรู้สึกวันนี้", "แค่อยากคุย"] },
      8: { text: "คุณไม่ต้องการคำแนะนำนำทางอีกต่อไป\n\nคุณสร้างนิสัยการคิดที่แท้จริงขึ้นมาแล้ว\n\nพื้นที่นี้ปรับตัวตามคุณเต็มที่แล้ว\n\nวันนี้มีอะไรอยู่ในใจ?", chips: ["สิ่งที่อยากสำรวจ", "การตัดสินใจที่ยังค้าง", "ความรู้สึกวันนี้", "แค่อยากคุย"] }
    },
    ko: {
      1: { text: "여기는 당신의 생각 공간입니다.\n\n정답도 없고, 평가도 없습니다.\n\n지금 머릿속에 있는 한 가지 — 크든 작든?", chips: ["일 관련", "개인적인 결정", "지금 기분", "그냥 생각 정리"] },
      2: { text: "이 공간을 사용하기 시작했군요.\n\n이제 습관이 만들어집니다.\n\n오늘 가장 중요한 한 가지는 뭘까요?", chips: ["오늘의 최우선 과제", "계속 미루고 있는 것", "작업 중인 목표", "아직 모르겠어요"] },
      3: { text: "체크인 습관을 만들어가고 있어요.\n\n그것만으로도 대부분의 사람보다 앞서 있습니다.\n\n뭐가 더 명확해지고 있고 — 뭐가 아직 흐릿한가요?", chips: ["뭔가 명확해지고 있어요", "아직 흐릿한 게 있어요", "솔직히 둘 다", "함께 탐색해봐요"] },
      4: { text: "4일째.\n\n저는 계속 관찰하고 있었어요.\n\n자신에 대해 어떤 패턴을 발견하기 시작했나요?", chips: ["반복하는 것이 있어요...", "피하는 경향이 있어요...", "이럴 때 가장 강해요...", "아직 잘 모르겠어요"] },
      5: { text: "꾸준히 와주고 있네요.\n\n꾸준함은 데이터입니다.\n\n그게 당신에게 정말 중요한 것에 대해 뭘 말해주나요?", chips: ["계속 돌아오는 것", "정말 신경 쓰는 것", "나를 산만하게 한 것", "뭔가 변했어요"] },
      6: { text: "하루만 더 지나면 이 공간은 완전히 당신의 것이 됩니다.\n\n이번 주에서 다시 돌아보고 싶은 것 하나가 있나요?", chips: ["다시 볼 가치가 있는 대화", "아직 해결 안 된 것", "인정하지 않은 성과", "배운 것"] },
      7: { text: "7일.\n\n이제 사용법을 알고 계시죠.\n\n오늘 이 공간을 뭐에 쓰고 싶으세요?", chips: ["작업하고 싶은 것", "마주한 결정", "오늘 기분", "그냥 대화해요"] },
      8: { text: "더 이상 가이드 프롬프트가 필요 없어요.\n\n진짜 생각하는 습관을 여기서 만들었습니다.\n\n이 공간은 이제 완전히 당신에게 맞춰집니다.\n\n오늘 뭐가 머릿속에 있나요?", chips: ["탐구하고 싶은 것", "결정을 못 내리고 있는 것", "오늘 기분", "그냥 대화해요"] }
    }
  },

  returning: {
    en: {
      withFocus: (days, focus) => ({ text: `You've been away for ${days} day${days > 1 ? 's' : ''}.\n\nLast time you were working on ${focus}.\n\nWhere does that stand now?`, chips: ["Catch you up on what happened", "I need to get back on track", "Something changed", "Let's review my direction"] }),
      generic: (days) => ({ text: `You've been away for ${days} day${days > 1 ? 's' : ''}.\n\nWhat's been taking your attention?`, chips: ["A lot happened", "I need to reset", "Something changed for me", "Just checking back in"] })
    },
    ja: {
      withFocus: (days, focus) => ({ text: `${days}日間離れていましたね。\n\n前回は${focus}に取り組んでいました。\n\n今はどうなっていますか？`, chips: ["何があったか伝えたい", "軌道に戻りたい", "何か変わった", "方向性を見直したい"] }),
      generic: (days) => ({ text: `${days}日間離れていましたね。\n\n何に注意を向けていましたか？`, chips: ["いろいろあった", "リセットしたい", "何か変わった", "ただ戻ってきた"] })
    },
    es: {
      withFocus: (days, focus) => ({ text: `Has estado ausente ${days} día${days > 1 ? 's' : ''}.\n\nLa última vez trabajabas en ${focus}.\n\n¿Cómo está eso ahora?`, chips: ["Te cuento qué pasó", "Necesito retomar el rumbo", "Algo cambió", "Revisemos mi dirección"] }),
      generic: (days) => ({ text: `Has estado ausente ${days} día${days > 1 ? 's' : ''}.\n\n¿Qué ha ocupado tu atención?`, chips: ["Pasaron muchas cosas", "Necesito reiniciar", "Algo cambió para mí", "Solo estoy volviendo"] })
    },
    th: {
      withFocus: (days, focus) => ({ text: `คุณหายไป ${days} วัน\n\nครั้งล่าสุดคุณกำลังทำเรื่อง${focus}\n\nตอนนี้เป็นยังไงบ้าง?`, chips: ["เล่าให้ฟังว่าเกิดอะไรขึ้น", "ต้องกลับเข้าทาง", "มีอะไรเปลี่ยนไป", "มาทบทวนทิศทาง"] }),
      generic: (days) => ({ text: `คุณหายไป ${days} วัน\n\nช่วงนี้มีอะไรดึงความสนใจไป?`, chips: ["เกิดเรื่องเยอะ", "ต้องรีเซ็ต", "มีอะไรเปลี่ยนไป", "แค่กลับมาเช็คอิน"] })
    },
    ko: {
      withFocus: (days, focus) => ({ text: `${days}일 동안 떠나 있었네요.\n\n지난번에는 ${focus}을/를 작업하고 있었어요.\n\n지금은 어떻게 됐나요?`, chips: ["무슨 일이 있었는지 알려줄게요", "다시 궤도에 올라야 해요", "뭔가 변했어요", "방향을 점검하고 싶어요"] }),
      generic: (days) => ({ text: `${days}일 동안 떠나 있었네요.\n\n무엇에 관심을 쏟고 있었나요?`, chips: ["많은 일이 있었어요", "리셋이 필요해요", "뭔가 변했어요", "그냥 돌아왔어요"] })
    }
  },

  habit: {
    en: (name) => ({ text: `You missed "${name}" yesterday.\n\nNot a judgment — what got in the way?`, chips: ["Reset momentum today", "Let's figure out what happened", "Adjust the habit", "Something else came up"] }),
    ja: (name) => ({ text: `昨日「${name}」ができませんでした。\n\n判断ではありません — 何が邪魔しましたか？`, chips: ["今日勢いを取り戻す", "何があったか考えよう", "習慣を調整する", "別のことがあった"] }),
    es: (name) => ({ text: `Ayer no completaste "${name}".\n\nNo es un juicio — ¿qué se interpuso?`, chips: ["Retomar el impulso hoy", "Veamos qué pasó", "Ajustar el hábito", "Surgió otra cosa"] }),
    th: (name) => ({ text: `เมื่อวานคุณพลาด "${name}"\n\nไม่ได้ตัดสิน — มีอะไรมาขวาง?`, chips: ["เริ่มใหม่วันนี้", "มาดูกันว่าเกิดอะไรขึ้น", "ปรับนิสัย", "มีเรื่องอื่นเข้ามา"] }),
    ko: (name) => ({ text: `어제 "${name}"을/를 못 했네요.\n\n판단이 아니에요 — 뭐가 방해했나요?`, chips: ["오늘 다시 시작", "무슨 일이 있었는지 알아보자", "습관 조정하기", "다른 일이 생겼어요"] })
  },

  latenight: {
    en: { text: "You're up late.\n\nWhat's on your mind?", chips: ["Can't sleep — something's on my mind", "Working late on something", "Just needed to talk", "Help me wind down"] },
    ja: { text: "夜遅くですね。\n\n何か気になることがありますか？", chips: ["眠れない — 何か気になる", "遅くまで作業中", "ただ話したかった", "落ち着かせてほしい"] },
    es: { text: "Estás despierto/a tarde.\n\n¿Qué tienes en mente?", chips: ["No puedo dormir — algo me preocupa", "Trabajando hasta tarde", "Solo necesitaba hablar", "Ayúdame a relajarme"] },
    th: { text: "ดึกแล้วนะ\n\nมีอะไรอยู่ในใจ?", chips: ["นอนไม่หลับ — มีเรื่องค้างใจ", "ทำงานดึก", "แค่อยากคุย", "ช่วยให้ผ่อนคลายหน่อย"] },
    ko: { text: "늦은 시간이네요.\n\n무슨 생각 하고 있어요?", chips: ["잠이 안 와요 — 생각이 있어서", "늦게까지 작업 중", "그냥 얘기하고 싶었어요", "마음 좀 편하게 해주세요"] }
  },

  morning: {
    en: {
      withGoal: (goal) => ({ text: `Morning. You're working toward ${goal}.\n\nWhat's today's move?`, chips: ["Help me plan today", "I'm struggling with something", "Accountability check", "Just talk"] }),
      generic: { text: "What matters most to move forward today?", chips: ["Help me plan today", "I'm struggling with something", "Accountability check", "Just talk"] }
    },
    ja: {
      withGoal: (goal) => ({ text: `おはようございます。${goal}に向かって進んでいますね。\n\n今日の一手は？`, chips: ["今日の計画を立てたい", "困っていることがある", "進捗確認", "ただ話したい"] }),
      generic: { text: "今日前に進むために一番大事なことは？", chips: ["今日の計画を立てたい", "困っていることがある", "進捗確認", "ただ話したい"] }
    },
    es: {
      withGoal: (goal) => ({ text: `Buenos días. Estás trabajando hacia ${goal}.\n\n¿Cuál es el movimiento de hoy?`, chips: ["Ayúdame a planificar hoy", "Estoy luchando con algo", "Revisión de progreso", "Solo hablar"] }),
      generic: { text: "¿Qué es lo más importante para avanzar hoy?", chips: ["Ayúdame a planificar hoy", "Estoy luchando con algo", "Revisión de progreso", "Solo hablar"] }
    },
    th: {
      withGoal: (goal) => ({ text: `สวัสดีตอนเช้า คุณกำลังมุ่งไปที่${goal}\n\nวันนี้จะทำอะไร?`, chips: ["ช่วยวางแผนวันนี้", "กำลังมีปัญหาบางอย่าง", "เช็คความก้าวหน้า", "แค่อยากคุย"] }),
      generic: { text: "วันนี้สิ่งที่สำคัญที่สุดเพื่อก้าวไปข้างหน้าคืออะไร?", chips: ["ช่วยวางแผนวันนี้", "กำลังมีปัญหาบางอย่าง", "เช็คความก้าวหน้า", "แค่อยากคุย"] }
    },
    ko: {
      withGoal: (goal) => ({ text: `좋은 아침이에요. ${goal}을/를 향해 나아가고 있죠.\n\n오늘의 한 수는?`, chips: ["오늘 계획 세우기", "어려운 게 있어요", "진행 상황 점검", "그냥 대화해요"] }),
      generic: { text: "오늘 앞으로 나아가기 위해 가장 중요한 건 뭘까요?", chips: ["오늘 계획 세우기", "어려운 게 있어요", "진행 상황 점검", "그냥 대화해요"] }
    }
  },

  afternoon: {
    en: { text: "How is today tracking compared to what you intended?", chips: ["I'm behind on something", "Need to refocus", "Decision I'm sitting on", "Check in on my habits"] },
    ja: { text: "今日の進み具合は、予定と比べてどうですか？", chips: ["何かで遅れている", "集中し直したい", "迷っている決断がある", "習慣をチェックしたい"] },
    es: { text: "¿Cómo va el día comparado con lo que planeaste?", chips: ["Voy atrasado/a en algo", "Necesito reenfocarme", "Una decisión pendiente", "Revisar mis hábitos"] },
    th: { text: "วันนี้เป็นไปตามที่ตั้งใจไว้ไหม?", chips: ["ล่าช้ากว่ากำหนด", "ต้องโฟกัสใหม่", "มีการตัดสินใจค้างอยู่", "เช็คนิสัยประจำวัน"] },
    ko: { text: "오늘은 계획대로 진행되고 있나요?", chips: ["뭔가 뒤처지고 있어요", "다시 집중해야 해요", "결정을 못 내리고 있어요", "습관 점검하기"] }
  },

  evening: {
    en: { text: "What's one thing that moved forward today —\nand one thing worth carrying into tomorrow?", chips: ["Review my day", "Something's bothering me", "Tomorrow's intention", "What patterns do you see?"] },
    ja: { text: "今日前に進んだことと、\n明日に持ち越す価値のあることは？", chips: ["今日を振り返る", "気になることがある", "明日の意図", "パターンは見えますか？"] },
    es: { text: "¿Qué avanzó hoy —\ny qué vale la pena llevar al mañana?", chips: ["Revisar mi día", "Algo me molesta", "Intención para mañana", "¿Qué patrones ves?"] },
    th: { text: "วันนี้อะไรก้าวหน้าไปบ้าง —\nและอะไรที่ควรพาไปต่อพรุ่งนี้?", chips: ["ทบทวนวันนี้", "มีเรื่องรบกวนใจ", "ตั้งใจสำหรับพรุ่งนี้", "เห็นรูปแบบอะไรบ้าง?"] },
    ko: { text: "오늘 앞으로 나아간 한 가지 —\n그리고 내일로 가져갈 한 가지는?", chips: ["오늘 돌아보기", "신경 쓰이는 게 있어요", "내일의 다짐", "어떤 패턴이 보이나요?"] }
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
  mode
}) {
  const L = lang || 'en';
  const now = new Date();
  const hour = now.getHours();
  const daysAway = lastActiveAt
    ? (Date.now() - new Date(lastActiveAt)) / 86400000
    : 0;
  const isMorning = hour >= 5 && hour <= 11;
  const isDaily = mode === "daily";

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
    if (sessionSummary?.focus) {
      const msg = ret.withFocus(days, sessionSummary.focus);
      return { ...msg, type: "returning" };
    }
    const msg = ret.generic(days);
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
      ja: { prefix: "最近", suffix: "について考えていましたね。\n\n何か変わりましたか？", chips: ["まだ未解決", "何か変わった", "決断した", "まだ話したくない"] },
      es: { prefix: "Estabas pensando en", suffix: "recientemente.\n\n¿Ha cambiado algo al respecto?", chips: ["Sigue sin resolver", "Algo cambió", "Tomé una decisión", "No quiero hablar de eso"] },
      th: { prefix: "เมื่อเร็วๆ นี้คุณกำลังคิดเรื่อง", suffix: "\n\nมีอะไรเปลี่ยนไปบ้าง?", chips: ["ยังไม่ได้แก้", "มีอะไรเปลี่ยน", "ตัดสินใจแล้ว", "ยังไม่พร้อมพูดเรื่องนี้"] },
      ko: { prefix: "최근에", suffix: "에 대해 생각하고 있었죠.\n\n뭔가 바뀐 게 있나요?", chips: ["아직 미해결", "뭔가 변했어요", "결정했어요", "아직 말하고 싶지 않아요"] }
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
