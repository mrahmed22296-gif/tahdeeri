const crypto = require('crypto');
const URL_ = process.env.TD_SUPA_URL, KEY = process.env.TD_SUPA_KEY, SECRET = process.env.TD_SESSION_SECRET || '';
const ADMINS = (process.env.TD_ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + path, {
    method,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) { const err = new Error('db'); err.detail = j; err.status = r.status; throw err; }
  return j;
}
async function count(table, filter) {
  const r = await fetch(URL_ + '/rest/v1/' + table + '?select=id' + (filter ? '&' + filter : ''), {
    method: 'HEAD', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'count=exact', Range: '0-0' }
  });
  const cr = r.headers.get('content-range') || '';
  return parseInt(cr.split('/')[1], 10) || 0;
}
function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32);
  return 's1$' + salt.toString('hex') + '$' + h.toString('hex');
}
function checkPw(pw, stored) {
  try {
    const [v, s, h] = stored.split('$');
    const x = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 32);
    return crypto.timingSafeEqual(x, Buffer.from(h, 'hex'));
  } catch (e) { return false; }
}
function b64(s) { return Buffer.from(s).toString('base64url'); }
function sign(payload) {
  const p = b64(JSON.stringify(payload));
  const m = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  return p + '.' + m;
}
function verify(tok) {
  try {
    const [p, m] = String(tok).split('.');
    const e = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
    if (m.length !== e.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(e))) return null;
    const o = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!o.exp || o.exp < Date.now()) return null;
    return o;
  } catch (e) { return null; }
}
function send(res, code, obj) { res.status(code).setHeader('Cache-Control', 'no-store'); res.json(obj); }
async function authUser(req) {
  const h = req.headers.authorization || '';
  const o = verify(h.replace(/^Bearer /, ''));
  if (!o) return null;
  const rows = await sb('tahdeeri_users?id=eq.' + encodeURIComponent(o.uid) + '&select=id,email,name,phone,school,role,status,created_at');
  const u = rows && rows[0];
  if (!u || u.status !== 'active') return null;
  u.isAdmin = ADMINS.includes(String(u.email).toLowerCase());
  return u;
}
const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(); const b = (buckets.get(key) || []).filter(t => now - t < windowMs);
  b.push(now); buckets.set(key, b); return b.length > max;
}
function ip(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x'; }
async function setting(k, d) { try { const r = await sb('tahdeeri_settings?k=eq.' + k + '&select=v'); return r && r[0] ? r[0].v : d; } catch (e) { return d; } }
function body(req) { return (req.body && typeof req.body === 'object') ? req.body : {}; }
const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n || 200);
module.exports = { sb, count, hashPw, checkPw, sign, verify, send, authUser, limited, ip, setting, body, clean, ADMINS };
