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
    var n = prizes.length, sa = 360 / n, C = 150, R = 136;
    var svg = el('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': 'Ruleta de premios con ' + n + ' premios' });
    var defs = el('defs', {});
    var rg = el('radialGradient', { id: 'wgl', gradientUnits: 'userSpaceOnUse', cx: 150, cy: 150, r: 136 });
    rg.append(el('stop', { offset: '0', 'stop-color': '#000', 'stop-opacity': '.45' }), el('stop', { offset: '1', 'stop-color': '#16D94A', 'stop-opacity': '.22' }));
    defs.append(rg); svg.append(defs);
    // aro exterior con luces
    svg.append(el('circle', { cx: C, cy: C, r: 148, fill: '#06130b', stroke: '#16D94A', 'stroke-width': 2.5 }));
    for (var k = 0; k < 24; k++) { var lp = pt(C, C, 142, k * 15); svg.append(el('circle', { cx: lp[0].toFixed(1), cy: lp[1].toFixed(1), r: 2.2, fill: k % 2 ? '#c9ffd6' : '#16D94A' })); }
    var g = el('g', { class: 'wheel', id: 'wheelg' });
    var TINT = { common: '#103c1f', unc: '#0e3a4a', epic: '#3a1f5a', leg: '#5a4510', none: '#10191a' };
    var EDGE = { common: '#16D94A', unc: '#38bdf8', epic: '#a78bfa', leg: '#fbbf24', none: '#4b5b55' };
    prizes.forEach(function (pr, i) {
      var tk = tier(pr)[1], f = TINT[tk] || '#103c1f', ed = EDGE[tk] || '#16D94A';
      if (n === 1) { g.append(el('circle', { cx: C, cy: C, r: R, fill: f, stroke: ed, 'stroke-width': 2 })); }
      else {
        var a = pt(C, C, R, i * sa), b = pt(C, C, R, (i + 1) * sa);
        var d = 'M' + C + ' ' + C + 'L' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + 'A' + R + ' ' + R + ' 0 ' + (sa > 180 ? 1 : 0) + ' 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2) + 'Z';
        g.append(el('path', { d: d, fill: i % 2 ? f : f, stroke: '#16D94A', 'stroke-width': 1.2, 'stroke-opacity': .7 }));
        g.append(el('path', { d: d, fill: 'url(#wgl)', opacity: i % 2 ? .55 : .85 }));
      }
      // contenido del sector: moneda arriba (hacia el borde) y valor debajo, siempre legible
      var mid = (i + 0.5) * sa, sg = el('g', { transform: 'rotate(' + mid + ' ' + C + ' ' + C + ')' });
      var sz = n > 8 ? 26 : 34;
      if (pr.prize_type === 'coins') {
        var u = el('use', { href: '#m-coin', x: C - sz / 2, y: C - R + 8, width: sz, height: sz });
        sg.append(u);
        var t = el('text', { x: C, y: C - R + sz + 22, 'text-anchor': 'middle', fill: '#eafff0', 'font-size': n > 8 ? 12 : 15, 'font-weight': 800 });
        t.textContent = String(Math.trunc(Number(pr.value) || 0)); sg.append(t);
      } else {
        var lab = pr.prize_type === 'none' ? 'Nada' : (pr.label.length > 10 ? pr.label.slice(0, 9) + '…' : pr.label);
        var t2 = el('text', { x: C, y: C - R + 30, 'text-anchor': 'middle', fill: pr.prize_type === 'none' ? '#8a9a93' : '#F4F7F5', 'font-size': n > 8 ? 10 : 12, 'font-weight': 800 });
        t2.textContent = lab; sg.append(t2);
      }
      g.append(sg);
    });
    svg.append(g);
    svg.append(el('circle', { cx: C, cy: C, r: 26, fill: '#050907', stroke: '#16D94A', 'stroke-width': 3 }));
    svg.append(el('use', { href: '#m-coin', x: C - 19, y: C - 21, width: 38, height: 38 }));
    var ptr = document.createElement('div'); ptr.className = 'pointer'; ptr.setAttribute('aria-hidden', 'true');
    box.append(svg, ptr);
    $('#wheelg').style.transformOrigin = '150px 150px';
    $('#wheelg').style.transform = 'rotate(' + rot + 'deg)';
  }

  // ---------- Sonido de la ruleta (WebAudio, sin archivos) ----------
  var actx = null;
  function sndOn() { try { return localStorage.getItem('nx_wsnd') !== '0'; } catch (e) { return true; } }
  function audio() { try { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; if (!actx) actx = new C(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
  function tone(c, t, f, d, v, type) {
    var o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  }
  // Curva de frenado igual a la del CSS (cubic-bezier(.12,.7,.1,1)) para que los "clics" coincidan con la ruleta.
  function easeTable() {
    var pts = [], i, s, u;
    for (i = 0; i <= 400; i++) { s = i / 400; u = 1 - s; pts.push([3 * u * u * s * 0.12 + 3 * u * s * s * 0.1 + s * s * s, 3 * u * u * s * 0.7 + 3 * u * s * s + s * s * s]); }
    return pts;
  }
  function playTicks(c, totalDeg, startDeg, sa, dur) {
    var pts = easeTable(), last = Math.floor(startDeg / sa), t0 = c.currentTime + 0.03, i, k;
    for (i = 1; i < pts.length; i++) {
      k = Math.floor((startDeg + pts[i][1] * totalDeg) / sa);
      if (k > last) {
        last = k; var tt = t0 + pts[i][0] * dur, slow = pts[i][0];
        tone(c, tt, 900 + 500 * (1 - slow), 0.05, 0.18 + 0.1 * slow, 'triangle');
      }
    }
  }
  function playResult(c, prize) {
    var t = c.currentTime + 0.02;
    if (!prize || prize.prize_type === 'none') { tone(c, t, 220, 0.25, 0.2, 'sine'); tone(c, t + 0.2, 165, 0.35, 0.2, 'sine'); return; }
    [523, 659, 784, 1047].forEach(function (f, i) { tone(c, t + i * 0.11, f, 0.32, 0.22, 'triangle'); });
  }

  function spin() {
    if (busy || spins < 1 || !prizes.length) return;
    busy = true; updateBtn(); $('#pmsg2').textContent = '';
    var ac = sndOn() ? audio() : null;
    call('/api/spin', { method: 'POST' }).then(function (r) {
      var i = prizes.findIndex(function (p) { return p.id === r.prize.prize_id; });
      if (i < 0) i = 0;
      var sa = 360 / prizes.length;
      var target = (360 - (i + 0.5) * sa + 360) % 360;
      var cur = ((rot % 360) + 360) % 360;
      var before = rot; rot = rot + 360 * 5 + ((target - cur + 360) % 360);
      var g = $('#wheelg');
      g.style.transform = 'rotate(' + rot + 'deg)';
      if (ac) { try { playTicks(ac, rot - before, 0, sa, 4.6); } catch (e) {} }
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () {
        var pz = r.prize, txt;
        if (pz.prize_type === 'none') txt = pz.label;
        else if (pz.prize_type === 'balance') txt = '¡Ganaste ' + usd(pz.value) + ' de saldo!';
        else if (pz.prize_type === 'points') txt = '¡Ganaste ' + Number(pz.value) + ' puntos!';
        else if (pz.prize_type === 'coins') txt = '¡Ganaste ' + Number(pz.value) + ' NexoCoins! Se usan como descuento al comprar.';
        else txt = '¡Ganaste ' + Number(pz.value) + ' giros extra!';
        $('#pmsg2').textContent = txt;
        if (ac) { try { playResult(ac, pz); } catch (e) {} }
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
  var sb = $('#wsnd');
  if (sb) {
    var paintSnd = function () { sb.textContent = sndOn() ? '🔊 Sonido activado' : '🔇 Sonido apagado'; };
    paintSnd();
    sb.addEventListener('click', function () { try { localStorage.setItem('nx_wsnd', sndOn() ? '0' : '1'); } catch (e) {} paintSnd(); if (sndOn()) audio(); });
  }

  window.NX.ready.then(function (o) {
    if (!o.session) return;
    token = o.session.access_token;
    call('/api/me').then(paint).catch(function () {});
    fetch('/api/wheel', { headers: auth() }).then(function (r) { return r.ok ? r.json() : { prizes: [], spins: 0 }; }).then(function (w) {
      prizes = w.prizes || []; spins = w.spins || 0; drawWheel(); paint({ spins: spins }); drawOdds();
    }).catch(function () { drawWheel(); });
  });
})();
