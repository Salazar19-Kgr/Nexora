(function () {
  var $ = function (s) { return document.querySelector(s); };
  var tiles = $('#tiles'), cats = $('#cats'), sorts = $('#sorts'), games = [], cat = '', q = '', sort = 'rank';
  var SORTS = [['rank', 'Recomendados'], ['sold', 'Más vendidos'], ['disc', 'Descuentos'], ['new', 'Nuevos']];

  function badges(g) {
    var box = document.createElement('div'); box.className = 'bdg';
    if (g.discount_pct > 0) { var d = document.createElement('span'); d.className = 'b-off'; d.textContent = '-' + g.discount_pct + '%'; box.append(d); }
    if (g.is_new) { var n = document.createElement('span'); n.className = 'b-new'; n.textContent = 'NUEVO'; box.append(n); }
    return box;
  }
  function tile(g) {
    var a = document.createElement('a'); a.className = 'tile'; a.href = '/juego?g=' + encodeURIComponent(g.slug);
    var wrap = document.createElement('div'); wrap.className = 'tw'; wrap.append(NXArt.logo(g), badges(g));
    var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = g.name;
    a.append(wrap, nm);
    if (g.sold > 0) { var s = document.createElement('div'); s.className = 'sold'; s.textContent = g.sold.toLocaleString('es-VE') + '+ vendidos'; a.append(s); }
    return a;
  }
  function ordered(list) {
    var c = list.slice();
    if (sort === 'sold') c.sort(function (a, b) { return b.sold - a.sold || a.rank - b.rank; });
    else if (sort === 'disc') c = c.filter(function (g) { return g.discount_pct > 0; }).sort(function (a, b) { return b.discount_pct - a.discount_pct || a.rank - b.rank; });
    else if (sort === 'new') c = c.filter(function (g) { return g.is_new; });
    return c;
  }
  function render() {
    var list = ordered(games.filter(function (g) { return (!cat || g.category === cat) && (!q || g.name.toLowerCase().includes(q)); }));
    tiles.replaceChildren();
    if (!list.length) {
      var e = document.createElement('div'); e.className = 'empty';
      e.textContent = sort === 'disc' ? 'Ahora no hay descuentos activos. Vuelve pronto.' : sort === 'new' ? 'No hay juegos nuevos esta semana.' : 'No hay juegos que coincidan.';
      tiles.append(e); return;
    }
    list.forEach(function (g) { tiles.append(tile(g)); });
  }
  function chips() {
    var set = []; games.forEach(function (g) { if (g.category && set.indexOf(g.category) < 0) set.push(g.category); });
    cats.replaceChildren();
    if (set.length < 2) return;
    ['Todos'].concat(set).forEach(function (c, i) {
      var n = i ? games.filter(function (g) { return g.category === c; }).length : games.length;
      var b = document.createElement('button'); b.type = 'button'; b.textContent = c + ' · ' + n; if (!i) b.className = 'on';
      b.addEventListener('click', function () { cat = i ? c : ''; Array.prototype.forEach.call(cats.children, function (x) { x.classList.toggle('on', x === b); }); render(); });
      cats.append(b);
    });
  }
  function sortTabs() {
    sorts.replaceChildren();
    SORTS.forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = s[1];
      b.setAttribute('aria-selected', s[0] === sort ? 'true' : 'false'); if (s[0] === sort) b.className = 'on';
      b.addEventListener('click', function () { sort = s[0]; sortTabs(); render(); });
      sorts.append(b);
    });
  }
  $('#q').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); render(); });
  sortTabs();
  NXApi('/api/games').then(function (d) { games = d; chips(); render(); })
    .catch(function () { tiles.replaceChildren(); var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No se pudo cargar el catálogo. Intenta de nuevo en unos minutos.'; tiles.append(e); });
})();
