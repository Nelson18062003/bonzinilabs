// ============================================================
// /douane/veille — les actualités douane, côté site.
// Deux familles (ce qui change dans les textes, ce qui retarde la
// marchandise), une carte par avis : le titre et l'essentiel d'abord,
// la suite (quoi faire, codes visés, source) en un geste.
// L'équipe garde sa page de publication (NoticesPage, variant 'admin').
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, ExternalLink, MapPin, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { formatHs } from '@/lib/customs/hsCode';
import { PLACE_FR, daysUntilStart, noticesForCodes, phaseOf, sortNotices, type Notice, type NoticeKind } from '@/lib/customs/notices';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { isSure, longDate } from '../format';
import { SiteLayout } from './SiteLayout';
import { Badge, Button, Container, PageIntro, Pills, Reveal } from './ui';
import { EASE } from './styles';

function when(n: Notice, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  const phase = phaseOf(n);
  if (n.kind === 'disruption' && n.starts_on && n.ends_on) {
    const sameYear = n.starts_on.slice(0, 4) === n.ends_on.slice(0, 4);
    return t('watch.fromTo', { from: longDate(n.starts_on, !sameYear), to: longDate(n.ends_on) });
  }
  if (!n.starts_on) return null;
  return phase === 'announced' || phase === 'upcoming' ? t('watch.from', { date: longDate(n.starts_on) }) : t('watch.since', { date: longDate(n.starts_on) });
}

