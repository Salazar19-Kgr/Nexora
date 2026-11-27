(function () {
  var $ = function (s) { return document.querySelector(s); };
  var FALLBACK = {
    hero: [{ t1: 'Recarga', t2: 'sin límites', sub: 'Juega más, disfruta más', cta: 'Explorar juegos', link: '/juegos' }],
    promo: { t1: 'Premios en', t2: 'la ruleta', sub: 'Gira y gana saldo, puntos y NexoCoins', cta: 'Ir a la ruleta', link: '/cuenta#recompensas', badge: '' }
  };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function arrow() { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-arrow'); s.append(u); return s; }
  function safeLink(l) { return /^\/(?!\/)/.test(l) || /^https:\/\//.test(l) ? l : '/juegos'; }

  // ---- imágenes según el tema
  function art(theme) {
    var nav = theme === 'navidad';
    $('#hart').src = nav ? '/img/hero-navidad.webp' : '/img/girl-art.webp';
    $('#hart').width = nav ? 531 : 811; $('#hart').height = nav ? 493 : 1000;
    $('#hcat').hidden = nav;
    $('#part').src = nav ? '/img/promo-navidad.webp' : '/img/promo-general.webp';
    $('#pgifts').hidden = !nav;
  }

  // ---- carrusel del banner principal
  var slides = [], cur = 0, timer = null;
  function drawHero(list) {
    var box = $('#hslides'), dots = $('#hdots'); box.replaceChildren(); dots.replaceChildren(); slides = [];
    list.forEach(function (s, i) {
      var d = el('div', 'hslide' + (i === 0 ? ' on' : ''));
      d.setAttribute('role', 'group'); d.setAttribute('aria-label', (i + 1) + ' de ' + list.length);
      var h = el('h1'); h.append(el('span', 'l1', s.t1), el('span', 'l2', s.t2));
      var p = el('p', 'hsub', s.sub);
      var a = el('a', 'cta'); a.href = safeLink(s.link); a.append(el('span', null, s.cta), arrow());
      if (i !== 0) a.tabIndex = -1;
      d.append(h, p, a); box.append(d); slides.push(d);
      var b = el('button', 'hd' + (i === 0 ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'Banner ' + (i + 1));
      b.addEventListener('click', function () { go(i); play(); }); dots.append(b);
    });
    dots.hidden = list.length < 2; cur = 0; play();
  }
  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('on', k === cur); var a = s.querySelector('a'); if (a) a.tabIndex = k === cur ? 0 : -1; });
    Array.prototype.forEach.call($('#hdots').children, function (b, k) { b.classList.toggle('on', k === cur); });
  }
  function play() { clearInterval(timer); if (reduce || slides.length < 2) return; timer = setInterval(function () { if (!document.hidden) go(cur + 1); }, 6500); }
  var hero = $('#hero');
  ['pointerenter', 'focusin'].forEach(function (ev) { hero.addEventListener(ev, function () { clearInterval(timer); }); });
  ['pointerleave', 'focusout'].forEach(function (ev) { hero.addEventListener(ev, play); });
  var sx = 0; hero.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50 && slides.length > 1) { go(cur + (dx < 0 ? 1 : -1)); play(); } }, { passive: true });

  // ---- banner promocional (editable desde administración)
  function drawPromo(p) {
    $('#p1').textContent = p.t1; $('#p2').textContent = p.t2; $('#psub').textContent = p.sub;
    var a = $('#pcta'); a.href = safeLink(p.link); a.firstElementChild.textContent = p.cta;
    var b = $('#pbadge'); b.hidden = !p.badge; b.textContent = p.badge || '';
  }

  // ---- parallax suave del arte (solo transform, sin lag)
  if (!reduce) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { var y = Math.min(window.scrollY, 400); hero.style.setProperty('--py', (y * 0.06).toFixed(1) + 'px'); ticking = false; });
    }, { passive: true });
  }

  // ---- categorías y más vendidos con datos reales
  function catTile(g) {
    var a = el('a', 'cat'); a.href = '/juego?g=' + encodeURIComponent(g.slug);
    var w = el('div', 'cimg'); w.append(NXArt.logo(g, 'mid'));
    a.append(w, el('span', 'cnm', g.name)); return a;
  }
  function drawCats(list) {
    var box = $('#cats'); box.replaceChildren();
    list.slice(0, 5).forEach(function (g) { box.append(catTile(g)); });
    var more = el('a', 'cat more'); more.href = '/juegos';
    var w = el('div', 'cimg'); var ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ic.setAttribute('class', 'ic'); ic.setAttribute('viewBox', '0 0 24 24');
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-grid'); ic.append(u); w.append(ic);
    more.append(w, el('span', 'cnm', 'Más juegos')); box.append(more);
  }
  function drawBest(list) {
    var box = $('#best'); box.replaceChildren();
    if (!list.length) { box.append(el('div', 'empty', 'Pronto verás aquí los juegos más recargados.')); return; }
    list.slice(0, 4).forEach(function (g, i) {
      var c = el('article', 'bcard nx-card');
      var top = el('a', 'bimg'); top.href = '/juego?g=' + encodeURIComponent(g.slug); top.setAttribute('aria-label', g.name);
      top.append(NXArt.logo(g, 'bigart'));
      if (i === 0 && g.sold > 0) { var t = el('span', 'btag', 'Destacado'); top.append(t); }
      if (g.discount_pct > 0) top.append(el('span', 'boff', '-' + g.discount_pct + '%'));
      var nm = el('h3', null, g.name);
      var sub = el('small', null, g.from_usd ? 'Desde $' + Number(g.from_usd).toFixed(2) : (g.category || 'Recargas'));
      var b = el('a', 'cta sm'); b.href = '/juego?g=' + encodeURIComponent(g.slug); b.append(el('span', null, 'Recargar'), arrow());
      c.append(top, nm, sub, b); box.append(c);
    });
  }

  var content = null;
  window.NXTheme.then(function (t) {
    art(t.theme); content = t.content || FALLBACK;
    drawHero(content.hero && content.hero.length ? content.hero : FALLBACK.hero);
    drawPromo(content.promo || FALLBACK.promo);
  });

  NXApi('/api/games').then(function (d) {
    var byRank = d.slice().sort(function (a, b) { return b.sold - a.sold || a.rank - b.rank; });
    drawCats(byRank); drawBest(byRank);
    if (d.some(function (g) { return g.discount_pct > 0; })) { var h = document.querySelector('#tabofe .hot'); if (h) h.hidden = false; }
  }).catch(function () {
    $('#cats').replaceChildren(el('div', 'empty', 'No se pudo cargar el catálogo. Intenta de nuevo en unos minutos.'));
    $('#best').replaceChildren();
  });
})();
