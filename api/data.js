const L = require('./_lib');
module.exports = async (req, res) => {
  try {
    const u = await L.authUser(req);
    if (!u) return L.send(res, 401, { ok: false, error: 'auth' });
    const a = String((req.query && req.query.a) || ''), b = L.body(req);
    if (a === 'preps') {
      const r = await L.sb('tahdeeri_preps?user_id=eq.' + u.id + '&select=id,name,template,subject,grade,title,fav,updated_at&order=updated_at.desc&limit=200');
      return L.send(res, 200, { ok: true, preps: r });
    }
    if (a === 'prep') {
      const r = await L.sb('tahdeeri_preps?user_id=eq.' + u.id + '&id=eq.' + encodeURIComponent(String(req.query.id || '')) + '&select=*');
      return L.send(res, 200, { ok: true, prep: r && r[0] || null });
    }
    if (req.method !== 'POST') return L.send(res, 405, { ok: false });
    if (a === 'save') {
      const rec = { user_id: u.id, name: L.clean(b.name, 160), template: L.clean(b.template, 30), subject: L.clean(b.subject, 80), grade: L.clean(b.grade, 40), title: L.clean(b.title, 200), html: String(b.html || '').slice(0, 300000), updated_at: new Date().toISOString() };
      if (!rec.html) return L.send(res, 400, { ok: false, error: 'empty' });
      let r;
      if (b.id) r = await L.sb('tahdeeri_preps?user_id=eq.' + u.id + '&id=eq.' + encodeURIComponent(String(b.id)), { method: 'PATCH', body: rec });
      else { if ((await L.count('tahdeeri_preps', 'user_id=eq.' + u.id)) >= 500) return L.send(res, 400, { ok: false, error: 'limit' }); r = await L.sb('tahdeeri_preps', { method: 'POST', body: rec }); }
      await L.sb('tahdeeri_notifs', { method: 'POST', body: { user_id: u.id, kind: 'saved', body: 'تم حفظ التحضير بنجاح: ' + (rec.name || rec.title) }, prefer: 'return=minimal' });
      return L.send(res, 200, { ok: true, id: r && r[0] && r[0].id });
    }
    if (a === 'del') { await L.sb('tahdeeri_preps?user_id=eq.' + u.id + '&id=eq.' + encodeURIComponent(String(b.id || '')), { method: 'DELETE', prefer: 'return=minimal' }); return L.send(res, 200, { ok: true }); }
    if (a === 'fav') { await L.sb('tahdeeri_preps?user_id=eq.' + u.id + '&id=eq.' + encodeURIComponent(String(b.id || '')), { method: 'PATCH', prefer: 'return=minimal', body: { fav: !!b.fav } }); return L.send(res, 200, { ok: true }); }
    if (a === 'kvget') { const r = await L.sb('tahdeeri_kv?user_id=eq.' + u.id + '&select=k,v'); const o = {}; (r || []).forEach(x => o[x.k] = x.v); return L.send(res, 200, { ok: true, kv: o }); }
    if (a === 'kvset') {
      const k = L.clean(b.k, 40); if (!/^(fav|rec)$/.test(k)) return L.send(res, 400, { ok: false });
      await L.sb('tahdeeri_kv?on_conflict=user_id,k', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: u.id, k, v: Array.isArray(b.v) ? b.v.slice(0, 200) : [], updated_at: new Date().toISOString() } });
      return L.send(res, 200, { ok: true });
    }
    if (a === 'notifs') { const r = await L.sb('tahdeeri_notifs?user_id=eq.' + u.id + '&order=created_at.desc&limit=30&select=id,kind,body,read,created_at'); return L.send(res, 200, { ok: true, notifs: r }); }
    if (a === 'readall') { await L.sb('tahdeeri_notifs?user_id=eq.' + u.id + '&read=eq.false', { method: 'PATCH', prefer: 'return=minimal', body: { read: true } }); return L.send(res, 200, { ok: true }); }
    if (a === 'dl') { await L.sb('tahdeeri_downloads', { method: 'POST', prefer: 'return=minimal', body: { user_id: u.id, kind: L.clean(b.kind, 20), title: L.clean(b.title, 200) } }); return L.send(res, 200, { ok: true }); }
    if (a === 'usage') {
      const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
      const used = await L.count('tahdeeri_ai_log', 'user_id=eq.' + u.id + '&day=eq.' + day + '&ok=eq.true');
      const limit = parseInt(await L.setting('ai_daily_limit', '10'), 10);
      const hist = await L.sb('tahdeeri_ai_log?user_id=eq.' + u.id + '&order=created_at.desc&limit=20&select=created_at,subject,title,ok');
      const dls = await L.sb('tahdeeri_downloads?user_id=eq.' + u.id + '&order=created_at.desc&limit=20&select=created_at,kind,title');
      return L.send(res, 200, { ok: true, used, limit, hist, dls });
    }
    return L.send(res, 400, { ok: false });
  } catch (e) { return L.send(res, 500, { ok: false, error: 'server' }); }
};
