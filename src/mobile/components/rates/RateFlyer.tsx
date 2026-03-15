import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';

interface RateFlyerProps {
  rates: {
    alipay: number;
    wechat: number;
    bank: number;
    cash: number;
  };
  dark?: boolean;
}

function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function RateFlyer({ rates, dark = true }: RateFlyerProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const gz = new Date(time.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const h = gz.getHours().toString().padStart(2, '0');
  const m = gz.getMinutes().toString().padStart(2, '0');
  const cnP = gz.getHours() < 12 ? '上午' : '下午';
  const cnD = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][gz.getDay()];
  const enM = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][gz.getMonth()];
  const enD = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][gz.getDay()];

  const V = '#A947FE', G = '#F3A745';

  const rateCards = [
    { method: 'Alipay',        sub: '支付宝',   type: 'alipay'  as const, rate: rates.alipay },
    { method: 'WeChat Pay',    sub: '微信支付', type: 'wechat'  as const, rate: rates.wechat },
    { method: 'Bank Transfer', sub: '银行转账', type: 'bank'    as const, rate: rates.bank   },
    { method: 'Cash',          sub: '现金',     type: 'cash'    as const, rate: rates.cash   },
  ];

  function MethodIcon({ type, size = 42 }: { type: 'alipay' | 'wechat' | 'bank' | 'cash'; size?: number }) {
    const r = size / 2;
    const base: React.CSSProperties = {
      width: size, height: size, borderRadius: 11, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
    if (type === 'alipay') return (
      <div style={{ ...base, background: 'linear-gradient(135deg,#1677FF,#0958d9)' }}>
        <span style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: r * 0.9, fontWeight: 700, color: '#fff', lineHeight: 1 }}>支</span>
      </div>
    );
    if (type === 'wechat') return (
      <div style={{ ...base, background: 'linear-gradient(135deg,#07C160,#06ae56)' }}>
        <span style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: r * 0.9, fontWeight: 700, color: '#fff', lineHeight: 1 }}>微</span>
      </div>
    );
    if (type === 'bank') return (
      <div style={{ ...base, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
        <Landmark color="#fff" width={r * 0.9} height={r * 0.9} strokeWidth={2} />
      </div>
    );
    return (
      <div style={{ ...base, background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: r * 0.9, fontWeight: 700, color: '#fff', lineHeight: 1 }}>¥</span>
      </div>
    );
  }

  const c = dark ? {
    pageBg: '#050208',
    bg: 'linear-gradient(170deg,#0f0820,#120a22 50%,#0a0514)',
    text: '#fff',
    sub: 'rgba(255,255,255,0.45)',
    dim: 'rgba(255,255,255,0.25)',
    faint: 'rgba(255,255,255,0.15)',
    cardBg: 'rgba(255,255,255,0.03)',
    cardBd: 'rgba(255,255,255,0.06)',
    shadow: `0 40px 80px rgba(0,0,0,0.6),0 0 160px ${V}08`,
  } : {
    pageBg: '#f0edf4',
    bg: 'linear-gradient(170deg,#fff,#faf8fc 50%,#f5f2f8)',
    text: '#1a1028',
    sub: 'rgba(26,16,40,0.5)',
    dim: 'rgba(26,16,40,0.3)',
    faint: 'rgba(26,16,40,0.15)',
    cardBg: 'rgba(26,16,40,0.02)',
    cardBd: 'rgba(26,16,40,0.08)',
    shadow: `0 20px 60px rgba(0,0,0,0.08),0 0 80px ${V}05`,
  };

  return (
    <div style={{ width: 440, background: c.pageBg, padding: 0 }}>
      <div style={{
        width: 440,
        borderRadius: 28,
        overflow: 'hidden',
        background: c.bg,
        position: 'relative',
        boxShadow: c.shadow,
      }}>
        {/* Glow orbs (dark only) */}
        {dark && (
          <>
            <div style={{ position: 'absolute', top: -80, right: -40, width: 250, height: 250, borderRadius: '50%', background: `radial-gradient(circle,${V}10,transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 120, left: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle,${G}08,transparent 70%)`, pointerEvents: 'none' }} />
          </>
        )}

        <div style={{ position: 'relative', zIndex: 1, padding: '28px 28px 22px' }}>
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Logo SVG — 4 paths officiels, NE PAS MODIFIER */}
              <svg width={36} height={36} viewBox="0 0 100 100" fill="none">
                <path d="M50.8,43.87 L49.79,43.9 L48.86,43.85 L47.93,43.7 L47.15,43.52 L46.4,43.24 L45.69,42.93 L45.05,42.56 L44.45,42.12 L43.91,41.66 L43.44,41.12 L43.01,40.56 L42.57,39.97 L42.12,39.37 L41.69,38.78 L41.25,38.19 L40.81,37.6 L40.39,37.0 L39.97,36.45 L39.54,35.85 L39.12,35.27 L38.7,34.7 L38.27,34.12 L37.85,33.53 L37.41,32.94 L36.98,32.35 L36.55,31.75 L36.13,31.16 L35.68,30.57 L35.27,29.97 L34.82,29.38 L34.42,28.79 L33.97,28.2 L33.55,27.6 L33.11,27.02 L32.68,26.43 L32.29,25.83 L32.47,25.15 L33.02,24.72 L33.67,24.3 L34.29,23.88 L34.89,23.53 L35.56,23.15 L36.24,22.79 L36.92,22.45 L37.6,22.12 L38.27,21.84 L39.03,21.54 L39.8,21.27 L40.56,21.02 L41.32,20.8 L42.13,20.58 L42.93,20.39 L43.86,20.25 L44.25,20.91 L44.44,21.76 L44.61,22.61 L44.78,23.45 L44.96,24.29 L45.12,25.15 L45.29,25.99 L45.46,26.84 L45.63,27.69 L45.81,28.52 L45.97,29.38 L46.15,30.23 L46.32,31.06 L46.49,31.91 L46.66,32.75 L46.82,33.6 L46.99,34.44 L47.17,35.22 L47.34,36.07 L47.51,36.92 L47.67,37.76 L47.81,38.7 L48.05,39.46 L48.52,39.99 L49.27,40.3 L50.21,40.34 L51.06,40.18 L51.64,39.71 L51.97,39.03 L52.16,38.26 L52.33,37.41 L52.5,36.49 L52.67,35.65 L52.83,34.8 L52.99,33.95 L53.17,33.11 L53.34,32.26 L53.49,31.41 L53.66,30.57 L53.83,29.72 L54.01,28.87 L54.18,28.03 L54.34,27.18 L54.52,26.33 L54.69,25.49 L54.86,24.64 L55.03,23.79 L55.2,22.95 L55.38,22.18 L55.57,21.34 L55.8,20.5 L56.14,19.85 L56.96,20.07 L57.66,20.38 L58.34,20.67 L59.1,20.99 L59.78,21.3 L60.47,21.59 L61.21,21.93 L61.9,22.22 L62.59,22.52 L63.34,22.85 L64.01,23.15 L64.73,23.45 L65.45,23.77 L66.13,24.06 L66.86,24.39 L67.56,24.72 L67.67,25.4 L67.36,26.08 L66.98,26.74 L66.55,27.34 L66.13,27.92 L65.71,28.49 L65.28,29.09 L64.86,29.68 L64.44,30.24 L64.0,30.82 L63.59,31.42 L63.16,32.01 L62.73,32.6 L62.31,33.19 L61.87,33.78 L61.44,34.38 L61.01,34.97 L60.58,35.56 L60.14,36.16 L59.71,36.75 L59.27,37.33 L58.85,37.91 L58.43,38.48 L58.0,39.06 L57.58,39.66 L57.14,40.22 L56.71,40.81 L56.22,41.4 L55.72,41.91 L55.18,42.34 L54.53,42.74 L53.86,43.1 L53.18,43.37 L52.41,43.61 L51.57,43.79 Z" fill="#F3A745"/>
                <path d="M51.4,49.03 L50.21,49.07 L49.03,49.07 L47.84,49.07 L46.74,48.97 L45.64,48.9 L44.54,48.82 L43.44,48.72 L42.42,48.57 L41.41,48.41 L40.39,48.24 L39.33,48.09 L38.36,47.91 L37.34,47.75 L36.33,47.57 L35.31,47.4 L34.29,47.21 L33.28,47.02 L32.26,46.83 L31.33,46.65 L30.31,46.46 L29.3,46.25 L28.35,46.06 L27.35,45.87 L26.33,45.69 L25.32,45.5 L24.3,45.32 L23.29,45.13 L22.35,44.96 L21.34,44.76 L20.49,44.45 L19.98,43.73 L20.15,42.77 L20.46,41.91 L20.78,41.07 L21.09,40.22 L21.43,39.37 L21.76,38.49 L22.1,37.62 L22.43,36.75 L22.75,35.9 L23.09,35.06 L23.4,34.21 L23.74,33.36 L24.44,33.11 L25.19,33.53 L25.91,33.97 L26.67,34.45 L27.35,34.9 L28.09,35.39 L28.79,35.86 L29.49,36.33 L30.23,36.83 L30.91,37.27 L31.65,37.76 L32.35,38.23 L33.06,38.7 L33.78,39.19 L34.46,39.64 L35.19,40.14 L35.9,40.6 L36.6,41.07 L37.34,41.56 L38.02,42.02 L38.77,42.51 L39.46,42.96 L40.22,43.43 L40.98,43.82 L41.78,44.2 L42.59,44.55 L43.45,44.88 L44.37,45.16 L45.3,45.4 L46.32,45.61 L47.33,45.78 L48.43,45.85 L49.53,45.93 L50.64,45.87 L51.82,45.81 L52.84,45.65 L53.79,45.47 L54.78,45.22 L55.63,44.96 L56.56,44.63 L57.39,44.28 L58.17,43.94 L58.93,43.51 L59.7,43.07 L60.44,42.59 L61.13,42.13 L61.84,41.66 L62.57,41.17 L63.26,40.73 L64.01,40.23 L64.69,39.75 L65.39,39.29 L66.13,38.8 L66.81,38.35 L67.57,37.87 L68.25,37.4 L68.95,36.92 L69.69,36.42 L70.36,35.99 L71.13,35.48 L71.8,35.05 L72.51,34.55 L73.24,34.08 L73.96,33.62 L74.68,33.17 L75.44,33.21 L75.81,34.04 L76.14,34.89 L76.49,35.73 L76.84,36.58 L77.18,37.43 L77.52,38.27 L77.86,39.12 L78.2,39.97 L78.54,40.81 L78.89,41.66 L79.23,42.51 L79.57,43.35 L79.75,44.2 L78.91,44.54 L77.9,44.75 L76.88,44.94 L75.87,45.12 L74.94,45.3 L73.92,45.48 L72.9,45.67 L71.89,45.85 L70.87,46.06 L69.93,46.23 L68.92,46.41 L67.91,46.64 L66.98,46.83 L65.96,47.04 L64.94,47.22 L64.01,47.44 L63.0,47.64 L61.98,47.81 L60.97,48.0 L59.95,48.16 L58.93,48.3 L57.88,48.43 L56.82,48.56 L55.8,48.71 L54.7,48.79 L53.6,48.9 L52.41,48.93 L51.4,49.03 Z" fill="#A947FE"/>
                <path d="M75.61,66.81 L74.77,66.56 L74.12,66.13 L73.47,65.71 L72.8,65.28 L72.14,64.83 L71.46,64.42 L70.79,63.97 L70.11,63.53 L69.43,63.09 L68.76,62.67 L68.1,62.24 L67.44,61.81 L66.79,61.39 L66.13,60.93 L65.45,60.49 L64.8,60.03 L64.18,59.6 L63.51,59.13 L62.88,58.68 L62.24,58.2 L61.63,57.75 L60.97,57.26 L60.32,56.82 L59.64,56.39 L58.93,56.02 L58.17,55.63 L57.45,55.29 L56.65,55.0 L55.8,54.74 L54.95,54.51 L54.02,54.3 L53.09,54.15 L52.16,54.02 L51.06,53.98 L49.96,53.98 L48.86,53.99 L47.87,54.11 L46.91,54.21 L45.98,54.39 L45.05,54.61 L44.2,54.85 L43.43,55.12 L42.61,55.46 L41.83,55.8 L41.15,56.15 L40.4,56.56 L39.71,56.96 L39.03,57.39 L38.36,57.83 L37.68,58.25 L37.02,58.68 L36.36,59.1 L35.7,59.53 L35.05,59.95 L34.38,60.4 L33.7,60.85 L33.02,61.29 L32.39,61.73 L31.75,62.16 L31.08,62.6 L30.4,63.06 L29.76,63.51 L29.12,63.93 L28.45,64.39 L27.77,64.85 L27.1,65.28 L26.49,65.71 L25.83,66.16 L25.15,66.59 L24.39,66.76 L24.01,66.05 L23.7,65.28 L23.37,64.5 L23.03,63.7 L22.71,62.91 L22.4,62.15 L22.09,61.39 L21.75,60.63 L21.42,59.84 L21.11,59.02 L20.77,58.26 L20.45,57.49 L20.14,56.73 L20.24,55.9 L21.08,55.64 L21.91,55.38 L22.72,55.12 L23.6,54.87 L24.47,54.65 L25.32,54.4 L26.16,54.19 L27.1,53.96 L27.94,53.75 L28.87,53.53 L29.75,53.34 L30.65,53.16 L31.58,52.97 L32.51,52.79 L33.45,52.63 L34.38,52.46 L35.31,52.3 L36.3,52.16 L37.26,52.01 L38.27,51.92 L39.2,51.78 L40.22,51.66 L41.24,51.59 L42.17,51.46 L43.27,51.41 L44.28,51.33 L45.3,51.27 L46.4,51.24 L47.42,51.19 L48.52,51.18 L49.53,51.1 L50.64,51.1 L51.65,51.18 L52.75,51.2 L53.77,51.25 L54.87,51.27 L55.88,51.34 L56.9,51.43 L57.94,51.48 L58.93,51.59 L59.95,51.68 L60.97,51.79 L61.9,51.92 L62.91,52.05 L63.84,52.18 L64.78,52.33 L65.79,52.49 L66.72,52.65 L67.65,52.83 L68.59,53.0 L69.46,53.18 L70.36,53.4 L71.3,53.57 L72.14,53.78 L73.07,54.02 L73.92,54.21 L74.8,54.45 L75.7,54.69 L76.55,54.91 L77.39,55.17 L78.24,55.43 L79.09,55.69 L79.85,56.01 L79.73,56.9 L79.4,57.66 L79.09,58.48 L78.76,59.27 L78.44,60.03 L78.15,60.8 L77.82,61.62 L77.49,62.4 L77.16,63.17 L76.85,63.93 L76.55,64.74 L76.21,65.54 L75.9,66.3 Z" fill="#A947FE"/>
                <path d="M56.31,80.04 L55.73,79.59 L55.55,78.76 L55.38,77.93 L55.21,77.1 L55.04,76.29 L54.87,75.44 L54.69,74.6 L54.52,73.75 L54.34,72.9 L54.17,72.06 L54.0,71.21 L53.82,70.36 L53.65,69.52 L53.48,68.67 L53.3,67.82 L53.13,66.98 L52.96,66.13 L52.79,65.28 L52.61,64.44 L52.43,63.59 L52.26,62.74 L52.12,61.9 L51.96,61.05 L51.68,60.29 L51.21,59.78 L50.47,59.51 L49.45,59.48 L48.66,59.7 L48.11,60.2 L47.8,60.88 L47.63,61.73 L47.47,62.57 L47.3,63.42 L47.15,64.27 L46.98,65.11 L46.8,65.96 L46.64,66.81 L46.47,67.65 L46.3,68.5 L46.14,69.35 L45.96,70.19 L45.79,71.04 L45.62,71.89 L45.44,72.73 L45.27,73.58 L45.11,74.43 L44.93,75.28 L44.76,76.12 L44.59,76.97 L44.4,77.82 L44.2,78.63 L43.95,79.38 L43.16,79.51 L42.34,79.31 L41.49,79.1 L40.73,78.89 L39.97,78.65 L39.2,78.38 L38.44,78.09 L37.76,77.8 L37.06,77.48 L36.37,77.14 L35.7,76.8 L35.06,76.44 L34.38,76.04 L33.78,75.67 L33.18,75.28 L32.58,74.85 L32.1,74.26 L32.5,73.58 L32.91,72.99 L33.35,72.4 L33.78,71.8 L34.21,71.22 L34.63,70.64 L35.06,70.04 L35.48,69.46 L35.9,68.9 L36.33,68.29 L36.75,67.73 L37.18,67.15 L37.63,66.55 L38.08,65.96 L38.52,65.37 L38.95,64.81 L39.37,64.23 L39.8,63.66 L40.22,63.08 L40.66,62.49 L41.07,61.88 L41.49,61.24 L41.9,60.63 L42.27,60.03 L42.69,59.44 L43.17,58.85 L43.65,58.34 L44.2,57.83 L44.79,57.43 L45.39,57.07 L46.15,56.74 L46.91,56.48 L47.68,56.31 L48.6,56.18 L49.53,56.1 L50.47,56.16 L51.48,56.22 L52.33,56.35 L53.17,56.56 L53.85,56.83 L54.56,57.15 L55.19,57.58 L55.72,58.01 L56.23,58.51 L56.73,59.1 L57.15,59.68 L57.58,60.27 L57.99,60.88 L58.41,61.47 L58.83,62.07 L59.25,62.66 L59.68,63.25 L60.11,63.84 L60.54,64.43 L60.96,65.03 L61.39,65.6 L61.81,66.17 L62.24,66.75 L62.66,67.33 L63.09,67.91 L63.52,68.5 L63.96,69.09 L64.41,69.69 L64.84,70.28 L65.28,70.87 L65.71,71.45 L66.13,72.03 L66.55,72.63 L66.97,73.24 L67.34,73.84 L67.74,74.49 L67.43,75.11 L66.72,75.42 L66.05,75.72 L65.35,76.04 L64.61,76.36 L63.93,76.65 L63.25,76.97 L62.5,77.31 L61.81,77.62 L61.13,77.92 L60.41,78.24 L59.7,78.54 L59.02,78.85 L58.29,79.17 L57.58,79.49 L56.9,79.79 Z" fill="#FE560D"/>
              </svg>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: c.text }}>Bonzini</div>
                <div style={{ fontFamily: "'DM Sans','Noto Sans SC',sans-serif", fontSize: 8, fontWeight: 600, color: G, letterSpacing: 2, textTransform: 'uppercase' }}>Daily Rate · 每日汇率</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: c.sub }}>{enD}, {gz.getDate()} {enM} {gz.getFullYear()}</div>
              <div style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: 10, color: c.dim, marginTop: 2 }}>{gz.getFullYear()}年{gz.getMonth() + 1}月{gz.getDate()}日 {cnD}</div>
            </div>
          </div>

          {/* TIME — compact single line */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, padding: '6px 0' }}>
            <span style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: 10, fontWeight: 600, color: c.dim, letterSpacing: 1 }}>广州</span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 900, color: c.text, letterSpacing: '-1px' }}>
              {h}<span style={{ color: G }}>:</span>{m}
            </span>
            <span style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: 12, color: c.dim }}>{cnP}</span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: c.faint }}>GMT+8</span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: dark ? `linear-gradient(90deg,transparent,${V}20,${G}20,transparent)` : `linear-gradient(90deg,transparent,${V}12,${G}12,transparent)`, marginBottom: 14 }} />

          {/* RATE FOR */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: c.dim, letterSpacing: 1 }}>Exchange rate for · 汇率基于</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 34, fontWeight: 800, color: G }}>1 000 000</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 800, color: c.dim }}>XAF</span>
            </div>
          </div>

          {/* RATE CARDS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {rateCards.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderRadius: 16, background: c.cardBg, border: `1px solid ${c.cardBd}` }}>
                <MethodIcon type={r.type} size={42} />
                <div style={{ flex: 1, marginLeft: 12 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.75)' : c.text }}>{r.method}</div>
                  <div style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: 10, color: c.dim, marginTop: 1 }}>{r.sub}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 700, color: c.dim }}>¥</span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 50, fontWeight: 900, color: c.text, letterSpacing: '2px' }}>{fmt(r.rate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* INSTANT NOTICE */}
          <div style={{ textAlign: 'center', marginBottom: 10, padding: '10px 16px', borderRadius: 10, background: dark ? `linear-gradient(135deg,${V}08,${G}05)` : `linear-gradient(135deg,${V}06,${G}04)`, border: `1px solid ${dark ? `${V}12` : `${V}10`}` }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: c.sub, lineHeight: 1.5 }}>
              Payments via Alipay, WeChat Pay & Bank Transfer are{' '}
              <span style={{ color: '#34d399', fontWeight: 800 }}>instant</span>
            </div>
            <div style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: 10, color: c.dim, marginTop: 3 }}>
              通过支付宝、微信支付和银行转账<span style={{ color: '#34d399' }}>即时到账</span>
            </div>
          </div>

          {/* WEBSITE */}
          <div style={{ textAlign: 'center', marginBottom: 10, padding: '14px 20px', borderRadius: 14, background: dark ? `linear-gradient(135deg,${V}15,${G}10)` : `linear-gradient(135deg,${V}10,${G}06)`, border: `1px solid ${dark ? `${V}20` : `${V}15`}` }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: c.text }}>bonzinilabs.com</div>
          </div>

          {/* DISCLAIMER */}
          <div style={{ textAlign: 'center', marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 500, color: c.faint, lineHeight: 1.5 }}>
              Rates are indicative and may vary based on payment method, transaction volume and market conditions. Final rate confirmed at time of transaction.
            </div>
            <div style={{ fontFamily: "'Noto Sans SC',sans-serif", fontSize: 8, color: c.faint, marginTop: 3, lineHeight: 1.5 }}>
              汇率仅供参考，可能因付款方式、交易量和市场状况而异。最终汇率以交易时确认为准。
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginBottom: 10 }} />

          {/* CONTACTS */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 8, fontWeight: 700, color: c.faint, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>WhatsApp</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 800, color: c.sub }}>+237 652 236 856</div>
            </div>
            <div style={{ width: 1, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 8, fontWeight: 700, color: c.faint, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>China · 中国</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 800, color: c.sub }}>+86 131 3849 5598</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
