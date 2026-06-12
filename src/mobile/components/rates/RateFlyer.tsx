// RateFlyer — aperçu + export du flyer "Taux du jour" (2150×2560px en taille
// naturelle, réduit via transform:scale dans le parent). L'image envoyée par
// Mola est générée côté serveur (generate-flyer) avec le MÊME design.
//
// Design = maquette validée (langage Ofspace) : surface douce, cartes blanches,
// gros chiffres, VRAIS logos (Alipay/WeChat/WhatsApp), Cash = ¥ rouge, logo
// Bonzini, zéro dégradé arc-en-ciel.
import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { LOGO_PATH } from '@/mobile/designKit/methods';

export interface RateFlyerProps {
  alipay: number;
  wechat: number;
  bank: number;
  cash: number;
  theme?: 'dark' | 'light';
}

// 11530 → "11 530" (espace ordinaire, chasse fixe via tabular-nums).
function fmt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const CN_DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function RateFlyer({ alipay, wechat, bank, cash, theme = 'dark' }: RateFlyerProps) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isDark = theme === 'dark';
  const gz = new Date(time.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const hh = gz.getHours().toString().padStart(2, '0');
  const mm = gz.getMinutes().toString().padStart(2, '0');
  const frDate = `${FR_DAYS[gz.getDay()]} ${gz.getDate()} ${FR_MONTHS[gz.getMonth()]} ${gz.getFullYear()}`;
  const cnDate = `${gz.getFullYear()}年${gz.getMonth() + 1}月${gz.getDate()}日 · ${CN_DAYS[gz.getDay()]}`;

  // Palette douce (langage Ofspace), variante claire / sombre.
  const bg = isDark ? '#0D0C14' : '#F2F0F8';
  const card = isDark ? '#19172A' : '#FFFFFF';
  const text = isDark ? '#F1EEF8' : '#1A1726';
  const muted = '#8B83A0';
  const ymark = isDark ? '#5C5772' : '#C3BDD2';
  const holder = isDark ? '#2A2738' : '#ECE8F6';
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(26,23,38,0.10)';
  const cardShadow = isDark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 18px 50px -22px rgba(40,28,80,0.28)';

  const rows = [
    { key: 'alipay', name: 'Alipay', cn: '支付宝', note: 'Instantané', rate: alipay },
    { key: 'wechat', name: 'WeChat Pay', cn: '微信支付', note: 'Instantané', rate: wechat },
    { key: 'bank', name: 'Virement', cn: '银行转账', note: '1–2 h', rate: bank },
    { key: 'cash', name: 'Cash', cn: '现金', note: 'En main propre', rate: cash },
  ] as const;

  const tile = (key: string) => {
    const box = (color: string, content: React.ReactNode) => (
      <div style={{ width: 200, height: 200, borderRadius: 50, backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {content}
      </div>
    );
    if (key === 'alipay') return box('#FFFFFF', <svg viewBox="0 0 24 24" width={130} height={130} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg>);
    if (key === 'wechat') return box('#07C160', <svg viewBox="0 0 24 24" width={116} height={116} fill="#FFFFFF"><path d={LOGO_PATH.wechat} /></svg>);
    if (key === 'cash') return box('#E0322B', <span style={{ fontSize: 110, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>¥</span>);
    return box(holder, <Landmark color={text} width={96} height={96} strokeWidth={1.8} />);
  };

  const whatsapp = (color: string) => (
    <div style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" width={58} height={58} fill="#FFFFFF"><path d={LOGO_PATH.whatsapp} /></svg>
    </div>
  );

  return (
    <div style={{ width: 2150, height: 2560, backgroundColor: bg, display: 'flex', flexDirection: 'column', padding: '84px 90px', fontFamily: '"DM Sans", sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <img src="/assets/bonzini-logo.jpg" alt="Bonzini" width={188} height={188} style={{ borderRadius: 46 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 122, fontWeight: 900, color: text, letterSpacing: -3, lineHeight: 1 }}>Bonzini</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: muted, letterSpacing: 8, marginTop: 8 }}>PAIEMENTS VERS LA CHINE</div>
          </div>
        </div>
        <div style={{ backgroundColor: isDark ? '#F1EEF8' : '#1A1726', color: isDark ? '#1A1726' : '#FFFFFF', borderRadius: 80, padding: '28px 52px', fontSize: 50, fontWeight: 700 }}>
          Taux du jour
        </div>
      </div>

      {/* Date + heure */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderTop: `3px solid ${hairline}`, paddingTop: 48, marginTop: 56, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: text, letterSpacing: -1, lineHeight: 1.1 }}>{frDate}</div>
          <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 44, color: muted, marginTop: 10 }}>{cnDate}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 118, fontWeight: 900, color: text, letterSpacing: -3, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{hh}:{mm}</div>
          <div style={{ fontSize: 40, color: muted, marginTop: 8 }}>Guangzhou · UTC+8</div>
        </div>
      </div>

      {/* Contexte */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 52, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 50, fontWeight: 600, color: muted }}>Pour</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: 4 }}>
            <span style={{ fontSize: 170, fontWeight: 900, color: text, letterSpacing: -3, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>1 000 000</span>
            <span style={{ fontSize: 84, fontWeight: 800, color: '#E8932A', marginBottom: 16 }}>XAF</span>
          </div>
        </div>
        <div style={{ fontSize: 46, fontWeight: 500, color: muted, maxWidth: 640, textAlign: 'right', lineHeight: 1.25, marginBottom: 12 }}>vous payez votre fournisseur en ¥ :</div>
      </div>

      {/* Lignes de taux */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, marginTop: 48, flexShrink: 0 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 48, backgroundColor: card, borderRadius: 56, padding: '44px 56px', boxShadow: cardShadow }}>
            {tile(r.key)}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 108, fontWeight: 800, color: text, letterSpacing: -1, lineHeight: 1 }}>{r.name}</div>
              <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 50, color: muted, marginTop: 12 }}>{r.cn} · {r.note}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 100, fontWeight: 700, color: ymark, marginBottom: 18 }}>¥</span>
              <span style={{ fontSize: 224, fontWeight: 900, color: text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.rate)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'flex-end', borderTop: `3px solid ${hairline}`, paddingTop: 44, marginTop: 52 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 84, fontWeight: 800, color: text, letterSpacing: -1 }}>bonzinilabs.com</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              {whatsapp('#25D366')}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 36, color: muted }}>Cameroun · WhatsApp</div>
                <div style={{ fontSize: 56, fontWeight: 800, color: text, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>+237 652 236 856</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              {whatsapp('#07C160')}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 36, color: muted }}>中国 · WhatsApp / 微信</div>
                <div style={{ fontSize: 56, fontWeight: 800, color: text, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>+86 131 3849 5598</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 34, color: muted, opacity: 0.7, lineHeight: 1.5, marginTop: 40 }}>
          Taux indicatifs, susceptibles de varier sans préavis. · 显示汇率仅供参考，可能随时变动。
        </div>
      </div>
    </div>
  );
}
