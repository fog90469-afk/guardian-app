require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto'); // Для подписи ID

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// УБРАН unsafe-inline
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], 
      styleSrc: ["'self'", "https://fonts.googleapis.com"], // Инлайн стили оставили (в index.html их много, но это не так критично для XSS, как скрипты)
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"], 
      baseUri: ["'self'"],   
      frameAncestors: ["'none'"], 
    },
  },
}));

app.use(cors({
  origin: ['https://guardian-app-3sy1.onrender.com', 'https://guardian-app-r3y1.onrender.com'],
  exposedHeaders: ['X-Tries-Left', 'X-User-Token'],
  allowedHeaders: ['Content-Type', 'x-user-id', 'x-user-token']
}));

app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

const payLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
app.use('/api/buy', payLimiter);

app.use(express.static(path.resolve(process.cwd(), 'public')));

// --- СИСТЕМА ЛИМИТОВ (LRU-КЭШ + ПОДПИСЬ) ---
const userLimits = new Map();
const FREE_TRIES = 3;
const MAX_USERS_IN_MAP = 50000;
const SECRET_KEY = process.env.SECRET_KEY || 'super_secret_guardian_key_123'; // Лучше вынести в .env!

function checkLimit(req, res, next) {
  const userKey = req.headers['x-user-id'] || req.ip || 'unknown';
  const userToken = req.headers['x-user-token'];

  // Защита от подделки: если у пользователя есть ID, но нет правильной подписи - отказ
  if (userKey !== 'unknown' && userKey !== req.ip) {
    const expectedToken = crypto.createHmac('sha256', SECRET_KEY).update(userKey).digest('hex');
    if (userToken !== expectedToken) {
      return res.status(403).json({ error: 'Недействительный токен пользователя' });
    }
  }

  if (userLimits.size >= MAX_USERS_IN_MAP && !userLimits.has(userKey)) {
    const oldestKey = userLimits.keys().next().value;
    userLimits.delete(oldestKey);
  }

  let user = userLimits.get(userKey);
  if (!user) { 
    user = { tries: FREE_TRIES, lastActive: Date.now() }; 
    userLimits.set(userKey, user); 
  } else {
    // LRU-ЛОГИКА: Обновляем позицию в Map
    userLimits.delete(userKey);
    userLimits.set(userKey, user);
  }

  if (user.tries <= 0) { return res.status(403).json({ error: 'LIMIT_REACHED' }); }
  user.tries -= 1;
  user.lastActive = Date.now();
  res.setHeader('X-Tries-Left', user.tries);
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, user] of userLimits.entries()) {
    if (now - user.lastActive > 24 * 60 * 60 * 1000) { userLimits.delete(key); }
  }
}, 60 * 60 * 1000);

app.use('/api/leaks', checkLimit, require('./routes/leaks'));
app.use('/api/passwords', checkLimit, require('./routes/passwords'));
app.use('/api/urls', checkLimit, require('./routes/urls'));
app.use('/api/files', checkLimit, require('./routes/files'));

// ГЕНЕРАЦИЯ ТОКЕНА ДЛЯ КЛИЕНТА
app.get('/api/get-token', (req, res) => {
  const userId = req.query.id || req.ip;
  const token = crypto.createHmac('sha256', SECRET_KEY).update(userId).digest('hex');
  res.json({ id: userId, token });
});

// --- WEBHOOK ДЛЯ LAVA.RU (ЗАГОТОВКА) ---
// Когда Lava одобрит, мы сюда добавим проверку подписи
app.post('/api/lava-webhook', (req, res) => {
  console.log('Получен вебхук от Lava:', req.body);
  // TODO: Проверить подпись, сумму, статус и начислить запросы
  res.status(200).send('OK');
});

app.post('/api/buy', async (req, res) => {
  try {
    const response = await fetch('https://api.crystalpay.io/v2/invoice/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_login: process.env.CRYSTAL_LOGIN,
        auth_secret: process.env.CRYSTAL_SECRET,
        amount: 249,
        type: 'purchase',
        lifetime: 60,
        description: 'Покупка 5 проверок в Guardian'
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`CrystalPay HTTP ${response.status}`);
    const data = await response.json();
    if (data.url) return res.json({ url: data.url });
    return res.status(500).json({ error: 'Платежная система не вернула ссылку' });
  } catch (e) {
    console.error('Ошибка оплаты:', e.message);
    res.status(500).json({ error: 'Ошибка сети' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});