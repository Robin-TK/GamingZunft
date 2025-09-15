// =========================
// GamingZunft app.js (vollständig)
// =========================

const USE_CSV  = true;
const CSV_PATH = 'data/replays.csv';
const LOCALE   = 'de-AT';

const PLAYER_AVATARS = {
  // 'Moses': 'assets/img/players/moses.jpg',
  // 'Planki': 'assets/img/players/planki.png',
};

const NEWCOMERS = new Set(['Domi']);
const VETERANS  = new Set(['Planki', 'Robin', 'Jonas', 'Eltschgo', 'Leks', 'Moses', 'Fabi']);

const THEME_KEY = 'gz_theme';

const state = {
  replays: [],      // nur mit URL -> Karten
  manual: [],       // optionale Zusatz-Stats
  statsPool: [],    // alle CSV-Zeilen -> KPIs & Spieler
  filtered: [],
  sort: 'newest',
  query: ''
};

/* ---------- Theme ---------- */
function getPreferredTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function setToggleIcon(theme){
  const btn = document.getElementById('themeToggle');
  if(!btn) return;
  btn.textContent = theme === 'light' ? '🌞' : '🌙';
  btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  btn.title = theme === 'light' ? 'Zum Dark Mode wechseln' : 'Zum Light Mode wechseln';
}
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  setToggleIcon(theme);
}

/* ---------- Utils ---------- */
function formatCurrency(n){
  const num = Number(n)||0;
  try{ return num.toLocaleString(LOCALE, { style:'currency', currency:'EUR', maximumFractionDigits:2 }); }
  catch{ return `${num.toFixed(2).replace('.', ',')} €`; }
}
function formatDate(iso){
  try{ return new Date(iso).toLocaleDateString(LOCALE, { day:'2-digit', month:'2-digit', year:'numeric' }); }
  catch{ return iso||'—'; }
}
function computeStats(items){
  const totalWinnings = items.reduce((acc,r)=>acc + (Number(r.win) || 0), 0);
  const bestWin   = items.reduce((a,b)=> (Number(a.win)||0) > (Number(b.win)||0) ? a : b, {});
  const bestMulti = items.reduce((a,b)=> (Number(a.x)||0)   > (Number(b.x)||0)   ? a : b, {});
  const avgMulti  = items.length ? items.reduce((acc,r)=>acc + (Number(r.x) || 0), 0) / items.length : 0;
  const uniqueGames = new Set(items.map(r => r.game).filter(Boolean)).size;
  return { totalWinnings, bestWin, bestMulti, avgMulti, uniqueGames, count: items.length };
}

