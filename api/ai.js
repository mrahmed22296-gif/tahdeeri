const L = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false });
  try {
    const u = await L.authUser(req);
    if (!u) return L.send(res, 401, { ok: false, error: 'auth' });
    const b = L.body(req);
    const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    const limit = parseInt(await L.setting('ai_daily_limit', '10'), 10);
    const used = await L.count('tahdeeri_ai_log', 'user_id=eq.' + u.id + '&day=eq.' + day + '&ok=eq.true');
    if (used >= limit) return L.send(res, 200, { ok: false, error: 'rate', used, limit });
    if (L.limited('ai' + u.id, 6, 60e3)) return L.send(res, 429, { ok: false, error: 'rate' });
    const payload = { site: 'tahdeeri', code: L.clean(b.code, 80), title: L.clean(b.title, 300), template: L.clean(b.template, 20), grade: L.clean(b.grade, 60), source: String(b.source || '').slice(0, 20000) };
    let data = null;
    try {
      const r = await fetch('https://mohasaba-online.vercel.app/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      data = await r.json();
    } catch (e) { data = null; }
    const ok = !!(data && data.ok && data.lesson);
    if (ok || (data && data.error !== 'code' && data.error !== 'title' && data.error !== 'rate')) {
      await L.sb('tahdeeri_ai_log', { method: 'POST', prefer: 'return=minimal', body: { user_id: u.id, day, ok, subject: L.clean(b.subject, 80), title: payload.title, error: ok ? null : L.clean(data && data.error || 'net', 40) } });
    }
    if (!data) return L.send(res, 502, { ok: false, error: 'net' });
    if (ok) data.used = used + 1; data.limit = limit;
    return L.send(res, 200, data);
  } catch (e) { return L.send(res, 500, { ok: false, error: 'server' }); }
};
