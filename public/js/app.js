/* ---------------------------------------------------------------------------
   App: Hash Router + Initialization
   --------------------------------------------------------------------------- */

const ROUTES = {
  '#/add': { title: 'Add Note', view: 'note-editor' },
  '#/browse': { title: 'Browse', view: 'browse' },
  '#/review': { title: 'Review', view: 'review' },
  '#/dictionary': { title: 'Dictionary', view: 'dictionary' },
  '#/stats': { title: 'Statistics', view: 'stats' },
  '#/settings': { title: 'Settings', view: 'settings' },
};

// Note detail is a sub-view, not a tab
// Accessed via #/note/:id

let currentRoute = null;
let currentNoteId = null;

/**
 * Navigate to a route
 */
function navigate(route) {
  if (route.startsWith('#/note/')) {
    currentNoteId = route.replace('#/note/', '');
    renderNoteDetail(currentNoteId);
    // Highlight browse tab since note detail is accessed from browse
    highlightNav('#/browse');
    document.getElementById('headerSubtitle').textContent = 'Note Detail';
    currentRoute = '#/browse';
    return;
  }

  currentNoteId = null;
  currentRoute = route;

  const routeInfo = ROUTES[route];
  if (!routeInfo) {
    navigate('#/add');
    return;
  }

  // Update header subtitle
  document.getElementById('headerSubtitle').textContent = routeInfo.title;

  // Highlight nav
  highlightNav(route);

  // Render the view
  const main = document.getElementById('mainContent');
  main.innerHTML = '';

  switch (routeInfo.view) {
    case 'note-editor': renderNoteEditor(main); break;
    case 'browse': renderBrowse(main); break;
    case 'review': renderReview(main); break;
    case 'dictionary': renderDictionary(main); break;
    case 'stats': renderStats(main); break;
    case 'settings': renderSettings(main); break;
  }
}

/**
 * Highlight the active nav item
 */
function highlightNav(route) {
  document.querySelectorAll('.bottom-nav__item').forEach((item) => {
    item.classList.toggle('active', item.dataset.route === route);
  });
}

/**
 * Handle hash change
 */
function onHashChange() {
  const hash = location.hash || '#/add';
  navigate(hash);
}

/**
 * Initialize the app
 */