/* ---------- CSV Helpers ---------- */
function detectDelimiter(firstLine){
  const c = (firstLine.match(/,/g)||[]).length;
  const s = (firstLine.match(/;/g)||[]).length;
  return s > c ? ';' : ',';
}
function parseCSV(str, delim=','){
  const rows=[]; let i=0, field='', inQ=false, row=[];
  while(i<str.length){
    const ch=str[i++];
    if(inQ){
      if(ch === '"'){ if(str[i] === '"'){ field += '"'; i++; } else { inQ = false; } }
      else field += ch;
    }else{
      if(ch === '"') inQ = true;
      else if(ch === delim){ row.push(field); field=''; }
      else if(ch === '\n'){ row.push(field); rows.push(row); field=''; row=[]; }
      else if(ch === '\r'){ }
      else field += ch;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}
function normalizeNumber(v){
  if(v == null) return 0;
  let s = String(v).trim().replace(/[€$£\s]/g,'');
  const hasComma = s.includes(','), hasDot = s.includes('.');
  if(hasComma && hasDot){
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    const dec = lastComma > lastDot ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    s = s.replace(new RegExp('\\'+thou, 'g'), '').replace(dec, '.');
  }else if(hasComma){ s = s.replace(/\./g,'').replace(',', '.'); }
  else{ s = s.replace(/,/g,''); }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
function normalizeDate(v){
  if(!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if(m){ const [,dd,mm,yyyy]=m; return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }
  return s;
}
function guessThumb(game){
  const k = (game||'').toLowerCase();
  const map = {
    'gates of olympus': 'assets/img/gates_of_olympus.svg',
    'wanted dead or a wild': 'assets/img/wanted_dead_or_a_wild.svg',
    'sweet bonanza': 'assets/img/sweet_bonanza.svg',
  };
  return map[k] || 'assets/img/gates_of_olympus.svg';
}

/* ---------- CSV -> Items ---------- */
function csvToItems(csvText){
  const firstLine = csvText.split(/\r?\n/)[0] || '';
  const delim = detectDelimiter(firstLine);
  const rows = parseCSV(csvText, delim);
  if(!rows.length) return [];

  const headers = rows.shift().map(h => String(h).trim().toLowerCase());
  const idx = name => headers.indexOf(String(name).toLowerCase());
  const get = (r, name, ...alts) => {
    const i = [name, ...alts].map(n => idx(n)).find(i => i >= 0);
    return (i >= 0 ? (r[i]||'') : '');
  };

  return rows
    .filter(r => r && r.some(x => String(x).trim() !== ''))
    .map(r => {
      const game = get(r, 'game');
      const x    = normalizeNumber(get(r, 'x'));
      const url  = get(r, 'videourl', 'videoUrl');

      const userThumb = get(r, 'thumb', 'thumbnail', 'image', 'img');
      const thumb = userThumb && String(userThumb).trim() ? userThumb.trim() : guessThumb(game);

      const tags  = String(get(r, 'tags') || '').split(/[,;]\s*/).filter(Boolean);
      const title = `${game}${x ? ' ' + x + 'x' : ''}`.trim();
      const isMaxWin =
        tags.map(t => t.toLowerCase()).includes('maxwin') ||
        /max\s*win/i.test(title) || /max\s*win/i.test(String(game));

      return {
        title,
        provider: get(r, 'provider'),
        game,
        player: get(r, 'player', 'palyer'),
        date: normalizeDate(get(r, 'date')),
        bet: normalizeNumber(get(r, 'bet')),
        win: normalizeNumber(get(r, 'win')),
        x,
        videoUrl: url,
        thumb,
        tags,
        isMaxWin
      };
    });
}

/* ---------- Replay-Karten ---------- */
function replayCard(r){
  const xText    = r.x ? `${r.x}x` : '—';
  const winText  = (r.win != null) ? formatCurrency(r.win) : '—';
  const dateText = r.date ? formatDate(r.date) : '—';
  const img      = r.thumb || 'assets/img/gates_of_olympus.svg';

  const winTop = r.isMaxWin
    ? `<div class="mw-badge"><span class="mw-label">MAX&nbsp;WIN</span><span class="mw-amount">🪙 ${winText}</span></div>`
    : `<h3 class="title clamp-2">🪙 ${winText}</h3>`;

  return `
    <div class="card ${r.isMaxWin ? 'maxwin' : ''}">
      <img class="thumb" src="${img}" alt="Thumbnail">
      <div class="content vstack">
        ${winTop}
        <div class="line meta">🎮 ${r.game || r.title || '—'}</div>
        <div class="line meta">🏷️ ${r.provider || '—'}</div>
        <div class="line meta">⚡ ${xText}</div>
        <div class="line meta">📅 ${dateText}</div>
        <div class="line meta">👤 ${r.player || '—'}</div>
        <div class="cta stick-bottom"><a class="btn" href="${r.videoUrl}" target="_blank" rel="noopener">Replay ansehen ↗</a></div>
      </div>
    </div>
  `;
}

/* ---------- Player-Karten ---------- */
function getInitials(name){
  if(!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
function renderPlayerGrid(){
  const combined = [ ...(state.statsPool || []), ...(state.manual || []) ];

  // Summe & Maxwin pro Spieler
  const map = new Map();
  for (const r of combined){
    const p = (r.player || '').trim();
    if (!p) continue;
    const w = Number(r.win) || 0;
    const prev = map.get(p) || { total: 0, maxwin: false };
    map.set(p, { total: prev.total + w, maxwin: prev.maxwin || !!r.isMaxWin });
  }

  const rows = Array.from(map, ([player, info]) => ({
    player,
    total: info.total,
    maxwin: info.maxwin,
    avatar: PLAYER_AVATARS[player] || null
  })).sort((a,b) => b.total - a.total);

  const badge = (cls, icon, tip) => `<span class="ach ${cls}" data-tip="${tip}">${icon}</span>`;

  const cards = rows.map(r => {
    const badges = [];
    if (r.total >= 10000)  badges.push(badge('a1','🥉','≥ 10.000 € Gesamtgewinn'));
    if (r.total >= 50000)  badges.push(badge('a2','🥈','≥ 50.000 € Gesamtgewinn'));
    if (r.total >= 100000) badges.push(badge('a3','🥇','≥ 100.000 € Gesamtgewinn'));
    if (r.maxwin)          badges.push(badge('a4','👑','Mindestens ein MAXWIN'));
    if (NEWCOMERS.has(r.player)) badges.push(badge('a5','🆕','Newcomer'));
    if (VETERANS.has(r.player))  badges.push(badge('a6','🛡️','Veteran'));

    // manuelle Badges aus zentraler Konfig (assets/js/badges.js)
const manualKeys = (window.GZ_BADGES?.players?.[r.player]) || [];
for (const key of manualKeys){
  const def = window.GZ_BADGES?.defs?.[key];
  if (def) badges.push(badge(`gzb-${key}`, def.icon, def.tip));
}

    const href = `player.html?player=${encodeURIComponent(r.player)}`;

    const avatarHtml = r.avatar
      ? `<div class="player-avatar"><img src="${r.avatar}" alt="${r.player}"></div>`
      : `<div class="player-avatar initials">${getInitials(r.player)}</div>`;

    // WICHTIG: target _blank entfernt -> öffnet im selben Tab
    return `
      <div class="card player-card">
        <a class="avatar-link" href="${href}">
          <div class="player-thumb">${avatarHtml}</div>
        </a>
        <div class="content vstack">
          <h3 class="title clamp-2">
            <a class="avatar-link" href="${href}">${r.player}</a>
          </h3>
          <div class="badges-row">${badges.join('')}</div>
          <div class="total pill meta">🪙 ${formatCurrency(r.total)} </div>
        </div>
      </div>
    `;
  }).join('');

  const grid = document.getElementById('playerGrid');
  if (grid) grid.innerHTML = cards;
}

/* ---------- Grid / Filter ---------- */
function renderGrid(){
  const grid = document.querySelector('#replays');
  grid.innerHTML = state.filtered.map(replayCard).join('');
}
function applyFilters(){
  const q = state.query.trim().toLowerCase();
  let arr = [...state.replays]; // nur mit URL

  if(q){
    arr = arr.filter(r =>
      (r.title||'').toLowerCase().includes(q) ||
      (r.game||'').toLowerCase().includes(q) ||
      (r.provider||'').toLowerCase().includes(q) ||
      (r.player||'').toLowerCase().includes(q) ||
      (r.tags||[]).join(' ').toLowerCase().includes(q)
    );
  }

  switch(state.sort){
    case 'maxwin':      arr = arr.filter(r => r.isMaxWin); arr.sort((a,b)=> new Date(b.date) - new Date(a.date)); break;
    case 'newest':      arr.sort((a,b)=> new Date(b.date) - new Date(a.date)); break;
    case 'oldest':      arr.sort((a,b)=> new Date(a.date) - new Date(b.date)); break;
    case 'highest-x':   arr.sort((a,b)=> (b.x||0)  - (a.x||0));  break;
    case 'biggest-win': arr.sort((a,b)=> (b.win||0)- (a.win||0));break;
  }

  state.filtered = arr;
  renderGrid();
}

/* ---------- KPIs (2 Kacheln + beste Werte) ---------- */
function renderStats(){
  const all = [ ...(state.statsPool || state.replays), ...(state.manual || []) ];
  const s = computeStats(all);

  const wEl = document.querySelector('#totalWinnings');
  if (wEl) wEl.textContent = formatCurrency(s.totalWinnings);

  const rEl = document.querySelector('#totalReplays');
  if (rEl) rEl.textContent = String(state.replays?.length || 0);

  const bestWinEl = document.querySelector('#bestWin');
  if (bestWinEl)
    bestWinEl.innerHTML =
      (s.bestWin && s.bestWin.win != null)
        ? `<div class="kpi-amount">${formatCurrency(s.bestWin.win)}</div>
           <div class="kpi-meta">
             <span class="chip chip-game">🎮 ${s.bestWin.game||'—'}</span>
             <span class="chip chip-user">👤 ${s.bestWin.player||'—'}</span>
           </div>`
        : '—';

  const bestMultiEl = document.querySelector('#bestMulti');
  if (bestMultiEl)
    bestMultiEl.innerHTML =
      (s.bestMulti && s.bestMulti.x != null)
        ? `<div class="kpi-amount">${s.bestMulti.x}x</div>
           <div class="kpi-meta">
             <span class="chip chip-game">🎮 ${s.bestMulti.game||'—'}</span>
             <span class="chip chip-user">👤 ${s.bestMulti.player||'—'}</span>
           </div>`
        : '—';
}

/* ---------- Boot ---------- */
async function load(){
  try{
    if (USE_CSV) {
      const text = await fetch(CSV_PATH, { cache: 'no-store' }).then(r => r.text());
      const items = csvToItems(text);
      state.statsPool = items;                                   // alle für KPIs & Spieler
      state.replays   = items.filter(it => String(it.videoUrl||'').trim()); // nur mit URL
    } else {
      const res = await fetch('data/replays.json', { cache: 'no-store' });
      const allItems = await res.json();
      state.statsPool = allItems;
      state.replays   = allItems.filter(it => String(it.videoUrl||'').trim());
    }

    try{ state.manual = await fetch('data/stats-extra.json', { cache: 'no-store' }).then(r => r.json()); }
    catch{ state.manual = []; }

    renderStats();
    renderPlayerGrid();
    applyFilters();
  }catch(err){ console.error(err); }
}

document.addEventListener('DOMContentLoaded', () => {
  // Theme initial
  applyTheme(getPreferredTheme());

  // Wisch-Übergang beim Theme-Toggle (CSS .theme-wipe nötig)
  const tbtn = document.getElementById('themeToggle');
  if (tbtn){
    tbtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next    = current === 'light' ? 'dark' : 'light';

      const oldBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0f16';

      const overlay = document.createElement('div');
      overlay.className = 'theme-wipe ' + (next === 'light' ? 'wipe-right' : 'wipe-left');
      overlay.style.background = oldBg;
      document.body.appendChild(overlay);

      applyTheme(next);
      try{ localStorage.setItem(THEME_KEY, next); }catch(e){}

      requestAnimationFrame(() => { overlay.classList.add('animate'); });

      const done = () => { overlay.removeEventListener('transitionend', done); overlay.remove(); };
      overlay.addEventListener('transitionend', done);
    });

  }

  // Smooth Scroll auf Anker
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Suche / Sortierung (Startseite)
  const searchEl = document.querySelector('#search');
  const sortEl   = document.querySelector('#sort');
  if (searchEl) searchEl.addEventListener('input', (e)=>{ state.query = e.target.value; applyFilters(); });
  if (sortEl)   sortEl  .addEventListener('change', (e)=>{ state.sort  = e.target.value; applyFilters(); });

  load();
});
