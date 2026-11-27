(function () {
  // ---- Tema de la tienda: se aplica al instante con la copia guardada y luego se confirma con el servidor.
  var root = document.documentElement, THEMES = ['general', 'navidad'];
  var qp = new URLSearchParams(location.search).get('tema');
  var preview = THEMES.indexOf(qp) > -1 ? qp : null;
  var cached = 'general'; try { cached = localStorage.getItem('nx_theme') || 'general'; } catch (e) {}
  if (THEMES.indexOf(cached) < 0) cached = 'general';
  root.dataset.theme = preview || cached;
  if (!/^\/(admin|ceo)\/?$/.test(location.pathname)) {
    var cl = document.createElement('link'); cl.rel = 'stylesheet'; cl.href = '/css/theme.css'; document.head.appendChild(cl);
  }
  var P = {
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-7 0-3-1.8-5-3.4-7-.4 1.6-1.2 2.6-2.2 3 .4-3.2-1-6.2-3.4-9-.4 3.4-2 5.4-3.6 7.4C5 11 5 13 5 15c0 4.2 3 7 7 7z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a2 2 0 0 0 3.4 0"/>',
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    gamepad: '<path d="M7 7h10a5 5 0 0 1 5 5v2a3 3 0 0 1-5.2 2L15 14H9l-1.8 2A3 3 0 0 1 2 14v-2a5 5 0 0 1 5-5z"/><path d="M8 9.5v3M6.5 11h3M16 10.5h.01M18 12.5h.01"/>',
    headset: '<path d="M3 14v-2a9 9 0 0 1 18 0v2M3 14h3v5H4a1 1 0 0 1-1-1zM21 14h-3v5h2a1 1 0 0 0 1-1zM18 19a4 4 0 0 1-4 3h-2"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    panel: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
    star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    chat: '<path d="M21 12a9 9 0 0 1-13.3 7.9L3 21l1.2-4.5A9 9 0 1 1 21 12z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M9.5 16V8l5 8V8"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><path d="M16 14h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'
  };
  function ic(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function sprite() {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ffd6"/><stop offset=".5" stop-color="#16D94A"/><stop offset="1" stop-color="#0a8f2e"/></linearGradient></defs>';
    for (var k in P) s += '<symbol id="i-' + k + '" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + P[k] + '</g></symbol>';
    s += '<symbol id="i-logo" viewBox="0 0 40 40"><polygon points="7,35 7,5 15,5 26,22 26,5 33,5 33,35 25,35 14,18 14,35" fill="#075c1f" transform="translate(2,2)"/><polygon points="7,35 7,5 15,5 26,22 26,5 33,5 33,35 25,35 14,18 14,35" fill="url(#lg)" stroke="#e9fff0" stroke-width=".7" stroke-linejoin="miter"/></symbol></svg>';
    return s;
  }
  function logo(cls) { return '<svg class="' + (cls || 'logo') + '" viewBox="0 0 40 40" aria-hidden="true"><use href="#i-logo"/></svg>'; }

  var path = location.pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/';
  var ADMIN = path === '/admin';
  function on(p) { return path === p ? ' class="on"' : ''; }
  var WA = 'https://wa.me/584245095002?text=Hola%20NEXORA';

  var LOGOS = { general: '/img/logo-general.webp', navidad: '/img/logo-navidad.webp' };
  var header = '<header class="topbar nxhead"><div class="wrap bar">' +
    '<a class="brand" href="/" aria-label="NEXORA, recargas, juegos y entretenimiento"><img id="brandimg" class="brandimg" src="' + LOGOS[root.dataset.theme] + '" alt="NEXORA · Recargas · Juegos · Entretenimiento" width="400" height="116"></a>' +
    '<nav class="links" aria-label="Principal">' +
    '<a href="/"' + on('/') + '>' + ic('home') + 'Inicio</a>' +
    '<a href="/juegos"' + ((path === '/juegos' || path === '/juego' || path === '/pago') ? ' class="on"' : '') + '>' + ic('gamepad') + 'Juegos</a>' +
    '<a href="/ofertas"' + on('/ofertas') + '>' + ic('tag') + 'Ofertas</a>' +
    '<a id="navord" href="/pedidos"' + on('/pedidos') + '>' + ic('list') + 'Pedidos</a>' +
    '<a id="navacct" href="/login"' + ((path === '/cuenta' || path === '/ajustes') ? ' class="on"' : '') + '>' + ic('user') + 'Mi cuenta</a></nav>' +
    '<div class="actions"><a id="bell" class="circ bell" href="/pedidos" aria-label="Mis pedidos en curso" hidden>' + ic('bell') + '<b class="cnt" hidden></b></a><a id="userbtn" class="circ" href="/login" aria-label="Iniciar sesión">' + ic('user') + '</a></div></div></header>';

  var tabs = '<nav class="tabbar" aria-label="Navegación móvil">' +
    '<a href="/"' + on('/') + '>' + ic('home') + '<span>Inicio</span></a>' +
    '<a href="/juegos"' + ((path === '/juegos' || path === '/juego' || path === '/pago') ? ' class="on"' : '') + '>' + ic('gamepad') + '<span>Juegos</span></a>' +
    '<a id="tabofe" href="/ofertas"' + on('/ofertas') + '>' + ic('tag') + '<span>Ofertas</span><i class="hot" hidden>HOT</i></a>' +
    '<a id="tabord" href="/pedidos"' + on('/pedidos') + '>' + ic('list') + '<span>Pedidos</span></a>' +
    '<a id="tabacct" href="/login" class="' + ((path === '/login' || path === '/registro' || path === '/cuenta' || path === '/ajustes') ? 'on' : '') + '">' + ic('user') + '<span>Cuenta</span></a></nav>';

  var footer = '<footer class="foot"><div class="wrap">' +
    '<div class="brandrow">' + logo() + '<span class="wm">NEXORA</span></div>' +
    '<p class="d">Tu ecosistema gaming: recargas de juegos, productos digitales y herramientas de IA.</p>' +
    '<details><summary>Soporte</summary><p><a href="' + WA + '" target="_blank" rel="noopener">WhatsApp: +58 424 5095002</a></p><p><a href="mailto:prds33735435@gmail.com">prds33735435@gmail.com</a></p></details>' +
    '<details><summary>Métodos de pago</summary><p>Los métodos disponibles se muestran al pagar tu pedido: pago móvil, transferencia, Zelle, USDT y más.</p></details>' +
    '<div class="contact"><h3 class="sig">Contáctanos</h3>' +
    '<div class="social"><a href="' + WA + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ic('chat') + '</a><a href="mailto:prds33735435@gmail.com" aria-label="Correo">' + ic('mail') + '</a></div></div>' +
    '<p class="legalrow"><a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a> · <a href="/reembolsos">Reembolsos</a></p>' +
    '<p class="copy">© 2026 Nexora Ecosistem de AI. Todos los derechos reservados.</p></div></footer>';

  // El panel de administración es solo para administrar: sin tienda, sin perfil, sin soporte.
  var adminHeader = '<header class="topbar adm-top"><div class="wrap bar">' +
    '<span class="lockup">' + logo() + '<span class="wm">NEXORA</span><span class="admtag">ADMIN</span></span>' +
    '<div class="actions"><button type="button" id="admout" class="btn ghost sm">' + ic('logout') + 'Salir</button></div></div></header>';
  if (ADMIN) {
    document.body.classList.add('isadmin');
    document.body.insertAdjacentHTML('afterbegin', sprite() + adminHeader);
  } else {
    document.body.insertAdjacentHTML('afterbegin', sprite() + header);
    document.body.insertAdjacentHTML('beforeend', footer + tabs);
  }
  window.NXI = { ic: ic, logo: logo, WA: WA };
  // Tema vigente (verdad del servidor). Todos los visitantes ven el mismo; "?tema=" solo sirve para previsualizar.
  var themeP = ADMIN ? Promise.resolve(null) : fetch('/api/theme').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  function fx() { if (root.dataset.theme !== 'navidad' || document.getElementById('nxfx')) return; var f = document.createElement('script'); f.id = 'nxfx'; f.src = '/js/fx.js'; f.defer = true; document.body.appendChild(f); }
  window.NXTheme = themeP.then(function (t) {
    var th = preview || (t && THEMES.indexOf(t.theme) > -1 ? t.theme : cached);
    root.dataset.theme = th;
    if (!preview) { try { localStorage.setItem('nx_theme', th); } catch (e) {} }
    var im = document.getElementById('brandimg'); if (im) im.src = LOGOS[th];
    if (preview && !ADMIN) {
      var pv = document.createElement('div'); pv.className = 'tpreview'; pv.textContent = 'Vista previa · solo la ves tú';
      var x = document.createElement('a'); x.href = location.pathname; x.textContent = 'Salir'; pv.append(x); document.body.append(pv);
    }
    fx();
    return { theme: th, content: t && t.content ? t.content : null };
  });
  window.NXApi = function (path, opts, token) {
    opts = opts || {};
    if (token) opts.headers = Object.assign({ authorization: 'Bearer ' + token }, opts.headers || {});
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) { var e = new Error((d && d.error) || 'Error de conexión'); e.status = r.status; throw e; }
        return d;
      });
    });
  };

  var cfgP = fetch('/api/config').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  window.NX = {
    ready: (async function () {
      var cfg = await cfgP;
      if (!cfg || !window.supabase) return { sb: null, session: null };
      var sb = window.supabase.createClient(cfg.url, cfg.anonKey);
      var r = await sb.auth.getSession();
      return { sb: sb, session: r.data.session };
    })()
  };

  var COUNTRIES = [['VE', 'Venezuela'], ['DO', 'República Dominicana'], ['PA', 'Panamá'], ['MX', 'México'], ['US', 'Estados Unidos']];
  window.NXCountries = COUNTRIES;

  // Quien no tiene país (cuentas viejas o con Google/Discord/Facebook) debe elegirlo antes de seguir.
  function needCountry(o) {
    if (/^\/(login|registro|ceo|estado)$/.test(path)) return;
    var tk = o.session.access_token;
    window.NXApi('/api/me', null, tk).then(function (m) {
      if (m && m.country) return;
      var wrap = document.createElement('div'); wrap.className = 'cgate'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
      var box = document.createElement('div'); box.className = 'cbox';
      var h2 = document.createElement('h2'); h2.textContent = 'Elige tu país';
      var p = document.createElement('p'); p.textContent = 'Lo necesitamos para mostrarte los precios y métodos de pago de tu país. Solo se elige una vez.';
      var sel = document.createElement('select'); sel.setAttribute('aria-label', 'País');
      var first = document.createElement('option'); first.value = ''; first.textContent = 'Selecciona…'; sel.append(first);
      COUNTRIES.forEach(function (c) { var op = document.createElement('option'); op.value = c[0]; op.textContent = c[1]; sel.append(op); });
      var msg = document.createElement('p'); msg.className = 'msg';
      var go = document.createElement('button'); go.type = 'button'; go.className = 'btn block'; go.textContent = 'Guardar y continuar';
      go.addEventListener('click', function () {
        if (!sel.value) { msg.textContent = 'Elige tu país para continuar.'; return; }
        go.disabled = true;
        window.NXApi('/api/country', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ country: sel.value }) }, tk)
          .then(function () { location.reload(); })
          .catch(function (e) { msg.textContent = e.message; go.disabled = false; });
      });
      box.append(h2, p, sel, msg, go); wrap.append(box); document.body.append(wrap);
    }).catch(function () {});
  }

  window.NX.ready.then(function (o) {
    if (ADMIN) {
      var ob = document.getElementById('admout');
      if (ob) ob.addEventListener('click', function () { (o.sb ? o.sb.auth.signOut() : Promise.resolve()).then(function () { location.replace('/login'); }); });
      return;
    }
    if (!o.session) return;
    var u = o.session.user;
    // La cuenta SSECEO es solo de administración: nunca entra a la tienda.
    if (/@nexora\.invalid$/i.test(u.email || '') && !/^\/(ceo|login)$/.test(path)) { location.replace('/admin'); return; }
    needCountry(o);
    if (o.sb) o.sb.from('orders').select('id', { count: 'exact', head: true }).in('status', ['awaiting_review', 'paid', 'delivering']).then(function (r) {
      var bl = document.getElementById('bell'); if (!bl) return; bl.hidden = false;
      var n = Number(r && r.count) || 0, c = bl.querySelector('.cnt'); if (n > 0) { c.textContent = n > 9 ? '9+' : String(n); c.hidden = false; }
    }).catch(function () {});
    var name = (u.user_metadata && u.user_metadata.username) || (u.email || '').split('@')[0] || 'usuario';
    ['navacct', 'tabacct'].forEach(function (id) { var a = document.getElementById(id); if (a) a.setAttribute('href', '/cuenta'); });
    var btn = document.getElementById('userbtn');
    btn.removeAttribute('href');
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Menú de cuenta');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('tabindex', '0');
    var pic = document.createElement('img'); pic.src = '/img/girl-avatar.webp'; pic.alt = ''; btn.textContent = ''; btn.appendChild(pic);
    var menu = document.createElement('div');
    menu.className = 'menu';
    menu.hidden = true;
    var p = document.createElement('p');
    p.textContent = 'Hola, ' + name;
    menu.appendChild(p);
    btn.classList.add('has-av');
    [['/cuenta', 'Mi perfil'], ['/pedidos', 'Mis pedidos'], ['/ajustes', 'Configuración'], ['/ajustes#soporte', 'Soporte']].forEach(function (l) {
      var a = document.createElement('a'); a.href = l[0]; a.textContent = l[1]; menu.appendChild(a);
    });
    var out = document.createElement('button');
    out.type = 'button';
    out.textContent = 'Cerrar sesión';
    out.addEventListener('click', function () { o.sb.auth.signOut().then(function () { location.href = '/'; }); });
    menu.appendChild(out);
    btn.parentNode.appendChild(menu);
    fetch('/api/admin/me', { headers: { authorization: 'Bearer ' + o.session.access_token } }).then(function (r) {
      if (!r.ok) return;
      var ad = document.createElement('a'); ad.href = '/admin'; ad.className = 'adminlink'; ad.textContent = 'Panel admin';
      menu.insertBefore(ad, out);
    }).catch(function () {});
    function toggle(e) { if (e) e.preventDefault(); menu.hidden = !menu.hidden; }
    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') toggle(e); if (e.key === 'Escape') menu.hidden = true; });
    document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) menu.hidden = true; });
  });
})();
