const ALLOWED_KEYS = new Set(["manual", "pending", "notes", "audit", "settings", "snapshot"]);

async function ensureDatabase(db) {
  if (!db) throw new Error("D1 binding DB não configurado");
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequestGet(context) {
  try {
    await ensureDatabase(context.env.DB);
    const result = await context.env.DB.prepare(
      "SELECT key, value, updated_at FROM app_state ORDER BY key"
    ).all();

    const state = {
      manual: [],
      pending: [],
      notes: {},
      audit: [],
      settings: {},
      snapshot: {}
    };

    for (const row of result.results || []) {
      if (!ALLOWED_KEYS.has(row.key)) continue;
      try { state[row.key] = JSON.parse(row.value); } catch (_) {}
    }

    return json({ ok: true, state });
  } catch (error) {
    return json({ ok: false, error: error.message || "Erro ao acessar D1" }, 503);
  }
}

export async function onRequestPut(context) {
  try {
    await ensureDatabase(context.env.DB);
    const body = await context.request.json();
    const key = String(body?.key || "");
    if (!ALLOWED_KEYS.has(key)) return json({ ok: false, error: "Chave inválida" }, 400);

    const value = JSON.stringify(body?.value ?? null);
    const updatedAt = new Date().toISOString();

    await context.env.DB.prepare(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind(key, value, updatedAt).run();

    return json({ ok: true, key, updatedAt });
  } catch (error) {
    return json({ ok: false, error: error.message || "Erro ao salvar no D1" }, 503);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Allow": "GET, PUT, OPTIONS" } });
}
