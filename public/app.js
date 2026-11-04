
const $ = s => document.querySelector(s);
if (!localStorage.getItem('guardian_uid')) { localStorage.setItem('guardian_uid', 'user_' + Math.random().toString(36).substr(2, 9)); }
const USER_ID = localStorage.getItem('guardian_uid');
const busy = { email: false, pass: false, url: false, phone: false, file: false, scam: false, detox: false };

// ИСПРАВЛЕНИЕ 3: Функция для экранирования HTML-тегов (защита от XSS)
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function runProgress(prefix, duration) {
  return new Promise((resolve) => {
    const container = $(`#${prefix}-progress`); const fill = $(`#${prefix}-progress-fill`);
    const percent = $(`#${prefix}-progress-percent`); const text = $(`#${prefix}-progress-text`);
    if (!container) return resolve(() => {});
    container.classList.add('active'); fill.style.width = '0%'; percent.innerText = '0%'; text.innerText = 'Анализ...';
    let width = 0;
    const interval = setInterval(() => { width += 5; if (width > 90) width = 90; fill.style.width = width + '%'; percent.innerText = width + '%'; }, duration / 20);
    resolve(() => { clearInterval(interval); fill.style.width = '100%'; percent.innerText = '100%'; text.innerText = 'Готово!'; setTimeout(() => { container.classList.remove('active'); }, 300); });
  });
}

function lockButton(btn, isBusy) {
  if (isBusy) { btn.classList.add('busy'); btn.disabled = true; btn.dataset.originalText = btn.innerText; btn.innerText = '⏳ Обработка...'; } 
  else { if (btn.dataset.cooldownActive) return; btn.classList.remove('busy'); btn.disabled = false; btn.innerText = btn.dataset.originalText || btn.innerText; }
}

async function safeFetch(url, options, btn) {
  options.headers = { ...options.headers, 'x-user-id': USER_ID };
  const r = await fetch(url, options);
  const triesLeft = r.headers.get('X-Tries-Left');
  if (triesLeft !== null) $('#tries-counter').innerText = `Осталось проверок: ${triesLeft}`;
  if (r.status === 403) { $('#paywall-modal').style.display = 'flex'; throw new Error('LIMIT'); }
  if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Ошибка сервера'); }
  return await r.json();
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); $('#panel-' + t.dataset.tab).classList.add('active');
  });
});

async function buyChecks() {
  try {
    const res = await fetch('/api/buy', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else if (data.error) alert('Ошибка оплаты: ' + data.error);
    else alert('Ошибка: Сервер не вернул ссылку на оплату.');
  } catch (e) { alert('Сервер не отвечает.'); }
}

$('#email-btn').addEventListener('click', async () => {
  if (busy.email) return; const q = $('#email-input').value.trim(); if (!q) return;
  busy.email = true; lockButton($('#email-btn'), true); const b = $('#email-result'); const finish = await runProgress('email', 1000);
  try {
    const d = await safeFetch('/api/leaks', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: q }) }, $('#email-btn'));
    b.className = 'result-box show ' + (d.found ? 'danger' : 'safe'); 
    b.textContent = d.found ? `🚨 Найдено в ${d.count} утечках!` : `✅ Утечек не найдено.`;
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.email = false; lockButton($('#email-btn'), false); }
});

$('#pass-btn').addEventListener('click', async () => {
  if (busy.pass) return; const p = $('#pass-input').value; if (!p) return;
  busy.pass = true; lockButton($('#pass-btn'), true); const b = $('#pass-result'); const finish = await runProgress('pass', 800);
  try {
    const d = await safeFetch('/api/passwords', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ password: p }) }, $('#pass-btn'));
    b.className = 'result-box show ' + (d.count > 0 ? 'danger' : 'safe'); 
    b.textContent = d.count > 0 ? `🚨 Пароль слит ${d.count} раз!` : `✅ Пароль надежен.`;
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.pass = false; lockButton($('#pass-btn'), false); }
});

$('#url-btn').addEventListener('click', async () => {
  if (busy.url) return; const u = $('#url-input').value.trim(); if (!u) return;
  busy.url = true; lockButton($('#url-btn'), true); const b = $('#url-result'); const finish = await runProgress('url', 2000);
  try {
    const d = await safeFetch('/api/urls', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ url: u }) }, $('#url-btn'));
    b.className = 'result-box show ' + (d.verdict === 'danger' ? 'danger' : 'safe'); 
    b.textContent = d.verdict === 'danger' ? `🚨 ОПАСНАЯ ССЫЛКА!` : `✅ Ссылка безопасна.`;
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.url = false; lockButton($('#url-btn'), false); }
});

