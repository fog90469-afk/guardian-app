const express = require('express');
const router = express.Router();

const SITES = [
  { name: 'GitHub', url: 'https://github.com/' },
  { name: 'Instagram', url: 'https://www.instagram.com/' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@' },
  { name: 'Steam', url: 'https://steamcommunity.com/id/' },
  { name: 'Reddit', url: 'https://www.reddit.com/user/' },
  { name: 'Twitter (X)', url: 'https://twitter.com/' },
  { name: 'YouTube', url: 'https://www.youtube.com/@' },
  { name: 'Pinterest', url: 'https://www.pinterest.com/' },
  { name: 'Twitch', url: 'https://www.twitch.tv/' },
  { name: 'Roblox', url: 'https://www.roblox.com/user.aspx?username=' },
  { name: 'Telegram', url: 'https://t.me/' },
  { name: 'VK', url: 'https://vk.com/' },
  { name: 'Facebook', url: 'https://www.facebook.com/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/' },
  { name: 'Medium', url: 'https://medium.com/@' },
  { name: 'Flickr', url: 'https://www.flickr.com/people/' },
  { name: 'SoundCloud', url: 'https://soundcloud.com/' },
  { name: 'Spotify', url: 'https://open.spotify.com/user/' },
  { name: 'Behance', url: 'https://www.behance.net/' },
  { name: 'Dribbble', url: 'https://dribbble.com/' }
];

router.post('/', async (req, res) => {
  const { username } = req.body;
  if (typeof username !== 'string' || username.length < 2 || username.length > 30) {
    return res.status(400).json({ error: 'Некорректный никнейм' });
  }
  const cleanUsername = username.replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleanUsername) return res.status(400).json({ error: 'Ник должен содержать буквы или цифры' });

  const checkPromises = SITES.map(async (site) => {
    try {
      const url = site.url + cleanUsername;
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (response.ok || response.status === 403) {
        return { site: site.name, url: url, found: true };
      }
    } catch (e) {}
    return { site: site.name, url: site.url + cleanUsername, found: false };
  });

  try {
    const results = await Promise.all(checkPromises);
    const foundSites = results.filter(r => r.found);
    res.json({ username: cleanUsername, totalSites: SITES.length, foundCount: foundSites.length, sites: foundSites });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сканирования' });
  }
});
module.exports = router;