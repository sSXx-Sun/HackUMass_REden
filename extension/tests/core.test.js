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

test("applyTiers turns backend marks into bold flags, scaled by the bold amount", () => {
  const text = "The researchers agreed.";
  const marks = [[4, 15, 2, 4], [16, 22, 1, 2]]; // researchers: bold 4 letters; agreed: bold 2
  const at = (pct) => core.segmentsFromFlags(text, core.applyTiers(text, marks, pct), 0)
    .filter((s) => s.tier).map((s) => s.text);
  assert.deepEqual(at(40), ["rese", "ag"]);      // 40 = exactly what the backend chose
  assert.deepEqual(at(20), ["re", "a"]);         // half
  assert.deepEqual(at(80), ["research", "agre"]); // double (4 -> 8 letters), never beyond the word
  assert.equal(core.segmentsFromFlags(text, core.applyTiers(text, marks, 40), 0).map((s) => s.text).join(""), text);
});

test("applyTiers ignores bad marks and keeps accents with their letter", () => {
  const text = "café ok";
  assert.deepEqual([...core.applyTiers(text, [[0, 99, 2, 2], [3, 1, 2, 1], "x", [0, 4, 0, 2], [5, 7, 3, 1], null], 40)].every((v) => v === 0), true);
  const combining = "cafe\u0301"; // e + combining accent
  const f = core.applyTiers(combining, [[0, 5, 2, 4]], 40);
  assert.equal(f[3] && f[4], 2); // asking for 4 letters also takes the combining accent that belongs to the 4th
  assert.deepEqual([...core.applyTiers("", [[0, 1, 1, 1]], 40)], []);
  assert.deepEqual([...core.applyTiers("abc", null, 40)], [0, 0, 0]);
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
