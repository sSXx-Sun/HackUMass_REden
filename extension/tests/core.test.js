// Run with:  node --test extension/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../shared/core.js");

const join = (segs) => segs.map((s) => s.text).join("");
const bolds = (segs) => segs.filter((s) => s.bold).map((s) => s.text);

test("bolds the first half of a word by default", () => {
  assert.deepEqual(core.splitWord("reading", 50), ["read", "ing"]);
  assert.deepEqual(core.splitWord("the", 50), ["th", "e"]);
  assert.deepEqual(core.splitWord("a", 50), ["a", ""]);
});

test("bold amount follows the percentage and never exceeds the word", () => {
  assert.deepEqual(core.splitWord("abcdefghij", 20), ["ab", "cdefghij"]);
  assert.deepEqual(core.splitWord("abcdefghij", 80), ["abcdefgh", "ij"]);
  assert.deepEqual(core.splitWord("ab", 5), ["a", "b"]); // clamped to 20%, at least one letter
  assert.deepEqual(core.splitWord("ab", 999), ["ab", ""]); // clamped to 80% -> still within the word
});

test("text is preserved exactly: punctuation, spacing, newlines", () => {
  const text = "  Hello,  world!\n\tIt's a test... (really)—yes. ";
  assert.equal(join(core.segments(text, 50)), text);
});

test("apostrophe words stay whole; numbers and mixed tokens are skipped", () => {
  assert.deepEqual(bolds(core.segments("don't", 50)), ["don"]); // one 5-char word, not "don" + "t"
  assert.deepEqual(bolds(core.segments("mp3 3rd 2024", 50)), []);
});

test("accents are never split from their letter", () => {
  const word = "café"; // e + combining acute
  const [head, tail] = core.splitWord(word, 80);
  assert.equal(head + tail, word);
  assert.ok(!/^\p{M}/u.test(tail));
});

test("works for Cyrillic and Greek, leaves CJK alone", () => {
  assert.deepEqual(bolds(core.segments("привет", 50)), ["при"]);
  assert.deepEqual(bolds(core.segments("γράμμα", 50)), ["γρά"]);
  assert.deepEqual(bolds(core.segments("漢字テスト", 50)), []);
});

test("empty and symbol-only text produce no bold pieces", () => {
  assert.deepEqual(core.segments("", 50), []);
  assert.deepEqual(bolds(core.segments("... --- !!!", 50)), []);
});

test("checkUrl allows web pages and explains unsupported ones", () => {
  assert.equal(core.checkUrl("https://example.com/a").ok, true);
  assert.equal(core.checkUrl("http://example.com").ok, true);
  for (const bad of [
    "chrome://extensions", "about:blank", "file:///tmp/a.html", "moz-extension://x/y.html",
    "https://chromewebstore.google.com/detail/x", "https://addons.mozilla.org/en-US/firefox/",
    "https://example.com/paper.pdf", "", undefined,
  ]) {
    const r = core.checkUrl(bad);
    assert.equal(r.ok, false, String(bad));
    assert.ok(r.reason.length > 10);
  }
});

test("long text is fast", () => {
  const text = "The quick brown fox jumps over the lazy dog. ".repeat(20000); // ~900k chars
  const t0 = Date.now();
  const out = core.segments(text, 50);
  assert.equal(join(out), text);
  assert.ok(Date.now() - t0 < 3000);
});

test("presets, font stacks and contrast color", () => {
  assert.deepEqual(core.PRESETS, { low: 25, medium: 40, high: 55 });
  assert.equal(core.DEFAULTS.bionicStrength, core.PRESETS.medium);
  assert.equal(core.DEFAULTS.bionicMode, "original");
  assert.equal(core.FONT_STACKS.original, null);
  assert.match(core.FONT_STACKS.rounded, /sans-serif$/);
  assert.match(core.FONT_STACKS.editorial, /serif$/);
  assert.equal(core.contrastColor("rgb(51, 51, 51)"), "#000");
  assert.equal(core.contrastColor("rgba(230, 230, 230, 1)"), "#fff");
  assert.equal(core.contrastColor("transparent"), null);
  // presets keep word spelling intact
  for (const p of Object.values(core.PRESETS)) {
    const t = "Researchers discovered it, didn't they?";
    assert.equal(core.segments(t, p).map((s) => s.text).join(""), t);
  }
});

test("collectWords returns every word in order, any script, duplicates kept", () => {
  assert.deepEqual(core.collectWords("The cat, the DOG. Don't stop!"), ["The", "cat", "the", "DOG", "Don't", "stop"]);
  assert.deepEqual(core.collectWords("naïve café 漢字 привет"), ["naïve", "café", "漢字", "привет"]);
  assert.deepEqual(core.collectWords("mp3 2024 ---"), ["mp"]);
  assert.deepEqual(core.collectWords(""), []);
  assert.deepEqual(core.collectWords(null), []);
});

