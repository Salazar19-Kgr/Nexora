// NEXORA · Worker de Cloudflare
// Sirve public/ y la API en /api/*. Los secretos viven SOLO en Cloudflare:
//   SUPABASE_ANON_KEY  (publishable)   SUPABASE_SERVICE_ROLE_KEY (secret)
// Regla del panel: los botones ocultos NO protegen nada. Cada acción se valida aquí, por rol.

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m, s = 400) => new HttpError(s, m);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function authHeaders(key) {
  if (!key) throw new Error("sin_clave");
  const h = { apikey: key, "content-type": "application/json" };
  if (key.startsWith("ey")) h.authorization = `Bearer ${key}`; // llaves JWT antiguas
  return h;
}

async function sb(env, path, { method = "GET", body, service = false, headers = {} } = {}) {
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...authHeaders(key), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    const e = new Error(`supabase_${res.status}_${b.code || "x"}`);
    e.pg = { status: res.status, code: b.code || null, message: b.message || "" };
    throw e;
  }
  return res.status === 204 ? null : res.json();
}

async function rpc(env, fn, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: authHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    body: JSON.stringify(args),
  });
  const b = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(`rpc_${fn}`);
    e.pg = { status: res.status, code: (b && b.code) || null, message: (b && b.message) || "" };
    throw e;
  }
  return b;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrFail = (v) => { if (!UUID.test(String(v))) throw bad("Identificador no válido."); return String(v).toLowerCase(); };

const PG_MSG = {
  cuenta_suspendida: [403, "Tu cuenta está suspendida. Escríbenos por soporte."],
  producto_no_disponible: [404, "Producto no disponible."],
  cupon_invalido: [400, "Cupón inválido, vencido o sin usos."],
  cupon_usado: [409, "Ya usaste este cupón."],
  codigo_invalido: [400, "Código inválido o vencido."],
  codigo_ya_usado: [409, "Ya canjeaste este código."],
  sin_giros: [409, "No tienes giros disponibles."],
  ruleta_vacia: [409, "La ruleta aún no tiene premios."],
  pedido_no_pagable: [409, "El pedido ya no está pendiente de pago."],
  usuario_no_existe: [404, "Usuario no encontrado."],
  pedido_no_existe: [404, "Pedido no encontrado."],
  metodo_invalido: [400, "Ese método de pago no está disponible."],
  monto_minimo: [400, "El pedido es menor al mínimo de ese método de pago."],
  comprobante_pendiente: [409, "Ya enviaste un comprobante para este pedido. Está en revisión."],
  referencia_usada: [409, "Esa referencia ya fue usada en otro pago."],
  comprobante_no_pendiente: [409, "Ese comprobante ya fue revisado."],
  accion_invalida: [400, "Acción no válida."],
};

