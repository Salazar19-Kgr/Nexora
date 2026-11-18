(function () {
  var $ = function (s) { return document.querySelector(s); };
  var STATUS = {
    pending: ['Pendiente de pago', 'wait'], awaiting_review: ['En revisión', 'wait'], paid: ['Pagado', 'ok'],
    delivering: ['Entregando', 'ok'], completed: ['Completado', 'ok'], rejected: ['Rechazado', 'bad'],
    refunded: ['Reembolsado', 'bad'], disputed: ['En disputa', 'bad']
  };
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function initials(n) { var w = n.replace(/[:\-]/g, ' ').split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : n.slice(0, 2)).toUpperCase(); }

  window.NX.ready.then(function (o) {
    if (!o.sb || !o.session) { location.replace('/login'); return; }
    var sb = o.sb, u = o.session.user;
    var name = (u.user_metadata && u.user_metadata.username) || (u.email || '').split('@')[0] || 'usuario';
    $('#av').textContent = name.charAt(0);
    $('#uname').textContent = name;
    $('#umail').textContent = u.email || '';
    var fu = $('#f-user'), fm = $('#f-mail');
    if (fu) fu.value = name;
    if (fm) fm.value = u.email || '';
    $('#out').addEventListener('click', function () { sb.auth.signOut().then(function () { location.href = '/'; }); });

    var list = $('#orders');
    if (list) loadOrders(sb, list);

    var form = $('#pwf');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = $('#pmsg'), b = $('#pbtn'), p1 = $('#np').value, p2 = $('#np2').value;
      function say(t, ok) { m.textContent = t; m.className = 'msg' + (ok ? ' ok' : ''); }
      if (p1.length < 8) return say('La contraseña debe tener al menos 8 caracteres.');
      if (p1 !== p2) return say('Las contraseñas no coinciden.');
      b.disabled = true; say('');
      sb.auth.updateUser({ password: p1 }).then(function (r) {
        b.disabled = false;
        if (r.error) return say('No se pudo cambiar la contraseña. Inicia sesión de nuevo e inténtalo otra vez.');
        $('#np').value = ''; $('#np2').value = '';
        say('Contraseña actualizada.', true);
      });
    });
  });

  function loadOrders(sb, list) {
    sb.from('orders').select('id,amount_usd,status,created_at,products(name,games(name,slug))')
      .order('created_at', { ascending: false }).limit(10).then(function (r) {
        list.replaceChildren();
        if (r.error) { var e = document.createElement('p'); e.className = 'muted'; e.textContent = 'No se pudieron cargar tus pedidos.'; list.append(e); return; }
        var c = $('#ocount'); if (c) c.textContent = String(r.data.length);
        if (!r.data.length) { var p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Aún no tienes pedidos. ¡Haz tu primera recarga!'; list.append(p); return; }
        r.data.forEach(function (x) {
          var game = (x.products && x.products.games && x.products.games.name) || 'Juego';
          var pname = (x.products && x.products.name) || 'Paquete';
          var slug = (x.products && x.products.games && x.products.games.slug) || game.toLowerCase();
          var st = STATUS[x.status] || [x.status, 'wait'];
          var row = document.createElement('div'); row.className = 'order'; row.style.setProperty('--h', hue(slug));
          var art = document.createElement('div'); art.className = 'art'; art.textContent = initials(game);
          var t = document.createElement('div'); t.className = 't';
          var b = document.createElement('b'); b.textContent = game + ' · ' + pname;
          var s = document.createElement('small'); s.textContent = new Date(x.created_at).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' }) + ' · $' + Number(x.amount_usd).toFixed(2);
          t.append(b, s);
          var badge = document.createElement('span'); badge.className = 'st ' + st[1]; badge.textContent = st[0];
          row.append(art, t, badge); list.append(row);
        });
      });
  }
})();
