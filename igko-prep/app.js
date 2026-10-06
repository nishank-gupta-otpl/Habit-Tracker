/* GK Olympiad Prep — single-page app, no build step. Data lives on the phone in IndexedDB. */
'use strict';

// ───────────────────────── Exam pattern (Class 3) ─────────────────────────
// 35 questions / 40 marks / 60 minutes. Achievers questions carry 2 marks, the rest 1.
const MOCK_SECTIONS = [
  { key: 'ga', name: 'General Awareness', hi: 'सामान्य जागरूकता', count: 20, marks: 1 },
  { key: 'ca', name: 'Current Affairs', hi: 'समसामयिकी', count: 5, marks: 1 },
  { key: 'ls', name: 'Life Skills', hi: 'जीवन कौशल', count: 5, marks: 1 },
  { key: 'ach', name: 'Achievers Section', hi: 'अचीवर्स सेक्शन', count: 5, marks: 2 },
];
const MOCK_MINUTES = 60;
const LETTERS = ['A', 'B', 'C', 'D'];
const OCR_SCRIPT = 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js';
const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';

// ───────────────────────── UI text (English + Hindi) ─────────────────────────
const UI = {
  practice: ['Practice', 'अभ्यास'],
  mock: ['Mock Test', 'मॉक टेस्ट'],
  mine: ['My Questions', 'मेरे प्रश्न'],
  progress: ['Progress', 'प्रगति'],
  chapters: ['Chapters', 'अध्याय'],
  next: ['Next', 'आगे'],
  prev: ['Previous', 'पीछे'],
  finish: ['Finish', 'समाप्त'],
  submit: ['Submit test', 'टेस्ट जमा करें'],
  correct: ['Correct!', 'सही!'],
  wrong: ['Not quite', 'गलत'],
  answer: ['Answer', 'उत्तर'],
  yourAnswer: ['Your answer', 'आपका उत्तर'],
  notAnswered: ['Not answered', 'उत्तर नहीं दिया'],
  question: ['Question', 'प्रश्न'],
  of: ['of', 'में से'],
  sheet: ['Answer sheet', 'उत्तर पत्रक'],
  backToQ: ['Back to question', 'प्रश्न पर लौटें'],
  listen: ['Listen', 'सुनें'],
  score: ['Score', 'अंक'],
  review: ['Review answers', 'उत्तर देखें'],
  home: ['Home', 'होम'],
  again: ['Try again', 'फिर से'],
  achievers: ['Achievers', 'अचीवर्स'],
  yours: ['Added by you', 'आपका जोड़ा'],
};

// ───────────────────────── Storage (IndexedDB key-value) ─────────────────────────
const DB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open('gk-olympiad-prep', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction('kv', mode);
      const r = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(r && r.result);
      t.onerror = () => reject(t.error);
    });
  };
  return {
    get: (k) => tx('readonly', (s) => s.get(k)),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    del: (k) => tx('readwrite', (s) => s.delete(k)),
  };
})();

const state = {
  settings: { name: '', hindi: false, includeBuiltin: true },
  custom: [],       // parent-added questions
  stats: {},        // id -> { s: seen, c: correct, w: last-wrong timestamp }
  mocks: [],        // finished mock results
  activeMock: null, // in-progress mock (survives closing the app)
  session: null,    // current practice session
  scanDrafts: null, // page-scan review drafts
};

async function loadAll() {
  try {
    const [settings, custom, stats, mocks, activeMock] = await Promise.all(
      ['settings', 'custom', 'stats', 'mocks', 'activeMock'].map((k) => DB.get(k)));
    Object.assign(state.settings, settings || {});
    state.custom = custom || [];
    state.stats = stats || {};
    state.mocks = mocks || [];
    state.activeMock = activeMock || null;
  } catch (err) {
    toast('Could not open storage on this phone — progress will not be saved.');
    console.error(err);
  }
}
const save = (key) => DB.set(key, state[key]).catch((e) => { console.error(e); toast('Saving failed — phone storage may be full.'); });

// ───────────────────────── Question model ─────────────────────────
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const BUILTIN = (() => {
  const counters = {};
  return BUILTIN_QUESTIONS.map((q) => {
    const i = counters[q.c] = (counters[q.c] ?? -1) + 1;
    const hi = (HINDI[q.c] || [])[i] || [];
    return { id: 'b' + hash(q.q + '|' + q.o.join('|')), c: q.c, h: !!q.h, a: q.a, q: q.q, o: q.o, e: q.e, qh: hi[0] || '', oh: hi[1] || [], eh: hi[2] || '', custom: false };
  });
})();

function allQuestions() {
  const mine = state.custom.map((q) => ({ ...q, custom: true }));
  return state.settings.includeBuiltin ? BUILTIN.concat(mine) : mine;
}
const byId = (id) => allQuestions().find((q) => q.id === id) || BUILTIN.find((q) => q.id === id);
const chapterOf = (id) => CHAPTERS.find((c) => c.id === id);

// ───────────────────────── Helpers ─────────────────────────
const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = (key) => {
  const [en, hi] = UI[key];
  return state.settings.hindi ? `${en} / ${hi}` : en;
};
// Bilingual text: English first, Hindi underneath when the Hindi switch is on. Falls back to whichever exists.
function bi(en, hi) {
  en = en || ''; hi = hi || '';
  if (!en) return `<span class="only-hi">${esc(hi)}</span>`;
  if (state.settings.hindi && hi && hi !== en) return `${esc(en)}<span class="hi">${esc(hi)}</span>`;
  return esc(en);
}
const chapterName = (c) => bi(c.name, CHAPTER_NAMES_HI[c.id]);
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function setTitle(text, showBack) {
  document.getElementById('title').textContent = text;
  document.getElementById('backBtn').hidden = !showBack;
}
const go = (hash) => { location.hash = hash; };

function recordAnswer(id, correct) {
  const s = state.stats[id] || (state.stats[id] = { s: 0, c: 0, w: 0 });
  s.s++;
  if (correct) s.c++; else s.w = Date.now();
  save('stats');
}

function chapterStats(cid) {
  const qs = allQuestions().filter((q) => q.c === cid);
  let seen = 0, correct = 0, attempted = 0, wrongNow = 0;
  for (const q of qs) {
    const s = state.stats[q.id];
    if (!s) continue;
    attempted++; seen += s.s; correct += s.c;
    if (s.w && s.c < s.s) wrongNow++;
  }
  return { total: qs.length, attempted, acc: seen ? Math.round((correct / seen) * 100) : null, wrongNow };
}
const mistakesIn = (cid) => allQuestions().filter((q) => (cid == null || q.c === cid) && state.stats[q.id] && state.stats[q.id].w);