$('#phone-btn').addEventListener('click', async () => {
  if (busy.phone) return; const q = $('#phone-input').value.trim(); if (!q) return;
  busy.phone = true; lockButton($('#phone-btn'), true); const b = $('#phone-result'); const finish = await runProgress('phone', 1000);
  try {
    const d = await safeFetch('/api/leaks', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: q }) }, $('#phone-btn'));
    b.className = 'result-box show ' + (d.found ? 'danger' : 'safe'); 
    b.textContent = d.found ? `🚨 Номер найден в утечках!` : `✅ Утечек нет.`;
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.phone = false; lockButton($('#phone-btn'), false); }
});

$('#drop-zone').addEventListener('click', () => { if (!busy.file) $('#file-input').click(); });
$('#file-input').addEventListener('change', async (e) => {
  if (!e.target.files.length || busy.file) return;
  busy.file = true; const dz = $('#drop-zone'); dz.style.pointerEvents = 'none'; dz.style.opacity = '0.5'; const b = $('#file-result'); const finish = await runProgress('file', 1500);
  try {
    const buffer = await e.target.files[0].arrayBuffer(); const hashBuffer = await crypto.subtle.digest('SHA-256', buffer); const hashHex = Array.from(new Uint8Array(hashBuffer)).map(x => x.toString(16).padStart(2, '0')).join('');
    const d = await safeFetch('/api/files', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ hash: hashHex }) }, dz);
    if (d.status === 'not_found') { b.className = 'result-box show warning'; b.textContent = `⚠️ Файл неизвестен антивирусам.`; }
    else { b.className = 'result-box show ' + (d.verdict === 'danger' ? 'danger' : 'safe'); b.textContent = d.verdict === 'danger' ? `🚨 ВИРУС!` : `✅ Файл чист.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.file = false; if (!dz.dataset.cooldownActive) { dz.style.pointerEvents = 'auto'; dz.style.opacity = '1'; } e.target.value = ''; }
});

$('#scam-btn').addEventListener('click', async () => {
  if (busy.scam) return; const t = $('#scam-input').value.toLowerCase(); if (!t) return;
  busy.scam = true; lockButton($('#scam-btn'), true); const b = $('#scam-result'); const finish = await runProgress('scam', 800);
  await new Promise(r => setTimeout(r, 800));
  if (t.includes('apk') || t.includes('срочно') || t.includes('код') || t.includes('http://')) { b.className = 'result-box show danger'; b.textContent = `🚨 ОПАСНЫЙ ТЕКСТ! Не переходите по ссылкам.`; } 
  else { b.className = 'result-box show safe'; b.textContent = `✅ Явных угроз нет.`; }
  finish(); busy.scam = false; lockButton($('#scam-btn'), false);
});

$('#detox-btn').addEventListener('click', async () => {
  if (busy.detox) return; const q = $('#detox-input').value.trim(); if (!q) return;
  busy.detox = true; lockButton($('#detox-btn'), true); const b = $('#detox-result'); const finish = await runProgress('detox', 1200);
  try {
    const d = await safeFetch('/api/leaks', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: q }) }, $('#detox-btn'));
    if (d.found && d.sources) {
      const uniq = [...new Set(d.sources.map(s => s.name || s.domain || 'Сервис'))];
      let html = `<b>Найдено в ${uniq.length} сервисах:</b><br><br>`;
      // Применяем escapeHTML к названиям сервисов для защиты от XSS
      uniq.forEach(s => { 
        const safeName = escapeHTML(s);
        const safeQuery = encodeURIComponent(s);
        html += `<div class="detox-item"><span>${safeName}</span><a href="https://www.google.com/search?q=how+to+delete+account+${safeQuery}" target="_blank" rel="noopener noreferrer" class="detox-link">Удалить</a></div>`; 
      });
      b.className = 'result-box show'; b.innerHTML = html; // Здесь innerHTML оставляем, так как мы строим список
    } else { b.className = 'result-box show safe'; b.textContent = `✅ Данные не найдены.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.detox = false; lockButton($('#detox-btn'), false); }
});

document.querySelectorAll('.apple-chk').forEach(c => c.addEventListener('change', () => {
  const checked = document.querySelectorAll('.apple-chk:checked').length; const s = $('#apple-score');
  if (checked < 3) { s.className = 'apple-score bad'; s.textContent = `🚨 Защита слабая (${checked}/4)`; } else { s.className = 'apple-score good'; s.textContent = `✅ Отлично (${checked}/4)`; }
}));
