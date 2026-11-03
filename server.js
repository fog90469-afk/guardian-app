require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Безопасность и CORS (разрешаем кастомный заголовок x-user-id)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  exposedHeaders: ['X-Tries-Left'],
  allowedHeaders: ['Content-Type', 'x-user-id']
}));
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

// --- СИСТЕМА ЛИМИТОВ + КУЛДАУН (ТОЛЬКО КОГДА ЛИМИТ ИСЧЕРПАН) ---
const userLimits = new Map();
const FREE_TRIES = 3;
const COOLDOWN_MS = 4 * 60 * 1000; // 4 минуты

function checkLimit(req, res, next) {
  const userKey = req.headers['x-user-id'] || req.ip || 'unknown';
  let user = userLimits.get(userKey);

  if (!user) {
    user = { tries: FREE_TRIES, lastCheck: 0 };
    userLimits.set(userKey, user);
  }

  // ЕСЛИ ПОПЫТКИ ЕСТЬ - ПРОПУСКАЕМ СРАЗУ, БЕЗ КУЛДАУНА
  if (user.tries > 0) {
    user.tries -= 1;
    user.lastCheck = Date.now();
    res.setHeader('X-Tries-Left', user.tries);
    return next();
  }

  // ЕСЛИ ПОПЫТОК НЕТ - ВКЛЮЧАЕМ КУЛДАУН И ПОКАЗЫВАЕМ ОКНО ОПЛАТЫ
  const now = Date.now();
  const timeSinceLast = now - user.lastCheck;

  if (user.lastCheck > 0 && timeSinceLast < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000);
    return res.status(429).json({ 
      error: 'COOLDOWN', 
      waitSec, 
      message: `Подождите ${waitSec} сек. перед следующей проверкой.` 
    });
  }

  // Если кулдаун прошел, но попыток все равно нет - выдаем ошибку лимита (окно оплаты)
  return res.status(403).json({ error: 'LIMIT_REACHED' });
}

// Маршруты
app.use('/api/leaks', checkLimit, require('./routes/leaks'));
app.use('/api/passwords', checkLimit, require('./routes/passwords'));
app.use('/api/urls', checkLimit, require('./routes/urls'));
app.use('/api/files', checkLimit, require('./routes/files'));

// Тестовая кнопка (восстановить лимит)
app.post('/api/cheat-pay', (req, res) => {
  const userKey = req.headers['x-user-id'] || req.ip || 'unknown';
  let user = userLimits.get(userKey);
  if (user) { user.tries += 5; }
  res.json({ ok: true });
});

// CRYSTALPAY
app.post('/api/buy', async (req, res) => {
  try {
    const response = await fetch('https://api.crystalpay.io/v2/invoice/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_login: process.env.CRYSTAL_LOGIN,
        auth_secret: process.env.CRYSTAL_SECRET,
        auth_salt: process.env.CRYSTAL_SALT,
        amount: 249,
        type: 'purchase',
        lifetime: 60,
        order_id: 'order_' + Date.now()
      })
    });

    const data = await response.json();

    if (data.error) {
      console.log("❌ ОШИБКА CRYSTALPAY:", data.error);
      return res.status(500).json({ error: data.error });
    }

    if (data.url) {
      res.json({ url: data.url });
    } else {
      res.status(500).json({ error: 'Неизвестная ошибка' });
    }
  } catch (e) {
    console.log("❌ ОШИБКА СЕТИ:", e);
    res.status(500).json({ error: 'Ошибка сети' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});