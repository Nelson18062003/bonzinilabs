// ============================================================
// ÉTIQUETTE D'EXPÉDITION (发货标签) — DESSINÉE, pas rasterisée depuis le DOM.
//
// La première version était un bloc HTML converti en image (html-to-image).
// Sur le téléphone, l'image partait sans les polices web : des polices
// système plus larges entraient dans des lignes de hauteur fixe, et tout se
// chevauchait (« Deliver to » sur deux lignes, l'adresse sur elle-même, le
// fournisseur écrasé). Le même bloc débordait déjà de 10 % sur desktop.
//
// Ici, l'étiquette est un PLAN puis une PEINTURE :
//   • `layoutLabel()` calcule chaque ligne avec un curseur vertical, MESURE
//     chaque texte (retour à la ligne, points de suspension) et rend une liste
//     d'opérations. C'est pur : testable sans navigateur.
//   • `paintLabel()` joue ces opérations sur un canvas 2D. Le canvas utilise
//     les polices de la page (DM Sans, Noto SC), chargées avant de peindre ;
//     à défaut, la police système — mais MESURÉE, donc jamais de chevauchement.
//
// Cinq sections, dans le vocabulaire du bon de réception de l'entrepôt :
//   0 bandeau · 1 收件地址 · 2 客户编号 (QR) · 3 客户 · 4 供货商 · 5 仓库填写
// Une destination par étiquette : Sea cargo (entrepôt) ou Air cargo (bureau) —
// et chaque mode a SON identité (DESTINATION_THEME) : bateau bleu au bandeau
// uni, avion rouge-orange au bandeau hachuré. Les deux étiquettes portaient
// les mêmes mots dans le même noir, et un client a envoyé la mauvaise ; ici
// le mode se voit de loin, en couleur comme sur une photocopie.
// Taille logique 600 × 950 ; peinte à ×2 (aperçu) ou ×3 (export, ~220 dpi A4).
// ============================================================
import { customerQrPayload, DESTINATION_LABEL, DESTINATION_THEME, type DestinationIcon, type ShippingDestination, type ShippingSettings } from '@/lib/customerCode';

export const LABEL_W = 600;
export const LABEL_H = 950;

