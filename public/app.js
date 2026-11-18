const $ = (s) => document.querySelector(s);
const gamesEl = $("#games"), dlg = $("#checkout"), msg = $("#msg"), buy = $("#buy");
let games = [], current = null;

async function api(path, opts) {
  const r = await fetch(path, opts);
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error((d && d.error) || "Error de conexión");
  return d;
}

function render(list) {
  gamesEl.replaceChildren();
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No hay juegos que coincidan.";
    gamesEl.append(p);
    return;
  }
  let lastCat = null;
  for (const g of list) {
    if (g.category !== lastCat) {
      const h = document.createElement("h2");
      h.className = "cat";
      h.textContent = g.category;
      gamesEl.append(h);
      lastCat = g.category;
    }
    const b = document.createElement("button");
    b.className = "game";
    b.type = "button";
    b.textContent = g.name;
    b.addEventListener("click", () => openGame(g));
    gamesEl.append(b);
  }
}

async function openGame(g) {
  current = g;
  $("#gname").textContent = g.name;
  $("#server_row").hidden = !(g.required_fields || []).includes("server");
  $("#player_id").value = "";
  msg.textContent = "Cargando paquetes...";
  buy.disabled = true;
  const sel = $("#product");
  sel.replaceChildren();
  dlg.showModal();
  try {
    const prods = await api(`/api/games/${g.slug}/products`);
    if (!prods.length) {
      msg.textContent = "Este juego aún no tiene paquetes disponibles.";
      return;
    }
    for (const p of prods) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.name} · $${Number(p.price_usd).toFixed(2)}`;
      sel.append(o);
    }
    msg.textContent = "";
    buy.disabled = false;
  } catch (e) {
    msg.textContent = e.message;
  }
}

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  buy.disabled = true;
  msg.textContent = "Creando pedido...";
  try {
    const o = await api("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        product_id: $("#product").value,
        player: { player_id: $("#player_id").value.trim(), server: $("#server").value.trim() },
      }),
    });
    msg.textContent = `Pedido creado: ${o.order_id.slice(0, 8)}. Estado: pendiente de pago.`;
  } catch (err) {
    msg.textContent = err.message;
    buy.disabled = false;
  }
});

$("#q").addEventListener("input", (e) => {
  const t = e.target.value.trim().toLowerCase();
  render(games.filter((g) => g.name.toLowerCase().includes(t)));
});

api("/api/games").then((d) => { games = d; render(games); })
  .catch(() => { gamesEl.textContent = "No se pudo cargar el catálogo."; });
