/**
 * Le rapport d'audit d'une DAU, côté site (le commissionnaire garde la
 * version de l'espace équipe, components/AuditReport.tsx). Dans l'ordre où
 * le client le lit : les trois sommes, ce qu'il peut faire, puis chaque
 * article qui pose question — les autres repliés.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Calculator, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { formatHs } from '@/lib/customs/hsCode';
import { daysUntil, type ArticleAudit, type AuditResult, type DauExtraction, type Finding, type Route } from '@/lib/customs/audit';
import { isSure, longDate, xaf } from '../../format';
import { useFindingText } from '../../useCustomsText';
import { Badge, CountUp, Disclosure, Reveal } from '../ui';

const ROUTE_TONE: Record<Route, 'good' | 'brand' | 'warn' | 'neutral'> = { claim: 'good', reclassify: 'brand', risk: 'warn', check: 'neutral' };
const ROUTE_DOT: Record<Route, string> = { claim: 'bg-[#4ade80]', reclassify: 'bg-[#a78bfa]', risk: 'bg-[#f3a745]', check: 'bg-white/40' };

/** Les trois sommes, sur la carte sombre (comme le résultat du simulateur). */
export function AuditTotals({ result, ext }: { result: AuditResult; ext: DauExtraction }) {
  const { t } = useTranslation('customs');
  const { totals } = result;
  const clean = totals.claimable === 0 && totals.reclassify === 0 && totals.risk === 0;
  const rows: { key: Route; label: string; amount: number }[] = [
    { key: 'claim', label: t('audit.claimable'), amount: totals.claimable },
    { key: 'reclassify', label: t('audit.reclassify'), amount: totals.reclassify },
    { key: 'risk', label: t('audit.risk'), amount: totals.risk },
  ];
  return (
    <div className="rounded-3xl bg-dz-primary p-6 text-dz-on-primary sm:p-7">
      <p className="text-[14px] opacity-60">{[ext.office, ext.registered_on ? longDate(ext.registered_on) : null].filter(Boolean).join(' · ')}</p>
      <p className="mt-3 text-[15px] opacity-70">{t('site.audit.paid')}</p>
      <p className="mt-1 text-[clamp(28px,8.6vw,40px)] font-bold leading-none tracking-[-0.02em]"><CountUp value={totals.paid} format={xaf} /></p>
      <p className="mt-2 text-[15px] opacity-70">{t('audit.paidOn', { count: result.articles.length })}</p>
      {clean ? (
        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-dz-on-primary/10 p-4 text-[15px]"><BadgeCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />{t('audit.clean')}</p>
      ) : (
        <dl className="mt-6 space-y-3 border-t border-dz-on-primary/15 pt-5">
          {rows.map((r) => (
            <div key={r.key} className={cn('flex items-baseline justify-between gap-4', r.amount === 0 && 'opacity-50')}>
              <dt className="flex min-w-0 items-center gap-2 text-[15px]">
                <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', ROUTE_DOT[r.key])} />{r.label}
              </dt>
              <dd className="shrink-0 whitespace-nowrap text-[18px] font-bold tabular-nums">{xaf(r.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Ce que le client peut faire, avec le délai qui court. */
export function AuditRoutes({ result, ext }: { result: AuditResult; ext: DauExtraction }) {
  const { t } = useTranslation('customs');
  const { totals } = result;
  if (totals.claimable === 0 && totals.reclassify === 0 && totals.risk === 0) return null;
  const days = result.deadline ? daysUntil(result.deadline) : null;
  return (
    <section className="rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <h2 className="text-[18px] font-bold">{t('audit.routesTitle')}</h2>
      <div className="mt-4 space-y-4">
        {totals.claimable > 0 && (
          <div className="flex gap-4">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', days != null && days < 0 ? 'bg-dz-bad/10 text-dz-bad' : 'bg-dz-good-soft text-dz-good')}>
              <CalendarClock aria-hidden className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold">{t('audit.routeClaim')}</p>
              <p className="mt-1 text-[15px] leading-snug text-dz-ink2">
                {result.deadline
                  ? days! < 0
                    ? t('audit.deadlinePassed', { date: longDate(result.deadline) })
                    : t('audit.deadline', { date: longDate(result.deadline), count: days!, days: formatNumber(days!) })
                  : t('audit.deadlineUnknown')}
              </p>
            </div>
          </div>
        )}
        {totals.reclassify > 0 && (
          <p className="text-[15px] leading-snug text-dz-ink2">
            <span className="font-semibold text-dz-ink">{t('audit.routeReclassify')}. </span>
            {ext.released === false ? t('audit.notReleased') : ext.released === true ? t('audit.released') : t('audit.releaseUnknown')}
          </p>
        )}
        {totals.risk > 0 && (
          <p className="text-[15px] leading-snug text-dz-ink2"><span className="font-semibold text-dz-ink">{t('audit.routeRisk')}. </span>{t('audit.riskText')}</p>
        )}
      </div>
      <p className="mt-4 border-t border-dz-line pt-3 text-[13px] leading-snug text-dz-ink3">{t('audit.legal')}</p>
    </section>
  );
}

function FindingRow({ f, value, simulateBase }: { f: Finding; value: number | null; simulateBase: string }) {
  const { t } = useTranslation('customs');
  const text = useFindingText();
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ROUTE_TONE[f.route]}>{t(`audit.route.${f.route}`)}</Badge>
        {f.amount_xaf !== 0 && (
          <span className="text-[16px] font-bold tabular-nums">
            {f.amount_xaf > 0 ? t('audit.overpaid', { amount: xaf(f.amount_xaf) }) : t('audit.underpaid', { amount: xaf(-f.amount_xaf) })}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-dz-ink3">
          <span aria-hidden className={cn('h-2 w-2 rounded-full', isSure(f.confidence) ? 'bg-dz-good' : 'bg-dz-gold')} />{t(`confidence.${f.confidence}`)}
        </span>
      </div>
      <p className="text-[15px] leading-relaxed text-dz-ink2">{text(f)}</p>
      {f.proposed_code && value != null && (
        <Link to={`${simulateBase}?c=${f.proposed_code}&vs=${f.declared_code?.slice(0, 6) ?? ''}&a=${value}&cur=XAF&inc=CIF`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-dz-line px-4 text-[14px] font-semibold text-dz-ink transition-colors hover:bg-dz-soft">
          <Calculator aria-hidden className="h-4 w-4" /> {t('audit.compare', { code: formatHs(f.proposed_code) })}
        </Link>
      )}
    </li>
  );
}

function ArticleCard({ a, simulateBase }: { a: ArticleAudit; simulateBase: string }) {
  const { t } = useTranslation('customs');
  return (
    <article className="rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-dz-ink3">{t('audit.article', { n: a.n })}</p>
          <p className="mt-1 break-words text-[17px] font-semibold leading-snug">{a.description || '—'}</p>
          <p className="mt-0.5 text-[15px] tabular-nums text-dz-ink3">{a.code ? formatHs(a.code) : '—'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="whitespace-nowrap text-[17px] font-bold tabular-nums">{xaf(a.paid)}</p>
          {a.value != null && <p className="whitespace-nowrap text-[13px] tabular-nums text-dz-ink3">{t('audit.valueShort', { value: xaf(a.value) })}</p>}
        </div>
      </div>
      <ul className="mt-4 space-y-5 border-t border-dz-line pt-4">
        {a.findings.map((f) => <FindingRow key={f.id} f={f} value={a.value} simulateBase={simulateBase} />)}
      </ul>
    </article>
  );
}

/** Les articles : ceux qui ont une remarque d'abord, les autres repliés. */
export function AuditArticleList({ result, ext, simulateBase }: { result: AuditResult; ext: DauExtraction; simulateBase: string }) {
  const { t } = useTranslation('customs');
  const noisy = result.articles.filter((a) => a.findings.length > 0)
    .sort((x, y) => (y.claimable + y.reclassify + y.risk) - (x.claimable + x.reclassify + x.risk) || x.n - y.n);
  const quiet = result.articles.filter((a) => a.findings.length === 0);
  return (
    <section className="space-y-4" aria-label={t('audit.articlesTitle')}>
      {noisy.length > 0 && <h2 className="pt-2 text-[22px] font-bold tracking-[-0.01em]">{t('audit.remarks', { count: noisy.length })}</h2>}
      {noisy.map((a, i) => <Reveal key={a.n} delay={Math.min(i, 4) * 0.04}><ArticleCard a={a} simulateBase={simulateBase} /></Reveal>)}
      {quiet.length > 0 && (
        <div className="rounded-3xl border border-dz-line bg-dz-card px-5 sm:px-6">
          <Disclosure title={t('audit.quiet', { count: quiet.length })}>
            <ul>
              {quiet.map((a) => (
                <li key={a.n} className="flex items-center justify-between gap-3 border-b border-dz-line py-3 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block break-words text-[15px] font-semibold">{a.n}. {a.description}</span>
                    <span className="block text-[14px] tabular-nums text-dz-ink3">{formatHs(a.code)}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[15px] tabular-nums text-dz-ink2">{xaf(a.paid)}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}
      {ext.unreadable.length > 0 && (
        <div className="rounded-3xl bg-dz-warn-soft p-5">
          <p className="text-[16px] font-semibold">{t('audit.unreadableTitle')}</p>
          <ul className="mt-2 space-y-1">{ext.unreadable.map((u) => <li key={u} className="text-[15px] text-dz-ink2">{u}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

/** L'avis du commissionnaire, une fois rendu. */
export function AuditVerdictCard({ note, recoverable, company, license, at }: {
  note: string | null; recoverable: number | null; company: string | null; license: string | null; at: string | null;
}) {
  const { t } = useTranslation('customs');
  const when = at ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <section className="rounded-3xl border-2 border-dz-good bg-dz-card p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[16px] font-semibold text-dz-good"><BadgeCheck aria-hidden className="h-5 w-5" />{t('audit.verdictTitle')}</p>
      {recoverable != null && (
        <div className="mt-4">
          <p className="text-[14px] text-dz-ink3">{t('audit.recoverable')}</p>
          <p className="mt-1 text-[32px] font-bold leading-none tabular-nums">{xaf(recoverable)}</p>
        </div>
      )}
      {note && <p className="mt-4 whitespace-pre-line rounded-2xl bg-dz-soft p-4 text-[15px] leading-relaxed text-dz-ink2">{note}</p>}
      <p className="mt-4 text-[14px] text-dz-ink3">{[company, license ? t('audit.license', { license }) : null, when].filter(Boolean).join(' · ')}</p>
    </section>
  );
}