// ───────────────────────── Text-to-speech ─────────────────────────
function speakQuestion(q) {
  if (!('speechSynthesis' in window)) return toast('Read-aloud is not supported on this phone.');
  speechSynthesis.cancel();
  const say = (text, lang) => {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    speechSynthesis.speak(u);
  };
  const enText = q.q ? `${q.q}. ${q.o.map((o, i) => `${LETTERS[i]}: ${o}`).join('. ')}` : '';
  const hiText = q.qh ? `${q.qh}. ${(q.oh || []).map((o, i) => `${LETTERS[i]}: ${o}`).join('. ')}` : '';
  if (state.settings.hindi || !enText) { say(enText, 'en-IN'); say(hiText, 'hi-IN'); } else say(enText, 'en-IN');
}

// ───────────────────────── Screens ─────────────────────────
function renderHome() {
  setTitle('GK Olympiad Prep', false);
  const name = state.settings.name ? `Hi ${esc(state.settings.name)}! ` : '';
  const totalMistakes = mistakesIn(null).length;
  const resume = state.activeMock
    ? `<div class="notice info">A mock test is in progress. <button class="btn primary" data-go="#mock/run">Resume test</button></div>` : '';
  $app.innerHTML = `
    <p class="muted">${name}Class 3 · International General Knowledge Olympiad · 2026–27</p>
    ${resume}
    <div class="hero">
      <button class="tile primary" data-go="#mock"><span class="emoji">⏱️</span><strong>${t('mock')}</strong><span class="small">35 Q · 40 marks · 60 min</span></button>
      <button class="tile" data-go="#mistakes" ${totalMistakes ? '' : 'disabled'}><span class="emoji">🔁</span><strong>Fix my mistakes</strong><span class="small muted">${totalMistakes} to retry</span></button>
      <button class="tile" data-go="#mine"><span class="emoji">✍️</span><strong>${t('mine')}</strong><span class="small muted">${state.custom.length} added</span></button>
      <button class="tile" data-go="#progress"><span class="emoji">📊</span><strong>${t('progress')}</strong><span class="small muted">${state.mocks.length} mock tests</span></button>
    </div>
    <h2>${t('chapters')}</h2>
    <div class="chapter-list">
      ${CHAPTERS.map((c) => {
        const s = chapterStats(c.id);
        const pct = s.acc == null ? '' : `<span class="pct">${s.acc}%</span>`;
        return `<button class="chapter" data-go="#chapter/${c.id}">
          <span class="emoji">${c.icon}</span>
          <span><strong>${chapterName(c)}</strong><span class="meta">${s.attempted}/${s.total} tried</span>
            <span class="bar ${s.acc != null && s.acc < 60 ? 'bad' : ''}"><i style="width:${s.total ? (s.attempted / s.total) * 100 : 0}%"></i></span></span>
          ${pct}</button>`;
      }).join('')}
    </div>
    <div id="installBox"></div>
    <p class="muted small">Current-affairs questions are up to date as of ${CURRENT_AFFAIRS_AS_OF}. Add newer news yourself under “My Questions”.</p>`;
  showInstall();
}

function renderChapter(cid) {
  const c = chapterOf(cid);
  if (!c) return go('#home');
  setTitle(c.name, true);
  const s = chapterStats(cid);
  const qs = allQuestions().filter((q) => q.c === cid);
  const mistakes = mistakesIn(cid).length;
  const hots = qs.filter((q) => q.h).length;
  $app.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">${c.icon} ${chapterName(c)}</h2>
      <p class="muted">${qs.length} questions · ${hots} Achievers-level${s.acc != null ? ` · accuracy ${s.acc}%` : ''}</p>
      <div class="btn-row">
        <button class="btn primary" data-start="10">▶ 10 questions</button>
        <button class="btn" data-start="all">All ${qs.length}</button>
      </div>
      <div class="btn-row">
        <button class="btn" data-start="hots" ${hots ? '' : 'disabled'}>⭐ Achievers only</button>
        <button class="btn" data-start="mistakes" ${mistakes ? '' : 'disabled'}>🔁 My mistakes (${mistakes})</button>
      </div>
    </div>`;
  $app.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => {
    const mode = b.dataset.start;
    let pool = qs;
    if (mode === 'hots') pool = qs.filter((q) => q.h);
    if (mode === 'mistakes') pool = mistakesIn(cid);
    pool = shuffle(pool);
    if (mode === '10') pool = pool.slice(0, 10);
    startPractice(pool, c.name);
  }));
}

function startPractice(questions, label, replace) {
  if (!questions.length) { toast('No questions here yet.'); if (replace) location.replace('#home'); return; }
  state.session = { ids: questions.map((q) => q.id), i: 0, picks: [], label };
  if (replace) location.replace('#practice'); else go('#practice');
}

function renderPractice() {
  const s = state.session;
  if (!s) return go('#home');
  setTitle(s.label, true);
  if (s.i >= s.ids.length) return renderPracticeDone();
  const q = byId(s.ids[s.i]);
  const pick = s.picks[s.i];
  const answered = pick !== undefined;
  const optsEn = q.o || [];
  const optsHi = q.oh || [];
  $app.innerHTML = `
    <div class="progress-dots">${s.ids.map((_, i) => {
      const p = s.picks[i];
      const cls = p === undefined ? '' : (p === byId(s.ids[i]).a ? 'ok' : 'no');
      return `<i class="${cls} ${i === s.i ? 'cur' : ''}"></i>`;
    }).join('')}</div>
    <div class="card">
      <div class="q-head"><span>${t('question')} ${s.i + 1} ${t('of')} ${s.ids.length}
        ${q.h ? `<span class="tag">⭐ ${t('achievers')}</span>` : ''} ${q.custom ? `<span class="tag mine">${t('yours')}</span>` : ''}</span>
        <button class="speak" id="speak">🔊 ${t('listen')}</button></div>
      <div class="q-text">${bi(q.q, q.qh)}</div>
      <div class="options">
        ${[0, 1, 2, 3].map((i) => {
          let cls = '';
          if (answered) { if (i === q.a) cls = 'correct'; else if (i === pick) cls = 'wrong'; }
          return `<button class="opt ${cls}" data-pick="${i}" ${answered ? 'disabled' : ''}>
            <span class="letter">${LETTERS[i]}</span><span>${bi(optsEn[i], optsHi[i])}</span></button>`;
        }).join('')}
      </div>
      ${answered ? `<div class="explain ${pick === q.a ? 'good' : 'bad'}">
        <strong>${pick === q.a ? '✅ ' + t('correct') : '❌ ' + t('wrong') + ` — ${t('answer')}: ${LETTERS[q.a]}`}</strong>
        ${q.e || q.eh ? `<p>${bi(q.e, q.eh)}</p>` : ''}</div>` : ''}
    </div>
    ${answered ? `<button class="btn primary block" id="next">${s.i + 1 < s.ids.length ? t('next') + ' →' : t('finish')}</button>` : ''}`;
  document.getElementById('speak').addEventListener('click', () => speakQuestion(q));
  $app.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    const p = Number(b.dataset.pick);
    s.picks[s.i] = p;
    recordAnswer(q.id, p === q.a);
    renderPractice();
  }));
  const next = document.getElementById('next');
  if (next) next.addEventListener('click', () => { s.i++; renderPractice(); window.scrollTo(0, 0); });
}

function renderPracticeDone() {
  const s = state.session;
  const right = s.picks.filter((p, i) => p === byId(s.ids[i]).a).length;
  const wrongIds = s.ids.filter((id, i) => s.picks[i] !== byId(id).a);
  const pct = Math.round((right / s.ids.length) * 100);
  $app.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="font-size:48px">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
      <div class="score-big">${right}/${s.ids.length}</div>
      <p class="muted">${pct}% correct</p>
    </div>
    <div class="btn-row">
      ${wrongIds.length ? `<button class="btn primary" id="retry">🔁 Retry ${wrongIds.length} wrong</button>` : ''}
      <button class="btn" data-go="#home">${t('home')}</button>
    </div>`;
  const retry = document.getElementById('retry');
  if (retry) retry.addEventListener('click', () => startPractice(wrongIds.map(byId), s.label));
}

