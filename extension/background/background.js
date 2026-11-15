// REden background worker. Web pages can't call the local backend directly (mixed content, CORS),
// so the content script sends its requests here and this worker talks to the backend.
// It only ever contacts the backend address saved in Settings (http://127.0.0.1:5001 = backend/server.py by default).
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULT_URL = "http://127.0.0.1:5001";
const OLD_URL = "http://127.0.0.1:5050"; // old app.py address; everything is in server.py now

async function backendUrl() {
  try {
    const s = await api.storage.local.get("backendUrl");
    const url = String(s.backendUrl || DEFAULT_URL).replace(/\/$/, "");
    return url === OLD_URL ? DEFAULT_URL : url;
  } catch (_) {
    return DEFAULT_URL;
  }
}

async function request(path, body, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch((await backendUrl()) + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const isIntList = (a) => Array.isArray(a) && a.every(Number.isInteger);

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.id !== api.runtime.id) return; // only our own extension scripts
  if (msg.type === "reden:health") {
    request("/health", null, 2500).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true; // answer asynchronously
  }
  // One sentence: {items:["in","July","2000"], punctuation:[[2,","]]} -> one rating 0..2 per item
  if (msg.type === "reden:sentence") {
    const items = Array.isArray(msg.items) ? msg.items.map(String) : [];
    const punctuation = Array.isArray(msg.punctuation) ? msg.punctuation : [];
    // server.py loads its spaCy model on the first request (can take ~30 s), so wait long
    request("/get_sentence_rating", { items, punctuation }, 120000).then(
      (d) => sendResponse(isIntList(d) && d.length === items.length ? { ok: true, data: d } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true;
  }
  // "Sentence tree" style: same input -> how deep each item is in the dependency tree (root = 0)
  if (msg.type === "reden:depth") {
    const items = Array.isArray(msg.items) ? msg.items.map(String) : [];
    const punctuation = Array.isArray(msg.punctuation) ? msg.punctuation : [];
    request("/get_sentence_depth", { items, punctuation }, 120000).then(
      (d) => sendResponse(isIntList(d) && d.length === items.length ? { ok: true, data: d } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true;
  }
  // "Indent" style: same input -> per item -1 (no break) or n >= 0 (new line before it, indent n). Sentences of 8 words or fewer: all -1.
  if (msg.type === "reden:layout") {
    const items = Array.isArray(msg.items) ? msg.items.map(String) : [];
    const punctuation = Array.isArray(msg.punctuation) ? msg.punctuation : [];
    request("/get_sentence_layout", { items, punctuation }, 120000).then(
      (d) => sendResponse(Array.isArray(d) && d.length === items.length && d.every((v) => Number.isInteger(v) && v >= -1)
        ? { ok: true, data: d } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true;
  }
  // Vocabulary: {words:[...], zipf} -> one true/false per word (rarer than the user's level)
  if (msg.type === "reden:vocab") {
    const words = Array.isArray(msg.words) ? msg.words.map(String) : [];
    request("/vocab/unknown", { words, zipf: Number(msg.zipf) || 0 }, 30000).then(
      (d) => sendResponse(d && Array.isArray(d.unknown) && d.unknown.length === words.length ? { ok: true, data: d.unknown } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true;
  }
  // Translation of one word (placeholder on the backend: always null for now)
  if (msg.type === "reden:translate") {
    const toLanguage = String(msg.lang || "").trim().slice(0, 40) || "Chinese"; // the user's mother language from the popup
    request("/translate", { word: String(msg.word || ""), sentence: String(msg.sentence || ""), to_language: toLanguage }, 30000).then(
      (d) => sendResponse(d && "translation" in d ? { ok: true, data: typeof d.translation === "string" ? d.translation : null } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true;
  }
  // One word: "reading" -> letter indexes to bold, e.g. [0, 1, 2, 3]
  if (msg.type === "reden:word") {
    request("/get_word_highlight", { word: String(msg.word || "") }, 30000).then(
      (d) => sendResponse(isIntList(d) ? { ok: true, data: d } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true;
  }
});
