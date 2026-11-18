// NEXORA - Worker de Cloudflare: sirve public/ y la API en /api/*
// Claves SOLO como secretos de Cloudflare, nunca en el repo.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function sb(env, path, { method = "GET", body, service = false, headers = {} } = {}) {
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("Falta clave de Supabase");
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.status === 204 ? null : res.json();
}

const listGames = (env) =>
  sb(env, "games?status=eq.active&select=id,slug,name,category,required_fields&order=sort_order.asc");

async function listProducts(env, slug) {
  const g = await sb(env, `games?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id`);
  if (!g.length) return [];
  return sb(env, `products?game_id=eq.${g[0].id}&status=eq.active&select=id,name,price_usd&order=price_usd.asc`);
}

async function createOrder(env, request) {
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
      product_id: prods[0].id,
      amount_usd: prods[0].price_usd,
      rate_id: rate ? rate.id : null,
      rate_applied: rate ? rate.rate : null,
      player_details: { player_id: playerId, server: String(input.player.server || "").slice(0, 64) },
      status: "pending",
    },
  });
  return json({ order_id: rows[0].id, status: rows[0].status, amount_usd: rows[0].amount_usd });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (url.pathname === "/api/games" && request.method === "GET") return json(await listGames(env));
      const m = url.pathname.match(/^\/api\/games\/([a-z0-9-]+)\/products$/);
      if (m && request.method === "GET") return json(await listProducts(env, m[1]));
      if (url.pathname === "/api/orders" && request.method === "POST") return await createOrder(env, request);
      return json({ error: "No encontrado" }, 404);
    } catch (e) {
      return json({ error: "Servicio no disponible" }, 503);
    }
  },
};
