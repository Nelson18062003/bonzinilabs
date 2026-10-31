// Dossier des images (logos, mascotte), relatif à la page du lot.
const A = window.ASSET ?? "../";

const LOGO = {
  alipay: 'M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809',
  wechat: 'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z',
};
const meth = (m) => m === 'alipay' ? `<div class="logo" style="background:#1677FF"><svg viewBox="0 0 24 24"><path d="${LOGO.alipay}" fill="#fff"/></svg></div>`
  : m === 'wechat' ? `<div class="logo" style="background:#07C160"><svg viewBox="0 0 24 24"><path d="${LOGO.wechat}" fill="#fff"/></svg></div>`
  : m === 'bank' ? `<div class="logo" style="background:#8B5CF6"><svg viewBox="0 0 24 24"><path d="M3 9.5 12 4l9 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
  : m === 'cash' ? `<div class="logo" style="background:#E0322B;color:#fff;font:700 20px 'DM Sans'">¥</div>`
  : m === 'om' ? `<div class="logo" style="border:1px solid #D9D9D9;background:#fff"><img src="${A}orange-money.png" style="object-fit:contain;padding:5px"></div>`
  : m === 'wave' ? `<div class="logo"><img src="${A}wave.png"></div>`
  : m === 'mtn' ? `<div class="logo" style="background:#FFCB05;font:800 12px 'DM Sans';color:#111">MTN</div>`
  : m === 'uba' ? `<div class="logo" style="border:1px solid #D9D9D9"><img src="${A}uba.png" style="object-fit:contain;padding:6px"></div>` : '';
const sbar = () => `<div class="sbar"><span>9:41</span><div class="di"></div><div class="ic"><svg width="18" height="12" viewBox="0 0 18 12"><rect y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" width="3" height="12" rx="1"/></svg><svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 008.5.4 10.6 10.6 0 001 3.4l1.3 1.3a8.8 8.8 0 016.2-2.5zm0 3.6c1.4 0 2.7.5 3.6 1.4l1.3-1.3a7 7 0 00-9.8 0l1.3 1.3a5.1 5.1 0 013.6-1.4zm0 3.6c.5 0 1 .2 1.3.5L8.5 11.2 7.2 9.9c.3-.3.8-.5 1.3-.5z"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#111" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2"/></svg></div></div>`;
const I = {
  home: (on) => `<svg viewBox="0 0 26 26"><path d="M4 11.6 13 4.5l9 7.1V21a1.5 1.5 0 0 1-1.5 1.5H16v-6.2h-6v6.2H5.5A1.5 1.5 0 0 1 4 21z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  ops: '<svg viewBox="0 0 26 26"><path d="M7 8h14l-3.5-3.5M19 18H5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cli: '<svg viewBox="0 0 26 26"><circle cx="10" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 21.5c.9-3.9 3.7-6 7-6s6.1 2.1 7 6M17.5 5a4 4 0 0 1 0 8M19.6 15.9c2 .8 3.2 2.8 3.6 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cargo: '<svg viewBox="0 0 26 26"><path d="M3 15h20l-2.5 6H5.5zM6 15V9h14v6M13 9V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 26 26"><circle cx="6" cy="13" r="2" fill="currentColor"/><circle cx="13" cy="13" r="2" fill="currentColor"/><circle cx="20" cy="13" r="2" fill="currentColor"/></svg>',
  back: '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" fill="none" stroke="#1E1E1E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bell: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.6 2H4.4zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="#1E1E1E" stroke-width="2" stroke-linejoin="round"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="#5A5A5A" stroke-width="2.2"/><path d="m16 16 4.5 4.5" stroke="#5A5A5A" stroke-width="2.2" stroke-linecap="round"/></svg>',
  dots: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="#1E1E1E"/><circle cx="12" cy="12" r="2" fill="#1E1E1E"/><circle cx="19" cy="12" r="2" fill="#1E1E1E"/></svg>',
  dep: (c) => `<svg viewBox="0 0 24 24"><path d="M12 4v13M6 11l6 6 6-6M5 20h14" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pay: (c) => `<svg viewBox="0 0 24 24"><path d="M5 19 19 5M9 5h10v10" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  scan: (c) => `<svg viewBox="0 0 24 24"><path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3M8 12h8" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
  user: (c) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="${c}" stroke-width="2.2"/><path d="M4.5 20.5c1-4 3.9-6 7.5-6s6.5 2 7.5 6" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  copy: '<svg width="16" height="16" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="#303030" stroke-width="2.2"/><path d="M16 5a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1" fill="none" stroke="#303030" stroke-width="2.2"/></svg>',
  cam: '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="#1E1E1E" stroke-width="2"/><circle cx="12" cy="12.5" r="3.4" fill="none" stroke="#1E1E1E" stroke-width="2"/></svg>',
  check: '<svg width="36" height="36" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="#02542D" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  del: '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="#1E1E1E" stroke-width="2" stroke-linejoin="round"/><path d="m12 9 5 6M17 9l-5 6" stroke="#1E1E1E" stroke-width="2" stroke-linecap="round"/></svg>',
};
// Barre d'onglets par rôle. tabs(onglet, rôle, pastilles)
const TABSETS = {
  admin: [['home', 'Accueil'], ['ops', 'Opérations'], ['cli', 'Clients'], ['cargo', 'Cargo'], ['more', 'Plus']],
  treasurer: [['home', 'Accueil'], ['tre', 'Trésorerie'], ['more', 'Plus']],
  reception: [['today', "Aujourd'hui"], ['box', 'Paquets'], ['scan', 'Scanner'], ['cli', 'Clients'], ['more', 'Plus']],
  warehouse: [['today', 'Journée'], ['pointer', 'Pointer'], ['scan', 'Scanner'], ['hand', 'Remettre'], ['more', 'Plus']],
  commercial: [['chart', 'Mon mois'], ['target', 'Prospects'], ['cli', 'Mes clients'], ['more', 'Plus']],
  cash: [['ops', 'Paiements'], ['scan', 'Scanner'], ['more', 'Plus']],
  customs: [['sign', 'À signer'], ['calc', 'Simulateur'], ['more', 'Plus']],
};
Object.assign(I, {
  tre: '<svg viewBox="0 0 26 26"><rect x="3.5" y="7" width="19" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 11h19M16 15.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  today: '<svg viewBox="0 0 26 26"><rect x="4" y="5.5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10.5h18M9 3.5v4M17 3.5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  box: '<svg viewBox="0 0 26 26"><path d="M13 3.5 22 8v10l-9 4.5L4 18V8z M4 8l9 4.5L22 8M13 12.5v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  scanT: '<svg viewBox="0 0 26 26"><path d="M4 9V6a2 2 0 0 1 2-2h3M17 4h3a2 2 0 0 1 2 2v3M22 17v3a2 2 0 0 1-2 2h-3M9 22H6a2 2 0 0 1-2-2v-3M8 13h10" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>',
  pointer: '<svg viewBox="0 0 26 26"><rect x="4" y="4" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.5 13.2 3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hand: '<svg viewBox="0 0 26 26"><path d="M3 15h4l5 2.5h4.5a1.8 1.8 0 0 1 0 3.5H11M7 21.5l5 1.5 9.5-3.5a1.8 1.8 0 0 0-1.3-3.4L16.5 17M3 13v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="4" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  chart: '<svg viewBox="0 0 26 26"><path d="M4 21.5h18M7 18v-5M12 18V8M17 18v-8M22 18V5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  target: '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="13" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="13" r="1.3" fill="currentColor"/></svg>',
  sign: '<svg viewBox="0 0 26 26"><path d="M4 20c2.5-5 4.5-7 6-7 2 0 0 6 2.5 6 1.6 0 2.8-2.6 4-2.6 1 0 1 2.1 2.5 2.1H22M16 4.5l4.5 4.5-6.5 6.5H9.5V11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calc: '<svg viewBox="0 0 26 26"><rect x="5" y="3.5" width="16" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 8h8M9 13h.01M13 13h.01M17 13h.01M9 17.5h.01M13 17.5h.01M17 17.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
});
const tabs = (on, set = 'admin', badges = { ops: 5 }) => `<div class="tabs" style="grid-template-columns:repeat(${TABSETS[set].length},1fr)">${TABSETS[set].map(([k, l]) => `<div class="tab ${on === k ? 'on' : ''}">${k === 'home' ? I.home(on === k) : (k === 'scan' ? I.scanT : (I[k] || I.more))}${badges && badges[k] ? `<span class="b">${badges[k]}</span>` : ''}<span>${l}</span></div>`).join('')}</div>`;
const qr = (seed = 7) => { let x = seed; const r = () => (x = (x * 9301 + 49297) % 233280) / 233280; let h = ''; for (let i = 0; i < 21; i++) for (let j = 0; j < 21; j++) { const f = (a, b) => i >= a && i < a + 7 && j >= b && j < b + 7; let k; if (f(0, 0) || f(0, 14) || f(14, 0)) { const a = i < 7 ? i : i - 14, b = j < 7 ? j : j - 14; k = a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4); } else k = r() > .52; h += `<i class="${k ? 'k' : ''}"></i>`; } return `<div class="qr">${h}</div>`; };
const mola = '<div class="mola"><img src="mola-mascot.png"></div>';

const S = [];
const add = (t, html) => S.push({ t, html });


// Rend les écrans ajoutés par add(titre, html).
const render = () => { document.getElementById('board').innerHTML = S.map((s, i) => `<div class="shot" id="s${i + 1}"><div class="ab">${s.html}</div><div class="cap">${s.t}</div></div>`).join(''); };
