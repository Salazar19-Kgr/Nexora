(function () {
  var $ = function (s) { return document.querySelector(s); };
  var tiles = $('#tiles'), dots = $('#dots'), dlg = $('#checkout'), msg = $('#msg'), buy = $('#buy');
  var games = [];

  function hue(slug) { var h = 0; for (var i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360; return h; }
  function initials(name) {
    var w = name.replace(/[:\-]/g, ' ').split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
  }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || 'Error de conexión');
        return d;
      });
    });
  }

  function render(list) {
    tiles.replaceChildren();
    if (!list.length) {
      var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No hay juegos que coincidan.'; tiles.append(e); return;
    }
    list.forEach(function (g) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tile';
      b.style.setProperty('--h', hue(g.slug));
      var art = document.createElement('div'); art.className = 'art'; art.textContent = initials(g.name);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = g.name;
      b.append(art, nm);
      b.addEventListener('click', function () { openGame(g); });
      tiles.append(b);
    });
  }

  function renderDots(list) {
    dots.replaceChildren();
    list.slice(0, 6).forEach(function (g) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dot'; b.style.setProperty('--h', hue(g.slug));
      b.textContent = initials(g.name); b.setAttribute('aria-label', g.name);
      b.addEventListener('click', function () { openGame(g); });
      dots.append(b);
    });
    var p = document.createElement('a'); p.className = 'dot plus'; p.href = '#juegos'; p.textContent = '+'; p.setAttribute('aria-label', 'Ver todos los juegos');
    dots.append(p);
  }

  function openGame(g) {
    $('#gname').textContent = g.name;
    $('#server_row').hidden = !(g.required_fields || []).includes('server');
    $('#player_id').value = '';
    msg.textContent = 'Cargando paquetes...'; buy.disabled = true;
    var sel = $('#product'); sel.replaceChildren();
    dlg.showModal();
    api('/api/games/' + g.slug + '/products').then(function (prods) {
      if (!prods.length) { msg.textContent = 'Este juego aún no tiene paquetes disponibles.'; return; }
      prods.forEach(function (p) {
        var o = document.createElement('option'); o.value = p.id;
        o.textContent = p.name + ' · $' + Number(p.price_usd).toFixed(2); sel.append(o);
      });
      msg.textContent = ''; buy.disabled = false;
    }).catch(function (e) { msg.textContent = e.message; });
  }

  $('#form').addEventListener('submit', function (e) {
    e.preventDefault(); buy.disabled = true; msg.textContent = 'Creando pedido...';
    api('/api/orders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product_id: $('#product').value, player: { player_id: $('#player_id').value.trim(), server: $('#server').value.trim() } })
    }).then(function (o) {
      msg.textContent = 'Pedido ' + o.order_id.slice(0, 8) + ' creado. Estado: pendiente de pago.';
    }).catch(function (err) { msg.textContent = err.message; buy.disabled = false; });
  });

  $('#q').addEventListener('input', function (e) {
    var t = e.target.value.trim().toLowerCase();
    render(games.filter(function (g) { return g.name.toLowerCase().includes(t); }));
  });

  api('/api/games').then(function (d) { games = d; render(games); renderDots(games); })
    .catch(function () {
      tiles.replaceChildren();
      var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No se pudo cargar el catálogo. Intenta de nuevo en unos minutos.'; tiles.append(e);
    });
})();
