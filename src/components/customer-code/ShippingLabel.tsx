// ============================================================
// ÉTIQUETTE D'EXPÉDITION (发货标签) — la feuille que le fournisseur chinois
// IMPRIME et COLLE sur chaque carton. UNE destination par étiquette
// (entrepôt OU bureau).
//
// Bâtie comme une feuille de route de transporteur (快递面单), parce que
// c'est ce que l'expéditeur sait lire d'un coup d'œil : des cases à bords
// noirs, une information par case, le chinois d'abord. Noir sur blanc,
// sans aplat de couleur — ça sort d'une imprimante laser d'usine.
//
// Ordre de lecture, du plus gros au plus petit :
//   0. le bandeau : ce que c'est et quoi en faire (imprimer, coller) ;
//   1. l'ADRESSE de livraison — c'est elle qui fait arriver le carton ;
//   2. le CODE CLIENT et son QR — c'est ce qui le rattache au bon client ;
//   3. le client (nom, société, téléphone, destination finale au Cameroun) ;
//   4. le fournisseur (nom, téléphone, adresse, marchandise, carton n°/total)
//      — pré-rempli si on le connaît, sinon des lignes à remplir au stylo ;
//   5. les dates : expédition (fournisseur) et réception (notre entrepôt).
// Pas d'en-tête de marque : le nom de la société est dans la case
// « destinataire », là où le livreur le cherche.
//
// Taille fixe 600 × 850 px — le ratio des formats A (A4 comme A5) : le nœud
// est rasterisé tel quel et posé sur une page A4 dans le PDF.
// ============================================================
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  customerQrPayload,
  CHINA_RECEIVING_ADDRESSES,
  BONZINI_CHINA_COMPANY,
  type ChinaReceivingAddress,
  type ShippingDestination,
} from '@/lib/customerCode';

export const LABEL_W = 600;
export const LABEL_H = 850;

/** Ce qu'on sait du fournisseur au moment de générer l'étiquette (optionnel). */
export interface LabelSupplierInfo {
  name?: string;
  phone?: string;
  address?: string;
}

export interface ShippingLabelProps {
  code: string;
  clientName: string;
  clientPhone?: string | null;
  companyName?: string | null;
  /** Ville / pays de livraison finale (Douala, Cameroun) — utile au tri à l'entrepôt. */
  clientCity?: string | null;
  clientCountry?: string | null;
  destination: ShippingDestination;
  supplier?: LabelSupplierInfo;
  /** Remplace l'adresse configurée (harnais de capture, tests). */
  address?: ChinaReceivingAddress;
}

const FONT = "'DM Sans', 'Noto Sans SC', system-ui, sans-serif";
const FONT_ZH = "'Noto Sans SC', 'DM Sans', system-ui, sans-serif";
/** Chinois d'affichage : un serif (宋体) — c'est la typographie des documents
 *  imprimés en Chine, et elle tient mieux le très grand corps de l'adresse. */
const FONT_ZH_DISPLAY = "'Noto Serif SC', 'Noto Sans SC', serif";
const INK = '#111111';
const MUTED = '#555555';
const RULE = `2px solid ${INK}`;

/** En-tête de case : chinois d'abord, anglais en petites capitales. */
function CellHead({ zh, en, right }: { zh: string; en: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 14, fontWeight: 900 }}>{zh}</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: MUTED }}>{en}</span>
      </div>
      {right}
    </div>
  );
}

function Key({ zh, en }: { zh: string; en: string }) {
  return (
    <span style={{ fontFamily: FONT_ZH, fontSize: 12, fontWeight: 700, color: MUTED, whiteSpace: 'nowrap' }}>
      {zh} <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>{en}</span>
    </span>
  );
}

/** Clé + valeur ; sans valeur, une ligne à remplir au stylo. */
function KV({ zh, en, value, latin, size = 15 }: { zh: string; en: string; value?: string | null; latin?: boolean; size?: number }) {
  const v = (value ?? '').trim();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, lineHeight: 1.25, minWidth: 0 }}>
      <Key zh={zh} en={en} />
      {v ? (
        <span style={{ fontFamily: latin ? FONT : FONT_ZH, fontSize: size, fontWeight: 800, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word', minWidth: 0 }}>{v}</span>
      ) : (
        <span style={{ flex: 1, borderBottom: '1.5px solid #999', height: 18 }} />
      )}
    </div>
  );
}

