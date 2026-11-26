const L = require('./_lib');
module.exports = async (req, res) => {
 try {
 const u = await L.authUser(req);
 if (!u || !u.isAdmin) return L.send(res, 403, { ok: false, error: 'admin' });
 const read = async () => { try { const a = JSON.parse(await L.setting('curriculum_extra', '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
 if (req.method !== 'POST') return L.send(res, 200, { ok: true, entries: await read() });
 const b = L.body(req);
 const save = async (arr) => { const s = JSON.stringify(arr); if (s.length > 300000) throw new Error('big'); await L.sb('tahdeeri_settings?on_conflict=k', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { k: 'curriculum_extra', v: s } }); };
 const arr = await read();
 if (b.op === 'set') {
 const grade = parseInt(b.grade, 10), subject = L.clean(b.subject, 80), unit = L.clean(b.unit, 160);
 const titles = (Array.isArray(b.titles) ? b.titles : []).map(t => L.clean(t, 200)).filter(Boolean).slice(0, 200);
 if (!(grade >= 1 && grade <= 12) || !subject || !unit) return L.send(res, 400, { ok: false, error: 'bad' });
 let e = arr.find(x => x.grade === grade && x.subject === subject);
 if (!e) { e = { grade, g: L.clean(b.g, 40), template: b.template === 'psych' ? 'psych' : 'social', subject, units: {} }; arr.push(e); }
 if (b.g) e.g = L.clean(b.g, 40);
 if (b.template) e.template = b.template === 'psych' ? 'psych' : 'social';
 if (titles.length) e.units[unit] = titles; else delete e.units[unit];
 const out = arr.filter(x => Object.keys(x.units).length);
 await save(out);
 return L.send(res, 200, { ok: true, entries: out });
 }
 return L.send(res, 400, { ok: false });
 } catch (e) { return L.send(res, 500, { ok: false, error: 'server' }); }
};
