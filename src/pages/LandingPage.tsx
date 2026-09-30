import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { motion, useInView, animate } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { track } from '@vercel/analytics';
import { getStoredUtm } from '@/hooks/useUtmTracking';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CONTACT_PHONE_CM, whatsappLink } from '@/lib/companyContacts';
import { BonziniLogo as Logo } from '@/components/brand/BonziniLogo';

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: '#050208', violet: '#a64af7', violetGlow: '#c084fc',
  gold: '#f3a745', orange: '#fe560d',
  muted: '#8b82a0', dim: '#3d3555',
  surface: '#0f0b18', surfaceLight: '#1a1428',
  alipay: '#1677ff', wechat: '#07c160',
};
const F = { display: "'DM Sans', sans-serif", body: "'DM Sans', sans-serif" };

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
          {/* « Bonzini Labs » et non « Bonzini » : Google refuse de vérifier
              la marque du client OAuth si le nom de l'écran de consentement
              ne se retrouve pas sur la page d'accueil. */}
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>Bonzini Labs</span>
        </div>
        {/* Desktop */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 28 }}>
          {navItems.map(item => (
            <a key={item.key} href={`#${item.anchor}`} style={{ fontFamily: F.body, fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: 'none' }}>{t(`nav.${item.key}`)}</a>
          ))}
          <LanguageSwitcher variant="landing" />
          <button onClick={onCTA} style={{ fontFamily: F.body, fontWeight: 700, fontSize: 13, color: '#fff', background: `linear-gradient(135deg, ${C.violet}, #8b3cf0)`, border: 'none', padding: '10px 22px', borderRadius: 50, cursor: 'pointer' }}>
            {t('nav.cta')}
          </button>
        </div>
        {/* Mobile hamburger */}
        <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LanguageSwitcher variant="landing" />
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
            <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>{t('hero.simulator.title')}</div>

            <div style={{ background: C.bg, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.dim}`, marginBottom: 10 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{t('hero.simulator.youSend')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>{displayMap[xafKey]}</span>
                <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, background: `${C.gold}15`, color: C.gold, padding: '5px 12px', borderRadius: 8 }}>XAF</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '4px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: C.violet, color: '#fff', fontSize: 16, boxShadow: `0 4px 20px ${C.violet}40` }}>↓</div>
            </div>

            <div style={{ background: C.bg, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.dim}`, marginTop: 10 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{t('hero.simulator.supplierReceives')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: F.display, fontSize: 28, fontWeight: 800, color: C.gold, letterSpacing: '-1px' }}>¥{cny.toLocaleString('fr-FR')}</span>
                <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, background: `${C.alipay}15`, color: C.alipay, padding: '5px 12px', borderRadius: 8 }}>支 Alipay</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontFamily: F.body, fontSize: 12, color: C.muted }}>
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
                  fontFamily: F.body, fontWeight: 700, fontSize: 13, minHeight: 44,
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
                  <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: m.color, background: `${m.color}12`, padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t(`methods.${m.key}.tag`)}</span>
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
      { key: 'howItWorks', label: t('footer.links.howItWorks'), href: '#fonctionnement' },
      { key: 'pricing', label: t('footer.links.pricing') },
      { key: 'faq', label: t('footer.links.faq'), href: '#faq' },
      { key: 'security', label: t('footer.links.security') },
    ]},
    { title: t('footer.company'), links: [
      { key: 'about', label: t('footer.links.about') },
      { key: 'contact', label: t('footer.links.contact'), href: 'mailto:contact@bonzinilabs.com' },
      // Ces deux-là mènent à de vraies pages : Google vérifie qu'elles
      // répondent avant d'afficher « Bonzini Labs » sur l'écran de consentement.
      { key: 'privacy', label: t('footer.links.privacy'), to: '/confidentialite' },
      { key: 'terms', label: t('footer.links.terms'), to: '/conditions' },
    ]},
    { title: t('footer.support'), links: [
      { key: 'whatsapp', label: t('footer.links.whatsapp'), href: whatsappLink(CONTACT_PHONE_CM), external: true },
      { key: 'emailSupport', label: t('footer.links.emailSupport'), href: 'mailto:contact@bonzinilabs.com' },
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
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 17, color: '#fff', whiteSpace: 'nowrap' }}>Bonzini Labs</span>
            </div>
            <p style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.6, opacity: 0.6 }}>{t('footer.tagline')}</p>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <h4 style={{ fontFamily: F.body, fontWeight: 700, fontSize: 12, color: C.muted, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1.5 }}>{col.title}</h4>
              {col.links.map(l => {
                const style = { display: 'flex', alignItems: 'center', minHeight: 44, fontFamily: F.body, fontSize: 14, color: C.dim, textDecoration: 'none' };
                if ('to' in l && l.to) return <Link key={l.key} to={l.to} style={style}>{l.label}</Link>;
                // Sans cible connue, l'entrée reste un texte : un href="#" renvoyait en haut de page.
                if (!('href' in l) || !l.href) return <span key={l.key} style={{ ...style, cursor: 'default' }}>{l.label}</span>;
                return <a key={l.key} href={l.href} style={style} {...('external' in l && l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>;
              })}
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
