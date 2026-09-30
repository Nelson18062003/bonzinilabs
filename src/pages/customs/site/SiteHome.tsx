// ============================================================
// bonzinilabs.com/douane — l'accueil du site Douane.
//
// Direction « premium » (Apple, Wise, Revolut, Stripe, Linear, Qonto) :
//   1. le héros centré — un titre en deux temps (noir, puis gris), une
//      recherche, et le produit en vrai : un téléphone qui affiche un calcul
//      du moteur, qui change toutes les quelques secondes ;
//   2. quatre tuiles « bento », chacune avec une miniature de l'outil ;
//   3. la preuve en aplat violet (une vraie DAU) ;
//   4. ce qui change en ce moment ;
//   5. le paiement du fournisseur, en noir.
// Aucun dégradé de texte, aucune lueur, pas d'icône dans un carré de couleur.
// ============================================================
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { simulate } from '@/lib/customs/engine';
import { formatHs } from '@/lib/customs/hsCode';
import { customsTasks } from '@/lib/customs/tasks';
import { phaseOf, sortNotices } from '@/lib/customs/notices';
import { planRoute } from '@/lib/logistics/atlas';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { useMyInvites } from '@/hooks/useCustomsInvites';
import { num, xaf } from '../format';
import { SiteLayout } from './SiteLayout';
import { dauGroups } from './simulator/groups';
import { ButtonLink, Container, CountUp, Reveal } from './ui';
import { EASE, buttonClass } from './styles';

// Trois cas réels, calculés par le moteur (valeur CIF, entreprise au réel, taux du tarif).
const EXAMPLES = [
  { key: 'regulator', code: '850440', rate: 10, amount: 900_000 },
  { key: 'wigs', code: '670411', rate: 30, amount: 1_000_000 },
  { key: 'chairs', code: '940180', rate: 30, amount: 500_000 },
] as const;

const POPULAR = [
  { q: 'mèches', key: 'wigs' }, { q: 'panneau solaire', key: 'solar' }, { q: 'téléphone', key: 'phones' },
  { q: 'moto', key: 'moto' }, { q: 'friperie', key: 'thrift' }, { q: 'carreaux', key: 'tiles' },
] as const;

const simOf = (e: (typeof EXAMPLES)[number]) =>
  simulate({ code: e.code, dutyRate: e.rate, goodsAmount: e.amount, currency: 'XAF', xafPerUnit: 1, incoterm: 'CIF', declarationYear: 2026, regime: 'reel' });

