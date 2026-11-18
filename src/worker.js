// NEXORA · Worker de Cloudflare
// Sirve public/ y la API en /api/*. Los secretos viven SOLO en Cloudflare:
//   SUPABASE_ANON_KEY  (publishable)   SUPABASE_SERVICE_ROLE_KEY (secret)

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function authHeaders(key) {
  const h = { apikey: key, "content-type": "application/json" };
  if (key.startsWith("ey")) h.authorization = `Bearer ${key}`; // llaves JWT antiguas
  return h;
}

async function sb(env, path, { method = "GET", body, service = false, headers = {} } = {}) {
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("sin_clave");
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...authHeaders(key), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(`supabase_${res.status}_${b.code || "x"}`);
  }
  return res.status === 204 ? null : res.json();
}

const listGames = (env) =>
  sb(env, "games?status=eq.active&select=id,slug,name,category,required_fields&order=sort_order.asc");

async function listProducts(env, slug) {
  const g = await sb(env, `games?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id`);
  if (!g.length) return [];
  return sb(env, `products?game_id=eq.${g[0].id}&status=eq.active&select=id,name,price_usd&order=price_usd.asc`);
}

// Valida el token de sesión del cliente contra Supabase Auth.
async function userFromToken(env, request) {
  const h = request.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!t) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${t}` },
  });
  return r.ok ? r.json() : null;
}

async function createOrder(env, request) {
  const user = await userFromToken(env, request);
  if (!user) return json({ error: "Inicia sesión para hacer tu recarga." }, 401);

  const input = await request.json().catch(() => null);
  if (!input || !input.product_id || typeof input.player !== "object") return json({ error: "Datos incompletos" }, 400);
  const playerId = String(input.player.player_id || "").slice(0, 64);
  if (!playerId) return json({ error: "Falta el ID del jugador" }, 400);

  const prods = await sb(env, `products?id=eq.${encodeURIComponent(input.product_id)}&status=eq.active&select=id,price_usd`, { service: true });
  if (!prods.length) return json({ error: "Producto no disponible" }, 404);
  const rates = await sb(env, "exchange_rates?quote=eq.VES&order=fetched_at.desc&limit=1&select=id,rate", { service: true });
  const rate = rates[0] || null;

  const rows = await sb(env, "orders", {
    method: "POST",
    service: true,
    headers: { prefer: "return=representation" },
    body: {
      user_id: user.id,
      product_id: prods[0].id,
      amount_usd: prods[0].price_usd, // el precio lo fija el servidor, nunca el navegador
      rate_id: rate ? rate.id : null,
      rate_applied: rate ? rate.rate : null,
      player_details: { player_id: playerId, server: String(input.player.server || "").slice(0, 64) },
      status: "pending",
    },
  });
  return json({ order_id: rows[0].id, status: rows[0].status, amount_usd: rows[0].amount_usd });
}

// Inicio de sesión con correo O nombre de usuario. El correo nunca se expone al navegador.
async function login(env, request) {
  const input = await request.json().catch(() => null);
  const ident = String((input && input.identifier) || "").trim().slice(0, 120);
  const password = String((input && input.password) || "").slice(0, 200);
  if (!ident || !password) return json({ error: "Completa usuario y contraseña." }, 400);
  const bad = () => json({ error: "Usuario o contraseña incorrectos." }, 401);

  let email = ident;
  if (!ident.includes("@")) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(ident)) return bad();
    const rows = await sb(env, `profiles?username=eq.${encodeURIComponent(ident)}&select=id`, { service: true });
    if (!rows.length) return bad();
    const u = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${rows[0].id}`, { headers: authHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
    if (!u.ok) return bad();
    email = (await u.json()).email;
  }
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(env.SUPABASE_ANON_KEY),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return bad();
  const s = await res.json();
  return json({ access_token: s.access_token, refresh_token: s.refresh_token });
}

async function usernameAvailable(env, url) {
  const u = (url.searchParams.get("u") || "").trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return json({ available: false });
  const rows = await sb(env, `profiles?username=eq.${encodeURIComponent(u)}&select=id`, { service: true });
  return json({ available: rows.length === 0 });
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
        return json({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }); // la clave anon es pública por diseño
      if (p === "/api/games" && m === "GET") return json(await listGames(env));
      const g = p.match(/^\/api\/games\/([a-z0-9-]+)\/products$/);
      if (g && m === "GET") return json(await listProducts(env, g[1]));
      if (p === "/api/orders" && m === "POST") return await createOrder(env, request);
      if (p === "/api/login" && m === "POST") return await login(env, request);
      if (p === "/api/username" && m === "GET") return await usernameAvailable(env, url);
      return json({ error: "No encontrado" }, 404);
    } catch (e) {
      return json({ error: "Servicio no disponible", code: String(e && e.message || "error") }, 503);
    }
  },
};
