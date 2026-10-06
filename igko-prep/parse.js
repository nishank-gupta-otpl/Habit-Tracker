// Turns OCR text from a photographed workbook page into question drafts, and reads answer-key tables.
// Pure functions (no DOM) so they can be tested with Node: see tests/check.js.
'use strict';

(function (root) {
  const DEVANAGARI_DIGITS = '०१२३४५६७८९';
  const HINDI_OPTION_LETTERS = { 'क': 'A', 'ख': 'B', 'ग': 'C', 'घ': 'D' };

  function normalise(text) {
    return String(text || '')
      .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
      .replace(/\r/g, '')
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      // OCR often reads "(A)" as "(A}", "{A)", "[A]" or "(A]".
      .replace(/[({\[]\s*([A-Da-dकखगघ])\s*[)}\]]/g, '($1)')
      .replace(/[ \t]+/g, ' ');
  }

  // Find option markers "(A)" … "(D)" (or "(क)" … "(घ)"), falling back to "A." / "A)" at a word boundary.
  function splitOptions(block) {
    const tryPattern = (re) => {
      const marks = [];
      let m;
      while ((m = re.exec(block)) !== null) {
        const raw = m[1];
        const letter = HINDI_OPTION_LETTERS[raw] || raw.toUpperCase();
        marks.push({ letter, index: m.index, end: m.index + m[0].length });
      }
      // Keep the first A→B→C→D run.
      const order = ['A', 'B', 'C', 'D'];
      const run = [];
      for (const mk of marks) {
        if (mk.letter === order[run.length]) run.push(mk);
        if (run.length === 4) break;
      }
      return run.length === 4 ? run : null;
    };
    const run =
      tryPattern(/\(([A-Dकखगघ])\)/g) ||
      tryPattern(/\(([a-d])\)/g) ||
      tryPattern(/(?:^|\s)([A-D])[.)]\s/g);
    if (!run) return null;
    const question = clean(block.slice(0, run[0].index));
    const options = run.map((mk, i) => clean(block.slice(mk.end, i < 3 ? run[i + 1].index : undefined)));
    return { question, options };
  }

  // Drops OCR debris from pictures and table lines: tokens made only of symbols ("~~", "|", ">", "=").
  const SYMBOL_ONLY = /^[^A-Za-z0-9\u0900-\u097F]+$/;
  function clean(s) {
    return String(s || '')
      .split(/\s+/)
      .filter((tok) => tok && !SYMBOL_ONLY.test(tok))
      .join(' ')
      .trim();
  }
  // Page footers that end the last question on a page ("CLASS 3", "MTG IGKO WORKBOOK", a lone page number).
  const FOOTER = /^\s*(CLASS\s+\d+\b.*|.*\bWORKBOOK\s*$|\d{1,3}\s*$)/i;

  // Split a page into numbered question blocks: a line starting with "12." or "12)" begins a question.
  function splitQuestions(text) {
    const lines = normalise(text).split('\n');
    const blocks = [];
    let cur = null;
    let expected = null;
    for (const line of lines) {
      const m = line.match(/^\s*(\d{1,3})\s*[.)]\s*(.*)$/);
      const n = m ? parseInt(m[1], 10) : NaN;
      // Accept a new number only if it is the first one or follows on (avoids "2010." inside text).
      if (m && n > 0 && n < 200 && (expected === null || n === expected || n === expected + 1)) {
        if (cur) blocks.push(cur);
        cur = { number: n, text: m[2] };
        expected = n + 1;
      } else if (cur && FOOTER.test(line)) {
        blocks.push(cur);
        cur = null;
      } else if (cur) {
        cur.text += '\n' + line;
      }
    }
    if (cur) blocks.push(cur);
    return blocks;
  }

  // Returns [{ number, question, options: [4], ok }]. ok=false means options couldn't be found and need typing.
  function parseQuestions(text) {
    let blocks = splitQuestions(text);
    if (blocks.length === 0 && clean(text)) blocks = [{ number: null, text: normalise(text) }];
    return blocks.map((b) => {
      const parts = splitOptions(b.text);
      if (parts && parts.question) return { number: b.number, question: parts.question, options: parts.options, ok: true };
      return { number: b.number, question: clean(b.text), options: ['', '', '', ''], ok: false };
    }).filter((d) => d.question || d.options.some(Boolean));
  }

  // Reads an answer-key table such as "1. D 2. B 3. C" (cells may be split across lines).
  // Returns { number: index 0-3 }.
  function parseAnswerKey(text) {
    const flat = normalise(text).replace(/\n/g, ' ');
    const out = {};
    const re = /(?:^|\s|\|)(\d{1,3})\s*[.)]?\s*[|:]?\s*\(?([A-Dकखगघ])\)?(?=\s|\||$)/g;
    let m;
    while ((m = re.exec(flat)) !== null) {
      const n = parseInt(m[1], 10);
      const letter = HINDI_OPTION_LETTERS[m[2]] || m[2];
      if (n > 0 && n < 200 && out[n] === undefined) out[n] = 'ABCD'.indexOf(letter);
    }
    return out;
  }

  const api = { parseQuestions, parseAnswerKey, splitQuestions, normalise };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OCRParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
