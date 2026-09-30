// ============================================================
// La relecture d'un audit de DAU — /m/douane/audit/:id (espace équipe).
// Le commissionnaire agréé prend l'audit, lit la déclaration et les constats
// du moteur, puis rend son avis signé : le montant récupérable et la démarche.
// Le reste de l'équipe (canViewCustoms) lit, et peut relancer une lecture.
// Session `supabaseAdmin` uniquement (useCustomsReview).
// ============================================================
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BadgeCheck, FileText, Hand, Lock, RefreshCw, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button, Card, FormField, Holder, Line, Row, ScreenError, ScreenLoader, TextArea, TextInput, TEXT, TYPE } from '@/mobile/designKit';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import {
  useAdminAudit, useAdminReadDau, useClaimAudit, useCustomsDocumentUrls, useCustomsReviewQueue, useReviewAudit,
} from '@/hooks/useCustomsReview';
import { CustomsShell } from './shared';
import { AuditArticles, AuditSummary, AuditVerdict, ReadingCard } from './components/AuditReport';
import { AuditStatusPill } from './AuditHomePage';
import { useAuditResult } from './useAuditResult';
import { xaf } from './format';

const SIMULATE = '/m/douane/simulateur';

export function AuditReviewPage({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('customs');
  const { hasPermission, currentUser } = useAdminAuth();
  const { id } = useParams();
  const q = useAdminAudit(id);
  const queue = useCustomsReviewQueue(hasPermission('canViewCustoms'));
  const nom = useCustomsNomenclature();
  const docs = useCustomsDocumentUrls(q.data?.file_paths);
  const claim = useClaimAudit(id);
  const review = useReviewAudit(id);
  const read = useAdminReadDau(id);
  const report = useAuditResult(q.data, nom.data);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [tried, setTried] = useState(false);

  const a = q.data;
  const shell = (children: ReactNode) => (
    <CustomsShell title={a?.dau_number ?? t('audit.reviewTitle', { defaultValue: 'Relecture de la déclaration' })} subtitle={a?.ref} backTo="/m/douane" variant="admin" desktop={desktop}>
      {children}
    </CustomsShell>
  );
  if (q.isLoading) return shell(<ScreenLoader />);
  if (q.isError || !a) return shell(<ScreenError description={(q.error as Error | null)?.message} onRetry={() => q.refetch()} />);

  const canSign = hasPermission('canSignCustoms');
  const isBroker = queue.data?.is_broker === true;
  const waiting = a.status === 'submitted' || a.status === 'in_review';
  const claimedByOther = !!a.claimed_by && a.claimed_by !== currentUser?.id;
  const mine = a.status === 'in_review' && a.claimed_by === currentUser?.id;
  const who = a.client?.company_name || [a.client?.first_name, a.client?.last_name].filter(Boolean).join(' ') || '—';
  const stale = a.status === 'reading' && Date.now() - Date.parse(a.updated_at) > 7 * 60_000;

  const digits = amount.replace(/\D/g, '');
  const recoverable = digits ? Number(digits) : null;
  const amountError = recoverable != null && !Number.isSafeInteger(recoverable) ? t('audit.amountInvalid', { defaultValue: 'Montant invalide' }) : null;
  const noteError = tried && !note.trim() ? t('audit.noteRequired', { defaultValue: 'Votre avis est requis : la démarche, le délai, les pièces.' }) : null;
  const relaunch = () => read.mutate(undefined, { onError: (e) => toast.error((e as Error).message) });

  const sign = () => {
    setTried(true);
    if (!note.trim() || amountError) return;
    review.mutate({ note: note.trim(), recoverable }, {
      onSuccess: () => toast.success(t('audit.reviewed', { defaultValue: 'Avis rendu : le client est prévenu' })),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return shell(
    <div className={cn('mx-auto space-y-5 px-4 pb-12 pt-3', desktop ? 'max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-6 lg:space-y-0' : 'max-w-2xl')}>
      <div className="min-w-0 space-y-5">
        <Card className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Holder icon={UserRound} size="sm" />
              <div className="min-w-0">
                <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{who}</p>
                {a.client?.customer_code && <p className={cn(TYPE.small, 'tabular-nums', TEXT.muted)}>{a.client.customer_code}</p>}
              </div>
            </div>
            <AuditStatusPill status={a.status} />
          </div>
          {a.paid_on && <Row label={t('audit.paidOnLabelShort', { defaultValue: 'Payée le' })} value={new Date(`${a.paid_on}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })} />}
          {a.overpaid_xaf != null && <Row label={t('audit.engineStake', { defaultValue: 'Enjeu estimé par le moteur' })} value={xaf(a.overpaid_xaf)} />}
        </Card>

        {a.status === 'reviewed' && <AuditVerdict note={a.broker_note} recoverable={a.recoverable_xaf} company={a.broker_company} license={a.broker_license_no} at={a.reviewed_at} />}
        {a.status === 'reading' && <ReadingCard stale={stale} onRetry={relaunch} retrying={read.isPending} />}
        {(a.status === 'failed' || a.status === 'uploaded') && (
          <Card className="space-y-3 p-4">
            <Line tone={a.status === 'failed' ? 'bad' : undefined}>{a.error ?? t('audit.notStarted', { defaultValue: 'La lecture n’a pas démarré' })}</Line>
            <Button variant="neutral" loading={read.isPending} onClick={relaunch}><RefreshCw aria-hidden /> {t('audit.retryRead', { defaultValue: 'Relancer la lecture' })}</Button>
          </Card>
        )}

        {report ? (
          <>
            <AuditSummary result={report.result} ext={report.ext} />
            <AuditArticles result={report.result} ext={report.ext} simulateBase={SIMULATE} />
          </>
        ) : a.extraction && nom.isLoading ? <ScreenLoader className="min-h-0 py-10" /> : null}

        {docs.data && docs.data.length > 0 && (
          <Card className="space-y-1 p-4">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.documents', { defaultValue: 'Les pièces déposées' })}</p>
            {docs.data.map((d, i) => (
              <a key={d.path} href={d.url} target="_blank" rel="noreferrer" className={cn('flex min-h-11 items-center gap-3 py-2', TEXT.body)}>
                <FileText aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                <span className={cn('min-w-0 flex-1 truncate hover:underline', TYPE.body)}>{t('audit.document', { n: i + 1, defaultValue: `Pièce ${i + 1}` })} · {d.path.split('.').pop()?.toUpperCase()}</span>
              </a>
            ))}
          </Card>
        )}
      </div>

      <div className={cn('min-w-0 space-y-4', desktop && 'lg:sticky lg:top-4 lg:self-start')}>
        {!waiting ? (
          a.status !== 'reviewed' && (
            <Card className="p-4"><Line>{t('audit.notSubmitted', { defaultValue: 'Le client n’a pas encore envoyé cette déclaration au commissionnaire.' })}</Line></Card>
          )
        ) : !canSign ? (
          <Card className="flex gap-3 p-4"><Holder icon={Lock} size="sm" /><Line>{t('audit.readOnly', { defaultValue: 'Seul un commissionnaire agréé en douane rend l’avis. Vous voyez l’audit en lecture.' })}</Line></Card>
        ) : !isBroker && queue.isSuccess ? (
          <Card className="p-4"><Line tone="warn">{t('review.noLicense')}</Line></Card>
        ) : claimedByOther ? (
          <Card className="flex gap-3 p-4"><Holder icon={Lock} size="sm" /><Line>{t('audit.claimedByOther', { defaultValue: 'Un autre commissionnaire relit cet audit.' })}</Line></Card>
        ) : !mine ? (
          <Card className="space-y-3 p-4">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.claimTitle', { defaultValue: 'Prendre l’audit' })}</p>
            <Line>{t('audit.claimDesc', { defaultValue: 'Il quitte la file des autres commissionnaires. Vous rendrez ensuite votre avis au client.' })}</Line>
            <Button className="w-full" loading={claim.isPending} onClick={() => claim.mutate(undefined, { onError: (e) => toast.error((e as Error).message) })}>
              <Hand aria-hidden /> {t('audit.claimCta', { defaultValue: 'Je prends cet audit' })}
            </Button>
          </Card>
        ) : (
          <Card className="space-y-4 p-4">
            <p className={cn(TYPE.lead, TEXT.strong)}>{t('audit.verdictForm', { defaultValue: 'Votre avis' })}</p>
            {report && (report.result.totals.claimable > 0 || report.result.totals.reclassify > 0) && (
              <div className="space-y-2">
                <p className={cn(TYPE.small, TEXT.muted)}>{t('audit.engineSays', { defaultValue: 'Le moteur propose :' })}</p>
                <div className="flex flex-wrap gap-2">
                  {report.result.totals.claimable > 0 && (
                    <Button size="sm" variant="neutral" onClick={() => setAmount(String(report.result.totals.claimable))}>
                      {t('audit.claimable', { defaultValue: 'Réclamable' })} · {xaf(report.result.totals.claimable)}
                    </Button>
                  )}
                  {report.result.totals.reclassify > 0 && (
                    <Button size="sm" variant="neutral" onClick={() => setAmount(String(report.result.totals.claimable + report.result.totals.reclassify))}>
                      {t('audit.withReclassify', { defaultValue: 'Avec reclassement' })} · {xaf(report.result.totals.claimable + report.result.totals.reclassify)}
                    </Button>
                  )}
                </div>
              </div>
            )}
            <FormField label={t('audit.recoverableLabel', { defaultValue: 'Montant récupérable (XAF)' })} htmlFor="au-recoverable" error={amountError}
              hint={t('audit.recoverableHint', { defaultValue: 'Ce que le client peut réellement obtenir, selon vous. Vide si rien.' })}>
              <TextInput id="au-recoverable" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </FormField>
            <FormField label={t('audit.noteLabel', { defaultValue: 'Votre avis au client' })} htmlFor="au-note" error={noteError}
              hint={t('audit.noteHint', { defaultValue: 'La démarche (réclamation, retrait avant mainlevée, prochains conteneurs), le délai, les pièces à réunir.' })}>
              <TextArea id="au-note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
            </FormField>
            <p className={cn(TYPE.small, TEXT.muted)}>{t('review.signNotice')}</p>
            <Button className="w-full" loading={review.isPending} onClick={sign}><BadgeCheck aria-hidden /> {t('audit.signCta', { defaultValue: 'Rendre l’avis' })}</Button>
          </Card>
        )}
      </div>
    </div>,
  );
}

export default AuditReviewPage;
