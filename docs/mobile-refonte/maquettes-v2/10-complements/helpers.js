// Lot 10 — outils partagés (même trait 2–2.2 px que kit2.js et les lots 03/04).
const sv = (d, c = '#1E1E1E', w = 2) => `<svg class="ic24" viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const fl = (d, c = '#1E1E1E') => `<svg class="ic24" viewBox="0 0 24 24"><path d="${d}" fill="${c}"/></svg>`;
const SHIP = 'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.530 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.890-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.970L12 8 6 9.97V6z';
const PLANE = 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';
const J = {
  plus: (c = '#1E1E1E') => sv('M12 5v14M5 12h14', c, 2.4),
  plane: (c = '#1E1E1E') => fl(PLANE, c),
  ship: (c = '#1E1E1E') => fl(SHIP, c),
  box: (c = '#1E1E1E') => sv('M12 3 20.5 7.2v9.6L12 21l-8.5-4.2V7.2zM3.5 7.2 12 11.4l8.5-4.2M12 11.4V21', c),
  map: (c = '#1E1E1E') => sv('M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20', c),
  doc: (c = '#1E1E1E') => sv('M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', c),
  pen: (c = '#1E1E1E') => sv('M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4', c),
  trash: (c = '#EC221F') => sv('M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5', c),
  swap: (c = '#1E1E1E') => sv('M7 7h13l-3.5-3.5M17 17H4l3.5 3.5', c),
  ok: (c = '#02542D') => sv('m5 12.5 4.5 4.5L19 7.5', c, 2.6),
  okw: (c = '#F5F5F5') => sv('m6 12.5 4 4L18 8', c, 2.6),
  bang: (c = '#900B09') => sv('M12 6v8M12 18v.01', c, 2.8),
  q: (c = '#682D03') => sv('M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5v.01', c, 2.4),
  phone: (c = '#1E1E1E') => sv('M6.6 3.5h2.6l1.4 4-2 1.4a11 11 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.6a2 2 0 0 1 2.1-2.1z', c),
  wa: (c = '#fff') => `<svg class="ic24" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/><path d="M9.2 8.2c-.4 0-.9.5-.9 1.3 0 2.4 3.4 5.9 6 6 .8 0 1.4-.5 1.4-1l-.2-.7-1.6-.8-.9.8c-1-.4-2-1.4-2.5-2.5l.8-.9-.7-1.6z" fill="${c}"/></svg>`,
  key: (c = '#1E1E1E') => sv('M11.3 10.7 20 2M16.5 5.5l2.5 2.5M14 8l2 2M8 18.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', c),
  lock: (c = '#1E1E1E') => sv('M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3', c),
  idc: (c = '#1E1E1E') => sv('M3 5h18v14H3zM14 10h4M14 14h3M5.8 15.8c.5-1.2 1.5-1.8 2.7-1.8s2.2.6 2.7 1.8M8.5 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', c),
  target: (c = '#1E1E1E') => sv('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12.01V12', c),
  user: (c = '#1E1E1E') => sv('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1-4 3.9-6 7.5-6s6.5 2 7.5 6', c, 2.1),
  share: (c = '#1E1E1E') => sv('M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7.5h14V12', c, 2.1),
  dl: (c = '#1E1E1E') => sv('M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14', c, 2.1),
  scan: (c = '#1E1E1E') => sv('M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3M8 12h8', c, 2.1),
  cam: (c = '#1E1E1E') => sv('M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5zM12 15.9a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z', c),
  pin: (c = '#1E1E1E') => sv('M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', c),
  cal: (c = '#1E1E1E') => sv('M4 6.5h16V20H4zM4 10.5h16M8.5 4v4M15.5 4v4', c),
  label: (c = '#1E1E1E') => sv('M3.5 11.5V4h7.5l9.5 9.5-7.5 7.5zM8 8.5h.01', c, 2.2),
  people: (c = '#1E1E1E') => sv('M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.4 3.3-5.3 6.5-5.3s5.7 1.9 6.5 5.3M16 5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 2.9 2.4 3.3 5.2', c),
  shield: (c = '#1E1E1E') => sv('M12 3 19.5 6v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z', c),
  chart: (c = '#1E1E1E') => sv('M4 20.5h16M7 17v-5M12 17V7M17 17v-8', c, 2.2),
  coin: (c = '#1E1E1E') => sv('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.5 5.8 4.3 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.6-2.9-1.5M12 6v1.8M12 16.3V18', c),
  truck: (c = '#1E1E1E') => sv('M3 6.5h11v10H3zM14 10h4l3 3.5v3h-7M7 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', c),
  anchor: (c = '#1E1E1E') => sv('M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 8v13M5 13a7 7 0 0 0 14 0M8 11.5h8', c),
  factory: (c = '#1E1E1E') => sv('M3 20.5V10l5 3V10l5 3V10l5 3V5h3v15.5zM3 20.5h18', c),
  flag: (c = '#1E1E1E') => sv('M5 21V4M5 4.5h12l-2.5 4 2.5 4H5', c),
  bolt: (c = '#1E1E1E') => sv('M13 3 5 13.5h6L10 21l8-10.5h-6z', c),
  globe: (c = '#1E1E1E') => sv('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z', c),
  refresh: (c = '#1E1E1E') => sv('M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5', c),
  laptop: (c = '#1E1E1E') => sv('M5 5h14v10H5zM2.5 19h19', c),
  mobile: (c = '#1E1E1E') => sv('M7.5 3h9v18h-9zM11 18h2', c),
  out: (c = '#1E1E1E') => sv('M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10', c),
  undo: (c = '#1E1E1E') => sv('M9 7 4.5 11.5 9 16M5 11.5h9a5.5 5.5 0 0 1 0 11h-2', c),
  link: (c = '#1E1E1E') => sv('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', c),
  eye: (c = '#5A5A5A') => sv('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', c),
  hist: (c = '#1E1E1E') => sv('M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4.5l3 2', c),
  sea: (c = '#1E1E1E') => sv('M3 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0M5 14l-1-4h16l-2 4M8 10V6h8v4', c),
  copy: (c = '#303030') => `<svg width="16" height="16" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="${c}" stroke-width="2.2"/><path d="M16 5a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1" fill="none" stroke="${c}" stroke-width="2.2"/></svg>`,
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="#5A5A5A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  okc: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#CFF7D3"/><path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#02542D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tick: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="#F5F5F5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// Logos d'armateurs (mêmes que le lot 04)
const star7 = (() => { let p = ''; for (let i = 0; i < 14; i++) { const r = i % 2 ? 3.6 : 9.2, a = -Math.PI / 2 + i * Math.PI / 7; p += (i ? 'L' : 'M') + (12 + r * Math.cos(a)).toFixed(2) + ' ' + (12.4 + r * Math.sin(a)).toFixed(2); } return p + 'Z'; })();
const carrier = (c) => c === 'maersk' ? `<div class="logo" style="background:#42B0D5"><svg viewBox="0 0 24 24"><path d="${star7}" fill="#fff"/></svg></div>`
  : c === 'cma' ? `<div class="logo" style="border:1px solid #D9D9D9;background:#fff;font:800 11px/1.05 'DM Sans';color:#0B2A73;text-align:center">CMA<br><span style="color:#E2001A">CGM</span></div>`
  : c === 'msc' ? `<div class="logo" style="background:#fff;border:1px solid #D9D9D9;font:700 14px 'DM Sans';color:#A2854C;letter-spacing:.03em">MSC</div>`
  : c === 'cosco' ? `<div class="logo" style="background:#fff;border:1px solid #D9D9D9;font:800 11px 'DM Sans';color:#003A8C">COSCO</div>`
  : `<div class="logo" style="background:#F5F5F5">${J.plane()}</div>`;
// Photos de colis (mêmes dessins que le lot 04)
const PAL = [
  { bg: '#DCD8D1', fl: '#BDB7AE', f: '#C49A6C', t: '#D9B486', s: '#A98057' },
  { bg: '#E3E0DA', fl: '#C8C2B8', f: '#B98D5E', t: '#CFA676', s: '#9C7449' },
  { bg: '#D5D2CC', fl: '#B3ADA4', f: '#CFAB7E', t: '#E0C197', s: '#B08A5E' },
];
const photo = (k = 0, s = 52, w) => {
  const W = w || s;
  if (k === 3) return `<svg class="ph" width="${W}" height="${s}" viewBox="0 0 60 60" preserveAspectRatio="xMidYMid slice"><rect width="60" height="60" fill="#D8D5CF"/><rect y="45" width="60" height="15" fill="#B9B3AA"/><path d="M13 19c5-3 29-3 34 0l2 27c-6 3-32 3-38 0z" fill="#F2F1EC"/><path d="M12.5 27c8 1.6 27 1.6 35.5 0M12 37c8 1.6 28 1.6 36.5 0" stroke="#DAD8D1" stroke-width="1.6" fill="none"/><path d="M22 18.5 21 48M38 18.5l1 29.5" stroke="#3E6DB5" stroke-width="2.6"/><rect x="26" y="29" width="9" height="6" fill="#fff" stroke="#C9C6BE" stroke-width=".6"/></svg>`;
  const p = PAL[k % 3];
  return `<svg class="ph" width="${W}" height="${s}" viewBox="0 0 60 60" preserveAspectRatio="xMidYMid slice"><rect x="-40" width="140" height="60" fill="${p.bg}"/><rect x="-40" y="44" width="140" height="16" fill="${p.fl}"/><path d="M12 22 31 16.5 49 21 30 27z" fill="${p.t}"/><path d="M12 22 30 27v24l-18-5z" fill="${p.f}"/><path d="M30 27l19-6v24l-19 6z" fill="${p.s}"/><path d="M20 19.6 23.6 18.6 41.4 23.6 37.7 24.7z" fill="#EADCBE" opacity=".9"/><path d="M34 33l11-3.4v7L34 40z" fill="#fff"/><path d="M35.5 35.4l7-2.2M35.5 37.6l5-1.6" stroke="#9A9A9A" stroke-width=".8"/></svg>`;
};
const cm = '<span class="flag"><i style="background:#007A5E"></i><i style="background:#CE1126"></i><i style="background:#FCD116"></i></span>';
const cnf = '<span class="flag" style="background:#DE2910;position:relative"><i style="position:absolute;left:3px;top:2px;width:5px;height:5px;background:#FFDE00;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"></i></span>';
const av = (t, extra = '') => `<div class="av" ${extra}>${t}</div>`;
const avI = (svg) => `<div class="av">${svg}</div>`;
const row = (left, n, s, right = '') => `<div class="row">${left}<div class="rm"><div class="rn">${n}</div>${s ? `<div class="rs">${s}</div>` : ''}</div>${right}</div>`;
const amt = (a, sub = '') => `<div class="ra"><b>${a}</b>${sub}</div>`;
const tg = (cls, t) => `<span class="tag ${cls}">${t}</span>`;
const rs = (t) => `<span class="rs" style="display:block">${t}</span>`;
const nav = (t, right = '') => `<div class="nav">${I.back}<div class="t">${t}</div>${right}</div>`;
const dotsB = `<div class="icbtn" style="border:0">${I.dots}</div>`;
const icB = (svg) => `<div class="icbtn" style="border:0">${svg}</div>`;
const stepT = (t) => `<span class="step">${t}</span>`;
const end = '<div class="home-ind"></div>';
const endS = '<div class="home-ind" style="z-index:9"></div>';
const sheet = (html, pb = 36) => `<div class="scrim"></div><div class="sheet" style="padding-bottom:${pb}px"><div class="grab"></div>${html}</div>`;
const ckOn = `<span class="ck on">${J.tick}</span>`;
const ckOff = '<span class="ck"></span>';
const keys = (last = '000') => `<div class="keys">${['1','2','3','4','5','6','7','8','9',last,'0',''].map((k) => `<div>${k || I.del}</div>`).join('')}</div>`;
// Fiche client (même composition que le lot 03 · écran 2)
const ficheClient = (ini, nm, sub, big, line, ops) => `${nav('Client', dotsB)}
  <div class="fiche">${av(ini)}<div class="nm">${nm}</div><div class="sub" style="margin-top:4px">${sub}</div>
    <div class="big">${big} <small>XAF</small></div>${line ? `<div class="line">${line}</div>` : ''}</div>
  <div class="acts">
    <div class="act"><div class="r ink">${I.dep('#F5F5F5')}</div>Dépôt</div>
    <div class="act"><div class="r">${I.pay('#1E1E1E')}</div>Paiement</div>
    <div class="act"><div class="r">${sv('M4 5.5h16v11H9.5L5 20v-3.5H4z', '#1E1E1E', 2.1).replace('ic24', '')}</div>Message</div>
    <div class="act"><div class="r">${J.box().replace('ic24', '')}</div>Colis</div>
  </div>
  <div class="h2"><b>Opérations</b><a>Tout voir</a></div>
  <div class="list">${ops}</div>`;
const fatou = ficheClient('FN', 'Fatou Ndiaye', 'BZ-4821 · Douala', '1 213 450', 'Disponible <b>1 713 450</b> · Découvert <b>500 000</b>',
  row(meth('om'), 'Dépôt', 'Orange Money · 18 oct.', amt('+850 000')) + row(meth('wechat'), 'Paiement · Chen Xiaoli', 'WeChat Pay · 15 oct.', amt('−432 900')) + row(avI(J.box()), 'Fret bateau', 'MSCU 4417092 · 12 oct.', amt('−86 000')));
const aminatou = ficheClient('AB', 'Aminatou Bello', 'BZ-6015 · Garoua', '0', '<span class="tag t-neu" style="margin:0">Inactif</span>',
  '<div class="row"><div class="rm"><div class="rs" style="font-size:16px">Aucune opération</div></div></div>');