export const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(function ShippingLabel(
  { code, clientName, clientPhone, companyName, clientCity, clientCountry, destination, supplier, address },
  ref,
) {
  const dest = address ?? CHINA_RECEIVING_ADDRESSES[destination];
  const ourCompany = BONZINI_CHINA_COMPANY.nameZh.startsWith('[')
    ? BONZINI_CHINA_COMPANY.nameEn
    : `${BONZINI_CHINA_COMPANY.nameZh} ${BONZINI_CHINA_COMPANY.nameEn}`;
  const finalDestination = [clientCity, clientCountry].filter((v) => v && v.trim()).join(', ');

  return (
    <div
      ref={ref}
      style={{
        width: LABEL_W,
        height: LABEL_H,
        boxSizing: 'border-box',
        padding: 22,
        background: '#FFFFFF',
        color: INK,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ border: RULE, borderRadius: 6, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* 0 · Bandeau : ce que c'est, quoi en faire */}
        <div style={{ background: INK, color: '#fff', padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 17, fontWeight: 900 }}>发货标签</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.8 }}>Shipping label</span>
          </div>
          <div style={{ textAlign: 'right', lineHeight: 1.15 }}>
            <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 14, fontWeight: 900 }}>请打印，并贴在每一个纸箱上</div>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>Print this label and stick it on every carton</div>
          </div>
        </div>

        {/* 1 · Destination — la case la plus grande */}
        <div style={{ padding: '11px 16px 12px', borderBottom: RULE, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CellHead
            zh="收件地址"
            en="Deliver to"
            right={
              <span style={{ background: INK, color: '#fff', borderRadius: 4, padding: '2px 10px', fontFamily: FONT_ZH_DISPLAY, fontSize: 13, fontWeight: 900, letterSpacing: 0.5 }}>
                {dest.label.zh} · {dest.label.en.toUpperCase()}
              </span>
            }
          />
          <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 27, fontWeight: 900, lineHeight: 1.3, whiteSpace: 'pre-line', letterSpacing: 0.4 }}>{dest.addressZh}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <KV zh="收件人" en="Recipient" value={`${dest.recipientZh} · ${ourCompany}`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
              <KV zh="电话" en="Phone" value={dest.phone} latin />
              <KV zh="微信" en="WeChat" value={dest.wechat} latin />
            </div>
          </div>
        </div>

        {/* 2 · Code client + QR */}
        <div style={{ display: 'flex', borderBottom: RULE }}>
          <div style={{ padding: 14, borderRight: RULE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCodeSVG value={customerQrPayload(code)} size={172} level="H" marginSize={0} />
          </div>
          <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <CellHead zh="客户编号" en="Customer ID" />
            <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: 1, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{code}</div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 14, fontWeight: 900 }}>到货后扫码入库，归属此客户</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Scanned on arrival — links the carton to this customer.</div>
            </div>
          </div>
        </div>

        {/* 3 · Client */}
        <div style={{ padding: '10px 16px 11px', borderBottom: RULE, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <CellHead zh="客户" en="Customer" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 4 }}>
            <KV zh="姓名" en="Name" value={clientName} latin />
            <KV zh="电话" en="Phone" value={clientPhone || '—'} latin />
            <KV zh="公司" en="Company" value={companyName || '—'} latin />
            <KV zh="目的地" en="Final destination" value={finalDestination || '—'} latin />
          </div>
        </div>

        {/* 4 · Fournisseur — pré-rempli ou à remplir au stylo */}
        <div style={{ padding: '10px 16px 11px', borderBottom: RULE, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <CellHead zh="供应商 / 发件人" en="Supplier · Sender" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 8, flex: 1, alignContent: 'space-evenly' }}>
            <KV zh="名称" en="Name" value={supplier?.name} latin />
            <KV zh="电话" en="Phone" value={supplier?.phone} latin />
            <div style={{ gridColumn: '1 / -1' }}>
              <KV zh="地址" en="Address" value={supplier?.address} size={13} />
            </div>
            <KV zh="货物" en="Goods" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Key zh="箱号" en="Carton no." />
              <span style={{ flex: 1, borderBottom: '1.5px solid #999', height: 18 }} />
              <span style={{ fontSize: 14, fontWeight: 800 }}>/</span>
              <span style={{ flex: 1, borderBottom: '1.5px solid #999', height: 18 }} />
            </div>
          </div>
        </div>

        {/* 5 · Dates : l'expéditeur date l'envoi, notre entrepôt date l'arrivée */}
        <div style={{ padding: '9px 16px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
          <KV zh="发货日期" en="Ship date" />
          <KV zh="到货日期" en="Received on" />
        </div>

        {/* Pied : rappel du code, lisible même si le QR est abîmé */}
        <div style={{ borderTop: RULE, padding: '5px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, color: MUTED }}>
          <span style={{ fontFamily: FONT_ZH }}>Bonzini · 客户编号 · Customer ID</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: INK, fontSize: 12 }}>{code}</span>
        </div>
      </div>
    </div>
  );
});
