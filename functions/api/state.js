const ALLOWED_KEYS = new Set(["manual", "pending", "notes", "clientNotes", "audit", "settings", "snapshot"]);

const PROFILES = {
  ana: {
    profile: "ana",
    profileName: "Ana",
    sellerName: "Ana",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1EdkihhLcVQiUlJMb54RknQTHzq6RyqNhNzONvzBbTpM",
    sheetName: "VENDA DO MÊS"
  },
  dayane: {
    profile: "dayane",
    profileName: "Dayane",
    sellerName: "Dayane",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1yuR43gP2_kPMZpySYeiyJIJXRwGchvosa31fhigVoMw",
    sheetName: "VENNDA DO MÊS"
  }
};

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

function validWriteOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value ?? "") ?? fallback; }
  catch (_) { return fallback; }
}

async function toggleProfile(db, body) {
  if (String(body?.password || "") !== "121225") {
    return json({ ok: false, error: "Senha administrativa inválida" }, 401);
  }

  const settingsRow = await db.prepare("SELECT value FROM app_state WHERE key='settings'").first();
  const currentSettings = parseJson(settingsRow?.value, {});
  const currentKey = currentSettings.profile === "dayane" ? "dayane" : "ana";
  const next = currentKey === "ana" ? PROFILES.dayane : PROFILES.ana;
  const settings = { ...currentSettings, ...next };
  const now = new Date().toISOString();

  const auditRow = await db.prepare("SELECT value FROM app_state WHERE key='audit'").first();
  let audit = parseJson(auditRow?.value, []);
  if (!Array.isArray(audit)) audit = [];
  audit.unshift({
    time: now,
    type: "manual",
    source: "system",
    msg: `Perfil administrativo alterado de ${currentKey === "ana" ? "Ana" : "Dayane"} para ${next.profileName}.`
  });
  audit = audit.slice(0, 2000);

  await db.batch([
    db.prepare(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES ('settings', ?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(JSON.stringify(settings), now),
    db.prepare(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES ('snapshot', ?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(JSON.stringify({}), now),
    db.prepare(`
      INSERT INTO app_state (key, value, updated_at)
      VALUES ('audit', ?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(JSON.stringify(audit), now)
  ]);

  return json({
    ok: true,
    action: "toggleProfile",
    profile: next.profile,
    profileName: next.profileName,
    sellerName: next.sellerName,
    settings,
    updatedAt: now
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
      clientNotes: {},
      audit: [],
      settings: {},
      snapshot: {}
    };

    for (const row of result.results || []) {
      if (!ALLOWED_KEYS.has(row.key)) continue;
      state[row.key] = parseJson(row.value, state[row.key]);
    }

    return json({ ok: true, state });
  } catch (error) {
    return json({ ok: false, error: error.message || "Erro ao acessar D1" }, 503);
  }
}

export async function onRequestPut(context) {
  try {
    if (!validWriteOrigin(context.request)) return json({ ok: false, error: "Origem não permitida" }, 403);
    await ensureDatabase(context.env.DB);
    const body = await context.request.json();

    if (body?.action === "toggleProfile") {
      return await toggleProfile(context.env.DB, body);
    }

    const key = String(body?.key || "");
    if (!ALLOWED_KEYS.has(key)) return json({ ok: false, error: "Chave inválida" }, 400);

    const value = JSON.stringify(body?.value ?? null);
    if (value.length > 2_000_000) return json({ ok: false, error: "Payload muito grande" }, 413);
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