// ---------- Sesión ----------
async function userFromToken(env, request) {
  const h = request.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!t) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${t}` },
  });
  return r.ok ? r.json() : null;
}

async function needUser(env, request) {
  const user = await userFromToken(env, request);
  if (!user) throw bad("Inicia sesión para continuar.", 401);
  return user;
}

async function readBody(request) {
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) throw bad("Datos inválidos.");
  return b;
}

// ---------- Tienda pública ----------
const listGames = (env) =>
  sb(env, "games?status=eq.active&select=id,slug,name,category,description,icon_url,required_fields&order=sort_order.asc");

async function listProducts(env, slug) {
  const g = await sb(env, `games?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id`);
  if (!g.length) return [];
  return sb(env, `products?game_id=eq.${g[0].id}&status=eq.active&select=id,name,price_usd&order=price_usd.asc`);
}

async function latestRate(env) {
  const r = await sb(env, "exchange_rates?quote=eq.VES&order=fetched_at.desc&limit=1&select=rate", { service: true });
  return r[0] ? Number(r[0].rate) : null;
}

async function gamePage(env, slug) {
  const g = await sb(env, `games?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id,slug,name,category,description,icon_url,required_fields`);
  if (!g.length) throw bad("Juego no encontrado.", 404);
  const [products, rate] = await Promise.all([
    sb(env, `products?game_id=eq.${g[0].id}&status=eq.active&select=id,name,price_usd&order=price_usd.asc`),
    latestRate(env),
  ]);
  return json({ game: g[0], products, rate });
}

async function createOrder(env, request) {
  const user = await needUser(env, request);
  const input = await readBody(request);
  if (!input.product_id || typeof input.player !== "object" || !input.player) throw bad("Datos incompletos.");
  const playerId = String(input.player.player_id || "").trim().slice(0, 64);
  if (!playerId) throw bad("Falta el ID del jugador.");
  const coupon = String(input.coupon || "").trim().slice(0, 32) || null;
  // El precio y el descuento los calcula la base de datos, nunca el navegador.
  const r = await rpc(env, "create_order", {
    p_user: user.id,
    p_product: uuidOrFail(input.product_id),
    p_player: { player_id: playerId, server: String(input.player.server || "").trim().slice(0, 64) },
    p_coupon: coupon,
  });
  return json(r);
}

// ---------- Pago: métodos, pedido y comprobante ----------
const KINDS = ["pago_movil", "transferencia", "zelle", "binance", "usdt", "efectivo", "otro"];
const money = (n) => Math.round(Number(n) * 100) / 100;
const expectedIn = (order, currency) =>
  currency === "VES" ? money(Number(order.amount_usd) * Number(order.rate_applied || 0)) : money(order.amount_usd);

async function paymentMethods(env, request) {
  await needUser(env, request);
  return json(await sb(env, "payment_methods?active=eq.true&select=id,name,kind,currency,instructions,min_usd&order=sort_order.asc,name.asc", { service: true }));
}

async function myOrder(env, request, id) {
  const user = await needUser(env, request);
  id = uuidOrFail(id);
  const rows = await sb(env,
    `orders?id=eq.${id}&user_id=eq.${user.id}&select=${encodeURIComponent("id,status,amount_usd,discount_usd,rate_applied,player_details,created_at,products(name,games(name,slug,icon_url,category))")}`,
    { service: true });
  if (!rows.length) throw bad("Pedido no encontrado.", 404);
  const proofs = await sb(env, `payment_proofs?order_id=eq.${id}&select=status,reject_reason,created_at,payment_methods(name)&order=created_at.desc&limit=1`, { service: true });
  return json({ ...rows[0], proof: proofs[0] || null });
}

function imageType(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ["image/jpeg", "jpg"];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ["image/png", "png"];
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return ["image/webp", "webp"];
  return null;
}

async function storageUpload(env, path, bytes, type) {
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/proofs/${path}`, {
    method: "POST",
    headers: { ...authHeaders(env.SUPABASE_SERVICE_ROLE_KEY), "content-type": type, "x-upsert": "false" },
    body: bytes,
  });
  if (!r.ok) throw new Error("storage_upload");
}
async function storageRemove(env, path) {
  try {
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/proofs/${path}`, { method: "DELETE", headers: authHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
  } catch (e) { /* mejor esfuerzo */ }
}

async function submitProof(env, request, id) {
  const user = await needUser(env, request);
  id = uuidOrFail(id);
  if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024) throw bad("La captura es demasiado pesada (máximo 5 MB).", 413);
  const form = await request.formData().catch(() => null);
  if (!form) throw bad("Datos inválidos.");
  const methodId = uuidOrFail(form.get("method_id"));
  const reference = coerce({ t: "text", label: "Referencia", req: true, upper: true, max: 64, re: /^[A-Z0-9._-]{4,64}$/ }, String(form.get("reference") || "").replace(/\s+/g, ""));
  const file = form.get("proof");
  if (!file || typeof file === "string" || !file.size) throw bad("Adjunta la captura del pago.");
  if (file.size > 5 * 1024 * 1024) throw bad("La captura es demasiado pesada (máximo 5 MB).", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageType(bytes);
  if (!kind) throw bad("La captura debe ser una imagen JPG, PNG o WEBP.");
  const path = `${user.id}/${id}-${rnd(8).toLowerCase()}.${kind[1]}`;
  await storageUpload(env, path, bytes, kind[0]);
  try {
    const r = await rpc(env, "submit_proof", { p_user: user.id, p_order: id, p_method: methodId, p_ref: reference, p_path: path });
    return json(r, 201);
  } catch (e) {
    await storageRemove(env, path);
    throw e;
  }
}

function sameSecret(a, b) {
  if (!a || !b) return Promise.resolve(false);
  const enc = new TextEncoder();
  return Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]).then(([x, y]) => {
    const u = new Uint8Array(x), v = new Uint8Array(y);
    let d = 0;
    for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
    return d === 0;
  });
}

// El bot (SMS del banco, API de Binance, etc.) avisa aquí cada pago recibido. Requiere BOT_SECRET en Cloudflare.
async function botPayment(env, request) {
  if (!env.BOT_SECRET) return json({ error: "No encontrado" }, 404);
  if (!(await sameSecret(request.headers.get("x-bot-key") || "", env.BOT_SECRET))) return json({ error: "No autorizado." }, 401);
  const b = await readBody(request);
  const kind = coerce({ t: "enum", label: "Tipo", list: KINDS, req: true }, b.kind);
  const reference = coerce({ t: "text", label: "Referencia", req: true, upper: true, max: 64, re: /^[A-Z0-9._-]{4,64}$/ }, b.reference);
  const amount = coerce({ t: "num", label: "Monto", req: true, min: 0.01, max: 100000000 }, b.amount);
  const currency = coerce({ t: "enum", label: "Moneda", list: ["USD", "VES", "USDT"], req: true }, b.currency);
  const r = await rpc(env, "register_incoming", { p_kind: kind, p_ref: reference, p_amount: amount, p_currency: currency, p_source: String(b.source || "bot").slice(0, 40) });
  return json(r);
}

// ---------- Cuenta del usuario: perfil, canje y ruleta ----------
async function myProfile(env, id) {
  const rows = await sb(env, `profiles?id=eq.${id}&select=username,balance_usd,points,spins,banned`, { service: true });
  return rows[0] || { username: null, balance_usd: 0, points: 0, spins: 0, banned: false };
}

async function me(env, request) {
  const user = await needUser(env, request);
  const p = await myProfile(env, user.id);
  return json({ username: p.username, balance_usd: p.balance_usd, points: p.points, spins: p.spins });
}

async function redeem(env, request) {
  const user = await needUser(env, request);
  const b = await readBody(request);
  const code = String(b.code || "").trim().slice(0, 32);
  if (!code) throw bad("Escribe un código.");
  return json(await rpc(env, "redeem_code", { p_user: user.id, p_code: code }));
}

async function wheelInfo(env, request) {
  const prizes = await sb(env, "wheel_prizes?active=eq.true&select=id,label,prize_type&order=created_at.asc,id.asc", { service: true });
  const user = await userFromToken(env, request);
  const spins = user ? (await myProfile(env, user.id)).spins : 0;
  return json({ prizes, spins });
}

async function spin(env, request) {
  const user = await needUser(env, request);
  const prize = await rpc(env, "spin_wheel", { p_user: user.id });
  const p = await myProfile(env, user.id);
  return json({ prize, spins: p.spins, balance_usd: p.balance_usd, points: p.points });
}

// ---------- Inicio de sesión con correo O usuario ----------
async function login(env, request) {
  const input = await request.json().catch(() => null);
  const ident = String((input && input.identifier) || "").trim().slice(0, 120);
  const password = String((input && input.password) || "").slice(0, 200);
  if (!ident || !password) return json({ error: "Completa usuario y contraseña." }, 400);
  const fail = () => json({ error: "Usuario o contraseña incorrectos." }, 401);

  let email = ident;
  if (!ident.includes("@")) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(ident)) return fail();
    const rows = await sb(env, `profiles?username=eq.${encodeURIComponent(ident)}&select=id`, { service: true });
    if (!rows.length) return fail();
    const u = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${rows[0].id}`, { headers: authHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
    if (!u.ok) return fail();
    email = (await u.json()).email;
  }
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(env.SUPABASE_ANON_KEY),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return fail();
  const s = await res.json();
  if (s.user && s.user.id) {
    const p = await sb(env, `profiles?id=eq.${s.user.id}&select=banned`, { service: true });
    if (p[0] && p[0].banned) return json({ error: "Tu cuenta está suspendida. Escríbenos por soporte." }, 403);
  }
  return json({ access_token: s.access_token, refresh_token: s.refresh_token });
}

async function usernameAvailable(env, url) {
  const u = (url.searchParams.get("u") || "").trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return json({ available: false });
  const rows = await sb(env, `profiles?username=eq.${encodeURIComponent(u)}&select=id`, { service: true });
  return json({ available: rows.length === 0 });
}

// ======================================================================
//  PANEL DE ADMINISTRACIÓN
// ======================================================================
const ALL_PERMS = [
  "stats", "catalog.read", "catalog.write", "users.read", "users.grant", "orders.read", "orders.write",
  "payments.write", "rates.write", "coupons.write", "codes.write", "wheel.write", "audit.read",
];
const PERMS = {
  owner: ["*"],
  admin: ["stats", "catalog.read", "catalog.write", "users.read", "users.grant", "orders.read", "orders.write", "payments.write", "rates.write", "coupons.write", "codes.write", "wheel.write", "audit.read"],
  operator: ["stats", "catalog.read", "users.read", "orders.read", "orders.write"],
  finance: ["stats", "catalog.read", "users.read", "orders.read", "payments.write", "rates.write"],
  support: ["catalog.read", "users.read", "orders.read"],
};
const ROLES = ["owner", "admin", "operator", "finance", "support", "customer"];

const has = (ctx, perm) => ctx.perms.includes("*") || ctx.perms.includes(perm);
const need = (ctx, perm) => { if (!has(ctx, perm)) throw bad("Tu rol no permite esta acción.", 403); };

async function staff(env, request) {
  const user = await userFromToken(env, request);
  if (!user) throw bad("Inicia sesión.", 401);
  const rows = await sb(env, `profiles?id=eq.${user.id}&select=role,banned,username`, { service: true });
  const p = rows[0];
  if (!p || p.banned || !PERMS[p.role]) throw bad("Sin permiso.", 403);
  return { user, role: p.role, username: p.username, perms: PERMS[p.role] };
}

async function audit(env, actor, action, type, id, before, after) {
  try {
    await sb(env, "audit_logs", {
      method: "POST", service: true, headers: { prefer: "return=representation" },
      body: { actor, action, object_type: type, object_id: id ? String(id) : null, before: before || null, after: after || null },
    });
  } catch (e) { /* la auditoría no debe tumbar la acción ya hecha */ }
}

const rnd = (n) => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join("");
};

