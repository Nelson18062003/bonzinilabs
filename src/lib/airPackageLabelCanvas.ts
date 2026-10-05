// ============================================================
// L'ÉTIQUETTE DU PAQUET AVION (航空包裹) — collée sur chaque paquet de 32 kg
// fermé au bureau de Guangzhou. Même famille que l'étiquette interne d'un
// colis (warehouseLabelCanvas) : bandeau avion hachuré, bandes numérotées
// « n · 中文 · ENGLISH », QR + Code 128, même pied. Ce qu'elle dit :
//   · le numéro PQ-…, en très grand (on le lit de loin, à l'aéroport) ;
//   · le QR et le code-barres du numéro (scan au départ, réception à Douala) ;
//   · le poids pesé « 31,5 kg / 32 kg », le nombre de colis et de clients ;
//   · les codes clients et les numéros de colis (autant qu'il en tient) ;
//   · la date de fermeture, et l'expédition (LTA ou vol + date) une fois affecté.
// Jamais le prix.
//
// Même mécanique : un PLAN pur (layoutPackageLabel, testable sans canvas)
// puis la PEINTURE du peintre commun. 600 × 900 logique = 100 × 150 mm.
// ============================================================
import { DESTINATION_THEME } from '@/lib/customerCode';
import { FONT_LATIN, FONT_ZH, FONT_ZH_DISPLAY, fitText, paintLabel, type Measure, type Op } from '@/lib/shippingLabelCanvas';
import { code128Bars } from '@/lib/code128';
import { ensureFonts, formatGuangzhou } from '@/lib/warehouseLabelCanvas';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import { fmtKg1, packageClientCodes, type AirPackage } from '@/lib/airPackage';
import { formatAwb, isProvisionalAwb } from '@/lib/airShipment';

export const PLABEL_W = 600;
export const PLABEL_H = 900;

export interface PackageLabelExpedition {
  awb: string | null;
  flightNo: string | null;
  /** Date de départ prévue, « 2026-10-08 ». */
  etd: string | null;
}

export interface PackageLabelData {
  packageNo: string;
  grossWeightKg: number | null;
  maxWeightKg: number;
  netWeightKg: number;
  parcelCount: number;
  clientCount: number;
  /** Les codes clients, dans l'ordre des colis. */
  clientCodes: string[];
  /** Les numéros de colis (RC-…), dans l'ordre du paquet. */
  parcelNos: string[];
  sealedAt: string | null;
  dims: [number | null, number | null, number | null];
  /** L'expédition, une fois le paquet affecté. */
  expedition: PackageLabelExpedition | null;
}

/** Le paquet tel que l'étiquette le lit (la fiche complète, avec ses colis). */
export function packageLabelData(p: AirPackage): PackageLabelData {
  const parcels = p.parcels ?? [];
  return {
    packageNo: p.package_no,
    grossWeightKg: p.gross_weight_kg == null ? null : Number(p.gross_weight_kg),
    maxWeightKg: Number(p.max_weight_kg) || 32,
    netWeightKg: Number(p.net_weight_kg) || 0,
    parcelCount: p.parcel_count,
    clientCount: p.client_count,
    clientCodes: packageClientCodes(parcels),
    parcelNos: parcels.map((x) => x.parcel_no),
    sealedAt: p.sealed_at,
    dims: [p.length_cm, p.width_cm, p.height_cm],
    expedition: p.air_shipment_id ? { awb: p.awb_number, flightNo: p.flight_no, etd: p.etd } : null,
  };
}

/** « LTA 071-12345675 · ET 607 · 2026-10-08 » : la LTA si elle est connue (pas provisoire), le vol, la date. */
export function expeditionLine(e: PackageLabelExpedition | null): string | null {
  if (!e) return null;
  const parts: string[] = [];
  if (e.awb && !isProvisionalAwb(e.awb)) parts.push(`LTA ${formatAwb(e.awb)}`);
  if (e.flightNo) parts.push(e.flightNo);
  if (e.etd) parts.push(e.etd.slice(0, 10));
  return parts.length ? parts.join(' · ') : null;
}

const INK = '#111111', MUTED = '#555555', HAIR = '#DADADA', BAND = '#EFEFEF', WHITE = '#FFFFFF';
const M = 14, X0 = M, X1 = PLABEL_W - M, PX = 12, CX0 = X0 + PX, CX1 = X1 - PX, CW = CX1 - CX0;
const BAND_H = 24, ROW_H = 28, RULE = 2;
/** La grille des numéros de colis : quatre colonnes, une ligne de 19 px. */
export const PARCEL_COLS = 4;
const PARCEL_ROW_H = 19;
/** Le bas de l'étiquette (bande 3, deux lignes, code-barres, pied) : ancré en bas, quoi qu'il y ait au-dessus. */
const BOTTOM_H = BAND_H + 2 * ROW_H + RULE + 8 + 46 + 4 + 22 + RULE + 24;
const f = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;
const CJK = /[\u3000-\u9fff\uf900-\ufaff]/;