export interface LabelSupplierInfo {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface LabelData {
  code: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  companyName?: string | null;
  clientCity?: string | null;
  clientCountry?: string | null;
  destination: ShippingDestination;
  settings: ShippingSettings;
  supplier?: LabelSupplierInfo;
}

// ── Polices ──────────────────────────────────────────────────────────────
export const FONT_LATIN = '"DM Sans", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
export const FONT_ZH = '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const FONT_ZH_DISPLAY = '"Noto Serif SC", "Songti SC", "SimSun", "Noto Sans SC", "PingFang SC", serif';
const f = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;

const INK = '#111111';
const MUTED = '#555555';
const HAIR = '#DADADA';
const BAND = '#EFEFEF';
const WHITE = '#FFFFFF';

// ── Géométrie ────────────────────────────────────────────────────────────
const M = 14;                 // marge extérieure
const X0 = M, X1 = LABEL_W - M; // bord gauche / droit du cadre
const PX = 14;                // retrait intérieur
const CX0 = X0 + PX, CX1 = X1 - PX; // colonne de contenu
const CW = CX1 - CX0;         // 544
const KEY_COL = 130;          // largeur de la colonne d'intitulés
const KEY_COL_2 = 112;        // idem, second champ d'une ligne double
const ROW_H = 28;
const BAND_H = 22;
const RULE = 2;

// ── Opérations de peinture ───────────────────────────────────────────────
export type Op =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string; radius?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { kind: 'text'; text: string; x: number; y: number; font: string; color: string; align: 'left' | 'right' | 'center'; maxWidth: number; row?: string }
  | { kind: 'qr'; x: number; y: number; size: number }
  /** Pictogramme du mode (bateau, avion) : tracé lucide sur grille 24, mis à l'échelle. */
  | { kind: 'icon'; icon: DestinationIcon; x: number; y: number; size: number; color: string }
  /** Hachures diagonales : le signal qui survit à l'impression en noir et blanc. */
  | { kind: 'stripes'; x: number; y: number; w: number; h: number; color: string; bg: string };

/** Les tracés (lucide `ship` / `plane`, grille 24 × 24, trait 2), repris tels quels. */
export const ICON_PATHS: Record<DestinationIcon, string[]> = {
  ship: [
    'M12 10.189V14',
    'M12 2v3',
    'M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6',
    'M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76',
    'M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
  ],
  plane: [
    'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  ],
};

export type Measure = (text: string, font: string) => number;

// ── Texte : ajuster, couper ──────────────────────────────────────────────
const CJK = /[\u3000-\u9fff\uf900-\ufaff]/;

/** Le texte tel quel s'il tient, sinon coupé avec « … » à la largeur donnée. */
export function fitText(text: string, maxWidth: number, font: string, measure: Measure): string {
  const t = text.trim();
  if (!t || measure(t, font) <= maxWidth) return t;
  const ell = '…';
  let lo = 0, hi = t.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(t.slice(0, mid).trimEnd() + ell, font) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? ell : t.slice(0, lo).trimEnd() + ell;
}

/** Retour à la ligne : par mots (latin), par caractères (idéogrammes ou mot trop long). */
export function wrapText(text: string, maxWidth: number, font: string, measure: Measure, maxLines = Infinity): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    const p = para.trim();
    if (!p) continue;
    const units = CJK.test(p) && !p.includes(' ') ? Array.from(p) : p.split(/\s+/);
    const glue = CJK.test(p) && !p.includes(' ') ? '' : ' ';
    let line = '';
    for (const u of units) {
      const candidate = line ? line + glue + u : u;
      if (measure(candidate, font) <= maxWidth) { line = candidate; continue; }
      if (line) out.push(line);
      // Un mot plus large que la ligne : on le casse caractère par caractère.
      if (measure(u, font) > maxWidth) {
        let chunk = '';
        for (const ch of Array.from(u)) {
          if (measure(chunk + ch, font) <= maxWidth) chunk += ch;
          else { out.push(chunk); chunk = ch; }
        }
        line = chunk;
      } else line = u;
    }
    if (line) out.push(line);
  }
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = fitText(kept[maxLines - 1] + ' ' + out.slice(maxLines).join(' '), maxWidth, font, measure);
    return kept;
  }
  return out;
}