test("sentencesOf splits a paragraph, but not at .NET or Node.js", () => {
  const text = "The cat sat. Did it move? No! It slept.";
  const s = core.sentencesOf(text);
  assert.deepEqual(s.map((x) => text.slice(x.start, x.end).trim()), ["The cat sat.", "Did it move?", "No!", "It slept."]);
  assert.equal(s.map((x) => text.slice(x.start, x.end)).join(""), text);
  const net = "Microsoft shipped .NET Framework and Node.js support. Then it stopped.";
  assert.equal(core.sentencesOf(net).length, 2);
  assert.deepEqual(core.sentencesOf(""), []);
});

test("wordsOf sends words and numbers, with punctuation by item index", () => {
  const d = core.wordsOf("in July 2000, by Ecma in 2002.");
  assert.deepEqual(d.items, ["in", "July", "2000", "by", "Ecma", "in", "2002"]);
  assert.deepEqual(d.punctuation, [[2, ","], [6, "."]]);
  const text = "Well, what about you? Don't stop.";
  const r = core.wordsOf(text, 22, text.length);
  assert.deepEqual(r.items, ["Don't", "stop"]);
  assert.deepEqual(r.spans[0], [22, 27]); // offsets are in the whole paragraph
});

test("buildFlags: bold letters weighted by rating, the rest faded, numbers untouched", () => {
  const F = core.FADED;
  const text = "the reading room, 5";
  const words = [
    { start: 0, end: 3, rating: 0, idx: [0, 1] },
    { start: 4, end: 11, rating: 2, idx: [0, 1, 2, 3] },
    { start: 12, end: 16, rating: 1, idx: [0, 1] },
    { start: 18, end: 19, rating: 0, idx: null }, // a number: never bolded
  ];
  assert.deepEqual(core.segmentsFromFlags(text, core.buildFlags(text, words, 40), 0), [
    { text: "th", tier: 1 }, { text: "e", tier: F }, { text: " ", tier: 0 },
    { text: "read", tier: 3 }, { text: "ing", tier: F }, { text: " ", tier: 0 },
    { text: "ro", tier: 2 }, { text: "om", tier: F }, { text: ", 5", tier: 0 },
  ]);
  // Bold amount 20 = half as many letters, 80 = double (as a prefix)
  const reading = (pct) => core.segmentsFromFlags("reading", core.buildFlags("reading", [{ start: 0, end: 7, rating: 2, idx: [0, 1, 2, 3] }], pct), 0)[0].text;
  assert.equal(reading(20), "re");
  assert.equal(reading(80), "reading");
});

test("buildFlags ignores bad entries and keeps accents with their letter", () => {
  const bad = [{ start: 0, end: 99, rating: 2, idx: [0] }, { start: 2, end: 1, rating: 1 }, null, "x", { start: 0, end: 3, rating: 7, idx: [0] }];
  assert.ok([...core.buildFlags("abc", bad, 40)].every((v) => v === 0));
  assert.deepEqual([...core.buildFlags("abc", null, 40)], [0, 0, 0]);
  const combining = "cafe\u0301s"; // e + combining accent: 6 units, idx counts code points
  assert.deepEqual([...core.buildFlags(combining, [{ start: 0, end: 6, rating: 2, idx: [0, 1, 2, 3] }], 40)], [3, 3, 3, 3, 3, core.FADED]);
});

test("tree style: depth -> opacity, floored at min_dim_thres and at the AA floor", () => {
  assert.equal(core.dimFor(0, 60), 1);
  assert.equal(core.dimFor(2, 60), 1 - 2 * core.TREE_STEP);
  assert.equal(core.dimFor(9, 60), 0.6);   // never lighter than dimMin
  assert.equal(core.dimFor(9, 70), 0.7);
  assert.equal(core.dimFor(9, 10), 0.5);   // dimMin is clamped to 50-90 %
  assert.equal(core.dimFor(9, 60, 0.8), 0.8); // the accessibility floor wins when it is higher
});

test("minOpacityForContrast keeps faded text at WCAG AA 4.5:1", () => {
  const white = [255, 255, 255], black = [0, 0, 0];
  const a = core.minOpacityForContrast(black, white);
  assert.ok(a > 0.5 && a < 0.6, String(a)); // black on white: about 54 %
  const blend = (fg, bg, t) => fg.map((v, i) => v * t + bg[i] * (1 - t));
  assert.ok(core.contrastRatio(blend(black, white, a), white) >= 4.5);
  assert.ok(core.minOpacityForContrast([85, 85, 85], white) > a); // grey #555 text needs more opacity
  assert.equal(core.minOpacityForContrast([150, 150, 150], white), 1); // page text already below AA: don't fade at all
  const dark = core.minOpacityForContrast(white, [30, 27, 58]); // light text on a dark page works too
  assert.ok(dark > 0 && dark < 1);
  assert.deepEqual(core.parseRgb("rgba(10, 20, 30, 0.5)"), [10, 20, 30, 0.5]);
  assert.equal(core.parseRgb("transparent"), null);
});

