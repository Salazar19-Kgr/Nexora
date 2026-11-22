(function () {
  var $ = function (s) { return document.querySelector(s); };
  function say(id, t, ok) { var m = $(id); m.textContent = t || ''; m.className = 'msg' + (ok ? ' ok' : ''); }
  function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); });
  }
  document.querySelectorAll('[data-eye]').forEach(function (b) {
    b.addEventListener('click', function () { var i = document.getElementById(b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; });
  });

  if (window.NXCaptcha) NXCaptcha.init('#cap');
  function needCap(id) { if (window.NXCaptcha && NXCaptcha.required() && !NXCaptcha.token()) { say(id, 'Completa la verificación de seguridad (no soy un robot).'); return true; } return false; }
  function enter(r) {
    return NX.ready.then(function (o) {
      if (!o.sb) throw new Error('sin cliente');
      return o.sb.auth.setSession({ access_token: r.d.access_token, refresh_token: r.d.refresh_token });
    }).then(function (s) { if (s.error) throw new Error('sesion'); location.href = '/admin'; });
  }

  fetch('/api/ceo/status').then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (r) {
    if (!r.ok) { $('#lead').textContent = (r.d && r.d.error) || 'Servicio no disponible.'; return; }
    if (r.d.registered) {
      $('#lead').textContent = 'Inicia sesión con tus dos credenciales.'; $('#fl').hidden = false;
    } else if (r.d.setup_enabled) {
      $('#lead').textContent = 'Primera vez: crea tu usuario y contraseña. Solo se puede hacer una vez y únicamente con la clave de instalación.'; $('#fr').hidden = false;
    } else {
      $('#lead').textContent = 'El acceso SSECEO aún no está habilitado. Falta crear el secreto CEO_SETUP_KEY en Cloudflare.';
    }
  }).catch(function () { $('#lead').textContent = 'Error de conexión. Intenta de nuevo.'; });

  $('#fl').addEventListener('submit', function (e) {
    e.preventDefault(); say('#ml', ''); var b = $('#bl');
    var u = $('#lu').value.trim(), p = $('#lp').value;
    if (!u || !p) return say('#ml', 'Completa usuario y contraseña.');
    if (needCap('#ml')) return;
    b.disabled = true;
    post('/api/ceo/login', { username: u, password: p, captcha: window.NXCaptcha ? NXCaptcha.token() : null }).then(function (r) {
      if (window.NXCaptcha) NXCaptcha.reset();
      if (!r.ok) { say('#ml', r.d.error || 'No se pudo iniciar sesión.'); b.disabled = false; return; }
      return enter(r);
    }).catch(function () { say('#ml', 'Error de conexión. Intenta de nuevo.'); b.disabled = false; });
  });

  $('#fr').addEventListener('submit', function (e) {
    e.preventDefault(); say('#mr', ''); var b = $('#br');
    var k = $('#rk').value, u = $('#ru').value.trim(), p = $('#rp').value;
    if (!k) return say('#mr', 'Escribe la clave de instalación.');
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(u)) return say('#mr', 'Usuario: 3 a 30 letras, números, punto, guion o guion bajo.');
    if (p.length < 8) return say('#mr', 'La contraseña debe tener al menos 8 caracteres.');
    b.disabled = true;
    post('/api/ceo/register', { setup_key: k, username: u, password: p }).then(function (r) {
      if (!r.ok) { say('#mr', r.d.error || 'No se pudo crear el acceso.'); b.disabled = false; return; }
      say('#mr', 'Acceso creado. Ahora inicia sesión.', true); setTimeout(function () { location.reload(); }, 1200);
    }).catch(function () { say('#mr', 'Error de conexión. Intenta de nuevo.'); b.disabled = false; });
  });
})();
