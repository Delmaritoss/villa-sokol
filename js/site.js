/* Villa Sokol · page behaviour
   Languages, header, the facade drawing (home), gallery, enquiry form, map. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EMAIL = (doc.querySelector('meta[name="vs-email"]') || {}).content || '';
  var DICT = window.VS_I18N || {};
  var LANGS = ['hr', 'en', 'de', 'it'];
  var lang = 'hr';

  root.classList.add('js');

  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ------------------------------------------------------------ i18n -- */
  var origText = new WeakMap();
  var origAttr = new WeakMap();

  // A key's text in the current language. Croatian lives in the markup; the
  // few strings only JavaScript writes have their Croatian in DICT.hr.
  function t(key) {
    var d = DICT[lang] || {};
    if (d[key] != null) return d[key];
    if (DICT.hr && DICT.hr[key] != null) return DICT.hr[key];
    return key;
  }

  function applyLang(next) {
    lang = LANGS.indexOf(next) > -1 ? next : 'hr';
    var d = DICT[lang] || {};
    root.lang = lang;
    $$('[data-i18n]').forEach(function (el) {
      if (!origText.has(el)) origText.set(el, el.textContent);
      var k = el.getAttribute('data-i18n');
      el.textContent = lang === 'hr' ? origText.get(el) : (d[k] != null ? d[k] : origText.get(el));
    });
    $$('[data-i18n-attr]').forEach(function (el) {
      if (!origAttr.has(el)) origAttr.set(el, {});
      var o = origAttr.get(el);
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':'), a = bits[0].trim(), k = (bits[1] || '').trim();
        if (!(a in o)) o[a] = el.getAttribute(a) || '';
        var v = lang === 'hr' ? o[a] : (d[k] != null ? d[k] : (DICT.hr && DICT.hr[k]) || o[a]);
        el.setAttribute(a, v);
      });
    });
    // photo alt text is composed from the unit and the room
    $$('img[data-cap]').forEach(function (img) {
      if (img.hasAttribute('data-i18n-attr')) return;
      var c = img.getAttribute('data-cap').split('.');
      if (lang === 'hr') { if (origAttr.has(img)) img.alt = origAttr.get(img).alt; return; }
      if (!origAttr.has(img)) origAttr.set(img, { alt: img.alt });
      img.alt = t('g.' + c[0] + '.name') + ': ' + t('cap.' + c[1]);
    });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    store('vs-lang', lang);
    doc.dispatchEvent(new CustomEvent('vs:lang'));
  }

  function firstLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q && LANGS.indexOf(q) > -1) return q;
    var saved = store('vs-lang');
    if (saved && LANGS.indexOf(saved) > -1) return saved;
    var nav = (navigator.languages || [navigator.language || 'hr']);
    for (var i = 0; i < nav.length; i++) {
      var two = String(nav[i]).slice(0, 2).toLowerCase();
      if (two === 'hr' || two === 'sr' || two === 'bs' || two === 'sl') return 'hr';
      if (LANGS.indexOf(two) > -1) return two;
    }
    return 'en';
  }

  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
  });

  /* ------------------------------------------------------------ small bits */
  $$('[data-email]').forEach(function (a) {
    a.href = 'mailto:' + EMAIL;
    a.textContent = EMAIL;
    if (/\.example$/.test(EMAIL)) a.classList.add('placeholder');
  });
  $$('[data-year]').forEach(function (s) { s.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------ header -- */
  var bar = $('[data-bar]');
  var hero = $('[data-hero]');
  var burger = $('[data-burger]');
  var menu = $('[data-menu]');

  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    doc.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    if (open) { var f = $('a', menu); if (f) f.focus(); }
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); burger.focus(); }
    });
  }

  /* ------------------------------------------------------------ hero film --
     Two clips made from the evening still: the intro (the Christmas lights
     switch on) plays once, then the loop (lit street, traffic) repeats. The
     intro's last frame is the loop's first, so the hand-over does not show.
     Plays only on screen, never under reduced motion or Save-Data, and the
     visitor can stop it (it repeats forever, so a pause control is required). */
  var hi = $('[data-hero-intro]');
  var hl = $('[data-hero-loop]');
  var hp = $('[data-hero-pause]');
  var saveData = navigator.connection && navigator.connection.saveData;
  if (hi && hl && !reduce && !saveData) {
    // the phone cut (4:5) for a frame taller than wide, the full 3:2 film otherwise;
    // decided by the frame itself and decided again if the window changes shape
    var box = hi.parentNode;
    var shape = function () { return box.clientWidth / Math.max(1, box.clientHeight) < 1 ? 'p' : 'l'; };
    var portrait = shape() === 'p';
    var stopped = store('vs-hero-paused') === '1';
    var inView = true, phase = 'intro', ready = { intro: false, loop: false };
    hero.classList.toggle('is-portrait-clip', portrait);
    var now = function () { return phase === 'intro' ? hi : hl; };
    var sync = function () {
      var v = now(), other = v === hi ? hl : hi;
      other.pause();
      if (ready[phase] && inView && !stopped && !doc.hidden) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
      else v.pause();
      hp.setAttribute('aria-pressed', String(stopped));
    };
    hi.addEventListener('playing', function () { hi.classList.add('is-on'); });
    // hand over half a second before the intro ends: the loop starts underneath
    // and the intro fades out over it, so a small difference between the two
    // frames dissolves instead of popping
    var handover = function () {
      if (phase !== 'intro' || !ready.loop) return;
      phase = 'loop';
      hl.currentTime = 0;
      hl.classList.add('is-on');
      var pr = hl.play(); if (pr && pr.catch) pr.catch(function () {});
      hi.classList.remove('is-on');
    };
    hi.addEventListener('timeupdate', function () { if (hi.duration && hi.duration - hi.currentTime < 0.6) handover(); });
    hi.addEventListener('ended', handover);
    hp.hidden = false;
    hp.addEventListener('click', function () { stopped = !stopped; store('vs-hero-paused', stopped ? '1' : '0'); sync(); });
    doc.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; sync(); }).observe(hero);
    }
    // Cloudflare Pages answers without byte ranges and iOS Safari will not play
    // an mp4 it cannot range-request, so each file arrives whole as a Blob.
    var load = function (v, key) {
      return fetch(v.getAttribute(portrait ? 'data-src-mobile' : 'data-src'))
        .then(function (r) { if (!r.ok) throw r; return r.blob(); })
        .then(function (b) { v.src = URL.createObjectURL(b); ready[key] = true; if (key === 'loop' && hi.ended) handover(); sync(); });
    };
    load(hi, 'intro').then(function () { return load(hl, 'loop'); }).catch(function () {});
    var reshape;
    addEventListener('resize', function () {
      clearTimeout(reshape);
      reshape = setTimeout(function () {
        if ((shape() === 'p') === portrait) return;
        portrait = !portrait;
        hero.classList.toggle('is-portrait-clip', portrait);
        var t = hl.currentTime;
        ready.loop = false;
        load(hl, 'loop').then(function () { if (phase === 'loop') hl.currentTime = t; }).catch(function () {});
        if (phase === 'intro') { ready.intro = false; load(hi, 'intro').catch(function () {}); }
      }, 250);
    });
  }

  /* ------------------------------------------------- the facade drawing --
     The pinned act on the home page. Its progress p (0..1 of the pin):
       0.04 – 0.54  the photograph washes to paper
       0.06 – 0.62  the elevation draws itself, stroke by stroke
       0.60 – 0.72  the first floor lights up
       0.66 – 0.90  the three door plates arrive, then the callouts           */
  var floor = $('[data-floor]');
  var fig = floor && $('[data-facade]', floor);
  var strokes = fig ? $$('.pr-svg path', fig).map(function (el) {
    var d = el.getAttribute('data-d').split(' ').map(Number);
    return { el: el, a: d[0], b: d[1], last: -1 };
  }) : [];
  var plates = floor ? $$('[data-floor-plates] li', floor) : [];
  var callouts = fig ? $$('.callout', fig) : [];
  var lastP = -1;

  function smooth(x) { return x * x * (3 - 2 * x); }

  function drawFacade() {
    var r = floor.getBoundingClientRect();
    var travel = r.height - innerHeight;
    var p = reduce ? 1 : (travel > 1 ? clamp(-r.top / travel, 0, 1) : 1);
    if (Math.abs(p - lastP) < 0.0005) return;
    lastP = p;
    var dp = clamp((p - 0.06) / 0.56, 0, 1);
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      var k = clamp((dp - s.a) / (s.b - s.a), 0, 1);
      if (k !== s.last) { s.el.style.strokeDashoffset = (1 - k).toFixed(4); s.last = k; }
    }
    fig.style.setProperty('--wash', (0.88 * smooth(clamp((p - 0.04) / 0.5, 0, 1))).toFixed(3));
    var band = smooth(clamp((p - 0.6) / 0.12, 0, 1));
    fig.style.setProperty('--band', band.toFixed(3));
    fig.classList.toggle('is-lit', band > 0.5);
    plates.forEach(function (li, n) {
      var o = smooth(clamp((p - (0.66 + n * 0.07)) / 0.08, 0, 1));
      li.style.setProperty('--o', o.toFixed(3));
      li.style.setProperty('--y', ((1 - o) * 14).toFixed(1) + 'px');
    });
    callouts.forEach(function (c, n) {
      c.style.setProperty('--o', smooth(clamp((p - (0.72 + n * 0.06)) / 0.08, 0, 1)).toFixed(3));
    });
  }

  /* ------------------------------------------------------------ one loop */
  var ticking = false;
  function frame() {
    ticking = false;
    if (bar && hero) bar.classList.toggle('is-over', hero.getBoundingClientRect().bottom > bar.offsetHeight && !doc.body.classList.contains('menu-open'));
    if (fig) drawFacade();
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', function () { lastP = -1; request(); });
  if (burger) burger.addEventListener('click', request);

  /* ------------------------------------------------------------ gallery -- */
  var grid = $('[data-grid]');
  if (grid) {
    var tiles = $$('a', grid);
    var buttons = $$('[data-filters] button');
    var filter = 'all';

    buttons.forEach(function (b) {
      var f = b.getAttribute('data-f');
      var n = f === 'all' ? tiles.length : tiles.filter(function (a) { return a.getAttribute('data-group') === f; }).length;
      $('.n', b).textContent = n;
      b.addEventListener('click', function () { setFilter(f, true); });
    });

    function setFilter(f, push) {
      filter = buttons.some(function (b) { return b.getAttribute('data-f') === f; }) ? f : 'all';
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === filter)); });
      tiles.forEach(function (a) { a.hidden = filter !== 'all' && a.getAttribute('data-group') !== filter; });
      if (push) history.replaceState(null, '', filter === 'all' ? location.pathname : '#' + filter);
    }
    setFilter((location.hash || '').slice(1) || 'all', false);
    addEventListener('hashchange', function () { setFilter(location.hash.slice(1), false); });

    // lightbox
    var lb = $('[data-lightbox]');
    var lbImg = $('[data-lb-img]', lb);
    var lbCap = $('[data-lb-cap]', lb);
    var lbCount = $('[data-lb-count]', lb);
    var shown = [], at = 0, opener = null;

    function show(i) {
      at = (i + shown.length) % shown.length;
      var a = shown[at], thumb = $('img', a);
      lbImg.src = a.getAttribute('href');
      lbImg.alt = thumb.alt;
      lbCap.textContent = thumb.alt;
      lbCount.textContent = (at + 1) + ' / ' + shown.length;
      var next = shown[(at + 1) % shown.length];
      if (next) { var pre = new Image(); pre.src = next.getAttribute('href'); }
    }
    tiles.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (!lb.showModal) return;          // old browsers just open the file
        e.preventDefault();
        opener = a;
        shown = tiles.filter(function (x) { return !x.hidden; });
        show(shown.indexOf(a));
        lb.showModal();
      });
    });
    $('[data-lb-prev]', lb).addEventListener('click', function () { show(at - 1); });
    $('[data-lb-next]', lb).addEventListener('click', function () { show(at + 1); });
    $('[data-lb-close]', lb).addEventListener('click', function () { lb.close(); });
    lb.addEventListener('close', function () { if (opener) opener.focus(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === $('[data-lb-stage]', lb)) lb.close(); });
    var x0 = null;
    $('[data-lb-stage]', lb).addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    $('[data-lb-stage]', lb).addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
    });
    doc.addEventListener('vs:lang', function () { if (lb.open) show(at); });
  }

  /* ------------------------------------------------------------ enquiry -- */
  var form = $('[data-form]');
  if (form) {
    var q = new URLSearchParams(location.search);
    var od = $('#f-od'), dd = $('#f-do'), ad = $('#f-odrasli'), kd = $('#f-djeca');
    var warn = $('[data-warn]'), status = $('[data-status]');
    var pre = q.get('j');
    if (pre && $('#j-' + pre)) $('#j-' + pre).checked = true;

    var today = new Date(); today.setHours(0, 0, 0, 0);
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function parse(v) { if (!v) return null; var b = v.split('-'); return new Date(+b[0], b[1] - 1, +b[2]); }
    od.min = iso(today);
    if (q.get('od')) od.value = q.get('od');
    if (q.get('do')) dd.value = q.get('do');

    function unit() { return $('input[name="jedinica"]:checked', form); }
    function unitName(u) { return u ? $('.pick__name', u.parentNode).textContent : '–'; }
    function fmt(d) { return new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(d); }
    function nightsBetween(a, b) { return Math.round((b - a) / 864e5); }

    function update() {
      var a = parse(od.value), b = parse(dd.value), u = unit();
      if (a) { var m = new Date(a); m.setDate(m.getDate() + 1); dd.min = iso(m); }
      var S = function (k, v) { $('[data-s="' + k + '"]').textContent = v; };
      S('unit', unitName(u));
      S('dates', a && b ? fmt(a) + ' – ' + fmt(b) : (a ? fmt(a) : '–'));
      var n = a && b ? nightsBetween(a, b) : 0;
      S('nights', n > 0 ? String(n) : '–');
      var adults = +ad.value, kids = +kd.value;
      S('guests', t('s.adults') + ' ' + adults + (kids ? ', ' + t('s.kids') + ' ' + kids : ''));
      var msgs = [];
      if (u && adults + kids > +u.getAttribute('data-max')) msgs.push(t('w.cap'));
      if (a && a < today) msgs.push(t('w.past'));
      if (a && b && n <= 0) msgs.push(t('w.order'));
      warn.hidden = !msgs.length;
      warn.textContent = msgs.join(' ');
      return { a: a, b: b, n: n, u: u, adults: adults, kids: kids, ok: !msgs.length };
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    doc.addEventListener('vs:lang', update);

    function err(name, key) {
      var box = $('[data-err="' + name + '"]');
      var field = { od: od, 'do': dd, ime: $('#f-ime'), email: $('#f-email'), privola: $('[data-consent]') }[name];
      if (box) box.textContent = key ? t(key) : '';
      if (field) field.setAttribute('aria-invalid', key ? 'true' : 'false');
      return key ? field : null;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = update();
      var bad = [];
      bad.push(err('od', !s.a ? 'e.need' : (s.a < today ? 'w.past' : null)));
      bad.push(err('do', !s.b ? 'e.need' : (s.n <= 0 ? 'w.order' : null)));
      var name = $('#f-ime').value.trim(), mail = $('#f-email').value.trim();
      bad.push(err('ime', name ? null : 'e.need'));
      bad.push(err('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? null : 'e.mail'));
      bad.push(err('privola', $('[data-consent]').checked ? null : 'e.consent'));
      bad = bad.filter(Boolean);
      if (bad.length) { bad[0].focus(); return; }

      var lines = [
        t('m.hello'), '',
        t('book.unit') + ': ' + unitName(s.u),
        t('book.dates') + ': ' + fmt(s.a) + ' – ' + fmt(s.b) + ' (' + s.n + ' ' + t('m.nights') + ')',
        t('book.guests') + ': ' + t('s.adults') + ' ' + s.adults + (s.kids ? ', ' + t('s.kids') + ' ' + s.kids : ''),
        '',
        t('book.name') + ': ' + name,
        t('book.email') + ': ' + mail
      ];
      var tel = $('#f-tel').value.trim();
      if (tel) lines.push(t('book.phone') + ': ' + tel);
      var msg = $('#f-poruka').value.trim();
      if (msg) lines.push('', msg);
      if (!s.ok) lines.push('', '(' + warn.textContent + ')');
      var body = lines.join('\n');
      var subject = t('m.subject') + ': ' + unitName(s.u) + ', ' + fmt(s.a) + ' – ' + fmt(s.b);

      status.hidden = false;
      status.className = 'status is-ok';
      status.innerHTML = '';
      var p = doc.createElement('p'); p.style.margin = '0';
      p.textContent = t('st.ok') + ' ' + EMAIL + '.';
      var copy = doc.createElement('button');
      copy.type = 'button'; copy.className = 'btn btn--ghost'; copy.style.marginTop = '0.8rem';
      copy.textContent = t('st.copy');
      copy.addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(subject + '\n\n' + body) : Promise.reject())
          .then(function () { copy.textContent = t('st.copied'); })
          .catch(function () { copy.textContent = t('st.copyFail'); });
      });
      var pr = doc.createElement('pre'); pr.textContent = body;
      status.appendChild(p); status.appendChild(copy); status.appendChild(pr);
      location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }

  /* ------------------------------------------------------------ map ------ */
  var map = $('[data-map]');
  if (map) {
    $('[data-map-load]', map).addEventListener('click', function () {
      var lat = +map.getAttribute('data-lat'), lon = +map.getAttribute('data-lon');
      var f = doc.createElement('iframe');
      f.title = t('map.title');
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer';
      f.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' +
        (lon - 0.0045).toFixed(5) + '%2C' + (lat - 0.0024).toFixed(5) + '%2C' + (lon + 0.0045).toFixed(5) + '%2C' + (lat + 0.0024).toFixed(5) +
        '&layer=mapnik&marker=' + lat + '%2C' + lon;
      map.innerHTML = '';
      map.appendChild(f);
    });
  }

  /* ------------------------------------------------------------ start ---- */
  applyLang(firstLang());
  if (window.ScrollCraft) ScrollCraft.mount(doc.body);
  if (form) form.dispatchEvent(new Event('change'));
  frame();
})();
