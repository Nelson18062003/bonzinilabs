/**
 * Relecture d'une DAU — refonte v2 (maquette 10/54). Le client, l'enjeu
 * estimé par le moteur, les pièces, le montant récupérable (avec les valeurs
 * proposées), l'avis au client, un bouton noir « Rendre l'avis » confirmé par
 * une feuille portant la même ligne rouge que la signature d'un classement.
 * « … » : le rapport du moteur, relancer la lecture, prendre l'audit.
 * Gardes inchangées : canSignCustoms + agrément, audit pris par soi ; le
 * montant passe Number.isSafeInteger avant l'envoi (customs_audit_review).
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Hand, RefreshCw, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import {
  useAdminAudit, useAdminReadDau, useClaimAudit, useCustomsDocumentUrls, useCustomsReviewQueue, useReviewAudit,
} from '@/hooks/useCustomsReview';
import type { AuditRecord } from '@/lib/customs/files';
import { cn } from '@/lib/utils';
import { AuditArticles, AuditSummary, AuditVerdict, ReadingCard } from '@/pages/customs/components/AuditReport';
import { useAuditResult } from '@/pages/customs/useAuditResult';
import {
  ActionSheet, BigButton, BottomSheet, Chip, ConfirmSheet, Dock, EmptyLine, FOCUS_RING, HeroFigure, Initials, MoreButton, ScreenLoader, ScreenTop,
  SuccessView, SURFACE, Tag, TEXT, TextArea, useSheet,
} from '@/mobile/designKit';
import { CapsLabel, RedNotice } from '@/mobile/screens/more/parts';
import { clientFirst, clientName, millions, nb } from './shared';
import { nextInQueue } from './CustomsHomeV2';

const SIMULATE = '/m/douane/simulateur';

export function AuditV2() {
  const { id } = useParams();
  return <AuditRoute key={id} id={id} />;
}

function AuditRoute({ id }: { id: string | undefined }) {
  const q = useAdminAudit(id);
  const [done, setDone] = useState<{ first: string; amount: number | null } | null>(null);
  if (done) return <Reviewed done={done} currentId={id} />;
  if (q.isLoading) return <><ScreenTop title="Relecture de la DAU" backTo="/m/douane" /><ScreenLoader /></>;
  if (q.isError || !q.data) {
    return (
      <>
        <ScreenTop title="Relecture de la DAU" backTo="/m/douane" />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void q.refetch() }}>L'audit n'a pas pu être chargé.</EmptyLine>
      </>
    );
  }
  return <Audit a={q.data} onDone={setDone} />;
}

const paidLabel = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null);

function Audit({ a, onDone }: { a: AuditRecord; onDone: (d: { first: string; amount: number | null }) => void }) {
  const { hasPermission, currentUser } = useAdminAuth();
  const queue = useCustomsReviewQueue(hasPermission('canViewCustoms'));
  const nom = useCustomsNomenclature();
  const docs = useCustomsDocumentUrls(a.file_paths);
  const claim = useClaimAudit(a.id);
  const review = useReviewAudit(a.id);
  const read = useAdminReadDau(a.id);
  const report = useAuditResult(a, nom.data);
  const more = useSheet();
  const confirm = useSheet();
  const reportSheet = useSheet();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const canSign = hasPermission('canSignCustoms');
  const isBroker = queue.data?.is_broker === true;
  const waiting = a.status === 'submitted' || a.status === 'in_review';
  const claimedByOther = !!a.claimed_by && a.claimed_by !== currentUser?.id;
  const mine = a.status === 'in_review' && a.claimed_by === currentUser?.id;
  const stale = a.status === 'reading' && Date.now() - Date.parse(a.updated_at) > 7 * 60_000;
  const canRead = a.status === 'failed' || a.status === 'uploaded' || stale;
  const mayAct = waiting && canSign && (isBroker || !queue.isSuccess) && !claimedByOther;

  const digits = amount.replace(/\D/g, '');
  const recoverable = digits ? Number(digits) : null;
  const amountError = recoverable != null && !Number.isSafeInteger(recoverable) ? 'Montant invalide' : null;
  const noteError = tried && !note.trim() ? 'Votre avis est requis.' : null;
  const claimable = report?.result.totals.claimable ?? 0;
  const reclass = report?.result.totals.reclassify ?? 0;

  const relaunch = () => read.mutate(undefined, { onError: (e) => toast.error((e as Error).message) });
  const tryOpen = () => {
    setTried(true);
    if (!note.trim() || amountError) return;
    confirm.show();
  };
  const submit = () => {
    if (recoverable != null && !Number.isSafeInteger(recoverable)) return;
    review.mutate({ note: note.trim(), recoverable }, {
      onSuccess: () => { confirm.hide(); onDone({ first: clientFirst(a.client), amount: recoverable }); },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const sub = [a.dau_number ? `DAU ${a.dau_number}` : a.ref, paidLabel(a.paid_on) ? `payée le ${paidLabel(a.paid_on)}` : null].filter(Boolean).join(' · ');

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Relecture de la DAU" backTo="/m/douane" right={<MoreButton onClick={more.show} />} />
      <div className="space-y-4 px-5 pb-6 pt-5">
        <div className={cn('flex items-center gap-3.5 rounded-lg border px-4 py-3.5', SURFACE.divider)}>
          <Initials name={clientName(a.client)} size={52} />
          <span className="min-w-0">
            <span className={cn('block truncate text-[18px] font-semibold', TEXT.strong)}>{clientName(a.client)}</span>
            <span className={cn('block truncate text-[16px]', TEXT.muted)}>{sub}</span>
          </span>
        </div>

        {a.overpaid_xaf != null && (
          <HeroFigure
            label="Enjeu estimé par le moteur"
            value={nb(a.overpaid_xaf)}
            unit="XAF"
            sub={claimable > 0 || reclass > 0 ? [<span className="inline-flex items-center gap-3">Le moteur propose <Tag tone="success">{claimable > 0 ? 'Réclamable' : 'Reclasser'}</Tag></span>] : undefined}
          />
        )}

        {a.status === 'reviewed' && <AuditVerdict note={a.broker_note} recoverable={a.recoverable_xaf} company={a.broker_company} license={a.broker_license_no} at={a.reviewed_at} />}
        {a.status === 'reading' && <ReadingCard stale={stale} onRetry={relaunch} retrying={read.isPending} />}
        {(a.status === 'failed' || a.status === 'uploaded') && (
          <EmptyLine action={{ label: 'Relancer la lecture', onClick: relaunch }}>{a.error ?? "La lecture n'a pas démarré."}</EmptyLine>
        )}

        {docs.data && docs.data.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {docs.data.map((d, i) => (
              <a key={d.path} href={d.url} target="_blank" rel="noreferrer" className={cn('flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center', SURFACE.divider, FOCUS_RING, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
                <FileText className={cn('h-7 w-7', TEXT.strong)} strokeWidth={1.9} />
                <span className={cn('w-full truncate text-[16px]', TEXT.muted)}>{docLabel(d.path, i)}</span>
              </a>
            ))}
          </div>
        )}

        {mine && (
          <>
            <div className="space-y-2 pt-2">
              <label htmlFor="au-amount"><CapsLabel>Montant récupérable</CapsLabel></label>
              <div className={cn('flex h-16 items-center gap-3 rounded-lg border px-4 focus-within:border-[#2C2C2C]', SURFACE.field, SURFACE.card)}>
                {/* eslint-disable-next-line no-restricted-syntax -- montant en grand (32 px, pas de zoom iOS) */}
                <input
                  id="au-amount"
                  inputMode="numeric"
                  value={digits ? nb(Number(digits)) : ''}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder="0"
                  className={cn('min-w-0 flex-1 bg-transparent !text-[32px] font-bold tabular-nums outline-none placeholder:text-[#B3B3B3]', TEXT.strong)}
                />
                <span className={cn('shrink-0 text-[20px] font-semibold', TEXT.muted)}>XAF</span>
              </div>
              {amountError && <p className="text-[15px] font-medium text-[#900B09]">{amountError}</p>}
              {(claimable > 0 || reclass > 0) && (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {claimable > 0 && <Chip label={`Réclamable · ${millions(claimable)}`} onClick={() => setAmount(String(claimable))} className="h-12 px-4 text-[17px]" />}
                  {reclass > 0 && <Chip label={`Reclasser · ${millions(claimable + reclass)}`} onClick={() => setAmount(String(claimable + reclass))} className="h-12 px-4 text-[17px]" />}
                </div>
              )}
            </div>
            <div className="space-y-2 pt-2">
              <label htmlFor="au-note"><CapsLabel>Votre avis au client</CapsLabel></label>
              <TextArea id="au-note" rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="La démarche, le délai, les pièces" className="px-4 py-3.5 !text-[17px] leading-relaxed" />
              {noteError && <p className="text-[15px] font-medium text-[#900B09]">{noteError}</p>}
            </div>
          </>
        )}

        {waiting && !canSign && <p className={cn('text-[16px]', TEXT.muted)}>Lecture seule : seul un commissionnaire agréé rend l'avis.</p>}
        {waiting && canSign && !isBroker && queue.isSuccess && (
          <p className="text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">Agrément non enregistré : demandez sa saisie dans votre fiche d'équipe.</p>
        )}
        {waiting && claimedByOther && <p className={cn('text-[16px]', TEXT.muted)}>Un autre commissionnaire relit cet audit.</p>}
        {!waiting && a.status !== 'reviewed' && a.status !== 'reading' && <p className={cn('text-[16px]', TEXT.muted)}>Pas encore envoyée au commissionnaire.</p>}
      </div>

      {mayAct && (
        <Dock>
          {mine
            ? <BigButton onClick={tryOpen}>Rendre l'avis</BigButton>
            : <BigButton loading={claim.isPending} onClick={() => claim.mutate(undefined, { onError: (e) => toast.error((e as Error).message) })}>Je prends cet audit</BigButton>}
        </Dock>
      )}

      <ConfirmSheet
        open={confirm.open}
        onClose={confirm.hide}
        title="Rendre l'avis ?"
        subtitle={sub}
        rows={[
          { label: 'Montant récupérable', value: recoverable != null ? `${nb(recoverable)} XAF` : 'Rien' },
          { label: 'Client prévenu', value: 'Oui' },
        ]}
        confirmLabel="Rendre l'avis"
        loading={review.isPending}
        onConfirm={submit}
      >
        <RedNotice>Engage votre agrément CAD</RedNotice>
      </ConfirmSheet>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Rapport du moteur', icon: ScrollText, onClick: reportSheet.show, hidden: !report },
          { label: 'Relancer la lecture', icon: RefreshCw, onClick: relaunch, hidden: !canRead },
          { label: 'Je prends cet audit', icon: Hand, onClick: () => claim.mutate(undefined, { onError: (e) => toast.error((e as Error).message) }), hidden: !(mayAct && !mine) },
        ]}
      />
      <BottomSheet open={reportSheet.open} onClose={reportSheet.hide} title="Rapport du moteur">
        {report && (
          <div className="space-y-4">
            <AuditSummary result={report.result} ext={report.ext} />
            <AuditArticles result={report.result} ext={report.ext} simulateBase={SIMULATE} />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/** « DAU », « Facture », « BL » quand le nom le dit ; sinon « Pièce 2 · PDF ». */
function docLabel(path: string, i: number): string {
  const name = (path.split('/').pop() ?? '').toLowerCase();
  if (/dau|declar/.test(name)) return 'DAU';
  if (/factur|invoice/.test(name)) return 'Facture';
  if (/\bbl\b|bill|connaiss|lading/.test(name)) return 'BL';
  return `Pièce ${i + 1} · ${(name.split('.').pop() ?? '').toUpperCase()}`;
}

function Reviewed({ done, currentId }: { done: { first: string; amount: number | null }; currentId?: string }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const queue = useCustomsReviewQueue(hasPermission('canViewCustoms'));
  const next = nextInQueue(queue.data?.audits ?? [], currentId);
  return (
    <SuccessView
      title="Avis rendu"
      subtitle={<>{done.amount != null ? `${nb(done.amount)} XAF récupérables` : 'Rien à récupérer'}<br />Le client est prévenu.</>}
      primary={next ? { label: `Suivant · ${next.dau_number ? `DAU ${next.dau_number}` : next.ref}`, onClick: () => navigate(`/m/douane/audit/${next.id}`) } : undefined}
      secondary={{ label: 'Retour à la file', onClick: () => navigate('/m/douane') }}
    />
  );
}
