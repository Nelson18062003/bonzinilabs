// ============================================================
// Un audit de DAU — /douane/audit/:id (client connecté).
// La lecture (une à trois minutes), puis le rapport : ce qui se réclame, ce
// qui se gagne en corrigeant le code, ce qui expose à un redressement — et
// l'envoi au commissionnaire agréé, qui rend l'avis qui compte.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, FileText, Hourglass, RefreshCw, ScanLine, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet, Button, Card, Holder, Line, ScreenError, ScreenLoader, TEXT, TYPE } from '@/mobile/designKit';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import { useAudit, useCancelAudit, useMyAuditFileUrls, useReadDau, useSaveFindings, useSubmitAudit } from '@/hooks/useCustomsAudits';
import { auditOpen } from '@/lib/customs/files';
import { CustomsShell } from './shared';
import { AuditArticles, AuditSummary, AuditVerdict } from './components/AuditReport';
import { AuditStatusPill } from './AuditHomePage';
import { useAuditResult } from './useAuditResult';

const SIMULATE = '/douane/simulateur';
const STALE_MS = 7 * 60_000;

/** L'assistant lit : une attente dite, pas un sablier muet. */
export function ReadingCard({ stale, onRetry, retrying }: { stale: boolean; onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation('customs');
  return (
    <Card className="space-y-3 p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] dark:bg-[#383838]">
          {!stale && <span className="absolute inset-0 animate-ping rounded-full bg-[#2C6ECB]/20" aria-hidden />}
          <ScanLine className={cn('h-5 w-5', TEXT.strong)} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>
            {stale ? t('audit.readingSlow', { defaultValue: 'La lecture prend plus de temps que prévu' }) : t('audit.reading', { defaultValue: 'L’assistant lit votre déclaration…' })}
          </p>
          <p className={cn(TYPE.body, TEXT.muted)}>
            {stale ? t('audit.readingSlowDesc', { defaultValue: 'Relancez-la : les pièces sont gardées.' }) : t('audit.readingDesc', { defaultValue: 'Article par article : une à trois minutes. Vous pouvez quitter cet écran.' })}
          </p>
        </div>
      </div>
      {stale && <Button variant="neutral" className="w-full" loading={retrying} onClick={onRetry}><RefreshCw aria-hidden /> {t('audit.retryRead', { defaultValue: 'Relancer la lecture' })}</Button>}
    </Card>
  );
}

export function AuditPage() {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const { id } = useParams();
  const q = useAudit(id);
  const nom = useCustomsNomenclature();
  const read = useReadDau(id);
  const save = useSaveFindings(id);
  const submit = useSubmitAudit(id);
  const cancel = useCancelAudit(id);
  const docs = useMyAuditFileUrls(q.data?.file_paths);
  const report = useAuditResult(q.data, nom.data);
  const [sheet, setSheet] = useState<'submit' | 'cancel' | null>(null);
  const saved = useRef<string | null>(null);

  const a = q.data;

  // Les constats du moteur rejoignent la fiche une fois par lecture (la file du CAD et la liste du client les montrent).
  useEffect(() => {
    if (!a || !report || a.status !== 'read' || a.overpaid_xaf != null || saved.current === a.updated_at) return;
    saved.current = a.updated_at;
    const { totals, findings } = report.result;
    save.mutate({ findings, paid: totals.paid, savings: totals.claimable + totals.reclassify });
  }, [a, report, save]);

  const shell = (children: ReactNode) => (
    <CustomsShell title={a?.dau_number ?? t('audit.homeTitle', { defaultValue: 'Vérifier une déclaration' })} subtitle={a?.ref} backTo="/douane/audit">
      {children}
    </CustomsShell>
  );

  if (q.isLoading) return shell(<ScreenLoader />);
  if (q.isError || !a) return shell(<ScreenError description={(q.error as Error | null)?.message} onRetry={() => q.refetch()} />);

  const stale = a.status === 'reading' && Date.now() - Date.parse(a.updated_at) > STALE_MS;
  const relaunch = () => read.mutate(undefined, { onError: (e) => toast.error((e as Error).message) });

  return shell(
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-12 pt-3">
      {a.status === 'reviewed' && (
        <AuditVerdict note={a.broker_note} recoverable={a.recoverable_xaf} company={a.broker_company} license={a.broker_license_no} at={a.reviewed_at} />
      )}
      {(a.status === 'submitted' || a.status === 'in_review') && (
        <Card className="flex gap-3 p-4">
          <Holder icon={Hourglass} tone="pending" size="sm" />
          <div className="min-w-0 space-y-1">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.atBroker', { defaultValue: 'Chez le commissionnaire agréé' })}</p>
            <p className={cn(TYPE.body, TEXT.muted)}>{t('audit.atBrokerDesc', { defaultValue: 'Il relit la déclaration et les constats. Vous serez notifié quand il aura rendu son avis : ce qui est récupérable, et comment.' })}</p>
          </div>
        </Card>
      )}
      {a.status === 'cancelled' && <AuditStatusPill status="cancelled" />}

      {a.status === 'reading' && <ReadingCard stale={stale} onRetry={relaunch} retrying={read.isPending} />}
      {(a.status === 'failed' || a.status === 'uploaded') && (
        <Card className="space-y-3 p-5">
          <div className="flex gap-3">
            <Holder icon={a.status === 'failed' ? AlertTriangle : ScanLine} tone={a.status === 'failed' ? 'danger' : 'neutral'} size="sm" />
            <div className="min-w-0 space-y-1">
              <p className={cn(TYPE.bodyStrong, TEXT.strong)}>
                {a.status === 'failed' ? t('audit.failedTitle', { defaultValue: 'La lecture n’a pas abouti' }) : t('audit.notStarted', { defaultValue: 'La lecture n’a pas démarré' })}
              </p>
              {a.error && <Line>{a.error}</Line>}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" loading={read.isPending} onClick={relaunch}><RefreshCw aria-hidden /> {t('audit.retryRead', { defaultValue: 'Relancer la lecture' })}</Button>
            <Button variant="neutral" className="flex-1" onClick={() => setSheet('submit')}><Send aria-hidden /> {t('audit.sendDirect', { defaultValue: 'Envoyer au commissionnaire' })}</Button>
          </div>
        </Card>
      )}

      {report ? (
        <>
          <AuditSummary result={report.result} ext={report.ext} />
          {a.status === 'read' && (
            <Card className="space-y-3 p-4">
              <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.submitTitle', { defaultValue: 'Faites confirmer par un commissionnaire agréé' })}</p>
              <p className={cn(TYPE.body, TEXT.muted)}>{t('audit.submitDesc', { defaultValue: 'Le moteur signale ; le commissionnaire vérifie la marchandise, la mainlevée et les textes, puis vous dit ce qui est récupérable et comment le demander.' })}</p>
              <Button className="w-full" onClick={() => setSheet('submit')}><Send aria-hidden /> {t('audit.submitCta', { defaultValue: 'Faire relire par un commissionnaire agréé' })}</Button>
            </Card>
          )}
          <AuditArticles result={report.result} ext={report.ext} simulateBase={SIMULATE} />
        </>
      ) : a.extraction && nom.isLoading ? (
        <ScreenLoader className="min-h-0 py-10" />
      ) : null}

      {docs.data && docs.data.length > 0 && (
        <Card className="space-y-1 p-4">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('audit.documents', { defaultValue: 'Les pièces déposées' })}</p>
          <ul>
            {docs.data.map((d, i) => (
              <li key={d.path}>
                <a href={d.url} target="_blank" rel="noreferrer" className={cn('flex min-h-11 items-center gap-3 rounded-lg py-2', TEXT.body)}>
                  <FileText aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                  <span className={cn('min-w-0 flex-1 truncate underline-offset-2 hover:underline', TYPE.body)}>
                    {t('audit.document', { n: i + 1, defaultValue: `Pièce ${i + 1}` })} · {d.path.split('.').pop()?.toUpperCase()}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {a.status !== 'reviewed' && a.status !== 'cancelled' && (
        <Button variant="dangerSubtle" size="sm" className="w-full" onClick={() => setSheet('cancel')}>{t('audit.cancelCta', { defaultValue: 'Abandonner cette vérification' })}</Button>
      )}

      <BottomSheet open={sheet === 'submit'} onClose={() => setSheet(null)} title={t('audit.submitSheetTitle', { defaultValue: 'Envoyer au commissionnaire ?' })}>
        <div className="space-y-4">
          <Line>{t('audit.submitSheet', { defaultValue: 'Il reçoit la déclaration, la lecture et les constats. Il vous répond par un avis signé : le montant récupérable, la démarche et son délai.' })}</Line>
          <Button className="w-full" loading={submit.isPending} disabled={!auditOpen(a.status)} onClick={() => submit.mutate(undefined, {
            onSuccess: () => { setSheet(null); toast.success(t('audit.submitted', { defaultValue: 'Déclaration envoyée au commissionnaire' })); },
            onError: (e) => toast.error((e as Error).message),
          })}>
            <Send aria-hidden /> {t('files.submitConfirm', { defaultValue: 'Envoyer' })}
          </Button>
          <Button variant="subtle" className="w-full" onClick={() => setSheet(null)}>{t('files.keep', { defaultValue: 'Pas maintenant' })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title={t('audit.cancelSheetTitle', { defaultValue: 'Abandonner la vérification ?' })}>
        <div className="space-y-4">
          <Line>{t('audit.cancelSheet', { defaultValue: 'Elle disparaît de votre liste. Les pièces restent dans votre dossier.' })}</Line>
          <Button variant="danger" className="w-full" loading={cancel.isPending} onClick={() => cancel.mutate(undefined, {
            onSuccess: () => navigate('/douane/audit'),
            onError: (e) => toast.error((e as Error).message),
          })}>
            {t('files.cancelConfirm', { defaultValue: 'Abandonner' })}
          </Button>
          <Button variant="subtle" className="w-full" onClick={() => setSheet(null)}>{t('files.keep', { defaultValue: 'Pas maintenant' })}</Button>
        </div>
      </BottomSheet>
    </div>,
  );
}

export default AuditPage;
