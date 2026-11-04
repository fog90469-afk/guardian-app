const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Введите данные' });

  try {
    // ИСПРАВЛЕНО: Добавлен таймаут 5 секунд и проверка r.ok
    const r = await fetch('https://leakcheck.io/api/public?check=' + encodeURIComponent(query), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000) // Если API не ответит за 5 сек, выкинет ошибку
    });
    
    if (!r.ok) {
      throw new Error(`API вернул статус ${r.status}`);
    }

    const data = await r.json().catch(() => ({}));

    if (data && data.success) {
      return res.json({ found: true, count: data.found || 0, sources: data.sources || [], fields: data.fields || [] });
    }
    return res.json({ found: false });
  } catch (e) {
    console.error('LeakCheck Error:', e.message);
    return res.status(500).json({ error: 'Сервис проверки временно недоступен. Попробуйте позже.' });
  }
});
module.exports = router;