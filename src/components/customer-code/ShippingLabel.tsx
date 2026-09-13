// ============================================================
// ÉTIQUETTE D'EXPÉDITION (发货标签) — la feuille que le fournisseur chinois
// IMPRIME et COLLE sur chaque carton. UNE destination par étiquette
// (entrepôt OU bureau).
//
// Un FORMULAIRE, pas une affiche : cinq sections numérotées, chacune sous
// une bande de titre, chacune faite de LIGNES identiques — une colonne
// d'intitulés à largeur fixe, une colonne de valeurs qui commencent toutes
// au même endroit, un filet entre deux lignes. Rien ne « commence quelque
// part et finit ailleurs » : tout ce qui se lit est aligné sur deux
// verticales. Chinois d'abord, anglais en petites capitales, noir sur blanc
// pour l'imprimante laser d'usine.
//
//   0  bandeau — ce que c'est, quoi en faire (imprimer, coller)
//   1  收件地址 — l'adresse (la plus grande chose sur la feuille), le
//      destinataire et nos coordonnées : tél., WeChat, WhatsApp, e-mail
//   2  客户编号 — le QR, grand, et le code en très gros
//   3  客户 — le client : nom, tél. Afrique, société, destination, e-mail
//   4  供货商 — le fournisseur : pré-rempli, sinon des lignes à remplir
//   5  仓库填写 — réservé à l'entrepôt : date d'arrivée, cubage, total
//
// Les intitulés reprennent MOT POUR MOT le bon de réception papier (三联单)
// de l'entrepôt. Les adresses et coordonnées viennent des réglages
// (platform_settings), passés en prop.
// Taille fixe 600 × 850 px — le ratio des formats A : le nœud est rasterisé
// tel quel et posé sur une page A4 dans le PDF.
// ============================================================
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { customerQrPayload, DESTINATION_LABEL, type ShippingDestination, type ShippingSettings } from '@/lib/customerCode';

export const LABEL_W = 600;
export const LABEL_H = 850;

/** Ce qu'on sait du fournisseur au moment de générer l'étiquette (optionnel). */
export interface LabelSupplierInfo {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ShippingLabelProps {
  code: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  companyName?: string | null;
  /** Ville / pays de livraison finale (Douala, Cameroun) — utile au tri à l'entrepôt. */
  clientCity?: string | null;
  clientCountry?: string | null;
  destination: ShippingDestination;
  settings: ShippingSettings;
  supplier?: LabelSupplierInfo;
}

const FONT = "'DM Sans', 'Noto Sans SC', system-ui, sans-serif";
const FONT_ZH = "'Noto Sans SC', 'DM Sans', system-ui, sans-serif";
/** Chinois d'affichage : un serif (宋体) — la typographie des documents
 *  imprimés en Chine ; il tient mieux le très grand corps de l'adresse. */
const FONT_ZH_DISPLAY = "'Noto Serif SC', 'Noto Sans SC', serif";
const INK = '#111111';
const MUTED = '#555555';
const HAIR = '#DADADA';
const RULE = `2px solid ${INK}`;

/** Les deux verticales de l'étiquette : où commence l'intitulé, où commence la valeur. */
const LABEL_COL = 118;
const LABEL_COL_2 = 86;
const ROW_H = 23;
const PAD_X = 14;

/** Bande de titre d'une section : numéro · chinois · anglais, et parfois une étiquette à droite. */
function Band({ n, zh, en, right, dark }: { n: string; zh: string; en: string; right?: React.ReactNode; dark?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        height: 24,
        padding: `0 ${PAD_X}px`,
        background: dark ? INK : '#EFEFEF',
        color: dark ? '#fff' : INK,
        borderBottom: `1px solid ${dark ? INK : HAIR}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: dark ? '#fff' : MUTED }}>{n}</span>
        <span style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 13, fontWeight: 900 }}>{zh}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: dark ? 'rgba(255,255,255,0.8)' : MUTED }}>{en}</span>
      </div>
      {right}
    </div>
  );
}

function Key({ zh, en }: { zh: string; en: string }) {
  return (
    <span style={{ fontFamily: FONT_ZH, fontSize: 11, fontWeight: 700, color: MUTED, whiteSpace: 'nowrap', lineHeight: 1 }}>
      {zh}
      {zh && en ? ' ' : ''}
      <span style={{ fontFamily: FONT, fontSize: 9, letterSpacing: 0.7, textTransform: 'uppercase' }}>{en}</span>
    </span>
  );
}

/** Une valeur ; vide, c'est une ligne à remplir au stylo. */
function Val({ value, latin, size = 13 }: { value?: string | null; latin?: boolean; size?: number }) {
  const v = (value ?? '').trim();
  if (!v) return <span style={{ display: 'block', height: 1, background: '#9A9A9A', alignSelf: 'end', marginBottom: 4 }} />;
  return (
    <span style={{ fontFamily: latin ? FONT : FONT_ZH, fontSize: size, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {v}
    </span>
  );
}

/** Une ligne à UN champ : intitulé (colonne fixe) · valeur. */
function Row1({ zh, en, value, latin, size, last }: { zh: string; en: string; value?: string | null; latin?: boolean; size?: number; last?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${LABEL_COL}px 1fr`, alignItems: 'center', height: ROW_H, padding: `0 ${PAD_X}px`, borderBottom: last ? undefined : `1px solid ${HAIR}` }}>
      <Key zh={zh} en={en} />
      <Val value={value} latin={latin} size={size} />
    </div>
  );
}

