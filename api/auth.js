const L = require('./_lib');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
async function activeSub(uid) {
  const r = await L.sb('tahdeeri_subs?user_id=eq.' + uid + '&ends_at=gt.' + encodeURIComponent(new Date().toISOString()) + '&order=ends_at.desc&limit=1&select=starts_at,ends_at,source');
  return r && r[0] || null;
}
async function profile(u) {
  const sub = await activeSub(u.id);
  const unread = await L.count('tahdeeri_notifs', 'user_id=eq.' + u.id + '&read=eq.false');
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, school: u.school, isAdmin: u.isAdmin, sub, unread };
}
module.exports = async (req, res) => {
  try {
    const a = String((req.query && req.query.a) || '');
    const b = L.body(req);
    if (req.method !== 'POST' && a !== 'me') return L.send(res, 405, { ok: false });
    if (a === 'signup') {
      if (L.limited('su' + L.ip(req), 6, 3600e3)) return L.send(res, 429, { ok: false, error: 'rate' });
      const email = L.clean(b.email, 120).toLowerCase(), pw = String(b.password || '');
      if (!EMAIL.test(email)) return L.send(res, 400, { ok: false, error: 'email' });
      if (pw.length < 8) return L.send(res, 400, { ok: false, error: 'password' });
      const ex = await L.sb('tahdeeri_users?email=eq.' + encodeURIComponent(email) + '&select=id');
      if (ex && ex.length) return L.send(res, 409, { ok: false, error: 'exists' });
      const rows = await L.sb('tahdeeri_users', { method: 'POST', body: { email, name: L.clean(b.name, 80), phone: L.clean(b.phone, 30), school: L.clean(b.school, 120), pass_hash: L.hashPw(pw), last_login: new Date().toISOString() } });
      const u = rows[0]; u.isAdmin = L.ADMINS.includes(email);
      await L.sb('tahdeeri_notifs', { method: 'POST', body: { user_id: u.id, kind: 'welcome', body: 'أهلاً بك في تحضيري. تحضيراتك المحفوظة صارت على حسابك.' } });
      return L.send(res, 200, { ok: true, token: L.sign({ uid: u.id, exp: Date.now() + 30 * 864e5 }), user: await profile(u) });
    }
    if (a === 'login') {
      if (L.limited('li' + L.ip(req), 12, 600e3)) return L.send(res, 429, { ok: false, error: 'rate' });
      const email = L.clean(b.email, 120).toLowerCase();
      const rows = await L.sb('tahdeeri_users?email=eq.' + encodeURIComponent(email) + '&select=*');
      const u = rows && rows[0];
      if (!u || !L.checkPw(String(b.password || ''), u.pass_hash)) return L.send(res, 401, { ok: false, error: 'bad' });
      if (u.status !== 'active') return L.send(res, 403, { ok: false, error: 'disabled' });
      await L.sb('tahdeeri_users?id=eq.' + u.id, { method: 'PATCH', body: { last_login: new Date().toISOString() }, prefer: 'return=minimal' });
      u.isAdmin = L.ADMINS.includes(email);
      return L.send(res, 200, { ok: true, token: L.sign({ uid: u.id, exp: Date.now() + 30 * 864e5 }), user: await profile(u) });
    }
    const u = await L.authUser(req);
    if (!u) return L.send(res, 401, { ok: false, error: 'auth' });
    if (a === 'me') return L.send(res, 200, { ok: true, user: await profile(u) });
    if (a === 'update') {
      await L.sb('tahdeeri_users?id=eq.' + u.id, { method: 'PATCH', prefer: 'return=minimal', body: { name: L.clean(b.name, 80), phone: L.clean(b.phone, 30), school: L.clean(b.school, 120) } });
      const r = await L.sb('tahdeeri_users?id=eq.' + u.id + '&select=id,email,name,phone,school,role,status'); r[0].isAdmin = u.isAdmin;
      return L.send(res, 200, { ok: true, user: await profile(r[0]) });
    }
    if (a === 'password') {
      const rows = await L.sb('tahdeeri_users?id=eq.' + u.id + '&select=pass_hash');
      if (!L.checkPw(String(b.old || ''), rows[0].pass_hash)) return L.send(res, 401, { ok: false, error: 'bad' });
      if (String(b.new || '').length < 8) return L.send(res, 400, { ok: false, error: 'password' });
      await L.sb('tahdeeri_users?id=eq.' + u.id, { method: 'PATCH', prefer: 'return=minimal', body: { pass_hash: L.hashPw(String(b.new)) } });
      return L.send(res, 200, { ok: true });
    }
    if (a === 'delete') {
      const rows = await L.sb('tahdeeri_users?id=eq.' + u.id + '&select=pass_hash');
      if (!L.checkPw(String(b.password || ''), rows[0].pass_hash)) return L.send(res, 401, { ok: false, error: 'bad' });
      await L.sb('tahdeeri_users?id=eq.' + u.id, { method: 'DELETE', prefer: 'return=minimal' });
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { ok: false });
  } catch (e) { return L.send(res, 500, { ok: false, error: 'server' }); }
};
