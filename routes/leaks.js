const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Введите данные' });

  try {
    const r = await fetch('https://leakcheck.io/api/public?check=' + encodeURIComponent(query), {
      headers: { accept: 'application/json' }
    });
    const data = await r.json().catch(() => ({}));

    if (data && data.success) {
      return res.json({ found: true, count: data.found || 0, sources: data.sources || [], fields: data.fields || [] });
    }
    return res.json({ found: false });
  } catch (e) {
    return res.status(500).json({ error: 'Ошибка API' });
  }
});

module.exports = router;