/* Shared deterministic engine for both themes. No animations, timers, randomness or network. */
(function () {
  'use strict';
  var C = (window.Core = {});
  var clamp = (C.clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return x < a ? a : x > b ? b : x; });
  var easeOut = (C.easeOut = function (x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); });
  var easeInOut = (C.easeInOut = function (x) { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; });
  var easeBack = (C.easeBack = function (x) { x = clamp(x); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); });
  var prog = (C.prog = function (t, s, d) { return clamp((t - s) / d); });
  var lerp = (C.lerp = function (a, b, k) { return a + (b - a) * k; });

  C.MOODS = { respectful: [233, 196, 106], happy: [255, 190, 90], informative: [60, 200, 170], excited: [170, 230, 80], calm: [110, 170, 255], enthusiastic: [255, 160, 70] };
  var CREAM = [255, 248, 230], GOLD = [233, 196, 106];

  /* ---------- Bengali digits ---------- */
  C.toBn = function (n) {
    var s = String(Math.round(n)), out;
    if (s.length > 3) { var head = s.slice(0, -3), tail = s.slice(-3); head = head.replace(/\B(?=(\d{2})+(?!\d))/g, ','); out = head + ',' + tail; } else out = s;
    return out.replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'.charAt(+d); });
  };

  /* ---------- Timestamps ---------- */
  C.parse = function (raw) {
    var scenes = [], warnings = [];
    String(raw).split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var p = line.split('|'); if (p.length < 3) return;
      var s = parseFloat(p[0]), e = parseFloat(p[1]); if (isNaN(s) || isNaN(e)) return;
      var mood = (p[3] || '').trim().toLowerCase(); if (!C.MOODS[mood]) mood = 'happy';
      scenes.push({ start: s, end: e, raw: p[2].trim(), mood: mood });
    });
    scenes.sort(function (a, b) { return a.start - b.start; });
    for (var i = 1; i < scenes.length; i++) if (scenes[i - 1].end > scenes[i].start) { warnings.push('overlap trimmed at ' + scenes[i].start); scenes[i - 1].end = scenes[i].start; }
    scenes.forEach(function (sc) {
      var hl = false, buf = '', words = [], names = [], curName = [];
      function flush() { if (buf) { words.push({ t: buf, hl: hl }); if (hl) curName.push(buf); buf = ''; } }
      var chars = Array.from(sc.raw);
      chars.forEach(function (ch) {
        if (ch === '\u275D') { flush(); hl = true; }
        else if (ch === '\u275E') { flush(); hl = false; if (curName.length) { names.push(curName.join(' ')); curName = []; } }
        else if (/\s/.test(ch)) flush(); else buf += ch;
      });
      flush(); if (curName.length) names.push(curName.join(' '));
      sc.plain = sc.raw.replace(/[\u275D\u275E]/g, ''); sc.words = words; sc.names = names;
      var tw = 0; words.forEach(function (w) { w.w = Array.from(w.t).length + 1; tw += w.w; });
      var span = Math.max(0.6, (sc.end - sc.start) - 0.55), cum = 0;
      words.forEach(function (w) { w.st = 0.15 + (cum / tw) * span; cum += w.w; w.en = 0.15 + (cum / tw) * span; });
    });
    scenes.warnings = warnings;
    return scenes;
  };

  /* ---------- Scene design ---------- */
  var ICON_RULES = [
    [/তাফসী|তাফসির/, 'book-open'], [/কানযুল/, 'book'], [/ইরফানুল|কুরআন/, 'quran'], [/হাদিস|হাদীস/, 'book-open'],
    [/পিডিএফ/, 'pdf'], [/কিতাব|বই/, 'library'], [/লেখক/, 'pen'], [/বিষয়/, 'grid'], [/নামাজ|সময়/, 'clock'],
    [/সেহরি|ইফতার/, 'crescent'], [/কিবলা|কম্পাস/, 'compass'], [/মসজিদ/, 'mosque'], [/তাসবিহ/, 'beads'],
    [/বয়ান|নাত/, 'voice'], [/দোয়া/, 'scroll'], [/নাম/, 'tag'], [/হারামাইন|সম্প্রচার/, 'kaaba'],
    [/ইনস্টল/, 'download'], [/অ্যাপ/, 'phone'], [/ভাষা|বিশ্ব/, 'globe'], [/ভালোবাসা|দয়া/, 'heart'], [/খুঁজ/, 'magnifier']
  ];
  C.pickIcon = function (label) { for (var i = 0; i < ICON_RULES.length; i++) if (ICON_RULES[i][0].test(label)) return ICON_RULES[i][1]; return 'star8'; };

  /* Hand-checked designs for the supplied script (labels are exact words from each line; spelled-out numbers converted by hand). */
  var MAN = {
    'এতে পাবেন আল কুরআনের দুটি বিশুদ্ধ অনুবাদ কানযুল ঈমান ও ইরফানুল কুরআন,': { items: ['কানযুল ঈমান', 'ইরফানুল কুরআন'], nums: [{ v: 2, label: 'বিশুদ্ধ অনুবাদ' }] },
    'সাথে সম্পূর্ণ তাফসীরে মাযহারী,': { items: ['তাফসীরে মাযহারী'] },
    'তাফসীরে খাযাইনুল ইরফানসহ চলমান রয়েছে আটটি তাফসিরের কাজ।': { items: ['তাফসীরে খাযাইনুল ইরফান'], nums: [{ v: 8, label: 'তাফসিরের কাজ' }] },
    'পঁয়তাল্লিশটি হাদিস গ্রন্থে দুই লক্ষ সত্তর হাজার তিনশো পঁয়ত্রিশটি হাদিস এখন এক অ্যাপেই।': { nums: [{ v: 45, label: 'হাদিস গ্রন্থ' }, { v: 270335, label: 'হাদিস' }] },
    'আটশত এর বেশি অফলাইন কিতাব,': { nums: [{ v: 800, label: 'অফলাইন কিতাব', plus: true }] },
    'এক হাজারের বেশি অনলাইন পিডিএফ বই,': { nums: [{ v: 1000, label: 'অনলাইন পিডিএফ বই', plus: true }] },
    'লেখক ও বিষয়ভিত্তিক সুন্দরভাবে সাজানো।': { items: ['লেখক', 'বিষয়ভিত্তিক'] },
    'নামাজের সময়, সেহরি ইফতার,': { items: ['নামাজের সময়', 'সেহরি ইফতার'] },
    'কিবলা কম্পাস, মসজিদ খুঁজি,': { items: ['কিবলা কম্পাস', 'মসজিদ খুঁজি'] },
    'ডিজিটাল তাসবিহ সব কিছু এক অ্যাপেই।': { items: ['ডিজিটাল তাসবিহ'] },
    'আরও রয়েছে বয়ান, নাত,': { items: ['বয়ান', 'নাত'] },
    'মাসনুন দোয়া, ইসলামিক নাম ও লাইভ হারামাইন সম্প্রচার।': { items: ['মাসনুন দোয়া', 'ইসলামিক নাম', 'লাইভ হারামাইন সম্প্রচার'] }
  };
  var BN2EN = function (s) { return s.replace(/[০-৯]/g, function (d) { return '০১২৩৪৫৬৭৮৯'.indexOf(d); }); };

  C.design = function (sc, idx, n) {
    var d = { type: 'plain', items: [], nums: [], icons: null };
    var txt = sc.plain;
    if (idx === n - 1) { d.type = 'closing'; d.icons = ['crescent', 'book', 'star8']; return d; }
    if (/আসসালামু|السلام|assalamu/i.test(txt)) { d.type = 'greet'; return d; }
    if (/প্লে স্টোর|play store|app store/i.test(txt)) {
      d.type = 'store'; var k = txt.indexOf('ইনস্টল'); var cut = sc.raw.indexOf('\u275D');
      d.cta = (cut > 0 ? sc.raw.slice(0, cut) : txt).trim(); d.appName = sc.names[0] || ''; return d;
    }
    if (sc.names.length) { d.type = 'brand'; return d; }
    var m = MAN[txt];
    if (m) { (m.items || []).forEach(function (t) { d.items.push({ t: t, icon: C.pickIcon(t) }); }); d.nums = (m.nums || []).slice(); }
    else {
      var mm = BN2EN(txt).match(/\d[\d,]*/g);
      if (mm) mm.forEach(function (x) { d.nums.push({ v: parseInt(x.replace(/,/g, ''), 10), label: '', plus: /বেশি|over|more than/i.test(txt) }); });
      var parts = txt.replace(/[।.]$/, '').split(/\s*[,،]\s*|\s+ও\s+|\s+and\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (parts.length > 1 && parts.length <= 3 && parts.every(function (x) { return x.split(/\s+/).length <= 4; })) parts.forEach(function (t) { d.items.push({ t: t, icon: C.pickIcon(t) }); });
    }
    if (d.items.length > 3) d.items.length = 3;
    d.type = d.items.length ? 'cards' : d.nums.length ? 'nums' : 'plain';
    return d;
  };

  /* ---------- Icons: original 100x100 line-art, gold gradient ---------- */
  function star(n, ro, ri, rot, cx, cy) { var p = []; for (var i = 0; i < n * 2; i++) { var r = i % 2 ? ri : ro, a = rot + i * Math.PI / n - Math.PI / 2; p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); } return p.join(' '); }
  var S = function (d, c) { return '<path class="' + (c || 'ik-s') + '" d="' + d + '"/>'; };
  var ICONS = {
    crescent: S('M64 12A40 40 0 1 0 88 68A32 32 0 1 1 64 12Z', 'ik-a') + '<polygon class="ik-g" points="' + star(4, 9, 3, 0, 78, 30) + '"/>',
    star8: '<polygon class="ik-a" points="' + star(8, 42, 24, 0, 50, 50) + '"/><circle class="ik-g" cx="50" cy="50" r="8"/>',
    star4: '<path class="ik-g" d="M50 8C54 36 64 46 92 50C64 54 54 64 50 92C46 64 36 54 8 50C36 46 46 36 50 8Z"/>',
    diamond: '<polygon class="ik-g" points="50,10 90,50 50,90 10,50"/>',
    arabesque: [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<ellipse class="ik-a" cx="50" cy="27" rx="9" ry="19" transform="rotate(' + i * 45 + ' 50 50)"/>'; }).join('') + '<circle class="ik-g" cx="50" cy="50" r="8"/>',
    book: '<rect class="ik-a" x="22" y="12" width="56" height="76" rx="7"/>' + S('M34 12V88') + S('M44 30H68') + S('M44 42H62') + '<path class="ik-g" d="M60 88V70L66 75L72 70V88Z"/>',
    quran: '<rect class="ik-a" x="22" y="12" width="56" height="76" rx="7"/>' + S('M32 12V88') + '<polygon class="ik-s" points="' + star(8, 17, 9, 0, 56, 44) + '"/><circle class="ik-g" cx="56" cy="44" r="4"/>' + S('M42 70H70'),
    'book-open': '<path class="ik-a" d="M50 28C38 19 22 19 10 24V78C22 73 38 73 50 82C62 73 78 73 90 78V24C78 19 62 19 50 28Z"/>' + S('M50 28V82') + S('M20 38C28 36 36 37 42 40') + S('M20 50C28 48 36 49 42 52') + S('M58 40C64 37 72 36 80 38') + S('M58 52C64 49 72 48 80 50'),
    library: '<rect class="ik-a" x="12" y="30" width="18" height="56" rx="3"/><rect class="ik-a" x="34" y="16" width="18" height="70" rx="3"/><path class="ik-a" d="M56 32L72 28L84 82L68 86Z"/>' + S('M18 44H24') + S('M40 30H46') + S('M8 90H92'),
    pdf: '<path class="ik-a" d="M24 10H60L78 28V90H24Z"/>' + S('M60 10V28H78') + S('M34 44H68') + S('M34 56H68') + S('M34 68H56') + '<polygon class="ik-g" points="' + star(4, 7, 3, 0, 66, 78) + '"/>',
    mosque: '<path class="ik-a" d="M28 62C28 36 72 36 72 62Z"/>' + S('M50 28V16') + '<path class="ik-g" d="M50 12A5 5 0 1 0 55 18A4 4 0 1 1 50 12Z"/><rect class="ik-a" x="26" y="62" width="48" height="26" rx="2"/><path class="ik-s" d="M43 88V76A7 7 0 0 1 57 76V88"/><rect class="ik-a" x="10" y="42" width="10" height="46" rx="2"/><rect class="ik-a" x="80" y="42" width="10" height="46" rx="2"/><path class="ik-g" d="M10 42L15 30L20 42ZM80 42L85 30L90 42Z"/>',
    magnifier: '<circle class="ik-a" cx="42" cy="42" r="26"/>' + S('M61 61L86 86') + '<path class="ik-s" d="M30 34A14 14 0 0 1 40 28"/>',
    phone: '<rect class="ik-a" x="28" y="8" width="44" height="84" rx="9"/>' + S('M28 22H72') + S('M28 76H72') + '<circle class="ik-g" cx="50" cy="84" r="3"/><polygon class="ik-g" points="' + star(8, 13, 7, 0, 50, 49) + '"/>',
    download: S('M50 12V60') + S('M30 42L50 62L70 42') + S('M16 70V86H84V70'),
    globe: '<circle class="ik-a" cx="50" cy="50" r="38"/><ellipse class="ik-s" cx="50" cy="50" rx="16" ry="38"/>' + S('M12 50H88') + S('M18 30C40 38 60 38 82 30') + S('M18 70C40 62 60 62 82 70'),
    heart: '<path class="ik-a" d="M50 86C10 58 14 22 36 22C44 22 48 28 50 32C52 28 56 22 64 22C86 22 90 58 50 86Z"/>',
    pen: '<path class="ik-a" d="M72 10L90 28L40 78L16 86L22 62Z"/>' + S('M60 22L78 40') + S('M22 62L40 78') + '<circle class="ik-g" cx="22" cy="80" r="3"/>',
    grid: '<rect class="ik-a" x="12" y="12" width="32" height="32" rx="7"/><rect class="ik-a" x="56" y="12" width="32" height="32" rx="7"/><rect class="ik-a" x="12" y="56" width="32" height="32" rx="7"/><rect class="ik-g" x="56" y="56" width="32" height="32" rx="7"/>',
    clock: '<circle class="ik-a" cx="50" cy="50" r="38"/>' + S('M50 26V50L67 60') + S('M50 14V19') + S('M50 81V86') + S('M14 50H19') + S('M81 50H86') + '<circle class="ik-g" cx="50" cy="50" r="4"/>',
    compass: '<circle class="ik-a" cx="50" cy="50" r="38"/><polygon class="ik-g" points="50,20 60,50 40,50"/><polygon class="ik-s" points="50,80 60,50 40,50"/><circle class="ik-g" cx="50" cy="50" r="4"/>' + S('M50 8V13'),
    pin: '<path class="ik-a" d="M50 92C26 64 20 52 20 38A30 30 0 0 1 80 38C80 52 74 64 50 92Z"/><circle class="ik-g" cx="50" cy="38" r="11"/>',
    beads: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { var a = i / 10 * 2 * Math.PI; return '<circle class="ik-a" cx="' + (50 + 30 * Math.cos(a)).toFixed(1) + '" cy="' + (38 + 26 * Math.sin(a)).toFixed(1) + '" r="7"/>'; }).join('') + S('M50 66V82') + '<path class="ik-g" d="M44 80H56L58 94H42Z"/>',
    voice: S('M18 40V60') + S('M30 28V72') + S('M42 16V84') + S('M54 30V70') + S('M66 22V78') + S('M78 36V64') + S('M90 44V56'),
    scroll: '<rect class="ik-a" x="22" y="12" width="56" height="14" rx="7"/><rect class="ik-a" x="28" y="26" width="44" height="48"/><rect class="ik-a" x="22" y="74" width="56" height="14" rx="7"/>' + S('M36 40H64') + S('M36 52H64') + S('M36 62H54'),
    tag: '<rect class="ik-a" x="12" y="28" width="76" height="44" rx="10"/>' + S('M30 48H70') + S('M30 60H58') + '<polygon class="ik-g" points="' + star(8, 7, 4, 0, 24, 40) + '"/>',
    kaaba: '<rect class="ik-a" x="14" y="38" width="52" height="48"/><path class="ik-a" d="M66 38L86 28V76L66 86Z"/><path class="ik-a" d="M14 38L34 28H86L66 38Z"/><path class="ik-g" d="M14 48H66V56H14ZM66 48L86 38V46L66 56Z"/><rect class="ik-s" x="48" y="62" width="10" height="24"/>',
    play: '<path class="ik-g" d="M32 18L82 50L32 82Z"/>'
  };
  C.ICONS = ICONS;
  C.iconDefs = function () {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true"><defs><linearGradient id="gG" gradientUnits="userSpaceOnUse" x1="10" y1="8" x2="90" y2="92"><stop offset="0" stop-color="#f6dc8e"/><stop offset="1" stop-color="#c9973a"/></linearGradient>';
    Object.keys(ICONS).forEach(function (k) { s += '<symbol id="ic-' + k + '" viewBox="0 0 100 100">' + ICONS[k] + '</symbol>'; });
    return s + '</defs></svg>';
  };
  C.icon = function (name, size, cls) { return '<svg class="ic ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100"><use href="#ic-' + name + '"/></svg>'; };

  /* ---------- CSS ---------- */
  C.CSS = function () {
    return "@font-face{font-family:'SolaimanLipi';src:url('assets/fonts/SolaimanLipi-Regular.ttf') format('truetype');font-weight:400;font-style:normal;font-display:block}" +
      "@font-face{font-family:'SolaimanLipi';src:url('assets/fonts/SolaimanLipi-Bold.ttf') format('truetype');font-weight:700;font-style:normal;font-display:block}" +
      ":root{--g1:#04210f;--g2:#0a4a2a;--g3:#14804a;--gold:#e9c46a;--gold2:#c9973a;--cream:#fff8e6}" +
      "html,body{margin:0;padding:0;background:#021208}" +
      "#stage{position:relative;overflow:hidden;color:var(--cream);font-family:'Noto Serif','SolaimanLipi','Noto Serif Bengali','Noto Sans Bengali',serif}" +
      "#stage *{box-sizing:border-box}.abs{position:absolute}" +
      ".ik-s{fill:none;stroke:url(#gG);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.ik-g{fill:url(#gG);stroke:none}.ik-a{fill:#14804a;fill-opacity:.55;stroke:url(#gG);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.ic{display:block;overflow:visible}" +
      ".sv{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;visibility:hidden}" +
      ".sglow{position:absolute;left:-6%;top:-6%;right:-6%;bottom:-6%}.si{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;max-width:100%}" +
      ".arabic{font-family:'Noto Naskh Arabic','Noto Naskh Arabic UI',serif;color:var(--gold);line-height:1.5;white-space:nowrap}" +
      ".cards{display:flex;flex-direction:column;align-items:center}.card{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(10,74,42,.96),rgba(4,33,15,.97));border:3px solid var(--gold2);will-change:transform}" +
      ".clabel{color:var(--cream);font-weight:700;line-height:1.3;text-align:center}.numb{text-align:center}.nv{color:var(--gold);font-weight:700;line-height:1.15}.nl{color:var(--cream);font-weight:700;line-height:1.3}" +
      ".bwrap{position:relative;display:flex;align-items:center;justify-content:center}.bwrap img{display:block}.tap{position:absolute;border-radius:50%;border:5px solid var(--cream);pointer-events:none}" +
      ".appn{color:var(--gold);font-weight:700;text-align:center;margin-top:22px}.nbtn{display:flex;align-items:center;gap:20px;padding:22px 44px;border-radius:999px;background:linear-gradient(135deg,#f6dc8e,#c9973a);color:#04210f;font-weight:700}.nbtn .ic{flex:none}.nbtn .ik-g{fill:#04210f}" +
      ".closing{display:flex;align-items:center;justify-content:center}" +
      ".cap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-wrap:wrap;gap:4px 18px;justify-content:center;align-content:center;font-weight:700;visibility:hidden}.w{display:inline-block;opacity:0;white-space:nowrap}" +
      ".panel{position:absolute;padding:5px}.pin{position:absolute;left:5px;top:5px;right:5px;bottom:5px;overflow:hidden;background:radial-gradient(90% 70% at 20% 0%,rgba(20,128,74,.38),transparent 60%),radial-gradient(80% 80% at 90% 100%,rgba(201,151,58,.16),transparent 60%),linear-gradient(180deg,#07301a,#031a0c)}" +
      ".dots{position:absolute;left:0;top:0;right:0;bottom:0;background-image:radial-gradient(rgba(233,196,106,.16) 1.6px,transparent 1.8px);background-size:26px 26px}.sweep{position:absolute;top:-20%;bottom:-20%;width:22%;background:linear-gradient(100deg,transparent,rgba(255,248,230,.10),transparent);transform:skewX(-18deg)}" +
      ".eq{position:absolute;display:flex;align-items:flex-end;justify-content:space-between}.eqb{flex:1;margin:0 2px;border-radius:4px;background:linear-gradient(180deg,#f6dc8e,#c9973a)}" +
      ".part{position:absolute;border-radius:50%;background:radial-gradient(circle,#f6dc8e,rgba(233,196,106,0))}";
  };

  /* ---------- Engine ---------- */
  C.run = function (cfg) {
    var S = cfg.S, st = { scenes: [], total: 0, env: null, fps: 30, opts: {}, logoRatio: 0.81 };
    var els = {};
    function $(id) { return document.getElementById(id); }
    function mk(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
    function level(t) {
      if (st.env && st.env.length) return st.env[Math.floor(t * st.fps) % st.env.length];
      return clamp(0.38 + 0.20 * Math.sin(3.1 * t) + 0.12 * Math.sin(7.7 * t + 1));
    }
    C.level = level;
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

    function buildVisual(sc, d, idx) {
      var sv = mk('div', 'sv', els.vis), c = C.MOODS[sc.mood];
      var glow = mk('div', 'sglow', sv); glow.style.background = 'radial-gradient(closest-side,' + rgba(c, 0.34) + ',' + rgba(c, 0.10) + ' 60%,transparent 100%)';
      var si = mk('div', 'si', sv), o = { sv: sv, si: si, glow: glow, d: d, k: 1, upd: function () {} };
      if (d.type === 'greet') {
        var ar = mk('div', 'arabic', si, 'السَّلَامُ عَلَيْكُمْ'); ar.style.fontSize = S.arabic + 'px';
        o.upd = function (lt, lv) { var s = lerp(0.85, 1, easeOut(prog(lt, 0, 0.8))); ar.style.transform = 'scale(' + s + ')'; ar.style.textShadow = '0 0 ' + (30 + 70 * lv) + 'px ' + rgba(GOLD, 0.45 + 0.4 * lv); };
      } else if (d.type === 'brand') {
        var ic = mk('div', '', si, C.icon('star8', cfg.brandIcon || 0)); ic.style.display = cfg.brandIcon ? 'block' : 'none';
        o.upd = function (lt, lv) { if (!cfg.brandIcon) return; ic.style.transform = 'translateY(' + (Math.sin(2 * lt) * 8) + 'px) rotate(' + (lt * 12) + 'deg)'; ic.style.filter = 'drop-shadow(0 0 ' + (16 + 40 * lv) + 'px ' + rgba(GOLD, 0.6) + ')'; };
      } else if (d.type === 'cards' || d.type === 'nums') {
        var compact = d.items.length >= 3, cards = [], nums = [];
        var cs = mk('div', 'cards', si); cs.style.gap = S.gap + 'px';
        d.items.forEach(function (it, i) {
          var cd = mk('div', 'card', cs); cd.style.minWidth = S.cardMin + 'px'; cd.style.maxWidth = S.cardMax + 'px'; cd.style.padding = S.padV + 'px ' + S.padH + 'px'; cd.style.borderRadius = S.radius + 'px'; cd.style.gap = '28px';
          var isz = compact ? S.iconC : S.icon; var ih = mk('div', '', cd, C.icon(it.icon, isz)); ih.style.flex = 'none';
          var lb = mk('div', 'clabel', cd, it.t); lb.style.fontSize = (compact ? S.labelC : S.label) + 'px';
          cards.push({ cd: cd, ih: ih, lb: lb });
        });
        var withCards = d.items.length > 0, ns = mk('div', '', si); ns.style.display = 'flex'; ns.style.flexDirection = 'column'; ns.style.alignItems = 'center'; ns.style.gap = (withCards ? 4 : 18) + 'px'; if (withCards) ns.style.marginTop = '14px';
        d.nums.forEach(function (n, j) {
          var nb = mk('div', 'numb', ns); var nv = mk('div', 'nv', nb); var nl = mk('div', 'nl', nb, n.label || '');
          nv.style.fontSize = ((j === 0 && !withCards) ? S.num : S.num2) + 'px'; nl.style.fontSize = S.numLabel + 'px'; nums.push({ nv: nv, nl: nl, n: n, j: j });
        });
        var dur = sc.end - sc.start;
        o.upd = function (lt, lv, t) {
          cards.forEach(function (c2, i) {
            var s0 = 0.25 + i * 0.8, p = prog(lt, s0, 0.7);
            c2.cd.style.transform = 'translateX(' + ((1 - easeBack(p)) * 420) + 'px)'; c2.cd.style.opacity = easeOut(prog(lt, s0, 0.35));
            c2.cd.style.boxShadow = '0 0 ' + (14 + 40 * lv) + 'px ' + rgba(GOLD, 0.12 + 0.3 * lv);
            c2.ih.style.transform = 'translateY(' + (Math.sin(2.2 * t + i * 1.3) * 4) + 'px) scale(' + (1 + 0.05 * Math.sin(2.6 * t + i)) + ')';
            c2.ih.style.filter = 'drop-shadow(0 0 ' + (4 + 18 * lv) + 'px ' + rgba(GOLD, 0.55) + ')';
          });
          var cd0 = Math.min(3.2, Math.max(1.4, dur * 0.6));
          nums.forEach(function (x) {
            var b = (withCards ? 0.25 + d.items.length * 0.8 : 0.3) + x.j * 0.5, p = easeOut(prog(lt, b, cd0));
            x.nv.textContent = C.toBn(x.n.v * p) + (x.n.plus ? '+' : ''); x.nv.style.opacity = easeOut(prog(lt, b - 0.1, 0.3));
            x.nl.style.opacity = easeOut(prog(lt, b, 0.4)); x.nv.style.textShadow = '0 0 ' + (16 + 40 * lv) + 'px ' + rgba(GOLD, 0.35 + 0.3 * lv);
          });
        };
      } else if (d.type === 'store') {
        var bw = mk('div', 'bwrap', si), badge = null;
        if (st.opts.badge) {
          badge = mk('div', '', bw); badge.style.position = 'relative'; var im = mk('img', '', badge); im.src = st.opts.badge;
          var cr = st.opts.badgeCrop;
          if (cr) { var k2 = S.badgeW / cr.w; badge.style.width = S.badgeW + 'px'; badge.style.height = (cr.h * k2) + 'px'; badge.style.overflow = 'hidden'; badge.style.borderRadius = (0.12 * cr.h * k2) + 'px'; im.style.cssText = 'position:absolute;max-width:none;width:' + (cr.iw * k2) + 'px;left:' + (-cr.x * k2) + 'px;top:' + (-cr.y * k2) + 'px'; }
          else { im.style.width = S.badgeW + 'px'; }
          badge.style.filter = 'drop-shadow(0 18px 26px rgba(0,0,0,.55))';
        } else {
          badge = mk('div', 'nbtn', bw, C.icon('play', Math.round(S.btn * 1.1)) + '<span>' + d.cta + '</span>'); badge.style.fontSize = S.btn + 'px';
        }
        var tap = mk('div', 'tap', bw); tap.style.width = S.tap + 'px'; tap.style.height = S.tap + 'px'; tap.style.left = '72%'; tap.style.top = '58%'; tap.style.marginLeft = -S.tap / 2 + 'px'; tap.style.marginTop = -S.tap / 2 + 'px';
        var an = mk('div', 'appn', si, d.appName); an.style.fontSize = S.appName + 'px';
        o.badge = badge;
        o.upd = function (lt, lv, t) {
          var pp = easeBack(prog(lt, 0.4, 0.7)); badge.style.transform = 'translateY(' + (Math.sin(2.4 * t) * 7) + 'px) scale(' + pp + ')'; badge.style.opacity = easeOut(prog(lt, 0.4, 0.3));
          if (lt >= 2.0) { var q = ((lt - 2.0) % 1.3) / 1.3; tap.style.opacity = (1 - q) * 0.9; tap.style.transform = 'scale(' + (0.35 + 0.65 * easeOut(q)) + ')'; } else tap.style.opacity = 0;
          an.style.opacity = easeOut(prog(lt, 1.2, 0.5)); an.style.transform = 'translateY(' + (1 - easeOut(prog(lt, 1.2, 0.5))) * 20 + 'px)';
        };
      } else if (d.type === 'closing') {
        var row = mk('div', 'closing', si); row.style.gap = Math.round(S.closeIcon * 0.5) + 'px'; if (cfg.closingBottom) { sv.style.alignItems = 'flex-end'; sv.style.paddingBottom = cfg.closingBottom + 'px'; }
        var ics = d.icons.map(function (n) { var h = mk('div', '', row, C.icon(n, S.closeIcon)); return h; });
        o.upd = function (lt, lv, t) {
          ics.forEach(function (h, i) { var p = easeBack(prog(lt, 0.3 + i * 0.25, 0.7)); h.style.transform = 'translateY(' + (Math.sin(2 * t + i * 1.7) * 6) + 'px) scale(' + (p * (1 + 0.05 * Math.sin(2.6 * t + i))) + ')'; h.style.filter = 'drop-shadow(0 0 ' + (6 + 26 * lv) + 'px ' + rgba(GOLD, 0.6) + ')'; });
        };
      }
      return o;
    }

    window.init = function (raw, opts) {
      opts = opts || {}; st.opts = opts;
      var stage = $('stage'); stage.style.width = cfg.W + 'px'; stage.style.height = cfg.H + 'px';
      var style = mk('style', '', document.head); style.textContent = C.CSS();
      var idiv = mk('div', '', document.body); idiv.innerHTML = C.iconDefs();
      els.vis = $('vis'); els.capbox = $('capbox'); els.logo = $('logo'); els.panel = $('panel'); els.eq = $('eq');
      /* background layers (inserted first) */
      var first = stage.firstChild, bg = mk('div', 'abs'), star = mk('div', 'abs'), glow = mk('div', 'abs'), parts = mk('div', 'abs');
      bg.style.cssText = 'left:0;top:0;right:0;bottom:0;background:' + cfg.bg;
      star.style.cssText = 'left:' + (cfg.star.cx - cfg.star.size / 2) + 'px;top:' + (cfg.star.cy - cfg.star.size / 2) + 'px;width:' + cfg.star.size + 'px;height:' + cfg.star.size + 'px';
      star.innerHTML = '<svg width="100%" height="100%" viewBox="-50 -50 100 100" fill="none" stroke="#e9c46a" stroke-width="0.35"><rect x="-30" y="-30" width="60" height="60"/><rect x="-30" y="-30" width="60" height="60" transform="rotate(45)"/><circle r="20"/><circle r="33"/><circle r="42"/></svg>';
      glow.style.cssText = 'left:0;top:0;right:0;bottom:0;background:' + cfg.glow;
      parts.style.cssText = 'left:0;top:0;width:' + cfg.W + 'px;height:' + cfg.H + 'px';
      [bg, star, glow, parts].forEach(function (e) { stage.insertBefore(e, first); }); els.star = star; els.glow = glow; els.parts = parts;
      els.pa = []; for (var i = 0; i < 38; i++) { var p = mk('div', 'part', parts), sz = 5 + (i % 5) * 2.4; p.style.width = sz + 'px'; p.style.height = sz + 'px'; els.pa.push(p); }
      var vig = mk('div', 'abs', stage); vig.style.cssText = 'left:0;top:0;right:0;bottom:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)';
      var pb = mk('div', 'abs', stage); pb.style.cssText = cfg.progress + ';background:rgba(255,248,230,.14);border-radius:99px;overflow:hidden';
      els.pbar = mk('div', '', pb); els.pbar.style.cssText = 'height:100%;width:0;background:linear-gradient(90deg,#c9973a,#f6dc8e);border-radius:99px';
      /* panel */
      els.panel.className = 'panel'; var pin = mk('div', 'pin', els.panel); els.pin = pin; pin.style.borderRadius = (cfg.panelR - 5) + 'px'; els.panel.style.borderRadius = cfg.panelR + 'px';
      mk('div', 'dots', pin); els.sweep = mk('div', 'sweep', pin); cfg.panelOrn(pin, C);
      els.eq.className = 'eq'; pin.appendChild(els.eq); els.eqb = []; for (i = 0; i < cfg.eq.n; i++) els.eqb.push(mk('div', 'eqb', els.eq));
      pin.appendChild(els.capbox);
      /* scenes */
      var sc = C.parse(raw); st.scenes = sc; st.total = (sc.length ? sc[sc.length - 1].end : 0) + 0.5; st.warnings = sc.warnings;
      st.brand = null; sc.forEach(function (s, i) { s.d = C.design(s, i, sc.length); if (s.d.type === 'brand' && !st.brand) st.brand = s; });
      st.last = sc[sc.length - 1];
      sc.forEach(function (s, i) {
        s.v = buildVisual(s, s.d, i);
        var cap = mk('div', 'cap', els.capbox); s.cap = cap; s.wel = s.words.map(function (w) { var e = mk('span', 'w', cap, w.t); e.dataset.hl = w.hl ? '1' : ''; if (w.hl) e.style.color = '#e9c46a'; return e; });
      });
      var lg = els.logo.querySelector('img'); lg.src = opts.logo || 'assets/logo.png';
      if (cfg.onInit) cfg.onInit(st, els, C);
      return st.total;
    };

    function overflow(s) {
      var cap = s.cap, h = cap.clientHeight, w = cap.clientWidth, mn = 1e9, mx = -1e9, wd = 0;
      s.wel.forEach(function (e) { mn = Math.min(mn, e.offsetTop); mx = Math.max(mx, e.offsetTop + e.offsetHeight); wd = Math.max(wd, e.offsetWidth); });
      return mx > h + 1 || mn < -1 || wd > w;
    }
    window.fit = function () {
      var out = { caption: [], visual: [] };
      var lg = els.logo.querySelector('img'); if (lg.naturalWidth) st.logoRatio = lg.naturalHeight / lg.naturalWidth;
      st.scenes.forEach(function (s) {
        var len = Array.from(s.plain).length, size = cfg.capStart(len);
        s.cap.style.fontSize = size + 'px';
        while (overflow(s) && size > cfg.capMin) { size -= 2; s.cap.style.fontSize = size + 'px'; }
        out.caption.push(size);
        var v = s.v; v.si.style.transform = 'none'; var ah = els.vis.clientHeight * 0.97, aw = els.vis.clientWidth * 0.97;
        var k = Math.min(1, ah / Math.max(1, v.si.offsetHeight), aw / Math.max(1, v.si.scrollWidth)); v.k = k; out.visual.push(+k.toFixed(3));
      });
      return out;
    };
    window.setAudio = function (env, fps) { st.env = env && env.length ? env : null; st.fps = fps || 30; };

    window.seek = function (t) {
      var lv = level(t), sc = st.scenes, N = sc.length, sp = 0, mood = null, mouth = 0, cur = null;
      var ang = (t * 2.2) % 360;
      els.star.style.transform = 'rotate(' + ang + 'deg)'; els.star.style.opacity = cfg.star.op + 0.07 * lv; els.glow.style.opacity = 0.72 + 0.28 * lv;
      for (var i = 0; i < els.pa.length; i++) {
        var x = (i * cfg.px + Math.sin(0.4 * t + i) * 40) % cfg.W, y = cfg.H - ((t * (20 + (i % 7) * 9) + i * 131) % (cfg.H + 60));
        var pe = els.pa[i]; pe.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; pe.style.opacity = (0.35 + 0.2 * Math.sin(t + i) * 0.5 + 0.2 * lv).toFixed(3);
      }
      els.pbar.style.width = (clamp(t / st.total) * 100).toFixed(2) + '%';
      for (var si = 0; si < N; si++) {
        var s = sc[si], last = si === N - 1, vis = t >= s.start - 0.01 && t <= (last ? st.total + 1 : s.end + 0.01), lt = t - s.start;
        s.v.sv.style.visibility = vis ? 'visible' : 'hidden'; s.cap.style.visibility = vis ? 'visible' : 'hidden';
        if (!vis) continue;
        var en = easeOut(prog(lt, 0, 0.45)), op = en * (last ? 1 : 1 - prog(t, s.end - 0.3, 0.3)), ty = 40 * (1 - en);
        s.v.sv.style.opacity = op; s.v.sv.style.transform = 'translateY(' + ty.toFixed(2) + 'px)'; s.v.si.style.transform = 'scale(' + s.v.k + ')';
        s.cap.style.opacity = op; s.cap.style.transform = 'translateY(' + ty.toFixed(2) + 'px)';
        s.v.glow.style.opacity = 0.8 + 0.2 * lv; s.v.upd(lt, lv, t);
        s.wel.forEach(function (e, wi) {
          var w = s.words[wi], a = easeOut(prog(lt, w.st, 0.12)) * (1 - easeOut(prog(lt, w.en - 0.05, 0.14))), fi = easeOut(prog(lt, w.st, 0.3));
          e.style.opacity = fi.toFixed(3); e.style.transform = 'translateY(' + ((1 - fi) * 26 - 6 * a).toFixed(2) + 'px) scale(' + (1 + 0.07 * a).toFixed(3) + ')';
          if (!w.hl) { var c = [0, 1, 2].map(function (q) { return Math.round(lerp(CREAM[q], GOLD[q], a)); }); e.style.color = 'rgb(' + c.join(',') + ')'; }
          e.style.textShadow = a > 0.01 ? '0 0 ' + (34 * a).toFixed(1) + 'px rgba(233,196,106,' + (0.9 * a).toFixed(3) + ')' : (w.hl ? '0 0 14px rgba(233,196,106,.35)' : 'none');
          mouth = Math.max(mouth, a * (0.30 + 0.70 * Math.abs(Math.sin(lt * 13 + wi * 1.7))));
        });
        if (op >= sp) { sp = op; mood = s.mood; cur = s; }
      }
      var mc = C.MOODS[mood || 'happy'];
      els.panel.style.background = 'conic-gradient(from ' + (t * 90).toFixed(2) + 'deg at 50% 50%,#c9973a,#fff0b8,#14804a,#e9c46a,#c9973a,#0a4a2a,#f6dc8e,#c9973a)';
      els.panel.style.boxShadow = '0 0 ' + (24 + 80 * lv).toFixed(1) + 'px ' + (4 + 14 * lv).toFixed(1) + 'px ' + rgba(mc, 0.22 + 0.45 * lv);
      els.sweep.style.left = (((t * 0.25) % 1.6) * 100 - 30).toFixed(1) + '%';
      for (i = 0; i < els.eqb.length; i++) {
        var wave = 0.5 + 0.5 * Math.abs(Math.sin(6 * t + 0.7 * i)), shape = 0.65 + 0.35 * Math.sin(0.45 * i + 1);
        els.eqb[i].style.height = (cfg.eq.base + cfg.eq.range * clamp(lv * 1.15 * wave * shape + 0.04)).toFixed(1) + 'px';
      }
      if (cfg.onSeek) cfg.onSeek(t, { lv: lv, sp: sp, mouth: mouth, mood: mc, st: st, els: els, cur: cur, rgba: rgba });
    };
    return st;
  };
})();
