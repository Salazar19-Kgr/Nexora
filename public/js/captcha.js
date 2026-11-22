(function () {
  'use strict';
  var key = null, wid = null, tok = null, ready = null;
  function load() {
    return new Promise(function (res, rej) {
      if (window.turnstile) return res();
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('captcha')); };
      document.head.appendChild(s);
    });
  }
  window.NXCaptcha = {
    // Dibuja el "no soy robot" dentro del contenedor, solo si el sitio tiene la clave configurada.
    init: function (sel) {
      ready = fetch('/api/config').then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
        var el = document.querySelector(sel);
        if (!cfg || !cfg.turnstile || !el) return;
        key = cfg.turnstile;
        return load().then(function () {
          wid = window.turnstile.render(el, { sitekey: key, theme: 'dark', callback: function (t) { tok = t; }, 'expired-callback': function () { tok = null; }, 'error-callback': function () { tok = null; } });
        });
      }).catch(function () { key = key || null; });
      return ready;
    },
    required: function () { return !!key; },
    token: function () { return key ? tok : null; },
    reset: function () { tok = null; if (wid !== null && window.turnstile) try { window.turnstile.reset(wid); } catch (e) {} }
  };
})();
