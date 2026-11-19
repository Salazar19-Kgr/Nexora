(function () {
  var $ = function (s) { return document.querySelector(s); };
  var tiles = $('#tiles'), dots = $('#dots'), games = [];

  function render(list) {
    tiles.replaceChildren();
    if (!list.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No hay juegos que coincidan.'; tiles.append(e); return; }
    list.forEach(function (g) {
      var a = document.createElement('a'); a.className = 'tile'; a.href = '/juego?g=' + encodeURIComponent(g.slug);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = g.name;
      a.append(NXArt.logo(g), nm); tiles.append(a);
    });
  }
  function renderDots(list) {
    dots.replaceChildren();
    list.slice(0, 6).forEach(function (g) {
      var a = document.createElement('a'); a.className = 'dot'; a.href = '/juego?g=' + encodeURIComponent(g.slug); a.setAttribute('aria-label', g.name);
      var l = NXArt.logo(g, 'mini'); a.append(l); dots.append(a);
    });
    var p = document.createElement('a'); p.className = 'dot plus'; p.href = '/juegos'; p.textContent = '+'; p.setAttribute('aria-label', 'Ver todos los juegos');
    dots.append(p);
  }
  $('#q').addEventListener('input', function (e) {
    var t = e.target.value.trim().toLowerCase();
    render(games.filter(function (g) { return g.name.toLowerCase().includes(t); }));
  });
  NXApi('/api/games').then(function (d) { games = d; render(games); renderDots(games); })
    .catch(function () {
      tiles.replaceChildren();
      var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No se pudo cargar el catálogo. Intenta de nuevo en unos minutos.'; tiles.append(e);
    });
})();
