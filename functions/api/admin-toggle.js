async function ensureDatabase(db) {
  if (!db) throw new Error('D1 binding DB não configurado');
  await db.prepare(`CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function validOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

const PROFILES = {
  ana: {
    profile: 'ana',
    profileName: 'Ana',
    sellerName: 'Ana',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1EdkihhLcVQiUlJMb54RknQTHzq6RyqNhNzONvzBbTpM',
    sheetName: 'VENDA DO MÊS'
  },
  dayane: {
    profile: 'dayane',
    profileName: 'Dayane',
    sellerName: 'Dayane',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1yuR43gP2_kPMZpySYeiyJIJXRwGchvosa31fhigVoMw',
    sheetName: 'VENNDA DO MÊS'
  }
};

export async function onRequestPost({ request, env }) {
  try {
    if (!validOrigin(request)) return json({ ok: false, error: 'Origem não permitida' }, 403);
    await ensureDatabase(env.DB);

    const body = await request.json();
    if (String(body?.password || '') !== '121225') {
      return json({ ok: false, error: 'Senha administrativa inválida' }, 401);
    }

    const row = await env.DB.prepare("SELECT value FROM app_state WHERE key='settings'").first();
    let settings = {};
    try { settings = JSON.parse(row?.value || '{}') || {}; } catch (_) {}

    const current = settings.profile === 'dayane' ? 'dayane' : 'ana';
    const next = current === 'ana' ? PROFILES.dayane : PROFILES.ana;
    const updated = { ...settings, ...next };
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO app_state(key, value, updated_at)
      VALUES('settings', ?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).bind(JSON.stringify(updated), now).run();

    return json({ ok: true, profile: next.profile, profileName: next.profileName, sellerName: next.sellerName, settings: updated, updatedAt: now });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Erro ao alternar perfil' }, 503);
  }
}
