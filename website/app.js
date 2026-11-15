(function () {
  'use strict';

  /* ---------- Copy ---------- */
  var S = {
    en: {
      skip: 'Skip to the demonstration', edition: 'Reading edition',
      nav1: 'How it works', nav2: 'Fits the page', nav3: 'Reading emphasis', nav4: 'Future direction', nav5: 'Waitlist', nav6: 'Download',
      h1a: 'Find the core.', h1b: 'Follow the meaning.',
      intro: 'REden helps you focus on the words that carry a sentence’s meaning. By bringing its essential structure into view or gently softening less important words, it is designed to support faster reading and clearer understanding—while keeping the full text in place.',
      cta1: 'Join the waitlist', cta2: 'See how it works',
      statusLabel: 'Status', status: 'Download the extension and backend below.',
      demoLabel: 'The demonstration', demoTitle: 'One sentence, four ways to read.', modeLegend: 'Reading mode',
      mOrig: 'Original', mStruct: 'Sentence Structure', mFade: 'Importance Fade', mTree: 'Sentence Tree', mWords: 'Word check',
      origTitle: 'Start with the sentence as written.', origCopy: 'No emphasis at all. Every word carries the same weight, so your eye has to decide where to start.',
      structTitle: 'See who does what.', structCopy: 'REden highlights the subject, verb, and object to help you locate the backbone of a sentence. The surrounding context stays readable.',
      fadeTitle: 'Let the main idea stand out.', fadeCopy: 'REden uses gradual changes in text emphasis to guide your attention toward the words that matter most.',
      treeTitle: 'See how the sentence is built.', treeCopy: 'REden follows the sentence’s grammar tree. The deeper a word sits beneath the main verb, the lighter its tone, so the main line reads first and the details sit back.',
      wordsTitle: 'Spot the words you might not know.', wordsCopy: 'REden compares each word with how common it is in everyday English and with your own vocabulary level. A word you may not know gets an underline and a short note beside it, so you can keep reading.',
      wordsNote: 'In development. The note shown here is hand-written for illustration; which words get flagged will depend on your vocabulary level.',
      gloss: 'looked at closely',
      strength: 'Emphasis strength', strengthHint: 'Words are never hidden. Even the lightest tone stays readable.',
      noteLabel: 'Note', notice: 'Illustrative demonstration. This sentence is marked up by hand; it is not live language analysis.',
      subject: 'Subject', verb: 'Verb', object: 'Object',
      legStructCore: 'Core: subject, verb, object', legStructRest: 'Surrounding context',
      legFade: ['Most meaning', 'Supporting', 'Least essential'], legTree: ['Main line', 'Deeper in the tree'],
      fitsLabel: 'Designed to fit the page', fitsTitle: 'Different pages. A familiar reading experience.',
      fitsBody: 'REden’s themes can adapt to the background of the website you’re reading.',
      fitsNote: 'Illustrative: the same emphasis on a light and a dark page. This site stays black, white and gray.',
      surfLegend: 'Page background', surfAuto: 'Automatic', surfLight: 'Light', surfDark: 'Dark',
      devLabel: 'Available in the preview', devTitle: 'Emphasis shaped by words and meaning.',
      devBody: 'REden combines sentence structure with word frequency and word parts to choose which letters to bold. Important words receive stronger emphasis, while the full text stays visible.',
      futLabel: 'Future direction', futTitle: 'More languages. More ways to understand.',
      futBody: 'Our long-term goal is to bring REden to more languages, with reading support that respects their different structures. We also want to explore how personalized emphasis can help people studying another language.',
      futNote: 'Languages build sentences differently, so subject–verb–object will not apply the same way everywhere.',
      dlLabel: 'Developer preview', dlTitle: 'Get the extension.', dlBody: 'One file for Chrome, Microsoft Edge and Firefox. It is not in any browser store yet, so you add it by hand.',
      dlExt: 'Download the extension (.zip)', dlBack: 'Download the backend (.zip)',
      s1: 'Unzip the extension file.',
      sChrome2: 'Open <code>chrome://extensions</code> and turn on Developer mode.', sChrome3: 'Choose Load unpacked and pick the unzipped folder.',
      sEdge2: 'Open <code>edge://extensions</code> and turn on Developer mode.', sEdge3: 'Choose Load unpacked and pick the unzipped folder.',
      sFx2: 'Open <code>about:debugging#/runtime/this-firefox</code>.', sFx3: 'Choose Load Temporary Add-on and pick manifest.json in the folder. Firefox 128 or newer; it is removed when Firefox closes.',
      beLabel: 'Needs the backend', beBody: 'REden decides which words to bold on a small local server. Unzip the backend, run <code>pip install -r requirements.txt</code>, then <code>python server.py</code>. While it is not running, the extension does nothing.',
      joinLabel: 'The waitlist', joinTitle: 'Be the first to read the next edition.', joinBody: 'Get updates about REden and future releases.',
      protoLabel: 'Prototype', proto: 'This form is not connected to a waitlist service yet. Nothing you enter is sent or saved.',
      emailLabel: 'Email address',
      errEmail: 'Enter an email address like name@example.com.',
      okMsg: 'Prototype only: thanks, but your email was not sent or saved because no waitlist service is connected yet.',
      footer: 'REden · Find the core. Follow the meaning.', top: 'Back to top',
      sr: 'Sentence with subject “the students”, verb “examined”, and object “the old map”.'
    },
    zh: {
      skip: '跳到演示', edition: '阅读特刊',
      nav1: '工作方式', nav2: '适应网页', nav3: '阅读强调', nav4: '未来方向', nav5: '候补名单', nav6: '下载',
      h1a: '找到主干。', h1b: '读懂文意。',
      intro: 'REden 帮助你聚焦于承载句子意义的词语。它会呈现句子的基本结构，或轻轻淡化次要的词，旨在支持更快的阅读和更清晰的理解——同时完整保留原文。',
      cta1: '加入候补名单', cta2: '了解工作方式',
      statusLabel: '状态', status: '可在下方下载扩展和配套后端。',
      demoLabel: '互动演示', demoTitle: '一个句子，四种阅读方式。', modeLegend: '阅读模式',
      mOrig: '原文', mStruct: '句子主干', mFade: '重点渐显', mTree: '句子树', mWords: '生词提示',
      origTitle: '先看原句。', origCopy: '没有任何强调。每个词分量相同，需要你的眼睛自己决定从哪里开始。',
      structTitle: '看清谁做了什么。', structCopy: 'REden 会突出主语、谓语和宾语，帮助你找到句子的主干，周围的内容依然清晰易读。',
      fadeTitle: '让主旨自然浮现。', fadeCopy: 'REden 通过文字深浅的渐进变化，把你的注意力引向最重要的词。',
      treeTitle: '看清句子是怎么搭起来的。', treeCopy: 'REden 沿着句子的语法树来排布：词在主要动词之下越深，颜色越浅，让主线先被读到，细节退后一步。',
      wordsTitle: '发现你可能不认识的词。', wordsCopy: 'REden 会把每个词在日常英语中的常见程度与你自己的词汇量作比较。你可能不认识的词会加下划线，并在旁边附上简短说明，让你不必中断阅读。',
      wordsNote: '研发中。此处的说明为人工撰写，仅作示意；哪些词会被标出将取决于你的词汇量。',
      gloss: '仔细查看',
      strength: '强调强度', strengthHint: '文字绝不会消失，最浅的色调也依然清晰可读。',
      noteLabel: '说明', notice: '仅为示意演示。这个句子由人工标注，并非实时语言分析。',
      subject: '主语', verb: '谓语', object: '宾语',
      legStructCore: '主干：主语、谓语、宾语', legStructRest: '周围语境',
      legFade: ['意义最重', '辅助', '最次要'], legTree: ['主线', '树中更深处'],
      fitsLabel: '为网页而设计', fitsTitle: '不同的网页，熟悉的阅读体验。',
      fitsBody: 'REden 的主题可以适应你正在阅读的网站背景。',
      fitsNote: '示意：同样的强调效果呈现在浅色和深色页面上。本网站保持黑白灰。',
      surfLegend: '页面背景', surfAuto: '自动', surfLight: '浅色', surfDark: '深色',
      devLabel: '预览版已支持', devTitle: '让词语和句意决定强调方式。',
      devBody: 'REden 结合句子结构、词频和词形结构，选择需要加粗的字母。重要的词获得更强的强调，同时完整保留原文。',
      futLabel: '未来方向', futTitle: '更多语言，更多理解的方式。',
      futBody: '我们的长期目标是把 REden 带到更多语言，提供尊重各语言不同结构的阅读辅助。我们也希望探索个性化强调如何帮助学习另一种语言的人。',
      futNote: '各种语言构造句子的方式不同，因此“主谓宾”并不会在所有语言中以同样方式适用。',
      dlLabel: '开发者预览版', dlTitle: '获取扩展。', dlBody: '一个文件，适用于 Chrome、Microsoft Edge 和 Firefox。它还没有上架任何浏览器商店，需要手动添加。',
      dlExt: '下载扩展 (.zip)', dlBack: '下载后端 (.zip)',
      s1: '解压扩展文件。',
      sChrome2: '打开 <code>chrome://extensions</code>，开启“开发者模式”。', sChrome3: '点击“加载已解压的扩展程序”，选择解压后的文件夹。',
      sEdge2: '打开 <code>edge://extensions</code>，开启“开发人员模式”。', sEdge3: '点击“加载解压缩的扩展”，选择解压后的文件夹。',
      sFx2: '打开 <code>about:debugging#/runtime/this-firefox</code>。', sFx3: '点击“临时载入附加组件”，选择文件夹里的 manifest.json。需要 Firefox 128 或更新版本；关闭 Firefox 后会被移除。',
      beLabel: '需要后端', beBody: 'REden 通过本地的小型服务器决定哪些词需要加粗。解压后端文件，运行 <code>pip install -r requirements.txt</code>，再运行 <code>python server.py</code>。服务器没有运行时，扩展不会有任何效果。',
      joinLabel: '候补名单', joinTitle: '第一时间阅读下一期。', joinBody: '订阅 REden 的更新与新版本消息。',
      protoLabel: '原型', proto: '此表单尚未连接候补名单服务，你输入的内容不会被发送或保存。',
      emailLabel: '电子邮箱',
      errEmail: '请输入类似 name@example.com 的邮箱地址。',
      okMsg: '仅为原型：谢谢，但由于尚未连接候补名单服务，你的邮箱没有被发送或保存。',
      footer: 'REden · 找到核心，读懂含义。', top: '回到顶部',
      sr: '这个句子的主语是“the students”，谓语是“examined”，宾语是“the old map”。'
    },
    es: {
      skip: 'Ir a la demostración', edition: 'Edición de lectura',
      nav1: 'Cómo funciona', nav2: 'Se adapta a la página', nav3: 'Énfasis de lectura', nav4: 'Futuro', nav5: 'Lista de espera', nav6: 'Descargar',
      h1a: 'Encuentra el núcleo.', h1b: 'Sigue el sentido.',
      intro: 'REden te ayuda a centrarte en las palabras que llevan el significado de una oración. Al mostrar su estructura esencial o suavizar con delicadeza las palabras menos importantes, está pensado para favorecer una lectura más rápida y una comprensión más clara, manteniendo el texto completo en su lugar.',
      cta1: 'Unirme a la lista de espera', cta2: 'Ver cómo funciona',
      statusLabel: 'Estado', status: 'Descarga la extensión y el servidor a continuación.',
      demoLabel: 'La demostración', demoTitle: 'Una oración, cuatro formas de leer.', modeLegend: 'Modo de lectura',
      mOrig: 'Original', mStruct: 'Estructura de la oración', mFade: 'Gradación de importancia', mTree: 'Árbol de la oración', mWords: 'Palabras nuevas',
      origTitle: 'Empieza con la oración tal como está escrita.', origCopy: 'Sin ningún énfasis. Todas las palabras pesan lo mismo, así que tu vista debe decidir por dónde empezar.',
      structTitle: 'Mira quién hace qué.', structCopy: 'REden resalta el sujeto, el verbo y el objeto para ayudarte a localizar la columna vertebral de la oración. El contexto sigue siendo legible.',
      fadeTitle: 'Que la idea principal destaque.', fadeCopy: 'REden usa cambios graduales de énfasis en el texto para dirigir tu atención hacia las palabras que más importan.',
      treeTitle: 'Mira cómo está construida la oración.', treeCopy: 'REden sigue el árbol gramatical de la oración. Cuanto más abajo del verbo principal está una palabra, más claro es su tono: se lee primero la línea principal y los detalles quedan atrás.',
      wordsTitle: 'Detecta las palabras que quizá no conozcas.', wordsCopy: 'REden compara cada palabra con lo común que es en el inglés cotidiano y con tu propio nivel de vocabulario. Una palabra que quizá no conozcas lleva un subrayado y una nota breve al lado, para que sigas leyendo.',
      wordsNote: 'En desarrollo. La nota es un ejemplo escrito a mano; qué palabras se marcan dependerá de tu nivel de vocabulario.',
      gloss: 'miró con atención',
      strength: 'Intensidad del énfasis', strengthHint: 'Ninguna palabra se oculta. Incluso el tono más claro se lee bien.',
      noteLabel: 'Nota', notice: 'Demostración ilustrativa. Esta oración está marcada a mano; no es un análisis lingüístico en vivo.',
      subject: 'Sujeto', verb: 'Verbo', object: 'Objeto',
      legStructCore: 'Núcleo: sujeto, verbo, objeto', legStructRest: 'Contexto',
      legFade: ['Más significado', 'De apoyo', 'Menos esencial'], legTree: ['Línea principal', 'Más profundo en el árbol'],
      fitsLabel: 'Pensado para encajar en la página', fitsTitle: 'Páginas distintas. Una experiencia de lectura familiar.',
      fitsBody: 'Los temas de REden pueden adaptarse al fondo del sitio web que estás leyendo.',
      fitsNote: 'Ilustrativo: el mismo énfasis sobre una página clara y una oscura. Este sitio se mantiene en blanco, negro y gris.',
      surfLegend: 'Fondo de la página', surfAuto: 'Automático', surfLight: 'Claro', surfDark: 'Oscuro',
      devLabel: 'Disponible en la versión preliminar', devTitle: 'Un énfasis guiado por las palabras y el sentido.',
      devBody: 'REden combina la estructura de las frases, la frecuencia de las palabras y sus partes para elegir qué letras resaltar en negrita. Las palabras importantes reciben más énfasis y el texto se mantiene completo.',
      futLabel: 'Dirección futura', futTitle: 'Más idiomas. Más formas de entender.',
      futBody: 'Nuestro objetivo a largo plazo es llevar REden a más idiomas, con un apoyo a la lectura que respete sus distintas estructuras. También queremos explorar cómo el énfasis personalizado puede ayudar a quienes estudian otro idioma.',
      futNote: 'Los idiomas construyen las oraciones de maneras distintas, así que sujeto–verbo–objeto no se aplicará igual en todas partes.',
      dlLabel: 'Vista previa para desarrolladores', dlTitle: 'Consigue la extensión.', dlBody: 'Un solo archivo para Chrome, Microsoft Edge y Firefox. Aún no está en ninguna tienda de extensiones, así que se añade a mano.',
      dlExt: 'Descargar la extensión (.zip)', dlBack: 'Descargar el backend (.zip)',
      s1: 'Descomprime el archivo de la extensión.',
      sChrome2: 'Abre <code>chrome://extensions</code> y activa el modo de desarrollador.', sChrome3: 'Elige Cargar descomprimida y selecciona la carpeta.',
      sEdge2: 'Abre <code>edge://extensions</code> y activa el modo de desarrollador.', sEdge3: 'Elige Cargar descomprimida y selecciona la carpeta.',
      sFx2: 'Abre <code>about:debugging#/runtime/this-firefox</code>.', sFx3: 'Elige Cargar complemento temporal y selecciona manifest.json de la carpeta. Requiere Firefox 128 o posterior; se elimina al cerrar Firefox.',
      beLabel: 'Necesita el backend', beBody: 'REden decide qué palabras poner en negrita en un pequeño servidor local. Descomprime el backend, ejecuta <code>pip install -r requirements.txt</code> y luego <code>python server.py</code>. Mientras no esté en marcha, la extensión no hace nada.',
      joinLabel: 'La lista de espera', joinTitle: 'Sé de los primeros en leer la próxima edición.', joinBody: 'Recibe novedades de REden y sus próximas versiones.',
      protoLabel: 'Prototipo', proto: 'Este formulario aún no está conectado a un servicio de lista de espera. Nada de lo que escribas se envía ni se guarda.',
      emailLabel: 'Correo electrónico',
      errEmail: 'Introduce un correo como nombre@ejemplo.com.',
      okMsg: 'Solo prototipo: gracias, pero tu correo no se envió ni se guardó porque aún no hay un servicio de lista de espera conectado.',
      footer: 'REden · Encuentra lo esencial. Sigue el sentido.', top: 'Volver arriba',
      sr: 'Oración con sujeto “the students”, verbo “examined” y objeto “the old map”.'
    },
    fr: {
      skip: 'Aller à la démonstration', edition: 'Édition lecture',
      nav1: 'Fonctionnement', nav2: 'S’adapte à la page', nav3: 'Mise en relief', nav4: 'Perspectives', nav5: 'Liste d’attente', nav6: 'Télécharger',
      h1a: 'Trouvez l’essentiel.', h1b: 'Suivez le sens.',
      intro: 'REden vous aide à vous concentrer sur les mots qui portent le sens d’une phrase. En faisant apparaître sa structure essentielle ou en atténuant doucement les mots moins importants, il est conçu pour favoriser une lecture plus rapide et une compréhension plus claire, tout en conservant le texte intégral.',
      cta1: 'Rejoindre la liste d’attente', cta2: 'Voir le fonctionnement',
      statusLabel: 'Statut', status: 'Téléchargez l’extension et le serveur ci-dessous.',
      demoLabel: 'La démonstration', demoTitle: 'Une phrase, quatre façons de lire.', modeLegend: 'Mode de lecture',
      mOrig: 'Original', mStruct: 'Structure de la phrase', mFade: 'Dégradé d’importance', mTree: 'Arbre de la phrase', mWords: 'Mots inconnus',
      origTitle: 'Commencez par la phrase telle qu’elle est écrite.', origCopy: 'Aucune emphase. Tous les mots ont le même poids : à vos yeux de décider par où commencer.',
      structTitle: 'Voyez qui fait quoi.', structCopy: 'REden met en évidence le sujet, le verbe et l’objet pour vous aider à repérer l’ossature de la phrase. Le contexte reste lisible.',
      fadeTitle: 'Laissez l’idée principale se détacher.', fadeCopy: 'REden utilise des variations progressives d’emphase pour guider votre attention vers les mots qui comptent le plus.',
      treeTitle: 'Voyez comment la phrase est construite.', treeCopy: 'REden suit l’arbre grammatical de la phrase. Plus un mot est profond sous le verbe principal, plus son ton est clair : la ligne principale se lit d’abord, les détails restent en retrait.',
      wordsTitle: 'Repérez les mots que vous ne connaissez peut-être pas.', wordsCopy: 'REden compare chaque mot à sa fréquence dans l’anglais courant et à votre propre niveau de vocabulaire. Un mot que vous ne connaissez peut-être pas est souligné et accompagné d’une courte note, pour que vous puissiez continuer à lire.',
      wordsNote: 'En développement. La note est écrite à la main pour illustrer ; les mots signalés dépendront de votre niveau de vocabulaire.',
      gloss: 'regardé de près',
      strength: 'Intensité de l’emphase', strengthHint: 'Aucun mot n’est masqué. Même le ton le plus clair reste lisible.',
      noteLabel: 'Note', notice: 'Démonstration illustrative. Cette phrase est annotée à la main ; ce n’est pas une analyse linguistique en direct.',
      subject: 'Sujet', verb: 'Verbe', object: 'Objet',
      legStructCore: 'Noyau : sujet, verbe, objet', legStructRest: 'Contexte',
      legFade: ['Le plus de sens', 'Complément', 'Le moins essentiel'], legTree: ['Ligne principale', 'Plus profond dans l’arbre'],
      fitsLabel: 'Conçu pour s’adapter à la page', fitsTitle: 'Des pages différentes. Une expérience de lecture familière.',
      fitsBody: 'Les thèmes de REden peuvent s’adapter à l’arrière-plan du site que vous lisez.',
      fitsNote: 'Illustratif : la même emphase sur une page claire et sur une page sombre. Ce site reste noir, blanc et gris.',
      surfLegend: 'Arrière-plan de la page', surfAuto: 'Automatique', surfLight: 'Clair', surfDark: 'Sombre',
      devLabel: 'Disponible dans l’aperçu', devTitle: 'Une mise en relief guidée par les mots et le sens.',
      devBody: 'REden combine la structure des phrases, la fréquence des mots et leurs composants pour choisir les lettres à mettre en gras. Les mots importants sont davantage mis en valeur et le texte reste intégral.',
      futLabel: 'Perspectives', futTitle: 'Plus de langues. Plus de façons de comprendre.',
      futBody: 'Notre objectif à long terme est d’apporter REden à davantage de langues, avec une aide à la lecture qui respecte leurs structures différentes. Nous voulons aussi explorer comment une emphase personnalisée peut aider ceux qui étudient une autre langue.',
      futNote: 'Les langues construisent les phrases différemment ; sujet–verbe–objet ne s’appliquera donc pas partout de la même façon.',
      dlLabel: 'Aperçu développeur', dlTitle: 'Obtenez l’extension.', dlBody: 'Un seul fichier pour Chrome, Microsoft Edge et Firefox. Elle n’est pas encore dans une boutique d’extensions ; on l’ajoute à la main.',
      dlExt: 'Télécharger l’extension (.zip)', dlBack: 'Télécharger le backend (.zip)',
      s1: 'Décompressez le fichier de l’extension.',
      sChrome2: 'Ouvrez <code>chrome://extensions</code> et activez le mode développeur.', sChrome3: 'Choisissez Charger l’extension non empaquetée et sélectionnez le dossier.',
      sEdge2: 'Ouvrez <code>edge://extensions</code> et activez le mode développeur.', sEdge3: 'Choisissez Charger l’extension décompressée et sélectionnez le dossier.',
      sFx2: 'Ouvrez <code>about:debugging#/runtime/this-firefox</code>.', sFx3: 'Choisissez Charger un module complémentaire temporaire et sélectionnez manifest.json dans le dossier. Firefox 128 ou plus récent ; il est retiré à la fermeture de Firefox.',
      beLabel: 'Nécessite le backend', beBody: 'REden décide quels mots mettre en gras grâce à un petit serveur local. Décompressez le backend, lancez <code>pip install -r requirements.txt</code>, puis <code>python server.py</code>. Tant qu’il ne tourne pas, l’extension ne fait rien.',
      joinLabel: 'La liste d’attente', joinTitle: 'Soyez parmi les premiers à lire la prochaine édition.', joinBody: 'Recevez les nouvelles de REden et de ses prochaines versions.',
      protoLabel: 'Prototype', proto: 'Ce formulaire n’est pas encore relié à un service de liste d’attente. Rien de ce que vous saisissez n’est envoyé ni enregistré.',
      emailLabel: 'Adresse e-mail',
      errEmail: 'Saisissez une adresse comme nom@exemple.com.',
      okMsg: 'Prototype uniquement : merci, mais votre e-mail n’a été ni envoyé ni enregistré, car aucun service de liste d’attente n’est encore relié.',
      footer: 'REden · Trouvez l’essentiel. Suivez le sens.', top: 'Haut de page',
      sr: 'Phrase avec le sujet « the students », le verbe « examined » et l’objet « the old map ».'
    }
  };

  /* ---------- Example sentence (hand-marked, illustrative) ----------
     imp: 0..1 importance (Importance Fade). role: s/v/o (Structure). dep: depth under the main verb (Tree). */
  var TOKENS = [
    { t: 'After', imp: .25, dep: 2 }, { t: 'the', imp: .15, dep: 3 }, { t: 'rain', imp: .6, dep: 2 }, { t: 'stopped,', imp: .55, dep: 1 },
    { t: 'the', imp: 1, dep: 2, role: 's' }, { t: 'students', imp: 1, dep: 1, role: 's' },
    { t: 'carefully', imp: .4, dep: 1 },
    { t: 'examined', imp: 1, dep: 0, role: 'v', unk: true },
    { t: 'the', imp: .9, dep: 2, role: 'o' }, { t: 'old', imp: .9, dep: 2, role: 'o' }, { t: 'map', imp: .9, dep: 1, role: 'o' },
    { t: 'in', imp: .2, dep: 1 }, { t: 'the', imp: .15, dep: 3 }, { t: 'library.', imp: .5, dep: 2 }
  ];
  var MAX_DEP = 3;
  var ROLE_KEY = { s: 'subject', v: 'verb', o: 'object' };

  /* Light / dark surfaces. Lightest tones keep at least 4.5:1 contrast. */
  var SURFACE = {
    light: { ink: [20, 20, 20], floor: [102, 102, 102] },
    dark:  { ink: [242, 242, 242], floor: [154, 154, 154] }
  };

  var MOTION = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var state = { lang: 'en', mode: 'original', words: false, strength: 70, surface: 'auto', scheme: 'dark' };

  function mix(a, b, k) {
    var c = [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); });
    return 'rgb(' + c.join(',') + ')';
  }

  /* ---------- Sentence rendering ---------- */
  function word(tok, mode, sf, s, withWords) {
    var w = document.createElement('span');
    w.className = 'w';
    w.textContent = tok.t;
    var k = 0;
    if (mode === 'structure') k = tok.role ? 0 : .8 * s;
    else if (mode === 'fade') k = Math.pow(1 - tok.imp, .7) * s;
    else if (mode === 'tree') k = (tok.dep / MAX_DEP) * s;
    w.style.color = mix(sf.ink, sf.floor, k);
    if (withWords && tok.unk) {
      w.className += ' unk';
      var wrap = document.createDocumentFragment();
      wrap.appendChild(w);
      var g = document.createElement('span');
      g.className = 'gloss';
      g.lang = state.lang;
      g.textContent = S[state.lang].gloss;
      wrap.appendChild(g);
      return wrap;
    }
    return w;
  }

  function render(el, mode, surface, withWords) {
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
          grp.appendChild(word(TOKENS[i], mode, sf, s, withWords));
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
        el.appendChild(word(tok, mode, sf, s, withWords));
        i++;
      }
      if (i < TOKENS.length) el.appendChild(document.createTextNode(' '));
    }
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
    var L = SURFACE.light, s = state.strength / 100;
    if (state.mode === 'structure') {
      item(mix(L.ink, L.floor, 0), t.legStructCore);
      item(mix(L.ink, L.floor, .8 * s), t.legStructRest);
    } else if (state.mode === 'fade') {
      [0, .5, 1].forEach(function (k, n) { item(mix(L.ink, L.floor, k * s), t.legFade[n]); });
    } else if (state.mode === 'tree') {
      item(mix(L.ink, L.floor, 0), t.legTree[0]);
      item(mix(L.ink, L.floor, s), t.legTree[1]);
    }
  }

  /* ---------- Gradient paragraphs: key phrases stay dark, tone softens with distance ---------- */
  var KEYS = {
    en: { intro: ['words that carry', 'essential structure', 'faster reading', 'clearer understanding', 'full text in place'],
          origCopy: ['No emphasis', 'your eye has to decide'],
          structCopy: ['subject, verb, and object', 'backbone'], fadeCopy: ['gradual changes', 'words that matter most'],
          treeCopy: ['grammar tree', 'main verb', 'main line reads first'],
          wordsCopy: ['underline', 'short note', 'your own vocabulary level'],
          fitsBody: ['adapt to the background'], devBody: ['sentence structure', 'word frequency', 'letters to bold'],
          futBody: ['more languages', 'respects their different structures', 'studying another language'] },
    zh: { intro: ['承载句子意义的词语', '基本结构', '更快的阅读', '更清晰的理解', '完整保留原文'],
          origCopy: ['没有任何强调', '自己决定从哪里开始'],
          structCopy: ['主语、谓语和宾语', '主干'], fadeCopy: ['渐进变化', '最重要的词'],
          treeCopy: ['语法树', '主要动词', '主线先被读到'],
          wordsCopy: ['下划线', '简短说明', '你自己的词汇量'],
          fitsBody: ['适应', '网站背景'], devBody: ['句子结构', '词频', '加粗的字母'],
          futBody: ['更多语言', '尊重各语言不同结构', '学习另一种语言'] },
    es: { intro: ['palabras que llevan el significado', 'estructura esencial', 'lectura más rápida', 'comprensión más clara', 'texto completo'],
          origCopy: ['Sin ningún énfasis', 'decidir por dónde empezar'],
          structCopy: ['sujeto, el verbo y el objeto', 'columna vertebral'], fadeCopy: ['cambios graduales', 'palabras que más importan'],
          treeCopy: ['árbol gramatical', 'verbo principal', 'línea principal'],
          wordsCopy: ['subrayado', 'nota breve', 'tu propio nivel de vocabulario'],
          fitsBody: ['adaptarse al fondo'], devBody: ['estructura de las frases', 'frecuencia de las palabras', 'letras resaltar'],
          futBody: ['más idiomas', 'respete sus distintas estructuras', 'estudian otro idioma'] },
    fr: { intro: ['mots qui portent le sens', 'structure essentielle', 'lecture plus rapide', 'compréhension plus claire', 'texte intégral'],
          origCopy: ['Aucune emphase', 'décider par où commencer'],
          structCopy: ['sujet, le verbe et l’objet', 'ossature'], fadeCopy: ['variations progressives', 'mots qui comptent le plus'],
          treeCopy: ['arbre grammatical', 'verbe principal', 'ligne principale se lit d’abord'],
          wordsCopy: ['souligné', 'courte note', 'votre propre niveau de vocabulaire'],
          fitsBody: ['s’adapter à l’arrière-plan'], devBody: ['structure des phrases', 'fréquence des mots', 'lettres à mettre en gras'],
          futBody: ['davantage de langues', 'respecte leurs structures différentes', 'étudient une autre langue'] }
  };

  function fadeText(el, text, phrases, scheme) {
    var s = state.strength / 100, sf = SURFACE[scheme || 'light'];
    var marks = new Array(text.length).fill(false);
    (phrases || []).forEach(function (p) {
      var at = text.indexOf(p);
      if (at > -1) for (var i = at; i < at + p.length; i++) marks[i] = true;
    });
    var toks = [], re = state.lang === 'zh' ? /[\s\S]/g : /\S+|\s+/g, m;
    while ((m = re.exec(text))) toks.push({ t: m[0], key: marks[m.index], gap: /^\s+$/.test(m[0]) });
    var real = toks.filter(function (k) { return !k.gap; });
    var near = state.lang === 'zh' ? 10 : 5;
    real.forEach(function (k, i) {
      var d = 99;
      if (k.key) d = 0;
      else for (var j = 0; j < real.length; j++) if (real[j].key) d = Math.min(d, Math.abs(i - j));
      k.d = d;
    });
    el.textContent = '';
    toks.forEach(function (k) {
      if (k.gap) { el.appendChild(document.createTextNode(k.t)); return; }
      var sp = document.createElement('span');
      sp.className = 'w';
      sp.textContent = k.t;
      if (k.key) { sp.style.color = mix(sf.ink, sf.ink, 0); sp.style.fontWeight = '600'; }
      else sp.style.color = mix(sf.ink, sf.floor, Math.min(1, .25 + k.d / near) * s);
      el.appendChild(sp);
    });
  }

  function paintFades() {
    var t = S[state.lang], keys = KEYS[state.lang];
    document.querySelectorAll('[data-fade]').forEach(function (el) {
      var id = el.getAttribute('data-i18n');
      var inZone = !!el.closest('.dark-zone');
      fadeText(el, t[id], keys[id], inZone ? state.scheme : 'light');
    });
  }

  /* ---------- Paint everything ---------- */
  function paint() {
    var t = S[state.lang];
    render(document.getElementById('sentence'), state.mode, 'light', state.words);
    document.querySelectorAll('[data-render]').forEach(function (el) {
      render(el, el.getAttribute('data-render'), 'light', el.getAttribute('data-words') === '1');
    });
    render(document.getElementById('adapt-sentence'), 'fade', state.scheme, false);
    legend();
    paintFades();
    var key = { original: 'orig', structure: 'struct', fade: 'fade', tree: 'tree' }[state.mode];
    document.getElementById('sentence-sr').textContent = (state.words ? t.wordsTitle + ' ' : '') + t[key + 'Title'] + (state.mode === 'structure' ? ' ' + t.sr : '');
    document.getElementById('strength-out').textContent = state.strength + '%';
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.checked = r.value === state.mode; });
    document.getElementById('words').checked = state.words;
    if (typeof placeLines === 'function') placeLines(false);
  }


  /* ---------- Hero: letters that rotate (intro roll-in, and a spin under the pointer) ---------- */
  var h1 = document.getElementById('h1');
  function splitHero() {
    if (!MOTION) return;
    var idx = 0;
    h1.querySelectorAll('[data-i18n]').forEach(function (line) {
      var text = line.textContent;
      line.setAttribute('aria-label', text);
      line.textContent = '';
      var chars = state.lang === 'zh' ? Array.from(text) : null;
      var words = state.lang === 'zh' ? [chars] : text.split(' ').map(function (w) { return Array.from(w); });
      words.forEach(function (w, wi) {
        var wd = document.createElement('span');
        wd.className = 'wd';
        wd.setAttribute('aria-hidden', 'true');
        w.forEach(function (chr) {
          var c = document.createElement('span'), inner = document.createElement('i');
          c.className = 'ch';
          inner.textContent = chr;
          inner.style.setProperty('--i', idx++);
          inner.dataset.r = '0';
          c.appendChild(inner);
          wd.appendChild(c);
        });
        line.appendChild(wd);
        if (wi < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });
  }
  function introHero(first) {
    if (!MOTION) return;
    h1.classList.add('pre');
    h1.classList.remove('go');
    requestAnimationFrame(function () { requestAnimationFrame(function () { h1.classList.remove('pre'); setTimeout(function () { h1.classList.add('go'); }, 1800); }); });
  }
  function spinLetter(e) {
    if (!MOTION) return;
    var c = e.target.closest && e.target.closest('.ch');
    if (!c) return;
    var i = c.firstChild;
    if (i.dataset.spin === '1') return;
    i.dataset.spin = '1';
    i.dataset.r = String(+i.dataset.r + 360);
    i.style.transform = 'rotateX(' + i.dataset.r + 'deg)';
    setTimeout(function () { i.dataset.spin = '0'; }, 900);
  }
  h1.addEventListener('pointerover', function (e) { if (e.pointerType !== 'touch') spinLetter(e); });
  h1.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') spinLetter(e); });


  /* ---------- Bouncy small titles: words hop in when they scroll into view ---------- */
  var BOUNCE_SEL = '.label, .tag, h2, .step h3 .u, .browsers h3';
  var BOUNCE_SKIP = '.strength, .seg, .proto, .status, .notice, .sr, .cue, .legend, .bar';
  var bio = null;
  function wrapWords(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) if (!n.parentNode.classList.contains('bi') && n.nodeValue.trim()) nodes.push(n);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      var parts = state.lang === 'zh' ? Array.from(node.nodeValue) : node.nodeValue.split(/(\s+)/);
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        var w = document.createElement('span'), i = document.createElement('span');
        w.className = state.lang === 'zh' ? 'bw' : 'bw';
        i.className = 'bi';
        i.textContent = p;
        w.appendChild(i);
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    el.querySelectorAll('.bi').forEach(function (b, k) { b.style.setProperty('--d', Math.min(k, 14) * 70 + 'ms'); });
  }
  function bouncify() {
    if (!MOTION) return;
    document.querySelectorAll(BOUNCE_SEL).forEach(function (el) {
      if (el.closest(BOUNCE_SKIP)) return;
      wrapWords(el);
      if (!bio) {
        if (!('IntersectionObserver' in window)) { el.classList.add('bounce-on'); return; }
        bio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('bounce-on'); });
        }, { threshold: .4 });
      }
      if (bio) bio.observe(el);
    });
  }
  function replayBounce(el) {
    if (!el || !MOTION) return;
    el.classList.remove('bounce-on');
    void el.offsetWidth;
    el.classList.add('bounce-on');
  }

  /* ---------- Language ---------- */
  function setLang(code, save) {
    if (!S[code]) code = 'en';
    state.lang = code;
    var t = S[code];
    document.documentElement.lang = code;
    document.title = 'REden — ' + t.h1a + ' ' + t.h1b;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t[el.getAttribute('data-i18n')];
      if (typeof v !== 'string' || el.hasAttribute('data-fade')) return;
      if (v.indexOf('<code>') > -1) el.innerHTML = v; else el.textContent = v;
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === code));
    });
    var d = new Date(), today = document.getElementById('today');
    try { today.textContent = d.toLocaleDateString(code, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) {}
    today.setAttribute('datetime', d.toISOString().slice(0, 10));
    document.getElementById('wl-msg').textContent = '';
    splitHero();
    bouncify();
    paint();
    placeLines(true);
    if (save) { try { localStorage.setItem('reden-site-lang', code); } catch (e) {} }
  }


  /* ---------- Sliding underline (one bar glides to the hovered or chosen item) ---------- */
  var slides = Array.prototype.slice.call(document.querySelectorAll('[data-slide]')).map(function (fs) {
    var bar = document.createElement('i');
    bar.className = 'slide-line nt';
    bar.setAttribute('aria-hidden', 'true');
    fs.appendChild(bar);
    var labels = Array.prototype.slice.call(fs.querySelectorAll('label'));
    function checked() { return labels.filter(function (l) { return l.querySelector('input').checked; })[0] || labels[0]; }
    function to(l) { bar.style.width = l.offsetWidth + 'px'; bar.style.transform = 'translateX(' + l.offsetLeft + 'px)'; }
    labels.forEach(function (l) { l.addEventListener('mouseenter', function () { to(l); }); });
    fs.addEventListener('mouseleave', function () { to(checked()); });
    fs.addEventListener('change', function () { to(checked()); });
    return { bar: bar, place: function (instant) { if (instant) bar.classList.add('nt'); to(checked()); if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.remove('nt'); }); }); } };
  });
  function placeLines(instant) { slides.forEach(function (s) { s.place(instant); }); }
  window.addEventListener('resize', function () { placeLines(true); });

  /* ---------- Scroll staging ---------- */
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var activeStep = -1;

  function activate(i, fromControl) {
    if (i === activeStep) return;
    activeStep = i;
    steps.forEach(function (s, n) { s.classList.toggle('on', n === i); });
    var st = steps[i];
    replayBounce(st.querySelector('h3 .u'));
    state.mode = st.getAttribute('data-mode');
    state.words = st.getAttribute('data-words') === '1';
    paint();
  }

  function jumpTo(i) {
    var r = steps[i].getBoundingClientRect();
    var top = window.scrollY + r.top + r.height / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  }

  function onControl() {
    paint();
    if (!MOTION) return;
    var wantWords = state.words ? '1' : '0';
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].getAttribute('data-mode') === state.mode && steps[i].getAttribute('data-words') === wantWords) {
        if (i !== activeStep) { activeStep = i; steps.forEach(function (s, n) { s.classList.toggle('on', n === i); }); jumpTo(i); }
        return;
      }
    }
    activeStep = -1;
    steps.forEach(function (s) { s.classList.remove('on'); });
  }

  if (MOTION && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activate(steps.indexOf(e.target)); });
    }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });
    steps.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Light-to-dark zone ---------- */
  var zone = document.getElementById('zone');
  function setScheme(p, scheme) {
    zone.style.setProperty('--p', String(p));
    if (scheme !== state.scheme) {
      state.scheme = scheme;
      zone.setAttribute('data-scheme', scheme);
      render(document.getElementById('adapt-sentence'), 'fade', state.scheme, false);
      paintFades();
    }
  }
  function updateZone() {
    if (state.surface !== 'auto') return;
    var vh = window.innerHeight, top = zone.getBoundingClientRect().top;
    var p = Math.min(1, Math.max(0, (vh * 0.9 - top) / (vh * 0.55)));
    setScheme(Math.round(p * 1000) / 1000, p > .4 ? 'dark' : 'light');
  }
  var ticking = false;
  if (MOTION) {
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; updateZone(); });
    }, { passive: true });
    window.addEventListener('resize', updateZone);
  }

  /* ---------- Wire up ---------- */
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
  });
  document.querySelectorAll('input[name=mode]').forEach(function (r) {
    r.addEventListener('change', function () { state.mode = r.value; onControl(); });
  });
  document.getElementById('words').addEventListener('change', function (e) { state.words = e.target.checked; onControl(); });
  var range = document.getElementById('strength');
  range.addEventListener('input', function () { state.strength = +range.value; paint(); });
  document.querySelectorAll('input[name=surface]').forEach(function (r) {
    r.addEventListener('change', function () {
      state.surface = r.value;
      if (r.value === 'light') setScheme(0, 'light');
      else if (r.value === 'dark') setScheme(1, 'dark');
      else if (MOTION) updateZone(); else setScheme(1, 'dark');
    });
  });

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
  if (MOTION) { state.scheme = 'light'; zone.setAttribute('data-scheme', 'light'); zone.style.setProperty('--p', '0'); }
  setLang(initial, false);
  introHero();
  placeLines(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placeLines(true); });
  if (MOTION) updateZone();
})();