async function seedDemoIfEmpty() {
  const all = await getAllNotes();
  if (all.length > 0) return; // Already has notes, skip seeding

  const now = Date.now();
  const day = 86400000;

  // All demo notes are immediately due so the review page has content
  const dueNow = now;

  const demoNotes = [
    // ── Word ──
    {
      id: 'demo-1', content: 'serendipity', category: 'word',
      userMemo: '中文：意外发现美好事物的能力；机缘巧合',
      aiExpanded: true, aiChineseTranslation: '意外发现美好事物的能力；机缘巧合',
      aiDefinition: '指在无意中发现美好或有价值事物的能力，常用来形容那些令人惊喜的偶然发现。这个词源自英语作家霍勒斯·沃波尔在1754年创造的童话《塞伦迪普的三位王子》。',
      aiDefinitionEn: 'The faculty of making fortunate discoveries by accident; finding something good without looking for it.',
      aiExamples: [
        { en: 'Finding that café was pure serendipity.', zh: '发现那家咖啡馆纯粹是机缘巧合。' },
        { en: 'Science is full of serendipitous discoveries.', zh: '科学中充满了偶然的发现。' },
        { en: 'They met through a series of serendipitous events.', zh: '他们通过一系列机缘巧合的事件相遇了。' }
      ],
      aiEtymology: '源自英国作家霍勒斯·沃波尔（Horace Walpole）于1754年创造的童话故事《塞伦迪普的三位王子》（The Three Princes of Serendip），故事中的王子们总是意外地发现宝物。Serendip 是斯里兰卡的古称。',
      aiRelatedExpressions: [
        { en: 'fortuitous', zh: '偶然的' },
        { en: 'chance encounter', zh: '偶然相遇' },
        { en: 'happy accident', zh: '美好的意外' }
      ],
      nextReviewAt: dueNow, consecutiveCorrect: 2, interval: 7, repetitions: 3,
      favorited: true
    },
    {
      id: 'demo-2', content: 'eloquent', category: 'word',
      userMemo: '中文：雄辩的，有口才的；富于表现力的',
      nextReviewAt: dueNow, consecutiveCorrect: 0, interval: 1, repetitions: 1,
      favorited: false
    },
    {
      id: 'demo-3', content: 'resilient', category: 'word',
      userMemo: '中文：有韧性的，能迅速恢复的',
      aiExpanded: true, aiChineseTranslation: '有韧性的，能迅速恢复的',
      aiDefinition: '指人或事物在遭遇困难、挫折或伤害后能够迅速恢复，重新振作的能力。可以用来形容人的性格、材料、经济体系等。',
      aiDefinitionEn: 'Able to withstand or recover quickly from difficult conditions.',
      aiExamples: [
        { en: 'She is a remarkably resilient person.', zh: '她是一个非常有韧性的人。' },
        { en: 'Children are often more resilient than adults think.', zh: '孩子通常比大人想象的更有韧性。' },
        { en: 'The economy has proven surprisingly resilient.', zh: '经济表现出令人惊讶的恢复力。' }
      ],
      aiEtymology: '源自拉丁语 resilire，意为"跳回，弹回"（re- "back" + salire "to jump"）。',
      aiRelatedExpressions: [
        { en: 'tough', zh: '坚强的' },
        { en: 'bounce back', zh: '反弹，恢复' },
        { en: 'adaptable', zh: '适应力强的' }
      ],
      nextReviewAt: dueNow, consecutiveCorrect: 5, interval: 30, repetitions: 6,
      favorited: true
    },

    // ── Phrase ──
    {
      id: 'demo-4', content: 'take on', category: 'phrase',
      userMemo: '中文：承担，接受（挑战/责任）；呈现（面貌）',
      nextReviewAt: dueNow, consecutiveCorrect: 0, interval: 1, repetitions: 0,
      favorited: false
    },
    {
      id: 'demo-5', content: 'in the long run', category: 'phrase',
      userMemo: '中文：从长远来看，终究',
      nextReviewAt: dueNow, consecutiveCorrect: 1, interval: 3, repetitions: 2,
      favorited: false
    },

    // ── Sentence ──
    {
      id: 'demo-6', content: 'If I were you, I would give it a try.', category: 'sentence',
      userMemo: '中文：如果我是你，我会试一试。',
      nextReviewAt: dueNow, consecutiveCorrect: 0, interval: 1, repetitions: 1,
      favorited: false
    },
    {
      id: 'demo-7', content: 'It depends on the weather whether we go or stay.', category: 'sentence',
      userMemo: '中文：去还是留，取决于天气。',
      nextReviewAt: dueNow, consecutiveCorrect: 2, interval: 7, repetitions: 3,
      favorited: false
    },

    // ── Idiom ──
    {
      id: 'demo-8', content: 'break the ice', category: 'idiom',
      userMemo: '中文：打破沉默；破冰（活跃气氛）',
      aiExpanded: true, aiChineseTranslation: '打破沉默；破冰（活跃气氛）',
      aiDefinition: '在社交场合中，用言语或行动打破最初的尴尬和沉默，让大家放松下来的行为。常指主动开始一段对话或讲个笑话来活跃气氛。',
      aiDefinitionEn: 'To do or say something that relieves tension and gets conversation going in a social setting.',
      aiExamples: [
        { en: 'He told a joke to break the ice at the meeting.', zh: '他讲了一个笑话来打破会议上的沉默。' },
        { en: 'A good ice-breaking activity helps new students feel welcome.', zh: '一个好的破冰活动能让新同学感到受欢迎。' },
        { en: "I didn't know anyone at the party, so I offered to help in the kitchen to break the ice.", zh: '聚会上我谁也不认识，所以我主动去厨房帮忙来打破尴尬。' }
      ],
      aiEtymology: '源自航海术语。在冰封的海域，小型船只（称为icebreaker）会先行破冰，为后面的船只开辟航道。后来引申为社交中"开路"的行为。',
      aiRelatedExpressions: [
        { en: 'warm up to someone', zh: '对某人热络起来' },
        { en: 'get the ball rolling', zh: '开始，带动起来' },
        { en: 'social lubricant', zh: '社交润滑剂' }
      ],
      nextReviewAt: dueNow, consecutiveCorrect: 3, interval: 7, repetitions: 4,
      favorited: true
    },
    {
      id: 'demo-9', content: 'spill the beans', category: 'idiom',
      userMemo: '中文：泄露秘密，说漏嘴',
      nextReviewAt: dueNow, consecutiveCorrect: 0, interval: 1, repetitions: 0,
      favorited: false
    },

    // ── Common Usage ──
    {
      id: 'demo-10', content: "How's it going?", category: 'common_usage',
      userMemo: '中文：最近怎么样？（日常问候语）',
      nextReviewAt: dueNow, consecutiveCorrect: 1, interval: 3, repetitions: 2,
      favorited: false
    },
    {
      id: 'demo-11', content: 'Not too shabby', category: 'common_usage',
      userMemo: '中文：还不错，挺好的（带有惊喜的语气）',
      nextReviewAt: dueNow, consecutiveCorrect: 2, interval: 7, repetitions: 3,
      favorited: false
    },
    {
      id: 'demo-12', content: 'Long time no see', category: 'common_usage',
      userMemo: '中文：好久不见（据说源自中文"好久不见"的直译，在英语中已广泛使用）',
      nextReviewAt: dueNow, consecutiveCorrect: 3, interval: 14, repetitions: 4,
      favorited: true
    }
  ];

  for (const note of demoNotes) {
    const fullNote = createNoteWithSM2({
      ...note,
      createdAt: now - (note.repetitions || 0) * day, // fake creation dates
      updatedAt: now
    });
    await saveNote(fullNote);
  }

  console.log(`Seeded ${demoNotes.length} demo notes`);
}

async function init() {
  // Apply saved theme
  const savedTheme = localStorage.getItem('engnotes_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  // Apply saved style
  const savedStyle = localStorage.getItem('engnotes_style');
  if (savedStyle) {
    document.documentElement.setAttribute('data-style', savedStyle);
  }

  // Load sound preference (default enabled)
  if (localStorage.getItem('engnotes_sound') === '0') Sound.enabled(false);

  try {
    // Open the database
    await openDB();
    await migrateNotes();
    console.log('IndexedDB ready');

    // Start sync engine (no-op if not paired)
    initSyncEngine();
  } catch (err) {
    console.error('Failed to open IndexedDB:', err);
    showToast('Failed to initialize local storage', 'error');
  }

  // Set up nav click handlers
  document.querySelectorAll('.bottom-nav__item').forEach((item) => {
    item.addEventListener('click', () => {
      location.hash = item.dataset.route;
    });
  });

  // Listen for hash changes
  window.addEventListener('hashchange', onHashChange);

  // Initial route
  if (location.hash && ROUTES[location.hash]) {
    navigate(location.hash);
  } else {
    location.hash = '#/add';
    navigate('#/add');
  }

  // Seed demo notes in background (don't block the UI)
  seedDemoIfEmpty().catch(() => {});
}

// Boot
document.addEventListener('DOMContentLoaded', init);
