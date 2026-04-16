import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { motion, useInView, animate } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { track } from '@vercel/analytics';
import { getStoredUtm } from '@/hooks/useUtmTracking';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: '#050208', violet: '#a64af7', violetGlow: '#c084fc',
  gold: '#f3a745', orange: '#fe560d',
  muted: '#8b82a0', dim: '#3d3555',
  surface: '#0f0b18', surfaceLight: '#1a1428',
  alipay: '#1677ff', wechat: '#07c160',
};
const F = { display: "'Syne', sans-serif", body: "'DM Sans', sans-serif" };

// ─── Logo SVG ─────────────────────────────────────────────────────────────────
function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M50.8,43.87L49.79,43.9L48.86,43.85L47.93,43.7L47.15,43.52L46.4,43.24L45.69,42.93L45.05,42.56L44.45,42.12L43.91,41.66L43.44,41.12L43.01,40.56L42.57,39.97L42.12,39.37L41.69,38.78L41.25,38.19L40.81,37.6L40.39,37.0L39.97,36.45L39.54,35.85L39.12,35.27L38.7,34.7L38.27,34.12L37.85,33.53L37.41,32.94L36.98,32.35L36.55,31.75L36.13,31.16L35.68,30.57L35.27,29.97L34.82,29.38L34.42,28.79L33.97,28.2L33.55,27.6L33.11,27.02L32.68,26.43L32.29,25.83L32.47,25.15L33.02,24.72L33.67,24.3L34.29,23.88L34.89,23.53L35.56,23.15L36.24,22.79L36.92,22.45L37.6,22.12L38.27,21.84L39.03,21.54L39.8,21.27L40.56,21.02L41.32,20.8L42.13,20.58L42.93,20.39L43.86,20.25L44.25,20.91L44.44,21.76L44.61,22.61L44.78,23.45L44.96,24.29L45.12,25.15L45.29,25.99L45.46,26.84L45.63,27.69L45.81,28.52L45.97,29.38L46.15,30.23L46.32,31.06L46.49,31.91L46.66,32.75L46.82,33.6L46.99,34.44L47.17,35.22L47.34,36.07L47.51,36.92L47.67,37.76L47.81,38.7L48.05,39.46L48.52,39.99L49.27,40.3L50.21,40.34L51.06,40.18L51.64,39.71L51.97,39.03L52.16,38.26L52.33,37.41L52.5,36.49L52.67,35.65L52.83,34.8L52.99,33.95L53.17,33.11L53.34,32.26L53.49,31.41L53.66,30.57L53.83,29.72L54.01,28.87L54.18,28.03L54.34,27.18L54.52,26.33L54.69,25.49L54.86,24.64L55.03,23.79L55.2,22.95L55.38,22.18L55.57,21.34L55.8,20.5L56.14,19.85L56.96,20.07L57.66,20.38L58.34,20.67L59.1,20.99L59.78,21.3L60.47,21.59L61.21,21.93L61.9,22.22L62.59,22.52L63.34,22.85L64.01,23.15L64.73,23.45L65.45,23.77L66.13,24.06L66.86,24.39L67.56,24.72L67.67,25.4L67.36,26.08L66.98,26.74L66.55,27.34L66.13,27.92L65.71,28.49L65.28,29.09L64.86,29.68L64.44,30.24L64.0,30.82L63.59,31.42L63.16,32.01L62.73,32.6L62.31,33.19L61.87,33.78L61.44,34.38L61.01,34.97L60.58,35.56L60.14,36.16L59.71,36.75L59.27,37.33L58.85,37.91L58.43,38.48L58.0,39.06L57.58,39.66L57.14,40.22L56.71,40.81L56.22,41.4L55.72,41.91L55.18,42.34L54.53,42.74L53.86,43.1L53.18,43.37L52.41,43.61L51.57,43.79Z" fill="#F3A745"/>
      <path d="M51.4,49.03L50.21,49.07L49.03,49.07L47.84,49.07L46.74,48.97L45.64,48.9L44.54,48.82L43.44,48.72L42.42,48.57L41.41,48.41L40.39,48.24L39.33,48.09L38.36,47.91L37.34,47.75L36.33,47.57L35.31,47.4L34.29,47.21L33.28,47.02L32.26,46.83L31.33,46.65L30.31,46.46L29.3,46.25L28.35,46.06L27.35,45.87L26.33,45.69L25.32,45.5L24.3,45.32L23.29,45.13L22.35,44.96L21.34,44.76L20.49,44.45L19.98,43.73L20.15,42.77L20.46,41.91L20.78,41.07L21.09,40.22L21.43,39.37L21.76,38.49L22.1,37.62L22.43,36.75L22.75,35.9L23.09,35.06L23.4,34.21L23.74,33.36L24.44,33.11L25.19,33.53L25.91,33.97L26.67,34.45L27.35,34.9L28.09,35.39L28.79,35.86L29.49,36.33L30.23,36.83L30.91,37.27L31.65,37.76L32.35,38.23L33.06,38.7L33.78,39.19L34.46,39.64L35.19,40.14L35.9,40.6L36.6,41.07L37.34,41.56L38.02,42.02L38.77,42.51L39.46,42.96L40.22,43.43L40.98,43.82L41.78,44.2L42.59,44.55L43.45,44.88L44.37,45.16L45.3,45.4L46.32,45.61L47.33,45.78L48.43,45.85L49.53,45.93L50.64,45.87L51.82,45.81L52.84,45.65L53.79,45.47L54.78,45.22L55.63,44.96L56.56,44.63L57.39,44.28L58.17,43.94L58.93,43.51L59.7,43.07L60.44,42.59L61.13,42.13L61.84,41.66L62.57,41.17L63.26,40.73L64.01,40.23L64.69,39.75L65.39,39.29L66.13,38.8L66.81,38.35L67.57,37.87L68.25,37.4L68.95,36.92L69.69,36.42L70.36,35.99L71.13,35.48L71.8,35.05L72.51,34.55L73.24,34.08L73.96,33.62L74.68,33.17L75.44,33.21L75.81,34.04L76.14,34.89L76.49,35.73L76.84,36.58L77.18,37.43L77.52,38.27L77.86,39.12L78.2,39.97L78.54,40.81L78.89,41.66L79.23,42.51L79.57,43.35L79.75,44.2L78.91,44.54L77.9,44.75L76.88,44.94L75.87,45.12L74.94,45.3L73.92,45.48L72.9,45.67L71.89,45.85L70.87,46.06L69.93,46.23L68.92,46.41L67.91,46.64L66.98,46.83L65.96,47.04L64.94,47.22L64.01,47.44L63.0,47.64L61.98,47.81L60.97,48.0L59.95,48.16L58.93,48.3L57.88,48.43L56.82,48.56L55.8,48.71L54.7,48.79L53.6,48.9L52.41,48.93L51.4,49.03Z" fill="#A947FE"/>
      <path d="M75.61,66.81L74.77,66.56L74.12,66.13L73.47,65.71L72.8,65.28L72.14,64.83L71.46,64.42L70.79,63.97L70.11,63.53L69.43,63.09L68.76,62.67L68.1,62.24L67.44,61.81L66.79,61.39L66.13,60.93L65.45,60.49L64.8,60.03L64.18,59.6L63.51,59.13L62.88,58.68L62.24,58.2L61.63,57.75L60.97,57.26L60.32,56.82L59.64,56.39L58.93,56.02L58.17,55.63L57.45,55.29L56.65,55.0L55.8,54.74L54.95,54.51L54.02,54.3L53.09,54.15L52.16,54.02L51.06,53.98L49.96,53.98L48.86,53.99L47.87,54.11L46.91,54.21L45.98,54.39L45.05,54.61L44.2,54.85L43.43,55.12L42.61,55.46L41.83,55.8L41.15,56.15L40.4,56.56L39.71,56.96L39.03,57.39L38.36,57.83L37.68,58.25L37.02,58.68L36.36,59.1L35.7,59.53L35.05,59.95L34.38,60.4L33.7,60.85L33.02,61.29L32.39,61.73L31.75,62.16L31.08,62.6L30.4,63.06L29.76,63.51L29.12,63.93L28.45,64.39L27.77,64.85L27.1,65.28L26.49,65.71L25.83,66.16L25.15,66.59L24.39,66.76L24.01,66.05L23.7,65.28L23.37,64.5L23.03,63.7L22.71,62.91L22.4,62.15L22.09,61.39L21.75,60.63L21.42,59.84L21.11,59.02L20.77,58.26L20.45,57.49L20.14,56.73L20.24,55.9L21.08,55.64L21.91,55.38L22.72,55.12L23.6,54.87L24.47,54.65L25.32,54.4L26.16,54.19L27.1,53.96L27.94,53.75L28.87,53.53L29.75,53.34L30.65,53.16L31.58,52.97L32.51,52.79L33.45,52.63L34.38,52.46L35.31,52.3L36.3,52.16L37.26,52.01L38.27,51.92L39.2,51.78L40.22,51.66L41.24,51.59L42.17,51.46L43.27,51.41L44.28,51.33L45.3,51.27L46.4,51.24L47.42,51.19L48.52,51.18L49.53,51.1L50.64,51.1L51.65,51.18L52.75,51.2L53.77,51.25L54.87,51.27L55.88,51.34L56.9,51.43L57.94,51.48L58.93,51.59L59.95,51.68L60.97,51.79L61.9,51.92L62.91,52.05L63.84,52.18L64.78,52.33L65.79,52.49L66.72,52.65L67.65,52.83L68.59,53.0L69.46,53.18L70.36,53.4L71.3,53.57L72.14,53.78L73.07,54.02L73.92,54.21L74.8,54.45L75.7,54.69L76.55,54.91L77.39,55.17L78.24,55.43L79.09,55.69L79.85,56.01L79.73,56.9L79.4,57.66L79.09,58.48L78.76,59.27L78.44,60.03L78.15,60.8L77.82,61.62L77.49,62.4L77.16,63.17L76.85,63.93L76.55,64.74L76.21,65.54L75.9,66.3Z" fill="#A947FE"/>
      <path d="M56.31,80.04L55.73,79.59L55.55,78.76L55.38,77.93L55.21,77.1L55.04,76.29L54.87,75.44L54.69,74.6L54.52,73.75L54.34,72.9L54.17,72.06L54.0,71.21L53.82,70.36L53.65,69.52L53.48,68.67L53.3,67.82L53.13,66.98L52.96,66.13L52.79,65.28L52.61,64.44L52.43,63.59L52.26,62.74L52.12,61.9L51.96,61.05L51.68,60.29L51.21,59.78L50.47,59.51L49.45,59.48L48.66,59.7L48.11,60.2L47.8,60.88L47.63,61.73L47.47,62.57L47.3,63.42L47.15,64.27L46.98,65.11L46.8,65.96L46.64,66.81L46.47,67.65L46.3,68.5L46.14,69.35L45.96,70.19L45.79,71.04L45.62,71.89L45.44,72.73L45.27,73.58L45.11,74.43L44.93,75.28L44.76,76.12L44.59,76.97L44.4,77.82L44.2,78.63L43.95,79.38L43.16,79.51L42.34,79.31L41.49,79.1L40.73,78.89L39.97,78.65L39.2,78.38L38.44,78.09L37.76,77.8L37.06,77.48L36.37,77.14L35.7,76.8L35.06,76.44L34.38,76.04L33.78,75.67L33.18,75.28L32.58,74.85L32.1,74.26L32.5,73.58L32.91,72.99L33.35,72.4L33.78,71.8L34.21,71.22L34.63,70.64L35.06,70.04L35.48,69.46L35.9,68.9L36.33,68.29L36.75,67.73L37.18,67.15L37.63,66.55L38.08,65.96L38.52,65.37L38.95,64.81L39.37,64.23L39.8,63.66L40.22,63.08L40.66,62.49L41.07,61.88L41.49,61.24L41.9,60.63L42.27,60.03L42.69,59.44L43.17,58.85L43.65,58.34L44.2,57.83L44.79,57.43L45.39,57.07L46.15,56.74L46.91,56.48L47.68,56.31L48.6,56.18L49.53,56.1L50.47,56.16L51.48,56.22L52.33,56.35L53.17,56.56L53.85,56.83L54.56,57.15L55.19,57.58L55.72,58.01L56.23,58.51L56.73,59.1L57.15,59.68L57.58,60.27L57.99,60.88L58.41,61.47L58.83,62.07L59.25,62.66L59.68,63.25L60.11,63.84L60.54,64.43L60.96,65.03L61.39,65.6L61.81,66.17L62.24,66.75L62.66,67.33L63.09,67.91L63.52,68.5L63.96,69.09L64.41,69.69L64.84,70.28L65.28,70.87L65.71,71.45L66.13,72.03L66.55,72.63L66.97,73.24L67.34,73.84L67.74,74.49L67.43,75.11L66.72,75.42L66.05,75.72L65.35,76.04L64.61,76.36L63.93,76.65L63.25,76.97L62.5,77.31L61.81,77.62L61.13,77.92L60.41,78.24L59.7,78.54L59.02,78.85L58.29,79.17L57.58,79.49L56.9,79.79Z" fill="#FE560D"/>
    </svg>
  );
}

