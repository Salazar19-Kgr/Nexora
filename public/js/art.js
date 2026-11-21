// NEXORA · arte dibujado en código (SVG). Emblemas ORIGINALES por juego: no son los logos oficiales.
// Si un juego tiene "logo" (icon_url) en el panel admin, se usa esa imagen en su lugar.
(function () {
  var M = {
    flame: '<path d="M33 5c1 12 13 17 13 33 0 11-6 19-14 19s-14-8-14-17c0-7 4-11 8-16 0 6 3 8 5 7 4-6 1-16 2-26z"/>',
    crosshair: '<path d="M32 8a24 24 0 1 0 .01 0zm0 6a18 18 0 1 1-.01 0z" fill-rule="evenodd"/><path d="M30 2h4v16h-4zM30 46h4v16h-4zM2 30h16v4H2zM46 30h16v4H46z"/><circle cx="32" cy="32" r="4"/>',
    helmet: '<path d="M10 40c0-18 9-30 22-30s22 12 22 30v6H10z"/><path d="M10 46h44v4c0 3-2 5-5 5H15c-3 0-5-2-5-5z" opacity=".75"/><path d="M18 34h28v6H18z" fill="#000" opacity=".28"/>',
    swords: '<path d="M10 6l8 2 30 30-6 6L12 14zM54 6l-8 2-30 30 6 6L52 14z"/><path d="M14 40l10 10-4 4-6-2-2-6zM50 40L40 50l4 4 6-2 2-6z" opacity=".85"/><path d="M26 48l-6 10 4 2 6-8zM38 48l6 10-4 2-6-8z" opacity=".6"/>',
    crown: '<path d="M6 48L10 18l15 15 7-21 7 21 15-15 4 30z"/><path d="M8 52h48v6H8z" opacity=".8"/><circle cx="10" cy="15" r="3.5"/><circle cx="32" cy="9" r="3.5"/><circle cx="54" cy="15" r="3.5"/>',
    drop: '<path d="M6 28C6 14 18 6 32 6s26 8 26 22c-5-4-9-4-13 0-4-4-8-4-13 0-5-4-9-4-13 0-4-4-8-4-13 0z"/><path d="M8 30l22 20M56 30L34 50M32 32v18" stroke="#fff" stroke-width="2.4" fill="none"/><rect x="24" y="50" width="16" height="12" rx="2"/>',
    star: '<path d="M32 3l7 22 22 7-22 7-7 22-7-22-22-7 22-7z"/><circle cx="32" cy="32" r="5" fill="#000" opacity=".25"/>',
    pad: '<path d="M18 16h28c9 0 16 8 16 18v4c0 6-6 9-11 5l-6-6H19l-6 6c-5 4-11 1-11-5v-4c0-10 7-18 16-18z"/><path d="M20 24v10M15 29h10" stroke="#000" stroke-width="3.4" opacity=".4" fill="none"/><circle cx="43" cy="26" r="2.6" fill="#000" opacity=".4"/><circle cx="49" cy="32" r="2.6" fill="#000" opacity=".4"/>',
    bolt: '<path d="M36 3L12 36h16l-4 25 28-36H35z"/>',
    ball: '<circle cx="32" cy="32" r="26"/><path d="M6 32h52M32 6c10 8 10 44 0 52M32 6c-10 8-10 44 0 52" stroke="#000" stroke-width="2.6" fill="none" opacity=".35"/>',
    car: '<path d="M8 38l6-14c1-3 4-5 7-5h22c3 0 6 2 7 5l6 14c3 1 4 3 4 6v6H4v-6c0-3 1-5 4-6z"/><circle cx="18" cy="52" r="6" fill="#000" opacity=".4"/><circle cx="46" cy="52" r="6" fill="#000" opacity=".4"/>'
  };
  var KNOWN = [
    [/free.?fire/i, 'flame', 18], [/call.?of.?duty|\bcod\b/i, 'crosshair', 100], [/pubg|battlegrounds/i, 'helmet', 38],
    [/fortnite/i, 'drop', 268], [/mobile.?legends|\bmlbb\b/i, 'swords', 214], [/honou?r.?of.?kings|\bhok\b/i, 'crown', 44],
    [/genshin|honkai|star.?rail/i, 'star', 190], [/fifa|efootball|football|soccer/i, 'ball', 130], [/clash|brawl/i, 'bolt', 52],
    [/roblox/i, 'pad', 4], [/need.?for|asphalt|racing|car/i, 'car', 350]
  ];
  var BYCAT = [[/shoot|battle|fps|tirador/i, 'crosshair'], [/moba|estrateg/i, 'swords'], [/rpg|gacha|aventura/i, 'star'], [/deport|sport/i, 'ball'], [/carrer|racing/i, 'car']];

  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function pick(g) {
    var key = (g.slug || '') + ' ' + (g.name || '');
    for (var i = 0; i < KNOWN.length; i++) if (KNOWN[i][0].test(key)) return { m: KNOWN[i][1], h: KNOWN[i][2] };
    for (var j = 0; j < BYCAT.length; j++) if (BYCAT[j][0].test(g.category || '')) return { m: BYCAT[j][1], h: hash(g.slug || g.name || 'x') };
    return { m: 'pad', h: hash(g.slug || g.name || 'x') };
  }

  var NS = 'http://www.w3.org/2000/svg';
  function sprite() {
    var s = '<svg xmlns="' + NS + '" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d7e3dc"/></linearGradient>' +
      '<linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9ffd6"/><stop offset=".45" stop-color="#16D94A"/><stop offset="1" stop-color="#0a8f2e"/></linearGradient>' +
      '<linearGradient id="gem1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9fbff"/><stop offset=".5" stop-color="#3fd0ff"/><stop offset="1" stop-color="#1668e8"/></linearGradient>' +
      '<linearGradient id="gem2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#7be3ff" stop-opacity=".2"/></linearGradient></defs>';
    for (var k in M) s += '<symbol id="m-' + k + '" viewBox="0 0 64 64"><g fill="url(#mg)">' + M[k] + '</g></symbol>';
    s += '<symbol id="m-coin" viewBox="0 0 64 64"><circle cx="32" cy="35" r="26" fill="#06461c"/><circle cx="32" cy="30" r="26" fill="url(#cg)" stroke="#d9ffe4" stroke-width="1.6"/><circle cx="32" cy="30" r="19" fill="none" stroke="#06461c" stroke-width="2.4" opacity=".55"/><polygon points="22,42 22,18 28,18 37,31 37,18 42,18 42,42 36,42 27,29 27,42" fill="#eafff0" stroke="#06461c" stroke-width="1.2" stroke-linejoin="round"/></symbol>';
    s += '<symbol id="m-gem" viewBox="0 0 64 64"><polygon points="18,8 46,8 60,24 32,58 4,24" fill="url(#gem1)" stroke="#e9fbff" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<polygon points="18,8 26,24 4,24" fill="url(#gem2)"/><polygon points="46,8 38,24 60,24" fill="#1668e8" opacity=".45"/><polygon points="26,24 38,24 32,58" fill="#0b4fc7" opacity=".4"/><polygon points="18,8 46,8 38,24 26,24" fill="#fff" opacity=".35"/></symbol>';
    var I = {
      phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
      bank: '<path d="M3 10l9-6 9 6zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
      coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.3 1.3-2 3-2s3 .7 3 2-1.3 1.7-3 2-3 .8-3 2 1.3 2 3 2 3-.7 3-2"/>',
      cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v.01M18 15v.01"/>',
      copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
      upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
      check: '<path d="M4 12l5 5L20 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M6 16c.6-1.8 5.4-1.8 6 0M14 10h4M14 14h4"/>',
      back: '<path d="M19 12H5M11 6l-6 6 6 6"/>'
    };
    for (var n in I) s += '<symbol id="i-' + n + '" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + I[n] + '</g></symbol>';
    return s + '</svg>';
  }
  document.body.insertAdjacentHTML('afterbegin', sprite());

  function svgUse(id, cls) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', id.indexOf('m-') === 0 ? '0 0 64 64' : '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    var u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
  }

  // Cuadro con el emblema del juego (o su logo si el admin lo cargó). cls: clases extra del contenedor.
  function logo(g, cls) {
    var d = document.createElement('div');
    d.className = 'art gl' + (cls ? ' ' + cls : '');
    var p = pick(g);
    d.style.setProperty('--h', p.h);
    if (g.icon_url && /^(https:\/\/|\/img\/)/.test(g.icon_url)) {
      var im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.src = g.icon_url;
      im.addEventListener('error', function () { im.remove(); d.appendChild(svgUse('m-' + p.m, 'mo')); });
      d.appendChild(im);
    } else d.appendChild(svgUse('m-' + p.m, 'mo'));
    return d;
  }
  function coin(cls) { return svgUse('m-coin', cls || 'coin'); }
  function gem(cls) { return svgUse('m-gem', cls || 'gem'); }
  function icon(id, cls) { var s = svgUse('i-' + id, cls || 'ic'); return s; }
  var MI = { pago_movil: 'phone', transferencia: 'bank', zelle: 'bank', binance: 'coin', usdt: 'coin', efectivo: 'cash', otro: 'coin' };
  function methodIcon(kind) { return icon(MI[kind] || 'coin', 'ic'); }

  window.NXArt = { logo: logo, gem: gem, coin: coin, icon: icon, methodIcon: methodIcon, pick: pick, hue: function (g) { return pick(g).h; } };
})();
