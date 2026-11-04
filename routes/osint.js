const express = require('express');
const router = express.Router();

// Сайты, которые нормально отвечают на запросы с сервера
const SITES = [
  { name: 'GitHub', url: 'https://github.com/' },
  { name: 'Steam', url: 'https://steamcommunity.com/id/' },
  { name: 'Reddit', url: 'https://www.reddit.com/user/' },
  { name: 'Telegram', url: 'https://t.me/' },
  { name: 'VK', url: 'https://vk.com/' },
  { name: 'Roblox', url: 'https://www.roblox.com/user.aspx?username=' },
  { name: 'SoundCloud', url: 'https://soundcloud.com/' },
  { name: 'Medium', url: 'https://medium.com/@' },
  { name: 'Behance', url: 'https://www.behance.net/' },
  { name: 'Dribbble', url: 'https://dribbble.com/' },
  { name: 'Twitch', url: 'https://www.twitch.tv/' }
];

router.post('/', async (req, res) => {
  const { username } = req.body;
  if (typeof username !== 'string' || username.length < 2 || username.length > 30) {
    return res.status(400).json({ error: 'Некорректный никнейм' });
  }
  
  // Очищаем ник от спецсимволов
  const cleanUsername = username.replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleanUsername) return res.status(400).json({ error: 'Ник должен содержать буквы или цифры' });

  const checkPromises = SITES.map(async (site) => {
    try {
      const url = site.url + cleanUsername;
      // Используем GET с User-Agent, чтобы сайты думали, что мы браузер
      const response = await fetch(url, { 
        method: 'GET',
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      
      // Если 200 (ОК) или 403 (страница есть, но закрыта) — ник занят
      if (response.status === 200 || response.status === 403) {
        return { site: site.name, url: url, found: true };
      }
    } catch (e) {
      // Если таймаут или ошибка сети — пропускаем
    }
    return { site: site.name, url: site.url + cleanUsername, found: false };
  });

  try {
    const results = await Promise.all(checkPromises);
    const foundSites = results.filter(r => r.found);
    
    res.json({ 
      username: cleanUsername, 
      totalSites: SITES.length, 
      foundCount: foundSites.length, 
      sites: foundSites 
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сканирования' });
  }
});
module.exports = router;