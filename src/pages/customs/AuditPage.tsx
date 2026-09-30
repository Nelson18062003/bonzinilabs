// ============================================================
// Un audit de DAU — /douane/audit/:id (client connecté).
// La lecture (une à trois minutes), puis le rapport : ce qui se réclame, ce
// qui se gagne en corrigeant le code, ce qui expose à un redressement — et
// l'envoi au commissionnaire agréé, qui rend l'avis qui compte.
//
// Ordinateur : le rapport à gauche ; les sommes et la seule action utile à
// droite, toujours visibles. Téléphone : l'état, les sommes, l'action, puis
// le détail article par article.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, FileText, Hourglass, Loader2, RefreshCw, ScanLine, Send } from 'lucide-react';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import { useAudit, useCancelAudit, useMyAuditFileUrls, useReadDau, useSaveFindings, useSubmitAudit } from '@/hooks/useCustomsAudits';
import { AUDIT_STATUS, auditOpen, type AuditRecord as Audit } from '@/lib/customs/files';
import { useAuditResult } from './useAuditResult';
import { SiteLayout } from './site/SiteLayout';
import { AuditArticleList, AuditRoutes, AuditTotals, AuditVerdictCard } from './site/audit/Report';
import { Button, ButtonLink, Container, Disclosure, PageIntro, Sheet, StatusBadge } from './site/ui';

const SIMULATE = '/douane/simulateur';
const STALE_MS = 7 * 60_000;

function Shell({ a, children }: { a?: Audit; children: ReactNode }) {
  const { t } = useTranslation('customs');
  const meta = a ? AUDIT_STATUS[a.status] : null;
  return (
    <SiteLayout>
      <PageIntro title={a?.dau_number ?? t('audit.homeTitle')} subtitle={a?.ref} back={{ to: '/douane/audit', label: t('audit.homeTitle') }}
        actions={a && meta ? <StatusBadge tone={meta.tone}>{t(`audit.status.${a.status}`, { defaultValue: meta.fr })}</StatusBadge> : undefined} />
      <Container className="pb-16">{children}</Container>
    </SiteLayout>
  );
}