// --- Validación de campos (lista blanca: solo se guarda lo que está aquí) ---
function coerce(s, raw) {
  const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  if (empty) {
    if ("def" in s) return s.def;
    if (s.req) throw bad(`${s.label} es obligatorio.`);
    return null;
  }
  switch (s.t) {
    case "text": {
      let v = String(raw).trim();
      if (s.upper) v = v.toUpperCase();
      if (v.length > (s.max || 120)) throw bad(`${s.label} es demasiado largo.`);
      if (s.re && !s.re.test(v)) throw bad(`${s.label} tiene un formato no válido.`);
      return v;
    }
    case "num": {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw bad(`${s.label} debe ser un número.`);
      if (s.int && !Number.isInteger(n)) throw bad(`${s.label} debe ser un número entero.`);
      if (s.min != null && n < s.min) throw bad(`${s.label} no puede ser menor que ${s.min}.`);
      if (s.max != null && n > s.max) throw bad(`${s.label} no puede ser mayor que ${s.max}.`);
      return Math.round(n * 10000) / 10000;
    }
    case "enum":
      if (!s.list.includes(String(raw))) throw bad(`${s.label} no es válido.`);
      return String(raw);
    case "bool": return raw === true || raw === "true" || raw === 1;
    case "uuid": return uuidOrFail(raw);
    case "ts": {
      const d = new Date(raw);
      if (isNaN(d)) throw bad(`${s.label} no es una fecha válida.`);
      return d.toISOString();
    }
    case "fields": {
      const arr = (Array.isArray(raw) ? raw : String(raw).split(",")).map((x) => String(x).trim()).filter(Boolean);
      if (!arr.length || arr.some((x) => !["player_id", "server"].includes(x))) throw bad(`${s.label} no es válido.`);
      return arr;
    }
  }
  throw bad("Campo no válido.");
}

