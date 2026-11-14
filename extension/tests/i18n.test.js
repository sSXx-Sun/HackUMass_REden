"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const i18n = require("../popup/i18n.js");

const en = i18n.STRINGS.en;
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");

test("every language has every English key and the same placeholders", () => {
  for (const [code] of i18n.LANGS) {
    const s = i18n.STRINGS[code];
    assert.ok(s, "missing language " + code);
    for (const key of Object.keys(en)) {
      assert.ok(typeof s[key] === "string" && s[key].length > 0, `${code} is missing "${key}"`);
      assert.equal(placeholders(s[key]), placeholders(en[key]), `${code}.${key} placeholders differ`);
    }
    for (const key of Object.keys(s)) assert.ok(key in en, `${code} has unknown key "${key}"`);
  }
});

test("commands and product name are kept as written", () => {
  for (const [code] of i18n.LANGS) {
    for (const [key, val] of Object.entries(i18n.STRINGS[code])) {
      if (/python app\.py/.test(en[key])) assert.ok(val.includes("`python app.py`"), `${code}.${key} lost the command`);
      if (/REden/.test(en[key])) assert.ok(val.includes("REden"), `${code}.${key} lost the name`);
    }
  }
});

test("t() fills placeholders and falls back to English, then the key", () => {
  assert.equal(i18n.t("es", "r_count", { n: 3 }), "3 oraciones.");
  assert.equal(i18n.t("xx", "save"), "Save");
  assert.equal(i18n.t("es", "no_such_key"), "no_such_key");
});

test("every data-i18n key used in popup.html exists", () => {
  const html = fs.readFileSync(path.join(__dirname, "../popup/popup.html"), "utf8");
  for (const m of html.matchAll(/data-i18n(?:-ph|-aria)?="(\w+)"/g)) assert.ok(m[1] in en, "unknown key " + m[1]);
});

test("every tx() key used in popup.js exists", () => {
  const js = fs.readFileSync(path.join(__dirname, "../popup/popup.js"), "utf8");
  for (const m of js.matchAll(/\btx\("(\w+)"/g)) assert.ok(m[1] in en, "unknown key " + m[1]);
});

test("right-to-left languages are flagged", () => {
  assert.ok(i18n.RTL.has("ar"));
  assert.ok(!i18n.RTL.has("es"));
});
