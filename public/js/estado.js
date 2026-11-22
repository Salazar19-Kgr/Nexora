(function () {
  var L = document.getElementById('list');
  function row(state, title, note, tag) {
    var d = document.createElement('div'); d.className = 'row ' + state;
    d.innerHTML = '<span class="dot"></span><div><b></b><small></small></div><span class="tag"></span>';
    d.querySelector('b').textContent = title; d.querySelector('small').textContent = note; d.querySelector('.tag').textContent = tag;
    L.appendChild(d);
  }
  function ok(v) { return v === true || (v && v.ok === true); }
  fetch('/api/health', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (h) {
    L.innerHTML = '';
    var items = [
      ['Conexión con la base de datos', 'Dirección y claves cargadas', h.url_configurada && h.clave_publica_cargada && h.clave_secreta_cargada],
      ['Catálogo de juegos', 'Lectura pública de juegos y precios', h.catalogo_con_clave_publica],
      ['Usuarios', 'Registro e inicio de sesión', h.usuarios_con_clave_secreta],
      ['Panel de administración', 'Cupones, códigos, ruleta y roles', h.admin_con_clave_secreta],
      ['Pagos y comprobantes', 'Métodos, capturas y verificación', h.pagos_con_clave_secreta],
      ['Entregas automáticas', 'Tabla de entregas (SQL 0010)', h.entregas_con_clave_secreta],
      ['Acceso SSECEO', 'Clave de instalación configurada', h.ceo_listo]
    ];
    items.forEach(function (i) { row(ok(i[2]) ? 'ok' : 'no', i[0], ok(i[2]) ? i[1] : (i[2] && i[2].mensaje) || 'Falta configurar o ejecutar el SQL', ok(i[2]) ? 'Listo' : 'Falla'); });
    row(h.proveedor_configurado ? (h.proveedor_en_vivo ? 'ok' : 'warn') : 'warn', 'Proveedor GamesDrop', h.proveedor_configurado ? (h.proveedor_en_vivo ? 'Modo real activo' : 'Conectado en modo prueba (no gasta saldo)') : 'Falta GAMESDROP_TOKEN', h.proveedor_configurado ? (h.proveedor_en_vivo ? 'Real' : 'Prueba') : 'Pendiente');
    row(h.bot_configurado ? 'ok' : 'warn', 'Bot de pagos', h.bot_configurado ? 'Conectado' : 'Opcional: se conecta al final', h.bot_configurado ? 'Listo' : 'Pendiente');
  }).catch(function () { L.innerHTML = ''; row('no', 'No se pudo consultar', 'Revisa tu conexión', 'Falla'); });
})();
