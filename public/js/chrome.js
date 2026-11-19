(function () {
  var P = {
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
  function on(p) { return path === p ? ' class="on"' : ''; }
  var WA = 'https://wa.me/584245095002?text=Hola%20NEXORA';

  var header = '<header class="topbar"><div class="wrap bar">' +
    '<a class="lockup" href="/" aria-label="NEXORA, inicio">' + logo() + '<span class="wm">NEXORA</span></a>' +
    '<nav class="links" aria-label="Principal">' +
    '<a href="/"' + on('/') + '>' + ic('home') + 'Inicio</a>' +
    '<a href="/#juegos">' + ic('gamepad') + 'Juegos</a>' +
    '<a id="navacct" href="/login"' + ((path === '/cuenta') ? ' class="on"' : '') + '>' + ic('user') + 'Mi cuenta</a>' +
    '<a href="/ajustes"' + on('/ajustes') + '>' + ic('settings') + 'Ajustes</a></nav>' +
    '<div class="actions"><a id="userbtn" class="circ" href="/login" aria-label="Iniciar sesión">' + ic('user') + '</a></div></div></header>';

  var tabs = '<nav class="tabbar" aria-label="Navegación móvil">' +
    '<a href="/"' + on('/') + '>' + ic('home') + 'Inicio</a>' +
    '<a href="/#juegos">' + ic('gamepad') + 'Juegos</a>' +
    '<a id="tabacct" href="/login" class="' + ((path === '/login' || path === '/registro' || path === '/cuenta') ? 'on' : '') + '">' + ic('user') + 'Cuenta</a>' +
    '<a href="/ajustes"' + on('/ajustes') + '>' + ic('settings') + 'Ajustes</a></nav>';

  var footer = '<footer class="foot"><div class="wrap">' +
    '<div class="brandrow">' + logo() + '<span class="wm">NEXORA</span></div>' +
    '<p class="d">Tu ecosistema gaming: recargas de juegos, productos digitales y herramientas de IA.</p>' +
    '<details><summary>Soporte</summary><p><a href="' + WA + '" target="_blank" rel="noopener">WhatsApp: +58 424 5095002</a></p><p><a href="mailto:prds33735435@gmail.com">prds33735435@gmail.com</a></p></details>' +
    '<details><summary>Métodos de pago</summary><p>Próximamente: pago móvil, transferencias y USDT, según disponibilidad.</p></details>' +
    '<h3 class="sig">Síguenos</h3>' +
    '<div class="social"><a href="' + WA + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ic('chat') + '</a><a href="mailto:prds33735435@gmail.com" aria-label="Correo">' + ic('mail') + '</a></div>' +
    '<p class="copy">© 2026 Nexora Ecosistem de AI. Todos los derechos reservados.</p>' +
    '<p class="small">NEXORA no es afiliada oficial de los juegos mostrados.</p></div></footer>';

  document.body.insertAdjacentHTML('afterbegin', sprite() + header);
  document.body.insertAdjacentHTML('beforeend', footer + tabs);
  window.NXI = { ic: ic, logo: logo, WA: WA };

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

  window.NX.ready.then(function (o) {
    if (!o.session) return;
    var u = o.session.user;
    var name = (u.user_metadata && u.user_metadata.username) || (u.email || '').split('@')[0] || 'usuario';
    ['navacct', 'tabacct'].forEach(function (id) { var a = document.getElementById(id); if (a) a.setAttribute('href', '/cuenta'); });
    var btn = document.getElementById('userbtn');
    btn.removeAttribute('href');
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Menú de cuenta');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('tabindex', '0');
    btn.textContent = name.charAt(0);
    var menu = document.createElement('div');
    menu.className = 'menu';
    menu.hidden = true;
    var p = document.createElement('p');
    p.textContent = 'Hola, ' + name;
    menu.appendChild(p);
    [['/cuenta', 'Mi cuenta'], ['/ajustes', 'Ajustes'], ['/ajustes#soporte', 'Soporte']].forEach(function (l) {
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
