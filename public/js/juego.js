(function () {
  var $ = function (s) { return document.querySelector(s); };
  var slug = new URLSearchParams(location.search).get('g') || '';
  var data = null, sel = null, token = null, busy = false;
  function usd(n) { return '$' + Number(n).toFixed(2); }
  var SYM = { VES: 'Bs ', DOP: 'RD$ ', MXN: 'MX$ ' };
  function ves(n, r) { return r ? (SYM[data && data.currency] || 'Bs ') + (Number(n) * r).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
  var NAMES = {}; (window.NXCountries || []).forEach(function (c) { NAMES[c[0]] = c[1]; });
  function guestCountry() { try { return localStorage.getItem('nx_country') || ''; } catch (e) { return ''; } }
  function setGuestCountry(v) { try { localStorage.setItem('nx_country', v); } catch (e) {} }
  function say(t, ok) { var m = $('#msg'); m.textContent = t || ''; m.className = 'msg' + (ok ? ' ok' : ''); }

  var coins = 0;
  NX.ready.then(function (o) { token = o.session ? o.session.access_token : null; if (token) NXApi('/api/me', null, token).then(function (m) { coins = Number(m.coins) || 0; refreshCoins(); }).catch(function () {}); });

  function fail(t) { $('#gname').textContent = 'Juego no disponible'; say(t); }
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) { fail('Elige un juego desde la lista.'); return; }

  NX.ready.then(function (o) {
    token = o.session ? o.session.access_token : null;
    var gc = guestCountry();
    return NXApi('/api/games/' + slug + (!token && gc ? '?country=' + encodeURIComponent(gc) : ''), null, token);
  }).then(function (d) {
    data = d; var g = d.game;
    drawCountry(d);
    document.title = g.name + ' · NEXORA';
    $('#gname').textContent = g.name; $('#gcat').textContent = g.category || '';
    $('#glogo').replaceChildren(NXArt.logo(g, 'big'));
    $('#server_row').hidden = !(g.required_fields || []).includes('server');
    var list = $('#plist'); list.replaceChildren();
    if (!d.country) { var e0 = document.createElement('div'); e0.className = 'empty'; e0.textContent = 'Elige tu país para ver los precios.'; list.append(e0); return; }
    if (!d.products.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Este juego aún no tiene paquetes disponibles en tu país.'; list.append(e); return; }
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

  function drawCountry(d) {
    var box = $('#cbar'); box.replaceChildren();
    var lab = document.createElement('label'); lab.textContent = d.locked ? 'Precios para: ' : 'Tu país: ';
    if (d.locked) {
      var chip = document.createElement('span'); chip.className = 'cflag'; chip.textContent = NAMES[d.country] || d.country; lab.append(chip);
    } else {
      var sel = document.createElement('select'); sel.setAttribute('aria-label', 'País');
      var f = document.createElement('option'); f.value = ''; f.textContent = 'Selecciona tu país…'; sel.append(f);
      (window.NXCountries || []).forEach(function (c) { var op = document.createElement('option'); op.value = c[0]; op.textContent = c[1]; sel.append(op); });
      sel.value = d.country || '';
      sel.addEventListener('change', function () { if (sel.value) { setGuestCountry(sel.value); location.reload(); } });
      lab.append(sel);
    }
    box.append(lab);
    if (d.locked && !d.country) { var m = document.createElement('p'); m.className = 'muted'; m.textContent = 'Recarga la página para elegir tu país.'; box.append(m); }
  }

  // NexoCoins: 1 moneda = $0.01, hasta el 25 % del precio (el servidor lo recalcula).
  function coinMax() { return sel && coins ? Math.min(coins, Math.floor(Number(sel.price_usd) * 25)) : 0; }
  function refreshCoins() {
    var row = $('#coinrow'); if (!row) return;
    row.hidden = !(coins > 0 && sel);
    if (!sel) return;
    var on = $('#usecoins').checked, dsc = on ? coinMax() / 100 : 0;
    var tot = Math.max(Number(sel.price_usd) - dsc, 0);
    $('#total').textContent = usd(tot); $('#totves').textContent = data && data.rate ? '≈ ' + ves(tot, data.rate) : '';
    row.classList.toggle('on', on);
    if (coins > 0) $('#coinhint').textContent = on ? 'Usando ' + coinMax() + ' NexoCoins' : 'Tienes ' + coins + ' · ahorras hasta ' + usd(coinMax() / 100);
    $('#sPrice').textContent = usd(sel.price_usd); $('#sDiscRow').hidden = !on; $('#sDisc').textContent = '−' + usd(dsc);
    $('#sTot').textContent = usd(tot); $('#sVes').textContent = data && data.rate ? 'Equivale a ' + ves(tot, data.rate) : '';
  }
  var ci = $('#coico'); if (ci && window.NXArt) ci.append(NXArt.coin('coin'));
  $('#usecoins').addEventListener('change', refreshCoins);

  // Verificación de ID (solo si el proveedor está activo y hay sesión). Es informativa: no bloquea la compra.
  var canCheck = false;
  NX.ready.then(function (o) {
    if (!o.session) return;
    return NXApi('/api/verify-player/status').then(function (r) { canCheck = !!(r && r.available); refreshCheck(); });
  }).catch(function () {});
  function refreshCheck() { var b = $('#chkid'); if (b) b.hidden = !(canCheck && sel); }
  $('#chkid').addEventListener('click', function () {
    var out = $('#idres'), pid = $('#player_id').value.trim();
    out.className = 'msg'; if (!pid) { out.textContent = 'Escribe tu ID primero.'; return; }
    out.textContent = 'Verificando…';
    NXApi('/api/check-id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_id: sel.id, player_id: pid, server: $('#server').value.trim() }) }, token)
      .then(function (r) {
        if (r.status === 'valid') { out.className = 'msg ok'; out.textContent = r.nickname ? '✓ Cuenta encontrada: ' + r.nickname : '✓ ID válido'; }
        else if (r.status === 'invalid') out.textContent = 'No encontramos ese ID' + (r.message ? ' (' + r.message + ')' : '') + '. Revísalo antes de pagar.';
        else out.textContent = 'No pudimos verificarlo ahora. Revisa bien tu ID.';
      }).catch(function (e) { out.textContent = e.message; });
  });

  function choose(p, el) {
    sel = p;
    Array.prototype.forEach.call(document.querySelectorAll('.prow'), function (x) { x.classList.toggle('on', x === el); x.setAttribute('aria-checked', x === el ? 'true' : 'false'); });
    var first = $('#step2').hidden; $('#step2').hidden = false; $('#buybar').hidden = false;
    refreshCoins(); refreshCheck(); $('#idres').textContent = '';
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
        body: JSON.stringify({ product_id: sel.id, coupon: $('#coupon').value.trim(), use_coins: $('#usecoins').checked, player: { player_id: pid, server: srv } })
      }, token).then(function (r) { location.href = '/pago?o=' + encodeURIComponent(r.order_id); })
        .catch(function (e) { busy = false; $('#buy').disabled = false; say(e.message); });
    });
  });
})();
