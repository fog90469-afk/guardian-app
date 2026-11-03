const express = require('express');
const router = express.Router();
const VT_KEY = process.env.VT_API_KEY;

router.post('/', async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Нужна ссылка' });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try {
    const b64url = Buffer.from(url).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    let r = await fetch('https://www.virustotal.com/api/v3/urls/' + b64url, { headers: { 'x-apikey': VT_KEY } });
    
    if (r.status === 404) {
      const submit = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: { 'x-apikey': VT_KEY, 'content-type': 'application/x-www-form-urlencoded' },
        body: 'url=' + encodeURIComponent(url)
      });
      const sData = await submit.json();
      const analysisId = sData.data.id;

      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const aRes = await fetch('https://www.virustotal.com/api/v3/analyses/' + analysisId, { headers: { 'x-apikey': VT_KEY } });
        const aData = await aRes.json();
        if (aData.data.attributes.status === 'completed') {
          const stats = aData.data.attributes.stats;
          return res.json({ verdict: stats.malicious > 0 ? 'danger' : 'safe', stats });
        }
      }
      return res.json({ verdict: 'warning', stats: {} });
    }

    const data = await r.json();
    const stats = data.data.attributes.last_analysis_stats;
    return res.json({ verdict: stats.malicious > 0 ? 'danger' : 'safe', stats });
  } catch (e) {
    return res.status(500).json({ error: 'Ошибка VirusTotal' });
  }
});

module.exports = router;