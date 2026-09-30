// ============================================================
// bonzinilabs.com/douane — l'accueil du site Douane.
//
// Une question, une réponse : « quel produit importez-vous ? » mène droit au
// calcul. Puis les quatre outils, la preuve (une vraie DAU), l'actualité, et
// le paiement du fournisseur. Rien d'autre.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Calculator, ChevronRight, FileSearch, Route, ScanLine, Search, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { simulate } from '@/lib/customs/engine';
import { formatHs } from '@/lib/customs/hsCode';
import { customsTasks } from '@/lib/customs/tasks';
import { phaseOf, sortNotices } from '@/lib/customs/notices';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { useMyInvites } from '@/hooks/useCustomsInvites';
import { xaf, pct } from '../format';
import { SiteLayout } from './SiteLayout';
import { Badge, ButtonLink, Container, CountUp, Eyebrow, Input, Reveal } from './ui';
import { EASE } from './styles';

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

function ExampleCard() {
  const { t } = useTranslation('customs');
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 4200);
    return () => window.clearInterval(id);
  }, []);
  const rows = useMemo(() => EXAMPLES.map((e) => ({
    ...e,
    sim: simulate({ code: e.code, dutyRate: e.rate, goodsAmount: e.amount, currency: 'XAF', xafPerUnit: 1, incoterm: 'CIF', declarationYear: 2026, regime: 'reel' }),
  })), []);
  const ex = rows[i];
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] backdrop-blur-xl sm:p-7">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/50">{t('site.home.example')}</p>
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-white/60">
          <span className="h-2 w-2 rounded-full bg-[#4ade80]" />{t('site.home.camcis')}
        </span>
      </div>
      <div className="relative mt-5 min-h-[208px]">
        <AnimatePresence mode="wait">
          <motion.div key={ex.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease: EASE }}>
            <p className="text-[20px] font-semibold text-white">{t(`site.home.ex.${ex.key}`)}</p>
            <p className="mt-1 text-[15px] text-white/60">
              <span className="font-semibold tabular-nums text-white/80">{formatHs(ex.code)}</span> · {t('site.home.dutyRate', { rate: ex.rate })}
            </p>
            <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-white/60">{t('site.home.cifValue')}</dt>
                <dd className="tabular-nums text-white/80">{xaf(ex.amount)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-white/60">{t('site.home.toPay')}</dt>
                <dd className="text-[26px] font-bold tabular-nums text-white"><CountUp value={ex.sim.dau.total} format={xaf} /></dd>
              </div>
            </dl>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#f3a745] to-[#fe560d]"
                initial={{ width: 0 }} animate={{ width: `${Math.min(100, ex.sim.effectiveRate * 100)}%` }} transition={{ duration: 0.8, ease: EASE }} />
            </div>
            <p className="mt-2 text-[14px] text-white/60">{t('site.home.ofValue', { pct: pct(ex.sim.effectiveRate) })}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-5 flex gap-1.5" aria-hidden>
        {EXAMPLES.map((e, n) => (
          <button key={e.key} type="button" tabIndex={-1} onClick={() => setI(n)}
            className={cn('h-1.5 rounded-full transition-all duration-300', n === i ? 'w-6 bg-white' : 'w-1.5 bg-white/30')} />
        ))}
      </div>
    </div>
  );
}

