// Run with:  node --test extension/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../shared/core.js");

const slices = (text, list) => list.map((s) => text.slice(s.start, s.end));

test("sentencesOf splits a paragraph and covers all of it", () => {
  const text = "The cat sat. Did it move? No! It slept.";
  const s = core.sentencesOf(text);
  assert.deepEqual(slices(text, s).map((x) => x.trim()), ["The cat sat.", "Did it move?", "No!", "It slept."]);
  assert.equal(slices(text, s).join(""), text);
  assert.deepEqual(core.sentencesOf(""), []);
  assert.deepEqual(core.sentencesOf(null), []);
});

test("wordsOf gives items without punctuation, punctuation by word index, and spans", () => {
  const text = "Well, what about you? Don't stop.";
  const [first] = core.sentencesOf(text);
  const r = core.wordsOf(text, first.start, first.end);
  assert.deepEqual(r.items, ["Well", "what", "about", "you"]);
  assert.deepEqual(r.punctuation, [[0, ","], [3, "?"]]);
  assert.deepEqual(r.spans.map(([a, b]) => text.slice(a, b)), r.items);

  const second = core.wordsOf(text, 22, text.length);
  assert.deepEqual(second.items, ["Don't", "stop"]);
  assert.deepEqual(second.spans[0], [22, 27]); // offsets are in the whole paragraph
  assert.deepEqual(core.wordsOf("mp3 2024 ---").items, ["mp"]);
});

test("buildFlags: bold letters weighted by rating (flag = rating + 1), the rest of each word faded", () => {
  const F = core.FADED;
  const text = "the reading room, 5";
  const flags = core.buildFlags(text, [
    { start: 0, end: 3, rating: 0, idx: [0, 1] },
    { start: 4, end: 11, rating: 2, idx: [0, 1, 2, 3] },
    { start: 12, end: 16, rating: 1, idx: [0, 1] },
    { start: 18, end: 19, rating: 2, idx: [] }, // no letters to bold: left alone
  ]);
  assert.deepEqual(core.segmentsFromFlags(text, flags, 0), [
    { text: "th", tier: 1 }, { text: "e", tier: F }, { text: " ", tier: 0 },
    { text: "read", tier: 3 }, { text: "ing", tier: F }, { text: " ", tier: 0 },
    { text: "ro", tier: 2 }, { text: "om", tier: F }, { text: ", 5", tier: 0 },
  ]);
});

test("buildFlags ignores bad entries and keeps accents with their letter", () => {
  const text = "abc";
  const bad = [{ start: 0, end: 99, rating: 2, idx: [0] }, { start: 2, end: 1, rating: 1 }, null, "x", { start: 0, end: 3, rating: 7, idx: [0] }];
  assert.ok([...core.buildFlags(text, bad)].every((v) => v === 0));
  assert.deepEqual([...core.buildFlags("abc", null)], [0, 0, 0]);

  const combining = "cafe\u0301s"; // e + combining accent: 6 units, idx counts code points
  const f = core.buildFlags(combining, [{ start: 0, end: 6, rating: 2, idx: [0, 1, 2, 3] }]);
  assert.deepEqual([...f], [3, 3, 3, 3, 3, core.FADED]);
});

test("segmentsFromFlags works on a piece of a longer text", () => {
  const flags = Uint8Array.from([0, 1, 1, 0, 4]);
  assert.deepEqual(core.segmentsFromFlags("bc", flags, 1), [{ text: "bc", tier: 1 }]);
  assert.deepEqual(core.segmentsFromFlags("cde", flags, 2), [{ text: "c", tier: 1 }, { text: "d", tier: 0 }, { text: "e", tier: 4 }]);
});

test("countWords", () => {
  assert.equal(core.countWords("The cat, the DOG. Don't stop!"), 6);
  assert.equal(core.countWords(""), 0);
  assert.equal(core.countWords(null), 0);
});

test("checkUrl allows web pages and explains unsupported ones", () => {
  assert.equal(core.checkUrl("https://example.com/a").ok, true);
  for (const u of ["chrome://extensions", "about:blank", "file:///C:/a.html", "https://chromewebstore.google.com/x", "https://x.com/a.pdf", "nonsense"]) {
    const r = core.checkUrl(u);
    assert.equal(r.ok, false, u);
    assert.ok(r.reason.length > 10, u);
  }
});

test("page chrome is skipped and icon fonts are recognised", () => {
  for (const sel of ["nav", "footer", "button", "code", '[aria-hidden="true"]', ".reden-w"]) assert.ok(core.SKIP_SELECTOR.includes(sel), sel);
  assert.ok(core.ICON_FONT_RE.test("Material Icons"));
  assert.ok(!core.ICON_FONT_RE.test("Georgia, serif"));
});
