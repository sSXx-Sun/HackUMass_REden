// Run with:  node --test extension/tests/strings.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { STRINGS, t } = require("../popup/strings.js");

test("every tx(...) key used in popup.js exists, and placeholders are filled", () => {
  const js = fs.readFileSync(path.join(__dirname, "../popup/popup.js"), "utf8");
  const keys = [...js.matchAll(/tx\("([a-z_0-9]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 20);
  for (const k of keys) assert.ok(k in STRINGS, "missing string: " + k);
  assert.equal(t("s_on", { n: 5 }), "Bionic reading is on. 5 words formatted on this page.");
  assert.ok(!Object.values(STRINGS).some((s) => s.includes("app.py")), "old backend name left in a string");
});