function Hero() {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const go = (query: string) => navigate(`/douane/simulateur${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  return (
    <Container className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-16 pt-10 sm:pb-20 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16 lg:pb-28 lg:pt-20">
      <div className="min-w-0">
        <motion.p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/60"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          {t('site.home.eyebrow')}
        </motion.p>
        <motion.h1 className="mt-4 [text-wrap:balance] text-[38px] font-bold leading-[1.02] tracking-[-0.035em] text-white sm:text-[52px] lg:text-[64px]"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05, ease: EASE }}>
          {t('site.home.titleA')}
          <span className="bg-gradient-to-r from-[#f3a745] to-[#fe560d] bg-clip-text text-transparent">{t('site.home.titleB')}</span>
        </motion.h1>
        <motion.p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-white/70 sm:text-[19px]"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12, ease: EASE }}>
          {t('site.home.lead')}
        </motion.p>

        <motion.form onSubmit={(e) => { e.preventDefault(); go(q); }} className="mt-8 max-w-[560px]"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: EASE }}>
          <label htmlFor="dz-hero-q" className="sr-only">{t('site.home.searchLabel')}</label>
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_20px_60px_-20px_rgba(169,71,254,.5)] sm:flex-row sm:items-center sm:rounded-full sm:pl-5">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-0">
              <Search aria-hidden className="h-5 w-5 shrink-0 text-[#635c74]" />
              <Input id="dz-hero-q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search"
                placeholder={t('site.home.searchPlaceholder')}
                className="h-12 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-[17px] text-[#130d1e] placeholder:text-[#8a8398] focus:ring-0" />
            </div>
            <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#130d1e] px-6 text-[16px] font-semibold text-white transition-transform active:scale-[0.98] sm:rounded-full">
              {t('site.home.searchCta')} <ArrowRight aria-hidden className="h-[18px] w-[18px]" />
            </button>
          </div>
        </motion.form>

        <motion.div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 dz-scroll-x sm:mx-0 sm:flex-wrap sm:px-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
          {POPULAR.map((p) => (
            <button key={p.key} type="button" onClick={() => go(p.q)}
              className="h-10 shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-4 text-[15px] font-medium text-white/85 transition-colors hover:bg-white/15">
              {t(`site.home.popular.${p.key}`)}
            </button>
          ))}
        </motion.div>
      </div>

      <motion.div className="hidden md:block" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease: EASE }}>
        <ExampleCard />
      </motion.div>
    </Container>
  );
}

const TOOLS: { key: string; to: string; icon: LucideIcon; account: boolean }[] = [
  { key: 'simulator', to: '/douane/simulateur', icon: Calculator, account: false },
  { key: 'classify', to: '/douane/classer', icon: FileSearch, account: true },
  { key: 'audit', to: '/douane/audit', icon: ScanLine, account: true },
  { key: 'routes', to: '/douane/routes', icon: Route, account: false },
];

function Tools() {
  const { t } = useTranslation('customs');
  return (
    <Container className="py-16 lg:py-24">
      <Reveal className="max-w-[640px]">
        <Eyebrow>{t('site.home.toolsEyebrow')}</Eyebrow>
        <h2 className="mt-3 [text-wrap:balance] text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[38px]">{t('site.home.toolsTitle')}</h2>
      </Reveal>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {TOOLS.map((tool, i) => (
          <Reveal as="li" key={tool.key} delay={0.06 * i} className="h-full">
              <Link to={tool.to}
                className="group flex h-full items-center gap-4 rounded-2xl border border-dz-line bg-dz-card p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-dz-ink/20 hover:shadow-[0_18px_40px_-24px_rgba(19,13,30,.35)] sm:flex-col sm:items-start sm:gap-0 sm:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-dz-brand-soft text-dz-brand"><tool.icon aria-hidden className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1 sm:mt-6">
                  <span className="block text-[18px] font-semibold leading-snug text-dz-ink">{t(`site.home.tools.${tool.key}.title`)}</span>
                  <span className="mt-1 block text-[15px] leading-snug text-dz-ink3">{t(`site.home.tools.${tool.key}.desc`)}</span>
                  <span className="mt-4 hidden sm:block">
                    <Badge tone={tool.account ? 'neutral' : 'good'}>{t(tool.account ? 'site.home.withAccount' : 'site.home.noAccount')}</Badge>
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3 transition-transform group-hover:translate-x-0.5 sm:hidden" />
              </Link>
          </Reveal>
        ))}
      </ul>
    </Container>
  );
}

function Proof() {
  const { t } = useTranslation('customs');
  return (
    <section className="bg-dz-soft">
      <Container className="grid items-center gap-8 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <Reveal>
          <Eyebrow>{t('site.home.proofEyebrow')}</Eyebrow>
          <p className="mt-4 text-[52px] font-bold leading-none tracking-[-0.04em] tabular-nums text-dz-ink sm:text-[72px]">307 078 F</p>
          <p className="mt-3 text-[18px] text-dz-ink2">{t('site.home.proofSub')}</p>
        </Reveal>
        <Reveal delay={0.08} className="space-y-6">
          <p className="max-w-[52ch] text-[17px] leading-relaxed text-dz-ink2">{t('site.home.proofBody')}</p>
          <ButtonLink to="/douane/audit" variant="primary" size="lg">{t('site.home.proofCta')} <ArrowRight aria-hidden /></ButtonLink>
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
  return (
    <Container className="py-16 lg:py-24">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{t('site.home.newsEyebrow')}</Eyebrow>
          <h2 className="mt-3 [text-wrap:balance] text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[38px]">{t('site.home.newsTitle')}</h2>
        </div>
        <Link to="/douane/veille" className="inline-flex items-center gap-1 text-[16px] font-semibold text-dz-brand hover:underline">
          {t('site.home.newsAll')} <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </Reveal>
      <ul className="mt-10 grid gap-3 md:grid-cols-3 md:gap-5">
        {list.map((n, i) => {
          const phase = phaseOf(n);
          return (
            <Reveal as="li" key={n.id} delay={0.06 * i} className="h-full">
                <Link to={`/douane/veille#${n.slug}`} className="flex h-full flex-col gap-4 rounded-2xl border border-dz-line bg-dz-card p-5 transition-colors hover:border-dz-ink/20 sm:p-6">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={n.kind === 'disruption' ? 'warn' : 'brand'}>{t(n.kind === 'disruption' ? 'site.home.kindDisruption' : 'site.home.kindRule')}</Badge>
                    <span className="text-[14px] text-dz-ink3">{t(`watch.phase.${phase}`)}</span>
                  </span>
                  <span className="text-[17px] font-semibold leading-snug text-dz-ink">{n.title}</span>
                </Link>
            </Reveal>
          );
        })}
      </ul>
    </Container>
  );
}

