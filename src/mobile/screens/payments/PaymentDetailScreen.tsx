/**
 * La fiche d'un paiement, v2 (maquettes : index.html écrans 5 et 6,
 * 02-operations/07, 08, 09 ; 10-complements/05 et 06). Façon Wave : le
 * logo du moyen, le montant en ¥, le client et le débit XAF, le tag ; la
 * carte du fournisseur (QR, compte, « Copier le compte ») ; Taux · Créé ·
 * Référence ; UN bouton noir en bas (Marquer comme payé, Scanner le QR,
 * Faire signer, Ajouter le fournisseur).
 *
 * « … » : Partager l'instruction (付款指令) · Exporter l'image · Reçu PDF ·
 * Historique (suivi + pièces) · Modifier le fournisseur · Corriger le
 * montant · Passer en cours · Refuser · Annuler le paiement (rouge).
 *
 * La logique est celle de MobilePaymentDetail (mêmes hooks, mêmes gardes de
 * src/lib/paymentEdits.ts et paymentActions.ts). Deux ajouts qui ne touchent
 * pas le serveur : « Marquer comme payé » depuis « À payer » enchaîne
 * start_processing puis complete (les deux RPC existantes), et le message
 * au client part dans le commentaire de `complete`, comme sur ordinateur.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, Ban, Clock, Copy, FileText, Image as ImageIcon, PencilLine, PlayCircle, Share2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useAdminPaymentDetail, useAdminPaymentProofs, useAdminPaymentTimeline, useAdminUploadPaymentProof, useProcessPayment,
} from '@/hooks/usePayments';
import { useAdminCorrectPayment, useCancelPayment, useDeletePaymentProof } from '@/hooks/useAdminPayments';
import { useAdminUploadPaymentInstruction } from '@/hooks/usePaymentProofUpload';
import { useAdminWalletByUserId } from '@/hooks/useAdminDeposits';
import { usePaymentBatch } from '@/hooks/usePaymentBatches';
import { usePaginatedAdminPayments } from '@/hooks/usePaginatedPayments';
import { usePasteFiles } from '@/hooks/usePasteFiles';
import { PAYMENT_METHOD_LABELS, PAYMENT_REJECTION_REASONS } from '@/types/payment';
import { isTerminalPayment } from '@/lib/terminalStatuses';
import { cashHandoverStep, paymentMainAction } from '@/lib/paymentActions';
import {
  amountsCoherent, canCancelPayment, canEditPaymentAmounts, canEditPaymentBeneficiary, cancelRequiresReason,
  normalizeRateInt, rmbForXaf, walletDeltaForCorrection,
} from '@/lib/paymentEdits';
import { canSendPaymentInstruction, instructionEntryFromPayment, type PaymentForInstruction } from '@/lib/paymentInstruction';
import { ACCEPT_UPLOAD, partitionUploadFiles, rejectionMessage } from '@/lib/clipboardFiles';
import { copyToClipboard } from '@/lib/clipboard';
import { captureNodePng, triggerDownload } from '@/lib/nodeImage';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF, type PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';
import { cashSignatureSrc } from '@/lib/cashSignature';
import { cn } from '@/lib/utils';
import {
  BigButton, BigFigure, BottomSheet, ConfirmSheet, Dock, EmptyLine, Initials, KVBox, MethodCircle, MoreButton, ScreenTop,
  SuccessView, Tag, TextArea, TextInput, TEXT, SURFACE, FOCUS_RING, toMethodKey, useSheet, type KV,
} from '@/mobile/designKit';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { AdminCashScan, AdminCashSign } from '@/components/cash/AdminCashHandover';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import {
  ChoiceChips, FieldLabel, MenuSheet, PhotoDrop, PieceTile, Steps, Viewer, type MenuItem, type StageItem,
} from '@/mobile/screens/operations/parts';
import { firstName, fullName, n0, paymentTag, yuan } from '@/mobile/screens/operations/opsLabels';
import { MobilePaymentInstructionSheet } from './MobilePaymentInstructionSheet';
import { paymentSteps } from './paymentHistory';

type Page = 'main' | 'history' | 'cash';

const when = (iso: string) => {
  const d = new Date(iso);
  const t = format(d, 'HH:mm');
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Aujourd'hui, ${t}`;
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Hier, ${t}`;
  return format(d, "d MMM yyyy, HH:mm", { locale: fr });
};

function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.click();
}

export function PaymentDetailScreen() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canProcess = hasPermission('canProcessPayments');
  const mayHandleCash = hasPermission('canHandleCash');

  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const { data: timeline } = useAdminPaymentTimeline(paymentId);
  const { data: proofs } = useAdminPaymentProofs(paymentId);
  const { data: wallet } = useAdminWalletByUserId(payment?.user_id);
  const batchId = (payment as { batch_id?: string | null } | null | undefined)?.batch_id ?? undefined;
  const { data: batch } = usePaymentBatch(batchId);

  const processPayment = useProcessPayment();
  const uploadProof = useAdminUploadPaymentProof();
  const uploadInstruction = useAdminUploadPaymentInstruction();
  const cancelPayment = useCancelPayment();
  const correctPayment = useAdminCorrectPayment();
  const deleteProof = useDeletePaymentProof();

  // Le paiement suivant à payer (le plus ancien), pour « Suivant ».
  const { data: queue } = usePaginatedAdminPayments({ statuses: ['ready_for_payment', 'processing'], sortField: 'created_at', sortAscending: true });

  const [page, setPage] = useState<Page>('main');
  const more = useSheet();
  const addPiece = useSheet();
  const [paidOpen, setPaidOpen] = useState(false);
  const [paidFile, setPaidFile] = useState<File | null>(null);
  const [paidPreview, setPaidPreview] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCat, setRejectCat] = useState<string | null>(null);
  const [rejectMsg, setRejectMsg] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [fixOpen, setFixOpen] = useState(false);
  const [fixXaf, setFixXaf] = useState('');
  const [fixRmb, setFixRmb] = useState('');
  const [fixRate, setFixRate] = useState('');
  const [fixReason, setFixReason] = useState('');
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [viewing, setViewing] = useState<StageItem | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [cashStepUi, setCashStepUi] = useState<'scan' | 'sign' | null>(null);
  const ficheRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLInputElement>(null);
  const instrRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const setPaidFromFile = useCallback((f: File | undefined) => {
    if (!f) return;
    const { accepted, rejected } = partitionUploadFiles([f]);
    const problem = rejectionMessage(rejected);
    if (problem) { toast.error(problem); return; }
    setPaidFile(accepted[0]);
    setPaidPreview((old) => { if (old) URL.revokeObjectURL(old); return accepted[0].type.startsWith('image/') ? URL.createObjectURL(accepted[0]) : null; });
  }, []);

  // Coller (Ctrl+V) : dans la feuille « Payé », la capture devient le reçu.
  usePasteFiles({ onFiles: (files) => setPaidFromFile(files[0]), enabled: paidOpen, single: true });

  // « ?instruction=1 » au sortir de la création ; « ?qr=… » posé par le scanner natif.
  const [searchParams, setSearchParams] = useSearchParams();
  const instructionInput: PaymentForInstruction | null = payment ? { ...payment } : null;
  const canSendInstruction = !!instructionInput && canSendPaymentInstruction(instructionInput);
  const wantsInstruction = searchParams.get('instruction') === '1';
  useEffect(() => {
    if (!wantsInstruction || isLoading) return;
    if (canSendInstruction) setInstructionOpen(true);
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('instruction'); return n; }, { replace: true });
  }, [wantsInstruction, isLoading, canSendInstruction, setSearchParams]);
  const scannedQr = searchParams.get('qr');
  useEffect(() => {
    if (scannedQr && mayHandleCash) { setCashStepUi('scan'); setPage('cash'); }
  }, [scannedQr, mayHandleCash]);

  const next = useMemo(
    () => queue?.pages.flatMap((p) => p.data).find((p) => p.id !== paymentId && p.method !== 'cash') ?? null,
    [queue, paymentId],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Paiement" backTo="/m/payments" />
        <SkeletonDetail />
      </div>
    );
  }
  if (!payment) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Paiement" backTo="/m/payments" />
        <EmptyLine action={{ label: 'Retour aux paiements', onClick: () => navigate('/m/payments') }}>Paiement introuvable.</EmptyLine>
      </div>
    );
  }

  // ── Dérivés ───────────────────────────────────────────────────────────
  const client = fullName(payment.profiles);
  const first = firstName(payment.profiles, 'le client');
  const methodKey = toMethodKey(payment.method);
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.method;
  const tag = paymentTag(payment.status);
  const isCash = payment.method === 'cash';
  const locked = isTerminalPayment(payment.status);
  const mainKind = paymentMainAction(payment.status, canProcess, payment.method);
  const cashStep = isCash ? cashHandoverStep(payment.status) : null;
  const canReject = canProcess && !locked && !isCash;
  const canCancel = canCancelPayment(payment.status, isSuperAdmin);
  const canEditBenef = canEditPaymentBeneficiary(payment.status, payment.method, canProcess);
  const canEditAmounts = canEditPaymentAmounts(payment.status, canProcess, isSuperAdmin);
  const canAddPiece = canProcess && !locked;
  const rateInt = normalizeRateInt(payment.exchange_rate);
  const hasBenef = !!(payment.beneficiary_name || payment.beneficiary_bank_account || payment.beneficiary_qr_code_url || payment.beneficiary_phone || payment.beneficiary_email || payment.beneficiary_identifier);
  const supplierName = isCash
    ? (payment.cash_beneficiary_type === 'other' ? [payment.cash_beneficiary_first_name, payment.cash_beneficiary_last_name].filter(Boolean).join(' ') || client : client)
    : payment.beneficiary_name || 'Fournisseur';
  const account = payment.beneficiary_identifier || payment.beneficiary_bank_account || payment.beneficiary_phone || payment.beneficiary_email || '';
  const adminProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'admin');
  const otherPieces = (proofs ?? []).filter((p) => p.uploaded_by_type !== 'admin');

  // ── Gestes ────────────────────────────────────────────────────────────
  const markPaid = async () => {
    try {
      if (payment.status === 'ready_for_payment') await processPayment.mutateAsync({ paymentId: payment.id, action: 'start_processing' });
      if (paidFile) await uploadProof.mutateAsync({ paymentId: payment.id, file: paidFile });
      await processPayment.mutateAsync({ paymentId: payment.id, action: 'complete', comment: message.trim() || undefined });
      setPaidOpen(false);
      setDone(true);
    } catch { /* toast par le hook */ }
  };

  const reject = async () => {
    const comment = rejectMsg.trim() || rejectCat;
    if (!comment) return;
    try {
      await processPayment.mutateAsync({ paymentId: payment.id, action: 'reject', comment });
      setRejectOpen(false);
    } catch { /* toast */ }
  };

  const cancel = async () => {
    if (cancelRequiresReason(payment.status) && cancelReason.trim().length < 3) { toast.error("Indiquez le motif de l'annulation"); return; }
    try {
      await cancelPayment.mutateAsync({ paymentId: payment.id, reason: cancelReason });
      setCancelOpen(false);
      navigate('/m/payments');
    } catch { /* toast */ }
  };

  const openFix = () => {
    setFixXaf(String(payment.amount_xaf));
    setFixRmb(String(Number(payment.amount_rmb)));
    setFixRate(String(rateInt));
    setFixReason('');
    setFixOpen(true);
  };
  const fx = Number(fixXaf) || 0;
  const fr_ = Number(fixRmb.replace(',', '.')) || 0;
  const frate = Number(fixRate) || 0;
  const fixChanged = fx !== payment.amount_xaf || fr_ !== Number(payment.amount_rmb) || frate !== rateInt;
  const fixValid = Number.isSafeInteger(fx) && fx > 0 && fr_ > 0 && frate > 0 && fixReason.trim().length >= 3 && fixChanged;
  const delta = walletDeltaForCorrection(payment.status, payment.amount_xaf, fx > 0 ? fx : payment.amount_xaf);
  const saveFix = async () => {
    if (!fixValid) return;
    try {
      await correctPayment.mutateAsync({
        paymentId: payment.id,
        reason: fixReason.trim(),
        amountXaf: fx !== payment.amount_xaf ? fx : undefined,
        amountRmb: fr_ !== Number(payment.amount_rmb) ? fr_ : undefined,
        exchangeRate: frate !== rateInt ? frate : undefined,
        rateIsCustom: frate !== rateInt ? true : undefined,
      });
      setFixOpen(false);
    } catch { /* toast */ }
  };

  const onProofPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (proofRef.current) proofRef.current.value = '';
    const { accepted, rejected } = partitionUploadFiles(picked);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    for (const file of accepted) {
      try { await uploadProof.mutateAsync({ paymentId: payment.id, file }); } catch { break; }
    }
  };
  const onInstructionPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (instrRef.current) instrRef.current.value = '';
    const { accepted, rejected } = partitionUploadFiles(picked);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    if (accepted.length === 0) return;
    try {
      await uploadInstruction.mutateAsync({ paymentId: payment.id, files: accepted });
      toast.success(accepted.length > 1 ? `${accepted.length} instructions ajoutées` : 'Instruction ajoutée');
    } catch { /* toast */ }
  };
  const onReplacePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (replaceRef.current) replaceRef.current.value = '';
    const oldId = replaceId;
    setReplaceId(null);
    if (!picked || !oldId) return;
    const { accepted, rejected } = partitionUploadFiles([picked]);
    const problem = rejectionMessage(rejected);
    if (problem) { toast.error(problem); return; }
    try {
      await uploadProof.mutateAsync({ paymentId: payment.id, file: accepted[0] });
      deleteProof.mutate(oldId);
    } catch { /* toast */ }
  };

  const receipt = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const data: PaymentReceiptData = {
        id: payment.id, reference: payment.reference, created_at: payment.created_at, processed_at: payment.processed_at,
        amount_xaf: payment.amount_xaf, amount_rmb: payment.amount_rmb, exchange_rate: payment.exchange_rate,
        method: payment.method, status: payment.status, client_name: client, client_phone: payment.profiles?.phone,
        beneficiary_name: payment.beneficiary_name, beneficiary_phone: payment.beneficiary_phone, beneficiary_email: payment.beneficiary_email,
        beneficiary_bank_name: payment.beneficiary_bank_name, beneficiary_bank_account: payment.beneficiary_bank_account,
        beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
        adminProofs: adminProofs.map((p) => ({ file_url: p.file_url, file_type: p.file_type, file_name: p.file_name, created_at: p.created_at })),
      };
      await downloadPDF(<PaymentReceiptPDF data={data} />, `recu_paiement_${payment.reference}_${client.replace(/\s+/g, '_')}.pdf`);
      toast.success('Reçu téléchargé');
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const exportImage = async () => {
    if (!ficheRef.current || imgBusy) return;
    setImgBusy(true);
    try {
      triggerDownload(await captureNodePng(ficheRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' }), `fiche_${payment.reference}.png`);
      toast.success('Image enregistrée');
    } catch {
      toast.error("Impossible d'exporter l'image");
    } finally {
      setImgBusy(false);
    }
  };

  const canDeletePiece = (type: string) => canProcess && (type === 'admin' || isSuperAdmin) && (!locked || isSuperAdmin);

  // ── Après « Payé » ────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex min-h-full flex-col">
        <SuccessView
          title="Payé"
          subtitle={<>{yuan(payment.amount_rmb)} à {supplierName}<br />{first.charAt(0).toUpperCase() + first.slice(1)} est prévenu{first.endsWith('e') ? 'e' : ''}.</>}
          primary={next
            ? { label: `Paiement suivant · ${firstName(next.profiles, 'Client')} ${yuan(next.amount_rmb)}`, onClick: () => { setDone(false); navigate(`/m/payments/${next.id}`, { replace: true }); } }
            : { label: 'Retour aux paiements', onClick: () => navigate('/m/payments') }}
          secondary={{ label: "Retour à l'accueil", onClick: () => navigate('/m') }}
        />
      </div>
    );
  }

  // ── La remise du cash (admin habilité) : même chaîne que l'agent ──────
  if (page === 'cash' && cashStepUi) {
    const close = () => {
      setCashStepUi(null);
      setPage('main');
      if (scannedQr) setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('qr'); return n; }, { replace: true });
    };
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title={cashStepUi === 'scan' ? 'QR du client' : 'Remise en espèces'} onBack={close} />
        <div className="px-5 pt-4">
          <div className={cn('mb-4 flex items-center gap-3 rounded-lg border px-3.5 py-3', SURFACE.divider)}>
            <MethodCircle method="cash" />
            <span className="min-w-0">
              <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{yuan(payment.amount_rmb)}</span>
              <span className={cn('block truncate text-[15px]', TEXT.muted)}>à {supplierName}</span>
            </span>
          </div>
          {cashStepUi === 'scan' && cashStep === 'scan' ? (
            <AdminCashScan paymentId={payment.id} prefilledQr={scannedQr} onDone={() => setCashStepUi('sign')} onCancel={close} />
          ) : cashStepUi === 'sign' && (cashStep === 'sign' || cashStep === 'scan') ? (
            <AdminCashSign paymentId={payment.id} beneficiaryName={supplierName} onDone={close} onCancel={close} />
          ) : (
            <EmptyLine action={{ label: 'Retour', onClick: close }}>Rien à faire pour ce paiement.</EmptyLine>
          )}
        </div>
      </div>
    );
  }

  // ── L'historique : suivi et pièces ────────────────────────────────────
  if (page === 'history') {
    const steps = paymentSteps(payment, timeline ?? []);
    const pieces: (StageItem & { type: string; label: string })[] = [
      ...otherPieces.map((p) => ({ id: p.id, url: p.file_url, isImage: !!p.file_type?.startsWith('image/'), name: p.file_name, type: p.uploaded_by_type, label: p.uploaded_by_type === 'client' ? 'Facture' : 'Instruction' })),
      ...adminProofs.map((p) => ({ id: p.id, url: p.file_url, isImage: !!p.file_type?.startsWith('image/'), name: p.file_name, type: 'admin', label: 'Reçu' })),
      ...(payment.beneficiary_qr_code_url ? [{ id: 'qr', url: payment.beneficiary_qr_code_url, isImage: true, name: 'QR fournisseur', type: 'qr', label: 'QR fournisseur' }] : []),
      ...(isCash && payment.cash_signature_url ? [{ id: 'sig', url: cashSignatureSrc(payment.cash_signature_url), isImage: true, name: 'Signature', type: 'sig', label: 'Signature' }] : []),
    ];
    const viewingType = viewing ? pieces.find((p) => p.id === viewing.id)?.type ?? '' : '';
    return (
      <div className="flex min-h-full flex-col pb-8">
        <ScreenTop title="Historique" onBack={() => setPage('main')} />
        <input ref={proofRef} type="file" accept={ACCEPT_UPLOAD} multiple className="hidden" onChange={onProofPicked} />
        <input ref={instrRef} type="file" accept={ACCEPT_UPLOAD} multiple className="hidden" onChange={onInstructionPicked} />
        <input ref={replaceRef} type="file" accept={ACCEPT_UPLOAD} className="hidden" onChange={onReplacePicked} />
        <div className="px-5 pt-4">
          <div className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-3', SURFACE.divider)}>
            <MethodCircle method={methodKey} />
            <span className="min-w-0">
              <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{yuan(payment.amount_rmb)} · {client}</span>
              <span className={cn('block text-[15px]', TEXT.muted)}>{payment.reference}</span>
            </span>
          </div>
          <div className="pt-5">
            <Steps
              items={steps.map((s, i) => (i === 0 && batch?.batch ? {
                ...s,
                extra: (
                  <button type="button" onClick={() => navigate(`/m/payments/batch/${batch.batch!.id}`)} className={cn('mt-1 rounded text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
                    Lot {batch.batch.reference}
                  </button>
                ),
              } : s))}
            />
          </div>
          <FieldLabel>Pièces</FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            {pieces.map((p) => <PieceTile key={p.id} url={p.url} isImage={p.isImage} label={p.label} onClick={() => setViewing(p)} />)}
            {canAddPiece && <PieceTile add label="Ajouter" onClick={addPiece.show} />}
          </div>
        </div>

        <MenuSheet
          open={addPiece.open}
          onClose={addPiece.hide}
          items={[
            { label: uploadProof.isPending ? 'Envoi…' : 'Preuve de paiement', icon: FileText, onClick: () => proofRef.current?.click(), disabled: isCash },
            { label: uploadInstruction.isPending ? 'Envoi…' : 'Instruction du client', icon: FileText, onClick: () => instrRef.current?.click() },
          ]}
        />
        <Viewer
          item={viewing}
          onClose={() => setViewing(null)}
          actions={viewing ? [
            { label: 'Ouvrir', onClick: () => { if (viewing.url) window.open(viewing.url, '_blank', 'noopener'); }, hidden: !viewing.url },
            { label: 'Télécharger', onClick: () => { if (viewing.url) download(viewing.url, viewing.name ?? 'piece'); }, hidden: !viewing.url || viewingType === 'qr' || viewingType === 'sig' ? true : false },
            { label: 'Remplacer', onClick: () => { const id = viewing.id; setViewing(null); setReplaceId(id); replaceRef.current?.click(); }, hidden: viewingType !== 'admin' || !canDeletePiece('admin') },
            { label: 'Supprimer', danger: true, onClick: () => { const id = viewing.id; setViewing(null); setToDelete(id); }, hidden: viewingType === 'qr' || viewingType === 'sig' || !canDeletePiece(viewingType) },
          ] : []}
        />
        <ConfirmSheet
          open={!!toDelete}
          onClose={() => setToDelete(null)}
          title="Supprimer la pièce ?"
          confirmLabel="Supprimer"
          danger
          loading={deleteProof.isPending}
          onConfirm={() => { if (toDelete) deleteProof.mutate(toDelete, { onSuccess: () => setToDelete(null) }); }}
        />
      </div>
    );
  }

  // ── La fiche ──────────────────────────────────────────────────────────
  const rows: KV[] = [
    { label: 'Taux', value: <>1 M XAF = ¥&nbsp;{n0(rateInt)}{payment.rate_is_custom ? ' · perso' : ''}</> },
    { label: 'Créé', value: when(payment.created_at) },
    { label: 'Référence', value: payment.reference },
    ...(payment.balance_after != null && payment.balance_after < 0 ? [{ label: 'Solde après', value: `${n0(payment.balance_after)} XAF`, tone: 'danger' as const }] : []),
    ...(batch?.batch ? [{ label: 'Lot', value: <span className="underline underline-offset-[3px]">{batch.batch.reference}</span>, onClick: () => navigate(`/m/payments/batch/${batch.batch!.id}`) }] : []),
    ...(payment.status === 'completed' && payment.processed_at ? [{ label: isCash ? 'Remis' : 'Payé', value: when(payment.cash_paid_at || payment.processed_at) }] : []),
    ...(isCash && payment.cash_signed_by_name ? [{ label: 'Signé par', value: payment.cash_signed_by_name }] : []),
    ...(payment.rejection_reason ? [{ label: 'Motif', value: payment.rejection_reason, tone: 'danger' as const }] : []),
    ...((payment as { cancelled_reason?: string | null }).cancelled_reason ? [{ label: 'Annulé', value: (payment as { cancelled_reason?: string | null }).cancelled_reason!, tone: 'danger' as const }] : []),
    ...(payment.beneficiary_notes ? [{ label: 'Notes', value: payment.beneficiary_notes }] : []),
    ...(payment.admin_comment ? [{ label: 'Commentaire', value: payment.admin_comment }] : []),
  ];

  const main: { label: string; onClick: () => void } | null =
    isCash
      ? (cashStep === 'scan' && mayHandleCash ? { label: 'Scanner le QR du client', onClick: () => { setCashStepUi('scan'); setPage('cash'); } }
        : cashStep === 'sign' && mayHandleCash ? { label: 'Faire signer', onClick: () => { setCashStepUi('sign'); setPage('cash'); } }
        : null)
      : payment.status === 'waiting_beneficiary_info' && canEditBenef ? { label: 'Ajouter le fournisseur', onClick: () => navigate(`/m/payments/${payment.id}/edit-beneficiary`) }
      : mainKind ? { label: 'Marquer comme payé', onClick: () => setPaidOpen(true) }
      : null;

  const menu: MenuItem[] = [
    { label: "Partager l'instruction", icon: Share2, onClick: () => setInstructionOpen(true), hidden: !canSendInstruction },
    { label: imgBusy ? 'Image en cours…' : "Exporter l'image", icon: ImageIcon, onClick: () => { void exportImage(); } },
    { label: pdfBusy ? 'Reçu en cours…' : 'Reçu PDF', icon: FileText, onClick: () => { void receipt(); } },
    { label: 'Historique', icon: Clock, onClick: () => setPage('history') },
    { label: 'Modifier le fournisseur', icon: PencilLine, onClick: () => navigate(`/m/payments/${payment.id}/edit-beneficiary`), hidden: !canEditBenef },
    { label: 'Corriger le montant', icon: ArrowLeftRight, onClick: openFix, hidden: !canEditAmounts },
    { label: 'Passer en cours', icon: PlayCircle, onClick: () => processPayment.mutate({ paymentId: payment.id, action: 'start_processing' }), hidden: mainKind !== 'start_processing' },
    { label: 'Refuser', icon: XCircle, onClick: () => setRejectOpen(true), hidden: !canReject },
    { label: 'Annuler le paiement', icon: Ban, danger: true, onClick: () => setCancelOpen(true), hidden: !canCancel },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Paiement" backTo="/m/payments" right={<MoreButton onClick={more.show} />} />

      <div ref={ficheRef} className="bg-white px-5 pb-2 pt-5 dark:bg-[#1E1E1E]">
        <div className="flex flex-col items-center text-center">
          <MethodCircle method={methodKey} size={60} />
          <BigFigure className="mt-4" value={yuan(payment.amount_rmb)} center />
          <p className={cn('mt-2 text-[17px]', TEXT.body)}>
            <button type="button" onClick={() => navigate(`/m/clients/${payment.user_id}`)} className={cn('rounded', FOCUS_RING)}>{client}</button>
            {' · '}{n0(payment.amount_xaf)} XAF
          </p>
          <Tag tone={tag.tone} className="mt-3">{tag.label}</Tag>
        </div>

        {/* Le fournisseur */}
        <div className="mt-6">
          {isCash ? (
            <div className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-3', SURFACE.divider)}>
              <Initials name={supplierName} />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{supplierName}</span>
                <span className={cn('block truncate text-[15px]', TEXT.muted)}>
                  {payment.cash_beneficiary_type === 'other' ? 'Un tiers' : 'Le client'}
                  {(payment.cash_beneficiary_phone || payment.profiles?.phone) ? ` · ${payment.cash_beneficiary_phone || payment.profiles?.phone}` : ''}
                </span>
              </span>
            </div>
          ) : hasBenef ? (
            <div className={cn('flex items-center gap-3.5 rounded-lg border p-3', SURFACE.divider)}>
              {payment.beneficiary_qr_code_url && (
                <button type="button" onClick={() => setViewing({ id: 'qr', url: payment.beneficiary_qr_code_url, isImage: true, name: 'QR fournisseur' })} aria-label="Agrandir le QR" className={cn('h-[88px] w-[88px] shrink-0 overflow-hidden rounded-md border bg-white', SURFACE.divider, FOCUS_RING)}>
                  <img src={payment.beneficiary_qr_code_url} alt="QR du fournisseur" className="h-full w-full object-contain" />
                </button>
              )}
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{supplierName}</span>
                {payment.method === 'bank_transfer' && payment.beneficiary_bank_name && <span className={cn('block truncate text-[15px]', TEXT.muted)}>{payment.beneficiary_bank_name}</span>}
                {account && <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{account}</span>}
                {payment.beneficiary_bank_extra && <span className={cn('block truncate text-[15px]', TEXT.muted)}>{payment.beneficiary_bank_extra}</span>}
                {account && (
                  <button type="button" onClick={() => void copyToClipboard(account, 'Compte')} className={cn('mt-2 inline-flex h-11 items-center gap-2 rounded-lg border px-3 text-[16px] font-semibold active:bg-[#F5F5F5]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
                    <Copy className="h-[18px] w-[18px]" />Copier le compte
                  </button>
                )}
              </span>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canEditBenef}
              onClick={() => navigate(`/m/payments/${payment.id}/edit-beneficiary`)}
              className={cn('flex min-h-[72px] w-full items-center justify-center rounded-lg border border-dashed border-[#949494] text-[17px] font-semibold disabled:opacity-60', FOCUS_RING, TEXT.strong)}
            >
              Sans fournisseur
            </button>
          )}
        </div>

        <KVBox rows={rows} className="mt-4" />
        {isCash && payment.status === 'completed' && (
          <div className="mt-4">
            <CashReceiptDownloadButton payment={payment} variant="outline" className="h-14 w-full rounded-lg text-[17px] font-semibold" label="Reçu de remise" />
          </div>
        )}
      </div>

      {main ? (
        <Dock><BigButton onClick={main.onClick} loading={processPayment.isPending}>{main.label}</BigButton></Dock>
      ) : <div className="h-8" />}

      {/* ── Marquer payé ? ─────────────────────────────────────────── */}
      <BottomSheet open={paidOpen} onClose={() => setPaidOpen(false)}>
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Marquer payé ?</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{yuan(payment.amount_rmb)} à {supplierName}</p>
        <FieldLabel>Reçu {methodLabel}</FieldLabel>
        <PhotoDrop
          label="Photo du reçu"
          accept={ACCEPT_UPLOAD}
          onFiles={(f) => setPaidFromFile(f[0])}
          preview={paidPreview}
          fileName={paidFile ? paidFile.name : null}
          onClear={paidFile ? () => { setPaidFile(null); setPaidPreview(null); } : undefined}
        />
        <FieldLabel>Message à {first}</FieldLabel>
        <TextArea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Facultatif" />
        <BigButton className="mt-5" onClick={() => void markPaid()} loading={processPayment.isPending || uploadProof.isPending}>Payé</BigButton>
      </BottomSheet>

      {/* ── Refuser ────────────────────────────────────────────────── */}
      <BottomSheet open={rejectOpen} onClose={() => setRejectOpen(false)}>
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Refuser le paiement ?</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{yuan(payment.amount_rmb)} · {n0(payment.amount_xaf)} XAF recrédités à {first}</p>
        <FieldLabel>Motif</FieldLabel>
        <ChoiceChips
          options={PAYMENT_REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
          value={rejectCat}
          onChange={(r) => { setRejectCat(r); if (!rejectMsg.trim()) setRejectMsg(`Paiement refusé : ${r.toLowerCase()}.`); }}
        />
        <FieldLabel>Message à {first}</FieldLabel>
        <TextArea rows={3} value={rejectMsg} onChange={(e) => setRejectMsg(e.target.value)} />
        <BigButton className="mt-5" onClick={() => void reject()} loading={processPayment.isPending} disabled={!rejectMsg.trim()}>Refuser le paiement</BigButton>
      </BottomSheet>

      {/* ── Annuler (super admin) ──────────────────────────────────── */}
      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Annuler le paiement ?"
        subtitle={payment.status === 'completed' ? `Déjà payé · ${n0(payment.amount_xaf)} XAF recrédités à ${first}` : `${n0(payment.amount_xaf)} XAF recrédités à ${first}`}
        rows={wallet ? [{ label: 'Solde', before: n0(wallet.balance_xaf), value: n0(wallet.balance_xaf + payment.amount_xaf) }] : undefined}
        confirmLabel="Annuler le paiement"
        cancelLabel="Retour"
        danger
        loading={cancelPayment.isPending}
        disabled={cancelRequiresReason(payment.status) && cancelReason.trim().length < 3}
        onConfirm={() => void cancel()}
      >
        <FieldLabel className="pt-0">Motif{cancelRequiresReason(payment.status) ? '' : ' · facultatif'}</FieldLabel>
        <TextInput value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Facture en double, erreur…" />
      </ConfirmSheet>

      {/* ── Corriger le montant ────────────────────────────────────── */}
      <BottomSheet open={fixOpen} onClose={() => setFixOpen(false)}>
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Corriger le montant</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{payment.reference} · {client}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <label className={cn('flex h-14 items-center gap-2 rounded-lg border px-3.5', SURFACE.field)}>
            <input
              inputMode="numeric"
              aria-label="Débité (XAF)"
              value={fixXaf ? n0(Number(fixXaf)) : ''}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setFixXaf(v);
                const x = Number(v) || 0;
                if (x > 0 && frate > 0) setFixRmb(String(rmbForXaf(x, frate)));
              }}
              className={cn('min-w-0 flex-1 bg-transparent !text-[20px] font-semibold tabular-nums outline-none', TEXT.strong)}
            />
            <span className={cn('text-[15px] font-semibold', TEXT.muted)}>XAF</span>
          </label>
          <label className={cn('flex h-14 items-center gap-2 rounded-lg border px-3.5', SURFACE.field)}>
            <span className={cn('text-[18px] font-semibold', TEXT.strong)}>¥</span>
            <input
              inputMode="decimal"
              aria-label="Reçu (¥)"
              value={fixRmb}
              onChange={(e) => setFixRmb(e.target.value.replace(/[^0-9.,]/g, ''))}
              className={cn('min-w-0 flex-1 bg-transparent !text-[20px] font-semibold tabular-nums outline-none', TEXT.strong)}
            />
          </label>
        </div>
        <label className={cn('mt-2.5 flex h-14 items-center gap-2 rounded-lg border px-3.5', SURFACE.field)}>
          <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>Taux · 1 M XAF = ¥</span>
          <input
            inputMode="numeric"
            aria-label="Taux"
            value={fixRate}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              setFixRate(v);
              const r = Number(v) || 0;
              if (r > 0 && fx > 0) setFixRmb(String(rmbForXaf(fx, r)));
            }}
            className={cn('min-w-0 flex-1 bg-transparent !text-[17px] font-semibold tabular-nums outline-none', TEXT.strong)}
          />
          {frate === rateInt && <span className={cn('shrink-0 text-[15px] font-semibold', TEXT.muted)}>actuel</span>}
        </label>
        <KVBox
          className="mt-4"
          rows={[
            { label: 'Débité', before: n0(payment.amount_xaf), value: n0(fx) },
            ...(wallet && delta.kind !== 'refunded' ? [{
              label: `Solde de ${first}`,
              before: n0(wallet.balance_xaf),
              value: n0(delta.kind === 'debit' ? wallet.balance_xaf - delta.amount : delta.kind === 'credit' ? wallet.balance_xaf + delta.amount : wallet.balance_xaf),
            }] : []),
          ]}
        />
        {!amountsCoherent(fx, fr_, frate) && (
          <p className="mt-2 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">Au taux {n0(frate)}, {n0(fx)} XAF font ¥ {rmbForXaf(fx, frate)}.</p>
        )}
        <FieldLabel>Motif</FieldLabel>
        <TextInput value={fixReason} onChange={(e) => setFixReason(e.target.value)} placeholder="Facture corrigée par le fournisseur" />
        <BigButton className="mt-5" onClick={() => void saveFix()} loading={correctPayment.isPending} disabled={!fixValid}>Corriger</BigButton>
      </BottomSheet>

      {instructionInput && canSendInstruction && (
        <MobilePaymentInstructionSheet open={instructionOpen} onClose={() => setInstructionOpen(false)} entry={instructionEntryFromPayment(instructionInput)} />
      )}

      <MenuSheet open={more.open} onClose={more.hide} items={menu} />
      <Viewer item={viewing} onClose={() => setViewing(null)} actions={viewing?.url ? [{ label: 'Télécharger', onClick: () => download(viewing.url!, 'qr-fournisseur') }] : []} />
    </div>
  );
}
