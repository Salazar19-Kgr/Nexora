(function () {
  var $ = function (s) { return document.querySelector(s); };
  var tiles = $('#tiles'), cats = $('#cats'), games = [], cat = '', q = '';
  function render() {
    var list = games.filter(function (g) { return (!cat || g.category === cat) && (!q || g.name.toLowerCase().includes(q)); });
    tiles.replaceChildren();
    if (!list.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No hay juegos que coincidan.'; tiles.append(e); return; }
    list.forEach(function (g) {
      var a = document.createElement('a'); a.className = 'tile'; a.href = '/juego?g=' + encodeURIComponent(g.slug);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = g.name;
      a.append(NXArt.logo(g), nm); tiles.append(a);
    });
  }
  function chips() {
    var set = []; games.forEach(function (g) { if (g.category && set.indexOf(g.category) < 0) set.push(g.category); });
    cats.replaceChildren();
    if (set.length < 2) return;
    ['Todos'].concat(set).forEach(function (c, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = c; if (!i) b.className = 'on';
      b.addEventListener('click', function () { cat = i ? c : ''; Array.prototype.forEach.call(cats.children, function (x) { x.classList.toggle('on', x === b); }); render(); });
      cats.append(b);
    });
  }
  $('#q').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); render(); });
  NXApi('/api/games').then(function (d) { games = d; chips(); render(); })
    .catch(function () { tiles.replaceChildren(); var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No se pudo cargar el catálogo. Intenta de nuevo en unos minutos.'; tiles.append(e); });
})();
