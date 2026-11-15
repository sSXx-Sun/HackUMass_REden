(function () {
  'use strict';

  /* ---------- Copy ---------- */
  var S = {
    en: {
      skip: 'Skip to the demonstration', edition: 'Pre-launch edition', langLabel: 'Language',
      tagline: 'Reading, brought into focus',
      nav1: 'How it works', nav2: 'Fits the page', nav3: 'In development', nav4: 'Future direction', nav5: 'Waitlist',
      h1a: 'Find the core.', h1b: 'Follow the meaning.',
      intro: 'REden helps you focus on the words that carry a sentence’s meaning. By bringing its essential structure into view or gently softening less important words, it is designed to support faster reading and clearer understanding—while keeping the full text in place.',
      cta1: 'Join the waitlist', cta2: 'See how it works',
      statusLabel: 'Status', status: 'Pre-launch. REden is not available to download yet.',
      demoLabel: 'The demonstration', demoTitle: 'One sentence, two reading modes', modeLegend: 'Reading mode',
      mOrig: 'Original', mStruct: 'Sentence Structure', mFade: 'Importance Fade',
      altOrig: '', altStruct: '句子主干', altFade: '重点渐显',
      structTitle: 'See who does what.', structCopy: 'REden highlights the subject, verb, and object to help you locate the backbone of a sentence. The surrounding context stays readable.',
      fadeTitle: 'Let the main idea stand out.', fadeCopy: 'REden uses gradual changes in text emphasis to guide your attention toward the words that matter most.',
      origTitle: 'The sentence as written.', origCopy: 'No emphasis at all. Use it as the baseline when you compare the other two modes.',
      strength: 'Emphasis strength', strengthHint: 'Words are never hidden. Even the lightest tone stays readable.',
      noteLabel: 'Note', notice: 'Illustrative demonstration. This sentence is marked up by hand; it is not live language analysis.',
      subject: 'Subject', verb: 'Verb', object: 'Object',
      legStructCore: 'Core: subject, verb, object', legStructRest: 'Surrounding context',
      legFade: ['Most meaning', 'Supporting', 'Least essential'],
      compare: 'Side by side',
      fitsLabel: 'Designed to fit the page', fitsTitle: 'Different pages. A familiar reading experience.',
      fitsBody: 'REden’s themes can adapt to the background of the website you’re reading.',
      fitsNote: 'Illustrative: the same emphasis shown on a light and a dark surface. This site itself stays monochrome.',
      light: 'Light page', dark: 'Dark page',
      devLabel: 'In development', devTitle: 'Emphasis that learns what’s familiar to you.',
      devBody: 'We’re developing a personal word-frequency system to help tailor bolding to each reader. The goal is to adjust emphasis around the words you encounter often and those that may need more attention.',
      futLabel: 'Future direction', futTitle: 'More languages. More ways to understand.',
      futBody: 'Our long-term goal is to bring REden to more languages, with reading support that respects their different structures. We also want to explore how personalized emphasis can help people studying another language.',
      futNote: 'Languages build sentences differently, so subject–verb–object will not apply the same way everywhere.',
      joinLabel: 'The waitlist', joinTitle: 'Be the first to read the next edition.', joinBody: 'REden is pre-launch. Add your email to join the waitlist.',
      emailLabel: 'Email address', protoLabel: 'Prototype', proto: 'This form is not connected to a waitlist service yet. Nothing you enter is sent or saved.',
      errEmail: 'Enter an email address like name@example.com.',
      okMsg: 'Prototype only: thanks, but your email was not sent or saved because no waitlist service is connected yet.',
      footer: 'Pre-launch prototype site. The demonstrations on this page are illustrative.', top: 'Back to top',
      sr: 'Sentence with subject “the students”, verb “examined”, and object “the old map”.'
    },
    zh: {
      skip: '跳到演示', edition: '发布前特刊', langLabel: '语言',
      tagline: '让阅读重新聚焦',
      nav1: '工作方式', nav2: '适应网页', nav3: '研发中', nav4: '未来方向', nav5: '候补名单',
      h1a: '找到主干。', h1b: '读懂文意。',
      intro: 'REden 帮助你聚焦于承载句子意义的词语。它会呈现句子的基本结构，或轻轻淡化次要的词，旨在支持更快的阅读和更清晰的理解——同时完整保留原文。',
      cta1: '加入候补名单', cta2: '了解工作方式',
      statusLabel: '状态', status: '发布前阶段。REden 暂未提供下载。',
      demoLabel: '互动演示', demoTitle: '一个句子，两种阅读模式', modeLegend: '阅读模式',
      mOrig: '原文', mStruct: '句子主干', mFade: '重点渐显',
      altOrig: '', altStruct: 'Sentence Structure', altFade: 'Importance Fade',
      structTitle: '看清谁做了什么。', structCopy: 'REden 会突出主语、谓语和宾语，帮助你找到句子的主干，周围的内容依然清晰易读。',
      fadeTitle: '让主旨自然浮现。', fadeCopy: 'REden 通过文字深浅的渐进变化，把你的注意力引向最重要的词。',
      origTitle: '原句，不作任何处理。', origCopy: '没有任何强调，可作为对比另外两种模式的基准。',
      strength: '强调强度', strengthHint: '文字绝不会消失，最浅的色调也依然清晰可读。',
      noteLabel: '说明', notice: '仅为示意演示。这个句子由人工标注，并非实时语言分析。',
      subject: '主语', verb: '谓语', object: '宾语',
      legStructCore: '主干：主语、谓语、宾语', legStructRest: '周围语境',
      legFade: ['意义最重', '辅助', '最次要'],
      compare: '并排对照',
      fitsLabel: '为网页而设计', fitsTitle: '不同的网页，熟悉的阅读体验。',
      fitsBody: 'REden 的主题可以适应你正在阅读的网站背景。',
      fitsNote: '示意：同样的强调效果呈现在浅色和深色背景上。本网站本身保持黑白灰。',
      light: '浅色网页', dark: '深色网页',
      devLabel: '研发中', devTitle: '懂得你熟悉什么的强调方式。',
      devBody: '我们正在开发个人词频系统，帮助为每位读者定制加粗方式。目标是围绕你常遇到的词和可能需要更多关注的词，调整强调的程度。',
      futLabel: '未来方向', futTitle: '更多语言，更多理解的方式。',
      futBody: '我们的长期目标是把 REden 带到更多语言，提供尊重各语言不同结构的阅读辅助。我们也希望探索个性化强调如何帮助学习另一种语言的人。',
      futNote: '各种语言构造句子的方式不同，因此“主谓宾”并不会在所有语言中以同样方式适用。',
      joinLabel: '候补名单', joinTitle: '第一时间阅读下一期。', joinBody: 'REden 目前处于发布前阶段。留下邮箱即可加入候补名单。',
      emailLabel: '电子邮箱', protoLabel: '原型', proto: '此表单尚未连接候补名单服务，你输入的内容不会被发送或保存。',
      errEmail: '请输入类似 name@example.com 的邮箱地址。',
      okMsg: '仅为原型：谢谢，但由于尚未连接候补名单服务，你的邮箱没有被发送或保存。',
      footer: '发布前原型网站。本页的演示仅为示意。', top: '回到顶部',
      sr: '这个句子的主语是“the students”，谓语是“examined”，宾语是“the old map”。'
    },
    es: {
      skip: 'Ir a la demostración', edition: 'Edición de preestreno', langLabel: 'Idioma',
      tagline: 'La lectura, en foco',
      nav1: 'Cómo funciona', nav2: 'Se adapta a la página', nav3: 'En desarrollo', nav4: 'Futuro', nav5: 'Lista de espera',
      h1a: 'Encuentra el núcleo.', h1b: 'Sigue el sentido.',
      intro: 'REden te ayuda a centrarte en las palabras que llevan el significado de una oración. Al mostrar su estructura esencial o suavizar con delicadeza las palabras menos importantes, está pensado para favorecer una lectura más rápida y una comprensión más clara, manteniendo el texto completo en su lugar.',
      cta1: 'Unirme a la lista de espera', cta2: 'Ver cómo funciona',
      statusLabel: 'Estado', status: 'Preestreno. REden aún no está disponible para descargar.',
      demoLabel: 'La demostración', demoTitle: 'Una oración, dos modos de lectura', modeLegend: 'Modo de lectura',
      mOrig: 'Original', mStruct: 'Estructura de la oración', mFade: 'Gradación de importancia',
      altOrig: '', altStruct: '句子主干', altFade: '重点渐显',
      structTitle: 'Mira quién hace qué.', structCopy: 'REden resalta el sujeto, el verbo y el objeto para ayudarte a localizar la columna vertebral de la oración. El contexto sigue siendo legible.',
      fadeTitle: 'Que la idea principal destaque.', fadeCopy: 'REden usa cambios graduales de énfasis en el texto para dirigir tu atención hacia las palabras que más importan.',
      origTitle: 'La oración tal como está escrita.', origCopy: 'Sin ningún énfasis. Úsala como punto de partida para comparar los otros dos modos.',
      strength: 'Intensidad del énfasis', strengthHint: 'Ninguna palabra se oculta. Incluso el tono más claro se lee bien.',
      noteLabel: 'Nota', notice: 'Demostración ilustrativa. Esta oración está marcada a mano; no es un análisis lingüístico en vivo.',
      subject: 'Sujeto', verb: 'Verbo', object: 'Objeto',
      legStructCore: 'Núcleo: sujeto, verbo, objeto', legStructRest: 'Contexto',
      legFade: ['Más significado', 'De apoyo', 'Menos esencial'],
      compare: 'Lado a lado',
      fitsLabel: 'Pensado para encajar en la página', fitsTitle: 'Páginas distintas. Una experiencia de lectura familiar.',
      fitsBody: 'Los temas de REden pueden adaptarse al fondo del sitio web que estás leyendo.',
      fitsNote: 'Ilustrativo: el mismo énfasis sobre una superficie clara y una oscura. Este sitio se mantiene monocromo.',
      light: 'Página clara', dark: 'Página oscura',
      devLabel: 'En desarrollo', devTitle: 'Un énfasis que aprende lo que te resulta familiar.',
      devBody: 'Estamos desarrollando un sistema personal de frecuencia de palabras para adaptar las negritas a cada lector. El objetivo es ajustar el énfasis en torno a las palabras que encuentras a menudo y a las que pueden necesitar más atención.',
      futLabel: 'Dirección futura', futTitle: 'Más idiomas. Más formas de entender.',
      futBody: 'Nuestro objetivo a largo plazo es llevar REden a más idiomas, con un apoyo a la lectura que respete sus distintas estructuras. También queremos explorar cómo el énfasis personalizado puede ayudar a quienes estudian otro idioma.',
      futNote: 'Los idiomas construyen las oraciones de maneras distintas, así que sujeto–verbo–objeto no se aplicará igual en todas partes.',
      joinLabel: 'La lista de espera', joinTitle: 'Sé de los primeros en leer la próxima edición.', joinBody: 'REden está en preestreno. Añade tu correo para unirte a la lista de espera.',
      emailLabel: 'Correo electrónico', protoLabel: 'Prototipo', proto: 'Este formulario aún no está conectado a un servicio de lista de espera. Nada de lo que escribas se envía ni se guarda.',
      errEmail: 'Introduce un correo como nombre@ejemplo.com.',
      okMsg: 'Solo prototipo: gracias, pero tu correo no se envió ni se guardó porque aún no hay un servicio de lista de espera conectado.',
      footer: 'Sitio prototipo de preestreno. Las demostraciones de esta página son ilustrativas.', top: 'Volver arriba',
      sr: 'Oración con sujeto “the students”, verbo “examined” y objeto “the old map”.'
    },
    fr: {
      skip: 'Aller à la démonstration', edition: 'Édition de pré-lancement', langLabel: 'Langue',
      tagline: 'La lecture, mise au point',
      nav1: 'Fonctionnement', nav2: 'S’adapte à la page', nav3: 'En développement', nav4: 'Perspectives', nav5: 'Liste d’attente',
      h1a: 'Trouvez l’essentiel.', h1b: 'Suivez le sens.',
      intro: 'REden vous aide à vous concentrer sur les mots qui portent le sens d’une phrase. En faisant apparaître sa structure essentielle ou en atténuant doucement les mots moins importants, il est conçu pour favoriser une lecture plus rapide et une compréhension plus claire, tout en conservant le texte intégral.',
      cta1: 'Rejoindre la liste d’attente', cta2: 'Voir le fonctionnement',
      statusLabel: 'Statut', status: 'Pré-lancement. REden n’est pas encore disponible au téléchargement.',
      demoLabel: 'La démonstration', demoTitle: 'Une phrase, deux modes de lecture', modeLegend: 'Mode de lecture',
      mOrig: 'Original', mStruct: 'Structure de la phrase', mFade: 'Dégradé d’importance',
      altOrig: '', altStruct: '句子主干', altFade: '重点渐显',
      structTitle: 'Voyez qui fait quoi.', structCopy: 'REden met en évidence le sujet, le verbe et l’objet pour vous aider à repérer l’ossature de la phrase. Le contexte reste lisible.',
      fadeTitle: 'Laissez l’idée principale se détacher.', fadeCopy: 'REden utilise des variations progressives d’emphase pour guider votre attention vers les mots qui comptent le plus.',
      origTitle: 'La phrase telle qu’elle est écrite.', origCopy: 'Aucune emphase. Servez-vous-en comme référence pour comparer les deux autres modes.',
      strength: 'Intensité de l’emphase', strengthHint: 'Aucun mot n’est masqué. Même le ton le plus clair reste lisible.',
      noteLabel: 'Note', notice: 'Démonstration illustrative. Cette phrase est annotée à la main ; ce n’est pas une analyse linguistique en direct.',
      subject: 'Sujet', verb: 'Verbe', object: 'Objet',
      legStructCore: 'Noyau : sujet, verbe, objet', legStructRest: 'Contexte',
      legFade: ['Le plus de sens', 'Complément', 'Le moins essentiel'],
      compare: 'Côte à côte',
      fitsLabel: 'Conçu pour s’adapter à la page', fitsTitle: 'Des pages différentes. Une expérience de lecture familière.',
      fitsBody: 'Les thèmes de REden peuvent s’adapter à l’arrière-plan du site que vous lisez.',
      fitsNote: 'Illustratif : la même emphase sur une surface claire et sur une surface sombre. Ce site reste monochrome.',
      light: 'Page claire', dark: 'Page sombre',
      devLabel: 'En développement', devTitle: 'Une emphase qui apprend ce qui vous est familier.',
      devBody: 'Nous développons un système personnel de fréquence des mots pour adapter le gras à chaque lecteur. L’objectif est d’ajuster l’emphase autour des mots que vous rencontrez souvent et de ceux qui méritent peut-être plus d’attention.',
      futLabel: 'Perspectives', futTitle: 'Plus de langues. Plus de façons de comprendre.',
      futBody: 'Notre objectif à long terme est d’apporter REden à davantage de langues, avec une aide à la lecture qui respecte leurs structures différentes. Nous voulons aussi explorer comment une emphase personnalisée peut aider ceux qui étudient une autre langue.',
      futNote: 'Les langues construisent les phrases différemment ; sujet–verbe–objet ne s’appliquera donc pas partout de la même façon.',
      joinLabel: 'La liste d’attente', joinTitle: 'Soyez parmi les premiers à lire la prochaine édition.', joinBody: 'REden est en pré-lancement. Ajoutez votre e-mail pour rejoindre la liste d’attente.',
      emailLabel: 'Adresse e-mail', protoLabel: 'Prototype', proto: 'Ce formulaire n’est pas encore relié à un service de liste d’attente. Rien de ce que vous saisissez n’est envoyé ni enregistré.',
      errEmail: 'Saisissez une adresse comme nom@exemple.com.',
      okMsg: 'Prototype uniquement : merci, mais votre e-mail n’a été ni envoyé ni enregistré, car aucun service de liste d’attente n’est encore relié.',
      footer: 'Site prototype de pré-lancement. Les démonstrations de cette page sont illustratives.', top: 'Haut de page',
      sr: 'Phrase avec le sujet « the students », le verbe « examined » et l’objet « the old map ».'
    }
  };

  /* ---------- Example sentence (hand-marked, illustrative) ----------
     imp: 0..1 importance for Importance Fade. role: s / v / o for Sentence Structure. */
  var TOKENS = [
    { t: 'After', imp: .25 }, { t: 'the', imp: .15 }, { t: 'rain', imp: .6 }, { t: 'stopped,', imp: .55 },
    { t: 'the', imp: 1, role: 's' }, { t: 'students', imp: 1, role: 's' },
    { t: 'carefully', imp: .4 },
    { t: 'examined', imp: 1, role: 'v' },
    { t: 'the', imp: .9, role: 'o' }, { t: 'old', imp: .9, role: 'o' }, { t: 'map', imp: .9, role: 'o' },
    { t: 'in', imp: .2 }, { t: 'the', imp: .15 }, { t: 'library.', imp: .5 }
  ];
  var ROLE_KEY = { s: 'subject', v: 'verb', o: 'object' };

  /* Light / dark surfaces. Lightest tones keep at least 4.5:1 contrast. */
  var SURFACE = {
    light: { ink: [20, 20, 20], floor: [102, 102, 102] },   /* #666 on #faf7f0 ≈ 5.3:1 */
    dark:  { ink: [242, 242, 242], floor: [154, 154, 154] } /* #9a9a9a on #161616 ≈ 6.6:1 */
  };

  var state = { lang: 'en', mode: 'structure', strength: 70 };

  function mix(a, b, k) {
    var c = [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); });
    return 'rgb(' + c.join(',') + ')';
  }

  function render(el, mode, surface) {
    var sf = SURFACE[surface || 'light'];
    var s = state.strength / 100;
    var t = S[state.lang];
    el.textContent = '';
    var i = 0;
    while (i < TOKENS.length) {
      var tok = TOKENS[i];
      if (mode === 'structure' && tok.role) {
        var grp = document.createElement('span');
        grp.className = 'grp';
        var role = tok.role;
        while (i < TOKENS.length && TOKENS[i].role === role) {
          grp.appendChild(word(TOKENS[i], mode, sf, s));
          i++;
          if (i < TOKENS.length && TOKENS[i].role === role) grp.appendChild(document.createTextNode(' '));
        }
        var lab = document.createElement('span');
        lab.className = 'lab';
        lab.textContent = t[ROLE_KEY[role]];
        lab.setAttribute('aria-hidden', 'true');
        grp.appendChild(lab);
        el.appendChild(grp);
      } else {
        el.appendChild(word(tok, mode, sf, s));
        i++;
      }
      if (i < TOKENS.length) el.appendChild(document.createTextNode(' '));
    }
  }

  function word(tok, mode, sf, s) {
    var w = document.createElement('span');
    w.className = 'w';
    w.textContent = tok.t;
    var c;
    if (mode === 'original') c = mix(sf.ink, sf.ink, 0);
    else if (mode === 'structure') c = tok.role ? mix(sf.ink, sf.ink, 0) : mix(sf.ink, sf.floor, .8 * s);
    else c = mix(sf.ink, sf.floor, Math.pow(1 - tok.imp, .7) * s);
    w.style.color = c;
    return w;
  }

  function legend() {
    var t = S[state.lang], el = document.getElementById('legend');
    el.textContent = '';
    function item(bg, text) {
      var sp = document.createElement('span');
      var sw = document.createElement('i');
      sw.style.background = bg;
      sp.appendChild(sw);
      sp.appendChild(document.createTextNode(text));
      el.appendChild(sp);
    }
    var ink = 'rgb(20,20,20)', floor = 'rgb(102,102,102)';
    if (state.mode === 'structure') {
      item(ink, t.legStructCore);
      item(mix(SURFACE.light.ink, SURFACE.light.floor, .8 * state.strength / 100), t.legStructRest);
    } else if (state.mode === 'fade') {
      var ks = [0, .5, 1];
      t.legFade.forEach(function (txt, n) { item(mix(SURFACE.light.ink, SURFACE.light.floor, ks[n] * state.strength / 100), txt); });
    }
  }

  function paint() {
    var t = S[state.lang];
    render(document.getElementById('sentence'), state.mode, 'light');
    document.querySelectorAll('[data-cmp]').forEach(function (el) { render(el, el.getAttribute('data-cmp'), 'light'); });
    document.querySelectorAll('[data-surface]').forEach(function (el) { render(el, 'fade', el.getAttribute('data-surface')); });
    legend();
    var key = { original: 'orig', structure: 'struct', fade: 'fade' }[state.mode];
    document.getElementById('mode-title').textContent = t[key + 'Title'];
    document.getElementById('mode-copy').textContent = t[key + 'Copy'];
    document.getElementById('sentence-sr').textContent = state.mode === 'structure' ? t.sr : '';
    document.getElementById('strength-out').textContent = state.strength + '%';
  }

  function setLang(code, save) {
    if (!S[code]) code = 'en';
    state.lang = code;
    var t = S[code];
    document.documentElement.lang = code;
    document.documentElement.dir = 'ltr';
    document.title = 'REden — ' + t.h1a + ' ' + t.h1b;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t[el.getAttribute('data-i18n')];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-alt]').forEach(function (el) {
      el.textContent = t['alt' + el.getAttribute('data-alt').replace(/^./, function (c) { return c.toUpperCase(); })] || '';
      /* alt label is Chinese for non-zh, English for zh */
      el.lang = code === 'zh' ? 'en' : 'zh';
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === code));
    });
    var d = new Date();
    try { document.getElementById('today').textContent = d.toLocaleDateString(code, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) {}
    document.getElementById('today').setAttribute('datetime', d.toISOString().slice(0, 10));
    var msg = document.getElementById('wl-msg');
    msg.textContent = '';
    paint();
    if (save) { try { localStorage.setItem('reden-site-lang', code); } catch (e) {} }
  }

  /* ---------- Wire up ---------- */
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
  });
  document.querySelectorAll('input[name=mode]').forEach(function (r) {
    r.addEventListener('change', function () { state.mode = r.value; paint(); });
  });
  var range = document.getElementById('strength');
  range.addEventListener('input', function () { state.strength = +range.value; paint(); });

  var form = document.getElementById('wl'), email = document.getElementById('email'), msg = document.getElementById('wl-msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    email.setAttribute('aria-invalid', String(!ok));
    msg.textContent = ok ? S[state.lang].okMsg : S[state.lang].errEmail;
    /* Prototype: the address is deliberately not stored or sent anywhere. */
    if (ok) email.value = '';
  });

  var initial = 'en';
  try { initial = localStorage.getItem('reden-site-lang') || ''; } catch (e) {}
  if (!S[initial]) {
    var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    initial = S[nav] ? nav : 'en';
  }
  setLang(initial, false);
})();