// ── Le plan ──────────────────────────────────────────────────────────────
export function layoutLabel(d: LabelData, measure: Measure): Op[] {
  const ops: Op[] = [];
  const loc = d.settings[d.destination];
  const tag = DESTINATION_LABEL[d.destination];
  const theme = DESTINATION_THEME[d.destination];
  const company = d.settings.company;
  const ourCompany = [company.nameZh.trim(), company.nameEn.trim()].filter(Boolean).join(' ');
  const finalDestination = [d.clientCity, d.clientCountry].filter((v) => v && v.trim()).join(', ');

  const rect = (x: number, y: number, w: number, h: number, color: string, radius?: number) => ops.push({ kind: 'rect', x, y, w, h, color, radius });
  const hair = (y: number) => ops.push({ kind: 'line', x1: X0, y1: y, x2: X1, y2: y, color: HAIR, width: 1 });
  const rule = (y: number) => ops.push({ kind: 'line', x1: X0, y1: y + RULE / 2, x2: X1, y2: y + RULE / 2, color: INK, width: RULE });
  const text = (t: string, x: number, y: number, font: string, color: string, maxWidth: number, align: 'left' | 'right' | 'center' = 'left', row?: string) => {
    const fitted = fitText(t, maxWidth, font, measure);
    if (fitted) ops.push({ kind: 'text', text: fitted, x, y, font, color, align, maxWidth, row });
    return measure(fitted, font);
  };

  /** Intitulé : chinois puis anglais en petites capitales, sur une largeur bornée. */
  const key = (zh: string, en: string, x: number, cy: number, width: number, row: string) => {
    const fz = f(700, 11, FONT_ZH), fe = f(700, 9, FONT_LATIN);
    let cursor = x;
    if (zh) { cursor += text(zh, cursor, cy, fz, MUTED, width, 'left', row) + 5; }
    text(en.toUpperCase(), cursor, cy, fe, MUTED, Math.max(0, x + width - cursor), 'left', row);
  };
  /** Une valeur : à 13,5 px si elle tient, sinon un peu plus petite (jusqu'à 10,5), et seulement alors coupée. */
  const value = (v: string | null | undefined, x: number, cy: number, width: number, row: string, latin = true) => {
    const t = (v ?? '').trim();
    if (!t) return;
    const family = latin && !CJK.test(t) ? FONT_LATIN : FONT_ZH;
    let font = f(800, 13.5, family);
    for (const size of [13.5, 12.5, 11.5, 10.5]) {
      font = f(800, size, family);
      if (measure(t, font) <= width) break;
    }
    text(t, x, cy, font, INK, width, 'left', row);
  };
  /** Ligne à un champ. */
  const row1 = (y: number, h: number, zh: string, en: string, v?: string | null, latin = true) => {
    const cy = y + h / 2, id = `row@${y}`;
    key(zh, en, CX0, cy, KEY_COL - 8, id);
    value(v, CX0 + KEY_COL, cy, CW - KEY_COL, id, latin);
    hair(y + h);
    return y + h;
  };
  /** Ligne à deux champs, sur les mêmes verticales partout. */
  const row2 = (y: number, h: number, a: [string, string, string | null | undefined], b: [string, string, string | null | undefined]) => {
    const cy = y + h / 2, id = `row@${y}`;
    const half = CW / 2;
    key(a[0], a[1], CX0, cy, KEY_COL - 8, id);
    value(a[2], CX0 + KEY_COL, cy, half - KEY_COL - 10, id);
    const x2 = CX0 + half;
    key(b[0], b[1], x2, cy, KEY_COL_2 - 8, id);
    value(b[2], x2 + KEY_COL_2, cy, half - KEY_COL_2, id);
    hair(y + h);
    return y + h;
  };
  /**
   * Bande de titre : numéro · chinois · anglais — et, pour la section de
   * l'adresse, la pastille du mode à droite (pictogramme + nom, aux couleurs
   * du mode) sur un fond teinté.
   */
  const band = (y: number, n: string, zh: string, en: string, right?: string) => {
    rect(X0, y, X1 - X0, BAND_H, right ? theme.tint : BAND);
    const cy = y + BAND_H / 2;
    let x = CX0;
    x += text(n, x, cy, f(900, 10.5, FONT_LATIN), MUTED, 30) + 7;
    x += text(zh, x, cy, f(900, 13, FONT_ZH_DISPLAY), INK, 200) + 7;
    let rightW = 0;
    if (right) {
      const fr = f(900, 11, FONT_ZH_DISPLAY);
      const ICON = 13, PAD = 8;
      rightW = PAD + ICON + 5 + measure(right, fr) + PAD;
      rect(CX1 - rightW, y + 3, rightW, BAND_H - 6, theme.color, 3);
      ops.push({ kind: 'icon', icon: theme.icon, x: CX1 - rightW + PAD, y: cy - ICON / 2, size: ICON, color: WHITE });
      text(right, CX1 - rightW + PAD + ICON + 5, cy, fr, WHITE, rightW - 2 * PAD - ICON - 5);
      rightW += 10;
    }
    text(en.toUpperCase(), x, cy, f(800, 9.5, FONT_LATIN), MUTED, CX1 - rightW - x);
    hair(y + BAND_H);
    return y + BAND_H;
  };

  // Fond blanc + cadre
  rect(0, 0, LABEL_W, LABEL_H, WHITE);
  let y = X0;

  // 0 · Bandeau : LE MODE D'ENVOI d'abord (pictogramme + nom, en très gros,
  //     aux couleurs du mode), puis ce que c'est et quoi en faire. Le liseré du
  //     bas est uni (bateau) ou hachuré (avion) : sur une photocopie en noir
  //     et blanc, c'est ce qui reste pour les distinguer — avec le pictogramme.
  const BANNER_H = 54, STRIP_H = 8;
  rect(X0, y, X1 - X0, BANNER_H, theme.color);
  if (theme.stripes) ops.push({ kind: 'stripes', x: X0, y: y + BANNER_H - STRIP_H, w: X1 - X0, h: STRIP_H, color: WHITE, bg: theme.dark });
  else rect(X0, y + BANNER_H - STRIP_H, X1 - X0, STRIP_H, theme.dark);
  {
    const cy = y + (BANNER_H - STRIP_H) / 2;
    const ICON = 30;
    ops.push({ kind: 'icon', icon: theme.icon, x: CX0, y: cy - ICON / 2, size: ICON, color: WHITE });
    let x = CX0 + ICON + 10;
    x += text(tag.zh, x, cy, f(900, 26, FONT_ZH_DISPLAY), WHITE, 90, 'left', 'banner-zh') + 8;
    x += text(tag.en.toUpperCase(), x, cy + 1, f(900, 15, FONT_LATIN), WHITE, 150, 'left', 'banner-en') + 14;
    const rw = CX1 - x;
    text('发货标签 · 请打印，并贴在每一个纸箱上', CX1, cy - 8, f(900, 12, FONT_ZH_DISPLAY), WHITE, rw, 'right');
    text('Shipping label · print it and stick it on every carton', CX1, cy + 8, f(700, 9, FONT_LATIN), 'rgba(255,255,255,0.88)', rw, 'right');
  }
  y += BANNER_H;

  // 1 · L'adresse — la plus grande chose sur la feuille
  y = band(y, '1', '收件地址', 'Deliver to', `${tag.zh} · ${tag.en.toUpperCase()}`);
  {
    const fzh = f(900, 23, FONT_ZH_DISPLAY), fen = f(600, 10.5, FONT_LATIN);
    const zhLines = wrapText(loc.addressZh, CW, fzh, measure, 3);
    const enLines = loc.addressEn.trim() ? wrapText(loc.addressEn, CW, fen, measure, 2) : [];
    const ZH_LH = 29, EN_LH = 13;
    const blockH = 9 + zhLines.length * ZH_LH + (enLines.length ? 3 + enLines.length * EN_LH : 0) + 8;
    // Un dos de couleur le long de l'adresse : le mode, encore, là où l'œil va.
    rect(X0, y, 6, blockH, theme.color);
    let ly = y + 9;
    for (const l of zhLines) { text(l, CX0, ly + ZH_LH / 2, fzh, INK, CW, 'left', `addr@${ly}`); ly += ZH_LH; }
    if (enLines.length) { ly += 3; for (const l of enLines) { text(l, CX0, ly + EN_LH / 2, fen, MUTED, CW, 'left', `addr@${ly}`); ly += EN_LH; } }
    hair(y + blockH);
    y += blockH;
  }
  y = row1(y, ROW_H, '收件人', 'Recipient', [loc.recipient, ourCompany].filter((v) => v.trim()).join(' · '));
  y = row2(y, ROW_H, ['电话', 'Tel', loc.phone], ['微信', 'WeChat', loc.wechat]);
  y = row1(y, ROW_H, '', 'WhatsApp', loc.whatsapp);
  y = row1(y, ROW_H, '邮箱', 'Email', loc.email || company.email);

  // 2 · Le code client, en QR et en très gros
  rule(y); y += RULE;
  y = band(y, '2', '客户编号', 'Customer ID');
  {
    const QR_BLOCK = 200, QR = 186, LEFT_W = 230;
    ops.push({ kind: 'qr', x: X0 + (LEFT_W - QR) / 2, y: y + (QR_BLOCK - QR) / 2, size: QR });
    ops.push({ kind: 'line', x1: X0 + LEFT_W, y1: y, x2: X0 + LEFT_W, y2: y + QR_BLOCK, color: HAIR, width: 1 });
    const rx = X0 + LEFT_W + PX, rw = CX1 - rx;
    // Le code : aussi gros que la place le permet, jamais coupé.
    let size = 42;
    while (size > 20 && measure(d.code, f(900, size, FONT_LATIN)) > rw) size -= 2;
    const cy = y + QR_BLOCK / 2;
    text(d.code, rx, cy - 22, f(900, size, FONT_LATIN), INK, rw, 'left', 'code');
    text('到货后扫码入库，归属此客户', rx, cy + 14, f(900, 13, FONT_ZH_DISPLAY), INK, rw, 'left', 'code-zh');
    const hint = wrapText('Scanned on arrival — links the carton to this customer.', rw, f(700, 10, FONT_LATIN), measure, 2);
    hint.forEach((l, i) => text(l, rx, cy + 32 + i * 13, f(700, 10, FONT_LATIN), MUTED, rw, 'left', `code-en${i}`));
    y += QR_BLOCK;
  }

  // 3 · Le client
  rule(y); y += RULE;
  y = band(y, '3', '客户', 'Customer');
  y = row1(y, ROW_H, '客户姓名', 'Name', d.clientName);
  y = row2(y, ROW_H, ['电话(非洲)', 'Tel', d.clientPhone || '—'], ['目的地', 'Dest.', finalDestination || '—']);
  y = row1(y, ROW_H, '公司', 'Company', d.companyName || '—');
  y = row1(y, ROW_H, '邮箱', 'Email', d.clientEmail || '—');

  // 5 (réservé) + pied : ancrés en bas, on connaît leur hauteur
  const WH_ROW_H = 34, FOOT_H = 20;
  const bottomBlock = RULE + BAND_H + WH_ROW_H + RULE + FOOT_H;
  const Y1 = LABEL_H - M; // même marge en bas qu'en haut
  const bottomTop = Y1 - bottomBlock;

  // 4 · Le fournisseur — pré-rempli ou à écrire au stylo ; prend la place qui reste
  rule(y); y += RULE;
  y = band(y, '4', '供货商 / 发件人', 'Supplier · Sender');
  {
    const rows = 6;
    const rh = Math.max(26, Math.min(40, Math.floor((bottomTop - y) / rows)));
    const s = d.supplier ?? {};
    y = row1(y, rh, '供货商', 'Supplier', s.name);
    y = row1(y, rh, '电话', 'Tel', s.phone);
    y = row1(y, rh, '邮箱', 'Email', s.email);
    y = row1(y, rh, '地址', 'Address', s.address, false);
    y = row2(y, rh, ['货物品名', 'Goods', ''], ['货物数量(件)', 'Qty', '']);
    y = row2(y, rh, ['发货日期', 'Ship date', ''], ['箱号', 'Carton no.', '']);
  }

  // 5 · Réservé à l'entrepôt — les colonnes du 三联单
  y = bottomTop;
  rule(y); y += RULE;
  y = band(y, '5', '仓库填写', 'Warehouse use only');
  rect(X0, y, X1 - X0, WH_ROW_H, '#F7F7F7');
  {
    const cy = y + WH_ROW_H / 2, third = CW / 3;
    key('到货日期', 'Date', CX0, cy, third - 8, 'wh');
    key('立方', 'CBM', CX0 + third, cy, third - 8, 'wh');
    key('总包数', 'Total', CX0 + 2 * third, cy, third - 8, 'wh');
  }
  y += WH_ROW_H;

  // Pied : rappel du code, lisible même si le QR est abîmé
  rule(y); y += RULE;
  {
    const cy = y + FOOT_H / 2;
    const codeW = text(d.code, CX1, cy, f(700, 11.5, FONT_LATIN), INK, 160, 'right', 'foot');
    text(`${company.nameEn || 'Bonzini'} · ${tag.zh} ${tag.en} · 客户编号 · Customer ID`, CX0, cy, f(700, 10, FONT_ZH), MUTED, CW - codeW - 12, 'left', 'foot');
  }
  y += FOOT_H;

  // Le cadre, par-dessus tout — aux couleurs du mode, un peu plus épais
  const FRAME = 3;
  ops.push({ kind: 'line', x1: X0, y1: X0, x2: X1, y2: X0, color: theme.color, width: FRAME });
  ops.push({ kind: 'line', x1: X0, y1: y, x2: X1, y2: y, color: theme.color, width: FRAME });
  ops.push({ kind: 'line', x1: X0, y1: X0, x2: X0, y2: y, color: theme.color, width: FRAME });
  ops.push({ kind: 'line', x1: X1, y1: X0, x2: X1, y2: y, color: theme.color, width: FRAME });
  return ops;
}

