// Run: node igko-prep/tests/check.js — checks the question data and the OCR text parser.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const dir = path.join(__dirname, '..');
const vm = require('vm');
const ctx = {};
vm.createContext(ctx);
for (const f of ['questions.js', 'questions-hi.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8') + '\nthis.CHAPTERS=CHAPTERS;this.BUILTIN_QUESTIONS=BUILTIN_QUESTIONS;' + (f.includes('-hi') ? 'this.HINDI=HINDI;this.CHAPTER_NAMES_HI=CHAPTER_NAMES_HI;' : ''), ctx);
const { CHAPTERS, BUILTIN_QUESTIONS: Q, HINDI, CHAPTER_NAMES_HI } = ctx;
const P = require(path.join(dir, 'parse.js'));
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('✓', name); };

test('every question has 4 options, a valid answer and a known chapter', () => {
  const ids = new Set(CHAPTERS.map((c) => c.id));
  for (const q of Q) {
    assert.strictEqual(q.o.length, 4, q.q);
    assert.ok(q.a >= 0 && q.a <= 3, q.q);
    assert.ok(ids.has(q.c), q.q);
    assert.ok(q.e, 'explanation missing: ' + q.q);
    assert.strictEqual(new Set(q.o).size, 4, 'duplicate options: ' + q.q);
  }
});
test('no duplicate questions (ids are hashes of the text)', () => {
  assert.strictEqual(new Set(Q.map((q) => q.q)).size, Q.length);
});
test('Hindi lines up with English, chapter by chapter', () => {
  for (const c of CHAPTERS) {
    const en = Q.filter((q) => q.c === c.id);
    const hi = HINDI[c.id];
    assert.ok(CHAPTER_NAMES_HI[c.id], 'chapter name ' + c.id);
    assert.strictEqual(hi.length, en.length, 'count in chapter ' + c.id);
    hi.forEach((h, i) => {
      assert.strictEqual(h[1].length, 4, `ch${c.id} #${i}`);
      assert.ok(h[0] && h[2], `ch${c.id} #${i} text`);
      en[i].o.forEach((o, j) => { if (/^[\d\s°C.,–₹-]+$/.test(o)) assert.strictEqual(h[1][j], o, `number option ch${c.id} #${i}`); });
    });
  }
});
test('enough questions for a full mock (20 GA, 5 CA, 5 LS, 5 Achievers)', () => {
  const hots = Q.filter((q) => q.h);
  assert.ok(hots.length >= 5);
  assert.ok(Q.filter((q) => q.c === 11 && !q.h).length >= 5);
  assert.ok(Q.filter((q) => q.c === 10 && !q.h).length >= 5);
  assert.ok(Q.filter((q) => q.c <= 9 && !q.h).length >= 20);
});
test('answers are spread across A–D', () => {
  const counts = [0, 0, 0, 0];
  Q.forEach((q) => counts[q.a]++);
  counts.forEach((c) => assert.ok(c > Q.length * 0.15, 'answer letter skew ' + counts));
});

// ── OCR parser (sample text laid out like a workbook page, with typical OCR noise) ──
const page = `CHAPTER 3
India and the World
1. Which is the longest river
of India?
(A) Yamuna (B) Ganga
(C) Godavari (D) Narmada
2. Which planet is called the Red Planet?
(A) Mars {B) Venus
(C] Jupiter (D) Saturn
3. A building opened in 2010.
Identify the city.
(A) Dubai (B) Paris (C) Rome (D) Tokyo
4. Fill in the blank with the right word.`;
test('splits a page into numbered questions with options', () => {
  const qs = P.parseQuestions(page);
  assert.strictEqual(qs.length, 4);
  assert.deepStrictEqual(qs.map((q) => q.number), [1, 2, 3, 4]);
  assert.strictEqual(qs[0].question, 'Which is the longest river of India?');
  assert.deepStrictEqual(qs[0].options, ['Yamuna', 'Ganga', 'Godavari', 'Narmada']);
  assert.deepStrictEqual(qs[1].options, ['Mars', 'Venus', 'Jupiter', 'Saturn'], 'OCR bracket noise');
  assert.strictEqual(qs[2].question, 'A building opened in 2010. Identify the city.', '"2010." is not a new question');
  assert.deepStrictEqual(qs[2].options, ['Dubai', 'Paris', 'Rome', 'Tokyo']);
  assert.strictEqual(qs[3].ok, false, 'no options → flagged for typing');
});
test('single question without a number', () => {
  const [q] = P.parseQuestions('What is the capital of Japan?\nA. Tokyo B. Seoul\nC. Delhi D. Paris');
  assert.strictEqual(q.question, 'What is the capital of Japan?');
  assert.deepStrictEqual(q.options, ['Tokyo', 'Seoul', 'Delhi', 'Paris']);
});
test('Hindi questions with (क)–(घ) options and Devanagari numbers', () => {
  const [q] = P.parseQuestions('१. भारत की राजधानी क्या है?\n(क) मुंबई (ख) नई दिल्ली\n(ग) कोलकाता (घ) चेन्नई');
  assert.strictEqual(q.number, 1);
  assert.strictEqual(q.question, 'भारत की राजधानी क्या है?');
  assert.deepStrictEqual(q.options, ['मुंबई', 'नई दिल्ली', 'कोलकाता', 'चेन्नई']);
});
test('reads an answer-key table', () => {
  const key = P.parseAnswerKey('CHAPTER-3 : India and the World\n| 1. | B | 2. | C | 3. | D |\n4. B 5. C\n11. | A');
  assert.deepStrictEqual(key, { 1: 1, 2: 2, 3: 3, 4: 1, 5: 2, 11: 0 });
});
test('drops symbol debris and stops at the page footer', () => {
  const qs = P.parseQuestions('5. Which instrument? 0\n(A) Sitar (B) Sarod ~~\n(C) Flute | (D) Harmonium >\nCLASS 3 (is) = . E ar\n15');
  assert.deepStrictEqual(qs[0].options, ['Sitar', 'Sarod', 'Flute', 'Harmonium']);
  assert.strictEqual(qs[0].question, 'Which instrument? 0');
});
test('empty text gives no questions', () => {
  assert.deepStrictEqual(P.parseQuestions('   \n  '), []);
});
console.log(`\n${n} checks passed · ${Q.length} built-in questions`);
