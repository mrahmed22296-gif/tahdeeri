const L = require('./_lib');
module.exports = async (req, res) => {
  try {
    const u = await L.authUser(req);
    if (!u || !u.isAdmin) return L.send(res, 403, { ok: false, error: 'admin' });
    const a = String((req.query && req.query.a) || ''), b = L.body(req);
    if (a === 'stats') {
      const now = new Date(), since7 = new Date(now - 7 * 864e5).toISOString(), since30 = new Date(now - 30 * 864e5).toISOString();
      const [users, active7, preps, gens, gensOk, subs, dls] = await Promise.all([
        L.count('tahdeeri_users'), L.count('tahdeeri_users', 'last_login=gt.' + encodeURIComponent(since7)), L.count('tahdeeri_preps'),
        L.count('tahdeeri_ai_log'), L.count('tahdeeri_ai_log', 'ok=eq.true'), L.count('tahdeeri_subs', 'ends_at=gt.' + encodeURIComponent(now.toISOString())), L.count('tahdeeri_downloads')]);
      const bySub = await L.sb('tahdeeri_preps?select=subject&limit=5000'), byGr = await L.sb('tahdeeri_preps?select=grade&limit=5000');
      const tally = (rows, k) => { const m = {}; (rows || []).forEach(r => { const x = r[k] || 'غير محدد'; m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((p, q) => q[1] - p[1]).slice(0, 8); };
      const errs = await L.sb('tahdeeri_ai_log?ok=eq.false&order=created_at.desc&limit=10&select=created_at,error,title');
      return L.send(res, 200, { ok: true, users, active7, preps, gens, gensOk, genFail: gens - gensOk, subs, dls, topSubjects: tally(bySub, 'subject'), topGrades: tally(byGr, 'grade'), errs, limit: parseInt(await L.setting('ai_daily_limit', '10'), 10) });
    }
    if (a === 'users') {
      const r = await L.sb('tahdeeri_users?select=id,email,name,phone,school,status,created_at,last_login&order=created_at.desc&limit=300');
      const subs = await L.sb('tahdeeri_subs?select=user_id,ends_at&ends_at=gt.' + encodeURIComponent(new Date().toISOString()));
      const m = {}; (subs || []).forEach(s => { if (!m[s.user_id] || s.ends_at > m[s.user_id]) m[s.user_id] = s.ends_at; });
      return L.send(res, 200, { ok: true, users: r.map(x => Object.assign(x, { sub_ends: m[x.id] || null })) });
    }
    if (req.method !== 'POST') return L.send(res, 405, { ok: false });
    if (a === 'status') { await L.sb('tahdeeri_users?id=eq.' + encodeURIComponent(String(b.id)), { method: 'PATCH', prefer: 'return=minimal', body: { status: b.status === 'disabled' ? 'disabled' : 'active' } }); return L.send(res, 200, { ok: true }); }
    if (a === 'grant') {
      const days = Math.max(1, Math.min(366, parseInt(b.days, 10) || 30));
      const cur = await L.sb('tahdeeri_subs?user_id=eq.' + encodeURIComponent(String(b.id)) + '&order=ends_at.desc&limit=1&select=ends_at');
      const base = cur && cur[0] && new Date(cur[0].ends_at) > new Date() ? new Date(cur[0].ends_at) : new Date();
      const ends = new Date(base.getTime() + days * 864e5).toISOString();
      await L.sb('tahdeeri_subs', { method: 'POST', prefer: 'return=minimal', body: { user_id: b.id, starts_at: new Date().toISOString(), ends_at: ends, source: 'admin' } });
      await L.sb('tahdeeri_notifs', { method: 'POST', prefer: 'return=minimal', body: { user_id: b.id, kind: 'sub', body: 'تم تفعيل اشتراكك حتى ' + ends.slice(0, 10) } });
      return L.send(res, 200, { ok: true, ends });
    }
    if (a === 'revoke') { await L.sb('tahdeeri_subs?user_id=eq.' + encodeURIComponent(String(b.id)) + '&ends_at=gt.' + encodeURIComponent(new Date().toISOString()), { method: 'PATCH', prefer: 'return=minimal', body: { ends_at: new Date().toISOString() } }); return L.send(res, 200, { ok: true }); }
    if (a === 'setlimit') { const n = Math.max(0, Math.min(500, parseInt(b.limit, 10) || 0)); await L.sb('tahdeeri_settings?on_conflict=k', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { k: 'ai_daily_limit', v: String(n) } }); return L.send(res, 200, { ok: true, limit: n }); }
    return L.send(res, 400, { ok: false });
  } catch (e) { return L.send(res, 500, { ok: false, error: 'server' }); }
};
