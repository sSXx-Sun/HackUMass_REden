(function () {
  'use strict';

  /* =====================================================================
     Content (English prototype). One source feeds the 3D book, the phone
     pager and the plain reading version.
     ===================================================================== */
  var TOKENS = [
    { t: 'After', imp: .25 }, { t: 'the', imp: .15 }, { t: 'rain', imp: .6 }, { t: 'stopped,', imp: .55 },
    { t: 'the', role: 's' }, { t: 'students', role: 's' }, { t: 'carefully', imp: .4 },
    { t: 'examined', role: 'v' }, { t: 'the', role: 'o' }, { t: 'old', role: 'o' }, { t: 'map', role: 'o' },
    { t: 'in', imp: .2 }, { t: 'the', imp: .15 }, { t: 'library.', imp: .5 }
  ];
  var ROLE = { s: 'Subject', v: 'Verb', o: 'Object' };

  function demo(mode) {
    var out = '', i = 0;
    while (i < TOKENS.length) {
      var k = TOKENS[i];
      if (mode === 'structure' && k.role) {
        var r = k.role, words = [];
        while (i < TOKENS.length && TOKENS[i].role === r) { words.push(TOKENS[i].t); i++; }
        out += '<span class="grp">' + words.join(' ') + '<i>' + ROLE[r] + '</i></span> ';
        continue;
      }
      var cls = '';
      if (mode === 'structure') cls = 'rest';
      else if (mode === 'fade') {
        var imp = k.role ? 1 : k.imp;
        cls = imp >= .9 ? 't0' : imp >= .55 ? 't1' : imp >= .35 ? 't2' : 't3';
      }
      out += '<span class="' + cls + '">' + k.t + '</span> ';
      i++;
    }
    return out.trim();
  }
  var DEMO_CAP = { original: 'Original', structure: 'Sentence Structure', fade: 'Importance Fade' };
  function demoBlock(modes) {
    return modes.map(function (m) {
      return '<div class="demo"><p class="cap">' + DEMO_CAP[m] + '</p><p class="s" lang="en">' + demo(m) + '</p></div>';
    }).join('');
  }

  var TOPICS = [
    { lab: '01 · Design', title: 'Quiet by design.',
      paras: ['REden only changes how heavy and how light each word looks. It never hides, reorders or rewrites anything, so the page keeps its own look and every word stays readable.'],
      note: 'Weight and opacity are the only things that change.' },
    { lab: '02 · The idea', title: 'A reading tool that keeps the whole text.',
      paras: ['REden helps you focus on the words that carry a sentence’s meaning. By bringing its essential structure into view or gently softening less important words, it is designed to support faster reading and clearer understanding—while keeping the full text in place.'],
      note: 'Download REden below to start reading.' },
    { lab: '03 · Sentence Structure', title: 'See who does what.',
      paras: ['REden highlights the subject, verb, and object to help you locate the backbone of a sentence. The surrounding context stays readable.'],
      demos: ['original', 'structure'], note: 'Illustrative. This sentence is marked up by hand; it is not live language analysis.' },
    { lab: '04 · Importance Fade', title: 'Let the main idea stand out.',
      paras: ['REden uses gradual changes in text emphasis to guide your attention toward the words that matter most. Nothing is hidden; even the lightest tone stays readable.'],
      demos: ['original', 'fade'], note: 'Illustrative. The same sentence, shown twice for comparison.' },
    { lab: '05 · Reading emphasis', tag: 'Available in the preview', title: 'Emphasis shaped by words and meaning.',
      paras: ['REden combines sentence structure with word frequency and word parts to choose which letters to bold. Important words receive stronger emphasis, while the full text stays visible.'] },
    { lab: '06 · Future languages', tag: 'Future direction', title: 'More languages. More ways to understand.',
      paras: ['Our long-term goal is to bring REden to more languages, with reading support that respects their different structures. We also want to explore how personalized emphasis can help people studying another language.',
              'Languages build sentences differently, so subject–verb–object will not apply the same way everywhere.'],
      cta: false },
    { lab: '07 · AI assistants', tag: 'Future direction', title: 'REden in VS Code, beside your AI assistants.',
      paras: ['We’re exploring a VS Code version of REden, so the explanations, summaries and code comments your AI assistants write can be read the same way: the core in view, lighter words softened, the full text in place.'],
      note: 'Not built yet. This describes the direction, not a live feature.' }
  ];

  var JOURNEY = [
    ['01-meadow', 'A grassy meadow: the journey begins.'],
    ['02-kite', 'A kite rises above the meadow.'],
    ['03-clouds', 'Following the kite beyond the clouds.'],
    ['04-rocket', 'A rocket carries the journey into space.'],
    ['05-earth', 'Looking back at Earth from orbit.'],
    ['06-moon', 'Discovering the surface of the Moon.'],
    ['05-universe', 'Exploring the unknown universe.'],
    ['06-meteors', 'A meteor shower lights the journey home.'],
    ['07-homecoming', 'Returning to a meadow on Earth with new discoveries.'],
    ['08-kite-loop', 'Flying a kite again: another journey of discovery begins.']
  ];
  function illustration(folio, compact) {
    var panel = JOURNEY[Math.min(Number(folio) || 0, JOURNEY.length - 1)];
    return '<div class="page-art' + (compact ? ' page-art--compact' : '') + '"><img src="assets/journey-' + panel[0] + '.png" width="2100" height="730" alt="' + panel[1] + '" decoding="sync" loading="eager"></div>';
  }
  function textSide(t, folio) {
    return (t.tag ? '<span class="tag">' + t.tag + '</span>' : '') +
      '<p class="lab">' + t.lab + '</p><h2>' + t.title + '</h2>' +
      t.paras.map(function (p) { return '<p>' + p + '</p>'; }).join('') +
      (t.cta ? '<a class="cta" href="./">More info</a> <a class="cta ghost" href="index.html#join">Join the waitlist</a>' : '') +
      illustration(folio) +
      (t.note && !t.demos ? '<p class="note">' + t.note + '</p>' : '') +
      (folio ? '<div class="folio">' + folio + '</div>' : '');
  }
  function demoSide(t, folio) {
    return '<p class="lab">' + t.lab.replace(/^\d+ · /, '') + ' · demonstration</p>' + demoBlock(t.demos) + illustration(folio, true) +
      '<p class="note">' + t.note + '</p>' + (folio ? '<div class="folio">' + folio + '</div>' : '');
  }
  function brandSide() {
    return '<div class="brandrow"><img src="assets/logo.png" alt=""><b>REden</b></div>' +
      '<p class="big">Find the core.<span>Follow the meaning.</span></p>' +
      illustration(0) + '<p class="note">A reading tool, told as a book.</p>';
  }

  /* Spreads: [left page html, right page html] ----------------------- */
  var SPREADS = [
    [brandSide(), textSide(TOPICS[0], '1')],
    [textSide(TOPICS[1], '2'), textSide(TOPICS[2], '3')],
    [demoSide(TOPICS[2], '4'), textSide(TOPICS[3], '5')],
    [demoSide(TOPICS[3], '6'), textSide(TOPICS[4], '7')],
    [textSide(TOPICS[5], '8'), textSide(TOPICS[6], '9')]
  ];

  /* =====================================================================
     Small helpers
     ===================================================================== */
  var html = document.documentElement;
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function ease2(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function span(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }

  /* =====================================================================
     Phone + plain versions
     ===================================================================== */
  function topicHTML(t, tag) {
    return (t.tag ? '<span class="tag">' + t.tag + '</span>' : '') + '<p class="lab">' + t.lab + '</p><h2>' + t.title + '</h2>' +
      t.paras.map(function (p) { return '<p>' + p + '</p>'; }).join('') +
      (t.demos ? demoBlock(t.demos) : '') +
      (t.note ? '<p class="note">' + t.note + '</p>' : '') +
      (t.cta ? '<p><a class="cta" href="./">More info</a> <a class="cta ghost" href="index.html#join">Join the waitlist</a></p>' : '');
  }
  document.getElementById('plainBody').innerHTML = TOPICS.map(function (t) { return '<section>' + topicHTML(t) + '</section>'; }).join('');
  setTimeout(function () { document.querySelectorAll('#plainBody h2, #plainBody .lab, #plainBody .tag').forEach(wrapWords); }, 0);

  var mi = 0, mPage = document.getElementById('mPage'), mPrev = document.getElementById('mPrev'), mNext = document.getElementById('mNext'), mDots = document.getElementById('mDots');
  mDots.innerHTML = TOPICS.map(function () { return '<i></i>'; }).join('');
  function mShow(i) {
    mi = clamp(i, 0, TOPICS.length - 1);
    mPage.innerHTML = topicHTML(TOPICS[mi]);
    mPage.querySelectorAll('h2, .lab, .tag').forEach(wrapWords);
    mPrev.disabled = mi === 0; mNext.disabled = false; mNext.textContent = mi === TOPICS.length - 1 ? 'Continue' : 'Next';
    Array.prototype.forEach.call(mDots.children, function (d, n) { d.className = n === mi ? 'on' : ''; });
  }
  mPrev.addEventListener('click', function () { mShow(mi - 1); });
  mNext.addEventListener('click', function () { if (mi === TOPICS.length - 1) { window.location.assign('./'); return; } mShow(mi + 1); window.scrollTo(0, 0); });
  mShow(0);

  /* =====================================================================
     3D world (built only when the film is used)
     ===================================================================== */
  var library = document.createElement('img');
  library.className = 'library-scene';
  library.src = 'assets/library-table.png';
  library.alt = '';
  library.fetchPriority = 'high';
  document.getElementById('pin').insertBefore(library, document.getElementById('cam'));
  var artworkReady = false;
  var artworkCache = JOURNEY.map(function (panel) {
    var img = new Image();
    img.src = 'assets/journey-' + panel[0] + '.png';
    return img;
  });
  Promise.all(artworkCache.map(function (img) {
    return img.decode ? img.decode().catch(function () {}) : new Promise(function (resolve) { img.onload = img.onerror = resolve; });
  })).then(function () { artworkReady = true; lastFrame = 0; onScroll(); });
  var world = document.getElementById('world');
  var built = false, leaves = [], P = 2800, baseLeft, baseRight, baseKey = '';

  function box(w, h, d) {
    var b = el('div', 'bx');
    b.style.cssText = 'width:' + w + 'px;height:' + h + 'px;left:' + (-w / 2) + 'px;top:' + (-h / 2) + 'px';
    function mk(cls, fw, fh, fl, ft, tf) {
      var i = el('i', cls);
      i.style.cssText = 'width:' + fw + 'px;height:' + fh + 'px;left:' + fl + 'px;top:' + ft + 'px;transform:' + tf;
      b.appendChild(i);
    }
    mk('', w, h, 0, 0, 'translateZ(' + d / 2 + 'px)');
    mk('', w, h, 0, 0, 'translateZ(' + (-d / 2) + 'px) rotateY(180deg)');
    mk('s', d, h, (w - d) / 2, 0, 'rotateY(90deg) translateZ(' + w / 2 + 'px)');
    mk('s', d, h, (w - d) / 2, 0, 'rotateY(-90deg) translateZ(' + w / 2 + 'px)');
    mk('t', w, d, 0, (h - d) / 2, 'rotateX(90deg) translateZ(' + h / 2 + 'px)');
    mk('d', w, d, 0, (h - d) / 2, 'rotateX(-90deg) translateZ(' + h / 2 + 'px)');
    return b;
  }
  /* ---------- library room ---------- */
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  /* Muted, believable cloth-and-leather colours */
  var PAL = ['#6b2a2a', '#2f4a3a', '#27364f', '#7a5a35', '#4a2f45', '#3d4a4f', '#8a6a3c', '#5a2d2d', '#33513f', '#2a2f3d', '#6e3b26', '#3b4a35'];
  var TITLES = ['ATLAS', 'HISTORIES', 'VERSE', 'ESSAYS', 'ANNALS', 'FLORA', 'LETTERS', 'GEOMETRY', 'TRAVELS', 'LEXICON', 'OPTICS', 'NOVELS'];
  var GOLD = 'rgba(205,170,80,.85)';
  function pick() { return PAL[(rnd() * PAL.length) | 0]; }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  var FLOORY = 50;
  function plane(cls, css, parent) {
    var d = el('div', cls); d.style.cssText = css; (parent || world).appendChild(d); return d;
  }
  var PAGEBG = 'repeating-linear-gradient(0deg,#f1e8d3 0 3px,#d9cdb2 3px 4px)';
  function pagesFace(color) {
    return 'linear-gradient(180deg,' + color + ' 0 9px,rgba(0,0,0,0) 9px calc(100% - 9px),' + color + ' calc(100% - 9px)),' +
      'linear-gradient(90deg,rgba(0,0,0,.3),rgba(0,0,0,0) 10%,rgba(0,0,0,0) 90%,rgba(0,0,0,.3)),' + PAGEBG;
  }
  function lbook(w, t, d, color, side) {
    /* a cloth hardback: only the faces a camera can see */
    var b = el('div', 'bx lb');
    b.style.cssText = 'width:' + w + 'px;height:' + t + 'px;left:' + (-w / 2) + 'px;top:' + (-t / 2) + 'px';
    var title = TITLES[(rnd() * TITLES.length) | 0], titled = rnd() < .6;
    function mk(fw, fh, fl, ft, tf, bg, extra, text) {
      var i = el('i'); i.style.cssText = 'width:' + fw + 'px;height:' + fh + 'px;left:' + fl + 'px;top:' + ft + 'px;transform:' + tf + ';background:' + bg + (extra || '');
      if (text) i.textContent = text;
      b.appendChild(i);
    }
    mk(w, t, 0, 0, 'translateZ(' + d / 2 + 'px)', pagesFace(shade(color, -18)));
    mk(w, d, 0, (t - d) / 2, 'rotateX(90deg) translateZ(' + t / 2 + 'px)',
      'radial-gradient(ellipse at 30% 25%,rgba(255,255,255,.17),rgba(255,255,255,0) 62%),linear-gradient(90deg,rgba(0,0,0,.38),rgba(0,0,0,0) 7%),repeating-linear-gradient(45deg,rgba(255,255,255,.035) 0 2px,rgba(0,0,0,.05) 2px 4px),' + color,
      ';outline:2px solid ' + GOLD + ';outline-offset:-22px;display:flex;align-items:center;justify-content:center;font:400 ' + Math.round(w * .09) + 'px Marcellus,Georgia,serif;letter-spacing:.18em;color:' + GOLD + ';text-shadow:0 1px 0 rgba(0,0,0,.4)', titled ? title : '');
    var bands = 'linear-gradient(90deg,transparent 7%,' + GOLD + ' 7% 7.7%,transparent 7.7% 9.4%,' + GOLD + ' 9.4% 10.1%,transparent 10.1% 89.9%,' + GOLD + ' 89.9% 90.6%,transparent 90.6% 92.3%,' + GOLD + ' 92.3% 93%,transparent 93%)';
    var spine = bands + ',linear-gradient(180deg,rgba(255,255,255,.2),rgba(0,0,0,0) 45%,rgba(0,0,0,.34)),' + color;
    mk(d, t, (w - d) / 2, 0, (side > 0 ? 'rotateY(90deg)' : 'rotateY(-90deg)') + ' translateZ(' + w / 2 + 'px)',
      side > 0 ? pagesFace(shade(color, -18)) : spine,
      side > 0 ? '' : ';display:flex;align-items:center;justify-content:center;font:400 ' + Math.round(t * .34) + 'px Marcellus,Georgia,serif;letter-spacing:.2em;color:' + GOLD, side > 0 ? '' : title);
    return b;
  }
  function placeR(node, x, y, z, yaw) {
    var w = el('div', 'bx');
    w.style.cssText = 'left:0;top:0;width:0;height:0;transform:translate3d(' + x + 'px,' + y + 'px,' + z + 'px) rotateY(' + yaw + 'deg)';
    w.appendChild(node); world.appendChild(w);
  }
  function pile(cx, cz, n) {
    plane('shadow', 'left:-430px;top:-430px;width:860px;height:860px;transform:translate3d(' + (cx + 40) + 'px,' + (FLOORY - 1) + 'px,' + (cz + 50) + 'px) rotateX(90deg)');
    var y = FLOORY;
    for (var k = 0; k < n; k++) {
      var t = 52 + rnd() * 36, w = 400 + rnd() * 120, d = 540 + rnd() * 150;
      y -= t / 2;
      placeR(lbook(w, t, d, pick(), cx < 0 ? 1 : -1), cx + (rnd() - .5) * 70, y, cz + (rnd() - .5) * 70, (rnd() - .5) * 38);
      y -= t / 2;
    }
  }
  function shelf(parent, left, top, w, h) {
    var s = plane('shelf', 'left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + h + 'px', parent);
    var rows = 6, rh = Math.floor((h - 60) / rows);
    for (var r = 0; r < rows; r++) {
      var row = el('div', 'srow'); row.style.height = rh + 'px';
      var x = 0;
      while (x < w - 110) {
        var bw = 34 + rnd() * 46, bh = rh * (.66 + rnd() * .3), b = el('i'), c = pick();
        var bands = rnd() < .75 ? 'linear-gradient(180deg,transparent 9%,' + GOLD + ' 9% 10.5%,transparent 10.5% 14%,' + GOLD + ' 14% 15.5%,transparent 15.5% 82%,' + GOLD + ' 82% 83.5%,transparent 83.5%),' : '';
        var label = rnd() < .55 ? 'linear-gradient(180deg,transparent 28%,rgba(36,20,14,.88) 28% 48%,transparent 48%),' : '';
        b.style.cssText = 'width:' + bw + 'px;height:' + bh + 'px;background:' + label + bands +
          'linear-gradient(90deg,rgba(0,0,0,.45),rgba(255,255,255,.13) 26%,rgba(0,0,0,.04) 55%,rgba(0,0,0,.4)),' + c +
          ';box-shadow:inset 0 6px 6px -5px rgba(255,255,255,.18)' + (rnd() < .06 ? ';transform:rotate(' + (rnd() < .5 ? -6 : 6) + 'deg);transform-origin:50% 100%' : '');
        row.appendChild(b); x += bw;
      }
      s.appendChild(row);
    }
  }
  function openBook(x, z, yaw) {
    var o = el('div', 'openbk');
    o.innerHTML = '<i></i><i></i>';
    var w = el('div', 'bx');
    w.style.cssText = 'left:0;top:0;width:0;height:0;transform:translate3d(' + x + 'px,' + (FLOORY - 4) + 'px,' + z + 'px) rotateY(' + yaw + 'deg) rotateX(90deg)';
    w.appendChild(o); world.appendChild(w);
    plane('shadow', 'left:-380px;top:-300px;width:760px;height:600px;transform:translate3d(' + x + 'px,' + (FLOORY - 1) + 'px,' + z + 'px) rotateY(' + yaw + 'deg) rotateX(90deg)');
  }

  function buildWorld() {
    if (built) return;
    built = true;
    // The library photograph stays behind this same interactive book throughout.
    /* Book (lies flat; local x = across, local y = down the page, local z = up) */
    var book = el('div', 'book');
    book.appendChild(el('div', 'cover'));
    var deskShadow = el('div', 'desk-shadow'); book.appendChild(deskShadow);
    book.appendChild(el('div', 'pgblock'));
    ['edge n', 'edge l', 'edge r'].forEach(function (c) { book.appendChild(el('div', c)); });
    var pb = el('div', 'pgblock b'); pb.style.transform = 'translateZ(-12px)'; pb.style.left = '-3px'; pb.style.top = '-3px'; pb.style.width = '1046px'; pb.style.height = '706px'; book.appendChild(pb);

    function base(side, content) {
      var b = el('div', 'base ' + side);
      b.innerHTML = '<div class="pg">' + content + '</div>';
      book.appendChild(b);
      return b;
    }
    baseLeft = base('l', SPREADS[0][0]);
    baseRight = base('r', SPREADS[0][1]);
    book.appendChild(el('div', 'spine'));

    // A single sheet split into twelve narrow, connected strips. Both faces
    // sample the same full page, so type and artwork bend with the paper.
    var stripCount = 12, stripWidth = 520 / stripCount;
    for (var k = 0; k < SPREADS.length - 1; k++) {
      var leaf = el('div', 'leaf'), segments = [], parent = leaf;
      for (var j = 0; j < stripCount; j++) {
        var segment = el('div', 'seg sheet-strip');
        segment.style.width = stripWidth + 'px';
        segment.style.left = '0';
        var front = el('div', 'f'), back = el('div', 'b');
        front.style.setProperty('--paper-x', (-j * stripWidth) + 'px');
        back.style.setProperty('--paper-x', (-(520 - (j + 1) * stripWidth)) + 'px');
        front.innerHTML = '<div class="pg" style="width:520px;left:' + (-j * stripWidth) + 'px">' + SPREADS[k][1] + '</div>';
        back.innerHTML = '<div class="pg" style="width:520px;left:' + (-(520 - (j + 1) * stripWidth)) + 'px">' + SPREADS[k + 1][0] + '</div>';
        if (j) { front.setAttribute('aria-hidden', 'true'); back.setAttribute('aria-hidden', 'true'); }
        segment.appendChild(front); segment.appendChild(back);
        leaf.appendChild(segment); segments.push(segment);
      }
      var cast = el('div', 'cast');
      book.appendChild(cast); book.appendChild(leaf);
      leaves.push({ leaf: leaf, segments: segments, cast: cast });
    }
    var bw = el('div', 'bx'); bw.style.cssText = 'left:0;top:0;width:0;height:0'; bw.appendChild(book); world.appendChild(bw);
    // Resting pages are drawn once; only the active sheet is composited above them.
  }


  /* ---------- bounce: words hop in when their spread settles ---------- */
  function wrapWords(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        var w = el('span', 'bw'), i = el('span', 'bi'); i.textContent = p; w.appendChild(i); frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    if (root.matches('h2, .big')) {
      var styles = ['hop', 'glide', 'rise', 'tilt'];
      var titleHash = Array.from(root.textContent).reduce(function (sum, c) { return sum + c.codePointAt(0); }, 0);
      root.dataset.entrance = styles[titleHash % styles.length];
      root.setAttribute('aria-label', root.textContent);
      var letterIndex = 0;
      root.querySelectorAll('.bi').forEach(function (word) {
        var text = word.textContent;
        word.textContent = '';
        word.setAttribute('aria-hidden', 'true');
        Array.from(text).forEach(function (letter) {
          var ch = el('span', 'headline-char');
          ch.textContent = letter;
          ch.style.setProperty('--char-delay', Math.min(letterIndex++, 48) * 22 + 'ms');
          word.appendChild(ch);
        });
      });
    }
    var k = 0;
    root.querySelectorAll('.bi').forEach(function (b) { b.style.setProperty('--d', Math.min(k++, 14) * 70 + 'ms'); });
  }
  function wrapAll() {
    var spreadOf = function (node) {
      var base = node.closest('.base');
      if (base) return base.classList.contains('l') ? 0 : SPREADS.length - 1;
      var leafEl = node.closest('.leaf'), k = leaves.map(function (L) { return L.leaf; }).indexOf(leafEl);
      return node.closest('.b') ? k + 1 : k;
    };
    document.querySelectorAll('.book .pg').forEach(function (pg) {
      if (!pg.closest('.leaf')) pg.querySelectorAll('h2, .lab, .tag, .big').forEach(wrapWords);
      pages.push({ el: pg, s: spreadOf(pg),
        chars: Array.from(pg.querySelectorAll('.headline-char')),
        labels: Array.from(pg.querySelectorAll('.lab .bi, .tag .bi')) });
    });
  }

  /* ---------- intro headline: letters roll in, spin under the pointer ---------- */
  function splitIntro() {
    var h = document.getElementById('introTitle'), idx = 0;
    if (!h || h.dataset.split) return;
    h.dataset.split = '1';
    h.querySelectorAll('span.line').forEach(function (line) {
      var text = line.textContent; line.setAttribute('aria-label', text); line.textContent = '';
      text.split(' ').forEach(function (w, wi, all) {
        var wd = el('span', 'wd'); wd.setAttribute('aria-hidden', 'true');
        Array.from(w).forEach(function (chr) {
          var c = el('span', 'ch'), i = el('i'); i.textContent = chr; i.style.setProperty('--i', idx++); i.dataset.r = '0'; c.appendChild(i); wd.appendChild(c);
        });
        line.appendChild(wd);
        if (wi < all.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });
    h.classList.add('pre');
    requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.remove('pre'); setTimeout(function () { h.classList.add('go'); }, 1800); }); });
  }

  /* =====================================================================
     Scroll-bound camera + page turns
     ===================================================================== */
  var film = document.getElementById('film'), intro = document.getElementById('intro'), pager = document.getElementById('pager'), arrow = document.getElementById('arrow'), vig = document.getElementById('vig');
  var FLIPS = [[.53, .61], [.63, .71], [.73, .81], [.83, .91]];
  var raf = 0, lastActive = -2, pages = [];

  // One continuous parent scroll controls both the book and the real homepage.
  // Keep the loaded document alive so reversing never reloads either scene.
  var home = document.createElement('iframe');
  home.className = 'home-reveal';
  home.title = 'REden home';
  home.tabIndex = -1;
  home.setAttribute('aria-hidden', 'true');
  var homeReady = false, homeObserver;
  function bookDistance() { return window.innerHeight * 17; }
  function sizeJourney() {
    if (!html.classList.contains('cine')) { film.style.height = ''; return; }
    var extra = homeReady ? Math.max(0, home.contentDocument.documentElement.scrollHeight - window.innerHeight) : 0;
    film.style.height = (bookDistance() + window.innerHeight + extra) + 'px';
    onScroll();
  }
  home.addEventListener('load', function () {
    homeReady = true;
    var doc = home.contentDocument, frame = home.contentWindow;
    // Wheel input over the active homepage belongs to the same scroll journey.
    doc.addEventListener('wheel', function (event) {
      if (!html.classList.contains('cine') || event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      var unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      window.scrollBy({ top: event.deltaY * unit, behavior: 'instant' });
    }, { passive: false });
    doc.addEventListener('keydown', function (event) {
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      var steps = { ArrowDown: 40, ArrowUp: -40, PageDown: window.innerHeight * .85,
        PageUp: -window.innerHeight * .85, ' ': window.innerHeight * (event.shiftKey ? -.85 : .85) };
      if (Object.prototype.hasOwnProperty.call(steps, event.key)) {
        event.preventDefault(); window.scrollBy({ top: steps[event.key], behavior: 'instant' });
      }
    });
    // Also keep native anchor navigation and focus scrolling in sync.
    frame.addEventListener('scroll', function () {
      var offset = film.getBoundingClientRect().top + window.scrollY + bookDistance();
      if (window.scrollY >= offset - 1 && Math.abs(window.scrollY - offset - frame.scrollY) > 2) {
        window.scrollTo({ top: offset + frame.scrollY, behavior: 'instant' });
      }
    }, { passive: true });
    homeObserver = new ResizeObserver(sizeJourney);
    homeObserver.observe(doc.body);
    sizeJourney();
    if (doc.fonts) doc.fonts.ready.then(sizeJourney);
  });
  home.src = './';
  document.getElementById('pin').appendChild(home);
  window.addEventListener('resize', sizeJourney);

  var renderedTravel = null, lastFrame = 0;
  function apply(now) {
    raf = 0;
    if (!html.classList.contains('cine')) return;
    world.style.visibility = artworkReady ? 'visible' : 'hidden';
    if (!artworkReady) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var rect = film.getBoundingClientRect();
    var distance = bookDistance();
    var targetTravel = -rect.top;
    var elapsed = lastFrame && now ? Math.min(64, now - lastFrame) : 16;
    lastFrame = now || performance.now();
    if (renderedTravel === null || Math.abs(targetTravel - renderedTravel) > vh * 4) renderedTravel = targetTravel;
    renderedTravel += (targetTravel - renderedTravel) * (1 - Math.exp(-elapsed / 105));
    if (Math.abs(targetTravel - renderedTravel) < .2) renderedTravel = targetTravel;
    else if (Math.min(targetTravel, renderedTravel) <= distance) raf = requestAnimationFrame(apply);
    var u = clamp(renderedTravel / distance, 0, 1);

    var f = Math.min(vw * .92 / 1040, vh * .88 / 700);
    var f0 = Math.min(vw * .70 / 1040, vh * .67 / 700);
    var tzF = P * (1 - 1 / f);
    var focus = ease2(span(u, .02, .45));
    // One physical book on one desk; the camera gently approaches and levels.
    library.style.opacity = '1';
    library.style.transformOrigin = '50% 72%';
    library.style.transform = 'scale(' + (1 + focus * .32) + ')';
    document.getElementById('cam').style.opacity = '1';
    var ec = focus;
    var pitch = 48 + 36 * focus, yaw = -3 * (1 - focus);
    var ty = vh * .26 / f0 * (1 - focus);
    var scale = f0 + (f - f0) * focus;
    var tz = P * (1 - 1 / scale);
    var ending = ease2(span(u, .94, .995));
    var zoom = Math.max(vw / 520, vh / 700) * 1.08;
    var finalScale = f + (zoom - f) * ending;
    tz += (P * (1 - 1 / finalScale) - tzF);
    var pan = -260 * ending;
    world.style.transform = 'translateX(' + pan.toFixed(2) + 'px) translateZ(' + tz.toFixed(1) + 'px) translateY(' + ty.toFixed(1) + 'px) rotateX(' + (-pitch).toFixed(2) + 'deg) rotateY(' + yaw.toFixed(2) + 'deg)';

    vig.style.opacity = String((1 - ec * .9) * (1 - ending));
    var io = String(1 - ease(span(u, .02, .12)));
    intro.style.opacity = io; arrow.style.opacity = io;
    intro.style.visibility = +io < .02 ? 'hidden' : 'visible';

    var flipped = 0;
    leaves.forEach(function (L, k) {
      if (L.turn === undefined) L.turn = span(u, FLIPS[k][0], FLIPS[k][1]);
    });
    leaves.forEach(function (L, k) {
      var target = span(u, FLIPS[k][0], FLIPS[k][1]);
      // Turn just one physical sheet at a time, even with a coarse wheel step.
      if (target > L.turn && k && leaves[k - 1].turn < 1) target = L.turn;
      if (target < L.turn && k < leaves.length - 1 && leaves[k + 1].turn > 0) target = L.turn;
      if (target !== span(u, FLIPS[k][0], FLIPS[k][1]) && !raf) raf = requestAnimationFrame(apply);
      var delta = target - L.turn;
      var step = Math.min(Math.abs(delta) * (1 - Math.exp(-elapsed / 95)), elapsed / 1000);
      L.turn += Math.sign(delta) * step;
      if (Math.abs(target - L.turn) < .0005) L.turn = target;
      else if (!raf) raf = requestAnimationFrame(apply);
      var p = L.turn, t = ease(p);
      L.t = t;
      if (t >= .5) flipped++;
      if (L.drawnTurn === p) return;
      L.drawnTurn = p;
      var lift = Math.sin(Math.PI * p);
      var z = 8;
      // No rigid rotation of the whole leaf. A bend wave travels from the
      // free edge toward the binding, then releases onto the opposite stack.
      L.leaf.style.transform = 'translateZ(' + z.toFixed(3) + 'px)';
      var vertexX = 0, vertexZ = 0;
      L.segments.forEach(function (segment, j) {
        var x = (j + .5) / L.segments.length;
        var delay = .22 * (1 - x);
        var local = clamp((p - delay) / (1 - delay), 0, 1);
        var tangent = -180 * ease(local)
          - 48 * Math.sin(Math.PI * local) * x * x
          + 16 * Math.sin(2 * Math.PI * local) * (1 - x);
        tangent = clamp(tangent, -180, 0);
        var normal = tangent * Math.PI / 180;
        // Independent strips share exact 3D endpoints. No nested transform
        // chains for the compositor to flatten or sort against other leaves.
        segment.style.transform = 'translate3d(' + vertexX.toFixed(4) + 'px,0,' + vertexZ.toFixed(4) + 'px) rotateY(' + tangent.toFixed(4) + 'deg)';
        vertexX += Math.cos(normal) * (520 / L.segments.length);
        vertexZ -= Math.sin(normal) * (520 / L.segments.length);
        var frontVisible = Math.cos(normal) >= 0;
        segment.children[0].style.visibility = frontVisible ? 'visible' : 'hidden';
        segment.children[1].style.visibility = frontVisible ? 'hidden' : 'visible';
        var shade = .025 + .22 * Math.abs(Math.sin(normal)) + .045 * lift * x;
        segment.style.setProperty('--paper-shade', shade.toFixed(3));
        segment.style.setProperty('--paper-glint', (.12 * lift * Math.max(0, Math.cos(normal + .7))).toFixed(3));
      });
      L.leaf.style.setProperty('--sh', (.40 * lift).toFixed(3));
      L.cast.style.opacity = (.44 * lift).toFixed(3);
      L.cast.style.transform = 'translateZ(4px) translateX(' + ((.5 - t) * 260).toFixed(2) + 'px) scaleX(' + (.3 + .65 * Math.abs(Math.cos(Math.PI * t))).toFixed(3) + ')';
    });
    // Draw only the currently turning sheet, above the two actual resting
    // pages. Old/future leaves never participate in depth sorting.
    var moving = leaves.findIndex(function (L) { return L.turn > 0 && L.turn < 1; });
    var settled = leaves.filter(function (L) { return L.turn === 1; }).length;
    var leftSpread = moving < 0 ? settled : moving;
    var rightSpread = moving < 0 ? settled : moving + 1;
    var nextBaseKey = leftSpread + ':' + rightSpread;
    if (baseKey !== nextBaseKey) {
      baseKey = nextBaseKey;
      baseLeft.innerHTML = '<div class="pg">' + SPREADS[leftSpread][0] + '</div>';
      baseRight.innerHTML = '<div class="pg">' + SPREADS[rightSpread][1] + '</div>';
    }
    leaves.forEach(function (L, k) {
      L.leaf.style.display = k === moving ? 'block' : 'none';
      L.cast.style.display = k === moving ? 'block' : 'none';
    });
    // Scrub entrances with the turning paper, rather than starting a timer
    // after the spread has already come to rest. Reverse scrolling reverses it.
    pages.forEach(function (page) {
      var incoming = page.s === 0 ? span(u, .38, .52) : span(leaves[page.s - 1].t, .45, 1);
      if (page.lastIncoming === incoming) return;
      page.lastIncoming = incoming;
      page.chars.forEach(function (ch, i) {
        var progress = ease(span(incoming, Math.min(i, 48) * .007, .64 + Math.min(i, 48) * .007));
        var remaining = 1 - progress;
        var style = ch.closest('[data-entrance]').dataset.entrance;
        var transform;
        if (style === 'glide') transform = 'translateX(' + (remaining * 1.5) + 'em)';
        else if (style === 'hop') transform = 'translateY(' + (-Math.sin(progress * Math.PI * 2) * remaining * .38) + 'em)';
        else if (style === 'tilt') transform = 'translateX(' + (remaining * .65) + 'em) rotate(' + (remaining * 15) + 'deg)';
        else transform = 'translateY(' + (remaining * .7) + 'em)';
        ch.style.transform = transform;
      });
      page.labels.forEach(function (label, i) {
        var progress = ease(span(incoming, i * .025, .7 + i * .025));
        label.style.transform = 'translateX(' + ((1 - progress) * 2) + 'em)';
      });
    });
    var active = -1;
    for (var n = 0; n < SPREADS.length; n++) {
      var prev = n === 0 ? (ec > .98 ? 1 : 0) : leaves[n - 1].t, next = n === SPREADS.length - 1 ? 0 : leaves[n].t;
      if (prev > .96 && next < .04) active = n;
    }
    if (active !== lastActive) {
      lastActive = active;
      pages.forEach(function (p) { if (p.s === active) p.el.classList.add('bounce-on'); });
    }
    var show = u > .52;
    pager.style.opacity = show ? String(1 - ease(span(u, .935, .96))) : '0';
    var label = 'SPREAD ' + (flipped + 1) + ' / ' + SPREADS.length;
    if (pager.textContent !== label) pager.textContent = label;
    var blend = homeReady ? ease(span(u, .975, .998)) : 0;
    home.style.opacity = String(blend);
    home.style.visibility = blend > 0 ? 'visible' : 'hidden';
    var interactive = blend >= 1;
    home.style.pointerEvents = interactive ? 'auto' : 'none';
    home.tabIndex = interactive ? 0 : -1;
    home.inert = !interactive;
    home.setAttribute('aria-hidden', interactive ? 'false' : 'true');
    if (homeReady) {
      var homeY = Math.max(0, -rect.top - distance);
      if (Math.abs(home.contentWindow.scrollY - homeY) > 1) {
        home.contentWindow.scrollTo({ top: homeY, behavior: 'instant' });
      }
    }
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(apply); }

  /* =====================================================================
     Mode: film (desktop, motion ok) / phone pager / plain reading version
     ===================================================================== */
  var mqMob = window.matchMedia('(max-width: 719px)');
  var mqRM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var skipped = false, listening = false;

  function setMode() {
    html.classList.remove('cine', 'mob');
    var plain = skipped || mqRM.matches;
    html.classList.toggle('plain-mode', plain);
    if (plain) { sizeJourney(); return; }
    if (mqMob.matches) { html.classList.add('mob'); sizeJourney(); return; }
    html.classList.add('cine');
    sizeJourney();
    buildWorld();
    splitIntro();
    if (!listening) {
      listening = true;
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
    }
    apply();
  }
  mqMob.addEventListener ? mqMob.addEventListener('change', setMode) : mqMob.addListener(setMode);
  mqRM.addEventListener ? mqRM.addEventListener('change', setMode) : mqRM.addListener(setMode);

  document.getElementById('replay').addEventListener('click', function (e) {
    e.preventDefault(); skipped = false; setMode(); window.scrollTo(0, 0);
  });

  setMode();
})();