// ── Mock test ──
function buildMock() {
  const qs = allQuestions();
  const used = new Set();
  const take = (pool, n) => {
    const out = [];
    for (const q of shuffle(pool)) {
      if (out.length >= n) break;
      if (!used.has(q.id)) { used.add(q.id); out.push(q.id); }
    }
    return out;
  };
  const sections = {};
  // Achievers first so HOTS questions are reserved for that section.
  sections.ach = take(qs.filter((q) => q.h), 5);
  sections.ca = take(qs.filter((q) => q.c === 11), 5);
  sections.ls = take(qs.filter((q) => q.c === 10), 5);
  sections.ga = take(qs.filter((q) => q.c <= 9 && !q.h), 20);
  // Top up any short section from the remaining questions.
  for (const sec of MOCK_SECTIONS) {
    const short = sec.count - sections[sec.key].length;
    if (short > 0) sections[sec.key].push(...take(qs, short));
  }
  const items = [];
  for (const sec of MOCK_SECTIONS) for (const id of sections[sec.key]) items.push({ id, sec: sec.key });
  return { items, answers: {}, i: 0, startedAt: Date.now(), endsAt: Date.now() + MOCK_MINUTES * 60000, view: 'q' };
}

function renderMockIntro() {
  setTitle(t('mock'), true);
  const available = allQuestions().length;
  $app.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">⏱️ Full mock test</h2>
      <table class="simple">
        <tr><th>Section</th><th class="num">Questions</th><th class="num">Marks</th></tr>
        ${MOCK_SECTIONS.map((s) => `<tr><td>${bi(s.name, s.hi)}</td><td class="num">${s.count}</td><td class="num">${s.count * s.marks}</td></tr>`).join('')}
        <tr><th>Total</th><th class="num">35</th><th class="num">40</th></tr>
      </table>
      <p class="muted">${MOCK_MINUTES} minutes. No negative marking. Mark answers on the question screen or on the OMR-style answer sheet, like the real exam.</p>
      <p class="muted small">Pattern per published IGKO Class 3 guides (SOF's own site could not be checked). ${available < 35 ? `<strong>Only ${available} questions available — some sections will be short.</strong>` : ''}</p>
      ${state.activeMock ? `<div class="notice">You have a test in progress. Starting a new one will discard it.</div>
        <div class="btn-row"><button class="btn primary" data-go="#mock/run">Resume test</button><button class="btn" id="startNew">Start new</button></div>`
        : `<button class="btn primary block" id="startNew">Start test</button>`}
    </div>`;
  document.getElementById('startNew').addEventListener('click', () => {
    state.activeMock = buildMock();
    save('activeMock');
    go('#mock/run');
  });
}

let timerHandle = null;
function stopTimer() { clearInterval(timerHandle); timerHandle = null; }
function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function renderMockRun() {
  const m = state.activeMock;
  if (!m) return go('#mock');
  setTitle(t('mock'), true);
  const answeredCount = Object.keys(m.answers).length;
  const header = `<div class="q-head" style="margin-bottom:8px">
      <span>${answeredCount}/35 answered</span><span class="timer" id="timer">${fmtTime(m.endsAt - Date.now())}</span></div>`;
  if (m.view === 'sheet') {
    let lastSec = null;
    $app.innerHTML = `${header}<div class="card"><h3 style="margin-top:0">📝 ${t('sheet')}</h3>
      <p class="muted small">Tap a bubble to mark. Tap a question number to open it.</p>
      <div class="omr">${m.items.map((it, i) => {
        const sec = MOCK_SECTIONS.find((s) => s.key === it.sec);
        const label = it.sec !== lastSec ? `<div class="omr-section section-label">${esc(sec.name)}${sec.marks > 1 ? ' (2 marks each)' : ''}</div>` : '';
        lastSec = it.sec;
        return `${label}<div class="omr-row"><button class="num" data-jump="${i}">${i + 1}.</button>
          ${[0, 1, 2, 3].map((o) => `<button class="bubble ${m.answers[i] === o ? 'on' : ''}" data-bubble="${i}:${o}" aria-label="Q${i + 1} ${LETTERS[o]}">${LETTERS[o]}</button>`).join('')}</div>`;
      }).join('')}</div></div>
      <div class="btn-row"><button class="btn" id="toQ">${t('backToQ')}</button><button class="btn primary" id="submit">${t('submit')}</button></div>`;
    $app.querySelectorAll('[data-bubble]').forEach((b) => b.addEventListener('click', () => {
      const [qi, o] = b.dataset.bubble.split(':').map(Number);
      if (m.answers[qi] === o) delete m.answers[qi]; else m.answers[qi] = o;
      save('activeMock');
      renderMockRun();
    }));
    $app.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
      m.i = Number(b.dataset.jump); m.view = 'q'; save('activeMock'); renderMockRun(); window.scrollTo(0, 0);
    }));
    document.getElementById('toQ').addEventListener('click', () => { m.view = 'q'; save('activeMock'); renderMockRun(); });
  } else {
    const it = m.items[m.i];
    const q = byId(it.id);
    const sec = MOCK_SECTIONS.find((s) => s.key === it.sec);
    if (!q) { // question was deleted mid-test
      m.items.splice(m.i, 1); m.i = Math.min(m.i, m.items.length - 1); save('activeMock'); return renderMockRun();
    }
    $app.innerHTML = `${header}
      <div class="card">
        <div class="section-label">${bi(sec.name, sec.hi)}${sec.marks > 1 ? ' · 2 marks' : ''}</div>
        <div class="q-head"><span>${t('question')} ${m.i + 1} ${t('of')} ${m.items.length}</span><button class="speak" id="speak">🔊 ${t('listen')}</button></div>
        <div class="q-text">${bi(q.q, q.qh)}</div>
        <div class="options">${[0, 1, 2, 3].map((i) => `<button class="opt ${m.answers[m.i] === i ? 'selected' : ''}" data-pick="${i}">
          <span class="letter">${LETTERS[i]}</span><span>${bi((q.o || [])[i], (q.oh || [])[i])}</span></button>`).join('')}</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="prev" ${m.i === 0 ? 'disabled' : ''}>← ${t('prev')}</button>
        <button class="btn" id="sheet">📝 ${t('sheet')}</button>
        ${m.i + 1 < m.items.length ? `<button class="btn primary" id="nextQ">${t('next')} →</button>` : `<button class="btn primary" id="submit">${t('submit')}</button>`}
      </div>`;
    document.getElementById('speak').addEventListener('click', () => speakQuestion(q));
    $app.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const o = Number(b.dataset.pick);
      if (m.answers[m.i] === o) delete m.answers[m.i]; else m.answers[m.i] = o;
      save('activeMock');
      renderMockRun();
    }));
    const nav = (d) => { m.i += d; save('activeMock'); renderMockRun(); window.scrollTo(0, 0); };
    document.getElementById('prev').addEventListener('click', () => nav(-1));
    const nq = document.getElementById('nextQ');
    if (nq) nq.addEventListener('click', () => nav(1));
    document.getElementById('sheet').addEventListener('click', () => { m.view = 'sheet'; save('activeMock'); renderMockRun(); window.scrollTo(0, 0); });
  }
  const sub = document.getElementById('submit');
  if (sub) sub.addEventListener('click', () => {
    const left = m.items.length - Object.keys(m.answers).length;
    if (left && !confirm(`${left} question(s) not answered. Submit anyway?`)) return;
    finishMock();
  });
  stopTimer();
  const tick = () => {
    const el = document.getElementById('timer');
    const remaining = m.endsAt - Date.now();
    if (remaining <= 0) { stopTimer(); toast('⏰ Time is up! Test submitted.'); return finishMock(); }
    if (el) { el.textContent = fmtTime(remaining); el.classList.toggle('low', remaining < 5 * 60000); }
  };
  tick();
  timerHandle = setInterval(tick, 1000);
}

function finishMock() {
  stopTimer();
  const m = state.activeMock;
  if (!m) return;
  const secScores = {};
  let total = 0, max = 0;
  const detail = m.items.map((it, i) => {
    const q = byId(it.id);
    const sec = MOCK_SECTIONS.find((s) => s.key === it.sec);
    const pick = m.answers[i];
    const ok = q && pick === q.a;
    const sc = secScores[it.sec] || (secScores[it.sec] = { got: 0, max: 0 });
    sc.max += sec.marks; max += sec.marks;
    if (ok) { sc.got += sec.marks; total += sec.marks; }
    if (q && pick !== undefined) recordAnswer(q.id, ok);
    return { id: it.id, sec: it.sec, pick: pick === undefined ? null : pick };
  });
  const result = { at: Date.now(), total, max, secScores, timeMs: Math.min(Date.now(), m.endsAt) - m.startedAt, detail };
  state.mocks.push(result);
  state.activeMock = null;
  save('mocks'); DB.del('activeMock');
  go('#result/' + (state.mocks.length - 1));
}

function renderMockResult(idx) {
  const r = state.mocks[idx];
  if (!r) return go('#home');
  stopTimer();
  setTitle('Test result', true);
  const pct = Math.round((r.total / r.max) * 100);
  $app.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="font-size:44px">${pct >= 80 ? '🏆' : pct >= 50 ? '🎯' : '💪'}</div>
      <div class="score-big">${r.total}/${r.max}</div>
      <p class="muted">${pct}% · time ${fmtTime(r.timeMs)} · ${new Date(r.at).toLocaleDateString()}</p>
    </div>
    <div class="card"><table class="simple">
      <tr><th>Section</th><th class="num">${t('score')}</th></tr>
      ${MOCK_SECTIONS.map((s) => { const sc = r.secScores[s.key] || { got: 0, max: 0 }; return `<tr><td>${bi(s.name, s.hi)}</td><td class="num">${sc.got}/${sc.max}</td></tr>`; }).join('')}
    </table></div>
    <h2>${t('review')}</h2>
    ${r.detail.map((d, i) => {
      const q = byId(d.id);
      if (!q) return `<div class="card muted">Q${i + 1}: question was deleted.</div>`;
      const ok = d.pick === q.a;
      return `<div class="card">
        <div class="q-head"><span>${i + 1}. ${ok ? '✅' : d.pick === null ? '⬜' : '❌'}</span></div>
        <div class="q-text" style="font-size:17px">${bi(q.q, q.qh)}</div>
        <div class="options">${[0, 1, 2, 3].map((o) => `<div class="opt ${o === q.a ? 'correct' : o === d.pick ? 'wrong' : ''}">
          <span class="letter">${LETTERS[o]}</span><span>${bi((q.o || [])[o], (q.oh || [])[o])}</span></div>`).join('')}</div>
        ${d.pick === null ? `<p class="muted">${t('notAnswered')}</p>` : ''}
        ${q.e || q.eh ? `<div class="explain">${bi(q.e, q.eh)}</div>` : ''}
      </div>`;
    }).join('')}
    <div class="btn-row"><button class="btn primary" data-go="#mock">New mock test</button><button class="btn" data-go="#home">${t('home')}</button></div>`;
}

// ── Progress & settings ──
function renderProgress() {
  setTitle(t('progress'), true);
  const rows = CHAPTERS.map((c) => ({ c, s: chapterStats(c.id) }));
  const weak = rows.filter((r) => r.s.acc != null && r.s.attempted >= 5 && r.s.acc < 60);
  $app.innerHTML = `
    ${weak.length ? `<div class="notice">Needs more practice: ${weak.map((r) => `<strong>${esc(r.c.name)}</strong> (${r.s.acc}%)`).join(', ')}</div>` : ''}
    <div class="card"><h3 style="margin-top:0">Chapters</h3>
      ${rows.map(({ c, s }) => `<div style="margin:10px 0">
        <div class="q-head"><span>${c.icon} ${chapterName(c)}</span><span class="pct">${s.acc == null ? '—' : s.acc + '%'}</span></div>
        <div class="bar ${s.acc == null ? '' : s.acc >= 75 ? 'good' : s.acc < 60 ? 'bad' : ''}"><i style="width:${s.acc || 0}%"></i></div>
        <div class="muted small">${s.attempted}/${s.total} questions tried${s.wrongNow ? ` · ${s.wrongNow} to fix` : ''}</div></div>`).join('')}
    </div>
    <div class="card"><h3 style="margin-top:0">Mock tests</h3>
      ${state.mocks.length ? `<table class="simple"><tr><th>Date</th><th class="num">Score</th><th class="num">Time</th></tr>
        ${state.mocks.map((r, i) => ({ r, i })).reverse().map(({ r, i }) => `<tr data-go="#result/${i}" style="cursor:pointer">
          <td>${new Date(r.at).toLocaleDateString()}</td><td class="num"><strong>${r.total}/${r.max}</strong></td><td class="num">${fmtTime(r.timeMs)}</td></tr>`).join('')}
        </table>` : '<p class="muted">No mock tests yet.</p>'}
    </div>
    <div class="card"><h3 style="margin-top:0">Settings</h3>
      <label class="field"><span>Child's name</span><input type="text" id="setName" value="${esc(state.settings.name)}" placeholder="Optional"></label>
      <label class="check"><input type="checkbox" id="setHindi" ${state.settings.hindi ? 'checked' : ''}> Show Hindi alongside English (also the अ+A button at the top)</label>
      <label class="check"><input type="checkbox" id="setBuiltin" ${state.settings.includeBuiltin ? 'checked' : ''}> Include the app's built-in questions (turn off to practise only your own)</label>
    </div>
    <div class="card"><h3 style="margin-top:0">Backup &amp; share between phones</h3>
      <p class="muted small">Saves your added questions, progress and test history to a file. Open it on the other parent's phone with “Restore”. Keep the file within your family.</p>
      <div class="btn-row"><button class="btn" id="exportBtn">⬇️ Save backup</button><label class="btn">⬆️ Restore<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>
      <button class="btn danger block" id="resetBtn">Reset progress &amp; test history</button>
    </div>`;
  document.getElementById('setName').addEventListener('change', (e) => { state.settings.name = e.target.value.trim(); save('settings'); toast('Saved'); });
  document.getElementById('setHindi').addEventListener('change', (e) => setHindi(e.target.checked));
  document.getElementById('setBuiltin').addEventListener('change', (e) => { state.settings.includeBuiltin = e.target.checked; save('settings'); });
  document.getElementById('exportBtn').addEventListener('click', exportBackup);
  document.getElementById('importFile').addEventListener('change', (e) => e.target.files[0] && importBackup(e.target.files[0]));
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Clear all progress and mock test history? Your added questions are kept.')) return;
    state.stats = {}; state.mocks = []; state.activeMock = null;
    save('stats'); save('mocks'); DB.del('activeMock');
    toast('Progress cleared'); renderProgress();
  });
}

