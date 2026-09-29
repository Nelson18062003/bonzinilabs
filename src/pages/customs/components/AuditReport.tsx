/**
 * Le rapport d'audit d'une DAU, commun au client et au commissionnaire : ce qui
 * a été payé, ce qui se réclame, ce qui se gagne en corrigeant le code, ce que
 * la douane pourrait redresser — article par article, avec la voie de droit.
 * Tout vient de auditDau (src/lib/customs/audit.ts), recalculé à l'affichage.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calculator, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { Button, Card, Fold, Holder, Line, StatusPill, SURFACE, TEXT, TYPE, type Tone } from '@/mobile/designKit';
import { formatHs } from '@/lib/customs/hsCode';
import { daysUntil, type ArticleAudit, type AuditResult, type DauExtraction, type Finding, type Route } from '@/lib/customs/audit';
import { ConfidenceDot } from '../shared';
import { isSure, longDate, xaf } from '../format';
import { useFindingText } from '../useCustomsText';

const ROUTE_TONE: Record<Route, Tone> = { claim: 'success', reclassify: 'info', risk: 'pending', check: 'neutral' };
const ROUTE_FR: Record<Route, string> = { claim: 'Réclamable', reclassify: 'Corriger le code', risk: 'Risque', check: 'À vérifier' };

function RoutePill({ route }: { route: Route }) {
  const { t } = useTranslation('customs');
  return <StatusPill tone={ROUTE_TONE[route]} label={t(`audit.route.${route}`, { defaultValue: ROUTE_FR[route] })} />;
}


/** Les trois sommes, et ce qu'on en fait. */
export function AuditSummary({ result, ext }: { result: AuditResult; ext: DauExtraction }) {
  const { t } = useTranslation('customs');
  const { totals } = result;
  const clean = totals.claimable === 0 && totals.reclassify === 0 && totals.risk === 0;
  const days = result.deadline ? daysUntil(result.deadline) : null;
  const rows: { key: Route; label: string; amount: number }[] = [
    { key: 'claim', label: t('audit.claimable', { defaultValue: 'Réclamable' }), amount: totals.claimable },
    { key: 'reclassify', label: t('audit.reclassify', { defaultValue: 'À gagner en corrigeant le code' }), amount: totals.reclassify },
    { key: 'risk', label: t('audit.risk', { defaultValue: 'Risque de redressement' }), amount: totals.risk },
  ];

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <p className={cn(TYPE.small, TEXT.muted)}>
            {[ext.dau_number, ext.office, ext.registered_on ? longDate(ext.registered_on) : null].filter(Boolean).join(' · ')}
          </p>
          <p className={cn('mt-1 text-[28px] font-semibold leading-tight tabular-nums', TEXT.strong)}>{xaf(totals.paid)}</p>
          <p className={cn(TYPE.body, TEXT.muted)}>
            {t('audit.paidOn', { count: result.articles.length, defaultValue: `payés sur ${result.articles.length} article(s)` })}
          </p>
        </div>
        {clean ? (
          <Line tone="good">{t('audit.clean', { defaultValue: 'Aucune anomalie trouvée : les taxes correspondent au tarif et aux codes déclarés.' })}</Line>
        ) : (
          <div className={cn('divide-y rounded-lg px-3', SURFACE.inset, 'divide-[#D9D9D9] dark:divide-[#444444]')}>
            {rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full',
                    r.amount === 0 ? 'bg-[#D9D9D9] dark:bg-[#5A5A5A]' : r.key === 'claim' ? 'bg-[#14AE5C]' : r.key === 'reclassify' ? 'bg-[#2C6ECB]' : 'bg-[#E8B931]')} />
                  <span className={cn(TYPE.body, r.amount === 0 ? TEXT.muted : TEXT.strong)}>{r.label}</span>
                </span>
                <span className={cn('shrink-0 text-[17px] font-semibold tabular-nums', r.amount === 0 ? TEXT.muted : TEXT.strong)}>{xaf(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!clean && (
        <Card className="space-y-3 p-4">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.routesTitle', { defaultValue: 'Ce que vous pouvez faire' })}</p>
          {totals.claimable > 0 && (
            <div className="flex gap-3">
              <Holder icon={CalendarClock} size="sm" tone={days != null && days < 0 ? 'danger' : 'success'} />
              <div className="min-w-0 space-y-1">
                <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.routeClaim', { defaultValue: 'Réclamer les droits indûment perçus' })}</p>
                <Line>
                  {result.deadline
                    ? days! < 0
                      ? t('audit.deadlinePassed', { date: longDate(result.deadline), defaultValue: `Le délai de trois ans a expiré le ${longDate(result.deadline)}.` })
                      : t('audit.deadline', { date: longDate(result.deadline), count: days!, days: formatNumber(days!), defaultValue: `Jusqu'au ${longDate(result.deadline)}, dans ${days} jours (trois ans après le paiement).` })
                    : t('audit.deadlineUnknown', { defaultValue: 'Dans les trois ans qui suivent le paiement : indiquez sa date.' })}
                </Line>
              </div>
            </div>
          )}
          {totals.reclassify > 0 && (
            <Line>
              <span className={cn('font-semibold', TEXT.strong)}>{t('audit.routeReclassify', { defaultValue: 'Corriger le code' })}. </span>
              {ext.released === false
                ? t('audit.notReleased', { defaultValue: 'La mainlevée n’est pas encore accordée : votre déclarant peut retirer la déclaration pour la corriger.' })
                : ext.released === true
                  ? t('audit.released', { defaultValue: 'La mainlevée est accordée : le code d’une déclaration ne se rectifie plus. Le gain vaut pour vos prochains conteneurs.' })
                  : t('audit.releaseUnknown', { defaultValue: 'Avant la mainlevée, la déclaration peut être retirée et corrigée ; après, le gain vaut pour vos prochains conteneurs.' })}
            </Line>
          )}
          {totals.risk > 0 && (
            <Line>
              <span className={cn('font-semibold', TEXT.strong)}>{t('audit.routeRisk', { defaultValue: 'Régulariser' })}. </span>
              {t('audit.riskText', { defaultValue: 'Certains droits semblent inférieurs à ce que prévoient les textes. Mieux vaut régulariser avant un contrôle : le commissionnaire vous dira comment.' })}
            </Line>
          )}
          <p className={cn(TYPE.small, TEXT.faint)}>
            {t('audit.legal', { defaultValue: 'Code des douanes CEMAC 2019 : art. 162 (rectification et retrait), 396 (délai de trois ans). Numérotation à confirmer dans le code CEEAC-CEMAC en vigueur depuis le 1er janvier 2026. Le moteur signale ; le commissionnaire agréé décide.' })}
          </p>
        </Card>
      )}
    </div>
  );
}

function FindingRow({ f, value, simulateBase }: { f: Finding; value: number | null; simulateBase: string }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const text = useFindingText();
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <RoutePill route={f.route} />
        {f.amount_xaf !== 0 && (
          <span className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>
            {f.amount_xaf > 0
              ? t('audit.overpaid', { amount: xaf(f.amount_xaf), defaultValue: `${xaf(f.amount_xaf)} de trop` })
              : t('audit.underpaid', { amount: xaf(-f.amount_xaf), defaultValue: `${xaf(-f.amount_xaf)} de moins que dû` })}
          </span>
        )}
        <span className={cn('ml-auto flex items-center gap-1.5 text-[14px]', TEXT.muted)}>
          <ConfidenceDot sure={isSure(f.confidence)} />
          {t(`confidence.${f.confidence}`)}
        </span>
      </div>
      <p className={cn('text-[15px] leading-snug', TEXT.body)}>{text(f)}</p>
      {f.proposed_code && value != null && (
        <Button size="sm" variant="neutral" onClick={() =>
          navigate(`${simulateBase}?c=${f.proposed_code}&vs=${f.declared_code?.slice(0, 6) ?? ''}&a=${value}&cur=XAF&inc=CIF`)}>
          <Calculator aria-hidden /> {t('audit.compare', { code: formatHs(f.proposed_code), defaultValue: `Comparer avec le ${formatHs(f.proposed_code)}` })}
        </Button>
      )}
    </li>
  );
}

