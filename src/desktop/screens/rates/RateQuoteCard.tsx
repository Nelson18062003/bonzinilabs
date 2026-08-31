// RateQuoteCard — la COTATION à envoyer au client (WhatsApp).
//
// Nœud en taille naturelle 1080×1080 (format carré WhatsApp), réduit via
// transform:scale par le parent et capturé tel quel par html-to-image —
// l'aperçu et le fichier téléchargé sont le même rendu, comme le flyer.
// Même langage de marque que RateFlyer : logo Bonzini, FR + 中文, gros
// chiffres tabulaires, vrais logos de méthode, zéro dégradé.
import { Landmark } from 'lucide-react';
import { LOGO_PATH } from '@/mobile/designKit/methods';
import type { PaymentMethodKey } from '@/types/rates';

export const QUOTE_W = 1080;
export const QUOTE_H = 1080;

export interface RateQuoteProps {
  amountXAF: number;
  amountCNY: number;
  method: PaymentMethodKey;
  finalRate: number;
  countryLabel: string;
  theme?: 'dark' | 'light';
}

const METHOD_META: Record<PaymentMethodKey, { name: string; cn: string }> = {
  alipay: { name: 'Alipay', cn: '支付宝' },
  wechat: { name: 'WeChat Pay', cn: '微信支付' },
  virement: { name: 'Virement bancaire', cn: '银行转账' },
  cash: { name: 'Cash', cn: '现金' },
};

const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function fmt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function RateQuoteCard({ amountXAF, amountCNY, method, finalRate, countryLabel, theme = 'dark' }: RateQuoteProps) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0D0C14' : '#F2F0F8';
  const card = isDark ? '#19172A' : '#FFFFFF';
  const text = isDark ? '#F1EEF8' : '#1A1726';
  const muted = '#8B83A0';
  const ymark = isDark ? '#5C5772' : '#C3BDD2';
  const holder = isDark ? '#2A2738' : '#ECE8F6';
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(26,23,38,0.10)';
  const cardShadow = isDark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 18px 50px -22px rgba(40,28,80,0.28)';

  const now = new Date();
  // « Lundi 31 août 2026 » — majuscule au jour seulement (règle typographique fr).
  const day = FR_DAYS[now.getDay()];
  const frDate = `${day.charAt(0).toUpperCase()}${day.slice(1)} ${now.getDate()} ${FR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const meta = METHOD_META[method];

  const tile = (() => {
    const box = (color: string, content: React.ReactNode) => (
      <div style={{ width: 108, height: 108, borderRadius: 28, backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {content}
      </div>
    );
    if (method === 'alipay') return box('#FFFFFF', <svg viewBox="0 0 24 24" width={70} height={70} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg>);
    if (method === 'wechat') return box('#07C160', <svg viewBox="0 0 24 24" width={62} height={62} fill="#FFFFFF"><path d={LOGO_PATH.wechat} /></svg>);
    if (method === 'cash') return box('#E0322B', <span style={{ fontSize: 58, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>¥</span>);
    return box(holder, <Landmark color={text} width={52} height={52} strokeWidth={1.8} />);
  })();

  return (
    <div style={{ width: QUOTE_W, height: QUOTE_H, backgroundColor: bg, display: 'flex', flexDirection: 'column', padding: '56px 64px', fontFamily: '"DM Sans", sans-serif' }}>
      {/* En-tête — identité + pastille Cotation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <img src="/assets/bonzini-logo.jpg" alt="Bonzini" width={92} height={92} style={{ borderRadius: 24 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 58, fontWeight: 900, color: text, letterSpacing: -1.5, lineHeight: 1 }}>Bonzini</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: muted, letterSpacing: 4, marginTop: 5 }}>PAIEMENTS VERS LA CHINE</div>
          </div>
        </div>
        <div style={{ backgroundColor: isDark ? '#F1EEF8' : '#1A1726', color: isDark ? '#1A1726' : '#FFFFFF', borderRadius: 44, padding: '16px 30px', fontSize: 27, fontWeight: 700 }}>
          Cotation
        </div>
      </div>

      {/* Date */}
      <div style={{ borderTop: `2px solid ${hairline}`, paddingTop: 24, marginTop: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <div style={{ fontSize: 33, fontWeight: 800, color: text, letterSpacing: -0.5 }}>{frDate}</div>
        <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 24, color: muted }}>报价单</div>
      </div>

      {/* Corps — vous payez → votre fournisseur reçoit */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        <div style={{ backgroundColor: card, borderRadius: 36, padding: '36px 44px', boxShadow: cardShadow }}>
          <div style={{ fontSize: 27, fontWeight: 600, color: muted }}>Vous payez · 您支付</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 8 }}>
            <span style={{ fontSize: 96, fontWeight: 900, color: text, letterSpacing: -2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(amountXAF)}
            </span>
            <span style={{ fontSize: 46, fontWeight: 800, color: '#E8932A', marginBottom: 8 }}>XAF</span>
          </div>
        </div>

        {/* Liaison — méthode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '0 12px' }}>
          <div style={{ width: 3, height: 34, backgroundColor: hairline, marginLeft: 51, borderRadius: 2 }} />
          {tile}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: text, lineHeight: 1.1 }}>{meta.name}</div>
            <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 23, color: muted, marginTop: 4 }}>{meta.cn}</div>
          </div>
        </div>

        <div style={{ backgroundColor: card, borderRadius: 36, padding: '36px 44px', boxShadow: cardShadow }}>
          <div style={{ fontSize: 27, fontWeight: 600, color: muted }}>Votre fournisseur reçoit · 供应商收到</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 62, fontWeight: 700, color: ymark, marginBottom: 10 }}>¥</span>
            <span style={{ fontSize: 128, fontWeight: 900, color: text, letterSpacing: -3, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(amountCNY)}
            </span>
          </div>
        </div>
      </div>

      {/* Pied — taux + contact */}
      <div style={{ borderTop: `2px solid ${hairline}`, paddingTop: 26, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 22, color: muted }}>
              Taux appliqué{countryLabel !== 'Cameroun' ? ` · ${countryLabel}` : ''}
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: text, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
              ¥ {finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <span style={{ fontSize: 22, fontWeight: 600, color: muted }}>/ 1 000 000 XAF</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width={34} height={34} fill="#FFFFFF"><path d={LOGO_PATH.whatsapp} /></svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: text, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>+237 652 236 856</div>
              <div style={{ fontSize: 21, color: muted, marginTop: 2 }}>bonzinilabs.com</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 19, color: muted, opacity: 0.7, marginTop: 18 }}>
          Cotation valable aujourd'hui, au taux du jour. · 报价当日有效。
        </div>
      </div>
    </div>
  );
}