function PayBand() {
  const { t } = useTranslation('customs');
  return (
    <Container className="pb-16 lg:pb-24">
      <Reveal>
        <div className="dz-night flex flex-col items-start gap-6 overflow-hidden rounded-3xl px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-14 lg:py-14">
          <div className="max-w-[560px]">
            <h2 className="[text-wrap:balance] text-[26px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[32px]">{t('site.home.payTitle')}</h2>
            <p className="mt-3 text-[17px] text-white/70">{t('site.home.payBody')}</p>
          </div>
          <ButtonLink to="/" variant="brand" size="lg">{t('site.home.payCta')} <ArrowRight aria-hidden /></ButtonLink>
        </div>
      </Reveal>
    </Container>
  );
}

/** Pour un client connecté : ce qui l'attend, en une ligne. */
function MineStrip() {
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
    <Container className="pt-8">
      <Link to="/douane/espace" className="flex items-center justify-between gap-4 rounded-2xl border border-dz-line bg-dz-card px-5 py-4 transition-colors hover:border-dz-ink/20">
        <span className="min-w-0">
          <span className="block text-[17px] font-semibold text-dz-ink">{t('site.mySpace')}</span>
          <span className="block text-[15px] text-dz-ink3">{count > 0 ? t('site.home.tasks', { count }) : t('site.home.noTasks')}</span>
        </span>
        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
      </Link>
    </Container>
  );
}

export function SiteHome() {
  return (
    <SiteLayout hero={<Hero />}>
      <MineStrip />
      <Tools />
      <Proof />
      <News />
      <PayBand />
    </SiteLayout>
  );
}

export default SiteHome;