function NewsCard({ n, open, onToggle, mineCodes }: { n: Notice; open: boolean; onToggle: () => void; mineCodes?: string[] }) {
  const { t } = useTranslation('customs');
  const phase = phaseOf(n);
  const inDays = phase === 'upcoming' ? daysUntilStart(n) : null;
  const date = when(n, t);
  return (
    <article id={n.slug} className="scroll-mt-24 rounded-[28px] bg-dz-card p-5 transition-colors sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={n.kind === 'disruption' ? 'warn' : 'brand'}>{t(`watch.phase.${phase}`)}</Badge>
        {inDays != null && inDays >= 0 && (
          <span className="text-[14px] font-semibold text-dz-ink">{inDays === 0 ? t('watch.today') : t('watch.inDays', { count: inDays })}</span>
        )}
        {date && <span className="text-[14px] text-dz-ink3">{date}</span>}
      </div>
      <h2 className="mt-3 text-[19px] font-bold leading-snug [text-wrap:balance] sm:text-[21px]">{n.title}</h2>
      <p className={cn('mt-2 text-[16px] leading-relaxed text-dz-ink2', !open && 'line-clamp-3')}>{n.summary}</p>

      {(n.delay_days || n.places.length > 0) && (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-dz-ink2">
          {n.delay_days ? <span className="inline-flex items-center gap-1.5"><Timer aria-hidden className="h-4 w-4 text-dz-ink3" />{t('watch.delay', { count: n.delay_days })}</span> : null}
          {n.places.length > 0 && (
            <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden className="h-4 w-4 text-dz-ink3" />
              {n.places.map((p) => t(`watch.place.${p}`, { defaultValue: PLACE_FR[p] ?? p })).join(' · ')}</span>
          )}
        </p>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="space-y-4 pt-4">
              {n.advice && (
                <p className="rounded-2xl bg-dz-soft p-4 text-[15px] leading-snug text-dz-ink">
                  <span className="font-semibold">{t('watch.todo')}{' '}: </span>{n.advice}
                </p>
              )}
              {n.hs_specs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[14px] text-dz-ink3">{t('watch.codes')}</span>
                  {n.hs_specs.slice(0, 14).map((s) => {
                    const mine = mineCodes?.some((c) => c.startsWith(s));
                    return (
                      <span key={s} className={cn('rounded-lg px-2 py-0.5 text-[14px] tabular-nums', mine ? 'bg-dz-primary font-semibold text-dz-on-primary' : 'bg-dz-soft text-dz-ink2')}>
                        {formatHs(s)}
                      </span>
                    );
                  })}
                  {n.hs_specs.length > 14 && <span className="text-[14px] text-dz-ink3">+{n.hs_specs.length - 14}</span>}
                </div>
              )}
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dz-line pt-3 text-[14px] text-dz-ink3">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn('h-2 w-2 rounded-full', isSure(n.confidence) ? 'bg-dz-good' : 'bg-dz-gold')} />{t(`confidence.${n.confidence}`)}
                </span>
                {n.source_url ? (
                  <a href={n.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-dz-ink2 underline-offset-2 hover:underline">
                    {n.source_label ?? t('watch.source')}<ExternalLink aria-hidden className="h-3.5 w-3.5" />
                  </a>
                ) : n.source_label ? <span>{n.source_label}</span> : null}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button type="button" onClick={onToggle} aria-expanded={open}
        className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full text-[15px] font-semibold text-dz-brand hover:underline">
        {open ? t('site.news.less') : t('site.news.more')}
        <ChevronDown aria-hidden className={cn('h-4 w-4 transition-transform duration-300', open && 'rotate-180')} />
      </button>
    </article>
  );
}

export function NewsPage() {
  const { t } = useTranslation('customs');
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const q = useCustomsNotices();
  const files = useMyCustomsFiles(!!user);
  const all = useMemo(() => sortNotices((q.data ?? []).filter((n) => n.published)), [q.data]);
  const hash = decodeURIComponent(location.hash.replace('#', ''));
  const linked = all.find((n) => n.slug === hash);
  const hot = all.some((n) => n.kind === 'disruption' && ['ongoing', 'upcoming'].includes(phaseOf(n)));
  const [tab, setTab] = useState<NoticeKind | null>(null);
  const current: NoticeKind = tab ?? linked?.kind ?? (hot ? 'disruption' : 'regulation');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (!linked) return;
    setOpenIds((s) => new Set(s).add(linked.id));
    if (phaseOf(linked) === 'past') setShowPast(true);
    const id = window.setTimeout(() => document.getElementById(linked.slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    return () => window.clearTimeout(id);
  }, [linked]);

  const mine = useMemo(() => {
    const list = files.data?.classifications ?? [];
    return noticesForCodes(all.filter((n) => phaseOf(n) !== 'past'), list.map((c) => c.final_code ?? c.proposed_code)).map((hit) => ({
      ...hit,
      products: list.filter((c) => hit.codes.some((code) => (c.final_code ?? c.proposed_code ?? '').startsWith(code.slice(0, 6)))).map((c) => c.product_name),
    }));
  }, [files.data, all]);

  const count = (k: NoticeKind) => all.filter((n) => n.kind === k && phaseOf(n) !== 'past').length;
  const inTab = all.filter((n) => n.kind === current);
  const visible = inTab.filter((n) => showPast || phaseOf(n) !== 'past');
  const pastCount = inTab.filter((n) => phaseOf(n) === 'past').length;
  const toggle = (id: string) => setOpenIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const go = (n: Notice) => { setTab(n.kind); navigate({ hash: n.slug }, { replace: true }); };

  const tabs = (
    <Pills<NoticeKind> label={t('site.news.filter')} value={current} onChange={(k) => { setTab(k); setShowPast(false); }} options={[
      { value: 'disruption', label: <>{t('watch.tabs.disruption')} <span className="tabular-nums opacity-60">{count('disruption')}</span></> },
      { value: 'regulation', label: <>{t('watch.tabs.regulation')} <span className="tabular-nums opacity-60">{count('regulation')}</span></> },
    ]} />
  );

  return (
    <SiteLayout>
      <PageIntro title={t('site.news.title')} subtitle={t('site.news.subtitle')} back={{ to: '/douane', label: t('site.badge') }} />
      <Container className="grid gap-8 pb-20 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0 space-y-4">
          {mine.length > 0 && (
            <section className="rounded-3xl bg-dz-brand-soft p-5 sm:p-6 lg:hidden">
              <MineList mine={mine} onGo={go} />
            </section>
          )}
          <div className="lg:hidden">{tabs}</div>
          {q.isLoading ? (
            <div className="space-y-3" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-[28px] bg-dz-fill" />)}</div>
          ) : q.isError ? (
            <div className="rounded-[28px] bg-dz-card p-6">
              <p className="text-[16px]">{(q.error as Error).message}</p>
              <Button className="mt-4" variant="secondary" onClick={() => { void q.refetch(); }}>{t('site.retry')}</Button>
            </div>
          ) : visible.length === 0 ? (
            <p className="rounded-[28px] bg-dz-card p-6 text-[16px] text-dz-ink2">
              {current === 'disruption' ? t('watch.noDisruption') : t('watch.noRegulation')}
            </p>
          ) : (
            <ul className="space-y-4">
              {visible.map((n, i) => (
                <Reveal as="li" key={n.id} delay={Math.min(i, 4) * 0.04}>
                  <NewsCard n={n} open={openIds.has(n.id)} onToggle={() => toggle(n.id)} mineCodes={mine.find((m) => m.notice.id === n.id)?.codes} />
                </Reveal>
              ))}
            </ul>
          )}
          {pastCount > 0 && (
            <Button variant="ghost" className="w-full" onClick={() => setShowPast(!showPast)}>
              {showPast ? t('watch.hidePast') : t('watch.showPast', { count: pastCount })}
            </Button>
          )}
        </div>

        <aside className="hidden space-y-6 lg:sticky lg:top-24 lg:block lg:self-start">
          <div className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-dz-ink3">{t('site.news.filter')}</p>
            {tabs}
          </div>
          {mine.length > 0 && (
            <section className="rounded-3xl bg-dz-brand-soft p-5">
              <MineList mine={mine} onGo={go} />
            </section>
          )}
          <p className="text-[14px] leading-relaxed text-dz-ink3">{t('watch.footer')}</p>
        </aside>
      </Container>
    </SiteLayout>
  );
}

function MineList({ mine, onGo }: { mine: { notice: Notice; codes: string[]; products: string[] }[]; onGo: (n: Notice) => void }) {
  const { t } = useTranslation('customs');
  return (
    <>
      <p className="text-[16px] font-bold text-dz-ink">{t('watch.forYou', { count: mine.length })}</p>
      <ul className="mt-2">
        {mine.map((m) => (
          <li key={m.notice.id}>
            <button type="button" onClick={() => onGo(m.notice)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-dz-card/60">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-dz-ink">{m.notice.title}</span>
                <span className="block text-[14px] text-dz-ink3">{m.products.slice(0, 3).join(' · ')}</span>
              </span>
              <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export default NewsPage;