/** Une ligne à DEUX champs : deux paires intitulé · valeur, sur les mêmes verticales que partout. */
function Row2({
  a,
  b,
  last,
}: {
  a: { zh: string; en: string; value?: string | null; latin?: boolean; size?: number; custom?: React.ReactNode };
  b: { zh: string; en: string; value?: string | null; latin?: boolean; size?: number; custom?: React.ReactNode };
  last?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${LABEL_COL}px 1fr ${LABEL_COL_2}px 1fr`, columnGap: 0, alignItems: 'center', height: ROW_H, padding: `0 ${PAD_X}px`, borderBottom: last ? undefined : `1px solid ${HAIR}` }}>
      <Key zh={a.zh} en={a.en} />
      <div style={{ display: 'grid', paddingRight: 10, minWidth: 0 }}>{a.custom ?? <Val value={a.value} latin={a.latin} size={a.size} />}</div>
      <Key zh={b.zh} en={b.en} />
      <div style={{ display: 'grid', minWidth: 0 }}>{b.custom ?? <Val value={b.value} latin={b.latin} size={b.size} />}</div>
    </div>
  );
}

/** « n° __ / __ » : deux traits et une barre. */
function CartonOf() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 12px 1fr', alignItems: 'end', columnGap: 6, height: 14 }}>
      <span style={{ height: 1, background: '#9A9A9A', marginBottom: 4 }} />
      <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1, textAlign: 'center' }}>/</span>
      <span style={{ height: 1, background: '#9A9A9A', marginBottom: 4 }} />
    </div>
  );
}

export const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(function ShippingLabel(
  { code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, destination, settings, supplier },
  ref,
) {
  const loc = settings[destination];
  const tag = DESTINATION_LABEL[destination];
  const company = settings.company;
  const ourCompany = [company.nameZh.trim(), company.nameEn.trim()].filter(Boolean).join(' ');
  const finalDestination = [clientCity, clientCountry].filter((v) => v && v.trim()).join(', ');

  return (
    <div
      ref={ref}
      style={{
        width: LABEL_W,
        height: LABEL_H,
        boxSizing: 'border-box',
        padding: 14,
        background: '#FFFFFF',
        color: INK,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ border: RULE, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* 0 · Bandeau : ce que c'est, quoi en faire */}
        <div style={{ background: INK, color: '#fff', height: 44, padding: `0 ${PAD_X}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 18, fontWeight: 900 }}>发货标签</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.8 }}>Shipping label</span>
          </div>
          <div style={{ textAlign: 'right', lineHeight: 1.15 }}>
            <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 14, fontWeight: 900 }}>请打印，并贴在每一个纸箱上</div>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>Print this label and stick it on every carton</div>
          </div>
        </div>

        {/* 1 · Destination */}
        <Band
          n="1"
          zh="收件地址"
          en="Deliver to"
          right={
            <span style={{ background: INK, color: '#fff', borderRadius: 3, padding: '1px 8px', fontFamily: FONT_ZH_DISPLAY, fontSize: 11.5, fontWeight: 900, letterSpacing: 0.4, lineHeight: 1.4 }}>
              {tag.zh} · {tag.en.toUpperCase()}
            </span>
          }
        />
        <div style={{ padding: `6px ${PAD_X}px 5px`, borderBottom: `1px solid ${HAIR}` }}>
          <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 25, fontWeight: 900, lineHeight: 1.25, whiteSpace: 'pre-line', letterSpacing: 0.3 }}>{loc.addressZh}</div>
          {loc.addressEn.trim() ? <div style={{ marginTop: 3, fontSize: 10.5, fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{loc.addressEn}</div> : null}
        </div>
        <Row1 zh="收件人" en="Recipient" value={[loc.recipient, ourCompany].filter((v) => v.trim()).join(' · ')} />
        <Row2 a={{ zh: '电话', en: 'Tel', value: loc.phone, latin: true }} b={{ zh: '微信', en: 'WeChat', value: loc.wechat, latin: true }} />
        <Row2 a={{ zh: '', en: 'WhatsApp', value: loc.whatsapp, latin: true }} b={{ zh: '邮箱', en: 'Email', value: loc.email || company.email, latin: true, size: 12 }} last />

        {/* 2 · Code client + QR */}
        <div style={{ borderTop: RULE }}>
          <Band n="2" zh="客户编号" en="Customer ID" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '236px 1fr', borderBottom: RULE }}>
          <div style={{ padding: 10, borderRight: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCodeSVG value={customerQrPayload(code)} size={216} level="H" marginSize={0} />
          </div>
          <div style={{ padding: `10px ${PAD_X}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 1, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{code}</div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 13, fontWeight: 900 }}>到货后扫码入库，归属此客户</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED }}>Scanned on arrival — links the carton to this customer.</div>
            </div>
          </div>
        </div>

        {/* 3 · Client */}
        <Band n="3" zh="客户" en="Customer" />
        <Row1 zh="客户姓名" en="Name" value={clientName} latin />
        <Row2 a={{ zh: '电话(非洲)', en: 'Tel', value: clientPhone || '—', latin: true }} b={{ zh: '目的地', en: 'Destination', value: finalDestination || '—', latin: true }} />
        <Row2 a={{ zh: '公司', en: 'Company', value: companyName || '—', latin: true }} b={{ zh: '邮箱', en: 'Email', value: clientEmail || '—', latin: true, size: 12 }} last />

        {/* 4 · Fournisseur — pré-rempli ou à remplir au stylo */}
        <div style={{ borderTop: RULE }}>
          <Band n="4" zh="供货商 / 发件人" en="Supplier · Sender" />
        </div>
        <Row1 zh="供货商" en="Supplier" value={supplier?.name} latin />
        <Row2 a={{ zh: '电话', en: 'Tel', value: supplier?.phone, latin: true }} b={{ zh: '邮箱', en: 'Email', value: supplier?.email, latin: true, size: 12 }} />
        <Row1 zh="地址" en="Address" value={supplier?.address} />
        <Row2 a={{ zh: '货物品名', en: 'Goods name' }} b={{ zh: '货物数量', en: 'Qty (件)' }} />
        <Row2 a={{ zh: '发货日期', en: 'Ship date' }} b={{ zh: '箱号', en: 'Carton no.', custom: <CartonOf /> }} last />

        {/* 5 · Réservé à l'entrepôt — les colonnes du 三联单 */}
        <div style={{ borderTop: RULE, marginTop: 'auto' }}>
          <Band n="5" zh="仓库填写" en="Warehouse use only" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `${LABEL_COL}px 1fr 70px 1fr 74px 1fr`, alignItems: 'center', height: ROW_H + 4, padding: `0 ${PAD_X}px`, background: '#F7F7F7' }}>
          <Key zh="到货日期" en="Date" />
          <div style={{ display: 'grid', paddingRight: 14 }}><Val /></div>
          <Key zh="立方" en="CBM" />
          <div style={{ display: 'grid', paddingRight: 14 }}><Val /></div>
          <Key zh="总包数" en="Total" />
          <div style={{ display: 'grid' }}><Val /></div>
        </div>

        {/* Pied : rappel du code, lisible même si le QR est abîmé */}
        <div style={{ borderTop: RULE, height: 20, padding: `0 ${PAD_X}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontWeight: 700, color: MUTED }}>
          <span style={{ fontFamily: FONT_ZH }}>{company.nameEn || 'Bonzini'} · 客户编号 · Customer ID</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: INK, fontSize: 11.5 }}>{code}</span>
        </div>
      </div>
    </div>
  );
});
