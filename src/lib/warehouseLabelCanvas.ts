// ============================================================
// L'ÉTIQUETTE INTERNE (入库标签) — celle que l'entrepôt colle sur chaque
// carton après l'avoir enregistré, PAR-DESSUS la marque client. Même
// famille que l'étiquette client (shippingLabelCanvas) : mêmes polices, même
// bandeau (bateau ou avion), mêmes bandes numérotées « n · 中文 · ENGLISH »,
// même pied. Ce qu'elle porte en plus : l'identité du carton (QR unique,
// 3/10, numéro de colis), ses mesures, l'entrepôt, le fournisseur, la règle
// de retrait, et un code-barres Code 128 du numéro pour les vieux lecteurs.
// Jamais le prix.
//
// Même mécanique : un PLAN (opérations mesurées) puis une PEINTURE sur
// canvas, avec le peintre de l'étiquette client. 600 × 900 logique = 100 ×
// 150 mm, le format des imprimantes thermiques 4 pouces. Peinte à ×3 pour
// l'impression (~450 dpi sur 100 mm).
// ============================================================
import { DESTINATION_LABEL, DESTINATION_THEME, customerQrPayload, type ShippingDestination, type ShippingSettings } from '@/lib/customerCode';
import { FONT_LATIN, FONT_ZH, FONT_ZH_DISPLAY, fitText, paintLabel, wrapText, type Measure, type Op } from '@/lib/shippingLabelCanvas';
import { code128Bars } from '@/lib/code128';
import type { Parcel, ParcelKind, ReceptionClient, SupplierInfo } from '@/lib/reception';
import { clientFullName, formatCbm, formatDims, formatKg } from '@/lib/reception';

export const WLABEL_W = 600;
export const WLABEL_H = 900;

export interface WarehouseLabelData {
  destination: ShippingDestination;
  settings: ShippingSettings;
  parcel: Pick<Parcel, 'parcel_no' | 'seq' | 'kind' | 'description' | 'weight_kg' | 'length_cm' | 'width_cm' | 'height_cm' | 'cbm'>;
  /** Combien de cartons dans ce dépôt : « 3 / 10 ». */
  count: number;
  depositNo: string;
  client: ReceptionClient | null;
  supplier: SupplierInfo | null;
  receivedAt: string;
  receivedByName?: string | null;
  /** La place dans l'entrepôt, si on la connaît. */
  location?: string | null;
  /** « Douala, Cameroun » par défaut. */
  destinationCity?: string;
  mono?: boolean;
}

/** Le contenu du QR du carton : le code client ET le numéro du colis. Tout lecteur qui ne connaît que le code client y trouve son compte. */
/** La raison sociale, telle qu'elle figure sur les relevés et les bons : pas la marque. */
export const LEGAL_NAME = 'NORTON GAUSS BONZINI SARL';

export function parcelQrPayload(code: string, parcelNo: string): string {
  return `${customerQrPayload(code)}?p=${encodeURIComponent(parcelNo)}`;
}

const INK = '#111111', MUTED = '#555555', HAIR = '#DADADA', BAND = '#EFEFEF', WHITE = '#FFFFFF';
const M = 14, X0 = M, X1 = WLABEL_W - M, PX = 12, CX0 = X0 + PX, CX1 = X1 - PX, CW = CX1 - CX0;
const KEY_COL = 150, KEY_COL_2 = 120, ROW_H = 28, BAND_H = 24, RULE = 2;
const f = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;
const CJK = /[\u3000-\u9fff\uf900-\ufaff]/;
const dash = (v: string | null | undefined) => (v && v.trim() ? v.trim() : '—');

/** Sans description, l'étiquette dit au moins le type de colis, en chinois et en anglais. */
const KIND_LABEL: Record<ParcelKind, string> = { carton: '纸箱 Carton', bag: '袋 Bag', bale: '编织袋 Bale', roll: '卷 Roll', pallet: '托盘 Pallet', other: '其他 Other' };

/** Le lieu de réception, tel que la plateforme le nomme : l'entrepôt pour le bateau, le bureau pour l'avion. */
const RECEIVED_AT_PLACE: Record<ShippingDestination, { zh: string; en: string }> = {
  warehouse: { zh: '仓库', en: 'Warehouse' },
  office: { zh: '办公室', en: 'Office' },
};

