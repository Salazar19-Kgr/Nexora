(function () {
  var $ = function (s) { return document.querySelector(s); };
  var slug = new URLSearchParams(location.search).get('g') || '';
  var data = null, sel = null, token = null, busy = false;
  function usd(n) { return '$' + Number(n).toFixed(2); }
  function ves(n, r) { return r ? 'Bs ' + (Number(n) * r).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
  function say(t, ok) { var m = $('#msg'); m.textContent = t || ''; m.className = 'msg' + (ok ? ' ok' : ''); }

  NX.ready.then(function (o) { token = o.session ? o.session.access_token : null; });

  function fail(t) { $('#gname').textContent = 'Juego no disponible'; say(t); }
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) { fail('Elige un juego desde la lista.'); return; }

  NXApi('/api/games/' + slug).then(function (d) {
    data = d; var g = d.game;
    document.title = g.name + ' · NEXORA';
    $('#gname').textContent = g.name; $('#gcat').textContent = g.category || '';
    $('#glogo').replaceChildren(NXArt.logo(g, 'big'));
    $('#server_row').hidden = !(g.required_fields || []).includes('server');
    var list = $('#plist'); list.replaceChildren();
    if (!d.products.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Este juego aún no tiene paquetes disponibles.'; list.append(e); return; }
    d.products.forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'prow'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
      var info = document.createElement('div'); info.className = 'pi';
      var nm = document.createElement('b'); nm.textContent = p.name;
      var sm = document.createElement('small'); sm.textContent = d.rate ? '≈ ' + ves(p.price_usd, d.rate) : '';
      info.append(nm, sm);
      var pr = document.createElement('span'); pr.className = 'pp'; pr.textContent = usd(p.price_usd);
      b.append(NXArt.gem(), info, pr);
      b.addEventListener('click', function () { choose(p, b); });
      list.append(b);
    });
  }).catch(function (e) { fail(e.status === 404 ? 'Este juego no existe o no está disponible.' : 'No se pudo cargar el juego. Intenta de nuevo.'); });

  function choose(p, el) {
    sel = p;
    Array.prototype.forEach.call(document.querySelectorAll('.prow'), function (x) { x.classList.toggle('on', x === el); x.setAttribute('aria-checked', x === el ? 'true' : 'false'); });
    var first = $('#step2').hidden; $('#step2').hidden = false; $('#buybar').hidden = false;
    $('#total').textContent = usd(p.price_usd); $('#totves').textContent = data.rate ? '≈ ' + ves(p.price_usd, data.rate) : '';
    say('');
    if (first) setTimeout(function () { $('#step2').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }

  $('#buy').addEventListener('click', function () {
    if (busy || !sel) return;
    var pid = $('#player_id').value.trim(), srv = $('#server').value.trim();
    if (!pid) { say('Escribe tu ID de jugador.'); $('#player_id').focus(); return; }
    if (!$('#server_row').hidden && !srv) { say('Escribe tu servidor.'); $('#server').focus(); return; }
    NX.ready.then(function (o) {
      token = o.session ? o.session.access_token : null;
      if (!token) {
        var a = document.createElement('a'); a.href = '/login'; a.textContent = 'Inicia sesión'; a.style.color = 'var(--hi)'; a.style.textDecoration = 'underline';
        var m = $('#msg'); m.className = 'msg'; m.replaceChildren(a, document.createTextNode(' para continuar con tu recarga.')); return;
      }
      busy = true; $('#buy').disabled = true; say('Creando tu pedido…', true);
      NXApi('/api/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product_id: sel.id, coupon: $('#coupon').value.trim(), player: { player_id: pid, server: srv } })
      }, token).then(function (r) { location.href = '/pago?o=' + encodeURIComponent(r.order_id); })
        .catch(function (e) { busy = false; $('#buy').disabled = false; say(e.message); });
    });
  });
})();
