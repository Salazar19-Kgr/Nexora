// Efectos navideños cargados solo cuando el tema es Navidad: nieve (un solo canvas) y regalos decorativos.
(function () {
  if (document.getElementById('nxsnow')) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  ['l', 'r'].forEach(function (s) {
    var g = document.createElement('img'); g.className = 'xgift ' + s; g.src = '/img/regalos.webp'; g.alt = ''; g.setAttribute('aria-hidden', 'true'); g.loading = 'lazy'; document.body.appendChild(g);
  });
  if (reduce) return;
  var c = document.createElement('canvas'); c.id = 'nxsnow'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c);
  var x = c.getContext('2d'), w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5), flakes = [], raf = 0, last = 0;
  var weak = (navigator.hardwareConcurrency || 4) <= 4 || window.innerWidth < 520;
  var N = weak ? 26 : 56;
  function size() { w = window.innerWidth; h = window.innerHeight; c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function mk(top) { return { x: Math.random() * w, y: top ? -10 : Math.random() * h, r: 1 + Math.random() * 2.6, v: 18 + Math.random() * 34, a: Math.random() * 6.28, s: 0.4 + Math.random() * 0.9, o: 0.45 + Math.random() * 0.5 }; }
  function init() { size(); flakes = []; for (var i = 0; i < N; i++) flakes.push(mk(false)); }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return; var dt = Math.min((t - last) / 1000, 0.1); last = t;
    x.clearRect(0, 0, w, h);
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i]; f.y += f.v * dt; f.a += f.s * dt; f.x += Math.sin(f.a) * 14 * dt;
      if (f.y > h + 6) flakes[i] = mk(true);
      x.globalAlpha = f.o; x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.2832); x.fillStyle = '#fff'; x.fill();
    }
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  init(); start();
  window.addEventListener('resize', function () { size(); });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
})();
