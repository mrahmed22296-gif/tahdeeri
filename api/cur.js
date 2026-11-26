const L = require('./_lib');
module.exports = async (req, res) => {
 try {
 const v = await L.setting('curriculum_extra', '[]');
 let entries = []; try { entries = JSON.parse(v); } catch (e) { entries = []; }
 res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
 return res.status(200).json({ ok: true, entries: Array.isArray(entries) ? entries : [] });
 } catch (e) { return L.send(res, 500, { ok: false, error: 'server' }); }
};