async function exportBackup() {
  const data = { app: 'gk-olympiad-prep', version: 1, exportedAt: new Date().toISOString(), settings: state.settings, custom: state.custom, stats: state.stats, mocks: state.mocks };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const fileName = `gk-olympiad-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], fileName, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'GK Olympiad backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'gk-olympiad-prep') throw new Error('Not a backup from this app');
    const mode = confirm('Merge with what is on this phone?\n\nOK = merge (keeps both)\nCancel = stop') ? 'merge' : null;
    if (!mode) return;
    const ids = new Set(state.custom.map((q) => q.id));
    for (const q of data.custom || []) if (!ids.has(q.id)) state.custom.push(q);
    for (const [id, s] of Object.entries(data.stats || {})) {
      const cur = state.stats[id];
      if (!cur || s.s > cur.s) state.stats[id] = s;
    }
    const seen = new Set(state.mocks.map((r) => r.at));
    for (const r of data.mocks || []) if (!seen.has(r.at)) state.mocks.push(r);
    state.mocks.sort((a, b) => a.at - b.at);
    await Promise.all([save('custom'), save('stats'), save('mocks')]);
    toast(`Restored: ${(data.custom || []).length} questions`);
    route();
  } catch (e) {
    toast('Could not read that file: ' + e.message);
  }
}

// ───────────────────────── My Questions ─────────────────────────
function renderMine() {
  setTitle(t('mine'), true);
  const list = state.custom.slice().reverse();
  $app.innerHTML = `
    <div class="btn-row">
      <button class="btn primary" data-go="#edit/new">➕ Type / speak</button>
      <button class="btn" data-go="#scan">📷 Scan a page</button>
    </div>
    <p class="muted small">Questions you add stay on this phone and appear in chapter practice and mock tests. Use Progress → Backup to copy them to another phone.</p>
    ${list.length ? `<div class="card">${list.map((q) => {
      const c = chapterOf(q.c);
      return `<div class="list-item"><div><div>${bi(q.q, q.qh)}</div>
        <div class="muted small">${c ? c.icon + ' ' + esc(c.name) : ''} · ${t('answer')} ${LETTERS[q.a]}${q.h ? ' · ⭐' : ''}</div></div>
        <button class="btn" data-go="#edit/${q.id}">Edit</button></div>`;
    }).join('')}</div>
    <button class="btn block" id="practiseMine">▶ Practise my questions</button>`
    : `<div class="empty">No questions added yet.<br>Type or speak one, or photograph a page from the workbook.</div>`}`;
  const pm = document.getElementById('practiseMine');
  if (pm) pm.addEventListener('click', () => startPractice(shuffle(state.custom.map((q) => ({ ...q, custom: true }))), t('mine')));
}

function blankQuestion() {
  return { id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), c: 1, h: false, a: -1, q: '', o: ['', '', '', ''], e: '', qh: '', oh: ['', '', '', ''], eh: '' };
}

function micButton(target, lang) {
  return `<button type="button" class="mic" data-mic="${target}" data-lang="${lang}" aria-label="Speak (${lang === 'hi-IN' ? 'Hindi' : 'English'})">🎤</button>`;
}
function fieldWithMic(id, label, value, lang, multiline) {
  const input = multiline
    ? `<textarea id="${id}" lang="${lang.slice(0, 2)}">${esc(value)}</textarea>`
    : `<input type="text" id="${id}" lang="${lang.slice(0, 2)}" value="${esc(value)}">`;
  return `<label class="field"><span>${label}</span><div class="with-mic">${input}${micButton(id, lang)}</div></label>`;
}

function questionForm(d, prefix) {
  // prefix lets several forms live on one page (page-scan review).
  const p = (k) => `${prefix}${k}`;
  return `
    <label class="field"><span>Chapter</span><select id="${p('c')}">${CHAPTERS.map((c) => `<option value="${c.id}" ${c.id === d.c ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" id="${p('h')}" ${d.h ? 'checked' : ''}> ⭐ Achievers (harder, 2 marks in the mock test)</label>
    <fieldset><legend>English</legend>
      ${fieldWithMic(p('q'), 'Question', d.q, 'en-IN', true)}
      ${[0, 1, 2, 3].map((i) => `<div class="opt-edit"><button type="button" class="radio ${d.a === i ? 'on' : ''}" data-correct="${prefix}:${i}" aria-label="Mark ${LETTERS[i]} as correct">${LETTERS[i]}</button>
        <div class="with-mic"><input type="text" id="${p('o' + i)}" lang="en" value="${esc(d.o[i])}" placeholder="Option ${LETTERS[i]}">${micButton(p('o' + i), 'en-IN')}</div></div>`).join('')}
      <p class="muted small">Tap a letter to mark the correct answer (it turns green).</p>
      ${fieldWithMic(p('e'), 'Explanation (optional)', d.e, 'en-IN', true)}
    </fieldset>
    <fieldset><legend>हिंदी (Hindi)</legend>
      <button type="button" class="btn block" data-translate="${prefix}">🌐 Translate English → Hindi (needs internet)</button>
      ${fieldWithMic(p('qh'), 'प्रश्न', d.qh, 'hi-IN', true)}
      ${[0, 1, 2, 3].map((i) => `<div class="opt-edit"><span class="radio">${LETTERS[i]}</span>
        <div class="with-mic"><input type="text" id="${p('oh' + i)}" lang="hi" value="${esc((d.oh || [])[i])}" placeholder="विकल्प ${LETTERS[i]}">${micButton(p('oh' + i), 'hi-IN')}</div></div>`).join('')}
      ${fieldWithMic(p('eh'), 'व्याख्या (वैकल्पिक)', d.eh, 'hi-IN', true)}
      <p class="muted small">Translation uses the free MyMemory service: the English text is sent to it, about 5,000 characters a day. You can also type or speak Hindi yourself, or fill only Hindi.</p>
    </fieldset>`;
}

function readForm(prefix, d) {
  const v = (k) => document.getElementById(prefix + k).value.trim();
  return {
    ...d,
    c: Number(v('c')), h: document.getElementById(prefix + 'h').checked,
    q: v('q'), o: [0, 1, 2, 3].map((i) => v('o' + i)), e: v('e'),
    qh: v('qh'), oh: [0, 1, 2, 3].map((i) => v('oh' + i)), eh: v('eh'),
  };
}

function validate(d) {
  if (!d.q && !d.qh) return 'Please enter the question (English or Hindi).';
  for (let i = 0; i < 4; i++) if (!d.o[i] && !d.oh[i]) return `Please enter option ${LETTERS[i]}.`;
  if (!(d.a >= 0 && d.a <= 3)) return 'Please tap the letter of the correct answer.';
  return null;
}

function wireFormControls(container, drafts) {
  container.querySelectorAll('[data-correct]').forEach((b) => b.addEventListener('click', () => {
    const [prefix, i] = b.dataset.correct.split(':');
    drafts[prefix].a = Number(i);
    container.querySelectorAll(`[data-correct^="${prefix}:"]`).forEach((x) => x.classList.toggle('on', x === b));
  }));
  container.querySelectorAll('[data-mic]').forEach((b) => b.addEventListener('click', () => dictate(b)));
  container.querySelectorAll('[data-translate]').forEach((b) => b.addEventListener('click', () => translateForm(b.dataset.translate, b)));
}

function renderEdit(id) {
  const existing = state.custom.find((q) => q.id === id);
  const d = existing ? JSON.parse(JSON.stringify(existing)) : blankQuestion();
  if (!d.oh) d.oh = ['', '', '', ''];
  setTitle(existing ? 'Edit question' : 'Add question', true);
  const drafts = { f_: d };
  $app.innerHTML = `
    <div class="card">
      <div class="btn-row"><label class="btn">📷 Read from photo<input type="file" id="photo" accept="image/*" capture="environment" hidden></label></div>
      <div id="ocrStatus"></div>
      <form id="qform" onsubmit="return false">${questionForm(d, 'f_')}</form>
      <div class="btn-row">
        <button class="btn primary" id="saveQ">💾 Save</button>
        ${existing ? '<button class="btn danger" id="delQ">Delete</button>' : ''}
      </div>
    </div>`;
  wireFormControls($app, drafts);
  document.getElementById('photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await runOCR(file, document.getElementById('ocrStatus'));
    if (text == null) return;
    const parsed = OCRParse.parseQuestions(text)[0];
    if (!parsed) return toast('No text found in the photo. Try a closer, brighter photo.');
    const isHindi = /[ऀ-ॿ]/.test(parsed.question);
    const set = (k, val) => { const el = document.getElementById('f_' + k); if (el && val) el.value = val; };
    set(isHindi ? 'qh' : 'q', parsed.question);
    parsed.options.forEach((o, i) => set((isHindi ? 'oh' : 'o') + i, o));
    toast(parsed.ok ? 'Filled from photo — please check the text and mark the answer.' : 'Read the text, but could not find options (A)–(D). Please type them.');
  });
  document.getElementById('saveQ').addEventListener('click', () => {
    const q = readForm('f_', drafts.f_);
    const err = validate(q);
    if (err) return toast(err);
    const i = state.custom.findIndex((x) => x.id === q.id);
    if (i >= 0) state.custom[i] = q; else state.custom.push(q);
    save('custom');
    toast('Question saved ✔');
    go('#mine');
  });
  const del = document.getElementById('delQ');
  if (del) del.addEventListener('click', () => {
    if (!confirm('Delete this question?')) return;
    state.custom = state.custom.filter((x) => x.id !== d.id);
    delete state.stats[d.id];
    save('custom'); save('stats');
    go('#mine');
  });
}

// ── Page scan: one photo → many questions ──
function renderScan() {
  setTitle('Scan a page', true);
  const drafts = state.scanDrafts;
  if (!drafts) {
    $app.innerHTML = `
      <div class="card">
        <p>Photograph a workbook page. The app reads the text on your phone, finds the numbered questions and the (A)–(D) options, and lets you check each one before saving.</p>
        <ul class="muted small">
          <li>Hold the phone flat above the page, in good light, with the text filling the screen.</li>
          <li>The first scan downloads the text reader (about 9 MB, once — use Wi-Fi if you can). After that it works offline.</li>
          <li>Picture-based questions can't be read — type those in yourself.</li>
        </ul>
        <label class="field"><span>Chapter for these questions</span><select id="scanChapter">${CHAPTERS.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('')}</select></label>
        <label class="btn primary block">📷 Take or choose photo<input type="file" id="pagePhoto" accept="image/*" capture="environment" hidden></label>
        <div id="ocrStatus"></div>
      </div>`;
    document.getElementById('pagePhoto').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const chapter = Number(document.getElementById('scanChapter').value);
      const text = await runOCR(file, document.getElementById('ocrStatus'));
      if (text == null) return;
      const parsed = OCRParse.parseQuestions(text);
      if (!parsed.length) return toast('No questions found. Try a closer, brighter photo.');
      state.scanDrafts = parsed.map((p, i) => {
        const d = blankQuestion();
        d.id += i;
        d.c = chapter;
        d.number = p.number;
        const isHindi = /[ऀ-ॿ]/.test(p.question);
        if (isHindi) { d.qh = p.question; d.oh = p.options; } else { d.q = p.question; d.o = p.options; }
        d.ok = p.ok;
        d.include = true;
        return d;
      });
      renderScan();
    });
    return;
  }
  const keyed = {};
  drafts.forEach((d, i) => { keyed[`s${i}_`] = d; });
  $app.innerHTML = `
    <div class="notice info">Found <strong>${drafts.length}</strong> question(s). Check each one, tap the correct letter, then save. You can also scan the answer-key page to fill the answers automatically.</div>
    <div class="btn-row"><label class="btn">🔑 Scan answer key<input type="file" id="keyPhoto" accept="image/*" capture="environment" hidden></label></div>
    <div id="ocrStatus"></div>
    ${drafts.map((d, i) => `<details class="card" ${i < 3 ? 'open' : ''}>
      <summary>${d.number ? 'Q' + d.number : '#' + (i + 1)} · ${esc((d.q || d.qh).slice(0, 50))}${d.ok ? '' : ' ⚠️'}</summary>
      <label class="check"><input type="checkbox" data-include="${i}" ${d.include ? 'checked' : ''}> Save this question</label>
      ${d.ok ? '' : '<p class="notice">Options (A)–(D) were not found — please type them.</p>'}
      ${questionForm(d, `s${i}_`)}
    </details>`).join('')}
    <div class="btn-row"><button class="btn primary" id="saveAll">💾 Save ticked questions</button><button class="btn" id="discard">Discard</button></div>`;
  wireFormControls($app, keyed);
  $app.querySelectorAll('[data-include]').forEach((cb) => cb.addEventListener('change', () => { drafts[Number(cb.dataset.include)].include = cb.checked; }));
  document.getElementById('keyPhoto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Keep what the parent typed so far before re-rendering.
    drafts.forEach((d, i) => Object.assign(d, readForm(`s${i}_`, d)));
    const text = await runOCR(file, document.getElementById('ocrStatus'));
    if (text == null) return;
    const key = OCRParse.parseAnswerKey(text);
    let filled = 0;
    drafts.forEach((d) => { if (d.number && key[d.number] !== undefined) { d.a = key[d.number]; filled++; } });
    toast(filled ? `Filled ${filled} answer(s) from the key — please double-check.` : 'Could not match any answers. Mark them by hand.');
    renderScan();
  });
  document.getElementById('saveAll').addEventListener('click', () => {
    const toSave = [];
    for (let i = 0; i < drafts.length; i++) {
      if (!drafts[i].include) continue;
      const q = readForm(`s${i}_`, drafts[i]);
      const err = validate(q);
      if (err) {
        $app.querySelectorAll('details')[i].open = true;
        return toast(`${drafts[i].number ? 'Q' + drafts[i].number : '#' + (i + 1)}: ${err}`);
      }
      delete q.number; delete q.ok; delete q.include;
      toSave.push(q);
    }
    if (!toSave.length) return toast('Nothing ticked to save.');
    state.custom.push(...toSave);
    save('custom');
    state.scanDrafts = null;
    toast(`Saved ${toSave.length} question(s) ✔`);
    go('#mine');
  });
  document.getElementById('discard').addEventListener('click', () => {
    if (!confirm('Discard all scanned questions?')) return;
    state.scanDrafts = null; renderScan();
  });
}

