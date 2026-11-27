(function () {
  var box = document.getElementById('best');
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function arrow() { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-arrow'); s.append(u); return s; }
  NXApi('/api/games').then(function (d) {
    var list = d.filter(function (g) { return g.discount_pct > 0; }).sort(function (a, b) { return b.discount_pct - a.discount_pct; });
    box.replaceChildren();
    if (!list.length) { document.getElementById('none').hidden = false; return; }
    var h = document.querySelector('#tabofe .hot'); if (h) h.hidden = false;
    list.forEach(function (g) {
      var c = el('article', 'bcard nx-card');
      var top = el('a', 'bimg'); top.href = '/juego?g=' + encodeURIComponent(g.slug); top.setAttribute('aria-label', g.name);
      top.append(NXArt.logo(g, 'bigart'), el('span', 'boff', '-' + g.discount_pct + '%'));
      var b = el('a', 'cta sm'); b.href = '/juego?g=' + encodeURIComponent(g.slug); b.append(el('span', null, 'Recargar'), arrow());
      c.append(top, el('h3', null, g.name), el('small', null, g.from_usd ? 'Desde $' + Number(g.from_usd).toFixed(2) : (g.category || 'Recargas')), b);
      box.append(c);
    });
  }).catch(function () { box.replaceChildren(el('div', 'empty', 'No se pudieron cargar las ofertas. Intenta de nuevo en unos minutos.')); });
})();