function ArticleCard({ a, simulateBase }: { a: ArticleAudit; simulateBase: string }) {
  const { t } = useTranslation('customs');
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(TYPE.small, TEXT.muted)}>{t('audit.article', { n: a.n, defaultValue: `Article ${a.n}` })}</p>
          <p className={cn(TYPE.bodyStrong, 'break-words', TEXT.strong)}>{a.description || '—'}</p>
          <p className={cn('text-[15px] tabular-nums', TEXT.body)}>{a.code ? formatHs(a.code) : '—'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>{xaf(a.paid)}</p>
          {a.value != null && <p className={cn('text-[14px] tabular-nums', TEXT.muted)}>{t('audit.valueShort', { value: xaf(a.value), defaultValue: `valeur ${xaf(a.value)}` })}</p>}
        </div>
      </div>
      <ul className={cn('space-y-4 border-t pt-3', SURFACE.divider)}>
        {a.findings.map((f) => <FindingRow key={f.id} f={f} value={a.value} simulateBase={simulateBase} />)}
      </ul>
    </Card>
  );
}

/** Les articles : ceux qui ont une remarque d'abord, les autres repliés. */
export function AuditArticles({ result, ext, simulateBase }: { result: AuditResult; ext: DauExtraction; simulateBase: string }) {
  const { t } = useTranslation('customs');
  const [openQuiet, setOpenQuiet] = useState(false);
  const noisy = result.articles.filter((a) => a.findings.length > 0)
    .sort((x, y) => (y.claimable + y.reclassify + y.risk) - (x.claimable + x.reclassify + x.risk) || x.n - y.n);
  const quiet = result.articles.filter((a) => a.findings.length === 0);

  return (
    <section className="space-y-3" aria-label={t('audit.articlesTitle', { defaultValue: 'Les articles' })}>
      {noisy.length > 0 && <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('audit.remarks', { count: noisy.length, defaultValue: `${noisy.length} article(s) à regarder` })}</h2>}
      {noisy.map((a) => <ArticleCard key={a.n} a={a} simulateBase={simulateBase} />)}
      {quiet.length > 0 && (
        <Fold title={t('audit.quiet', { count: quiet.length, defaultValue: `${quiet.length} article(s) sans remarque` })} open={openQuiet} onToggle={() => setOpenQuiet(!openQuiet)}>
          <ul>
            {quiet.map((a) => (
              <li key={a.n} className={cn('flex items-center justify-between gap-3 border-b py-3 last:border-b-0', SURFACE.divider)}>
                <span className="min-w-0">
                  <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{a.n}. {a.description}</span>
                  <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{formatHs(a.code)}</span>
                </span>
                <span className={cn('shrink-0 tabular-nums', TYPE.body, TEXT.body)}>{xaf(a.paid)}</span>
              </li>
            ))}
          </ul>
        </Fold>
      )}
      {ext.unreadable.length > 0 && (
        <Card className="space-y-1 p-4">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.unreadableTitle', { defaultValue: 'Ce qui n’a pas pu être lu' })}</p>
          {ext.unreadable.map((u) => <Line key={u} tone="warn">{u}</Line>)}
        </Card>
      )}
    </section>
  );
}

