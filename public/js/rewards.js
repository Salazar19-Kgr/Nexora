(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var token = null, prizes = [], spins = 0, rot = 0, busy = false;

  function usd(n) { return '$' + Number(n || 0).toFixed(2); }

  function auth(extra) {
    var h = { authorization: 'Bearer ' + token };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function call(path, opts) {
    opts = opts || {};
    opts.headers = auth(opts.headers);
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || 'Error de conexión');
        return d;
      });
    });
  }

  function paint(p) {
    if (p.balance_usd != null) $('#bal').textContent = usd(p.balance_usd);
    if (p.points != null) $('#pts').textContent = String(p.points);
    if (p.coins != null && $('#coins')) $('#coins').textContent = String(p.coins);
    if (p.spins != null) { spins = p.spins; $('#spn').textContent = String(p.spins); updateBtn(); }
  }
  // Probabilidades y posibles recompensas por rareza
  function tier(p) {
    if (p.prize_type === 'none') return ['Sin premio', 'none'];
    if (p.pct >= 30) return ['Común', 'common'];
    if (p.pct >= 10) return ['Poco común', 'unc'];
    if (p.pct >= 3) return ['Épico', 'epic'];
    return ['Legendario', 'leg'];
  }
  function prizeArt(p) {
    if (p.prize_type === 'coins') return NXArt.coin('pa');
    if (p.prize_type === 'balance') return NXArt.icon('wallet', 'pa ic');
    if (p.prize_type === 'points') return NXArt.icon('star', 'pa ic');
    if (p.prize_type === 'spins') return NXArt.icon('bolt', 'pa ic');
    return NXArt.icon('shield', 'pa ic');
  }
  function drawOdds() {
    var pb = $('#wprobs'), gr = $('#rwgrid'); if (!pb || !gr) return;
    pb.replaceChildren(); gr.replaceChildren();
    var by = {};
    prizes.forEach(function (p) { var t = tier(p); by[t[1]] = by[t[1]] || { name: t[0], pct: 0 }; by[t[1]].pct += Number(p.pct) || 0; });
    ['common', 'unc', 'epic', 'leg', 'none'].forEach(function (k) {
      if (!by[k]) return;
      var row = document.createElement('div'); row.className = 'prow2 t-' + k;
      var n = document.createElement('span'); n.textContent = by[k].name;
      var bar = document.createElement('i'), fill = document.createElement('b'); fill.style.width = Math.min(100, by[k].pct) + '%'; bar.append(fill);
      var v = document.createElement('em'); v.textContent = (Math.round(by[k].pct * 10) / 10) + '%';
      row.append(n, bar, v); pb.append(row);
    });
    prizes.forEach(function (p) {
      var t = tier(p), c = document.createElement('div'); c.className = 'rcard t-' + t[1];
      var a = document.createElement('div'); a.className = 'ra'; a.append(prizeArt(p));
      var l = document.createElement('b'); l.textContent = p.label;
      var s = document.createElement('small'); s.textContent = t[0];
      c.append(a, l, s); gr.append(c);
    });
  }
  function updateBtn() {
    var b = $('#spinbtn');
    b.disabled = busy || !prizes.length || spins < 1;
    b.textContent = !prizes.length ? 'Ruleta sin premios' : spins < 1 ? 'Sin giros disponibles' : 'Girar (' + spins + ')';
  }

  // ---------- Dibujo de la ruleta (SVG) ----------
  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function pt(cx, cy, r, deg) { var a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }

  function drawWheel() {
    var box = $('#wbox');
    box.replaceChildren();
    if (!prizes.length) { var p = document.createElement('p'); p.className = 'muted'; p.textContent = 'La ruleta aún no tiene premios.'; box.append(p); box.style.aspectRatio = 'auto'; return; }
    box.style.aspectRatio = '1';
    var n = prizes.length, sa = 360 / n, C = 150, R = 144;
    var svg = el('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': 'Ruleta de premios con ' + n + ' premios' });
    var g = el('g', { class: 'wheel', id: 'wheelg' });
    var fills = ['#0f3a1d', '#0a1f12', '#14502a', '#0b2a16'];
    prizes.forEach(function (pr, i) {
      var f = fills[i % fills.length];
      if (n === 1) { g.append(el('circle', { cx: C, cy: C, r: R, fill: f, stroke: '#16D94A', 'stroke-width': 2 })); }
      else {
        var a = pt(C, C, R, i * sa), b = pt(C, C, R, (i + 1) * sa);
        g.append(el('path', { d: 'M' + C + ' ' + C + 'L' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + 'A' + R + ' ' + R + ' 0 ' + (sa > 180 ? 1 : 0) + ' 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2) + 'Z', fill: f, stroke: '#16D94A', 'stroke-width': 1.5 }));
      }
      var mid = (i + 0.5) * sa, tp = pt(C, C, R * 0.62, mid);
      var t = el('text', { x: tp[0].toFixed(2), y: tp[1].toFixed(2), transform: 'rotate(' + (mid - 90) + ' ' + tp[0].toFixed(2) + ' ' + tp[1].toFixed(2) + ')', 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#F4F7F5', 'font-size': n > 8 ? 9 : 11, 'font-weight': 700 });
      t.textContent = pr.label.length > 14 ? pr.label.slice(0, 13) + '…' : pr.label;
      g.append(t);
    });
    svg.append(g);
    svg.append(el('circle', { cx: C, cy: C, r: 18, fill: '#050907', stroke: '#16D94A', 'stroke-width': 3 }));
    svg.append(el('circle', { cx: C, cy: C, r: R + 3, fill: 'none', stroke: '#16D94A', 'stroke-width': 3, opacity: .6 }));
    var ptr = document.createElement('div'); ptr.className = 'pointer'; ptr.setAttribute('aria-hidden', 'true');
    box.append(svg, ptr);
    $('#wheelg').style.transformOrigin = '150px 150px';
    $('#wheelg').style.transform = 'rotate(' + rot + 'deg)';
  }

  function spin() {
    if (busy || spins < 1 || !prizes.length) return;
    busy = true; updateBtn(); $('#pmsg2').textContent = '';
    call('/api/spin', { method: 'POST' }).then(function (r) {
      var i = prizes.findIndex(function (p) { return p.id === r.prize.prize_id; });
      if (i < 0) i = 0;
      var sa = 360 / prizes.length;
      var target = (360 - (i + 0.5) * sa + 360) % 360;
      var cur = ((rot % 360) + 360) % 360;
      rot = rot + 360 * 5 + ((target - cur + 360) % 360);
      var g = $('#wheelg');
      g.style.transform = 'rotate(' + rot + 'deg)';
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () {
        var pz = r.prize, txt;
        if (pz.prize_type === 'none') txt = pz.label;
        else if (pz.prize_type === 'balance') txt = '¡Ganaste ' + usd(pz.value) + ' de saldo!';
        else if (pz.prize_type === 'points') txt = '¡Ganaste ' + Number(pz.value) + ' puntos!';
        else if (pz.prize_type === 'coins') txt = '¡Ganaste ' + Number(pz.value) + ' NexoCoins! Se usan como descuento al comprar.';
        else txt = '¡Ganaste ' + Number(pz.value) + ' giros extra!';
        $('#pmsg2').textContent = txt;
        busy = false; paint({ spins: r.spins, balance_usd: r.balance_usd, points: r.points, coins: r.coins });
      }, reduce ? 50 : 4700);
    }).catch(function (e) {
      busy = false; $('#pmsg2').textContent = e.message; updateBtn();
    });
  }

  // ---------- Canje de códigos ----------
  $('#redeem').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('#rmsg'), b = $('#rbtn'), code = $('#rcode').value.trim();
    function say(t, ok) { m.textContent = t; m.className = 'msg' + (ok ? ' ok' : ''); }
    if (!code) return say('Escribe un código.');
    b.disabled = true; say('');
    call('/api/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code }) }).then(function (r) {
      var v = Number(r.reward_value);
      say(r.reward_type === 'balance' ? '¡Listo! Sumaste ' + usd(v) + ' de saldo.' : r.reward_type === 'coins' ? '¡Listo! Sumaste ' + v + ' NexoCoins.' : r.reward_type === 'points' ? '¡Listo! Sumaste ' + v + ' puntos.' : '¡Listo! Sumaste ' + v + ' giros de ruleta.', true);
      $('#rcode').value = '';
      return call('/api/me').then(paint);
    }).catch(function (err) { say(err.message); }).then(function () { b.disabled = false; });
  });
  $('#spinbtn').addEventListener('click', spin);

  window.NX.ready.then(function (o) {
    if (!o.session) return;
    token = o.session.access_token;
    call('/api/me').then(paint).catch(function () {});
    fetch('/api/wheel', { headers: auth() }).then(function (r) { return r.ok ? r.json() : { prizes: [], spins: 0 }; }).then(function (w) {
      prizes = w.prizes || []; spins = w.spins || 0; drawWheel(); paint({ spins: spins }); drawOdds();
    }).catch(function () { drawWheel(); });
  });
})();
