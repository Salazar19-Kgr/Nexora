(function () {
  'use strict';
  var view = document.getElementById('aview'), nav = document.getElementById('anav'), toastEl = document.getElementById('toast');
  var sb = null, me = null, myId = null;

  var ES = {
    role: { owner: 'Propietario', admin: 'Administrador', operator: 'Operador', finance: 'Finanzas', support: 'Soporte', customer: 'Cliente' },
    status: {
      pending: ['Pendiente de pago', 'wait'], awaiting_review: ['En revisión', 'wait'], paid: ['Pagado', 'ok'], delivering: ['Entregando', 'ok'],
      completed: ['Completado', 'ok'], rejected: ['Rechazado', 'bad'], refunded: ['Reembolsado', 'bad'], disputed: ['En disputa', 'bad']
    },
    pub: { draft: ['Borrador', 'wait'], active: ['Activo', 'ok'], paused: ['Pausado', 'bad'] },
    delivery: { manual: 'Manual', code: 'Códigos', api: 'API del proveedor' },
    method: { pago_movil: 'Pago móvil', transferencia: 'Transferencia', zelle: 'Zelle', binance: 'Binance Pay', usdt: 'USDT', efectivo: 'Efectivo', otro: 'Otro' },
    prize: { none: 'Sin premio', balance: 'Saldo', points: 'Puntos', spins: 'Giros' }
  };
  var NEXT = {
    pending: ['awaiting_review', 'rejected'], awaiting_review: ['rejected'], paid: ['delivering', 'completed', 'refunded', 'disputed'],
    delivering: ['completed', 'refunded', 'disputed'], completed: ['refunded', 'disputed'], disputed: ['completed', 'refunded'], rejected: [], refunded: []
  };
  var TOLABEL = { awaiting_review: 'En revisión', rejected: 'Rechazar', delivering: 'Marcar entregando', completed: 'Completar', refunded: 'Reembolsar', disputed: 'Marcar disputa' };

  function has(p) { return me && me.perms.indexOf(p) >= 0; }
  function usd(n) { return '$' + Number(n || 0).toFixed(2); }
  function when(s) { return s ? new Date(s).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function short(id) { return String(id).slice(0, 8); }

  function h(tag, props) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'value') e.value = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    Array.prototype.slice.call(arguments, 2).forEach(function add(c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return e;
  }
  function icon(n) { var s = document.createElement('span'); s.innerHTML = window.NXI.ic(n); return s.firstChild; }

  var tt;
  function toast(msg, isBad) {
    toastEl.textContent = msg; toastEl.hidden = false; toastEl.className = 'toast' + (isBad ? ' bad' : '');
    clearTimeout(tt); tt = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  // ---------- API (el servidor valida el rol en cada llamada) ----------
  function api(path, opts) {
    opts = opts || {};
    return sb.auth.getSession().then(function (r) {
      var t = r.data.session ? r.data.session.access_token : null;
      if (!t) { location.replace('/login'); throw new Error('Sesión vencida'); }
      var init = { method: 'GET', headers: { authorization: 'Bearer ' + t } };
      if (opts.body !== undefined) { init.method = 'POST'; init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
      return fetch('/api/admin/' + path, init);
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) { var e = new Error((d && d.error) || 'Error de conexión'); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  // ---------- Formularios en ventana ----------
  function genCode() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(8));
    var s = Array.prototype.map.call(b, function (x) { return a[x % a.length]; }).join('');
    return 'NX-' + s.slice(0, 4) + '-' + s.slice(4);
  }
  function localInput(iso) { var d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

  function openDialog(build) {
    var dlg = h('dialog', { class: 'adlg' });
    build(dlg, function close() { dlg.close(); });
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.append(dlg); dlg.showModal();
    return dlg;
  }

  function form(title, fields, values, onSubmit, submitLabel) {
    values = values || {};
    openDialog(function (dlg, close) {
      var msg = h('p', { class: 'msg', role: 'status' });
      var inputs = {};
      var f = h('form', { novalidate: true });
      f.append(h('h2', { text: title }));
      fields.forEach(function (fd) {
        var val = values[fd.k] != null ? values[fd.k] : (fd.def != null ? fd.def : '');
        var inp;
        if (fd.type === 'select') {
          inp = h('select', null, fd.opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
          inp.value = String(val);
        } else if (fd.type === 'checkbox') {
          inp = h('input', { type: 'checkbox' }); inp.checked = !!val;
        } else if (fd.type === 'datetime-local') {
          inp = h('input', { type: 'datetime-local' }); inp.value = val ? localInput(val) : '';
        } else {
          inp = h('input', { type: fd.type || 'text', maxlength: fd.max, step: fd.step, autocomplete: 'off', autocapitalize: fd.upper ? 'characters' : 'none', list: fd.datalist ? 'dl-' + fd.k : null });
          inp.value = val;
        }
        if (fd.disabled) inp.disabled = true;
        inputs[fd.k] = { el: inp, fd: fd };
        var lab = fd.type === 'checkbox' ? h('label', { class: 'chk' }, inp, fd.label) : h('label', null, fd.label, inp);
        if (fd.datalist) lab.append(h('datalist', { id: 'dl-' + fd.k }, fd.datalist.map(function (x) { return h('option', { value: x }); })));
        if (fd.gen && !fd.disabled) lab.append(h('button', { type: 'button', class: 'btn ghost sm', text: 'Generar código', onclick: function () { inp.value = genCode(); } }));
        if (fd.hint) lab.append(h('small', { class: 'muted', text: fd.hint }));
        f.append(lab);
      });
      var go = h('button', { type: 'submit', class: 'btn', text: submitLabel || 'Guardar' });
      f.append(msg, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost', text: 'Cancelar', onclick: close }), go));
      f.addEventListener('submit', function (e) {
        e.preventDefault(); msg.textContent = ''; go.disabled = true;
        var data = {};
        Object.keys(inputs).forEach(function (k) {
          var it = inputs[k], el = it.el;
          if (el.disabled) return;
          if (it.fd.type === 'checkbox') data[k] = el.checked;
          else if (it.fd.type === 'datetime-local') data[k] = el.value ? new Date(el.value).toISOString() : null;
          else data[k] = el.value;
        });
        onSubmit(data).then(close).catch(function (err) { msg.textContent = err.message; go.disabled = false; });
      });
      dlg.append(f);
    });
  }

  // ---------- Piezas de pantalla ----------
  function head(title, desc, action) {
    return h('div', { class: 'ahead' }, h('div', null, h('h1', { text: title }), desc ? h('p', { class: 'muted', text: desc }) : null), action || null);
  }
  function chips(list) {
    var c = list.filter(Boolean);
    return c.length ? h('div', { class: 'chips' }, c.map(function (t) { return h('span', { class: 'chip', text: t }); })) : null;
  }
  function badge(b) { return b ? h('span', { class: 'st ' + b[1], text: b[0] }) : null; }
  function show(title, desc, action, body) { view.replaceChildren(head(title, desc, action), body); }
  function fail(e) {
    if (e && e.status === 403) { view.replaceChildren(h('div', { class: 'empty', text: 'Tu rol no tiene acceso a esta sección.' })); return; }
    view.replaceChildren(h('div', { class: 'empty', text: (e && e.message) || 'No se pudo cargar.' }));
  }

  // ---------- Gestor genérico (juegos, precios, cupones, códigos, ruleta) ----------
  function manager(cfg) {
    view.replaceChildren(h('p', { class: 'muted', text: 'Cargando…' }));
    return Promise.all([api(cfg.name), cfg.extra ? cfg.extra() : null]).then(function (res) {
      var rows = res[0], extra = res[1], state = {};
      var list = h('div', { class: 'alist' });
      function edit(row) {
        var vals = row ? (cfg.values ? cfg.values(row) : row) : (cfg.newValues ? cfg.newValues(state) : null);
        form(row ? cfg.editTitle : cfg.newTitle, cfg.fields(row, extra), vals, function (data) {
          return (row ? api(cfg.name + '/' + row.id, { body: data }) : api(cfg.name, { body: data })).then(function () { toast('Guardado'); return manager(cfg); });
        });
      }
      function draw() {
        list.replaceChildren();
        var shown = cfg.filter ? rows.filter(function (r) { return cfg.filter(r, state); }) : rows;
        if (!shown.length) list.append(h('div', { class: 'empty', text: cfg.empty }));
        shown.forEach(function (r) {
          var it = cfg.item(r, extra, rows);
          list.append(h('div', { class: 'arow' },
            h('div', { class: 'ainfo' }, h('b', { text: it.title }), h('small', { text: it.sub }), chips(it.chips || [])),
            h('div', { class: 'aact' }, badge(it.badge), cfg.canWrite ? h('button', { class: 'btn ghost sm', text: 'Editar', onclick: function () { edit(r); } }) : null)));
        });
      }
      var body = h('div', null, cfg.note ? h('p', { class: 'note', text: cfg.note }) : null, cfg.toolbar ? cfg.toolbar(extra, state, draw) : null, list);
      draw();
      show(cfg.title, cfg.desc, cfg.canWrite ? h('button', { class: 'btn sm', text: '+ Nuevo', onclick: function () { edit(null); } }) : null, body);
    }).catch(fail);
  }

  function gameOpts(games, allLabel) {
    var o = allLabel ? [['', allLabel]] : [];
    return o.concat(games.map(function (g) { return [g.id, g.name]; }));
  }
  var PUB_OPTS = [['draft', 'Borrador (no se ve)'], ['active', 'Activo (visible)'], ['paused', 'Pausado']];

  var CFG = {
    games: {
      name: 'games', title: 'Juegos', desc: 'Los juegos que se muestran en la tienda.', canWrite: false, newTitle: 'Agregar juego', editTitle: 'Editar juego', empty: 'Aún no hay juegos.',
      values: function (r) { return Object.assign({}, r, { required_fields: (r.required_fields || []).join(',') }); },
      item: function (r) {
        return { title: r.name, sub: r.category + ' · /' + r.slug, chips: ['Orden ' + r.sort_order, 'Datos: ' + (r.required_fields || []).join(' + ')], badge: ES.pub[r.status] };
      },
      fields: function (row) {
        return [
          { k: 'name', label: 'Nombre', max: 80 },
          { k: 'slug', label: 'Slug (dirección)', max: 40, disabled: !!row, hint: 'Minúsculas y guiones. Ej: free-fire. No se puede cambiar después.' },
          { k: 'category', label: 'Categoría', max: 60, datalist: ['Shooter / Battle Royale', 'MOBA / Estrategia', 'RPG / Gacha', 'Sandbox / Social'] },
          { k: 'description', label: 'Descripción (opcional)', max: 300 },
          { k: 'required_fields', label: 'Datos que pide al comprar', type: 'select', opts: [['player_id', 'Solo ID de jugador'], ['player_id,server', 'ID de jugador + servidor']], def: 'player_id' },
          { k: 'status', label: 'Estado', type: 'select', opts: PUB_OPTS, def: 'draft' },
          { k: 'sort_order', label: 'Orden en la tienda', type: 'number', def: 100, hint: 'Número menor aparece primero.' }
        ];
      }
    },
    products: {
      name: 'products', title: 'Precios y paquetes', desc: 'Diamantes, pases y recargas con su precio.', newTitle: 'Agregar paquete', editTitle: 'Editar paquete', empty: 'Aún no hay paquetes. Agrega el primero con “+ Nuevo”.',
      extra: function () { return api('games'); },
      toolbar: function (games, state, redraw) {
        var s = h('select', { 'aria-label': 'Filtrar por juego', onchange: function () { state.game = s.value; redraw(); } },
          gameOpts(games, 'Todos los juegos').map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
        return h('div', { class: 'tools' }, s);
      },
      filter: function (r, state) { return !state.game || r.game_id === state.game; },
      newValues: function (state) { return state.game ? { game_id: state.game } : null; },
      item: function (r) {
        var margin = r.cost != null && r.cost_currency === 'USD' && Number(r.cost) > 0 ? 'Margen ' + usd(r.price_usd - r.cost) : null;
        return {
          title: r.name, sub: (r.games ? r.games.name : 'Juego') + ' · ' + r.sku,
          chips: ['Precio ' + usd(r.price_usd), r.cost != null ? 'Costo ' + Number(r.cost) + ' ' + r.cost_currency : null, margin, ES.delivery[r.delivery_type] || r.delivery_type],
          badge: ES.pub[r.status]
        };
      },
      fields: function (row, games) {
        return [
          { k: 'game_id', label: 'Juego', type: 'select', opts: gameOpts(games) },
          { k: 'name', label: 'Nombre del paquete', max: 80, hint: 'Ej: 100 Diamantes' },
          { k: 'price_usd', label: 'Precio de venta (USD)', type: 'number', step: '0.01' },
          { k: 'cost', label: 'Costo (lo que te cuesta)', type: 'number', step: '0.01', def: 0 },
          { k: 'cost_currency', label: 'Moneda del costo', type: 'select', opts: [['USD', 'USD'], ['VES', 'Bs (VES)'], ['USDT', 'USDT']], def: 'USD' },
          { k: 'delivery_type', label: 'Entrega', type: 'select', opts: [['manual', 'Manual (tú la haces)'], ['code', 'Códigos'], ['api', 'API del proveedor']], def: 'manual' },
          { k: 'status', label: 'Estado', type: 'select', opts: PUB_OPTS, def: 'draft', hint: 'Actívalo cuando tengas con qué entregarlo.' },
          { k: 'sku', label: 'SKU', max: 60, upper: true, disabled: !!row, hint: row ? '' : 'Déjalo vacío y se genera solo.' },
          { k: 'external_sku', label: 'SKU del proveedor (opcional)', max: 80 }
        ];
      }
    },
    coupons: {
      name: 'coupons', title: 'Cupones de descuento', desc: 'Códigos que bajan el precio al comprar.', newTitle: 'Crear cupón', editTitle: 'Editar cupón', empty: 'Aún no hay cupones.',
      extra: function () { return api('games'); },
      item: function (r) {
        var expired = r.expires_at && new Date(r.expires_at) < new Date();
        var out = r.max_uses && r.used_count >= r.max_uses;
        return {
          title: r.code,
          sub: (r.kind === 'percent' ? '−' + Number(r.value) + '%' : '−' + usd(r.value)) + (r.games ? ' · solo ' + r.games.name : ' · todos los juegos'),
          chips: ['Usos ' + r.used_count + '/' + (r.max_uses || '∞'), Number(r.min_amount_usd) > 0 ? 'Mínimo ' + usd(r.min_amount_usd) : null, r.expires_at ? 'Vence ' + when(r.expires_at) : 'Sin vencimiento'],
          badge: expired ? ['Vencido', 'bad'] : out ? ['Agotado', 'bad'] : r.active ? ['Activo', 'ok'] : ['Pausado', 'wait']
        };
      },
      fields: function (row, games) {
        return [
          { k: 'code', label: 'Código', max: 32, upper: true, disabled: !!row, gen: true, hint: 'Letras, números y guiones.' },
          { k: 'kind', label: 'Tipo de descuento', type: 'select', opts: [['percent', 'Porcentaje (%)'], ['fixed', 'Monto fijo (USD)']], def: 'percent' },
          { k: 'value', label: 'Valor', type: 'number', step: '0.01', hint: 'Ej: 10 = 10% o $10 según el tipo.' },
          { k: 'min_amount_usd', label: 'Compra mínima (USD)', type: 'number', step: '0.01', def: 0 },
          { k: 'max_uses', label: 'Usos máximos (vacío = sin límite)', type: 'number' },
          { k: 'game_id', label: 'Válido para', type: 'select', opts: gameOpts(games, 'Todos los juegos'), def: '' },
          { k: 'expires_at', label: 'Vence (opcional)', type: 'datetime-local' },
          { k: 'active', label: 'Activo', type: 'checkbox', def: true }
        ];
      }
    },
    codes: {
      name: 'codes', title: 'Códigos de canje', desc: 'Regalan saldo, puntos o giros. Cada persona canjea cada código una vez.', newTitle: 'Crear código de canje', editTitle: 'Editar código', empty: 'Aún no hay códigos de canje.',
      item: function (r) {
        var expired = r.expires_at && new Date(r.expires_at) < new Date();
        var out = r.max_uses && r.used_count >= r.max_uses;
        var prize = r.reward_type === 'balance' ? '+' + usd(r.reward_value) + ' de saldo' : r.reward_type === 'points' ? '+' + Number(r.reward_value) + ' puntos' : '+' + Number(r.reward_value) + ' giros de ruleta';
        return {
          title: r.code, sub: prize,
          chips: ['Usos ' + r.used_count + '/' + (r.max_uses || '∞'), r.expires_at ? 'Vence ' + when(r.expires_at) : 'Sin vencimiento'],
          badge: expired ? ['Vencido', 'bad'] : out ? ['Agotado', 'bad'] : r.active ? ['Activo', 'ok'] : ['Pausado', 'wait']
        };
      },
      fields: function (row) {
        return [
          { k: 'code', label: 'Código', max: 32, upper: true, disabled: !!row, gen: true },
          { k: 'reward_type', label: 'Qué regala', type: 'select', opts: [['balance', 'Saldo en USD'], ['points', 'Puntos'], ['spins', 'Giros de ruleta']], def: 'balance' },
          { k: 'reward_value', label: 'Cantidad', type: 'number', step: '0.01', hint: 'Puntos y giros deben ser números enteros.' },
          { k: 'max_uses', label: 'Usos máximos (vacío = sin límite)', type: 'number' },
          { k: 'expires_at', label: 'Vence (opcional)', type: 'datetime-local' },
          { k: 'active', label: 'Activo', type: 'checkbox', def: true }
        ];
      }
    },
    prizes: {
      name: 'prizes', title: 'Ruleta', desc: 'Premios de la ruleta que ven los usuarios en su cuenta.', newTitle: 'Agregar premio', editTitle: 'Editar premio', empty: 'La ruleta aún no tiene premios.',
      note: 'Los usuarios consiguen giros con códigos de canje (premio “Giros”) o con un ajuste manual en Usuarios. La probabilidad de cada premio es su peso dividido entre la suma de pesos activos.',
      item: function (r, extra, rows) {
        var total = rows.reduce(function (s, x) { return s + (x.active ? x.weight : 0); }, 0);
        var pct = r.active && total ? Math.round(r.weight * 1000 / total) / 10 : 0;
        var what = r.prize_type === 'none' ? 'Sin premio' : r.prize_type === 'balance' ? '+' + usd(r.value) + ' de saldo' : r.prize_type === 'points' ? '+' + Number(r.value) + ' puntos' : '+' + Number(r.value) + ' giros';
        return { title: r.label, sub: what, chips: ['Peso ' + r.weight, 'Probabilidad ' + pct + '%'], badge: r.active ? ['Activo', 'ok'] : ['Pausado', 'wait'] };
      },
      fields: function () {
        return [
          { k: 'label', label: 'Nombre del premio', max: 40, hint: 'Ej: $1 de saldo, 50 puntos, Otra vez' },
          { k: 'prize_type', label: 'Tipo', type: 'select', opts: [['none', 'Sin premio'], ['balance', 'Saldo en USD'], ['points', 'Puntos'], ['spins', 'Giros extra']], def: 'points' },
          { k: 'value', label: 'Cantidad', type: 'number', step: '0.01', def: 0 },
          { k: 'weight', label: 'Peso (probabilidad)', type: 'number', hint: 'Más alto = más probable. Ej: 70 común, 5 raro.' },
          { k: 'active', label: 'Activo', type: 'checkbox', def: true }
        ];
      }
    }
  };

  // ---------- Resumen ----------
  function viewStats() {
    view.replaceChildren(h('p', { class: 'muted', text: 'Cargando…' }));
    return api('stats').then(function (s) {
      var k = [
        ['Usuarios', s.users], ['Por atender', s.orders_pending], ['Pagados por entregar', s.orders_paid], ['Completados', s.orders_completed],
        ['Ingresos 30 días', usd(s.revenue_30d_usd)], ['Ingresos totales', usd(s.revenue_usd)], ['Juegos activos', s.games_active], ['Paquetes activos', s.products_active],
        ['Tasa USD → Bs', s.rate ? Number(s.rate.rate).toLocaleString('es-VE', { maximumFractionDigits: 2 }) : 'Sin tasa']
      ];
      var body = h('div', null,
        h('div', { class: 'kpis' }, k.map(function (x) { return h('div', { class: 'kpi' }, h('b', { text: String(x[1]) }), h('span', { text: x[0] })); })),
        h('p', { class: 'muted small', text: 'Ingresos = pedidos pagados, en entrega o completados.' }));
      if (!s.products_active) body.append(h('p', { class: 'note', text: 'Todavía no hay paquetes activos, así que la tienda no muestra nada que comprar. Ve a “Precios” y activa tus paquetes.' }));
      if (has('rates.write')) {
        var inp = h('input', { type: 'number', step: '0.01', min: '0', placeholder: 'Bs por 1 USD', 'aria-label': 'Tasa USD a Bs' });
        var msg = h('p', { class: 'msg', role: 'status' });
        body.append(h('div', { class: 'card' }, h('h2', { text: 'Tasa del día' }),
          h('p', { text: 'Cada pedido guarda la tasa que había al crearse. Actualízala cuando cambie.' }), inp, msg,
          h('button', { class: 'btn sm', text: 'Guardar tasa', onclick: function () {
            msg.textContent = '';
            api('rate', { body: { rate: inp.value } }).then(function () { toast('Tasa guardada'); viewStats(); }).catch(function (e) { msg.textContent = e.message; });
          } })));
      }
      show('Resumen', 'Cómo va NEXORA.', null, body);
    }).catch(fail);
  }

  // ---------- Pedidos ----------
  function viewOrders() {
    view.replaceChildren(h('p', { class: 'muted', text: 'Cargando…' }));
    var state = { status: '' };
    var list = h('div', { class: 'alist' });
    var fil = h('div', { class: 'fchips', role: 'group', 'aria-label': 'Filtrar por estado' });
    function load() {
      list.replaceChildren(h('p', { class: 'muted', text: 'Cargando…' }));
      Array.prototype.forEach.call(fil.children, function (b) { b.classList.toggle('on', b.dataset.s === state.status); });
      api('orders' + (state.status ? '?status=' + state.status : '')).then(function (rows) {
        list.replaceChildren();
        if (!rows.length) list.append(h('div', { class: 'empty', text: 'No hay pedidos en esta vista.' }));
        rows.forEach(function (o) { list.append(orderCard(o, load)); });
      }).catch(fail);
    }
    [['', 'Todos']].concat(Object.keys(ES.status).map(function (k) { return [k, ES.status[k][0]]; })).forEach(function (o) {
      fil.append(h('button', { type: 'button', 'data-s': o[0], text: o[1], onclick: function () { state.status = o[0]; load(); } }));
    });
    show('Pedidos', 'Confirma pagos, entrega y atiende cada pedido.', null, h('div', null, fil, list));
    load();
  }

  function orderCard(o, reload) {
    var p = o.products || {}, g = p.games || {}, pd = o.player_details || {};
    var st = ES.status[o.status] || [o.status, 'wait'];
    var lines = [
      h('small', { text: 'Jugador: ' + (pd.player_id || '—') + (pd.server ? ' · Servidor ' + pd.server : '') }),
      h('small', { text: 'Total ' + usd(o.amount_usd) + (Number(o.discount_usd) > 0 ? ' (cupón −' + usd(o.discount_usd) + ')' : '') + (o.rate_applied ? ' · ≈ Bs ' + (o.amount_usd * o.rate_applied).toLocaleString('es-VE', { maximumFractionDigits: 2 }) : '') })
    ];
    (o.payments || []).forEach(function (pm) {
      lines.push(h('small', { class: 'pay', text: 'Pago: ' + (ES.method[pm.method] || pm.method) + ' · ref ' + pm.reference + ' · ' + Number(pm.amount) + ' ' + pm.currency }));
    });
    var acts = h('div', { class: 'aact wrap2' });
    if ((o.status === 'pending' || o.status === 'awaiting_review') && has('payments.write')) {
      acts.append(h('button', { class: 'btn sm', text: 'Confirmar pago', onclick: function () { confirmPay(o, reload); } }));
    }
    if (has('orders.write')) {
      (NEXT[o.status] || []).forEach(function (to) {
        if (to === 'refunded' && !has('payments.write')) return;
        acts.append(h('button', { class: 'btn ghost sm', text: TOLABEL[to], onclick: function () {
          if ((to === 'rejected' || to === 'refunded' || to === 'disputed') && !confirm('¿' + TOLABEL[to] + ' el pedido #' + short(o.id) + '?')) return;
          api('orders/' + o.id + '/status', { body: { status: to } }).then(function () { toast('Pedido actualizado'); reload(); }).catch(function (e) { toast(e.message, true); });
        } }));
      });
    }
    return h('div', { class: 'arow col' },
      h('div', { class: 'otop' }, h('div', { class: 'ainfo' },
        h('b', { text: '#' + short(o.id) + ' · ' + (g.name || 'Juego') + ' · ' + (p.name || 'Paquete') }),
        h('small', { text: (o.username || 'Usuario') + ' · ' + when(o.created_at) })), badge(st)),
      h('div', { class: 'olines' }, lines), acts);
  }

  function confirmPay(o, reload) {
    var hint = 'Pedido: ' + usd(o.amount_usd) + (o.rate_applied ? ' ≈ Bs ' + (o.amount_usd * o.rate_applied).toLocaleString('es-VE', { maximumFractionDigits: 2 }) : '');
    form('Confirmar pago · #' + short(o.id), [
      { k: 'method', label: 'Método de pago', type: 'select', opts: Object.keys(ES.method).map(function (k) { return [k, ES.method[k]]; }), def: 'pago_movil' },
      { k: 'reference', label: 'Referencia del pago', max: 64, upper: true, hint: 'Una misma referencia no puede pagar dos pedidos.' },
      { k: 'amount', label: 'Monto recibido', type: 'number', step: '0.01', def: Number(o.amount_usd), hint: hint },
      { k: 'currency', label: 'Moneda recibida', type: 'select', opts: [['USD', 'USD'], ['VES', 'Bs (VES)'], ['USDT', 'USDT']], def: 'USD' }
    ], null, function (data) {
      return api('orders/' + o.id + '/payment', { body: data }).then(function () { toast('Pago confirmado'); reload(); });
    }, 'Confirmar pago');
  }

  // ---------- Usuarios ----------
  function viewUsers() {
    view.replaceChildren(h('p', { class: 'muted', text: 'Cargando…' }));
    var list = h('div', { class: 'alist' }), timer;
    var q = h('input', { type: 'search', placeholder: 'Buscar por usuario o correo…', 'aria-label': 'Buscar usuario', autocomplete: 'off' });
    function load() {
      api('users' + (q.value.trim() ? '?q=' + encodeURIComponent(q.value.trim()) : '')).then(function (rows) {
        list.replaceChildren();
        if (!rows.length) list.append(h('div', { class: 'empty', text: 'No se encontraron usuarios.' }));
        rows.forEach(function (u) {
          list.append(h('div', { class: 'arow' },
            h('div', { class: 'ainfo' },
              h('b', { text: (u.username || u.display_name || '(sin nombre)') + ' · ' + (ES.role[u.role] || u.role) }),
              h('small', { text: (u.email || 'sin correo') + ' · alta ' + when(u.created_at) }),
              chips(['Saldo ' + usd(u.balance_usd), u.points + ' puntos', u.spins + ' giros'])),
            h('div', { class: 'aact' }, u.banned ? badge(['Suspendido', 'bad']) : null,
              h('button', { class: 'btn ghost sm', text: 'Gestionar', onclick: function () { manageUser(u, load); } }))));
        });
      }).catch(fail);
    }
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(load, 300); });
    show('Usuarios', 'Cuentas registradas (las 200 más recientes).', null, h('div', null, h('div', { class: 'tools' }, q), list));
    load();
  }

  function manageUser(u, refresh) {
    openDialog(function (dlg, close) {
      var msg = h('p', { class: 'msg', role: 'status' });
      var info = h('p', { class: 'muted' });
      function setInfo() { info.textContent = 'Saldo ' + usd(u.balance_usd) + ' · ' + u.points + ' puntos · ' + u.spins + ' giros · ' + (u.banned ? 'SUSPENDIDO' : 'Activa'); }
      setInfo();
      function run(body, ok) {
        msg.textContent = '';
        return api('users/' + u.id, { body: body }).then(function (r) { ok(r); setInfo(); toast('Listo'); refresh(); }).catch(function (e) { msg.textContent = e.message; });
      }
      dlg.append(h('h2', { text: u.username || u.display_name || 'Usuario' }), h('p', { class: 'muted', text: u.email || '' }), info);
      if (has('users.grant')) {
        var kind = h('select', null, [['balance', 'Saldo (USD)'], ['points', 'Puntos'], ['spins', 'Giros de ruleta']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
        var amt = h('input', { type: 'number', step: '0.01', placeholder: 'Ej: 5 (negativo para restar)' });
        dlg.append(h('label', null, 'Ajustar', kind), h('label', null, 'Cantidad', amt),
          h('button', { type: 'button', class: 'btn sm', text: 'Aplicar ajuste', onclick: function () {
            run({ action: 'adjust', kind: kind.value, amount: Number(amt.value) }, function (r) { u.balance_usd = r.balance_usd; u.points = r.points; u.spins = r.spins; amt.value = ''; });
          } }));
        if (u.role !== 'owner' && u.id !== myId) {
          var ban = h('button', { type: 'button', class: 'btn ghost sm', text: u.banned ? 'Reactivar cuenta' : 'Suspender cuenta' });
          ban.addEventListener('click', function () {
            if (!u.banned && !confirm('¿Suspender a ' + (u.username || 'este usuario') + '? No podrá comprar ni iniciar sesión.')) return;
            run({ action: 'ban', banned: !u.banned }, function (r) { u.banned = r.banned; ban.textContent = u.banned ? 'Reactivar cuenta' : 'Suspender cuenta'; });
          });
          dlg.append(h('div', { class: 'row left' }, ban));
        }
      }
      if (me.role === 'owner' && u.id !== myId) {
        var role = h('select', null, Object.keys(ES.role).map(function (k) { return h('option', { value: k, text: ES.role[k] }); }));
        role.value = u.role;
        dlg.append(h('label', null, 'Rol', role),
          h('button', { type: 'button', class: 'btn ghost sm', text: 'Guardar rol', onclick: function () {
            run({ action: 'role', role: role.value }, function (r) { u.role = r.role; });
          } }));
      }
      dlg.append(msg, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost', text: 'Cerrar', onclick: close })));
    });
  }

  // ---------- Auditoría ----------
  function viewAudit() {
    view.replaceChildren(h('p', { class: 'muted', text: 'Cargando…' }));
    return api('audit').then(function (rows) {
      var list = h('div', { class: 'alist' });
      if (!rows.length) list.append(h('div', { class: 'empty', text: 'Todavía no hay movimientos registrados.' }));
      rows.forEach(function (x) {
        list.append(h('div', { class: 'arow col' },
          h('div', { class: 'ainfo' }, h('b', { text: x.action }), h('small', { text: (x.actor_name || 'sistema') + ' · ' + x.object_type + (x.object_id ? ' #' + short(x.object_id) : '') + ' · ' + when(x.created_at) })),
          h('details', null, h('summary', { text: 'Ver cambios' }),
            h('pre', { class: 'diff', text: 'Antes: ' + JSON.stringify(x.before) + '\nDespués: ' + JSON.stringify(x.after) }))));
      });
      show('Auditoría', 'Quién cambió qué y cuándo (últimos 150 movimientos).', null, list);
    }).catch(fail);
  }

  // ---------- Navegación ----------
  var SECTIONS = [
    { id: 'resumen', label: 'Resumen', icon: 'panel', perm: 'stats', go: viewStats },
    { id: 'pedidos', label: 'Pedidos', icon: 'list', perm: 'orders.read', go: viewOrders },
    { id: 'usuarios', label: 'Usuarios', icon: 'user', perm: 'users.read', go: viewUsers },
    { id: 'juegos', label: 'Juegos', icon: 'gamepad', perm: 'catalog.read', go: function () { CFG.games.canWrite = has('catalog.write'); return manager(CFG.games); } },
    { id: 'precios', label: 'Precios', icon: 'wallet', perm: 'catalog.read', go: function () { CFG.products.canWrite = has('catalog.write'); return manager(CFG.products); } },
    { id: 'cupones', label: 'Cupones', icon: 'crown', perm: 'coupons.write', go: function () { CFG.coupons.canWrite = true; return manager(CFG.coupons); } },
    { id: 'canjes', label: 'Canjes', icon: 'star', perm: 'codes.write', go: function () { CFG.codes.canWrite = true; return manager(CFG.codes); } },
    { id: 'ruleta', label: 'Ruleta', icon: 'bolt', perm: 'wheel.write', go: function () { CFG.prizes.canWrite = true; return manager(CFG.prizes); } },
    { id: 'auditoria', label: 'Auditoría', icon: 'shield', perm: 'audit.read', go: viewAudit }
  ];
  var allowed = [];

  function route() {
    var id = (location.hash || '').slice(1);
    var s = allowed.filter(function (x) { return x.id === id; })[0] || allowed[0];
    if (!s) { view.replaceChildren(h('div', { class: 'empty', text: 'Tu rol no tiene secciones disponibles.' })); return; }
    Array.prototype.forEach.call(nav.children, function (a) { a.classList.toggle('on', a.dataset.id === s.id); });
    s.go();
  }

  function start() {
    allowed = SECTIONS.filter(function (s) { return has(s.perm); });
    nav.replaceChildren();
    allowed.forEach(function (s) {
      var a = h('a', { href: '#' + s.id, 'data-id': s.id }, icon(s.icon), s.label);
      nav.append(a);
    });
    window.addEventListener('hashchange', route);
    route();
  }

  window.NX.ready.then(function (o) {
    if (!o.sb || !o.session) { location.replace('/login'); return; }
    sb = o.sb; myId = o.session.user.id;
    return api('me').then(function (m) { me = m; start(); }).catch(function (e) {
      view.replaceChildren(h('div', { class: 'empty' }, e.status === 403 ? 'Esta cuenta no tiene acceso al panel. ' : (e.message + ' '), h('a', { href: '/', text: 'Volver al inicio', style: 'color:var(--hi);text-decoration:underline' })));
    });
  });
})();
