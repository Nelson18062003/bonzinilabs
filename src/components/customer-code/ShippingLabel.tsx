// ============================================================
// ÉTIQUETTE COLIS — ce que le fournisseur chinois imprime et colle sur
// chaque carton.
//
// Lecteur : un employé d'expédition en Chine, puis un manutentionnaire à
// notre entrepôt. Ni l'un ni l'autre ne lit le français : l'étiquette est
// CHINOIS d'abord, anglais ensuite, et ne dépend pas de la langue de l'app
// du client. Une seule chose compte à 2 mètres : le QR et le code, gros.
//
// Taille fixe (600 × 850 px, ratio A5) : le nœud est rasterisé tel quel
// (html-to-image) pour l'image partagée sur WeChat et le PDF imprimé — il
// ne doit donc rien hériter de la mise en page responsive autour.
// ============================================================
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { customerQrPayload, CHINA_RECEIVING_ADDRESSES, isAddressConfigured } from '@/lib/customerCode';

export const LABEL_W = 600;
export const LABEL_H = 850;

export interface ShippingLabelProps {
  code: string;
  clientName: string;
  companyName?: string | null;
}

const FONT = "'DM Sans', 'Noto Sans SC', system-ui, sans-serif";
const FONT_ZH = "'Noto Sans SC', 'DM Sans', system-ui, sans-serif";

export const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(function ShippingLabel(
  { code, clientName, companyName },
  ref,
) {
  const addresses = CHINA_RECEIVING_ADDRESSES.filter(isAddressConfigured);

  return (
    <div
      ref={ref}
      style={{
        width: LABEL_W,
        height: LABEL_H,
        boxSizing: 'border-box',
        padding: 36,
        background: '#FFFFFF',
        color: '#1B1A24',
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      {/* En-tête : marque + nature du document */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: '#1C1B22',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 18,
            }}
          >
            B
          </div>
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.3 }}>Bonzini Labs</div>
            <div style={{ fontSize: 12, color: '#8E8BA0', fontWeight: 600 }}>bonzinilabs.com</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
          <div style={{ fontFamily: FONT_ZH, fontWeight: 900, fontSize: 22 }}>收货标签</div>
          <div style={{ fontSize: 12, color: '#8E8BA0', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>Shipping label</div>
        </div>
      </div>

      {/* Consigne — la seule phrase à lire */}
      <div
        style={{
          background: '#1C1B22',
          color: '#FFFFFF',
          borderRadius: 18,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 999, background: '#FF6B2B', flexShrink: 0 }} />
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontFamily: FONT_ZH, fontSize: 19, fontWeight: 900 }}>请将此标签贴在每一个包裹上</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>Stick this label on every parcel of this shipment.</div>
        </div>
      </div>

      {/* QR + code : le cœur */}
      <div
        style={{
          border: '2px solid #1B1A24',
          borderRadius: 24,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <QRCodeSVG value={customerQrPayload(code)} size={250} level="H" marginSize={0} />
        <div style={{ textAlign: 'center', lineHeight: 1.05 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: '#8E8BA0', textTransform: 'uppercase' }}>
            客户编号 · Customer ID
          </div>
          <div style={{ fontSize: 50, fontWeight: 900, letterSpacing: 3, fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>{code}</div>
        </div>
        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{clientName}</div>
          {companyName ? <div style={{ fontSize: 14, color: '#4A475C', fontWeight: 600 }}>{companyName}</div> : null}
        </div>
      </div>

      {/* Où livrer */}
      {addresses.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${addresses.length}, minmax(0, 1fr))`, gap: 12 }}>
          {addresses.map((a) => (
            <div key={a.label.en} style={{ background: '#F6F5FB', borderRadius: 16, padding: '12px 14px', lineHeight: 1.3 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: '#8E8BA0', textTransform: 'uppercase' }}>
                {a.label.zh} · {a.label.en}
              </div>
              <div style={{ fontFamily: FONT_ZH, fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>{a.recipientZh}</div>
              <div style={{ fontFamily: FONT_ZH, fontSize: 13, color: '#4A475C', marginTop: 2 }}>{a.addressZh}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{a.phone}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: '#F6F5FB', borderRadius: 16, padding: '12px 14px', lineHeight: 1.3 }}>
          <div style={{ fontFamily: FONT_ZH, fontSize: 14, fontWeight: 700 }}>收货地址：请联系 Bonzini 客服获取</div>
          <div style={{ fontSize: 12.5, color: '#4A475C' }}>Delivery address: provided by Bonzini customer service.</div>
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#8E8BA0', fontWeight: 600 }}>
        <span style={{ fontFamily: FONT_ZH }}>到仓后扫码入库 · Scanned on arrival at our warehouse</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{code}</span>
      </div>
    </div>
  );
});
