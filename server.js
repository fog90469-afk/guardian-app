require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
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

app.use('/api/leaks', checkLimit, require('./routes/leaks'));
app.use('/api/passwords', checkLimit, require('./routes/passwords'));
app.use('/api/urls', checkLimit, require('./routes/urls'));
app.use('/api/files', checkLimit, require('./routes/files'));

// --- CRYSTALPAY (ИСПРАВЛЕНО) ---
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
    console.log('Ответ от CrystalPay:', data); // Пригодится для отладки

    // Если пришла ссылка на оплату
    if (data.url) {
      return res.json({ url: data.url });
    } 
    
    // Если пришла ошибка, отдаем её текст на клиент
    if (data.errors && data.errors.length > 0) {
      return res.status(500).json({ error: data.errors.join(', ') });
    }

    // Если ничего не подошло
    return res.status(500).json({ error: 'Платежная система не вернула ссылку на оплату' });

  } catch (e) {
    console.error('Ошибка сети при оплате:', e);
    res.status(500).json({ error: 'Ошибка сети' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});