/** L'assistant lit : une attente dite, avec une barre qui avance — pas un sablier muet. */
function Reading({ stale, onRetry, retrying }: { stale: boolean; onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation('customs');
  const reduce = useReducedMotion();
  return (
    <div role="status" aria-live="polite" className="overflow-hidden rounded-[28px] bg-dz-card">
      <div className="flex gap-4 p-5 sm:p-6">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dz-brand-soft text-dz-brand">
          {!stale && !reduce && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-dz-brand/15" />}
          <ScanLine aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold">{stale ? t('audit.readingSlow') : t('audit.reading')}</p>
          <p className="mt-1 text-[15px] leading-snug text-dz-ink3">{stale ? t('audit.readingSlowDesc') : t('audit.readingDesc')}</p>
          {stale && (
            <Button className="mt-4" variant="secondary" disabled={retrying} onClick={onRetry}>
              {retrying ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} {t('audit.retryRead')}
            </Button>
          )}
        </div>
      </div>
      {!stale && (
        <div aria-hidden className="h-1 overflow-hidden bg-dz-soft">
          <motion.div className="h-full w-1/3 rounded-full bg-dz-brand"
            initial={{ x: '-100%' }} animate={reduce ? { x: '100%' } : { x: ['-100%', '300%'] }}
            transition={reduce ? { duration: 0 } : { duration: 1.6, ease: 'easeInOut', repeat: Infinity }} />
        </div>
      )}
    </div>
  );
}

/** Ce qui arrive au dossier, en une carte : l'avis, l'attente, la lecture, l'échec. */
function StateCard({ a, stale, onRelaunch, relaunching, onSubmit }: {
  a: Audit; stale: boolean; onRelaunch: () => void; relaunching: boolean; onSubmit: () => void;
}) {
  const { t } = useTranslation('customs');
  switch (a.status) {
    case 'reviewed':
      return <AuditVerdictCard note={a.broker_note} recoverable={a.recoverable_xaf} company={a.broker_company} license={a.broker_license_no} at={a.reviewed_at} />;
    case 'submitted':
    case 'in_review':
      return (
        <div className="flex gap-4 rounded-3xl bg-dz-warn-soft p-5 sm:p-6">
          <Hourglass aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-dz-warn" />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold">{t('audit.atBroker')}</p>
            <p className="mt-1 text-[15px] leading-snug text-dz-ink2">{t('audit.atBrokerDesc')}</p>
          </div>
        </div>
      );
    case 'reading':
      return <Reading stale={stale} onRetry={onRelaunch} retrying={relaunching} />;
    case 'failed':
    case 'uploaded': {
      const failed = a.status === 'failed';
      return (
        <div className="rounded-[28px] bg-dz-card p-5 sm:p-6">
          <div className="flex gap-4">
            <span className={failed ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dz-bad/10 text-dz-bad' : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dz-soft text-dz-ink2'}>
              {failed ? <AlertTriangle aria-hidden className="h-5 w-5" /> : <ScanLine aria-hidden className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[17px] font-semibold">{failed ? t('audit.failedTitle') : t('audit.notStarted')}</p>
              {a.error && <p className="mt-1 break-words text-[15px] leading-snug text-dz-ink3">{a.error}</p>}
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button disabled={relaunching} onClick={onRelaunch}>
              {relaunching ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} {t('audit.retryRead')}
            </Button>
            <Button variant="secondary" onClick={onSubmit}><Send aria-hidden /> {t('audit.sendDirect')}</Button>
          </div>
        </div>
      );
    }
    case 'cancelled':
      return (
        <div className="rounded-[28px] bg-dz-card p-5 sm:p-6">
          <p className="text-[17px] font-semibold">{t('audit.status.cancelled')}</p>
          <ButtonLink to="/douane/audit" variant="secondary" className="mt-4">{t('audit.newTitle')}</ButtonLink>
        </div>
      );
    default:
      return null;
  }
}

/** La seule action utile quand le rapport est prêt : le faire confirmer. */
function SubmitCard({ onSubmit }: { onSubmit: () => void }) {
  const { t } = useTranslation('customs');
  return (
    <div className="rounded-[28px] bg-dz-card p-5 sm:p-6">
      <p className="text-[17px] font-semibold leading-snug">{t('audit.submitTitle')}</p>
      <p className="mt-1.5 text-[15px] leading-snug text-dz-ink3">{t('audit.submitDesc')}</p>
      <Button size="lg" className="mt-5 h-auto min-h-14 w-full whitespace-normal py-3" onClick={onSubmit}>
        <Send aria-hidden /> {t('audit.submitCta')}
      </Button>
    </div>
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

  if (q.isLoading) {
    return (
      <Shell>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10" aria-busy="true">
          <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-[28px] bg-dz-fill" />)}</div>
          <div className="hidden h-72 animate-pulse rounded-[28px] bg-dz-fill lg:block" />
        </div>
      </Shell>
    );
  }
  if (q.isError || !a) {
    return (
      <Shell>
        <div className="max-w-[640px] rounded-[28px] bg-dz-card p-6">
          <p className="text-[16px]">{(q.error as Error | null)?.message}</p>
          <Button className="mt-4" variant="secondary" onClick={() => { void q.refetch(); }}>{t('site.retry')}</Button>
        </div>
      </Shell>
    );
  }

  const stale = a.status === 'reading' && Date.now() - Date.parse(a.updated_at) > STALE_MS;
  const relaunch = () => read.mutate(undefined, { onError: (e) => toast.error((e as Error).message) });
  const canCancel = a.status !== 'reviewed' && a.status !== 'cancelled';
  const state = <StateCard a={a} stale={stale} onRelaunch={relaunch} relaunching={read.isPending} onSubmit={() => setSheet('submit')} />;
  const cancelLink = (className?: string) => canCancel && (
    <button type="button" onClick={() => setSheet('cancel')} className={cn('py-3 text-[15px] font-medium text-dz-bad hover:underline', className)}>{t('audit.cancelCta')}</button>
  );

  const documents = docs.data && docs.data.length > 0 && (
    <div className="rounded-[28px] bg-dz-card px-5 sm:px-6">
      <Disclosure title={t('audit.documents')} meta={<span className="tabular-nums">{docs.data.length}</span>}>
        <ul>
          {docs.data.map((d, i) => (
            <li key={d.path} className="border-b border-dz-line last:border-b-0">
              <a href={d.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 py-2 text-[15px] text-dz-ink2 hover:text-dz-ink">
                <FileText aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
                <span className="min-w-0 flex-1 truncate underline-offset-2 hover:underline">
                  {t('audit.document', { n: i + 1 })} · {d.path.split('.').pop()?.toUpperCase()}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );

  const sheets = (
    <>
      <Sheet open={sheet === 'submit'} onClose={() => setSheet(null)} title={t('audit.submitSheetTitle')}>
        <p className="text-[16px] leading-relaxed text-dz-ink2">{t('audit.submitSheet')}</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" disabled={submit.isPending || !auditOpen(a.status)} onClick={() => submit.mutate(undefined, {
            onSuccess: () => { setSheet(null); toast.success(t('audit.submitted')); },
            onError: (e) => toast.error((e as Error).message),
          })}>
            {submit.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} {t('files.submitConfirm')}
          </Button>
          <Button variant="ghost" onClick={() => setSheet(null)}>{t('files.keep')}</Button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title={t('audit.cancelSheetTitle')}>
        <p className="text-[16px] leading-relaxed text-dz-ink2">{t('audit.cancelSheet')}</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" className="bg-dz-bad text-white hover:bg-dz-bad/90" disabled={cancel.isPending} onClick={() => cancel.mutate(undefined, {
            onSuccess: () => navigate('/douane/audit'),
            onError: (e) => toast.error((e as Error).message),
          })}>{t('files.cancelConfirm')}</Button>
          <Button variant="ghost" onClick={() => setSheet(null)}>{t('files.keep')}</Button>
        </div>
      </Sheet>
    </>
  );

  // Pas encore de rapport : une seule colonne, l'état et les pièces.
  if (!report) {
    return (
      <Shell a={a}>
        <div className="max-w-[720px] space-y-4">
          {state}
          {!!a.extraction && nom.isLoading && <div className="h-48 animate-pulse rounded-[28px] bg-dz-fill" aria-busy="true" />}
          {documents}
          {cancelLink('px-1')}
        </div>
        {sheets}
      </Shell>
    );
  }

  const totals = <AuditTotals result={report.result} ext={report.ext} />;
  const cta = a.status === 'read' && <SubmitCard onSubmit={() => setSheet('submit')} />;

  return (
    <Shell a={a}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <div className="min-w-0 space-y-5">
          {a.status !== 'read' && state}
          <div className="space-y-4 lg:hidden">{totals}{cta}</div>
          <AuditRoutes result={report.result} ext={report.ext} />
          <AuditArticleList result={report.result} ext={report.ext} simulateBase={SIMULATE} />
          {documents}
          <div className="lg:hidden">{cancelLink('w-full text-center')}</div>
        </div>
        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
          {totals}
          {cta}
          {cancelLink('w-full text-center')}
        </aside>
      </div>
      {sheets}
    </Shell>
  );
}

export default AuditPage;