test("treeFlags: every letter keeps its word's depth, bold letters flagged", () => {
  const text = "the reading, 5";
  const flags = core.treeFlags(text, [
    { start: 0, end: 3, depth: 2, idx: [0] },
    { start: 4, end: 11, depth: 0, idx: [0, 1, 2, 3] },
    { start: 13, end: 14, depth: 1, idx: null }, // a number: untouched
  ], 40);
  const segs = core.segmentsFromFlags(text, flags, 0).map((s) => [s.text, s.tier ? core.treeFlag(s.tier) : null]);
  assert.deepEqual(segs, [
    ["t", { depth: 2, bold: true }], ["he", { depth: 2, bold: false }], [" ", null],
    ["read", { depth: 0, bold: true }], ["ing", { depth: 0, bold: false }], [", 5", null],
  ]);
});

test("layoutBreaks: breaks from the backend, no <br> at paragraph start, next sentence on its own line", () => {
  const text = "Short one. When the war ended, the city was rebuilt. Next sentence here.";
  const sents = core.sentencesOf(text).map((s) => core.wordsOf(text, s.start, s.end));
  const layouts = [[-1, -1], [1, -1, -1, -1, 0, -1, -1, -1], [-1, -1, -1]];
  const breaks = core.layoutBreaks(text, sents.map((s, i) => ({ spans: s.spans, layout: layouts[i] })));
  assert.deepEqual(breaks.map((b) => [text.slice(b.offset, b.offset + 4), b.indent, b.newline]),
    [["When", 1, true], ["the ", 0, true], ["Next", 0, true]]);
  const first = core.layoutBreaks("When it rains, we stay in.", [{ spans: [[0, 4], [15, 17]], layout: [1, 0] }]);
  assert.deepEqual(first.map((b) => b.newline), [false, true]); // no <br> before the paragraph's first word
  assert.deepEqual(core.layoutBreaks("abc", [null, { spans: [], layout: [] }, { spans: [[0, 3]], layout: ["x"] }]), []);
});

test("splitPiece cuts a text node at the breaks inside it and keeps the text exact", () => {
  const breaks = [{ offset: 5, indent: 1, newline: true }, { offset: 12, indent: 0, newline: true }];
  const parts = core.splitPiece("one two three", 3, breaks); // this node starts at paragraph offset 3
  assert.deepEqual(parts, [{ text: "on" }, { indent: 1, newline: true }, { text: "e two t" }, { indent: 0, newline: true }, { text: "hree" }]);
  assert.equal(parts.filter((p) => p.text).map((p) => p.text).join(""), "one two three");
  assert.deepEqual(core.splitPiece("abc", 20, breaks), [{ text: "abc" }]);
});

test("vocabulary test: starts at 50 %, 10 answers home in on the level", () => {
  const total = 92683;
  let q = core.vocabStart(total);
  assert.equal(core.vocabNextIndex(q), Math.floor(total / 2)); // first question from the middle
  const level = 12000; // a reader who knows the 12 000 most common words
  while (!core.vocabDone(q)) {
    const i = core.vocabNextIndex(q);
    q = core.vocabAnswer(q, i, i < level);
  }
  assert.equal(q.asked, core.VOCAB_QUESTIONS);
  assert.ok(Math.abs(core.vocabEstimate(q) - level) < total / 2 ** 10 + 1, String(core.vocabEstimate(q)));
  // the backend may show a word a little after the asked index; the search uses the shown one
  const q2 = core.vocabAnswer(core.vocabStart(100), 57, false);
  assert.deepEqual([q2.lo, q2.hi], [0, 57]);
});

test("splitPiece: a gloss goes after the word, even at the very end of a text node", () => {
  const marks = [{ offset: 3, gloss: "猫" }];
  assert.deepEqual(core.splitPiece("cat sat", 0, marks), [{ text: "cat" }, { gloss: "猫" }, { text: " sat" }]);
  assert.deepEqual(core.splitPiece("cat", 0, marks), [{ text: "cat" }, { gloss: "猫" }]);     // word ends where the node ends
  assert.deepEqual(core.splitPiece(" sat", 3, marks), [{ text: " sat" }]);                  // so the next node doesn't get it too
});

test("segmentsFromFlags works on a piece of a longer text", () => {
  const flags = Uint8Array.from([0, 1, 1, 0, 2]);
  assert.deepEqual(core.segmentsFromFlags("bc", flags, 1), [{ text: "bc", tier: 1 }]);
  assert.deepEqual(core.segmentsFromFlags("cde", flags, 2), [{ text: "c", tier: 1 }, { text: "d", tier: 0 }, { text: "e", tier: 2 }]);
});

test("page chrome is skipped and icon fonts are recognised", () => {
  for (const sel of ["nav", "button", "aside", "footer", '[role="menu"]']) assert.ok(core.SKIP_SELECTOR.includes(sel));
  assert.ok(core.ICON_FONT_RE.test('"Material Icons"'));
  assert.ok(core.ICON_FONT_RE.test("FontAwesome, sans-serif"));
  assert.ok(!core.ICON_FONT_RE.test("Georgia, serif"));
});
