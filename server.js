require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ИСПРАВЛЕНИЕ 1: Включаем строгий CSP (Content Security Policy)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], 
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// ИСПРАВЛЕНИЕ 2: Закрываем CORS для посторонних доменов
app.use(cors({
  origin: 'https://guardian-app-3sy1.onrender.com',
  exposedHeaders: ['X-Tries-Left'],
  allowedHeaders: ['Content-Type', 'x-user-id']
}));

app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

// --- СИСТЕМА ЛИМИТОВ ---
const userLimits = new Map();
const FREE_TRIES = 3;

function checkLimit(req, res, next) {
  const userKey = req.headers['x-user-id'] || req.ip || 'unknown';
  let user = userLimits.get(userKey);

  if (!user) {
    user = { tries: FREE_TRIES };
    userLimits.set(userKey, user);
  }

  if (user.tries <= 0) {
    return res.status(403).json({ error: 'LIMIT_REACHED' });
  }

  user.tries -= 1;
  res.setHeader('X-Tries-Left', user.tries);
  next();
}

// Маршруты
app.use('/api/leaks', checkLimit, require('./routes/leaks'));
app.use('/api/passwords', checkLimit, require('./routes/passwords'));
app.use('/api/urls', checkLimit, require('./routes/urls'));
app.use('/api/files', checkLimit, require('./routes/files'));

// --- CRYSTALPAY ---
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
      })
    });
    const data = await response.json();
    if (data.url) return res.json({ url: data.url });
    if (data.errors && data.errors.length > 0) return res.status(500).json({ error: data.errors.join(', ') });
    return res.status(500).json({ error: 'Платежная система не вернула ссылку' });
  } catch (e) {
    console.error('Ошибка сети при оплате:', e);
    res.status(500).json({ error: 'Ошибка сети' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен в безопасном режиме: http://localhost:${PORT}`);
});