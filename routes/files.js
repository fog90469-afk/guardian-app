const express = require('express');
const router = express.Router();
const VT_KEY = process.env.VT_API_KEY;

router.post('/', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Нужен хэш' });

  try {
    const r = await fetch('https://www.virustotal.com/api/v3/files/' + hash, { 
      headers: { 'x-apikey': VT_KEY },
      signal: AbortSignal.timeout(10000)
    });
    if (r.status === 404) return res.json({ status: 'not_found' });
    if (!r.ok) throw new Error(`VT статус ${r.status}`);
    
    const data = await r.json();
    const stats = data.data.attributes.last_analysis_stats;
    return res.json({ status: 'completed', verdict: stats.malicious > 0 ? 'danger' : 'safe', stats });
  } catch (e) {
    console.error('VT File Error:', e.message);
    return res.status(500).json({ error: 'Ошибка проверки файла. Попробуйте позже.' });
  }
});
module.exports = router;