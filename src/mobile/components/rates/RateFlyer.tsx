// RateFlyer — composant de prévisualisation (design v10, 2150×2560px en taille naturelle)
// Utilisé UNIQUEMENT pour la preview à l'écran (réduit avec transform:scale dans le parent).
// L'image exportée est générée côté serveur par la Edge Function generate-flyer.
import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';

export interface RateFlyerProps {
  alipay: number;
  wechat: number;
  bank: number;
  cash: number;
  theme?: 'dark' | 'light';
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR');
}

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

  const cnWeekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const enWeekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const enMonths   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const cnDate = `${gz.getFullYear()}年${gz.getMonth()+1}月${gz.getDate()}日，${cnWeekdays[gz.getDay()]}`;
  const enDate = `${enWeekdays[gz.getDay()]}, ${gz.getDate()} ${enMonths[gz.getMonth()]} ${gz.getFullYear()}`;

  // Couleurs selon le thème
  const bg         = isDark ? '#08060F' : '#F8F5FF';
  const textMain   = isDark ? '#F0EBF8' : '#1A0F33';
  const cardBg     = isDark ? '#100D1C' : '#FFFFFF';
  const cardBorder = isDark ? '#221B3A' : '#DDD4F5';
  const sub        = '#8878A8';
  const timeColor  = isDark ? '#FFFFFF' : '#A947FE';
  const urlColor   = isDark ? '#FFFFFF' : '#A947FE';

  const rateData = [
    { label: 'Alipay',        cn: '支付宝',  rate: alipay, barColor: '#1677FF', nameColor: '#1677FF', symColor: '#1677FF', badgeColor: '#1677FF', badge: 'Instantané · 即时到账',          iconBg: '#1677FF', iconColor: '#fff', iconText: '支', isCN: true,  isCash: false, isBank: false },
    { label: 'WeChat Pay',    cn: '微信支付', rate: wechat, barColor: '#07C160', nameColor: '#07C160', symColor: '#07C160', badgeColor: '#07C160', badge: 'Instantané · 即时到账',          iconBg: '#07C160', iconColor: '#fff', iconText: '微', isCN: true,  isCash: false, isBank: false },
    { label: 'Bank Transfer', cn: '银行转账', rate: bank,   barColor: '#F3A745', nameColor: '#D4850A', symColor: '#D4850A', badgeColor: '#D4850A', badge: 'Instantané · 即时到账',          iconBg: '#F3A745', iconColor: '#1A0F33', iconText: '',  isCN: false, isCash: false, isBank: true  },
    { label: 'Cash',          cn: '现金',    rate: cash,   barColor: '#DC2626', nameColor: '#DC2626', symColor: '#DC2626', badgeColor: '#DC2626', badge: 'Remise en main propre · 现场交付', iconBg: '#DC2626', iconColor: '#fff', iconText: '¥', isCN: false, isCash: true,  isBank: false },
  ];

  return (
    <div style={{ width: 2150, height: 2560, backgroundColor: bg, display: 'flex', flexDirection: 'column', fontFamily: '"DM Sans", sans-serif' }}>

      {/* Barre haut */}
      <div style={{ height: 14, background: 'linear-gradient(90deg,#A947FE,#F3A745,#FE560D)', flexShrink: 0 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '60px 110px 44px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 900, fontSize: 96, color: textMain, letterSpacing: -3, lineHeight: 1 }}>Bonzini</div>
          <div style={{ fontWeight: 400, fontSize: 32, color: sub, letterSpacing: 5, marginTop: 6 }}>PAYMENT PLATFORM</div>
        </div>
        {/* Badge "Taux du Jour" — fond #DC2626, texte blanc */}
        <div style={{ backgroundColor: '#DC2626', borderRadius: 50, padding: '22px 58px', color: '#FFFFFF', fontWeight: 700, fontSize: 40, letterSpacing: 2 }}>
          Taux du Jour · 今日汇率
        </div>
      </div>

      {/* Séparateur */}
      <div style={{ height: 3, margin: '0 80px', background: 'linear-gradient(90deg,transparent,rgba(169,71,254,.6) 25%,rgba(243,167,69,.6) 75%,transparent)', borderRadius: 2, flexShrink: 0 }} />

      {/* Zone date + heure */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '56px 110px 44px', gap: 60, flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontWeight: 500, fontSize: 52, color: sub, lineHeight: 1.35 }}>{cnDate}</div>
          <div style={{ fontWeight: 700, fontSize: 72, color: textMain, letterSpacing: -1, lineHeight: 1.25 }}>{enDate}</div>
        </div>
        {/* Boîte heure Guangzhou → blanc (#FFFFFF) en dark */}
        <div style={{
          borderRadius: 28, padding: '36px 60px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(169,71,254,0.07)',
          border: `2.5px solid ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(169,71,254,0.22)'}`,
          flexShrink: 0, minWidth: 540,
        }}>
          <div style={{ fontWeight: 900, fontSize: 136, color: timeColor, letterSpacing: -4, lineHeight: 1 }}>{hh}:{mm}</div>
          <div style={{ fontWeight: 500, fontSize: 34, color: sub, marginTop: 12 }}>Guangzhou · UTC+8</div>
          <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 30, color: sub, opacity: 0.65, marginTop: 6 }}>中国广东广州时间</div>
        </div>
      </div>

      {/* Héro 1 000 000 XAF */}
      <div style={{ padding: '6px 110px 44px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontWeight: 400, fontSize: 58, color: sub }}>Pour&nbsp;</span>
          <span style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 46, color: sub, opacity: 0.7 }}>兑换</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 900, fontSize: 240, letterSpacing: -4, lineHeight: 0.9, color: textMain }}>1</span>
          <span style={{ fontWeight: 900, fontSize: 180, lineHeight: 0.9, color: textMain, opacity: 0.25 }}>&nbsp;</span>
          <span style={{ fontWeight: 900, fontSize: 240, letterSpacing: -4, lineHeight: 0.9, color: textMain }}>000</span>
          <span style={{ fontWeight: 900, fontSize: 180, lineHeight: 0.9, color: textMain, opacity: 0.25 }}>&nbsp;</span>
          <span style={{ fontWeight: 900, fontSize: 240, letterSpacing: -4, lineHeight: 0.9, color: textMain }}>000</span>
          <span style={{ fontWeight: 800, fontSize: 88, color: '#F3A745', alignSelf: 'flex-end', marginBottom: 22, letterSpacing: 2, marginLeft: 24 }}>XAF</span>
          <span style={{ fontWeight: 300, fontSize: 170, color: '#A947FE', opacity: 0.5, lineHeight: 1, marginBottom: 6, marginLeft: 16 }}>→</span>
        </div>
      </div>

      {/* Grille des 4 taux */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 44, padding: '6px 110px 50px', flexShrink: 0 }}>
        {rateData.map((r) => (
          <div key={r.label} style={{
            width: 943,
            backgroundColor: cardBg,
            border: `2px solid ${cardBorder}`,
            borderRadius: 36,
            padding: 58,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Barre colorée */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, backgroundColor: r.barColor, borderRadius: '36px 36px 0 0' }} />

            {/* Icône + nom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 28, marginTop: 10 }}>
              <div style={{
                width: 88, height: 88, borderRadius: 18,
                backgroundColor: r.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {r.isBank
                  ? <Landmark color={r.iconColor} width={52} height={52} strokeWidth={2} />
                  : <span style={{ fontFamily: r.isCN ? '"Noto Sans SC", sans-serif' : undefined, fontSize: r.isCash ? 58 : 34, fontWeight: 700, color: r.iconColor, lineHeight: 1 }}>{r.iconText}</span>
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 54, fontWeight: 700, color: r.nameColor, lineHeight: 1.1 }}>{r.label}</div>
                <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 36, color: sub, marginTop: 6 }}>{r.cn}</div>
              </div>
            </div>

            {/* Montant — formatage fr-FR : 11530 → "11 530" */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 24 }}>
              <span style={{ fontSize: 96, fontWeight: 800, color: r.symColor, lineHeight: 1 }}>¥</span>
              <span style={{ fontSize: 188, fontWeight: 900, color: textMain, letterSpacing: -2, lineHeight: 1 }}>{formatNumber(r.rate)}</span>
            </div>

            {/* Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              backgroundColor: `${r.badgeColor}20`,
              border: `1.5px solid ${r.badgeColor}80`,
              borderRadius: 44,
              padding: '14px 34px',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: r.barColor, flexShrink: 0 }} />
              <span style={{ fontSize: 30, fontWeight: 600, color: r.nameColor }}>{r.badge}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Séparateur footer */}
      <div style={{ height: 3, margin: '0 80px', background: 'linear-gradient(90deg,transparent,rgba(169,71,254,.4) 50%,transparent)', borderRadius: 2, flexShrink: 0 }} />

      {/* Footer */}
      <div style={{ padding: '40px 110px 54px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* bonzinilabs.com → blanc (#FFFFFF) en dark */}
        <div style={{ fontWeight: 800, fontSize: 78, color: urlColor, letterSpacing: -1, marginBottom: 36 }}>bonzinilabs.com</div>

        {/* Contacts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 56, marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 28, color: '#fff' }}>W</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 32, color: sub }}>Cameroun · WhatsApp</div>
              <div style={{ fontWeight: 800, fontSize: 54, color: textMain, letterSpacing: -1 }}>+237 652 236 856</div>
            </div>
          </div>
          <div style={{ width: 2, height: 96, backgroundColor: cardBorder, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: '#07C160', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 28, color: '#fff' }}>W</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 32, color: sub }}>中国 · WhatsApp / 微信</div>
              <div style={{ fontWeight: 800, fontSize: 54, color: textMain, letterSpacing: -1 }}>+86 131 3849 5598</div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ fontSize: 27, color: sub, opacity: 0.65, lineHeight: 1.6 }}>
          Les taux affichés sont indicatifs et peuvent varier sans préavis. Bonzini n'est pas responsable des pertes liées aux fluctuations de change.
        </div>
        <div style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: 25, color: sub, opacity: 0.65, lineHeight: 1.6, marginTop: 4 }}>
          显示汇率仅供参考，可能随时变动。
        </div>
      </div>

      {/* Barre bas */}
      <div style={{ height: 14, background: 'linear-gradient(90deg,#FE560D,#F3A745,#A947FE)', flexShrink: 0 }} />
    </div>
  );
}