function clean(spec, body, mode) {
  const out = {};
  for (const [k, s] of Object.entries(spec)) {
    if (mode === "update" && (s.once || !(k in body))) continue;
    out[k] = coerce(s, body[k]);
  }
  return out;
}

const ST = ["draft", "active", "paused"];
const RES = {
  games: {
    table: "games", read: "catalog.read", write: "catalog.write", order: "sort_order.asc,name.asc", select: "*",
    spec: {
      slug: { t: "text", label: "Slug", req: true, once: true, max: 40, re: /^[a-z0-9-]{2,40}$/ },
      name: { t: "text", label: "Nombre", req: true, max: 80 },
      category: { t: "text", label: "Categoría", req: true, max: 60 },
      description: { t: "text", label: "Descripción", max: 300 },
      icon_url: { t: "text", label: "Logo (enlace https://…)", max: 300, re: /^(https:\/\/|\/img\/)[^\s"'<>]+$/ },
      required_fields: { t: "fields", label: "Datos requeridos", def: ["player_id"] },
      status: { t: "enum", label: "Estado", list: ST, def: "draft" },
      sort_order: { t: "num", label: "Orden", int: true, min: 0, max: 9999, def: 100 },
    },
  },
  products: {
    table: "products", read: "catalog.read", write: "catalog.write", order: "created_at.desc", select: "*,games(name,slug)",
    spec: {
      game_id: { t: "uuid", label: "Juego", req: true },
      sku: { t: "text", label: "SKU", max: 60, upper: true, once: true, re: /^[A-Z0-9_-]{3,60}$/ },
      name: { t: "text", label: "Nombre del paquete", req: true, max: 80 },
      external_sku: { t: "text", label: "SKU del proveedor", max: 80 },
      cost: { t: "num", label: "Costo", min: 0, max: 1000000, def: 0 },
      cost_currency: { t: "enum", label: "Moneda del costo", list: ["USD", "VES", "USDT"], def: "USD" },
      price_usd: { t: "num", label: "Precio en USD", req: true, min: 0, max: 100000 },
      delivery_type: { t: "enum", label: "Entrega", list: ["manual", "code", "api"], def: "manual" },
      status: { t: "enum", label: "Estado", list: ST, def: "draft" },
    },
    async beforeCreate(env, out) {
      if (out.sku) return;
      const g = await sb(env, `games?id=eq.${out.game_id}&select=slug`, { service: true });
      if (!g.length) throw bad("Juego no encontrado.");
      const base = `${g[0].slug}-${out.name}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 48).replace(/-+$/, "");
      out.sku = `${base}-${rnd(3)}`;
    },
  },
  paymethods: {
    table: "payment_methods", read: "payments.write", write: "payments.write", order: "sort_order.asc,name.asc", select: "*",
    spec: {
      name: { t: "text", label: "Nombre", req: true, max: 60 },
      kind: { t: "enum", label: "Tipo", list: KINDS, req: true },
      currency: { t: "enum", label: "Moneda", list: ["USD", "VES", "USDT"], req: true },
      instructions: { t: "text", label: "Datos para pagar", req: true, max: 800 },
      min_usd: { t: "num", label: "Mínimo en USD", min: 0, max: 100000, def: 0 },
      active: { t: "bool", label: "Activo", def: true },
      sort_order: { t: "num", label: "Orden", int: true, min: 0, max: 9999, def: 100 },
    },
  },
  coupons: {
    table: "coupons", read: "coupons.write", write: "coupons.write", order: "created_at.desc", select: "*,games(name)",
    spec: {
      code: { t: "text", label: "Código", req: true, upper: true, once: true, max: 32, re: /^[A-Z0-9_-]{3,32}$/ },
      kind: { t: "enum", label: "Tipo", list: ["percent", "fixed"], req: true },
      value: { t: "num", label: "Valor", req: true, min: 0.01, max: 100000 },
      min_amount_usd: { t: "num", label: "Compra mínima", min: 0, max: 100000, def: 0 },
      max_uses: { t: "num", label: "Usos máximos", int: true, min: 1, max: 10000000 },
      game_id: { t: "uuid", label: "Juego" },
      expires_at: { t: "ts", label: "Vence" },
      active: { t: "bool", label: "Activo", def: true },
    },
    check(o) { if (o.kind === "percent" && o.value > 100) throw bad("El porcentaje no puede pasar de 100."); },
  },
  codes: {
    table: "redeem_codes", read: "codes.write", write: "codes.write", order: "created_at.desc", select: "*",
    spec: {
      code: { t: "text", label: "Código", req: true, upper: true, once: true, max: 32, re: /^[A-Z0-9_-]{3,32}$/ },
      reward_type: { t: "enum", label: "Premio", list: ["balance", "points", "spins"], req: true },
      reward_value: { t: "num", label: "Cantidad", req: true, min: 0.01, max: 100000 },
      max_uses: { t: "num", label: "Usos máximos", int: true, min: 1, max: 10000000 },
      expires_at: { t: "ts", label: "Vence" },
      active: { t: "bool", label: "Activo", def: true },
    },
    check(o) { if (o.reward_type !== "balance" && !Number.isInteger(o.reward_value)) throw bad("Puntos y giros deben ser números enteros."); },
  },
  prizes: {
    table: "wheel_prizes", read: "wheel.write", write: "wheel.write", order: "created_at.asc", select: "*",
    spec: {
      label: { t: "text", label: "Nombre del premio", req: true, max: 40 },
      prize_type: { t: "enum", label: "Tipo", list: ["none", "balance", "points", "spins"], req: true },
      value: { t: "num", label: "Cantidad", min: 0, max: 100000, def: 0 },
      weight: { t: "num", label: "Peso (probabilidad)", int: true, req: true, min: 1, max: 1000 },
      active: { t: "bool", label: "Activo", def: true },
    },
    check(o) {
      if (o.prize_type !== "none" && !(o.value > 0)) throw bad("Este premio necesita una cantidad mayor que 0.");
      if ((o.prize_type === "points" || o.prize_type === "spins") && !Number.isInteger(o.value)) throw bad("Puntos y giros deben ser enteros.");
    },
  },
};

async function resList(env, ctx, name) {
  const r = RES[name];
  need(ctx, r.read);
  let rows = await sb(env, `${r.table}?select=${encodeURIComponent(r.select)}&order=${r.order}&limit=500`, { service: true });
  if (name === "products" && !has(ctx, "catalog.write")) {
    rows = rows.map(({ cost, cost_currency, external_sku, ...x }) => x);
  }
  return json(rows);
}

async function resCreate(env, ctx, name, body) {
  const r = RES[name];
  need(ctx, r.write);
  const out = clean(r.spec, body, "create");
  if (r.check) r.check(out);
  if (r.beforeCreate) await r.beforeCreate(env, out);
  const rows = await sb(env, r.table, { method: "POST", service: true, headers: { prefer: "return=representation" }, body: out });
  await audit(env, ctx.user.id, `${name}.create`, name, rows[0].id, null, rows[0]);
  return json(rows[0], 201);
}

async function resUpdate(env, ctx, name, id, body) {
  const r = RES[name];
  need(ctx, r.write);
  id = uuidOrFail(id);
  const cur = await sb(env, `${r.table}?id=eq.${id}&select=*`, { service: true });
  if (!cur.length) throw bad("No encontrado.", 404);
  const out = clean(r.spec, body, "update");
  if (!Object.keys(out).length) throw bad("No hay nada que cambiar.");
  if (r.check) r.check({ ...cur[0], ...out });
  const rows = await sb(env, `${r.table}?id=eq.${id}`, { method: "PATCH", service: true, headers: { prefer: "return=representation" }, body: out });
  await audit(env, ctx.user.id, `${name}.update`, name, id, cur[0], rows[0]);
  return json(rows[0]);
}

// --- Usuarios ---
async function usersList(env, ctx, url) {
  need(ctx, "users.read");
  const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);
  const [profiles, auth] = await Promise.all([
    sb(env, "profiles?select=id,username,display_name,role,balance_usd,points,spins,banned,created_at&order=created_at.desc&limit=200", { service: true }),
    fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: authHeaders(env.SUPABASE_SERVICE_ROLE_KEY) })
      .then((r) => (r.ok ? r.json() : { users: [] })).catch(() => ({ users: [] })),
  ]);
  const mail = new Map((auth.users || []).map((u) => [u.id, { email: u.email, last: u.last_sign_in_at }]));
  let rows = profiles.map((p) => ({ ...p, email: (mail.get(p.id) || {}).email || null, last_sign_in: (mail.get(p.id) || {}).last || null }));
  if (q) rows = rows.filter((u) => [u.username, u.display_name, u.email].some((v) => v && String(v).toLowerCase().includes(q)));
  return json(rows);
}

async function userAction(env, ctx, id, body) {
  id = uuidOrFail(id);
  const cur = await sb(env, `profiles?id=eq.${id}&select=id,role,banned,balance_usd,points,spins,username`, { service: true });
  if (!cur.length) throw bad("Usuario no encontrado.", 404);
  const target = cur[0];
  const action = String(body.action || "");

  if (action === "role") {
    if (!ctx.perms.includes("*")) throw bad("Solo el propietario puede cambiar roles.", 403);
    if (id === ctx.user.id) throw bad("No puedes cambiar tu propio rol.");
    const role = String(body.role || "");
    if (!ROLES.includes(role)) throw bad("Rol no válido.");
    const rows = await sb(env, `profiles?id=eq.${id}`, { method: "PATCH", service: true, headers: { prefer: "return=representation" }, body: { role } });
    await audit(env, ctx.user.id, "user.role", "profiles", id, { role: target.role }, { role });
    return json({ role: rows[0].role });
  }
  if (action === "ban") {
    need(ctx, "users.grant");
    if (id === ctx.user.id) throw bad("No puedes suspenderte a ti mismo.");
    if (target.role === "owner") throw bad("No se puede suspender al propietario.", 403);
    const banned = body.banned === true;
    await sb(env, `profiles?id=eq.${id}`, { method: "PATCH", service: true, headers: { prefer: "return=representation" }, body: { banned } });
    await audit(env, ctx.user.id, banned ? "user.ban" : "user.unban", "profiles", id, { banned: target.banned }, { banned });
    return json({ banned });
  }
  if (action === "adjust") {
    need(ctx, "users.grant");
    const kind = String(body.kind || "");
    if (!["balance", "points", "spins"].includes(kind)) throw bad("Tipo no válido.");
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) throw bad("Escribe una cantidad válida (distinta de 0).");
    if (kind !== "balance" && !Number.isInteger(amount)) throw bad("Puntos y giros deben ser enteros.");
    const after = await rpc(env, "admin_adjust", { p_user: id, p_kind: kind, p_amount: amount });
    await audit(env, ctx.user.id, "user.adjust", "profiles", id,
      { balance_usd: target.balance_usd, points: target.points, spins: target.spins }, { ...after, ajuste: { kind, amount } });
    return json(after);
  }
  throw bad("Acción no válida.");
}

// --- Pedidos y pagos ---
const STATUSES = ["pending", "awaiting_review", "paid", "delivering", "completed", "rejected", "refunded", "disputed"];
const NEXT = {
  pending: ["awaiting_review", "rejected"],
  awaiting_review: ["rejected"],
  paid: ["delivering", "completed", "refunded", "disputed"],
  delivering: ["completed", "refunded", "disputed"],
  completed: ["refunded", "disputed"],
  disputed: ["completed", "refunded"],
  rejected: [],
  refunded: [],
};

async function ordersList(env, ctx, url) {
  need(ctx, "orders.read");
  const st = url.searchParams.get("status");
  let f = "";
  if (st) { if (!STATUSES.includes(st)) throw bad("Estado no válido."); f = `&status=eq.${st}`; }
  const rows = await sb(env,
    `orders?select=${encodeURIComponent("id,user_id,amount_usd,discount_usd,status,created_at,player_details,rate_applied,products(name,sku,games(name)),payments(id,method,reference,amount,currency,created_at)")}&order=created_at.desc&limit=100${f}`,
    { service: true });
  const ids = [...new Set(rows.map((o) => o.user_id).filter(Boolean))];
  let names = new Map();
  if (ids.length) {
    const ps = await sb(env, `profiles?id=in.(${ids.join(",")})&select=id,username`, { service: true });
    names = new Map(ps.map((p) => [p.id, p.username]));
  }
  return json(rows.map((o) => ({ ...o, username: names.get(o.user_id) || null })));
}

async function orderStatus(env, ctx, id, body) {
  need(ctx, "orders.write");
  id = uuidOrFail(id);
  const to = String(body.status || "");
  if (!STATUSES.includes(to)) throw bad("Estado no válido.");
  if (to === "paid") throw bad("Para marcar un pedido como pagado registra el pago con su referencia.");
  if (to === "refunded") need(ctx, "payments.write");
  const cur = await sb(env, `orders?id=eq.${id}&select=id,status`, { service: true });
  if (!cur.length) throw bad("Pedido no encontrado.", 404);
  if (!NEXT[cur[0].status].includes(to)) throw bad("Ese cambio de estado no está permitido.", 409);
  const rows = await sb(env, `orders?id=eq.${id}&status=eq.${cur[0].status}`, {
    method: "PATCH", service: true, headers: { prefer: "return=representation" }, body: { status: to, updated_at: new Date().toISOString() },
  });
  if (!rows.length) throw bad("El pedido cambió mientras lo editabas. Recarga la lista.", 409);
  await audit(env, ctx.user.id, "order.status", "orders", id, { status: cur[0].status }, { status: to });
  return json({ status: to });
}

async function orderPayment(env, ctx, id, body) {
  need(ctx, "payments.write");
  id = uuidOrFail(id);
  const method = coerce({ t: "enum", label: "Método", list: ["pago_movil", "transferencia", "zelle", "binance", "usdt", "efectivo", "otro"], req: true }, body.method);
  const reference = coerce({ t: "text", label: "Referencia", req: true, upper: true, max: 64, re: /^[A-Z0-9._-]{4,64}$/ }, body.reference);
  const amount = coerce({ t: "num", label: "Monto", req: true, min: 0.01, max: 100000000 }, body.amount);
  const currency = coerce({ t: "enum", label: "Moneda", list: ["USD", "VES", "USDT"], req: true }, body.currency);
  const r = await rpc(env, "confirm_payment", {
    p_order: id, p_method: method, p_ref: reference, p_amount: amount, p_currency: currency, p_actor: `human:${ctx.user.id}`,
  });
  await audit(env, ctx.user.id, "payment.confirm", "orders", id, null, { method, reference, amount, currency });
  return json(r);
}

async function proofsList(env, ctx, url) {
  need(ctx, "payments.write");
  const st = url.searchParams.get("status") || "pending";
  if (!["pending", "verified", "rejected"].includes(st)) throw bad("Estado no válido.");
  const rows = await sb(env,
    `payment_proofs?status=eq.${st}&select=${encodeURIComponent("id,order_id,user_id,reference,proof_path,status,verified_by,reject_reason,created_at,payment_methods(name,kind,currency),orders(amount_usd,discount_usd,rate_applied,status,player_details,products(name,games(name)))")}&order=created_at.asc&limit=100`,
    { service: true });
  const ids = [...new Set(rows.map((r) => r.user_id))];
  let names = new Map();
  if (ids.length) {
    const ps = await sb(env, `profiles?id=in.(${ids.join(",")})&select=id,username`, { service: true });
    names = new Map(ps.map((p) => [p.id, p.username]));
  }
  return json(rows.map((r) => ({
    ...r, has_image: !!r.proof_path, proof_path: undefined, username: names.get(r.user_id) || null,
    expected: r.orders && r.payment_methods ? expectedIn(r.orders, r.payment_methods.currency) : null,
  })));
}

async function proofImage(env, ctx, id) {
  need(ctx, "payments.write");
  id = uuidOrFail(id);
  const rows = await sb(env, `payment_proofs?id=eq.${id}&select=proof_path`, { service: true });
  if (!rows.length || !rows[0].proof_path) throw bad("Sin captura.", 404);
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/proofs/${rows[0].proof_path}`, {
    method: "POST", headers: authHeaders(env.SUPABASE_SERVICE_ROLE_KEY), body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!r.ok) throw new Error("storage_sign");
  const j = await r.json();
  return json({ url: `${env.SUPABASE_URL}/storage/v1${j.signedURL}` });
}

async function proofReview(env, ctx, id, body) {
  need(ctx, "payments.write");
  id = uuidOrFail(id);
  const action = String(body.action || "");
  if (!["approve", "reject"].includes(action)) throw bad("Acción no válida.");
  let amount = null;
  if (action === "approve") amount = coerce({ t: "num", label: "Monto recibido", req: true, min: 0.01, max: 100000000 }, body.amount);
  const reason = String(body.reason || "").trim().slice(0, 200);
  const r = await rpc(env, "review_proof", { p_proof: id, p_action: action, p_actor: `human:${ctx.user.id}`, p_amount: amount, p_reason: reason });
  await audit(env, ctx.user.id, action === "approve" ? "proof.approve" : "proof.reject", "payment_proofs", id, null, { amount, reason });
  return json(r);
}

async function setRate(env, ctx, body) {
  need(ctx, "rates.write");
  const rate = coerce({ t: "num", label: "Tasa", req: true, min: 0.01, max: 100000000 }, body.rate);
  const rows = await sb(env, "exchange_rates", {
    method: "POST", service: true, headers: { prefer: "return=representation" },
    body: { base: "USD", quote: "VES", rate, source: `manual:${ctx.user.id}` },
  });
  await audit(env, ctx.user.id, "rate.set", "exchange_rates", rows[0].id, null, { rate });
  return json({ rate });
}

async function stats(env, ctx) {
  need(ctx, "stats");
  const [s, r] = await Promise.all([
    rpc(env, "admin_stats", {}),
    sb(env, "exchange_rates?quote=eq.VES&order=fetched_at.desc&limit=1&select=rate,fetched_at", { service: true }),
  ]);
  return json({ ...s, rate: r[0] || null });
}

async function auditList(env, ctx) {
  need(ctx, "audit.read");
  const rows = await sb(env, "audit_logs?select=id,actor,action,object_type,object_id,before,after,created_at&order=created_at.desc&limit=150", { service: true });
  const ids = [...new Set(rows.map((x) => x.actor).filter(Boolean))];
  let names = new Map();
  if (ids.length) {
    const ps = await sb(env, `profiles?id=in.(${ids.join(",")})&select=id,username,display_name`, { service: true });
    names = new Map(ps.map((p) => [p.id, p.username || p.display_name]));
  }
  return json(rows.map((x) => ({ ...x, actor_name: names.get(x.actor) || null })));
}

async function admin(env, request, url) {
  const ctx = await staff(env, request);
  const seg = url.pathname.replace(/^\/api\/admin\/?/, "").split("/").filter(Boolean);
  const m = request.method;
  const [a, b, c] = seg;

  if (a === "me" && m === "GET") {
    return json({ role: ctx.role, username: ctx.username, perms: ctx.perms.includes("*") ? ALL_PERMS : ctx.perms });
  }
  if (a === "stats" && m === "GET") return stats(env, ctx);
  if (a === "audit" && m === "GET") return auditList(env, ctx);
  if (a === "users" && !b && m === "GET") return usersList(env, ctx, url);
  if (a === "users" && b && m === "POST") return userAction(env, ctx, b, await readBody(request));
  if (a === "orders" && !b && m === "GET") return ordersList(env, ctx, url);
  if (a === "orders" && b && c === "status" && m === "POST") return orderStatus(env, ctx, b, await readBody(request));
  if (a === "orders" && b && c === "payment" && m === "POST") return orderPayment(env, ctx, b, await readBody(request));
  if (a === "proofs" && !b && m === "GET") return proofsList(env, ctx, url);
  if (a === "proofs" && b && c === "image" && m === "GET") return proofImage(env, ctx, b);
  if (a === "proofs" && b && c === "review" && m === "POST") return proofReview(env, ctx, b, await readBody(request));
  if (a === "rate" && m === "POST") return setRate(env, ctx, await readBody(request));
  if (RES[a] && !b && m === "GET") return resList(env, ctx, a);
  if (RES[a] && !b && m === "POST") return resCreate(env, ctx, a, await readBody(request));
  if (RES[a] && b && m === "POST") return resUpdate(env, ctx, a, b, await readBody(request));
  throw bad("No encontrado.", 404);
}

// Diagnóstico: dice qué falla sin revelar ningún secreto.
async function health(env) {
  const out = {
    url_configurada: !!env.SUPABASE_URL,
    clave_publica_cargada: !!env.SUPABASE_ANON_KEY,
    clave_secreta_cargada: !!env.SUPABASE_SERVICE_ROLE_KEY,
  };
  async function probe(path, service) {
    const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
    if (!key) return { ok: false, nota: "falta la clave en Cloudflare" };
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders(key) });
      if (r.ok) return { ok: true };
      const b = await r.json().catch(() => ({}));
      return { ok: false, estado: r.status, codigo: b.code || null, mensaje: b.message || null };
    } catch (e) {
      return { ok: false, nota: "no hay conexión con Supabase" };
    }
  }
  out.catalogo_con_clave_publica = await probe("games?select=id&limit=1", false);
  out.usuarios_con_clave_secreta = await probe("profiles?select=username&limit=1", true);
  out.admin_con_clave_secreta = await probe("coupons?select=id&limit=1", true);
  out.pagos_con_clave_secreta = await probe("payment_methods?select=id&limit=1", true);
  out.bot_configurado = !!env.BOT_SECRET;
  return json(out);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      const m = request.method, p = url.pathname;
      if (p === "/api/health" && m === "GET") return await health(env);
      if (p === "/api/config" && m === "GET")
        return json({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }); // la clave pública es pública por diseño
      if (p === "/api/games" && m === "GET") return json(await listGames(env));
      const g = p.match(/^\/api\/games\/([a-z0-9-]+)\/products$/);
      if (g && m === "GET") return json(await listProducts(env, g[1]));
      const gp = p.match(/^\/api\/games\/([a-z0-9-]+)$/);
      if (gp && m === "GET") return await gamePage(env, gp[1]);
      if (p === "/api/orders" && m === "POST") return await createOrder(env, request);
      if (p === "/api/payment-methods" && m === "GET") return await paymentMethods(env, request);
      if (p === "/api/verify-player/status" && m === "GET") return json({ available: false });
      if (p === "/api/bot/payments" && m === "POST") return await botPayment(env, request);
      const op = p.match(/^\/api\/orders\/([0-9a-f-]{36})(\/proof)?$/i);
      if (op && !op[2] && m === "GET") return await myOrder(env, request, op[1]);
      if (op && op[2] && m === "POST") return await submitProof(env, request, op[1]);
      if (p === "/api/login" && m === "POST") return await login(env, request);
      if (p === "/api/username" && m === "GET") return await usernameAvailable(env, url);
      if (p === "/api/me" && m === "GET") return await me(env, request);
      if (p === "/api/redeem" && m === "POST") return await redeem(env, request);
      if (p === "/api/wheel" && m === "GET") return await wheelInfo(env, request);
      if (p === "/api/spin" && m === "POST") return await spin(env, request);
      if (p.startsWith("/api/admin")) return await admin(env, request, url);
      return json({ error: "No encontrado" }, 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e && e.pg) {
        const known = PG_MSG[e.pg.message];
        if (known) return json({ error: known[1] }, known[0]);
        if (e.pg.code === "23505") {
          if (/payments_unique_reference/.test(e.pg.message)) return json({ error: "Esa referencia ya fue usada en otro pago." }, 409);
          return json({ error: "Ya existe un registro con ese código, SKU o slug." }, 409);
        }
        if (e.pg.code === "23503") return json({ error: "Referencia no válida (juego o producto inexistente)." }, 400);
        if (e.pg.code === "23514") return json({ error: "El valor no es válido o el saldo quedaría en negativo." }, 400);
      }
      return json({ error: "Servicio no disponible", code: String((e && e.message) || "error") }, 503);
    }
  },
};
