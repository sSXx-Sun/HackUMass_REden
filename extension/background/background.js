// REden background worker: the only part that talks to the backend (backend/server.py).
// Web pages can't call http://127.0.0.1 themselves (mixed content, CORS), so the content script asks us.
const api = globalThis.browser ?? globalThis.chrome;
const BACKEND = "http://127.0.0.1:5000"; // `python server.py` in backend/

async function request(path, body, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(BACKEND + path, {
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
  const reply = (promise, check) => {
    promise.then(
      (d) => sendResponse(check(d) ? { ok: true, data: d } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true; // answer asynchronously
  };

  if (msg.type === "reden:health") return reply(request("/health", null, 2500), () => true);

  // {items:["what","about","you"], punctuation:[[2,"?"]]} -> [0, 1, 2]  (one rating per word)
  if (msg.type === "reden:sentence") {
    const items = Array.isArray(msg.items) ? msg.items.map(String) : [];
    const punctuation = Array.isArray(msg.punctuation) ? msg.punctuation : [];
    // server.py loads its spaCy model on the first request (can take ~30 s), so wait long
    return reply(request("/get_sentence_highlight", { items, punctuation }, 120000),
      (d) => isIntList(d) && d.length === items.length);
  }

  // {word:"reading"} -> [0, 1, 2, 3]  (letter indexes to bold)
  if (msg.type === "reden:word") {
    return reply(request("/get_word_highlight", { word: String(msg.word || "") }, 30000), isIntList);
  }
});
