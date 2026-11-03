require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- СИСТЕМА ЛИМИТОВ + 4-МИНУТНЫЙ КУЛДАУН ---
const userLimits = new Map();
const FREE_TRIES = 3;
const COOLDOWN_MS = 4 * 60 * 1000; // 4 минуты (для теста можешь поставить 10 * 1000)

function checkLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  let user = userLimits.get(ip);

  if (!user) {
    user = { tries: FREE_TRIES, lastCheck: 0 };
    userLimits.set(ip, user);
  }

  const now = Date.now();
  const timeSinceLast = now - user.lastCheck;

  // Проверка кулдауна
  if (user.lastCheck > 0 && timeSinceLast < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000);
    return res.status(429).json({ 
      error: 'COOLDOWN', 
      waitSec, 
      message: `Подождите ${waitSec} сек. перед следующей проверкой.` 
    });
  }

  // Проверка лимита
  if (user.tries <= 0) {
    return res.status(403).json({ error: 'LIMIT_REACHED' });
  }

  user.tries -= 1;
  user.lastCheck = now;
  
  res.setHeader('X-Tries-Left', user.tries);
  next();
}

// Маршруты
app.use('/api/leaks', checkLimit, require('./routes/leaks'));
app.use('/api/passwords', checkLimit, require('./routes/passwords'));
app.use('/api/urls', checkLimit, require('./routes/urls'));
app.use('/api/files', checkLimit, require('./routes/files'));

// Тестовая кнопка
app.post('/api/cheat-pay', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  let user = userLimits.get(ip);
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