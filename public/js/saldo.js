(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var box = $('#topup'); if (!box) return;
  var token = null, methods = [], amount = 0, method = null;
  function usd(n) { return '$' + Number(n || 0).toFixed(2); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var api = function (p, o) { return NXApi(p, o, token); };
  var sheet = $('#sheet'), opener = $('#openbal'), lastFocus = null;
  function openSheet() {
    lastFocus = document.activeElement; sbal(); sheet.hidden = false;
    requestAnimationFrame(function () { sheet.classList.add('open'); });
    document.body.classList.add('noscroll'); var f = sheet.querySelector('.chip'); if (f) f.focus({ preventScroll: true });
  }
  function closeSheet() {
    sheet.classList.remove('open'); document.body.classList.remove('noscroll');
    setTimeout(function () { sheet.hidden = true; }, 260); if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function sbal() { var b = $('#bal'), t = $('#sbal'); if (b && t) t.textContent = b.textContent; }
  if (opener) opener.addEventListener('click', openSheet);
  sheet.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  if (location.hash === '#saldo') setTimeout(openSheet, 400);
  var msg = $('#tmsg');
  function say(t, ok) { msg.textContent = t || ''; msg.className = 'msg' + (ok ? ' ok' : ''); }

  var AMOUNTS = [5, 10, 20, 50], chips = $('#tamts'), mlist = $('#tmeth'), pay = $('#tpay');
  AMOUNTS.forEach(function (a) {
    var b = el('button', 'chip', '$' + a); b.type = 'button';
    b.addEventListener('click', function () { amount = a; Array.prototype.forEach.call(chips.children, function (x) { x.classList.toggle('on', x === b); }); refresh(); });
    chips.append(b);
  });

  function drawMethods() {
    mlist.replaceChildren();
    if (!methods.length) { mlist.append(el('p', 'muted', 'Aún no hay métodos de pago disponibles en tu país.')); return; }
    methods.forEach(function (m) {
      var b = el('button', 'prow mrow'); b.type = 'button';
      var ic = el('span', 'mico'); ic.append(NXArt.methodIcon(m.kind));
      var i = el('div', 'pi'); i.append(el('b', null, m.name), el('small', null, 'Pagas en ' + m.currency));
      b.append(ic, i);
      b.addEventListener('click', function () { method = m; Array.prototype.forEach.call(mlist.children, function (x) { x.classList.toggle('on', x === b); }); refresh(); });
      mlist.append(b);
    });
  }

  function refresh() {
    pay.hidden = !(amount && method); if (pay.hidden) return;
    $('#tins').textContent = method.instructions || '';
    $('#tdue').textContent = 'Calculando…';
    api('/api/topups/amount?amount=' + amount + '&currency=' + method.currency).then(function (d) {
      $('#tdue').textContent = 'Envía exactamente ' + (method.currency === 'USD' || method.currency === 'USDT' ? d.pay.toFixed(2) + ' ' + method.currency : d.pay.toLocaleString('es', { minimumFractionDigits: 2 }) + ' ' + method.currency) + ' (' + usd(amount) + ').';
    }).catch(function (e) { $('#tdue').textContent = e.message; });
  }

  function loadMine() {
    api('/api/topups').then(function (rows) {
      var l = $('#tlist'); l.replaceChildren();
      rows.slice(0, 5).forEach(function (r) {
        var st = r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' + (r.reject_reason ? ': ' + r.reject_reason : '') : 'En revisión';
        l.append(el('p', 'trow t-' + r.status, usd(r.amount_usd) + ' · ' + r.reference + ' · ' + st));
      });
    }).catch(function () {});
  }

  $('#tform').addEventListener('submit', function (e) {
    e.preventDefault();
    var ref = $('#tref').value.replace(/\s+/g, '');
    if (!amount) return say('Elige el monto.');
    if (!method) return say('Elige cómo pagaste.');
    if (ref.length < 4) return say('Escribe la referencia de tu pago.');
    var b = $('#tsend'); b.disabled = true; say('Enviando…', true);
    api('/api/topups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount: amount, method_id: method.id, reference: ref }) })
      .then(function () { say('Listo. Revisaremos tu pago y te acreditamos el saldo.', true); $('#tref').value = ''; loadMine(); })
      .catch(function (err) { say(err.message); }).then(function () { b.disabled = false; });
  });

  NX.ready.then(function (o) {
    if (!o.session) return; token = o.session.access_token;
    api('/api/payment-methods').then(function (m) { methods = m; drawMethods(); }).catch(function () { drawMethods(); });
    loadMine();
  });
})();
