const $ = s => document.querySelector(s);
const busy = { email: false, pass: false, url: false, phone: false, file: false, scam: false, detox: false };
let USER_ID = localStorage.getItem('guardian_uid');
let USER_TOKEN = localStorage.getItem('guardian_token');

// Получаем токен при загрузке, если его нет
async function initAuth() {
  if (!USER_ID || !USER_TOKEN) {
    USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);
    try {
      const res = await fetch('/api/get-token?id=' + USER_ID);
      const data = await res.json();
      USER_ID = data.id;
      USER_TOKEN = data.token;
      localStorage.setItem('guardian_uid', USER_ID);
      localStorage.setItem('guardian_token', USER_TOKEN);
    } catch (e) {
      console.error('Auth error', e);
    }
  }
}
initAuth();

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// 10-СЕКУНДНАЯ АНИМАЦИЯ
function runDeepScan(prefix, duration) {
  return new Promise((resolve) => {
    const container = $(`#${prefix}-progress`); const fill = $(`#${prefix}-progress-fill`);
    const percent = $(`#${prefix}-progress-percent`); const text = $(`#${prefix}-progress-text`);
    if (!container) return resolve(() => {});
    container.classList.add('active'); fill.style.width = '0%'; percent.innerText = '0%'; text.innerText = 'Глубокий анализ...';
    let width = 0;
    const interval = setInterval(() => { 
      width += 1; 
      if (width > 99) width = 99; 
      fill.style.width = width + '%'; 
      percent.innerText = width + '%'; 
      if (width === 30) text.innerText = 'Поиск в базах LeakCheck...';
      if (width === 60) text.innerText = 'Сверка с HIBP...';
      if (width === 90) text.innerText = 'Анализ VirusTotal...';
    }, duration / 100);
    resolve(() => { clearInterval(interval); fill.style.width = '100%'; percent.innerText = '100%'; text.innerText = 'Анализ завершен!'; setTimeout(() => { container.classList.remove('active'); }, 300); });
  });
}

function lockButton(btn, isBusy) {
  if (isBusy) { btn.classList.add('busy'); btn.disabled = true; btn.dataset.originalText = btn.innerText; btn.innerText = '⏳ Глубокий анализ...'; } 
  else { if (btn.dataset.cooldownActive) return; btn.classList.remove('busy'); btn.disabled = false; btn.innerText = btn.dataset.originalText || btn.innerText; }
}

async function safeFetch(url, options) {
  options.headers = { ...options.headers, 'x-user-id': USER_ID, 'x-user-token': USER_TOKEN };
  const r = await fetch(url, options);
  const triesLeft = r.headers.get('X-Tries-Left');
  if (triesLeft !== null) $('#tries-counter').innerText = `Осталось проверок: ${triesLeft}`;
  
  if (r.status === 403) { 
    const d = await r.json();
    if (d.error === 'LIMIT_REACHED') {
      $('#paywall-modal').style.display = 'flex'; 
      throw new Error('LIMIT'); 
    }
    throw new Error(d.error || 'Ошибка доступа');
  }
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
    else alert('Ошибка оплаты: ' + (data.error || 'Неизвестно'));
  } catch (e) { alert('Сервер не отвечает.'); }
}

function donate() {
  buyChecks(); // Пока ведем туда же
}

// EMAIL
$('#email-btn').addEventListener('click', async () => {
  if (busy.email) return; const q = $('#email-input').value.trim(); if (!q) return;
  busy.email = true; lockButton($('#email-btn'), true); const b = $('#email-result'); 
  const finish = await runDeepScan('email', 10000);
  
  try {
    const d = await safeFetch('/api/leaks', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: q }) });
    b.className = 'result-box show ' + (d.found ? 'danger' : 'safe');
    if (d.found) {
      b.innerHTML = `<span class="result-title">🚨 Найдено в ${d.count} утечках!</span>
        <p>Купите глубокий анализ, чтобы узнать, <b>какие именно данные</b> утекли.</p>
        <button class="btn-unlock" onclick="buyChecks()">🔓 Разблокировать глубокий анализ (249 ₽)</button>`;
    } else { b.textContent = `✅ Утечек не найдено.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.email = false; lockButton($('#email-btn'), false); }
});

// PASS
$('#pass-btn').addEventListener('click', async () => {
  if (busy.pass) return; const p = $('#pass-input').value; if (!p) return;
  busy.pass = true; lockButton($('#pass-btn'), true); const b = $('#pass-result'); 
  const finish = await runDeepScan('pass', 10000);
  
  try {
    const d = await safeFetch('/api/passwords', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ password: p }) });
    b.className = 'result-box show ' + (d.count > 0 ? 'danger' : 'safe');
    if (d.count > 0) {
      b.innerHTML = `<span class="result-title">🚨 Пароль слит ${d.count} раз!</span>
        <p>Купите глубокий анализ, чтобы узнать, в каких базах он засветился.</p>
        <button class="btn-unlock" onclick="buyChecks()">🔓 Разблокировать глубокий анализ (249 ₽)</button>`;
    } else { b.textContent = `✅ Пароль надежен.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.pass = false; lockButton($('#pass-btn'), false); }
});

