const express = require('express');
const crypto = require('crypto');
const router = express.Router();

router.post('/', async (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string' || password.length === 0 || password.length > 100) {
    return res.status(400).json({ error: 'Некорректный пароль' });
  }

  try {
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const r = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) throw new Error(`HIBP статус ${r.status}`);

    const text = await r.text();
    let count = 0;
    for (const line of text.split('\n')) {
      const [sfx, cnt] = line.trim().split(':');
      if (sfx === suffix) { count = parseInt(cnt, 10) || 0; break; }
    }
    return res.json({ count });
  } catch (e) {
    return res.status(500).json({ error: 'Сервис проверки паролей недоступен' });
  }
});
module.exports = router;