/** Le téléphone : un vrai écran de résultat, qui passe d'un exemple à l'autre. */
function PhoneResult() {
  const { t } = useTranslation('customs');
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 4500);
    return () => window.clearInterval(id);
  }, []);
  const rows = useMemo(() => EXAMPLES.map((e) => ({ ...e, sim: simOf(e) })), []);
  const ex = rows[i];
  const total = ex.sim.dau.total || 1;
  const parts = dauGroups(ex.sim);
  return (
    <div className="relative mx-auto h-[600px] w-[300px]">
      {/* L'ombre : un halo flou sous le téléphone (une box-shadow laissait un rectangle pâle en capture). */}
      <span aria-hidden className="absolute inset-x-6 bottom-2 top-24 rounded-[60px] bg-[#281450]/25 blur-[40px]" />
      <div className="relative h-full w-full rounded-[52px] bg-[#111] p-[11px] ring-1 ring-black/40">
      <div className="relative h-full w-full overflow-hidden rounded-[42px] bg-white text-left text-[#0d0d12]">
        <span aria-hidden className="absolute left-1/2 top-3 h-7 w-24 -translate-x-1/2 rounded-full bg-[#111]" />
        <div className="px-5 pt-[52px]">
          <div className="flex items-center justify-between text-[13px] font-medium text-[#86868f]">
            <span>‹ {t('site.home.phoneBack')}</span><span>{t('site.home.phoneShare')}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={ex.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
              <p className="mt-4 text-[19px] font-bold leading-tight tracking-[-0.02em]">{t(`site.home.ex.${ex.key}`)}</p>
              <p className="mt-1 text-[13px] font-medium text-[#86868f]"><span className="tabular-nums">{formatHs(ex.code)}</span> · {t('site.home.dutyRate', { rate: ex.rate })}</p>
              <p className="mt-6 text-[13px] font-medium text-[#86868f]">{t('site.home.toPay')}</p>
              <p className="mt-1 text-[38px] font-black leading-none tracking-[-0.04em] tabular-nums">
                <CountUp value={ex.sim.dau.total} format={(n) => num(Math.round(n))} />
                <span className="ml-1 text-[14px] font-bold tracking-normal text-[#86868f]">F CFA</span>
              </p>
              <div className="mt-4 flex h-2 gap-1">
                {parts.map((p) => <span key={p.key} className={cn('h-full rounded-full', p.color)} style={{ width: `${(p.amount / total) * 100}%` }} />)}
              </div>
              <ul className="mt-3 text-[14px]">
                {parts.map((p) => (
                  <li key={p.key} className="flex items-center justify-between border-b border-[#ececf0] py-2.5">
                    <span className="flex items-center gap-2 font-medium text-[#3a3a44]"><span aria-hidden className={cn('h-2 w-2 rounded-full', p.color)} />{t(`site.sim.group.${p.key}`)}</span>
                    <span className="font-bold tabular-nums">{num(p.amount)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-[#3a3a44]">{t('site.home.cifValue')}</span>
                  <span className="font-bold tabular-nums">{num(ex.amount)}</span>
                </li>
              </ul>
            </motion.div>
          </AnimatePresence>
          <div className="mt-3 flex h-12 items-center justify-center rounded-full bg-dz-violet text-[15px] font-bold text-white">{t('site.home.payCta')}</div>
        </div>
      </div>
      </div>
    </div>
  );
}

function Floating({ className, label, children, delay }: { className: string; label: string; children: ReactNode; delay: number }) {
  return (
    <motion.div aria-hidden className={cn('absolute hidden rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_20px_50px_-18px_rgba(30,15,60,.35),0_0_0_1px_rgba(0,0,0,.05)] md:block', className)}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay, ease: EASE }}>
      <p className="text-[13px] font-medium text-[#86868f]">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5 text-[16px] font-black tracking-[-0.01em] text-[#0d0d12]">{children}</div>
    </motion.div>
  );
}

function Hero() {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const go = (query: string) => navigate(`/douane/simulateur${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  return (
    <section className="overflow-hidden bg-[linear-gradient(rgb(var(--dz-card))_62%,rgb(var(--dz-bg))_62%)]">
      <Container className="pt-12 text-center sm:pt-20 lg:pt-24">
        <motion.h1 className="mx-auto max-w-[16ch] [text-wrap:balance] text-[44px] font-black leading-[1] tracking-[-0.045em] text-dz-ink sm:max-w-none sm:text-[64px] lg:text-[84px]"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          {t('site.home.h1')}<span className="block text-dz-mute">{t('site.home.h1Muted')}</span>
        </motion.h1>
        <motion.p className="mx-auto mt-5 max-w-[42ch] text-[18px] font-medium leading-relaxed text-dz-ink2 sm:mt-6 sm:text-[21px]"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08, ease: EASE }}>
          {t('site.home.lead')}
        </motion.p>

        <motion.form onSubmit={(e) => { e.preventDefault(); go(q); }} className="mx-auto mt-8 max-w-[560px]"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16, ease: EASE }}>
          <label htmlFor="dz-hero-q" className="sr-only">{t('site.home.searchLabel')}</label>
          <div className="flex h-[60px] items-center gap-2 rounded-full bg-dz-card pl-5 pr-2 shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_40px_-12px_rgba(20,10,40,.22),inset_0_0_0_1px_rgba(0,0,0,.06)] sm:h-[68px] sm:pl-6">
            <Search aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
            {/* eslint-disable-next-line no-restricted-syntax -- 18 px, pas de zoom iOS ; champ nu dans la pilule */}
            <input id="dz-hero-q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search"
              placeholder={t('site.home.searchPlaceholder')}
              className="h-full min-w-0 flex-1 bg-transparent text-[18px] font-medium text-dz-ink outline-none placeholder:font-normal placeholder:text-dz-ink3/80" />
            <button type="submit" className={buttonClass('primary', 'md', 'h-11 px-5 sm:h-[52px] sm:px-6')}>{t('site.home.searchCta')}</button>
          </div>
        </motion.form>

        <motion.div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 dz-scroll-x sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.25 }}>
          {POPULAR.map((p) => (
            <button key={p.key} type="button" onClick={() => go(p.q)}
              className="h-9 shrink-0 rounded-full bg-dz-soft px-4 text-[14px] font-bold text-dz-ink2 transition-colors hover:bg-dz-fill hover:text-dz-ink">
              {t(`site.home.popular.${p.key}`)}
            </button>
          ))}
        </motion.div>

        <motion.ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] font-medium text-dz-ink3"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
          {(['a', 'b', 'c'] as const).map((k) => (
            <li key={k}><b className="font-bold text-dz-ink">{t(`site.home.trust.${k}`)}</b> {t(`site.home.trust.${k}More`)}</li>
          ))}
        </motion.ul>

        <MineLink />

        <div className="relative mx-auto mt-12 h-[520px] max-w-[760px] sm:mt-16 sm:h-[600px]">
          <motion.div className="origin-top scale-[.86] sm:scale-100" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: EASE }}>
            <PhoneResult />
          </motion.div>
          <Floating className="left-0 top-[150px]" label={t('site.home.floatSigned')} delay={0.7}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-dz-good text-white"><Check aria-hidden className="h-3 w-3" strokeWidth={3.5} /></span>
            {t('site.home.floatSignedBy')}
          </Floating>
          <Floating className="right-0 top-[300px]" label={t('site.home.floatBack')} delay={0.85}>
            <span className="tabular-nums text-dz-brand">+ {xaf(58_136)}</span>
          </Floating>
        </div>
      </Container>
    </section>
  );
}

/** Pour un client connecté : ce qui l'attend, en une pilule sous le héros. */
function MineLink() {
  const { t } = useTranslation('customs');
  const { user } = useAuth();
  const on = !!user;
  const files = useMyCustomsFiles(on);
  const invites = useMyInvites(on);
  const notices = useCustomsNotices(on);
  const count = useMemo(() => (on ? customsTasks({
    classifications: files.data?.classifications, audits: files.data?.audits, invites: invites.data, notices: notices.data,
  }).length : 0), [on, files.data, invites.data, notices.data]);
  if (!on) return null;
  return (
    <Link to="/douane/espace" className="mx-auto mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-dz-brand-soft pl-4 pr-3 text-[15px] font-bold text-dz-brand transition-colors hover:bg-dz-violet/15">
      {t('site.mySpace')} · {count > 0 ? t('site.home.tasks', { count }) : t('site.home.noTasksShort')}
      <ChevronRight aria-hidden className="h-4 w-4" />
    </Link>
  );
}

// ─── Les tuiles ─────────────────────────────────────────────────────────────

function Tile({ to, span, tag, title, desc, more, children, delay = 0 }: {
  to: string; span: string; tag: string; title: string; desc: string; more: string; children: ReactNode; delay?: number;
}) {
  return (
    <Reveal delay={delay} className={span}>
      <Link to={to} className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-dz-card p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-8">
        <span className="self-start rounded-full bg-dz-soft px-2.5 py-1 text-[13px] font-bold text-dz-ink2">{tag}</span>
        <h3 className="mt-4 text-[24px] font-black leading-tight tracking-[-0.03em] text-dz-ink sm:text-[26px]">{title}</h3>
        <p className="mt-2 max-w-[36ch] text-[16px] font-medium leading-snug text-dz-ink3">{desc}</p>
        <div className="mt-6 flex-1">{children}</div>
        <span className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-bold text-dz-ink">
          {more} <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </Reveal>
  );
}

function Bento() {
  const { t } = useTranslation('customs');
  const wigs = useMemo(() => simOf(EXAMPLES[1]), []);
  const route = useMemo(() => planRoute({ mode: 'sea', origin: 'CNSHA', destination: 'douala', port: 'CMDLA', weightKg: 1000 }), []);
  return (
    <section className="bg-dz-bg">
      <Container className="py-20 sm:py-28">
        <Reveal>
          <h2 className="[text-wrap:balance] text-[36px] font-black leading-[1.02] tracking-[-0.04em] text-dz-ink sm:text-[56px]">
            {t('site.home.bentoTitle')}<span className="block text-dz-mute">{t('site.home.bentoMuted')}</span>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:mt-14 lg:grid-cols-6 lg:gap-5">
          <Tile to="/douane/simulateur" span="lg:col-span-4" tag={t('site.home.noAccount')} title={t('site.home.b1Title')} desc={t('site.home.b1Desc')} more={t('site.home.tools.simulator.title')}>
            <div className="rounded-[20px] bg-dz-soft p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                <MiniField label={t('site.home.b1Product')} value={t('site.home.ex.wigs')} />
                <MiniField label={t('site.home.b1Price')} value={num(EXAMPLES[1].amount)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['CNY', 'USD', 'XAF'].map((c) => <MiniPill key={c} on={c === 'XAF'}>{c}</MiniPill>)}
                <span className="w-2" />
                {['FOB', 'CIF'].map((c) => <MiniPill key={c} on={c === 'CIF'}>{c}</MiniPill>)}
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2 rounded-2xl bg-dz-primary px-5 py-4 text-dz-on-primary">
                <div>
                  <p className="text-[13px] font-medium opacity-60">{t('site.home.toPay')}</p>
                  <p className="text-[30px] font-black leading-none tracking-[-0.03em] tabular-nums">{xaf(wigs.dau.total)}</p>
                </div>
                <p className="text-[13px] font-medium tabular-nums opacity-60">{formatHs(EXAMPLES[1].code)} · {t('site.home.dutyRate', { rate: EXAMPLES[1].rate })}</p>
              </div>
            </div>
          </Tile>

          <Tile to="/douane/classer" span="lg:col-span-2" tag={t('site.home.withAccount')} title={t('site.home.b2Title')} desc={t('site.home.b2Desc')} more={t('site.home.b2More')} delay={0.06}>
            <div className="flex flex-col gap-2">
              <span className="max-w-[88%] self-start rounded-[18px] rounded-bl-md bg-dz-soft px-3.5 py-2.5 text-[14px] font-medium text-dz-ink">{t('site.home.b2Ask')}</span>
              <span className="max-w-[88%] self-end rounded-[18px] rounded-br-md bg-dz-primary px-3.5 py-2.5 text-[14px] font-medium text-dz-on-primary">{t('site.home.b2Answer')}</span>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl p-3.5 ring-[1.5px] ring-dz-good">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dz-good text-white"><Check aria-hidden className="h-4 w-4" strokeWidth={3.5} /></span>
              <span className="min-w-0">
                <span className="block text-[22px] font-black leading-none tracking-[-0.02em] tabular-nums text-dz-ink">{formatHs('850440')}</span>
                <span className="mt-1 block text-[13px] font-medium text-dz-ink3">{t('site.home.b2Signed')}</span>
              </span>
            </div>
          </Tile>

          <Tile to="/douane/audit" span="lg:col-span-2" tag={t('site.home.withAccount')} title={t('site.home.b3Title')} desc={t('site.home.b3Desc')} more={t('site.home.tools.audit.title')} delay={0.06}>
            <p className="text-[48px] font-black leading-none tracking-[-0.045em] tabular-nums text-dz-violet sm:text-[52px]">{xaf(58_136)}</p>
            <p className="mt-2 text-[15px] font-medium text-dz-ink3">{t('site.home.b3Until')}</p>
            <div className="mt-4 space-y-1 rounded-2xl bg-dz-soft p-3.5 text-[13px] font-medium text-dz-ink2">
              <p className="flex justify-between gap-3"><span>{t('site.home.b3Line1')}</span><s className="tabular-nums text-dz-ink3">{num(36_084)}</s></p>
              <p className="flex justify-between gap-3"><span>{t('site.home.b3Line2')}</span><s className="tabular-nums text-dz-ink3">{num(193_782)}</s></p>
            </div>
          </Tile>

          <Tile to="/douane/routes" span="lg:col-span-4" tag={t('site.home.noAccount')} title={t('site.home.b4Title')} desc={t('site.home.b4Desc')} more={t('site.home.tools.routes.title')} delay={0.12}>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[44px] font-black leading-none tracking-[-0.04em] tabular-nums text-dz-ink">{route.days[0]}–{route.days[1]}</span>
              <span className="text-[15px] font-medium text-dz-ink3">{t('site.home.b4Days', { from: route.origin.name, to: route.destination.name })}</span>
            </p>
            <div className="relative mt-6 h-[96px]">
              <svg viewBox="0 0 600 96" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
                <path d="M16 76 C 160 6, 330 6, 584 58" fill="none" stroke="rgb(var(--dz-line))" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <motion.path d="M16 76 C 160 6, 330 6, 584 58" fill="none" stroke="rgb(var(--dz-violet))" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 0.68 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }} />
              </svg>
              <span className="absolute bottom-0 left-0 flex items-center gap-2 text-[13px] font-bold text-dz-ink"><span className="h-3 w-3 rounded-full bg-dz-ink" />{route.origin.name}</span>
              <span className="absolute bottom-3 right-0 flex items-center gap-2 text-[13px] font-bold text-dz-ink">{route.destination.name}<span className="h-3 w-3 rounded-full border-[3px] border-dz-ink bg-dz-card" /></span>
            </div>
          </Tile>
        </div>
      </Container>
    </section>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-dz-card px-4 py-3">
      <p className="text-[13px] font-medium text-dz-ink3">{label}</p>
      <p className="mt-0.5 truncate text-[16px] font-bold tabular-nums text-dz-ink">{value}</p>
    </div>
  );
}

function MiniPill({ on, children }: { on?: boolean; children: ReactNode }) {
  return <span className={cn('inline-flex h-8 items-center rounded-full px-3 text-[13px] font-bold', on ? 'bg-dz-primary text-dz-on-primary' : 'bg-dz-card text-dz-ink2')}>{children}</span>;
}

// ─── La preuve, l'actualité, le paiement ────────────────────────────────────

function Proof() {
  const { t } = useTranslation('customs');
  return (
    <section className="bg-dz-card">
      <Container className="py-16 sm:py-24">
        <Reveal>
          <div className="grid gap-8 rounded-[32px] bg-dz-violet px-6 py-12 text-white sm:rounded-[40px] sm:px-12 sm:py-16 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:gap-12 lg:px-16 lg:py-20">
            <div>
              <p className="whitespace-nowrap text-[60px] font-black leading-[0.9] tracking-[-0.055em] tabular-nums sm:text-[96px] lg:text-[120px]">{num(307_078)} F</p>
              <p className="mt-5 max-w-[30ch] text-[18px] font-medium leading-snug text-white/90 sm:text-[22px]">{t('site.home.proofSub')}</p>
            </div>
            <div>
              <p className="text-[16px] font-medium leading-relaxed text-white/85 sm:text-[17px]">{t('site.home.proofBody')}</p>
              <Link to="/douane/audit" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[16px] font-bold text-[#0d0d12] transition-transform active:scale-[0.98]">
                {t('site.home.proofCta')} <ArrowRight aria-hidden className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function News() {
  const { t } = useTranslation('customs');
  const q = useCustomsNotices();
  const list = useMemo(() => sortNotices((q.data ?? []).filter((n) => n.published && phaseOf(n) !== 'past')).slice(0, 3), [q.data]);
  if (list.length === 0) return null;
  const when = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
  return (
    <section className="bg-dz-card">
      <Container className="pb-16 sm:pb-24">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="[text-wrap:balance] text-[36px] font-black leading-[1.02] tracking-[-0.04em] text-dz-ink sm:text-[56px]">
            {t('site.home.newsTitle')}<span className="block text-dz-mute">{t('site.home.newsMuted')}</span>
          </h2>
          <Link to="/douane/veille" className="inline-flex items-center gap-1 text-[16px] font-bold text-dz-ink hover:text-dz-brand">
            {t('site.home.newsAll')} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </Reveal>
        <ul className="mt-10 border-t border-dz-line">
          {list.map((n, i) => (
            <Reveal as="li" key={n.id} delay={0.05 * i} className="border-b border-dz-line">
              <Link to={`/douane/veille#${n.slug}`} className="group grid items-center gap-x-6 gap-y-1 py-6 sm:grid-cols-[200px_minmax(0,1fr)_24px]">
                <span className="text-[14px] font-medium text-dz-ink3">{when(n.starts_on) || t(`watch.phase.${phaseOf(n)}`)}</span>
                <span className="min-w-0">
                  <span className={cn('mb-2 inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-bold',
                    n.kind === 'disruption' ? 'bg-dz-warn-soft text-dz-warn' : 'bg-dz-brand-soft text-dz-brand')}>
                    {t(n.kind === 'disruption' ? 'site.home.kindDisruption' : 'site.home.kindRule')}
                  </span>
                  <span className="block text-[19px] font-bold leading-snug tracking-[-0.015em] text-dz-ink sm:text-[21px]">{n.title}</span>
                </span>
                <ArrowRight aria-hidden className="hidden h-5 w-5 text-dz-ink3 transition-transform group-hover:translate-x-1 group-hover:text-dz-ink sm:block" />
              </Link>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function PayBand() {
  const { t } = useTranslation('customs');
  return (
    <section className="bg-dz-card">
      <Container className="pb-16 sm:pb-24">
        <Reveal>
          <div className="flex flex-col items-start gap-8 rounded-[32px] bg-[#0d0d12] px-6 py-12 text-white sm:rounded-[40px] sm:px-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-16">
            <h2 className="[text-wrap:balance] text-[32px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[48px]">
              {t('site.home.payTitle')}<span className="block text-white/45">{t('site.home.payMuted')}</span>
            </h2>
            <ButtonLink to="/" variant="brand" size="lg" className="shrink-0">{t('site.home.payCta')} <ArrowRight aria-hidden /></ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function SiteHome() {
  return (
    <SiteLayout>
      <Hero />
      <Bento />
      <Proof />
      <News />
      <PayBand />
    </SiteLayout>
  );
}

export default SiteHome;
