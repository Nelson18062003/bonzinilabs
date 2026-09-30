/**
 * La file du commissionnaire agréé, sur l'accueil Douane de l'espace équipe :
 * les fiches à signer (la plus ancienne d'abord), puis les dernières signées.
 * Session `supabaseAdmin` (useCustomsReview).
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Line, ListRow, ScreenError, SectionTitle, StatusPill, SURFACE, TEXT } from '@/mobile/designKit';
import { formatHs } from '@/lib/customs/hsCode';
import { useCustomsReviewQueue, type QueueClassification } from '@/hooks/useCustomsReview';
import { xaf } from '../format';

const clientName = (c: QueueClassification['client']) =>
  c?.company_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ') || '—';

/** « il y a 3 h », « il y a 2 j » : ce qui compte dans une file, c'est l'attente. */
function waited(iso: string | null, lang: string): string {
  if (!iso) return '';
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  return h < 1 ? rtf.format(-Math.round(h * 60), 'minute') : h < 48 ? rtf.format(-Math.round(h), 'hour') : rtf.format(-Math.round(h / 24), 'day');
}

export function ReviewQueue() {
  const { t, i18n } = useTranslation('customs');
  const navigate = useNavigate();
  const queue = useCustomsReviewQueue();

  if (queue.isError) return <ScreenError className="min-h-0 py-6" description={(queue.error as Error).message} onRetry={() => queue.refetch()} />;
  if (!queue.data) return null;
  const { classifications, audits, recent, is_broker } = queue.data;

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>
          {t('review.queueTitle', { defaultValue: 'Classements à signer' })}
          {classifications.length > 0 && <span className={cn('ml-2 tabular-nums', TEXT.muted)}>{classifications.length}</span>}
        </SectionTitle>
        {classifications.length === 0 ? (
          <Line className={TEXT.muted}>{t('review.queueEmpty', { defaultValue: 'Rien à signer pour le moment.' })}</Line>
        ) : (
          <div className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
            {classifications.map((c) => (
              <ListRow
                key={c.id}
                title={c.product_name}
                subtitle={[
                  clientName(c.client),
                  c.proposed_code ? formatHs(c.proposed_code) : t('review.noCode', { defaultValue: 'sans code proposé' }),
                  waited(c.submitted_at, i18n.language || 'fr'),
                ].filter(Boolean).join(' · ')}
                trailing={
                  c.mine ? <StatusPill tone="info" label={t('review.mine', { defaultValue: 'À vous' })} />
                  : c.claimed_by ? <StatusPill tone="neutral" label={t('review.taken', { defaultValue: 'Pris' })} />
                  : <StatusPill tone="pending" label={t('review.toTake', { defaultValue: 'À prendre' })} />
                }
                onClick={() => navigate(`/m/douane/revue/${c.id}`)}
              />
            ))}
          </div>
        )}
        {!is_broker && classifications.length > 0 && (
          <p className={cn('mt-2 text-[14px]', TEXT.muted)}>{t('review.readOnlyShort', { defaultValue: 'Seul un commissionnaire agréé enregistré peut signer.' })}</p>
        )}
      </section>

      {audits.length > 0 && (
        <section>
          <SectionTitle>
            {t('audit.queueTitle', { defaultValue: 'Déclarations à relire' })}
            <span className={cn('ml-2 tabular-nums', TEXT.muted)}>{audits.length}</span>
          </SectionTitle>
          <div className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
            {audits.map((a) => (
              <ListRow
                key={a.id}
                title={a.dau_number ?? a.ref}
                subtitle={[
                  clientName(a.client),
                  a.overpaid_xaf ? t('audit.atStake', { amount: xaf(a.overpaid_xaf), defaultValue: `enjeu ${xaf(a.overpaid_xaf)}` }) : null,
                  waited(a.submitted_at, i18n.language || 'fr'),
                ].filter(Boolean).join(' · ')}
                trailing={
                  a.mine ? <StatusPill tone="info" label={t('review.mine', { defaultValue: 'À vous' })} />
                  : a.claimed_by ? <StatusPill tone="neutral" label={t('review.taken', { defaultValue: 'Pris' })} />
                  : <StatusPill tone="pending" label={t('review.toTake', { defaultValue: 'À prendre' })} />
                }
                onClick={() => navigate(`/m/douane/audit/${a.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <SectionTitle>{t('review.recentTitle', { defaultValue: 'Signés récemment' })}</SectionTitle>
          <div className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
            {recent.slice(0, 8).map((r) => (
              <ListRow
                key={r.id}
                title={r.label}
                subtitle={[r.ref, r.final_code ? formatHs(r.final_code) : null, r.kind === 'audit' && r.amount_xaf != null ? xaf(r.amount_xaf) : null].filter(Boolean).join(' · ')}
                trailing={r.status === 'needs_info'
                  ? <StatusPill tone="pending" label={t('files.status.needs_info', { defaultValue: 'Précision demandée' })} />
                  : <StatusPill tone="success" label={t('review.signedShort', { defaultValue: 'Signé' })} />}
                onClick={() => navigate(r.kind === 'audit' ? `/m/douane/audit/${r.id}` : `/m/douane/revue/${r.id}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
