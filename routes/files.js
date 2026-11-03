const express = require('express');
const router = express.Router();
const VT_KEY = process.env.VT_API_KEY;

router.post('/', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Нужен хэш' });

  try {
    const r = await fetch('https://www.virustotal.com/api/v3/files/' + hash, { headers: { 'x-apikey': VT_KEY } });
    if (r.status === 404) return res.json({ status: 'not_found' });
    
    const data = await r.json();
    const stats = data.data.attributes.last_analysis_stats;
    return res.json({ status: 'completed', verdict: stats.malicious > 0 ? 'danger' : 'safe', stats });
  } catch (e) {
    return res.status(500).json({ error: 'Ошибка VirusTotal' });
  }
});

module.exports = router;