const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { query } = req.body;
  
  // ИСПРАВЛЕНО: Проверка типа и длины
  if (typeof query !== 'string' || query.trim().length === 0 || query.length > 100) {
    return res.status(400).json({ error: 'Некорректный запрос (макс 100 символов)' });
  }

  try {
    const r = await fetch('https://leakcheck.io/api/public?check=' + encodeURIComponent(query), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!r.ok) throw new Error(`API вернул статус ${r.status}`);

    let data;
    try {
      data = await r.json();
    } catch (parseError) {
      throw new Error('Некорректный ответ от API (не JSON)');
    }

    if (data && data.success) {
      return res.json({ found: true, count: data.found || 0, sources: data.sources || [], fields: data.fields || [] });
    }
    return res.json({ found: false });
  } catch (e) {
    console.error('LeakCheck Error:', e.message);
    return res.status(500).json({ error: 'Сервис проверки временно недоступен.' });
  }
});
module.exports = router;