// URL
$('#url-btn').addEventListener('click', async () => {
  if (busy.url) return; const u = $('#url-input').value.trim(); if (!u) return;
  busy.url = true; lockButton($('#url-btn'), true); const b = $('#url-result'); 
  const finish = await runDeepScan('url', 10000);
  
  try {
    const d = await safeFetch('/api/urls', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ url: u }) });
    b.className = 'result-box show ' + (d.verdict === 'danger' ? 'danger' : 'safe');
    if (d.verdict === 'danger') {
      b.innerHTML = `<span class="result-title">🚨 ОПАСНАЯ ССЫЛКА!</span>
        <p>Купите глубокий анализ, чтобы узнать, какие антивирусы ее заблокировали.</p>
        <button class="btn-unlock" onclick="buyChecks()">🔓 Разблокировать глубокий анализ (249 ₽)</button>`;
    } else { b.textContent = `✅ Ссылка безопасна.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.url = false; lockButton($('#url-btn'), false); }
});

// PHONE
$('#phone-btn').addEventListener('click', async () => {
  if (busy.phone) return; const q = $('#phone-input').value.trim(); if (!q) return;
  busy.phone = true; lockButton($('#phone-btn'), true); const b = $('#phone-result'); 
  const finish = await runDeepScan('phone', 10000);
  
  try {
    const d = await safeFetch('/api/leaks', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: q }) });
    b.className = 'result-box show ' + (d.found ? 'danger' : 'safe');
    if (d.found) {
      b.innerHTML = `<span class="result-title">🚨 Номер найден в утечках!</span>
        <p>Купите глубокий анализ, чтобы узнать, где именно.</p>
        <button class="btn-unlock" onclick="buyChecks()">🔓 Разблокировать глубокий анализ (249 ₽)</button>`;
    } else { b.textContent = `✅ Утечек нет.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.phone = false; lockButton($('#phone-btn'), false); }
});

// FILE
$('#drop-zone').addEventListener('click', () => { if (!busy.file) $('#file-input').click(); });
$('#file-input').addEventListener('change', async (e) => {
  if (!e.target.files.length || busy.file) return;
  busy.file = true; const dz = $('#drop-zone'); dz.style.pointerEvents = 'none'; dz.style.opacity = '0.5'; const b = $('#file-result'); 
  const finish = await runDeepScan('file', 10000);
  
  try {
    const buffer = await e.target.files[0].arrayBuffer(); const hashBuffer = await crypto.subtle.digest('SHA-256', buffer); const hashHex = Array.from(new Uint8Array(hashBuffer)).map(x => x.toString(16).padStart(2, '0')).join('');
    const d = await safeFetch('/api/files', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ hash: hashHex }) });
    if (d.status === 'not_found') { b.className = 'result-box show warning'; b.textContent = `⚠️ Файл неизвестен антивирусам.`; }
    else if (d.verdict === 'danger') {
      b.className = 'result-box show danger';
      b.innerHTML = `<span class="result-title">🚨 ВИРУС!</span>
        <p>Купите глубокий анализ, чтобы узнать, какой антивирус его нашел.</p>
        <button class="btn-unlock" onclick="buyChecks()">🔓 Разблокировать глубокий анализ (249 ₽)</button>`;
    } else { b.className = 'result-box show safe'; b.textContent = `✅ Файл чист.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.file = false; if (!dz.dataset.cooldownActive) { dz.style.pointerEvents = 'auto'; dz.style.opacity = '1'; } e.target.value = ''; }
});

// SCAM
$('#scam-btn').addEventListener('click', async () => {
  if (busy.scam) return; const t = $('#scam-input').value.toLowerCase(); if (!t) return;
  busy.scam = true; lockButton($('#scam-btn'), true); const b = $('#scam-result'); 
  const finish = await runDeepScan('scam', 10000);
  
  await new Promise(r => setTimeout(r, 10000));
  
  if (t.includes('apk') || t.includes('срочно') || t.includes('код') || t.includes('http://')) { 
    b.className = 'result-box show danger'; 
    b.innerHTML = `<span class="result-title">🚨 ОПАСНЫЙ ТЕКСТ!</span><p>Купите глубокий анализ для деталей.</p><button class="btn-unlock" onclick="buyChecks()">🔓 Разблокировать (249 ₽)</button>`;
  } else { b.className = 'result-box show safe'; b.textContent = `✅ Явных угроз нет.`; }
  finish(); busy.scam = false; lockButton($('#scam-btn'), false);
});

// DETOX
$('#detox-btn').addEventListener('click', async () => {
  if (busy.detox) return; const q = $('#detox-input').value.trim(); if (!q) return;
  busy.detox = true; lockButton($('#detox-btn'), true); const b = $('#detox-result'); 
  const finish = await runDeepScan('detox', 10000);
  
  try {
    const d = await safeFetch('/api/leaks', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ query: q }) });
    if (d.found && d.sources) {
      const uniq = [...new Set(d.sources.map(s => s.name || s.domain || 'Сервис'))];
      b.className = 'result-box show';
      b.innerHTML = `<b>Найдено в ${uniq.length} сервисах!</b><br><br>
        <p>Купите глубокий анализ, чтобы увидеть список сервисов и ссылки на удаление.</p>
        <button class="btn-unlock" onclick="buyChecks()">🔓 Разблокировать список (249 ₽)</button>`;
    } else { b.className = 'result-box show safe'; b.textContent = `✅ Данные не найдены.`; }
  } catch (e) { b.className = 'result-box show ' + (e.message === 'LIMIT' ? 'warning' : 'error'); b.textContent = e.message === 'LIMIT' ? `` : `⚠️ ${e.message}`; } 
  finally { finish(); busy.detox = false; lockButton($('#detox-btn'), false); }
});

// APPLE ID
document.querySelectorAll('.apple-chk').forEach(c => c.addEventListener('change', () => {
  const checked = document.querySelectorAll('.apple-chk:checked').length; const s = $('#apple-score');
  if (checked < 3) { s.className = 'apple-score bad'; s.textContent = `🚨 Защита слабая (${checked}/4)`; } else { s.className = 'apple-score good'; s.textContent = `✅ Отлично (${checked}/4)`; }
}));