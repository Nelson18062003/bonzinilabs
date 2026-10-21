/**
 * La fiche d'un dépôt, v2 (maquettes 02-operations/03 à 06). Un écran = une
 * décision : le logo du moyen, le montant en grand, le tag, la preuve (un
 * appui l'agrandit), Client · Solde · Référence, et UN bouton noir
 * « Créditer 850 000 XAF » qui ouvre la feuille de confirmation (montant
 * reçu modifiable, solde avant → après, Prévenir le client).
 *
 * Tout le reste est dans « … » : Vu en banque (interrupteur), En
 * vérification, Remplacer / Ajouter une preuve, Reçu PDF, Historique,
 * Refuser, et — en rouge, à part — Annuler le dépôt (super admin).
 *
 * Logique reprise telle quelle de MobileDepositDetailV2 (mêmes hooks, mêmes
 * gardes : canProcessDeposits, statuts terminaux, xafAmountError).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, Clock, Eye, FileText, Landmark, Plus, RefreshCw, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useAdminDeleteProof, useAdminDepositDetail, useAdminDepositProofs, useAdminDepositTimeline, useAdminUploadProofs,
  useAdminWalletByUserId, useDeleteDeposit, useRejectDeposit, useSetDepositVerified, useStartDepositReview, useValidateDeposit,
} from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits } from '@/hooks/usePaginatedDeposits';
import { usePasteFiles } from '@/hooks/usePasteFiles';
import { MIN_DEPOSIT_XAF, isValidXafAmount, xafAmountError } from '@/lib/amountLimits';
import { buildDepositTimelineSteps } from '@/lib/depositTimeline';
import { isTerminalDeposit } from '@/lib/terminalStatuses';
import { ACCEPT_UPLOAD, partitionUploadFiles, rejectionMessage } from '@/lib/clipboardFiles';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { DepositReceiptPDF, type DepositReceiptData } from '@/lib/pdf/templates/DepositReceiptPDF';
import { PROOF_DELETE_REASONS, REJECTION_REASONS } from '@/types/deposit';
import { cn } from '@/lib/utils';
import {
  BigButton, BigFigure, BottomSheet, ConfirmSheet, Dock, EmptyLine, KVBox, MoreButton, ScreenTop, SuccessView, Tag, TextArea,
  TextInput, TEXT, useSheet, type KV,
} from '@/mobile/designKit';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { FilePreviewGrid } from '@/components/upload/FilePreviewGrid';
import {
  ChoiceChips, DepositRound, FieldLabel, MenuSheet, PhotoDrop, ProofStage, Steps, TextLink, ToggleRow, Viewer,
  type MenuItem, type StageItem,
} from '@/mobile/screens/operations/parts';
import { depositMethodName, depositTag, firstName, fullName, n0, shortWhen } from '@/mobile/screens/operations/opsLabels';

const when = (iso: string) => format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: fr });

function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.click();
}

export function DepositDetailScreen() {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canProcess = hasPermission('canProcessDeposits');

  const { data: deposit, isLoading } = useAdminDepositDetail(depositId);
  const { data: proofs } = useAdminDepositProofs(depositId);
  const { data: timeline } = useAdminDepositTimeline(depositId);
  const { data: wallet } = useAdminWalletByUserId(deposit?.user_id);

  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  const startReview = useStartDepositReview();
  const uploadProofs = useAdminUploadProofs();
  const deleteProof = useAdminDeleteProof();
  const cancelDeposit = useDeleteDeposit();
  const setVerified = useSetDepositVerified();

  const more = useSheet();
  const history = useSheet();
  const [stage, setStage] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);

  // Créditer
  const [creditOpen, setCreditOpen] = useState(false);
  const [confirmed, setConfirmed] = useState('');
  const [editAmount, setEditAmount] = useState(false);
  const [notify, setNotify] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [credited, setCredited] = useState<number | null>(null);

  // Refuser
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState('');
  const [showInternal, setShowInternal] = useState(false);
  const [internal, setInternal] = useState('');

  // Preuves
  const [pending, setPending] = useState<File[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState<string | null>(null);
  const [deleteOther, setDeleteOther] = useState('');
  const replaceRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Le dépôt suivant à valider (le plus ancien), pour « Suivant » après crédit.
  const { data: queue } = usePaginatedAdminDeposits({ statuses: ['proof_submitted', 'admin_review'], sortField: 'created_at', sortAscending: true });
  const next = useMemo(() => queue?.pages.flatMap((p) => p.data).find((d) => d.id !== depositId) ?? null, [queue, depositId]);

  const stageItems: StageItem[] = useMemo(
    () => (proofs ?? []).map((p) => ({ id: p.id, url: p.signedUrl, isImage: !!p.file_type?.startsWith('image/'), name: p.file_name })),
    [proofs],
  );

  const stagePicked = useCallback((files: File[]) => {
    const { accepted, rejected } = partitionUploadFiles(files);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  }, []);

  const locked = deposit ? isTerminalDeposit(deposit.status) : true;
  const sheetOpen = creditOpen || rejectOpen || cancelOpen || more.open || history.open || viewing != null || !!deleteId || pending.length > 0;
  usePasteFiles({ onFiles: stagePicked, enabled: !!deposit && canProcess && !locked && !sheetOpen });

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Dépôt" backTo="/m/deposits" />
        <SkeletonDetail />
      </div>
    );
  }
  if (!deposit) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Dépôt" backTo="/m/deposits" />
        <EmptyLine action={{ label: 'Retour aux dépôts', onClick: () => navigate('/m/deposits') }}>Dépôt introuvable.</EmptyLine>
      </div>
    );
  }

  const client = fullName(deposit.profiles);
  const first = firstName(deposit.profiles, 'le client');
  const method = depositMethodName(deposit.method, deposit.bank_name, deposit.agency_name);
  const tag = depositTag(deposit.status);
  const amountNum = Number(confirmed) || 0;
  const amountOk = isValidXafAmount(amountNum, MIN_DEPOSIT_XAF);
  const balance = wallet?.balance_xaf ?? null;
  const canCredit = canProcess && !locked;
  const canCancel = isSuperAdmin && !['cancelled', 'cancelled_by_admin', 'rejected'].includes(deposit.status);
  const current = stageItems[Math.min(stage, Math.max(stageItems.length - 1, 0))];

  // ── Gestes ────────────────────────────────────────────────────────────
  const openCredit = () => {
    setConfirmed(String(deposit.amount_xaf));
    setEditAmount(false);
    setCreditOpen(true);
  };

  const doCredit = () => {
    const amt = Number(confirmed);
    const problem = xafAmountError(amt, MIN_DEPOSIT_XAF, 'Le montant reçu');
    if (problem) { toast.error(problem); return; }
    validateDeposit.mutate(
      { depositId: deposit.id, adminComment: note.trim() || undefined, confirmedAmount: amt !== deposit.amount_xaf ? amt : undefined, sendNotification: notify },
      { onSuccess: () => { setCreditOpen(false); setCredited(amt); } },
    );
  };

  const doReject = () => {
    if (!reason || !clientMessage.trim()) return;
    rejectDeposit.mutate(
      { depositId: deposit.id, reason: clientMessage.trim(), rejectionCategory: reason, adminNote: internal.trim() || undefined },
      { onSuccess: () => { setRejectOpen(false); setReason(null); setClientMessage(''); setInternal(''); } },
    );
  };

  const doUpload = () => {
    if (pending.length === 0) return;
    uploadProofs.mutate(
      { depositId: deposit.id, userId: deposit.user_id, files: pending, depositStatus: deposit.status },
      { onSuccess: () => setPending([]) },
    );
  };

  const doDeleteProof = () => {
    if (!deleteId) return;
    const r = deleteReason === 'Autre' ? deleteOther.trim() : deleteReason;
    if (!r) return;
    deleteProof.mutate(
      { proofId: deleteId, depositId: deposit.id, reason: r },
      { onSuccess: () => { setDeleteId(null); setDeleteReason(null); setDeleteOther(''); setViewing(null); setStage(0); } },
    );
  };

  const onReplacePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (replaceRef.current) replaceRef.current.value = '';
    const oldId = replaceId;
    setReplaceId(null);
    if (!picked || !oldId) return;
    const { accepted, rejected } = partitionUploadFiles([picked]);
    const problem = rejectionMessage(rejected);
    if (problem) { toast.error(problem); return; }
    uploadProofs.mutate(
      { depositId: deposit.id, userId: deposit.user_id, files: [accepted[0]], depositStatus: deposit.status },
      { onSuccess: () => deleteProof.mutate({ proofId: oldId, depositId: deposit.id, reason: 'Remplacée par une nouvelle version' }) },
    );
  };

  const replace = (id: string) => { setReplaceId(id); replaceRef.current?.click(); };

  const receipt = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const data: DepositReceiptData = {
        id: deposit.id, reference: deposit.reference, created_at: deposit.created_at, validated_at: deposit.validated_at,
        amount_xaf: deposit.amount_xaf, confirmed_amount_xaf: deposit.confirmed_amount_xaf, method: deposit.method, status: deposit.status,
        bank_name: deposit.bank_name, agency_name: deposit.agency_name, client_name: client, client_phone: deposit.profiles?.phone,
        company_name: deposit.profiles?.company_name,
      };
      await downloadPDF(<DepositReceiptPDF data={data} />, `recu_depot_${deposit.reference}_${client.replace(/\s+/g, '_')}.pdf`);
      toast.success('Reçu téléchargé');
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  // ── Après « Créditer » : le succès, puis le suivant ──────────────────
  if (credited != null) {
    return (
      <div className="flex min-h-full flex-col">
        <SuccessView
          title="Crédité"
          subtitle={<>{n0(credited)} XAF à {client}.{notify ? ` ${first} est prévenu${first.endsWith('e') ? 'e' : ''}.` : ''}</>}
          primary={next
            ? { label: `Dépôt suivant · ${firstName(next.profiles, 'Client')} ${n0(next.amount_xaf)}`, onClick: () => { setCredited(null); navigate(`/m/deposits/${next.id}`, { replace: true }); } }
            : { label: 'Retour aux dépôts', onClick: () => navigate('/m/deposits') }}
          secondary={next ? { label: 'Retour aux dépôts', onClick: () => navigate('/m/deposits') } : { label: 'Voir le dépôt', onClick: () => setCredited(null) }}
        />
      </div>
    );
  }

  const rows: KV[] = [
    { label: 'Client', value: <span className="underline underline-offset-[3px]">{client}</span>, onClick: () => navigate(`/m/clients/${deposit.user_id}`) },
    ...(balance != null ? [{ label: 'Solde', value: `${n0(balance)} XAF` }] : []),
    { label: 'Référence', value: deposit.reference },
    ...(deposit.confirmed_amount_xaf != null && deposit.confirmed_amount_xaf !== deposit.amount_xaf
      ? [{ label: 'Crédité', value: `${n0(deposit.confirmed_amount_xaf)} XAF`, tone: 'success' as const }] : []),
    ...(deposit.status === 'rejected' && deposit.rejection_reason ? [{ label: 'Motif', value: deposit.rejection_reason, tone: 'danger' as const }] : []),
    ...(deposit.verified_at ? [{ label: 'Vu en banque', value: format(new Date(deposit.verified_at), 'd MMM, HH:mm', { locale: fr }) }] : []),
    ...(deposit.admin_comment ? [{ label: 'Note', value: deposit.admin_comment }] : []),
    ...(deposit.admin_internal_note ? [{ label: 'Note interne', value: deposit.admin_internal_note }] : []),
  ];

  const menu: MenuItem[] = [
    { label: 'Vu en banque', icon: Landmark, toggle: !!deposit.verified_at, onClick: () => setVerified.mutate({ depositId: deposit.id, verified: !deposit.verified_at }), hidden: !canProcess, disabled: setVerified.isPending },
    { label: 'En vérification', icon: Eye, onClick: () => startReview.mutate({ depositId: deposit.id }), hidden: !canProcess || deposit.status !== 'proof_submitted' },
    { label: 'Remplacer la preuve', icon: RefreshCw, onClick: () => current && replace(current.id), hidden: !canCredit || !current },
    { label: 'Ajouter une preuve', icon: Plus, onClick: () => addRef.current?.click(), hidden: !canCredit },
    { label: pdfBusy ? 'Reçu en cours…' : 'Reçu PDF', icon: FileText, onClick: () => { void receipt(); } },
    { label: 'Historique', icon: Clock, onClick: history.show },
    { label: 'Refuser', icon: XCircle, onClick: () => setRejectOpen(true), hidden: !canCredit },
    { label: 'Annuler le dépôt', icon: Ban, danger: true, onClick: () => setCancelOpen(true), hidden: !canCancel },
  ];

  const steps = buildDepositTimelineSteps(deposit.status, deposit.method, timeline ?? []);

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Dépôt" backTo="/m/deposits" right={<MoreButton onClick={more.show} />} />
      <input ref={replaceRef} type="file" accept={ACCEPT_UPLOAD} className="hidden" onChange={onReplacePicked} />
      <input
        ref={addRef}
        type="file"
        accept={ACCEPT_UPLOAD}
        multiple
        className="hidden"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); if (addRef.current) addRef.current.value = ''; if (f.length) stagePicked(f); }}
      />

      <div className="flex flex-col items-center px-5 pt-5 text-center">
        <DepositRound method={deposit.method} bankName={deposit.bank_name} size={60} />
        <BigFigure className="mt-4" value={n0(deposit.amount_xaf)} unit="XAF" center />
        <p className={cn('mt-2 text-[17px]', TEXT.body)}>{method} · {shortWhen(deposit.created_at)}</p>
        <Tag tone={tag.tone} className="mt-3">{tag.label}</Tag>
      </div>

      <div className="px-5 pt-6">
        <ProofStage
          items={stageItems}
          index={stage}
          onIndex={setStage}
          onOpen={setViewing}
          empty={canCredit
            ? <PhotoDrop label="Ajouter la preuve" accept={ACCEPT_UPLOAD} multiple onFiles={stagePicked} />
            : <div className={cn('rounded-lg border border-dashed border-[#949494] px-4 py-8 text-center text-[16px]', TEXT.muted)}>Pas de preuve</div>}
        />
        <KVBox rows={rows} className="mt-4" />
      </div>

      {canCredit ? (
        <Dock>
          <BigButton onClick={openCredit}>Créditer {n0(deposit.amount_xaf)} XAF</BigButton>
        </Dock>
      ) : (
        <div className="h-8" />
      )}

      {/* ── Créditer ? ─────────────────────────────────────────────── */}
      <ConfirmSheet
        open={creditOpen}
        onClose={() => setCreditOpen(false)}
        title={<>Créditer {n0(amountNum || deposit.amount_xaf)} XAF ?</>}
        subtitle={<>à {client}, par {method}</>}
        rows={editAmount ? undefined : [
          { label: 'Montant reçu', value: <span className="underline underline-offset-[3px]">{n0(amountNum)} XAF</span>, onClick: () => setEditAmount(true) },
          ...(balance != null ? [
            { label: 'Solde avant', value: `${n0(balance)} XAF` },
            { label: 'Solde après', value: `${n0(balance + amountNum)} XAF` },
          ] : []),
        ]}
        confirmLabel="Créditer"
        onConfirm={doCredit}
        loading={validateDeposit.isPending}
        disabled={!amountOk}
      >
        {editAmount && (
          <div>
            <FieldLabel className="pt-0">Montant reçu</FieldLabel>
            <div className="flex items-center gap-2 rounded-lg border-2 border-[#2C2C2C] px-4 dark:border-[#E3E3E3]">
              <input
                autoFocus
                inputMode="numeric"
                enterKeyHint="done"
                aria-label="Montant reçu"
                value={confirmed ? n0(Number(confirmed)) : ''}
                onChange={(e) => setConfirmed(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => setEditAmount(false)}
                className={cn('h-14 min-w-0 flex-1 bg-transparent !text-[26px] font-bold tabular-nums outline-none', TEXT.strong)}
              />
              <span className={cn('text-[18px] font-semibold', TEXT.muted)}>XAF</span>
            </div>
            {amountNum !== deposit.amount_xaf && amountNum > 0 && (
              <p className={cn('mt-2 text-[15px]', TEXT.muted)}>Déclaré : {n0(deposit.amount_xaf)} XAF</p>
            )}
          </div>
        )}
        <ToggleRow label={`Prévenir ${first}`} on={notify} onChange={setNotify} />
        {showNote ? (
          <TextArea className="mt-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne" />
        ) : (
          <TextLink className="mt-1" onClick={() => setShowNote(true)}>Ajouter une note</TextLink>
        )}
      </ConfirmSheet>

      {/* ── Refuser le dépôt ? ─────────────────────────────────────── */}
      <BottomSheet open={rejectOpen} onClose={() => setRejectOpen(false)}>
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Refuser le dépôt ?</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{n0(deposit.amount_xaf)} XAF · {client}</p>
        <FieldLabel>Motif</FieldLabel>
        <ChoiceChips
          options={REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
          value={reason}
          onChange={(r) => {
            setReason(r);
            if (!clientMessage.trim()) setClientMessage(`Votre dépôt a été refusé : ${r.toLowerCase()}.`);
          }}
        />
        <FieldLabel>Message à {first}</FieldLabel>
        <TextArea rows={3} value={clientMessage} onChange={(e) => setClientMessage(e.target.value)} />
        {showInternal ? (
          <TextArea className="mt-3" rows={2} value={internal} onChange={(e) => setInternal(e.target.value)} placeholder="Note interne" />
        ) : (
          <TextLink className="mt-3" onClick={() => setShowInternal(true)}>Ajouter une note interne</TextLink>
        )}
        <BigButton className="mt-5" onClick={doReject} loading={rejectDeposit.isPending} disabled={!reason || !clientMessage.trim()}>Refuser le dépôt</BigButton>
      </BottomSheet>

      {/* ── Ajouter des preuves ────────────────────────────────────── */}
      <ConfirmSheet
        open={pending.length > 0}
        onClose={() => setPending([])}
        title={pending.length > 1 ? `Ajouter ${pending.length} preuves ?` : 'Ajouter la preuve ?'}
        subtitle={`${n0(deposit.amount_xaf)} XAF · ${client}`}
        confirmLabel="Ajouter"
        onConfirm={doUpload}
        loading={uploadProofs.isPending}
      >
        <FilePreviewGrid files={pending} onRemove={(i) => setPending((p) => p.filter((_, k) => k !== i))} />
      </ConfirmSheet>

      {/* ── Supprimer une preuve ───────────────────────────────────── */}
      <ConfirmSheet
        open={!!deleteId}
        onClose={() => { setDeleteId(null); setDeleteReason(null); setDeleteOther(''); }}
        title="Supprimer la preuve ?"
        confirmLabel="Supprimer la preuve"
        danger
        onConfirm={doDeleteProof}
        loading={deleteProof.isPending}
        disabled={!deleteReason || (deleteReason === 'Autre' && !deleteOther.trim())}
      >
        <FieldLabel className="pt-0">Motif</FieldLabel>
        <ChoiceChips options={PROOF_DELETE_REASONS.map((r) => ({ value: r, label: r }))} value={deleteReason} onChange={setDeleteReason} />
        {deleteReason === 'Autre' && <TextInput className="mt-3" value={deleteOther} onChange={(e) => setDeleteOther(e.target.value)} placeholder="Précisez" />}
      </ConfirmSheet>

      {/* ── Annuler le dépôt ───────────────────────────────────────── */}
      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Annuler le dépôt ?"
        subtitle={`${n0(deposit.amount_xaf)} XAF · ${client}`}
        rows={deposit.status === 'validated' && balance != null ? [
          { label: 'Solde avant', value: `${n0(balance)} XAF` },
          { label: 'Solde après', value: `${n0(balance - (deposit.confirmed_amount_xaf ?? deposit.amount_xaf))} XAF` },
        ] : undefined}
        confirmLabel="Annuler le dépôt"
        cancelLabel="Retour"
        danger
        onConfirm={() => cancelDeposit.mutate({ depositId: deposit.id }, { onSuccess: () => navigate('/m/deposits') })}
        loading={cancelDeposit.isPending}
      />

      {/* ── Historique ─────────────────────────────────────────────── */}
      <BottomSheet open={history.open} onClose={history.hide}>
        <h3 className={cn('mb-4 text-[22px] font-semibold', TEXT.strong)}>Historique</h3>
        <Steps
          items={steps.map((s) => ({
            key: s.id,
            title: s.label,
            sub: s.formattedDate ?? (s.status === 'current' ? 'En cours' : undefined),
            state: s.status === 'completed' ? 'done' : s.status === 'current' ? (s.key === 'rejected' ? 'bad' : 'current') : 'todo',
          }))}
        />
        <p className={cn('text-[15px]', TEXT.muted)}>Créé le {when(deposit.created_at)}{deposit.validated_at ? ` · validé le ${when(deposit.validated_at)}` : ''}</p>
      </BottomSheet>

      <MenuSheet open={more.open} onClose={more.hide} items={menu} />

      <Viewer
        item={viewing != null ? stageItems[viewing] ?? null : null}
        onClose={() => setViewing(null)}
        actions={viewing != null && stageItems[viewing] ? [
          { label: 'Télécharger', onClick: () => { const it = stageItems[viewing]; if (it.url) download(it.url, it.name ?? 'preuve'); }, hidden: !stageItems[viewing].url },
          { label: 'Remplacer', onClick: () => { const id = stageItems[viewing].id; setViewing(null); replace(id); }, hidden: !canCredit },
          { label: 'Supprimer', danger: true, onClick: () => { const id = stageItems[viewing].id; setViewing(null); setDeleteId(id); }, hidden: !canCredit },
        ] : []}
      />
    </div>
  );
}
