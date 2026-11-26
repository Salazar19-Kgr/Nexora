(function () {
  var $ = function (s) { return document.querySelector(s); };
  var oid = new URLSearchParams(location.search).get('o') || '';
  var token = null, order = null, methods = [], method = null, blob = null, timer = null;

  function say(t, ok) { var m = $('#msg'); m.textContent = t || ''; m.className = 'msg' + (ok ? ' ok' : ''); }
  function usd(n) { return '$' + Number(n).toFixed(2); }
  function fmt(n) { return Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var SYM = { VES: 'Bs ', DOP: 'RD$ ', MXN: 'MX$ ' };
  function expected(m) {
    if (SYM[m.currency]) return SYM[m.currency] + fmt(Math.round(Number(order.amount_usd) * Number(order.rate_applied || 0) * 100) / 100);
    return (m.currency === 'USDT' ? '' : '$') + fmt(order.amount_usd) + (m.currency === 'USDT' ? ' USDT' : '');
  }
  function copy(text, btn) {
    function done() { var t = btn.textContent; btn.textContent = '¡Copiado!'; setTimeout(function () { btn.textContent = t; }, 1400); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); done(); }
  }
  function show(id, on) { $(id).hidden = !on; }

  if (!/^[0-9a-f-]{36}$/i.test(oid)) { $('#sum').textContent = 'Pedido no válido.'; return; }

  NX.ready.then(function (o) {
    if (!o.session) { location.replace('/login'); return; }
    token = o.session.access_token; load(true);
  });

  function load(first) {
    NXApi('/api/orders/' + oid, null, token).then(function (d) {
      order = d; drawSummary(); route(first);
    }).catch(function (e) { $('#sum').textContent = e.status === 404 ? 'No encontramos este pedido.' : e.message; });
  }

  function drawSummary() {
    var g = (order.products && order.products.games) || {};
    var s = $('#sum'); s.replaceChildren();
    var logo = NXArt.logo(g, 'mid');
    var t = document.createElement('div'); t.className = 'st-txt';
    var b = document.createElement('b'); b.textContent = (g.name || 'Juego') + ' · ' + ((order.products && order.products.name) || 'Paquete');
    var sm = document.createElement('small'); var pd = order.player_details || {};
    sm.textContent = 'ID ' + (pd.player_id || '—') + (pd.server ? ' · Servidor ' + pd.server : '');
    t.append(b, sm);
    var p = document.createElement('div'); p.className = 'st-tot';
    var tb = document.createElement('b'); tb.textContent = usd(order.amount_usd);
    p.append(tb);
    if (Number(order.discount_usd) > 0) { var ds = document.createElement('small'); ds.textContent = 'Cupón −' + usd(order.discount_usd); p.append(ds); }
    s.append(logo, t, p);
  }

  function status(icon, cls, title, text, extra) {
    var s = $('#s-status'); s.replaceChildren(); s.hidden = false;
    var c = document.createElement('div'); c.className = 'card stat-card ' + cls;
    var i = document.createElement('div'); i.className = 'bigic'; i.append(NXArt.icon(icon, 'ic'));
    var h = document.createElement('h2'); h.textContent = title;
    var p = document.createElement('p'); p.className = 'muted'; p.textContent = text;
    c.append(i, h, p); if (extra) c.append(extra); s.append(c);
  }
  function link(href, text) { var a = document.createElement('a'); a.className = 'btn'; a.href = href; a.textContent = text; a.style.marginTop = '12px'; return a; }
  function steps(active) {
    var ol = document.createElement('ol'); ol.className = 'tl';
    ['Pago recibido', 'Verificando', 'Entregando', 'Listo'].forEach(function (t, i) { var li = document.createElement('li'); li.textContent = t; if (i < active) li.className = 'done'; else if (i === active) li.className = 'cur'; ol.append(li); });
    return ol;
  }

  function route(first) {
    var st = order.status;
    clearTimeout(timer);
    ['#s-methods', '#s-pay', '#s-proof', '#s-status'].forEach(function (x) { show(x, false); });
    if (st === 'pending') {
      var pr = order.proof;
      if (pr && pr.status === 'rejected') say('Tu comprobante anterior fue rechazado' + (pr.reject_reason ? ': ' + pr.reject_reason : '.') + ' Envía uno nuevo.');
      else if (first) say('');
      if (first || !methods.length) loadMethods(); else drawMethods();
      return;
    }
    say('');
    if (st === 'awaiting_review') { status('clock', 'wait', 'Verificando tu pago', 'Recibimos tu comprobante. En cuanto confirmemos el pago, tu recarga se libera sola. Puedes cerrar esta página.', steps(1)); poll(); }
    else if (st === 'paid' || st === 'delivering') { status('check', 'ok', 'Pago confirmado', 'Estamos entregando tu recarga. Te avisaremos aquí mismo.', steps(2)); poll(); }
    else if (st === 'completed') status('check', 'ok', '¡Recarga entregada!', 'Disfruta tus diamantes. Gracias por elegir NEXORA.', link('/juegos', 'Recargar otro juego'));
    else if (st === 'refunded') status('back', 'bad', 'Pedido reembolsado', 'Este pedido fue reembolsado. Si tienes dudas escríbenos a soporte.', link('/ajustes#soporte', 'Ir a soporte'));
    else if (st === 'disputed') status('clock', 'wait', 'Pedido en revisión', 'Estamos revisando este pedido con prioridad. Escríbenos si necesitas ayuda.', link('/ajustes#soporte', 'Ir a soporte'));
    else status('back', 'bad', 'Pedido cancelado', 'Este pedido fue rechazado o cancelado.', link('/juegos', 'Hacer otro pedido'));
  }
  function poll() { timer = setTimeout(function () { load(false); }, 6000); }

  function loadMethods() {
    NXApi('/api/payment-methods', null, token).then(function (m) { methods = m; drawMethods(); balPay(); })
      .catch(function (e) { say(e.message); });
  }
  function balPay() {
    var bx = $('#balpay'); if (!bx) return;
    NXApi('/api/me', null, token).then(function (me) {
      var bal = Number(me.balance_usd || 0), due = Number(order.amount_usd);
      bx.replaceChildren();
      if (!(bal >= due && due > 0)) { bx.hidden = true; return; }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn block'; b.textContent = 'Pagar con saldo (' + usd(bal) + ' disponible)';
      b.addEventListener('click', function () {
        if (!confirm('Se descontarán ' + usd(due) + ' de tu saldo.')) return;
        b.disabled = true; say('Pagando con saldo…', true);
        NXApi('/api/orders/' + oid + '/pay-balance', { method: 'POST' }, token).then(function () { say(''); load(false); })
          .catch(function (err) { b.disabled = false; say(err.message); });
      });
      bx.append(b); bx.hidden = false;
    }).catch(function () {});
  }
  function drawMethods() {
    var l = $('#mlist'); l.replaceChildren(); show('#s-methods', true);
    if (!methods.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Aún no hay métodos de pago disponibles. Escríbenos por soporte.'; l.append(e); return; }
    methods.forEach(function (m) {
      var ok = Number(order.amount_usd) >= Number(m.min_usd || 0);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'prow mrow'; b.disabled = !ok; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
      if (method && method.id === m.id) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); }
      var ic = document.createElement('span'); ic.className = 'radio'; ic.setAttribute('aria-hidden', 'true');
      var i = document.createElement('div'); i.className = 'pi';
      var nm = document.createElement('b'); nm.textContent = m.name;
      var sm = document.createElement('small'); sm.textContent = ok ? (m.currency === 'USDT' ? 'Equivale a ' + usd(order.amount_usd) : 'Pagas en ' + m.currency) : ('Mínimo ' + usd(m.min_usd));
      i.append(nm, sm);
      var pr = document.createElement('span'); pr.className = 'pp'; pr.textContent = ok ? expected(m) : '';
      b.append(ic, i, pr);
      b.addEventListener('click', function () { pickMethod(m); });
      l.append(b);
    });
    if (method) pickMethod(method, true);
  }
  function pickMethod(m, keep) {
    method = m;
    Array.prototype.forEach.call(document.querySelectorAll('#mlist .prow'), function (x, i) { var on = methods[i] && methods[i].id === m.id; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
    drawSum(m);
    $('#amt').textContent = expected(m); $('#mname').textContent = m.name; $('#instr').textContent = m.instructions;
    show('#s-pay', true); show('#s-proof', true);
    if (!keep) setTimeout(function () { $('#s-pay').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }
  function drawSum(m) {
    var b = $('#psum'); b.replaceChildren(); b.hidden = false;
    function row(l, v, c) { var r = document.createElement('div'); r.className = 'srow' + (c ? ' ' + c : ''); var a = document.createElement('span'); a.textContent = l; var x = document.createElement('b'); x.textContent = v; r.append(a, x); return r; }
    var h = document.createElement('h3'); h.textContent = 'Resumen de pago'; b.append(h);
    var base = Number(order.amount_usd) + Number(order.discount_usd || 0);
    b.append(row('Precio', usd(base)));
    if (Number(order.discount_usd) > 0) { var d = row('Descuento', '−' + usd(order.discount_usd)); d.lastChild.className = 'dsc'; b.append(d); }
    b.append(row('Total a pagar', expected(m), 'tot'));
  }
  $('#cp-amt').addEventListener('click', function (e) { copy($('#amt').textContent.replace(/^[^0-9]+/, '').replace(/\s*USDT$/, ''), e.target); });
  $('#cp-ins').addEventListener('click', function (e) { copy($('#instr').textContent, e.target); });

  // ---- captura: se reduce en el teléfono antes de subirla
  $('#pick').addEventListener('click', function () { $('#file').click(); });
  $('#file').addEventListener('change', function () {
    var f = this.files && this.files[0]; blob = null; $('#prev').hidden = true;
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { say('La captura debe ser una imagen JPG, PNG o WEBP.'); return; }
    say('Preparando imagen…', true);
    shrink(f).then(function (b) {
      if (b.size > 5 * 1024 * 1024) { say('La imagen es demasiado pesada (máximo 5 MB).'); return; }
      blob = b; var u = URL.createObjectURL(b); $('#prev').src = u; $('#prev').hidden = false; $('#picklbl').textContent = 'Cambiar captura'; say('');
    });
  });
  function shrink(f) {
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var m = 1600, k = Math.min(1, m / Math.max(img.width, img.height));
        if (k === 1 && f.size < 1.5 * 1024 * 1024) { URL.revokeObjectURL(url); return res(f); }
        var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || f); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(f); };
      img.src = url;
    });
  }

  $('#pf').addEventListener('submit', function (e) {
    e.preventDefault();
    var ref = $('#ref').value.replace(/\s+/g, '');
    if (!method) return say('Elige un método de pago.');
    if (ref.length < 4) return say('Escribe el número de referencia de tu pago.');
    if (!blob) return say('Sube la captura de tu pago.');
    var fd = new FormData(); fd.append('method_id', method.id); fd.append('reference', ref); fd.append('proof', blob, 'captura.jpg');
    $('#send').disabled = true; say('Enviando comprobante…', true);
    NXApi('/api/orders/' + oid + '/proof', { method: 'POST', body: fd }, token)
      .then(function () { say(''); load(false); })
      .catch(function (err) { $('#send').disabled = false; say(err.message); });
  });
})();
