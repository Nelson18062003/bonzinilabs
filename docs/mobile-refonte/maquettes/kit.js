const ic = {
  sig: '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#111"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#111"/></svg>',
  wifi: '<svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 008.5.4 10.6 10.6 0 001 3.4l1.3 1.3a8.8 8.8 0 016.2-2.5zm0 3.6c1.4 0 2.7.5 3.6 1.4l1.3-1.3a7 7 0 00-9.8 0l1.3 1.3a5.1 5.1 0 013.6-1.4zm0 3.6c.5 0 1 .2 1.3.5L8.5 11.2 7.2 9.9c.3-.3.8-.5 1.3-.5z" fill="#111"/></svg>',
  bat: '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#111" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#111"/><rect x="25" y="4.5" width="1.6" height="4" rx=".8" fill="#111" opacity=".4"/></svg>',
  home: (on) => `<svg viewBox="0 0 26 26"><path d="M4 11.6 13 4.5l9 7.1V21a1.5 1.5 0 0 1-1.5 1.5H16v-6.2h-6v6.2H5.5A1.5 1.5 0 0 1 4 21z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  ops: '<svg viewBox="0 0 26 26"><path d="M8 8h13M8 13h13M8 18h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="4.5" cy="8" r="1.4" fill="currentColor"/><circle cx="4.5" cy="13" r="1.4" fill="currentColor"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor"/></svg>',
  scan: '<svg viewBox="0 0 26 26"><path d="M4 9V6a2 2 0 0 1 2-2h3M17 4h3a2 2 0 0 1 2 2v3M22 17v3a2 2 0 0 1-2 2h-3M9 22H6a2 2 0 0 1-2-2v-3M8 13h10" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>',
  cli: '<svg viewBox="0 0 26 26"><circle cx="10" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 21.5c.9-3.9 3.7-6 7-6s6.1 2.1 7 6M17.5 5a4 4 0 0 1 0 8M19.6 15.9c2 .8 3.2 2.8 3.6 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 26 26"><circle cx="6" cy="13" r="2" fill="currentColor"/><circle cx="13" cy="13" r="2" fill="currentColor"/><circle cx="20" cy="13" r="2" fill="currentColor"/></svg>',
  bell: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.6 2H4.4zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="#17111f" stroke-width="2" stroke-linejoin="round"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 4v14M6 12l6 6 6-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 19 19 5M9 5h10v10" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" fill="none" stroke="#7a3cf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dots: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="#17111f"/><circle cx="12" cy="12" r="2" fill="#17111f"/><circle cx="19" cy="12" r="2" fill="#17111f"/></svg>',
  copy: '<svg width="15" height="15" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="3" fill="none" stroke="#4b4560" stroke-width="2.2"/><path d="M16 5V5a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1" fill="none" stroke="#4b4560" stroke-width="2.2"/></svg>',
  chev: '<svg width="18" height="18" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="#c4c0cf" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: (c = '#fff', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  share: '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cam: '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="#7a3cf0" stroke-width="2"/><circle cx="12" cy="12.5" r="3.4" fill="none" stroke="#7a3cf0" stroke-width="2"/></svg>',
};
const sbar = () => `<div class="sbar"><span>9:41</span><div class="di"></div><div class="ic">${ic.sig}${ic.wifi}${ic.bat}</div></div>`;
// Barre d'onglets. Rôles : admin (défaut), treasurer, reception, warehouse, commercial, cash, customs.
const TABSETS = {
  admin: [['home', 'Accueil'], ['ops', 'Opérations'], ['cli', 'Clients'], ['cargo', 'Cargo'], ['more', 'Plus']],
  treasurer: [['home', 'Accueil'], ['tre', 'Trésorerie'], ['more', 'Plus']],
  reception: [['today', 'Aujourd\'hui'], ['box', 'Paquets'], ['scan', 'Scanner'], ['cli', 'Clients'], ['more', 'Plus']],
  warehouse: [['today', 'Journée'], ['pointer', 'Pointer'], ['scan', 'Scanner'], ['hand', 'Remettre'], ['more', 'Plus']],
  commercial: [['chart', 'Mon mois'], ['target', 'Prospects'], ['cli', 'Mes clients'], ['more', 'Plus']],
  cash: [['ops', 'Paiements'], ['scan', 'Scanner'], ['more', 'Plus']],
  customs: [['sign', 'À signer'], ['calc', 'Simulateur'], ['more', 'Plus']],
};
const tabs = (on, badges = { ops: 4 }, set = 'admin') => `<div class="tabs">${TABSETS[set].map(([k, l]) => `<div class="tab ${on === k ? 'on' : ''}">${k === 'home' ? ic.home(on === k) : (ic[k] || ic.more)}${badges && badges[k] ? `<span class="b">${badges[k]}</span>` : ''}<span>${l}</span></div>`).join('')}</div>`;
const mk = (m) => ({ ali: '<span class="mk ali">支</span>', wx: '<span class="mk wx">微</span>', bk: '<span class="mk bk">银</span>', cash: '<span class="mk cash">¥</span>', mtn: '<span class="mk mtn">MoMo</span>', om: '<span class="mk om">OM</span>', bank: '<span class="mk bank">BQ</span>' })[m];
const pill = (k, t) => `<span class="pill p-${k}"><i></i>${t}</span>`;
const row = (m, name, sub, amt, meta, dot) => `<div class="row">${mk(m)}<div class="rm"><div class="rn">${name}</div><div class="rs">${sub}</div></div><div class="ra"><b>${amt}</b><span>${dot ? `<span class="dotline"><i style="background:${dot}"></i>${meta}</span>` : meta}</span></div></div>`;
const qr = (seed = 7, size = 21) => { let x = seed; const r = () => (x = (x * 9301 + 49297) % 233280) / 233280; let h = ''; for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) { const f = (a, b) => (i >= a && i < a + 7 && j >= b && j < b + 7); const inF = f(0, 0) || f(0, size - 7) || f(size - 7, 0); let k; if (inF) { const ii = i % (size - 7 === i - (i % 1) ? 1 : 1); const a = i < 7 ? i : i - (size - 7); const b = j < 7 ? j : j - (size - 7); k = (a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4)); } else k = r() > .52; h += `<i class="${k ? 'k' : ''}"></i>`; } return `<div class="qr">${h}</div>`; };
const aliReceipt = (amt, payee) => `<div class="rcpt"><div class="ali-head"><span>支付宝</span><span>账单详情</span></div><div class="rb"><div style="font:500 12px 'Noto SC';color:#6f6981">${payee}</div><div class="big">-${amt}</div><div class="ok">✓ 交易成功</div></div><div class="rl"><span>付款方式</span><span>余额宝</span></div><div class="rl"><span>创建时间</span><span>2026-10-21 10:42</span></div><div class="rl" style="padding-bottom:10px"><span>订单号</span><span>2026102122001…</span></div></div>`;
const momoReceipt = (amt) => `<div class="rcpt"><div class="momo-head"><span>MTN MoMo</span><span>Reçu</span></div><div class="rb"><div style="font:500 12px 'DM Sans';color:#6f6981">Transfert vers NORTON GAUSS BONZINI</div><div class="big">${amt} FCFA</div><div class="ok">✓ Transaction réussie</div></div><div class="rl"><span>Réf.</span><span>8 821 004 517</span></div><div class="rl" style="padding-bottom:10px"><span>Date</span><span>21/10/2026 09:58</span></div></div>`;

const screens = [];
const add = (title, sub, html, cls = '') => screens.push({ title, sub, html, cls });

Object.assign(ic, {
  cargo: '<svg viewBox="0 0 26 26"><path d="M3 17h20l-2.2 4.5H5.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="6" y="9" width="6" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="12" y="6" width="7" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  tre: '<svg viewBox="0 0 26 26"><rect x="3.5" y="7" width="19" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 11h19M16 15.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  today: '<svg viewBox="0 0 26 26"><rect x="4" y="5.5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10.5h18M9 3.5v4M17 3.5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 26 26"><path d="M13 3.5 22 8v10l-9 4.5L4 18V8z M4 8l9 4.5L22 8M13 12.5v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pointer: '<svg viewBox="0 0 26 26"><rect x="4" y="4" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.5 13.2 3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hand: '<svg viewBox="0 0 26 26"><path d="M3 15h4l5 2.5h4.5a1.8 1.8 0 0 1 0 3.5H11M7 21.5l5 1.5 9.5-3.5a1.8 1.8 0 0 0-1.3-3.4L16.5 17M3 13v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="4" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  chart: '<svg viewBox="0 0 26 26"><path d="M4 21.5h18M7 18v-5M12 18V8M17 18v-8M22 18V5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  target: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="13" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="13" r="1.3" fill="currentColor"/></svg>',
  sign: '<svg viewBox="0 0 26 26"><path d="M4 20c2.5-5 4.5-7 6-7 2 0 0 6 2.5 6 1.6 0 2.8-2.6 4-2.6 1 0 1 2.1 2.5 2.1H22M16 4.5l4.5 4.5-6.5 6.5H9.5V11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calc: '<svg viewBox="0 0 26 26"><rect x="5" y="3.5" width="16" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 8h8M9 13h.01M13 13h.01M17 13h.01M9 17.5h.01M13 17.5h.01M17 17.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  scanSm: '<svg width="22" height="22" viewBox="0 0 26 26"><path d="M4 9V6a2 2 0 0 1 2-2h3M17 4h3a2 2 0 0 1 2 2v3M22 17v3a2 2 0 0 1-2 2h-3M9 22H6a2 2 0 0 1-2-2v-3M8 13h10" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
});

// Rend toutes les maquettes ajoutées avec add() dans #board.
const render = () => { document.getElementById('board').innerHTML = screens.map((s, i) => `<div class="shot" id="s${i + 1}"><div class="ab ${s.cls}">${s.html}</div><div class="cap">${s.title}<small>${s.sub}</small></div></div>`).join(''); };