// ── La peinture ──────────────────────────────────────────────────────────
/** Tout le chinois de l'étiquette, pour charger les bons sous-ensembles de Noto SC. */
function chineseSample(d: LabelData): string {
  const loc = d.settings[d.destination];
  return ['发货标签请打印，并贴在每一个纸箱上收件地址收件人电话微信邮箱客户编号到货后扫码入库，归属此客户客户姓名非洲目的地公司供货商发件人地址货物品名货物数量件发货日期箱号仓库填写到货日期立方总包数海运空运',
    loc.addressZh, d.settings.company.nameZh, d.supplier?.address ?? ''].join('');
}

export async function ensureLabelFonts(d: LabelData): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const zh = chineseSample(d);
  const specs: Array<[string, string?]> = [
    ['600 16px "DM Sans"'], ['700 16px "DM Sans"'], ['800 16px "DM Sans"'], ['900 16px "DM Sans"'],
    ['700 16px "Noto Sans SC"', zh], ['800 16px "Noto Sans SC"', zh],
    ['900 16px "Noto Serif SC"', zh],
  ];
  try {
    await Promise.race([
      Promise.all(specs.map(([spec, sample]) => document.fonts.load(spec, sample))),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch { /* on peint avec ce qu'on a — mesuré, donc sans chevauchement */ }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function paintLabel(ctx: CanvasRenderingContext2D, ops: Op[], qr: CanvasImageSource | null): void {
  ctx.textBaseline = 'middle';
  for (const op of ops) {
    if (op.kind === 'rect') {
      ctx.fillStyle = op.color;
      if (op.radius) { roundedRect(ctx, op.x, op.y, op.w, op.h, op.radius); ctx.fill(); }
      else ctx.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.kind === 'line') {
      ctx.strokeStyle = op.color; ctx.lineWidth = op.width;
      ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
    } else if (op.kind === 'text') {
      ctx.font = op.font; ctx.fillStyle = op.color; ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.kind === 'qr' && qr) {
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qr, op.x, op.y, op.size, op.size);
      ctx.imageSmoothingEnabled = prev;
    } else if (op.kind === 'icon') {
      paintIcon(ctx, op);
    } else if (op.kind === 'stripes') {
      paintStripes(ctx, op);
    }
  }
}

/** Le pictogramme : les tracés lucide (grille 24) mis à l'échelle, trait rond. */
function paintIcon(ctx: CanvasRenderingContext2D, op: Extract<Op, { kind: 'icon' }>): void {
  if (typeof Path2D === 'undefined') return;
  ctx.save();
  ctx.translate(op.x, op.y);
  ctx.scale(op.size / 24, op.size / 24);
  ctx.strokeStyle = op.color;
  ctx.lineWidth = 2.25;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of ICON_PATHS[op.icon]) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** Hachures à 45°, blanches sur la teinte sombre : lisibles même en noir et blanc. */
function paintStripes(ctx: CanvasRenderingContext2D, op: Extract<Op, { kind: 'stripes' }>): void {
  ctx.save();
  ctx.fillStyle = op.bg;
  ctx.fillRect(op.x, op.y, op.w, op.h);
  ctx.beginPath(); ctx.rect(op.x, op.y, op.w, op.h); ctx.clip();
  ctx.strokeStyle = op.color;
  ctx.lineWidth = op.h * 0.55;
  ctx.lineCap = 'butt';
  const step = op.h * 1.6;
  for (let x = op.x - op.h; x < op.x + op.w + op.h; x += step) {
    ctx.beginPath(); ctx.moveTo(x, op.y + op.h); ctx.lineTo(x + op.h, op.y); ctx.stroke();
  }
  ctx.restore();
}

/**
 * L'étiquette peinte, à l'échelle demandée. `qr` : un canvas (ou image) qui
 * porte déjà le QR de `customerQrPayload(code)` — voir useShippingLabel().
 */
export async function renderShippingLabel(d: LabelData, qr: CanvasImageSource | null, scale = 3): Promise<HTMLCanvasElement> {
  await ensureLabelFonts(d);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(LABEL_W * scale);
  canvas.height = Math.round(LABEL_H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  ctx.scale(scale, scale);
  const measure: Measure = (t, font) => { ctx.font = font; return ctx.measureText(t).width; };
  paintLabel(ctx, layoutLabel(d, measure), qr);
  return canvas;
}

/** L'étiquette posée sur une page (mm) à sa proportion, centrée, avec une marge. */
export function fitOnPage(labelW: number, labelH: number, pageW = 210, pageH = 297, margin = 8): { x: number; y: number; w: number; h: number } {
  const ratio = labelH / labelW;
  let w = pageW - 2 * margin;
  let h = w * ratio;
  if (h > pageH - 2 * margin) { h = pageH - 2 * margin; w = h / ratio; }
  return { x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

export { customerQrPayload };
