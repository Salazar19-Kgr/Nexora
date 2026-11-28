(function () {
  var $ = function (s) { return document.querySelector(s); };

  (function () { var sel = document.getElementById('country'); if (!sel || sel.options.length > 1) return; (window.NXCountries || []).forEach(function (c) { var o = document.createElement('option'); o.value = c[0]; o.textContent = c[1]; sel.append(o); }); })();
  var mode = document.body.dataset.mode;
  var msg = $('#msg'), go = $('#go');
  if (window.NXCaptcha) NXCaptcha.init('#cap');
  function needCap() { if (window.NXCaptcha && NXCaptcha.required() && !NXCaptcha.token()) { say('Completa la verificación de seguridad (no soy un robot).'); busy(false); return true; } return false; }

  var ICONS = {
    google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78z"/><path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#5865F2" d="M20 4.5A17 17 0 0 0 15.8 3.2l-.5 1a15.7 15.7 0 0 0-4.6 0l-.5-1A17 17 0 0 0 4 4.5C1.3 8.5.6 12.4.9 16.2a17 17 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12 12 0 0 0 12.2 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.4-.7-8.3-3.1-11.7zM8.5 14c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.85v-8.38H7.08V12h3.02V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.95h-1.51c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z"/></svg>'
  };
  var CEO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="none" stroke="#5cff7a" stroke-width="1.7" stroke-linejoin="round"/><path d="M7.6 14.2l1-4.4 2.2 2.2 1.2-3.2 1.2 3.2 2.2-2.2 1 4.4z" fill="#5cff7a"/></svg>';
  var NAMES = { google: 'Google', discord: 'Discord', facebook: 'Facebook' };

  function say(t, ok) { msg.textContent = t || ''; msg.className = 'msg' + (ok ? ' ok' : ''); }
  function busy(b) { go.disabled = b; }

  document.querySelectorAll('[data-eye]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = document.getElementById(b.dataset.eye);
      var show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  var box = $('#socials');
  ['google', 'discord', 'facebook'].forEach(function (p) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'soc'; b.innerHTML = ICONS[p];
    b.setAttribute('aria-label', 'Continuar con ' + NAMES[p]);
    b.addEventListener('click', function () {
      say('');
      window.NX.ready.then(function (o) {
        if (!o.sb) return say('El servicio de cuentas no está disponible todavía.');
        o.sb.auth.signInWithOAuth({ provider: p, options: { redirectTo: location.origin + '/' } }).then(function (r) {
          if (r.error) say('No se pudo iniciar con ' + NAMES[p] + '.');
        });
      });
    });
    box.append(b);
  });
  if (mode === 'login') {
    var c = document.createElement('a');
    c.href = '/ceo'; c.className = 'soc ceo'; c.innerHTML = CEO_ICON;
    c.setAttribute('aria-label', 'Iniciar sesión como SSECEO'); c.title = 'Iniciar sesión como SSECEO';
    box.classList.add('four'); box.append(c);
  }

  function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); });
  }

  $('#f').addEventListener('submit', function (e) {
    e.preventDefault(); say(''); busy(true);
    window.NX.ready.then(function (o) {
      if (!o.sb) { say('El servicio de cuentas no está disponible todavía.'); return busy(false); }
      return mode === 'login' ? login(o.sb) : signup(o.sb);
    }).catch(function () { say('Error de conexión. Intenta de nuevo.'); busy(false); });
  });

  function login(sb) {
    var ident = $('#ident').value.trim(), pw = $('#pw').value;
    if (!ident || !pw) { say('Completa usuario y contraseña.'); return busy(false); }
    if (needCap()) return;
    return post('/api/login', { identifier: ident, password: pw, captcha: window.NXCaptcha ? NXCaptcha.token() : null }).then(function (r) {
      if (window.NXCaptcha) NXCaptcha.reset();
      if (!r.ok) { say(r.d.error || 'No se pudo iniciar sesión.'); return busy(false); }
      return sb.auth.setSession({ access_token: r.d.access_token, refresh_token: r.d.refresh_token }).then(function (s) {
        if (s.error) { say('No se pudo iniciar sesión.'); return busy(false); }
        location.href = '/';
      });
    });
  }

  function signup(sb) {
    var user = $('#user').value.trim(), email = $('#email').value.trim(), pw = $('#pw').value, pw2 = $('#pw2').value, country = $('#country').value;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(user)) { say('Usuario: 3 a 20 letras, números o guion bajo.'); return busy(false); }
    if (!(window.NXCountries || []).some(function (c) { return c[0] === country; })) { say('Elige tu país. Es obligatorio.'); return busy(false); }
    if (!/^\S+@\S+\.\S+$/.test(email)) { say('Escribe un correo válido.'); return busy(false); }
    if (pw.length < 8) { say('La contraseña debe tener al menos 8 caracteres.'); return busy(false); }
    if (pw !== pw2) { say('Las contraseñas no coinciden.'); return busy(false); }
    if (needCap()) return;
    return fetch('/api/username?u=' + encodeURIComponent(user)).then(function (r) { return r.ok ? r.json() : null; }).then(function (a) {
      if (!a) { say('El servicio de cuentas no está disponible ahora. Intenta más tarde.'); return busy(false); }
      if (!a.available) { say('Ese nombre de usuario ya está en uso.'); return busy(false); }
      return sb.auth.signUp({ email: email, password: pw, options: { data: { username: user, country: country }, emailRedirectTo: location.origin + '/', captchaToken: window.NXCaptcha ? (NXCaptcha.token() || undefined) : undefined } }).then(function (r) {
        if (window.NXCaptcha) NXCaptcha.reset();
        if (r.error) { say(r.error.message && /registered|exists/i.test(r.error.message) ? 'Ese correo ya tiene una cuenta.' : 'No se pudo crear la cuenta.'); return busy(false); }
        if (r.data.session) { location.href = '/'; return; }
        say('Cuenta creada. Revisa tu correo para confirmarla.', true);
        busy(false);
      });
    });
  }

  var fg = $('#forgot');
  if (fg) fg.addEventListener('click', function () {
    var v = $('#ident').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(v)) return say('Escribe tu correo arriba y vuelve a tocar este enlace.');
    window.NX.ready.then(function (o) {
      if (!o.sb) return say('El servicio de cuentas no está disponible todavía.');
      if (needCap()) return;
      o.sb.auth.resetPasswordForEmail(v, { redirectTo: location.origin + '/', captchaToken: window.NXCaptcha ? (NXCaptcha.token() || undefined) : undefined }).then(function () {
        if (window.NXCaptcha) NXCaptcha.reset();
        say('Si el correo existe, te enviamos un enlace para restablecerla.', true);
      });
    });
  });
})();