const dimsText = (dims: PackageLabelData['dims']): string | null => {
  if (dims.some((v) => v == null || !(Number(v) > 0))) return null;
  return `${dims.map((v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',')).join(' × ')} cm`;
};

/**
 * Les codes clients sur `maxLines` lignes au plus : autant de codes qu'il en
 * tient, puis « +N » pour le reste. Un code n'est jamais coupé, une ligne ne
 * commence jamais par le séparateur.
 */
export function fitCodes(codes: readonly string[], width: number, font: string, measure: Measure, maxLines: number): string[] {
  if (codes.length === 0) return ['—'];
  const SEP = '  ·  ';
  const pack = (items: readonly string[]): string[] => {
    const lines: string[] = [];
    let cur = '';
    for (const it of items) {
      const candidate = cur ? cur + SEP + it : it;
      if (!cur || measure(candidate, font) <= width) cur = candidate;
      else { lines.push(cur); cur = it; }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  for (let k = codes.length; k >= 1; k--) {
    const rest = codes.length - k;
    const lines = pack(rest > 0 ? [...codes.slice(0, k), `+${rest}`] : codes);
    if (lines.length <= maxLines && lines.every((l) => measure(l, font) <= width)) return lines;
  }
  return [`+${codes.length}`];
}

export function layoutPackageLabel(d: PackageLabelData, measure: Measure): Op[] {
  const ops: Op[] = [];
  const theme = DESTINATION_THEME.office;

  const rect = (x: number, y: number, w: number, h: number, color: string) => ops.push({ kind: 'rect', x, y, w, h, color });
  const hair = (y: number) => ops.push({ kind: 'line', x1: X0, y1: y, x2: X1, y2: y, color: HAIR, width: 1 });
  const rule = (y: number) => ops.push({ kind: 'line', x1: X0, y1: y + RULE / 2, x2: X1, y2: y + RULE / 2, color: INK, width: RULE });
  const text = (t: string, x: number, y: number, font: string, color: string, maxWidth: number, align: 'left' | 'right' | 'center' = 'left', row?: string) => {
    const fitted = fitText(t, maxWidth, font, measure);
    if (fitted) ops.push({ kind: 'text', text: fitted, x, y, font, color, align, maxWidth, row });
    return measure(fitted, font);
  };
  /** L'intitulé « 中文 ENGLISH » ; renvoie sa largeur. */
  const key = (zh: string, en: string, x: number, cy: number, width: number, row?: string) => {
    let cursor = x;
    if (zh) cursor += text(zh, cursor, cy, f(700, 12, FONT_ZH), '#333333', width, 'left', row) + 6;
    cursor += text(en.toUpperCase(), cursor, cy, f(700, 9.5, FONT_LATIN), MUTED, Math.max(0, x + width - cursor), 'left', row);
    return cursor - x;
  };
  /** Une valeur qui rétrécit (jusqu'à 10 px) plutôt que d'être coupée. */
  const value = (v: string, x: number, cy: number, width: number, size: number, row?: string, weight = 700) => {
    const family = CJK.test(v) ? FONT_ZH : FONT_LATIN;
    let px = size;
    while (px > 10 && measure(v, f(weight, px, family)) > width) px -= 0.5;
    return text(v, x, cy, f(weight, px, family), INK, width, 'left', row);
  };
  /** Intitulé puis valeur, sur une ligne de `width`. */
  const kv = (zh: string, en: string, v: string, x: number, cy: number, width: number, size = 16, row?: string) => {
    const kw = key(zh, en, x, cy, Math.min(width * 0.55, 170), row);
    value(v, x + kw + 10, cy, width - kw - 10, size, row);
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

  rect(0, 0, PLABEL_W, PLABEL_H, WHITE);

  // 0 · Le bandeau : avion rouge hachuré, « PAQUET AVION » en toutes lettres.
  const BANNER_H = 80, STRIP_H = 8;
  rect(0, 0, PLABEL_W, BANNER_H, theme.color);
  ops.push({ kind: 'stripes', x: 0, y: BANNER_H - STRIP_H, w: PLABEL_W, h: STRIP_H, color: WHITE, bg: theme.dark });
  {
    const cy = (BANNER_H - STRIP_H) / 2 + 1;
    const ICON = 54;
    ops.push({ kind: 'icon', icon: theme.icon, x: CX0, y: cy - ICON / 2, size: ICON, color: WHITE });
    let x = CX0 + ICON + 14;
    x += text('空运', x, cy, f(900, 36, FONT_ZH_DISPLAY), WHITE, 90, 'left', 'banner-zh') + 10;
    x += text('PAQUET AVION', x, cy + 2, f(900, 26, FONT_LATIN), WHITE, 210, 'left', 'banner-fr') + 12;
    const rw = CX1 - x;
    text('航空包裹', CX1, cy - 10, f(900, 15, FONT_ZH_DISPLAY), WHITE, rw, 'right');
    text(`Air package · max ${fmtKg1(d.maxWeightKg)}`, CX1, cy + 9, f(700, 9.5, FONT_LATIN), 'rgba(255,255,255,0.92)', rw, 'right');
  }
  let y = BANNER_H + 8;
  const frameTop = y;

  // 1 · Le numéro du paquet, aussi grand que la largeur le permet.
  {
    // 92 px au plus : la queue du Q reste au-dessus du filet.
    const H = 124;
    text('包裹编号 · PACKAGE NO.', CX0, y + 16, f(700, 11, FONT_ZH), MUTED, CW, 'left', 'no-k');
    let size = 92;
    while (size > 48 && measure(d.packageNo, f(900, size, FONT_LATIN)) > CW) size -= 2;
    text(d.packageNo, PLABEL_W / 2, y + 70, f(900, size, FONT_LATIN), INK, CW, 'center', 'no');
    hair(y + H);
    y += H;
  }

  // 2 · Le QR, et les chiffres qui comptent : le poids pesé sur 32 kg, les colis, les clients.
  {
    const H = 176, QR = 158;
    ops.push({ kind: 'qr', x: CX0 + 2, y: y + (H - QR) / 2, size: QR });
    const sep = CX0 + QR + 14;
    ops.push({ kind: 'line', x1: sep, y1: y, x2: sep, y2: y + H, color: HAIR, width: 1 });
    const rx = sep + 16, rw = CX1 - rx, half = Math.floor(rw / 2);

    key('毛重', 'Gross weight', rx, y + 18, rw, 'w-k');
    const gross = d.grossWeightKg != null ? fmtKg1(d.grossWeightKg) : '—';
    const max = `/ ${fmtKg1(d.maxWeightKg)}`;
    const maxFont = f(800, 22, FONT_LATIN);
    const maxW = measure(max, maxFont);
    let gsize = 46;
    while (gsize > 24 && measure(gross, f(900, gsize, FONT_LATIN)) + 8 + maxW > rw) gsize -= 1;
    const gW = text(gross, rx, y + 54, f(900, gsize, FONT_LATIN), INK, rw - maxW - 8, 'left', 'w');
    text(max, rx + gW + 8, y + 60, maxFont, '#444444', rw - gW - 8, 'left', 'w');

    key('件数', 'Parcels', rx, y + 92, half - 8, 'n-k');
    key('客户', 'Customers', rx + half, y + 92, rw - half, 'n-k');
    text(String(d.parcelCount), rx, y + 121, f(900, 32, FONT_LATIN), INK, half - 8, 'left', 'n');
    text(String(d.clientCount), rx + half, y + 121, f(900, 32, FONT_LATIN), INK, rw - half, 'left', 'n');

    kv('净重', 'Net', fmtKg1(d.netWeightKg), rx, y + 156, half - 8, 14, 'net');
    kv('尺寸', 'Dim.', dimsText(d.dims) ?? '—', rx + half, y + 156, rw - half, 14, 'net');
    hair(y + H);
    y += H;
  }

  // 3 · Les clients : leurs codes, sur deux lignes au plus (« +N » pour le reste).
  y = band(y, '1', '客户', `Customers · ${d.clientCount}`);
  {
    const font = f(800, 16, FONT_LATIN);
    const lines = fitCodes(d.clientCodes, CW, font, measure, 2);
    const H = 8 + lines.length * 22 + 4;
    lines.forEach((l, i) => text(l, CX0, y + 8 + 11 + i * 22, font, INK, CW, 'left', `codes-${i}`));
    hair(y + H);
    y += H;
  }

  // 4 · Les colis : la grille des numéros, autant qu'il en tient au-dessus du bas ancré.
  y = band(y, '2', '货物', `Parcels · ${d.parcelCount}`);
  const bottomTop = PLABEL_H - M - BOTTOM_H;
  {
    const top = y + 6;
    const rows = Math.max(1, Math.floor((bottomTop - 4 - top) / PARCEL_ROW_H));
    const capacity = rows * PARCEL_COLS;
    const all = d.parcelNos;
    const shown = all.length > capacity ? all.slice(0, capacity - 1) : all;
    const cells = all.length > capacity ? [...shown, `+${all.length - shown.length}`] : shown;
    const colW = CW / PARCEL_COLS;
    const font = f(700, 13, FONT_LATIN);
    cells.forEach((no, i) => {
      const r = Math.floor(i / PARCEL_COLS), c = i % PARCEL_COLS;
      const more = i === cells.length - 1 && all.length > capacity;
      text(no, CX0 + c * colW, top + r * PARCEL_ROW_H + PARCEL_ROW_H / 2, more ? f(900, 13, FONT_LATIN) : font, INK, colW - 6, 'left', `rc-${r}`);
    });
    if (all.length === 0) text('—', CX0, top + PARCEL_ROW_H / 2, font, INK, CW, 'left', 'rc-0');
  }

  // 5 · Fermé quand, part par quoi. Ancré en bas de l'étiquette.
  y = band(bottomTop, '3', '封箱 · 航班', 'Sealed · Flight');
  {
    const cy = y + ROW_H / 2, half = Math.floor(CW * 0.56);
    kv('封箱日期', 'Sealed', d.sealedAt ? formatGuangzhou(d.sealedAt) : '—', CX0, cy, half - 10, 16, 'sealed');
    kv('目的地', 'Dest.', 'Douala (DLA)', CX0 + half, cy, CW - half, 16, 'sealed');
    hair(y + ROW_H);
    y += ROW_H;
  }
  {
    const cy = y + ROW_H / 2;
    kv('航班', 'Flight · LTA', expeditionLine(d.expedition) ?? '待分配 · To be assigned', CX0, cy, CW, 16, 'flight');
    y += ROW_H;
  }

  // Le code-barres : le numéro du paquet, pour les lecteurs à barres.
  rule(y); y += RULE;
  {
    const H = 46, PADY = 8;
    const { bars, totalModules } = code128Bars(d.packageNo, 10);
    const unit = Math.min(2.6, (CW - 40) / totalModules);
    const w = totalModules * unit;
    const x0 = CX0 + (CW - w) / 2;
    for (const b of bars) rect(x0 + b.x * unit, y + PADY, b.w * unit, H, INK);
    y += PADY + H + 4;
    text(d.packageNo.split('').join(' '), PLABEL_W / 2, y + 10, f(800, 16, FONT_LATIN), INK, CW, 'center', 'bc');
    y += 22;
  }

  // Le pied.
  rule(y); y += RULE;
  {
    const cy = y + 12;
    const left = `${LEGAL_NAME}  ·  广州 Guangzhou → Douala  ·  空运`;
    const rightW = measure(d.packageNo, f(800, 14, FONT_LATIN)) + 8;
    text(left, CX0, cy, f(700, 11, FONT_ZH), '#333333', CW - rightW, 'left', 'foot');
    text(d.packageNo, CX1, cy, f(800, 14, FONT_LATIN), INK, rightW, 'right', 'foot');
  }

  // Le cadre, de sous le bandeau au bas de l'étiquette.
  const frameBottom = PLABEL_H - M;
  ops.push({ kind: 'line', x1: X0, y1: frameTop, x2: X1, y2: frameTop, color: INK, width: RULE });
  ops.push({ kind: 'line', x1: X0, y1: frameBottom, x2: X1, y2: frameBottom, color: INK, width: RULE });
  ops.push({ kind: 'line', x1: X0, y1: frameTop, x2: X0, y2: frameBottom, color: INK, width: RULE });
  ops.push({ kind: 'line', x1: X1, y1: frameTop, x2: X1, y2: frameBottom, color: INK, width: RULE });
  return ops;
}

const ZH_SAMPLE = '空运航空包裹包裹编号毛重件数客户净重尺寸货物封箱日期目的地航班待分配广州';

/** L'étiquette du paquet peinte, à l'échelle demandée. `qr` : un canvas qui porte déjà le QR de packageQrPayload(). */
export async function renderPackageLabel(d: PackageLabelData, qr: CanvasImageSource | null, scale = 3): Promise<HTMLCanvasElement> {
  await ensureFonts(ZH_SAMPLE);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PLABEL_W * scale);
  canvas.height = Math.round(PLABEL_H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  ctx.scale(scale, scale);
  const measure: Measure = (t, font) => { ctx.font = font; return ctx.measureText(t).width; };
  paintLabel(ctx, layoutPackageLabel(d, measure), qr);
  return canvas;
}