/** L'avis du commissionnaire, une fois rendu. */
export function AuditVerdict({ note, recoverable, company, license, at }: {
  note: string | null; recoverable: number | null; company: string | null; license: string | null; at: string | null;
}) {
  const { t } = useTranslation('customs');
  const when = at ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <Card className="space-y-3 border-[#14AE5C] p-5 dark:border-[#14AE5C]">
      <p className="text-[16px] font-semibold text-[#009951] dark:text-[#14AE5C]">{t('audit.verdictTitle', { defaultValue: 'L’avis du commissionnaire agréé' })}</p>
      {recoverable != null && (
        <div>
          <p className={cn(TYPE.small, TEXT.muted)}>{t('audit.recoverable', { defaultValue: 'Récupérable selon lui' })}</p>
          <p className={cn('text-[28px] font-semibold leading-tight tabular-nums', TEXT.strong)}>{xaf(recoverable)}</p>
        </div>
      )}
      {note && <p className={cn('whitespace-pre-line rounded-lg p-3 text-[16px] leading-snug', SURFACE.inset, TEXT.body)}>{note}</p>}
      <p className={cn(TYPE.small, TEXT.muted)}>{[company, license ? t('audit.license', { license, defaultValue: `agrément ${license}` }) : null, when].filter(Boolean).join(' · ')}</p>
    </Card>
  );
}