// ───────────────────────── OCR (Tesseract.js, runs on the phone) ─────────────────────────
let ocrWorkerPromise = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('download failed'));
    document.head.appendChild(s);
  });
}
async function getOCRWorker(onProgress) {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      if (!window.Tesseract) await loadScript(OCR_SCRIPT);
      let failWorker;
      const failed = new Promise((_, reject) => { failWorker = reject; });
      // A failed download inside the worker doesn't always reject createWorker, so also listen for
      // worker errors and give up after a while instead of spinning forever.
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('download took too long')), 180000));
      const worker = Tesseract.createWorker(['eng', 'hin'], 1, {
        logger: (m) => onProgress && onProgress(m),
        errorHandler: (err) => failWorker(err instanceof Error ? err : new Error(String(err))),
      });
      return Promise.race([worker, failed, timeout]);
    })().catch((e) => { ocrWorkerPromise = null; throw e; });
  }
  return ocrWorkerPromise;
}
// Downscale big camera photos — faster and usually more accurate.
async function prepareImage(file) {
  const bmp = await createImageBitmap(file);
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.filter = 'grayscale(1) contrast(1.3)';
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function runOCR(file, statusEl) {
  const show = (html) => { if (statusEl) statusEl.innerHTML = html; };
  show(`<p><span class="spinner"></span> Preparing photo…</p>`);
  try {
    const img = await prepareImage(file);
    show(`<img class="scan-preview" src="${img.toDataURL('image/jpeg', 0.6)}" alt=""><p><span class="spinner"></span> Loading text reader…</p>`);
    const preview = statusEl ? statusEl.querySelector('img').outerHTML : '';
    const worker = await getOCRWorker((m) => {
      const pct = m.progress ? ` ${Math.round(m.progress * 100)}%` : '';
      const label = m.status === 'recognizing text' ? 'Reading text' : 'Downloading text reader (first time only)';
      show(`${preview}<p><span class="spinner"></span> ${label}${pct}</p>`);
    });
    const { data } = await worker.recognize(img);
    show(preview);
    return data.text || '';
  } catch (e) {
    console.error(e);
    show(`<p class="notice">Could not read the photo${navigator.onLine ? '' : ' — the first scan needs internet to download the text reader'}. (${esc(e.message || e)})</p>`);
    return null;
  }
}

// ───────────────────────── Voice typing (Web Speech API) ─────────────────────────
let activeRecognition = null;
function dictate(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Voice typing is not supported in this browser. Use Chrome, or the 🎤 on your keyboard.');
  if (!navigator.onLine) return toast('Voice typing needs internet (Chrome sends audio to Google to convert to text).');
  if (activeRecognition) { activeRecognition.stop(); return; }
  const field = document.getElementById(btn.dataset.mic);
  const rec = new SR();
  rec.lang = btn.dataset.lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const text = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim();
    field.value = field.value ? `${field.value} ${text}` : text;
    field.dispatchEvent(new Event('input'));
  };
  rec.onerror = (e) => toast(e.error === 'not-allowed' ? 'Please allow microphone access.' : 'Did not catch that — try again.');
  rec.onend = () => { btn.classList.remove('listening'); activeRecognition = null; };
  btn.classList.add('listening');
  activeRecognition = rec;
  rec.start();
}

