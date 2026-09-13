// ============================================================
// ÉTIQUETTE COLIS — ce que le fournisseur chinois imprime et colle sur
// chaque carton. UNE destination par étiquette (entrepôt OU bureau).
//
// Bâtie comme une feuille de route de transporteur (快递面单), parce que
// c'est ce que l'expéditeur sait lire d'un coup d'œil : des cases à bords
// noirs, une information par case, le chinois d'abord. Noir sur blanc,
// sans aplat de couleur — ça sort d'une imprimante laser d'usine.
//
// Hiérarchie, du plus gros au plus petit :
//   1. l'ADRESSE de livraison — c'est elle qui fait arriver le carton ;
//   2. le CODE CLIENT et son QR — c'est ce qui le rattache au bon client ;
//   3. les coordonnées : les nôtres (destinataire, téléphone, WeChat),
//      puis celles du client (nom, téléphone, société).
// Pas d'en-tête de marque : le nom de la société est dans la case
// « destinataire », là où le livreur le cherche.
//
// Taille fixe (600 × 850 px, ratio A5) : le nœud est rasterisé tel quel.
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

export interface ShippingLabelProps {
  code: string;
  clientName: string;
  clientPhone?: string | null;
  companyName?: string | null;
  destination: ShippingDestination;
  /** Remplace l'adresse configurée (harnais de capture, tests). */
  address?: ChinaReceivingAddress;
}

const FONT = "'DM Sans', 'Noto Sans SC', system-ui, sans-serif";
const FONT_ZH = "'Noto Sans SC', 'DM Sans', system-ui, sans-serif";
/** Chinois d'affichage : un serif (宋体) — c'est la typographie des documents
 *  imprimés en Chine, et elle tient mieux le très grand corps de l'adresse. */
const FONT_ZH_DISPLAY = "'Noto Serif SC', 'Noto Sans SC', serif";
const INK = '#111111';
const RULE = `2px solid ${INK}`;

/** En-tête de case : chinois d'abord, anglais en petites capitales. */
function CellHead({ zh, en, right }: { zh: string; en: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 14, fontWeight: 900 }}>{zh}</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: '#555' }}>{en}</span>
      </div>
      {right}
    </div>
  );
}

function KV({ zh, en, value, mono }: { zh: string; en: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, lineHeight: 1.25 }}>
      <span style={{ fontFamily: FONT_ZH, fontSize: 12, fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>
        {zh} <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>{en}</span>
      </span>
      <span style={{ fontFamily: mono ? FONT : FONT_ZH, fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

/** Ligne à remplir à la main. */
function FillLine({ zh, en }: { zh: string; en: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontFamily: FONT_ZH, fontSize: 12, fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>
        {zh} <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>{en}</span>
      </span>
      <span style={{ flex: 1, borderBottom: '1.5px solid #999', height: 20 }} />
    </div>
  );
}

export const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(function ShippingLabel(
  { code, clientName, clientPhone, companyName, destination, address },
  ref,
) {
  const dest = address ?? CHINA_RECEIVING_ADDRESSES[destination];

  return (
    <div
      ref={ref}
      style={{
        width: LABEL_W,
        height: LABEL_H,
        boxSizing: 'border-box',
        padding: 28,
        background: '#FFFFFF',
        color: INK,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ border: RULE, borderRadius: 6, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* 1 · Destination — la case la plus grande */}
        <div style={{ padding: '14px 18px 16px', borderBottom: RULE, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CellHead
            zh="收件地址"
            en="Deliver to"
            right={
              <span
                style={{
                  background: INK,
                  color: '#fff',
                  borderRadius: 4,
                  padding: '3px 10px',
                  fontFamily: FONT_ZH_DISPLAY,
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                }}
              >
                {dest.label.zh} · {dest.label.en.toUpperCase()}
              </span>
            }
          />
          <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 27, fontWeight: 900, lineHeight: 1.3, whiteSpace: 'pre-line', letterSpacing: 0.4 }}>
            {dest.addressZh}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
            <KV zh="收件人" en="Recipient" value={`${dest.recipientZh} · ${BONZINI_CHINA_COMPANY.nameZh.startsWith('[') ? BONZINI_CHINA_COMPANY.nameEn : `${BONZINI_CHINA_COMPANY.nameZh} ${BONZINI_CHINA_COMPANY.nameEn}`}`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
              <KV zh="电话" en="Phone" value={dest.phone} mono />
              <KV zh="微信" en="WeChat" value={dest.wechat} mono />
            </div>
          </div>
        </div>

        {/* 2 · Code client + QR */}
        <div style={{ display: 'flex', borderBottom: RULE }}>
          <div style={{ padding: 16, borderRight: RULE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCodeSVG value={customerQrPayload(code)} size={188} level="H" marginSize={0} />
          </div>
          <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <CellHead zh="客户编号" en="Customer ID" />
            <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: 1, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{code}</div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontFamily: FONT_ZH_DISPLAY, fontSize: 15, fontWeight: 900 }}>请将此标签贴在每一个纸箱上</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#555' }}>Stick this label on every carton. Write the ID on the box too.</div>
            </div>
          </div>
        </div>

        {/* 3 · Client */}
        <div style={{ padding: '12px 18px 13px', borderBottom: RULE, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <CellHead zh="客户" en="Customer" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 5 }}>
            <KV zh="姓名" en="Name" value={clientName} mono />
            <KV zh="电话" en="Phone" value={clientPhone || '—'} mono />
            {companyName ? <KV zh="公司" en="Company" value={companyName} mono /> : null}
          </div>
        </div>

        {/* 4 · À remplir par le fournisseur — au stylo, comme sur toute
            feuille de route : qui expédie, et « carton n° __ sur __ ». Sans
            ça, l'entrepôt reçoit 4 cartons sur 6 sans savoir qu'il en manque. */}
        <div style={{ padding: '12px 18px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <CellHead zh="供应商填写" en="To be filled in by the supplier" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 12, flex: 1, alignContent: 'space-evenly' }}>
            <FillLine zh="供应商" en="Supplier" />
            <FillLine zh="电话" en="Phone" />
            <FillLine zh="货物" en="Goods" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: FONT_ZH, fontSize: 12, fontWeight: 700, color: '#555', whiteSpace: 'nowrap' }}>
                箱号 <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>Carton no.</span>
              </span>
              <span style={{ flex: 1, borderBottom: '1.5px solid #999', height: 20 }} />
              <span style={{ fontSize: 14, fontWeight: 800 }}>/</span>
              <span style={{ flex: 1, borderBottom: '1.5px solid #999', height: 20 }} />
            </div>
          </div>
        </div>

        {/* Pied : rappel du code, lisible même si le QR est abîmé */}
        <div style={{ borderTop: RULE, padding: '6px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#555' }}>
          <span style={{ fontFamily: FONT_ZH }}>到货后扫码登记 · Scanned on arrival</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: INK }}>{code}</span>
        </div>
      </div>
    </div>
  );
});