/** La date et l'heure de Guangzhou (UTC+8), « 2026-09-21 13:22 » — l'heure où le carton est entré. */
export function formatGuangzhou(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  const z = new Date(t.getTime() + 8 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${z.getUTCFullYear()}-${p(z.getUTCMonth() + 1)}-${p(z.getUTCDate())} ${p(z.getUTCHours())}:${p(z.getUTCMinutes())}`;
}

export function layoutWarehouseLabel(d: WarehouseLabelData, measure: Measure): Op[] {
  const ops: Op[] = [];
  const tag = DESTINATION_LABEL[d.destination];
  const theme = d.mono ? { ...DESTINATION_THEME[d.destination], color: INK, dark: '#000000', tint: BAND } : DESTINATION_THEME[d.destination];
  const loc = d.settings[d.destination];
  const dest = d.destinationCity ?? 'Douala, Cameroun';

  const rect = (x: number, y: number, w: number, h: number, color: string, radius?: number) => ops.push({ kind: 'rect', x, y, w, h, color, radius });
  const hair = (y: number) => ops.push({ kind: 'line', x1: X0, y1: y, x2: X1, y2: y, color: HAIR, width: 1 });
  const rule = (y: number) => ops.push({ kind: 'line', x1: X0, y1: y + RULE / 2, x2: X1, y2: y + RULE / 2, color: INK, width: RULE });
  const text = (t: string, x: number, y: number, font: string, color: string, maxWidth: number, align: 'left' | 'right' | 'center' = 'left', row?: string) => {
    const fitted = fitText(t, maxWidth, font, measure);
    if (fitted) ops.push({ kind: 'text', text: fitted, x, y, font, color, align, maxWidth, row });
    return measure(fitted, font);
  };
  const key = (zh: string, en: string, x: number, cy: number, width: number, row: string) => {
    let cursor = x;
    if (zh) cursor += text(zh, cursor, cy, f(700, 12, FONT_ZH), '#333333', width, 'left', row) + 6;
    text(en.toUpperCase(), cursor, cy, f(700, 9.5, FONT_LATIN), MUTED, Math.max(0, x + width - cursor), 'left', row);
  };
  // Une valeur trop longue pour sa case rétrécit (jusqu'à 10 px) avant d'être coupée : rien ne déborde.
  const MIN_VALUE_PX = 10;
  const valueFont = (t: string, width: number, size: number) => {
    const family = CJK.test(t) ? FONT_ZH : FONT_LATIN;
    for (let px = size; px > MIN_VALUE_PX; px -= 0.5) { const font = f(700, px, family); if (measure(t, font) <= width) return font; }
    return f(700, MIN_VALUE_PX, family);
  };
  const value = (v: string | null | undefined, x: number, cy: number, width: number, row: string, size = 16) => {
    const t = dash(v);
    text(t, x, cy, valueFont(t, width, size), INK, width, 'left', row);
  };
  const row1 = (y: number, zh: string, en: string, v?: string | null, size = 16, h = ROW_H) => {
    const cy = y + h / 2, id = `row@${y}`;
    key(zh, en, CX0, cy, KEY_COL - 8, id);
    value(v, CX0 + KEY_COL, cy, CW - KEY_COL, id, size);
    hair(y + h);
    return y + h;
  };
  // Deux cases sur une ligne. La coupe demandée ne tient qu'à condition que les deux valeurs
  // y tiennent ; sinon la ligne se partage au prorata de ce que chacune a à dire.
  const keyWidth = (zh: string, en: string) => (zh ? measure(zh, f(700, 12, FONT_ZH)) + 6 : 0) + measure(en.toUpperCase(), f(700, 9.5, FONT_LATIN)) + 14;
  const row2 = (y: number, a: [string, string, string | null | undefined], b: [string, string, string | null | undefined], sizeA = 16, split = 0.5) => {
    const cy = y + ROW_H / 2, id = `row@${y}`;
    const vA = measure(dash(a[2]), valueFont(dash(a[2]), Infinity, sizeA));
    const vB = measure(dash(b[2]), valueFont(dash(b[2]), Infinity, 16));
    let kA = KEY_COL, kB = KEY_COL_2;
    let leftW = Math.round(CW * split);
    if (kA + 10 + vA > leftW || kB + vB > CW - leftW) {
      // Trop long pour la coupe habituelle. D'abord on déplace la coupe, clés alignées comme
      // les autres lignes ; si même ainsi les valeurs devraient descendre sous 12 px, les clés
      // se resserrent sur leur texte. Dans tous les cas la place des deux valeurs se partage au
      // prorata de ce que chacune mesure : elles rétrécissent ensemble, jamais coupées.
      const share = vA / Math.max(1, vA + vB);
      const scale = (CW - kA - 10 - kB) / Math.max(1, vA + vB);
      if (scale < 12 / Math.max(sizeA, 16)) {
        kA = Math.min(KEY_COL, Math.ceil(keyWidth(a[0], a[1])));
        kB = Math.min(KEY_COL_2, Math.ceil(keyWidth(b[0], b[1])));
      }
      const avail = CW - kA - 10 - kB;
      const leftVal = vA + vB <= avail ? vA + (avail - vA - vB) * share : avail * share;
      leftW = Math.round(Math.min(CW * 0.75, Math.max(CW * 0.25, kA + 10 + leftVal)));
    }
    key(a[0], a[1], CX0, cy, kA - 8, id);
    value(a[2], CX0 + kA, cy, leftW - kA - 10, id, sizeA);
    const x2 = CX0 + leftW;
    key(b[0], b[1], x2, cy, kB - 8, id);
    value(b[2], x2 + kB, cy, CW - leftW - kB, id);
    hair(y + ROW_H);
    return y + ROW_H;
  };
  const band = (y: number, n: string, zh: string, en: string) => {
    rect(X0, y, X1 - X0, BAND_H, BAND);
    const cy = y + BAND_H / 2;
    let x = CX0;
    x += text(n, x, cy, f(800, 11, FONT_LATIN), '#333333', 30) + 8;
    x += text(zh, x, cy, f(700, 13, FONT_ZH_DISPLAY), '#333333', 220) + 8;
    text(en.toUpperCase(), x, cy, f(700, 10.5, FONT_LATIN), MUTED, CX1 - x);
    rule(y + BAND_H - RULE);
    return y + BAND_H;
  };

  rect(0, 0, WLABEL_W, WLABEL_H, WHITE);
  let y = 0;

  // 0 · Le bandeau : le mode, en grand, comme sur la marque client.
  const BANNER_H = 78, STRIP_H = 7;
  rect(0, 0, WLABEL_W, BANNER_H, theme.color);
  if (theme.stripes) ops.push({ kind: 'stripes', x: 0, y: BANNER_H - STRIP_H, w: WLABEL_W, h: STRIP_H, color: WHITE, bg: theme.dark });
  else rect(0, BANNER_H - STRIP_H, WLABEL_W, STRIP_H, theme.dark);
  {
    const cy = (BANNER_H - STRIP_H) / 2 + 1;
    const ICON = 54;
    ops.push({ kind: 'icon', icon: theme.icon, x: CX0, y: cy - ICON / 2, size: ICON, color: WHITE });
    let x = CX0 + ICON + 14;
    x += text(tag.zh, x, cy, f(900, 38, FONT_ZH_DISPLAY), WHITE, 100, 'left', 'banner-zh') + 10;
    x += text(tag.en.toUpperCase(), x, cy + 2, f(900, 21, FONT_LATIN), WHITE, 170, 'left', 'banner-en') + 12;
    const rw = CX1 - x;
    text('入库标签 · 仓库收货后贴在纸箱上', CX1, cy - 10, f(900, 12, FONT_ZH_DISPLAY), WHITE, rw, 'right');
    text('Warehouse label · applied at intake over the customer label', CX1, cy + 8, f(700, 8.5, FONT_LATIN), 'rgba(255,255,255,0.9)', rw, 'right');
  }
  y = BANNER_H + 8;
  const frameTop = y;

  // 1 · Le carton : le QR, 3 / 10, le numéro.
  y = band(y, '1', '箱号', 'Carton no.');
  {
    const BLOCK = 150, QR = 134;
    ops.push({ kind: 'qr', x: CX0 + 6, y: y + (BLOCK - QR) / 2, size: QR });
    const rx = CX0 + QR + 26, rw = CX1 - rx;
    const big = f(900, 66, FONT_LATIN);
    const n = String(d.parcel.seq);
    const nW = text(n, rx, y + 44, big, INK, rw, 'left', 'big');
    text(`/ ${d.count}`, rx + nW + 4, y + 52, f(800, 28, FONT_LATIN), '#444444', rw - nW - 4, 'left', 'big');
    text('货物编号 · PARCEL NO.', rx, y + 90, f(700, 11, FONT_ZH), MUTED, rw, 'left', 'pno-k');
    let size = 30;
    while (size > 18 && measure(d.parcel.parcel_no, f(800, size, FONT_LATIN)) > rw) size -= 2;
    text(d.parcel.parcel_no, rx, y + 112, f(800, size, FONT_LATIN), INK, rw, 'left', 'pno');
    const rk = text('入仓单 · RECEIPT', rx, y + 138, f(700, 11, FONT_ZH), MUTED, rw, 'left', 'rc-k');
    text(d.depositNo, rx + rk + 10, y + 138, f(700, 13, FONT_LATIN), INK, rw - rk - 10, 'left', 'rc');
    hair(y + BLOCK);
    y += BLOCK;
  }

  // 2 · Le client.
  const c = d.client;
  y = band(y, '2', '客户', 'Customer');
  y = row2(y, ['客户姓名', 'Name', c ? clientFullName(c) : '—'], ['账户', 'Account', c?.account_name ?? '—'], 18, 0.56);
  y = row1(y, '客户编号', 'Customer ID', c?.customer_code ?? '—', 22);
  y = row2(y, ['电话(非洲)', 'Tel', c?.phone ?? '—'], ['目的地', 'Dest.', dest], 16, 0.56);

  // 3 · La marchandise.
  const p = d.parcel;
  y = band(y, '3', '货物', 'Goods');
  y = row1(y, '货物品名', 'Goods', p.description || KIND_LABEL[p.kind] || p.kind);
  y = row2(y, ['重量', 'Weight', formatKg(p.weight_kg)], ['尺寸', 'Dimensions', formatDims(p)], 16, 0.42);
  y = row2(y, ['立方', 'CBM', formatCbm(p.cbm)], ['总包数', 'Total', `${d.count} 箱`], 16, 0.56);

  // 4 · Où et quand on l'a reçu : l'entrepôt (bateau) ou le bureau (avion) — le lieu de la
  // plateforme —, la date et l'heure de Guangzhou, qui l'a reçu, et sa place si on en a une.
  y = band(y, '4', '收货地点', 'Location');
  const place = `${RECEIVED_AT_PLACE[d.destination].zh} ${RECEIVED_AT_PLACE[d.destination].en} · 广州 Guangzhou`;
  y = d.location ? row2(y, ['地点', 'Place', place], ['货位', 'Shelf', d.location], 16, 0.62) : row1(y, '地点', 'Place', place);
  y = row2(y, ['到货日期', 'Date', formatGuangzhou(d.receivedAt)], ['收货人', 'Received by', d.receivedByName ?? loc.recipient], 16, 0.5);

  // 5 · Le fournisseur.
  const s = d.supplier;
  y = band(y, '5', '供货商 / 发件人', 'Supplier · Sender');
  y = row1(y, s?.kind === 'buying_agent' ? '采购代理' : '供货商', s?.kind === 'buying_agent' ? 'Buying agent' : 'Supplier', s?.name);
  y = row2(y, ['联系人', 'Contact', s?.contact], ['电话', 'Tel', s?.phone], 16, 0.56);
  y = row2(y, ['邮箱', 'Email', s?.email], ['微信', 'WeChat', s?.wechat], 14, 0.56);
  {
    const H = 40, cy = y + H / 2, id = `row@${y}`;
    key('地址', 'Address', CX0, cy, KEY_COL - 8, id);
    const font = f(600, 13, CJK.test(s?.address ?? '') ? FONT_ZH : FONT_LATIN);
    const lines = s?.address ? wrapText(s.address, CW - KEY_COL, font, measure, 2) : ['—'];
    lines.forEach((l, i) => text(l, CX0 + KEY_COL, cy + (i - (lines.length - 1) / 2) * 16, font, INK, CW - KEY_COL, 'left', `${id}-${i}`));
    hair(y + H); y += H;
  }

  // 6 · La règle de retrait.
  y = band(y, '6', '提货', 'Pickup · Douala');
  text('凭客户编号和有效证件提货，货款结清后放行。', CX0, y + 15, f(700, 14, FONT_ZH_DISPLAY), INK, CW, 'left', 'pick-zh');
  const en = wrapText('Pickup with the customer ID and a valid ID document. Released once the shipment is fully paid.', CW, f(600, 11, FONT_LATIN), measure, 2);
  en.forEach((l, i) => text(l, CX0, y + 33 + i * 13, f(600, 11, FONT_LATIN), '#333333', CW, 'left', `pick-en${i}`));
  y += 30 + en.length * 13 + 4;

  // Le code-barres : le numéro du colis, pour les lecteurs à barres.
  rule(y); y += RULE;
  {
    const H = 40, PADY = 8;
    const { bars, totalModules } = code128Bars(d.parcel.parcel_no, 8);
    const unit = Math.min(2.2, (CW - 40) / totalModules);
    const w = totalModules * unit;
    const x0 = CX0 + (CW - w) / 2;
    for (const b of bars) rect(x0 + b.x * unit, y + PADY, b.w * unit, H, INK);
    y += PADY + H + 4;
    text(d.parcel.parcel_no.split('').join(' '), WLABEL_W / 2, y + 8, f(800, 14, FONT_LATIN), INK, CW, 'center', 'bc');
    y += 20;
  }

  // Le pied, comme sur la marque client.
  rule(y); y += RULE;
  {
    const cy = y + 13;
    const left = `${LEGAL_NAME}  ·  ${loc.recipient}${loc.wechat ? ` · WeChat ${loc.wechat}` : ''}  ·  ${tag.zh}`;
    const rightW = measure(d.parcel.parcel_no, f(800, 14, FONT_LATIN)) + 8;
    text(left, CX0, cy, f(700, 11, CJK.test(left) ? FONT_ZH : FONT_LATIN), '#333333', CW - rightW, 'left', 'foot');
    text(d.parcel.parcel_no, CX1, cy, f(800, 14, FONT_LATIN), INK, rightW, 'right', 'foot');
    y += 26;
  }

  // Le cadre, une fois la hauteur connue.
  const frameH = Math.min(WLABEL_H - M, y) - frameTop;
  ops.push({ kind: 'line', x1: X0, y1: frameTop, x2: X1, y2: frameTop, color: INK, width: RULE });
  ops.push({ kind: 'line', x1: X0, y1: frameTop + frameH, x2: X1, y2: frameTop + frameH, color: INK, width: RULE });
  ops.push({ kind: 'line', x1: X0, y1: frameTop, x2: X0, y2: frameTop + frameH, color: INK, width: RULE });
  ops.push({ kind: 'line', x1: X1, y1: frameTop, x2: X1, y2: frameTop + frameH, color: INK, width: RULE });
  return ops;
}

const ZH_SAMPLE = '入库标签仓库收货后贴在纸箱上箱号货物编号入仓单客户姓名账户编号电话非洲目的地品名重量尺寸立方总包数到货日期收货人位置供货商发件人采购代理联系人邮箱微信地址提货凭客户编号和有效证件提货货款结清后放行海运空运';

async function ensureFonts(sample: string): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const specs: Array<[string, string?]> = [
    ['600 16px "DM Sans"'], ['700 16px "DM Sans"'], ['800 16px "DM Sans"'], ['900 16px "DM Sans"'],
    ['700 16px "Noto Sans SC"', sample], ['900 16px "Noto Sans SC"', sample],
  ];
  try {
    await Promise.race([Promise.all(specs.map(([spec, s]) => document.fonts.load(spec, s))), new Promise((r) => setTimeout(r, 4000))]);
  } catch { /* on peint avec ce qu'on a — mesuré, donc sans chevauchement */ }
}

/** L'étiquette interne peinte, à l'échelle demandée. `qr` : un canvas qui porte déjà le QR de parcelQrPayload(). */
export async function renderWarehouseLabel(d: WarehouseLabelData, qr: CanvasImageSource | null, scale = 3): Promise<HTMLCanvasElement> {
  await ensureFonts(ZH_SAMPLE + (d.supplier?.address ?? '') + (d.supplier?.name ?? '') + (d.parcel.description ?? ''));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WLABEL_W * scale);
  canvas.height = Math.round(WLABEL_H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  ctx.scale(scale, scale);
  const measure: Measure = (t, font) => { ctx.font = font; return ctx.measureText(t).width; };
  paintLabel(ctx, layoutWarehouseLabel(d, measure), qr);
  return canvas;
}