// ───────────────────────── Translation (MyMemory, online) ─────────────────────────
async function translateText(text, from, to) {
  if (!text || /^[\d\s.,:%°₹+\-–×÷=?/()]+$/.test(text)) return text; // numbers stay as they are
  const url = `${TRANSLATE_URL}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('service error ' + res.status);
  const json = await res.json();
  if (json.responseStatus !== 200 && json.responseStatus !== '200') throw new Error(json.responseDetails || 'translation limit reached');
  const decoder = document.createElement('textarea');
  decoder.innerHTML = json.responseData.translatedText; // the service returns HTML entities such as &#39;
  return decoder.value;
}
async function translateForm(prefix, btn) {
  if (!navigator.onLine) return toast('Translation needs internet.');
  const get = (k) => document.getElementById(prefix + k);
  const pairs = [['q', 'qh'], ['o0', 'oh0'], ['o1', 'oh1'], ['o2', 'oh2'], ['o3', 'oh3'], ['e', 'eh']];
  const enToHi = pairs.some(([en]) => get(en).value.trim());
  const jobs = pairs.map(([en, hi]) => enToHi ? [get(en), get(hi)] : [get(hi), get(en)])
    .filter(([src, dst]) => src.value.trim() && !dst.value.trim());
  if (!jobs.length) return toast(enToHi ? 'Hindi boxes are already filled. Clear one to translate it again.' : 'Type the question first.');
  const label = btn.textContent;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Translating…';
  try {
    for (const [src, dst] of jobs) dst.value = await translateText(src.value.trim(), enToHi ? 'en' : 'hi', enToHi ? 'hi' : 'en');
    toast('Translated — please check the wording.');
  } catch (e) {
    toast('Translation failed: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

// ───────────────────────── Install prompt ─────────────────────────
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; showInstall(); });
function showInstall() {
  const box = document.getElementById('installBox');
  if (!box || !deferredInstall) return;
  box.innerHTML = `<button class="btn block" id="installBtn">📲 Install on this phone</button>`;
  document.getElementById('installBtn').addEventListener('click', async () => {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null; box.innerHTML = '';
  });
}

// ───────────────────────── Language switch ─────────────────────────
function setHindi(on) {
  state.settings.hindi = on;
  save('settings');
  const b = document.getElementById('langBtn');
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Hindi is shown — tap to hide' : 'Show Hindi alongside English';
  route();
}
document.getElementById('langBtn').addEventListener('click', () => setHindi(!state.settings.hindi));

// ───────────────────────── Router ─────────────────────────
function route() {
  if (activeRecognition) activeRecognition.stop();
  const [screen, arg] = (location.hash.slice(1) || 'home').split('/');
  if (!(screen === 'mock' && arg === 'run')) stopTimer();
  switch (screen) {
    case 'chapter': return renderChapter(Number(arg));
    case 'practice': return renderPractice();
    case 'mistakes': return startPractice(shuffle(mistakesIn(null)).slice(0, 20), 'Fix my mistakes', true);
    case 'mock': return arg === 'run' ? renderMockRun() : renderMockIntro();
    case 'result': return renderMockResult(Number(arg));
    case 'mine': return renderMine();
    case 'edit': return renderEdit(arg);
    case 'scan': return renderScan();
    case 'progress': return renderProgress();
    default: return renderHome();
  }
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
document.getElementById('backBtn').addEventListener('click', () => {
  if (history.length > 1) history.back(); else go('#home');
});
// Any element with data-go navigates.
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-go]');
  if (el && !el.disabled) go(el.dataset.go);
});

(async function init() {
  await loadAll();
  const b = document.getElementById('langBtn');
  b.setAttribute('aria-pressed', String(state.settings.hindi));
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
})();
