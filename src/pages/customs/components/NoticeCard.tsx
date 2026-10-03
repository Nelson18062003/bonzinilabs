/**
 * Un avis de veille : où il en est, depuis ou jusqu'à quand, ce qu'il change,
 * ce qu'il faut faire, qui il vise, et d'où vient l'information.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, MapPin, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, StatusPill, SURFACE, TEXT, TYPE, type Tone } from '@/mobile/designKit';
import { formatHs } from '@/lib/customs/hsCode';
import { PLACE_FR, daysUntilStart, phaseOf, type Notice, type Phase } from '@/lib/customs/notices';
import { ConfidenceDot } from '../shared';
import { isSure, longDate } from '../format';

const PHASE: Record<Phase, { fr: string; tone: Tone }> = {
  in_force: { fr: 'En vigueur', tone: 'info' },
  announced: { fr: 'Annoncé', tone: 'pending' },
  watch: { fr: 'À confirmer', tone: 'neutral' },
  upcoming: { fr: 'À venir', tone: 'pending' },
  ongoing: { fr: 'En cours', tone: 'pending' },
  past: { fr: 'Terminé', tone: 'neutral' },
};


export function NoticeCard({ n, matchedCodes, footer, draft }: {
  n: Notice;
  /** Les codes du client que l'avis vise — mis en avant. */
  matchedCodes?: string[];
  footer?: ReactNode;
  draft?: boolean;
}) {
  const { t } = useTranslation('customs');
  const phase = phaseOf(n);
  const meta = PHASE[phase];
  const inDays = phase === 'upcoming' ? daysUntilStart(n) : null;

  let when: string | null = null;
  if (n.kind === 'disruption' && n.starts_on && n.ends_on) {
    const sameYear = n.starts_on.slice(0, 4) === n.ends_on.slice(0, 4);
    when = t('watch.fromTo', { from: longDate(n.starts_on, !sameYear), to: longDate(n.ends_on), defaultValue: `Du ${longDate(n.starts_on, !sameYear)} au ${longDate(n.ends_on)}` });
  } else if (n.starts_on) {
    when = phase === 'announced' || phase === 'upcoming'
      ? t('watch.from', { date: longDate(n.starts_on), defaultValue: `À partir du ${longDate(n.starts_on)}` })
      : t('watch.since', { date: longDate(n.starts_on), defaultValue: `Depuis le ${longDate(n.starts_on)}` });
  }

  const specs = n.hs_specs.slice(0, 10);
  return (
    <Card id={n.slug} className={cn('scroll-mt-20 space-y-3 p-4', draft && 'border-dashed')}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={meta.tone} label={t(`watch.phase.${phase}`, { defaultValue: meta.fr })} />
        {draft && <StatusPill tone="neutral" label={t('watch.draft', { defaultValue: 'Brouillon' })} />}
        {inDays != null && inDays >= 0 && (
          <span className={cn(TYPE.smallStrong, TEXT.strong)}>
            {inDays === 0 ? t('watch.today', { defaultValue: 'aujourd’hui' }) : t('watch.inDays', { count: inDays, defaultValue: `dans ${inDays} jours` })}
          </span>
        )}
        {when && <span className={cn(TYPE.small, TEXT.muted)}>{when}</span>}
      </div>

      <div className="space-y-1">
        <h3 className={cn(TYPE.lead, TEXT.strong)}>{n.title}</h3>
        <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>{n.summary}</p>
      </div>

      {(n.delay_days || n.places.length > 0) && (
        <div className={cn('flex flex-wrap gap-x-4 gap-y-1', TYPE.body, TEXT.body)}>
          {n.delay_days ? (
            <span className="inline-flex items-center gap-1.5"><Timer aria-hidden className={cn('h-4 w-4', TEXT.muted)} />
              {t('watch.delay', { count: n.delay_days, defaultValue: `≈ ${n.delay_days} jours de retard` })}</span>
          ) : null}
          {n.places.length > 0 && (
            <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden className={cn('h-4 w-4', TEXT.muted)} />
              {n.places.map((p) => t(`watch.place.${p}`, { defaultValue: PLACE_FR[p] ?? p })).join(' · ')}</span>
          )}
        </div>
      )}

      {n.advice && (
        <p className={cn('rounded-lg p-3 text-[16px] leading-snug', SURFACE.inset, TEXT.body)}>
          <span className={cn('font-semibold', TEXT.strong)}>{t('watch.todo', { defaultValue: 'À faire' })} : </span>{n.advice}
        </p>
      )}

      {specs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn(TYPE.small, TEXT.muted)}>{t('watch.codes', { defaultValue: 'Codes visés' })} :</span>
          {specs.map((s) => {
            const mine = matchedCodes?.some((c) => c.startsWith(s));
            return (
              <span key={s} className={cn('rounded-md px-1.5 py-0.5 text-[14px] tabular-nums',
                mine ? 'bg-[#2C2C2C] font-semibold text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn(SURFACE.inset, TEXT.body))}>
                {formatHs(s)}
              </span>
            );
          })}
          {n.hs_specs.length > specs.length && <span className={cn(TYPE.small, TEXT.muted)}>+{n.hs_specs.length - specs.length}</span>}
        </div>
      )}

      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2', SURFACE.divider)}>
        <span className={cn('inline-flex items-center gap-1.5 text-[14px]', TEXT.muted)}>
          <ConfidenceDot sure={isSure(n.confidence)} />{t(`confidence.${n.confidence}`)}
        </span>
        {n.source_url ? (
          <a href={n.source_url} target="_blank" rel="noreferrer" className={cn('inline-flex min-h-8 items-center gap-1 text-[14px] underline-offset-2 hover:underline', TEXT.body)}>
            {n.source_label ?? t('watch.source', { defaultValue: 'Source' })}<ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </a>
        ) : n.source_label ? <span className={cn('text-[14px]', TEXT.muted)}>{n.source_label}</span> : null}
      </div>
      {footer}
    </Card>
  );
}