// ─── Reveal (scroll animation) ───────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 50 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

// ─── Counter ─────────────────────────────────────────────────────────────────
function Counter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, end, { duration: 2, ease: 'easeOut', onUpdate: v => setDisplay(Math.floor(v)) });
    return ctrl.stop;
  }, [inView, end]);
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Nav({ onCTA }: { onCTA: () => void }) {
  const { t } = useTranslation('landing');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const navItems = [
    { key: 'howItWorks', anchor: 'fonctionnement' },
    { key: 'pricing', anchor: 'tarifs' },
    { key: 'faq', anchor: 'faq' },
  ] as const;

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(5,2,8,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.dim}40` : 'none',
      transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={28} />
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.5px' }}>Bonzini</span>
        </div>
        {/* Desktop */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 28 }}>
          {navItems.map(item => (
            <a key={item.key} href={`#${item.anchor}`} style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: 'none' }}>{t(`nav.${item.key}`)}</a>
          ))}
          <LanguageSwitcher />
          <button onClick={onCTA} style={{ fontFamily: F.body, fontWeight: 700, fontSize: 13, color: '#fff', background: `linear-gradient(135deg, ${C.violet}, #8b3cf0)`, border: 'none', padding: '10px 22px', borderRadius: 50, cursor: 'pointer' }}>
            {t('nav.cta')}
          </button>
        </div>
        {/* Mobile hamburger */}
        <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LanguageSwitcher />
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 8 }}>
            {menuOpen
              ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div style={{ background: `${C.surface}f5`, backdropFilter: 'blur(20px)', borderTop: `1px solid ${C.dim}`, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {navItems.map(item => (
            <a key={item.key} href={`#${item.anchor}`} onClick={() => setMenuOpen(false)} style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: 'none', padding: '8px 0' }}>{t(`nav.${item.key}`)}</a>
          ))}
          <button onClick={() => { setMenuOpen(false); onCTA(); }} style={{ fontFamily: F.body, fontWeight: 700, fontSize: 13, color: '#fff', background: `linear-gradient(135deg, ${C.violet}, #8b3cf0)`, border: 'none', padding: '12px 24px', borderRadius: 50, cursor: 'pointer' }}>
            {t('nav.cta')}
          </button>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ rate, onCTA }: { rate: number; onCTA: () => void }) {
  const { t } = useTranslation('landing');
  const [ok, setOk] = useState(false);
  const [xafKey, setXafKey] = useState('500K');
  const amountMap: Record<string, number> = { '100K': 100000, '500K': 500000, '1M': 1000000, '5M': 5000000 };
  const displayMap: Record<string, string> = { '100K': '100 000', '500K': '500 000', '1M': '1 000 000', '5M': '5 000 000' };
  const cny = Math.round(amountMap[xafKey] * rate / 1_000_000);

  useEffect(() => { const timer = setTimeout(() => setOk(true), 200); return () => clearTimeout(timer); }, []);
  const anim = (delay: number) => ({ opacity: ok ? 1 : 0, transform: ok ? 'none' : 'translateY(30px)', transition: `all 1s cubic-bezier(0.16,1,0.3,1) ${delay}s` });

  return (
    <section style={{ minHeight: '100vh', background: C.bg, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '100px 24px 60px' }}>
      {/* Orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '80%', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.18, background: `conic-gradient(from 180deg, ${C.violet}, ${C.gold}, ${C.orange}, ${C.violet})`, animation: 'lp-spin 20s linear infinite', willChange: 'transform', transform: 'translateZ(0)' }} />
        <div style={{ position: 'absolute', bottom: '-30%', right: '-15%', width: '50%', height: '70%', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.10, background: `radial-gradient(circle, ${C.gold}, transparent)`, animation: 'lp-pulse 6s ease-in-out infinite', willChange: 'transform', transform: 'translateZ(0)' }} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative', zIndex: 2, display: 'flex', gap: 60, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Left */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={anim(0.1)}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg, ${C.violet}15, ${C.gold}10)`, border: `1px solid ${C.violet}20`, borderRadius: 50, padding: '7px 16px', marginBottom: 28 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 12px #4ade80' }} />
              <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.violetGlow }}>{t('hero.badge')}</span>
            </div>
          </div>

          <h1 style={{ ...anim(0.25), fontFamily: F.display, fontWeight: 800, fontSize: 'clamp(38px, 6.5vw, 68px)', lineHeight: 0.98, color: '#fff', letterSpacing: '-3px', margin: '0 0 24px' }}>
            {t('hero.title1')}{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('hero.titleHighlight')}</span>
            {' '}{t('hero.title2')}{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <svg width="100%" height="8" viewBox="0 0 200 8" style={{ position: 'absolute', bottom: -4, left: 0 }}>
                <path d="M0 4 Q50 0 100 4 Q150 8 200 4" stroke={C.gold} strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
              {t('hero.title3')}
            </span>
          </h1>

          <p style={{ ...anim(0.45), fontFamily: F.body, fontSize: 18, color: C.muted, lineHeight: 1.65, margin: '0 0 36px', maxWidth: 440 }}>
            <Trans i18nKey="hero.subtitle" ns="landing" components={{ strong: <strong style={{ color: '#fff' }} /> }} />
          </p>

          <div style={{ ...anim(0.6), display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={onCTA} style={{ fontFamily: F.body, fontWeight: 800, fontSize: 16, background: C.violet, color: '#fff', border: 'none', padding: '16px 32px', borderRadius: 14, cursor: 'pointer', boxShadow: `0 0 40px ${C.violet}40` }}>
              {t('hero.ctaPrimary')}
            </button>
            <button style={{ fontFamily: F.body, fontWeight: 600, fontSize: 15, background: 'transparent', color: C.muted, border: `1px solid ${C.dim}`, padding: '16px 28px', borderRadius: 14, cursor: 'pointer' }}>
              {t('hero.ctaSecondary')}
            </button>
          </div>
        </div>

        {/* Simulator */}
        <div style={{ ...anim(0.5), width: 360, flexShrink: 0, transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}>
          <div style={{ background: `linear-gradient(160deg, ${C.surfaceLight}, ${C.surface})`, borderRadius: 24, padding: 28, border: `1px solid ${C.dim}`, boxShadow: `0 20px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)` }}>
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>{t('hero.simulator.title')}</div>

            <div style={{ background: C.bg, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.dim}`, marginBottom: 10 }}>
              <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{t('hero.simulator.youSend')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>{displayMap[xafKey]}</span>
                <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, background: `${C.gold}15`, color: C.gold, padding: '5px 12px', borderRadius: 8 }}>XAF</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '4px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: C.violet, color: '#fff', fontSize: 16, boxShadow: `0 4px 20px ${C.violet}40` }}>↓</div>
            </div>

            <div style={{ background: C.bg, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.dim}`, marginTop: 10 }}>
              <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{t('hero.simulator.supplierReceives')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, color: C.gold, letterSpacing: '-1px' }}>¥{cny.toLocaleString('fr-FR')}</span>
                <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, background: `${C.alipay}15`, color: C.alipay, padding: '5px 12px', borderRadius: 8 }}>支 Alipay</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontFamily: F.body, fontSize: 11, color: C.muted }}>
              <span>{t('hero.simulator.rate', { rate: rate.toLocaleString('fr-FR') })}</span>
              <span style={{ color: '#4ade80', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                {t('hero.simulator.instant')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {Object.keys(amountMap).map(q => (
                <button key={q} onClick={() => setXafKey(q)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                  fontFamily: F.body, fontWeight: 700, fontSize: 11,
                  background: xafKey === q ? `${C.violet}20` : `${C.dim}50`,
                  color: xafKey === q ? C.violetGlow : C.muted,
                  border: `1px solid ${xafKey === q ? C.violet + '30' : 'transparent'}`,
                  transition: 'all 0.2s',
                }}>{q}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function Ticker() {
  const { t } = useTranslation('landing');
  const tickerKeys = ['alipay', 'wechat', 'bankTransfer', 'cashRMB', 'cameroon', 'gabon', 'chad', 'car', 'congo', 'instantPayment', 'bestRate', 'noCard'] as const;
  const items = tickerKeys.map(k => t(`ticker.${k}`));
  return (
    <div style={{ overflow: 'hidden', background: C.violet, padding: '14px 0' }}>
      <div style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', animation: 'lp-ticker 30s linear infinite' }}>
        {[...items, ...items, ...items].map((label, i) => (
          <span key={i} style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.gold, display: 'inline-block' }} />{label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function Stats() {
  const { t } = useTranslation('landing');
  const stats = [
    { end: 5, suffix: t('stats.countries.suffix'), label: t('stats.countries.label') },
    { end: 4, suffix: t('stats.methods.suffix'), label: t('stats.methods.label') },
    { end: 5, suffix: t('stats.time.suffix'), prefix: t('stats.time.prefix'), label: t('stats.time.label') },
    { end: 0, suffix: t('stats.fees.suffix'), label: t('stats.fees.label') },
  ];
  return (
    <section style={{ padding: '80px 24px', background: C.bg }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 40, justifyItems: 'center' }}>
        {stats.map((s, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 'clamp(48px, 8vw, 72px)', letterSpacing: '-3px' }}>
                <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  <Counter end={s.end} prefix={s.prefix ?? ''} suffix={s.suffix} />
                </span>
              </div>
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, fontWeight: 500, marginTop: 4 }}>{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const { t } = useTranslation('landing');
  const steps = (t('howItWorks.steps', { returnObjects: true }) as Array<{ num: string; title: string; desc: string }>);
  return (
    <section id="fonctionnement" style={{ padding: '100px 24px', background: C.bg }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ marginBottom: 64 }}>
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.violet, textTransform: 'uppercase', letterSpacing: 3 }}>{t('howItWorks.sectionLabel')}</span>
            <h2 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 'clamp(32px, 5vw, 52px)', color: '#fff', margin: '10px 0 0', letterSpacing: '-2px' }}>
              {t('howItWorks.title')}<br /><span style={{ color: C.muted }}>{t('howItWorks.subtitle')}</span>
            </h2>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.12}>
              <div style={{ padding: '40px 32px', background: C.surface, position: 'relative', overflow: 'hidden', borderLeft: i === 0 ? 'none' : `1px solid ${C.dim}`, transition: 'all 0.4s' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.surfaceLight)}
                onMouseLeave={e => (e.currentTarget.style.background = C.surface)}>
                <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 80, position: 'absolute', top: -10, right: 10, background: `linear-gradient(180deg, ${C.dim}40, transparent)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-4px', userSelect: 'none' }}>{s.num}</span>
                <div style={{ width: 40, height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${C.gold}, ${C.orange})`, marginBottom: 20 }} />
                <h3 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 24, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.5px' }}>{s.title}</h3>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.6, margin: 0, position: 'relative', zIndex: 2 }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Methods ──────────────────────────────────────────────────────────────────
function Methods() {
  const { t } = useTranslation('landing');
  const methods = [
    { icon: '支', key: 'alipay', color: C.alipay },
    { icon: '微', key: 'wechat', color: C.wechat },
    { icon: '🏦', key: 'bankTransfer', color: C.violet },
    { icon: '¥', key: 'cash', color: C.orange },
  ] as const;
  return (
    <section style={{ padding: '100px 24px', background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 3 }}>{t('methods.sectionLabel')}</span>
            <h2 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 'clamp(28px, 4.5vw, 48px)', color: '#fff', margin: '10px 0 0', letterSpacing: '-2px' }}>{t('methods.title')}</h2>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {methods.map((m, i) => (
            <Reveal key={m.key} delay={i * 0.1}>
              <div style={{ padding: 32, borderRadius: 20, background: C.bg, border: `1px solid ${C.dim}`, cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${m.color}40`; e.currentTarget.style.transform = 'translateY(-6px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.dim; e.currentTarget.style.transform = 'none'; }}>
                <div style={{ position: 'absolute', bottom: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: `${m.color}06` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: m.color, fontWeight: 700 }}>{m.icon}</div>
                  <span style={{ fontFamily: F.body, fontSize: 10, fontWeight: 700, color: m.color, background: `${m.color}12`, padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(`methods.${m.key}.tag`)}</span>
                </div>
                <h3 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 22, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>{t(`methods.${m.key}.name`)}</h3>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.6, margin: 0 }}>{t(`methods.${m.key}.desc`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ() {
  const { t } = useTranslation('landing');
  const [open, setOpen] = useState<number | null>(null);
  const faqs = t('faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>;
  return (
    <section id="faq" style={{ padding: '100px 24px', background: C.bg }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.violet, textTransform: 'uppercase', letterSpacing: 3 }}>{t('faq.sectionLabel')}</span>
            <h2 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 40px)', color: '#fff', margin: '10px 0 0', letterSpacing: '-1.5px' }}>{t('faq.title')}</h2>
          </div>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {faqs.map((f, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <div style={{ background: C.surface, borderRadius: 16, overflow: 'hidden', border: `1px solid ${open === i ? C.violet + '30' : C.dim}`, transition: 'all 0.3s' }}>
                <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 15, color: '#fff' }}>{f.q}</span>
                  <span style={{ fontFamily: F.display, fontSize: 24, color: C.muted, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s', flexShrink: 0, marginLeft: 12 }}>+</span>
                </button>
                <div style={{ maxHeight: open === i ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
                  <div style={{ padding: '0 24px 20px', fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{f.a}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTASection({ onCTA }: { onCTA: () => void }) {
  const { t } = useTranslation('landing');
  return (
    <section style={{ padding: '120px 24px', position: 'relative', overflow: 'hidden', background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${C.surfaceLight}, ${C.bg})` }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 500, height: 500, transform: 'translate(-50%, -50%)', borderRadius: '50%', border: `1px solid ${C.dim}`, opacity: 0.3, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 700, height: 700, transform: 'translate(-50%, -50%)', borderRadius: '50%', border: `1px solid ${C.dim}`, opacity: 0.15, pointerEvents: 'none' }} />
      <Reveal>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <Logo size={52} />
          <h2 style={{ fontFamily: F.display, fontWeight: 800, fontSize: 'clamp(32px, 5vw, 52px)', color: '#fff', margin: '28px 0 16px', letterSpacing: '-2px' }}>{t('cta.title')}</h2>
          <p style={{ fontFamily: F.body, fontSize: 17, color: C.muted, lineHeight: 1.65, margin: '0 0 36px' }}>{t('cta.subtitle')}</p>
          <button onClick={onCTA} style={{ fontFamily: F.body, fontWeight: 800, fontSize: 17, background: `linear-gradient(135deg, ${C.violet}, #8b3cf0)`, color: '#fff', border: 'none', padding: '20px 48px', borderRadius: 50, cursor: 'pointer', boxShadow: `0 0 60px ${C.violet}40` }}>
            {t('cta.button')}
          </button>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const { t } = useTranslation('landing');
  const cols = [
    { title: t('footer.product'), links: [
      { key: 'howItWorks', label: t('footer.links.howItWorks') },
      { key: 'pricing', label: t('footer.links.pricing') },
      { key: 'faq', label: t('footer.links.faq') },
      { key: 'security', label: t('footer.links.security') },
    ]},
    { title: t('footer.company'), links: [
      { key: 'about', label: t('footer.links.about') },
      { key: 'contact', label: t('footer.links.contact') },
      { key: 'legal', label: t('footer.links.legal') },
      { key: 'terms', label: t('footer.links.terms') },
    ]},
    { title: t('footer.support'), links: [
      { key: 'whatsapp', label: t('footer.links.whatsapp') },
      { key: 'emailSupport', label: t('footer.links.emailSupport') },
      { key: 'helpCenter', label: t('footer.links.helpCenter') },
    ]},
  ];
  return (
    <footer style={{ padding: '56px 24px 28px', background: C.bg, borderTop: `1px solid ${C.dim}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 40, marginBottom: 40 }}>
          <div style={{ maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Logo size={24} />
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 17, color: '#fff' }}>Bonzini</span>
            </div>
            <p style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.6, opacity: 0.6 }}>{t('footer.tagline')}</p>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <h4 style={{ fontFamily: F.body, fontWeight: 700, fontSize: 11, color: C.muted, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1.5 }}>{col.title}</h4>
              {col.links.map(l => <a key={l.key} href="#" style={{ display: 'block', fontFamily: F.body, fontSize: 14, color: C.dim, textDecoration: 'none', padding: '3px 0' }}>{l.label}</a>)}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', borderRadius: 2, overflow: 'hidden', height: 2, marginBottom: 20 }}>
          <div style={{ flex: 2, background: C.gold }} />
          <div style={{ flex: 3, background: C.violet }} />
          <div style={{ flex: 2, background: C.orange }} />
        </div>
        <div style={{ fontFamily: F.body, fontSize: 12, color: C.dim, textAlign: 'center' }}>{t('footer.copyright')}</div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [alipayRate, setAlipayRate] = useState(11610);

  useEffect(() => {
    supabase
      .from('daily_rates')
      .select('rate_alipay')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data?.rate_alipay) setAlipayRate(data.rate_alipay); });
  }, []);

  const onCTA = () => {
    const utm = getStoredUtm();
    track('cta_clicked', {
      utm_source:   utm?.utm_source   ?? 'direct',
      utm_medium:   utm?.utm_medium   ?? 'none',
      utm_campaign: utm?.utm_campaign ?? 'none',
      page_section: 'landing',
    });
    navigate('/auth?mode=signup');
  };

  return (
    <div style={{ background: C.bg, overflowX: 'hidden' }}>
      <Nav onCTA={onCTA} />
      <Hero rate={alipayRate} onCTA={onCTA} />
      <Ticker />
      <Stats />
      <HowItWorks />
      <Methods />
      <FAQ />
      <CTASection onCTA={onCTA} />
      <Footer />
    </div>
  );
}
