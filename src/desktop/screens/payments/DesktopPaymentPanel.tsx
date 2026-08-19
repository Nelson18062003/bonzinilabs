/**
 * Desktop admin — payment detail as a desktop panel (archetype §2B/§4).
 *
 * The centrepiece is the FICHE DE PAIEMENT: one self-contained, always-light
 * card (¥ amount + rate + beneficiary coordinates + QR side by side) designed
 * to be shared with the Chinese partner as-is — one click copies or downloads
 * it as a PNG, and the full receipt exports as PDF. Coordinates stay one-click
 * copy rows because the operator re-types them into Alipay/WeChat/bank portals.
 *
 * Action model follows the RPC, not the old UI: « Passer en cours » is only
 * offered from `ready_for_payment` (process_payment rejects anything else —
 * the mobile fiche wrongly offered it from cash_scanned, see audit §6).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAdminPaymentDetail,
  useAdminPaymentProofs,
  useAdminPaymentTimeline,
  useProcessPayment,
  useAdminUploadPaymentProof,
} from '@/hooks/usePayments';
import { useCancelPayment, useAdminUpdateBeneficiaryInfo } from '@/hooks/useAdminPayments';
import {
  PAYMENT_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
  PAYMENT_REJECTION_REASONS,
  type PaymentStatus,
  type PaymentMethod,
} from '@/types/payment';
import { getPaymentSlaLevel } from '@/lib/paymentSla';
import { formatCurrencyRMB, formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  SOFT_PILL,
  paymentStatusTone,
  StatusPill,
  Holder,
  TextInput,
  FormField,
  PrimaryPill,
  SoftPill,
  Amount,
  Age,
  SecLabel,
  KV,
  RefChip,
  CenterDialog,
  EMERALD_PILL,
  VIOLET_PILL,
  DANGER_SOFT_PILL,
} from '@/desktop/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF, type PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';
import { captureQrDataUrl } from '@/components/payment-detail/paymentReceiptHelpers';
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Maximize2,
  MoreHorizontal,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { FilePreviewGrid } from '@/components/upload/FilePreviewGrid';
import { usePasteFiles } from '@/hooks/usePasteFiles';

function fmt(n: number) {
  return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const METHOD_COLOR: Record<string, string> = {
  alipay: '#1677FF',
  wechat: '#07C160',
  bank_transfer: '#8B5CF6',
  cash: '#E0322B',
};

// La fiche est un DOCUMENT partagé au partenaire : palette claire fixe,
// identique en thème sombre — comme le reçu PDF.
const FICHE = { strong: '#17151F', muted: '#6E6A80', line: 'rgba(0,0,0,0.06)' };

function FicheRow({ k, v, mono, accent }: { k: string; v: string; mono?: boolean; accent?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success('Copié !');
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Cliquer pour copier"
      className="group flex w-full items-center justify-between gap-3 py-[5px] text-left"
      style={{ borderTop: `1px solid ${FICHE.line}` }}
    >
      <span className="shrink-0 text-[11px]" style={{ color: FICHE.muted }}>
        {k}
      </span>
      <span
        className={cn('inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-bold tabular-nums', mono && 'font-mono text-[12px]')}
        style={{ color: accent ?? FICHE.strong }}
      >
        <span className="truncate">{v}</span>
        <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" style={{ color: FICHE.muted }} />
      </span>
    </button>
  );
}

function StepRow({ label, meta, state, last }: { label: string; meta?: string; state: 'completed' | 'current' | 'pending'; last?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            state === 'completed'
              ? 'border-[#34d399] bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
              : state === 'current'
                ? 'border-[#8B5CF6] text-[#8B5CF6]'
                : cn('border-black/[0.12] dark:border-white/[0.15]', TEXT.muted),
          )}
        >
          {state === 'completed' && <CheckCircle className="h-3 w-3" />}
          {state === 'current' && <span className="h-2 w-2 rounded-full bg-current" />}
        </div>
        {!last && <div className="my-0.5 w-0.5" style={{ height: 6, background: state === 'completed' ? '#34d399' : 'rgba(0,0,0,0.08)' }} />}
      </div>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pb-0.5">
        <p className={cn('text-[12px] font-semibold', state === 'pending' ? TEXT.muted : TEXT.strong)}>{label}</p>
        {meta && <p className={cn('shrink-0 text-[11px] tabular-nums', TEXT.muted)}>{meta}</p>}
      </div>
    </div>
  );
}

export function DesktopPaymentPanel({ paymentId }: { paymentId: string }) {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const { data: proofs } = useAdminPaymentProofs(paymentId);
  const { data: timeline } = useAdminPaymentTimeline(paymentId);

  const processPayment = useProcessPayment();
  const uploadProof = useAdminUploadPaymentProof();
  const cancelPayment = useCancelPayment();
  const updateBeneficiary = useAdminUpdateBeneficiaryInfo();

  const [lightbox, setLightbox] = useState<string | null>(null);
  const [proofIndex, setProofIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completeComment, setCompleteComment] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [showBenefEdit, setShowBenefEdit] = useState(false);
  const [benefDraft, setBenefDraft] = useState({ name: '', identifier: '', phone: '', email: '', bank: '', account: '', extra: '' });
  const [benefQrFile, setBenefQrFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState<'copy' | 'png' | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const ficheRef = useRef<HTMLDivElement>(null);

  useEffect(() => setProofIndex(0), [paymentId]);

  const close = useCallback(() => navigate('/m/payments'), [navigate]);

  const canProcess = hasPermission('canProcessPayments');
  const status = payment?.status as PaymentStatus | undefined;
  const isLocked = !payment || ['completed', 'rejected', 'cancelled_by_admin'].includes(payment.status);
  // RPC-accurate: process_payment('start_processing') only accepts ready_for_payment.
  const canStart = canProcess && status === 'ready_for_payment';
  const canComplete = canProcess && status === 'processing';
  const canReject = canProcess && !isLocked && status !== 'cash_pending';
  const isCash = payment?.method === 'cash';
  const canEditBeneficiary =
    canProcess && !isLocked && !isCash && ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment?.status ?? '');

  const adminProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'admin');
  const clientProofs = (proofs ?? []).filter((p) => p.uploaded_by_type !== 'admin');
  const allProofs = [...clientProofs, ...adminProofs];
  const missingAdminProof = status === 'processing' && !isCash && adminProofs.length === 0;

  // Deep-link actions from table hover buttons.
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingAction = searchParams.get('action');
  useEffect(() => {
    if (!payment || !pendingAction) return;
    if (canStart && pendingAction === 'start') {
      processPayment.mutate({ paymentId, action: 'start_processing' });
    }
    if (canComplete && pendingAction === 'complete') setShowComplete(true);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id, pendingAction]);

  usePasteFiles({
    onFiles: useCallback((files: File[]) => {
      setShowUpload(true);
      setUploadFiles((prev) => [...prev, ...files]);
    }, []),
    enabled: canProcess && !isLocked && !showReject && !showComplete && !showCancel && !showBenefEdit && !lightbox,
  });

  const openBenefEdit = useCallback(() => {
    if (!payment) return;
    setBenefDraft({
      name: payment.beneficiary_name ?? '',
      identifier: (payment as { beneficiary_identifier?: string | null }).beneficiary_identifier ?? '',
      phone: payment.beneficiary_phone ?? '',
      email: payment.beneficiary_email ?? '',
      bank: payment.beneficiary_bank_name ?? '',
      account: payment.beneficiary_bank_account ?? '',
      extra: (payment as { beneficiary_bank_extra?: string | null }).beneficiary_bank_extra ?? '',
    });
    setBenefQrFile(null);
    setShowBenefEdit(true);
  }, [payment]);

  const saveBeneficiary = useCallback(() => {
    updateBeneficiary.mutate(
      {
        paymentId,
        beneficiaryInfo: {
          beneficiary_name: benefDraft.name || undefined,
          beneficiary_identifier: benefDraft.identifier || undefined,
          beneficiary_identifier_type: benefDraft.identifier ? 'id' : undefined,
          beneficiary_phone: benefDraft.phone || undefined,
          beneficiary_email: benefDraft.email || undefined,
          beneficiary_bank_name: benefDraft.bank || undefined,
          beneficiary_bank_account: benefDraft.account || undefined,
          beneficiary_bank_extra: benefDraft.extra || undefined,
        },
        qrCodeFile: benefQrFile ?? undefined,
      },
      { onSuccess: () => setShowBenefEdit(false) },
    );
  }, [paymentId, benefDraft, benefQrFile, updateBeneficiary]);

  const handleUpload = useCallback(() => {
    if (uploadFiles.length === 0) return;
    // Sequential uploads; the hook toasts per file.
    (async () => {
      for (const file of uploadFiles) {
        // eslint-disable-next-line no-await-in-loop
        await uploadProof.mutateAsync({ paymentId, file });
      }
      setShowUpload(false);
      setUploadFiles([]);
    })().catch(() => {});
  }, [uploadFiles, uploadProof, paymentId]);

  // ── Fiche → PNG (copie presse-papiers ou téléchargement) ─────────────────
  const exportFiche = useCallback(
    async (target: 'copy' | 'png') => {
      if (!ficheRef.current || !payment || exporting) return;
      setExporting(target);
      try {
        const dataUrl = await toPng(ficheRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
        if (target === 'copy' && typeof ClipboardItem !== 'undefined') {
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Fiche copiée — collez-la dans WeChat / WhatsApp');
        } else {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `fiche_${payment.reference}.png`;
          a.click();
          toast.success('Fiche téléchargée');
        }
      } catch {
        toast.error("Impossible d'exporter la fiche");
      } finally {
        setExporting(null);
      }
    },
    [payment, exporting],
  );

  // ── Reçu PDF (même modèle que la fiche mobile) ───────────────────────────
  const handleDownloadReceipt = useCallback(async () => {
    if (!payment || pdfBusy) return;
    setPdfBusy(true);
    try {
      const name = payment.profiles ? `${payment.profiles.first_name} ${payment.profiles.last_name}` : 'Client';
      const cash = payment as {
        cash_signature_url?: string | null;
        cash_signed_by_name?: string | null;
        cash_signature_timestamp?: string | null;
      };
      const receiptData: PaymentReceiptData = {
        id: payment.id,
        reference: payment.reference,
        created_at: payment.created_at,
        processed_at: payment.processed_at,
        amount_xaf: payment.amount_xaf,
        amount_rmb: payment.amount_rmb,
        exchange_rate: payment.exchange_rate,
        method: payment.method,
        status: payment.status,
        client_name: name,
        client_phone: payment.profiles?.phone,
        beneficiary_name: payment.beneficiary_name,
        beneficiary_phone: payment.beneficiary_phone,
        beneficiary_email: payment.beneficiary_email,
        beneficiary_bank_name: payment.beneficiary_bank_name,
        beneficiary_bank_account: payment.beneficiary_bank_account,
        beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
        cashPaymentQrDataUrl: payment.method === 'cash' ? await captureQrDataUrl(payment.id) : null,
        cash_signature_url: cash.cash_signature_url,
        cash_signed_by_name: cash.cash_signed_by_name,
        cash_signature_timestamp: cash.cash_signature_timestamp,
        adminProofs: adminProofs.map((p) => ({
          file_url: p.file_url,
          file_type: p.file_type,
          file_name: p.file_name,
          created_at: p.created_at,
        })),
      };
      await downloadPDF(
        <PaymentReceiptPDF data={receiptData} />,
        `recu_paiement_${payment.reference}_${name.replace(/\s+/g, '_')}.pdf`,
      );
      toast.success('Reçu PDF téléchargé');
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setPdfBusy(false);
    }
  }, [payment, adminProofs, pdfBusy]);

  const panelClasses = cn(
    'flex w-[560px] shrink-0 flex-col overflow-hidden rounded-[24px]',
    SURFACE.card,
    'ring-1 ring-black/[0.06] dark:ring-white/[0.06]',
  );

  if (isLoading || !payment) {
    return (
      <aside className={panelClasses}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
          {isLoading ? (
            <Loader2 className={cn('h-6 w-6 animate-spin', TEXT.muted)} />
          ) : (
            <>
              <Holder icon={AlertTriangle} tone="danger" size="lg" />
              <p className={cn('text-[13px]', TEXT.muted)}>Paiement introuvable</p>
            </>
          )}
        </div>
      </aside>
    );
  }

  const clientName = payment.profiles ? `${payment.profiles.first_name} ${payment.profiles.last_name}` : 'Client inconnu';
  const statusConfig = PAYMENT_STATUS_CONFIG[payment.status as PaymentStatus] || { label: payment.status };
  const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);
  const methodColor = METHOD_COLOR[payment.method] ?? '#8B5CF6';
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] || payment.method;
  const rateInt = payment.exchange_rate
    ? payment.exchange_rate < 1
      ? Math.round(payment.exchange_rate * 1_000_000)
      : Math.round(payment.exchange_rate)
    : 0;
  const isCashSelf = (payment as { cash_beneficiary_type?: string | null }).cash_beneficiary_type !== 'other';
  const cashBeneficiaryName =
    (payment as { cash_beneficiary_type?: string | null }).cash_beneficiary_type === 'other'
      ? [
          (payment as { cash_beneficiary_first_name?: string | null }).cash_beneficiary_first_name,
          (payment as { cash_beneficiary_last_name?: string | null }).cash_beneficiary_last_name,
        ]
          .filter(Boolean)
          .join(' ') || clientName
      : clientName;
  const identifier = (payment as { beneficiary_identifier?: string | null }).beneficiary_identifier;
  const bankExtra = (payment as { beneficiary_bank_extra?: string | null }).beneficiary_bank_extra;
  const hasBeneficiaryInfo = !!(payment.beneficiary_name || payment.beneficiary_bank_account || payment.beneficiary_qr_code_url || payment.beneficiary_phone || payment.beneficiary_email || identifier);

  // QR de la fiche : QR bénéficiaire (Alipay/WeChat), sinon QR cash actif.
  const showCashQr = isCash && !['completed', 'rejected', 'cancelled_by_admin'].includes(payment.status);
  const ficheHasQr = !!payment.beneficiary_qr_code_url || showCashQr;

  // Timeline: built from real events, completed steps stamped with their time.
  const evt = (type: string) => timeline?.find((e) => e.event_type === type);
  const stamp = (type: string) => {
    const e = evt(type);
    return e ? format(new Date(e.created_at), 'd MMM, HH:mm', { locale: fr }) : undefined;
  };
  const doneOrder: PaymentStatus[] = ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'completed'];
  const reached = (s: PaymentStatus) => {
    if (payment.status === 'rejected' || payment.status === 'cancelled_by_admin') return doneOrder.indexOf(s) <= 0;
    return doneOrder.indexOf(doneOrder.includes(payment.status as PaymentStatus) ? (payment.status as PaymentStatus) : 'created') >= doneOrder.indexOf(s);
  };
  const stateFor = (s: PaymentStatus): 'completed' | 'current' | 'pending' =>
    payment.status === s ? 'current' : reached(s) ? 'completed' : 'pending';

  // Preuves : useAdminPaymentProofs renvoie file_url DÉJÀ signé.
  const proof = allProofs[proofIndex];
  const proofIsImage = proof?.file_type?.startsWith('image/');
  const proofUrl = proof?.file_url;

  return (
    <aside className={panelClasses}>
      {/* ── En-tête épinglé ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
        <RefChip>{payment.reference}</RefChip>
        <StatusPill tone={paymentStatusTone(payment.status)} label={statusConfig.label} />
        {slaLevel && <Age date={payment.created_at} level={slaLevel} relOnly />}
        <div className="ml-auto flex items-center gap-1.5">
          {canStart && (
            <button
              type="button"
              onClick={() => processPayment.mutate({ paymentId, action: 'start_processing' })}
              disabled={processPayment.isPending}
              className={cn('inline-flex items-center gap-1 whitespace-nowrap px-3 py-2 text-[12px] disabled:opacity-60', VIOLET_PILL)}
            >
              {processPayment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Passer en cours
            </button>
          )}
          {canComplete && (
            <button type="button" onClick={() => setShowComplete(true)} className={cn('px-3.5 py-2 text-[12px]', EMERALD_PILL)}>
              Valider
            </button>
          )}
          {canReject && (
            <button type="button" onClick={() => setShowReject(true)} className={cn('px-3 py-2 text-[12px]', DANGER_SOFT_PILL)}>
              Rejeter
            </button>
          )}
          <Holder icon={Download} size="sm" onClick={handleDownloadReceipt} ariaLabel="Télécharger le reçu PDF" />
          <div className="relative">
            <Holder icon={MoreHorizontal} size="sm" onClick={() => setMenuOpen((v) => !v)} ariaLabel="Plus d'actions" />
            {menuOpen && (
              <div className={cn('absolute right-0 top-[calc(100%+6px)] z-40 min-w-[210px] overflow-hidden rounded-2xl p-1.5', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
                {canProcess && !isLocked && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowUpload(true); }}
                    className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold', TEXT.strong, 'hover:bg-[#EDEAFA]/50 dark:hover:bg-white/[0.05]')}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter une preuve
                  </button>
                )}
                {isSuperAdmin && !isLocked && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowCancel(true); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#C0504D] hover:bg-[#FBE7E7]/60 dark:text-[#E79A9A] dark:hover:bg-[#3A2526]/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Annuler le paiement
                  </button>
                )}
              </div>
            )}
          </div>
          <Holder icon={X} size="sm" onClick={close} ariaLabel="Fermer" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {/* ── Fiche de paiement — le document à partager ─────────────────── */}
        <SecLabel
          className="mb-2"
          right={
            canEditBeneficiary ? (
              <button type="button" onClick={openBenefEdit} className="text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
                {hasBeneficiaryInfo ? 'Modifier le bénéficiaire' : 'Ajouter le bénéficiaire'}
              </button>
            ) : undefined
          }
        >
          Fiche de paiement
        </SecLabel>

        <div ref={ficheRef} className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08]">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${FICHE.line}` }}>
            <span className="inline-flex min-w-0 items-center gap-2">
              <PaymentMethodLogo method={payment.method as 'alipay' | 'wechat' | 'bank_transfer' | 'cash'} size={20} />
              <span className="truncate text-[13px] font-extrabold" style={{ color: methodColor }}>
                {methodLabel}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[11.5px] font-bold" style={{ color: FICHE.muted }}>
              {payment.reference}
            </span>
          </div>

          <div className="flex items-start gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: FICHE.muted }}>
                Le fournisseur reçoit
              </div>
              <div className="text-[30px] font-extrabold leading-[36px] tabular-nums" style={{ color: FICHE.strong }}>
                {formatCurrencyRMB(payment.amount_rmb)}
              </div>
              <div className="mt-0.5 text-[11.5px] tabular-nums" style={{ color: FICHE.muted }}>
                {fmt(payment.amount_xaf)} XAF débités · taux{' '}
                <b style={{ color: FICHE.strong }}>¥{formatNumber(rateInt)}</b> pour 1 000 000 XAF
                {payment.rate_is_custom && (
                  <span className="ml-1.5 rounded-full bg-[#EAE7FA] px-1.5 py-px text-[9px] font-extrabold uppercase text-[#5B4CC4]">
                    perso
                  </span>
                )}
              </div>

              <div className="mt-2.5">
                {isCash ? (
                  <div style={{ borderTop: `1px solid ${FICHE.line}` }} className="pt-1.5">
                    <div className="text-[13px] font-bold" style={{ color: FICHE.strong }}>
                      {cashBeneficiaryName}
                    </div>
                    <div className="text-[11px]" style={{ color: FICHE.muted }}>
                      {isCashSelf ? 'Le client lui-même' : 'Tiers'} · retrait cash — scan + signature par l'agent
                    </div>
                  </div>
                ) : hasBeneficiaryInfo ? (
                  <div>
                    {payment.beneficiary_name && <FicheRow k="Bénéficiaire" v={payment.beneficiary_name} />}
                    {identifier && (
                      <FicheRow
                        k={payment.method === 'wechat' ? 'WeChat ID' : payment.method === 'alipay' ? 'Alipay ID' : 'Identifiant'}
                        v={identifier}
                        mono
                        accent={methodColor}
                      />
                    )}
                    {payment.beneficiary_bank_name && <FicheRow k="Banque" v={payment.beneficiary_bank_name} />}
                    {payment.beneficiary_bank_account && <FicheRow k="N° de compte" v={payment.beneficiary_bank_account} mono accent={methodColor} />}
                    {bankExtra && <FicheRow k="SWIFT / IBAN" v={bankExtra} mono />}
                    {payment.beneficiary_phone && <FicheRow k="Téléphone" v={payment.beneficiary_phone} mono />}
                    {payment.beneficiary_email && <FicheRow k="Email" v={payment.beneficiary_email} />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-[#F8EFD8] px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#9A6B12]" />
                    <div>
                      <div className="text-[12.5px] font-bold text-[#9A6B12]">Infos bénéficiaire manquantes</div>
                      <div className="text-[11px] text-[#9A6B12]/80">Paiement impossible sans ces informations</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {ficheHasQr && (
              <div className="shrink-0">
                <div className="rounded-xl bg-white p-1.5" style={{ border: `1px solid rgba(0,0,0,0.10)` }}>
                  {payment.beneficiary_qr_code_url ? (
                    <button type="button" onClick={() => setLightbox(payment.beneficiary_qr_code_url!)} aria-label="Agrandir le QR">
                      <img
                        src={payment.beneficiary_qr_code_url}
                        crossOrigin="anonymous"
                        alt="QR code bénéficiaire"
                        className="block h-[132px] w-[132px] bg-white object-contain"
                      />
                    </button>
                  ) : (
                    <QRCodeSVG
                      id={`qr-${payment.id}`}
                      value={JSON.stringify({ type: 'BONZINI_CASH_PAYMENT', id: payment.id, v: 1 })}
                      size={132}
                      level="M"
                      includeMargin={false}
                    />
                  )}
                </div>
                <div className="mt-1 text-center text-[9.5px] font-bold uppercase tracking-wider" style={{ color: FICHE.muted }}>
                  {payment.beneficiary_qr_code_url ? 'Scanner pour payer' : 'QR agent cash'}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-1.5" style={{ borderTop: `1px solid ${FICHE.line}` }}>
            <span className="text-[10px] font-extrabold tracking-[0.14em]" style={{ color: FICHE.muted }}>
              BONZINI LABS
            </span>
            <span className="text-[10px] tabular-nums" style={{ color: FICHE.muted }}>
              {format(new Date(payment.created_at), 'd MMM yyyy, HH:mm', { locale: fr })}
            </span>
          </div>
        </div>

        {/* Actions de partage — hors capture */}
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => exportFiche('copy')}
            disabled={!!exporting}
            className={cn('flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50', SOFT_PILL)}
          >
            {exporting === 'copy' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
            Copier l'image
          </button>
          <button
            type="button"
            onClick={() => exportFiche('png')}
            disabled={!!exporting}
            className={cn('flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50', SOFT_PILL)}
          >
            {exporting === 'png' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Image .png
          </button>
          <button
            type="button"
            onClick={handleDownloadReceipt}
            disabled={pdfBusy}
            className={cn('flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50', SOFT_PILL)}
          >
            {pdfBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Reçu PDF
          </button>
        </div>

        {!hasBeneficiaryInfo && !isCash && canEditBeneficiary && (
          <button type="button" onClick={openBenefEdit} className={cn('mt-2 w-full px-3 py-2 text-[12px]', VIOLET_PILL)}>
            Compléter le bénéficiaire
          </button>
        )}

        {/* ── Preuves ───────────────────────────────────────────────────── */}
        <div className="mt-3.5">
          {missingAdminProof && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-black/10 px-3.5 py-2 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2.5">
                <Upload className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                <div className="min-w-0">
                  <p className={cn('text-[12.5px] font-bold', TEXT.strong)}>Preuve de paiement admin</p>
                  <p className={cn('truncate text-[11px]', TEXT.muted)}>Attendue avant « Valider » — Ctrl+V colle une capture</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowUpload(true)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold', SOFT_PILL)}>
                Ajouter
              </button>
            </div>
          )}

          <SecLabel
            className="mb-2"
            right={
              allProofs.length > 1 ? (
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold tabular-nums', TEXT.muted)}>
                  <button type="button" disabled={proofIndex <= 0} onClick={() => setProofIndex((i) => i - 1)} className="disabled:opacity-30">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  {proofIndex + 1}/{allProofs.length}
                  <button
                    type="button"
                    disabled={proofIndex >= allProofs.length - 1}
                    onClick={() => setProofIndex((i) => i + 1)}
                    className="disabled:opacity-30"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </span>
              ) : canProcess && !isLocked && allProofs.length > 0 ? (
                <button type="button" onClick={() => setShowUpload(true)} className="text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
                  + Ajouter
                </button>
              ) : undefined
            }
          >
            Preuves de paiement · {allProofs.length}
          </SecLabel>

          {proof ? (
            <>
              <div className="overflow-hidden rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.06]">
                {proofIsImage && proofUrl ? (
                  <img src={proofUrl} alt={proof.file_name} className="max-h-[240px] w-full bg-black/5 object-contain dark:bg-white/5" />
                ) : (
                  <div className={cn('flex h-[140px] w-full flex-col items-center justify-center gap-1.5', SURFACE.canvas)}>
                    <FileText className={cn('h-8 w-8', TEXT.muted)} />
                    <span className={cn('max-w-full truncate px-3 text-[11px] font-bold', TEXT.muted)}>{proof.file_name}</span>
                  </div>
                )}
              </div>
              <div className={cn('mt-1.5 flex items-center gap-2 text-[11px]', TEXT.muted)}>
                <span
                  className={cn(
                    'rounded-full px-2 py-px text-[10px] font-extrabold uppercase',
                    proof.uploaded_by_type === 'admin'
                      ? 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]'
                      : 'bg-black/[0.05] dark:bg-white/[0.08]',
                  )}
                >
                  {proof.uploaded_by_type === 'admin' ? 'Admin' : 'Client'}
                </span>
                <span className="min-w-0 truncate font-semibold">{proof.file_name}</span>
                <span className="ml-auto shrink-0 tabular-nums">{format(new Date(proof.created_at), 'd MMM, HH:mm', { locale: fr })}</span>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {proofIsImage ? (
                  <button
                    type="button"
                    disabled={!proofUrl}
                    onClick={() => proofUrl && setLightbox(proofUrl)}
                    className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold disabled:opacity-40', SOFT_PILL)}
                  >
                    <Maximize2 className="h-3 w-3" /> Agrandir
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!proofUrl}
                    onClick={() => proofUrl && window.open(proofUrl, '_blank', 'noopener')}
                    className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold disabled:opacity-40', SOFT_PILL)}
                  >
                    <ExternalLink className="h-3 w-3" /> Ouvrir
                  </button>
                )}
                <a
                  href={proofUrl ?? undefined}
                  download={proof.file_name}
                  target="_blank"
                  rel="noopener"
                  className={cn(
                    'flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold no-underline',
                    SOFT_PILL,
                    !proofUrl && 'pointer-events-none opacity-40',
                  )}
                >
                  <Download className="h-3 w-3" /> Télécharger
                </a>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-black/10 p-4 text-center dark:border-white/10">
              <div className={cn('text-[12px] font-bold', TEXT.muted)}>Aucune preuve pour l'instant</div>
              <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>La capture du transfert apparaîtra ici</div>
              {canProcess && !isLocked && (
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="mx-auto mt-2 flex items-center gap-1 rounded-full bg-[#EAE7FA] px-3 py-1.5 text-[11px] font-bold text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]"
                >
                  <Plus className="h-3 w-3" /> Ajouter (Ctrl+V)
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Faits ─────────────────────────────────────────────────────── */}
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
          <KV
            k="Client"
            v={
              <button type="button" onClick={() => navigate(`/m/clients/${payment.user_id}`)} className="text-[#6B5BD2] dark:text-[#A99BF0]">
                {clientName}
              </button>
            }
          />
          <KV k="Téléphone" v={payment.profiles?.phone || '—'} />
          <KV k="Créé le" v={format(new Date(payment.created_at), 'd MMM, HH:mm', { locale: fr })} />
          <KV k="Solde après débit" v={payment.balance_after != null ? `${fmt(payment.balance_after)} XAF` : '—'} />
          <KV k="Lot" v={(payment as { batch_id?: string | null }).batch_id ? 'Paiement groupé' : '—'} />
          <KV k="Traité par" v={payment.processed_at ? format(new Date(payment.processed_at), 'd MMM, HH:mm', { locale: fr }) : '—'} />
        </div>

        {payment.admin_comment && (
          <div className={cn('mt-3 flex items-baseline gap-2.5 rounded-2xl px-3 py-2', SURFACE.canvas)}>
            <span className={cn('shrink-0 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Note interne</span>
            <p className={cn('truncate text-[12.5px]', TEXT.strong)}>{payment.admin_comment}</p>
          </div>
        )}

        {/* ── Suivi ─────────────────────────────────────────────────────── */}
        <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <SecLabel className="mb-1.5">Suivi</SecLabel>
          <StepRow state="completed" label="Paiement créé — wallet débité" meta={stamp('created') ?? format(new Date(payment.created_at), 'd MMM, HH:mm', { locale: fr })} />
          {payment.status === 'rejected' || payment.status === 'cancelled_by_admin' ? (
            <StepRow
              state="current"
              label={payment.status === 'rejected' ? 'Refusé — wallet remboursé' : 'Annulé (admin) — wallet remboursé'}
              meta={stamp('rejected')}
              last
            />
          ) : isCash ? (
            <>
              <StepRow state={payment.status === 'cash_scanned' ? 'current' : reached('processing') ? 'completed' : 'pending'} label="QR scanné par l'agent" />
              <StepRow state={stateFor('completed')} label="Cash remis — signature" last />
            </>
          ) : (
            <>
              <StepRow
                state={payment.status === 'waiting_beneficiary_info' ? 'current' : 'completed'}
                label={payment.status === 'waiting_beneficiary_info' ? 'En attente des infos bénéficiaire' : 'Bénéficiaire complet'}
              />
              <StepRow state={stateFor('ready_for_payment')} label="Prêt à payer" />
              <StepRow state={stateFor('processing')} label={`Traitement (${PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]})`} meta={stamp('processing')} />
              <StepRow state={stateFor('completed')} label="Effectué — preuve envoyée au client" meta={stamp('completed')} last />
            </>
          )}
        </div>
      </div>

      {/* ── Dialogue : valider (compléter) ──────────────────────────────── */}
      <CenterDialog
        open={showComplete}
        onClose={() => setShowComplete(false)}
        onConfirm={!processPayment.isPending ? () => processPayment.mutate({ paymentId, action: 'complete', comment: completeComment || undefined }, { onSuccess: () => setShowComplete(false) }) : undefined}
        title={`Valider le paiement ${payment.reference}`}
        footer={
          <>
            <SoftPill onClick={() => setShowComplete(false)} className="flex-1">
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={() => processPayment.mutate({ paymentId, action: 'complete', comment: completeComment || undefined }, { onSuccess: () => setShowComplete(false) })}
              loading={processPayment.isPending}
              className="flex-[1.4] bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white"
            >
              Marquer effectué
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <div className={cn('rounded-2xl p-3 text-center', SURFACE.canvas)}>
            <Amount value={formatCurrencyRMB(payment.amount_rmb)} size="lg" />
            <div className={cn('mt-1 text-[12px] tabular-nums', TEXT.muted)}>
              {fmt(payment.amount_xaf)} XAF · {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]} · {clientName}
            </div>
          </div>
          {missingAdminProof && (
            <div className="flex items-start gap-2 rounded-2xl bg-[#F8EFD8] p-3 dark:bg-[#372D14]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
              <p className="text-[12.5px] text-[#9A6B12] dark:text-[#E7C083]">
                Aucune preuve de paiement admin n'a été jointe. Recommandé : ajoutez la capture du virement/transfert avant de valider.
              </p>
            </div>
          )}
          <FormField label="Commentaire visible par le client (optionnel)">
            <textarea
              value={completeComment}
              onChange={(e) => setCompleteComment(e.target.value)}
              rows={2}
              placeholder="Ex. : Payé via Alipay, référence du transfert…"
              className={cn('w-full resize-none rounded-2xl p-3 text-[14px] outline-none', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
          </FormField>
          <p className={cn('text-center text-[11px]', TEXT.muted)}>⌘⏎ pour confirmer · Esc pour annuler</p>
        </div>
      </CenterDialog>

      {/* ── Dialogue : rejeter ──────────────────────────────────────────── */}
      <CenterDialog
        open={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={
          rejectReason && !processPayment.isPending
            ? () =>
                processPayment.mutate(
                  { paymentId, action: 'reject', comment: rejectComment.trim() || rejectReason },
                  { onSuccess: () => setShowReject(false) },
                )
            : undefined
        }
        title={`Refuser le paiement ${payment.reference}`}
        footer={
          <>
            <SoftPill onClick={() => setShowReject(false)} className="flex-1">
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={() =>
                processPayment.mutate(
                  { paymentId, action: 'reject', comment: rejectComment.trim() || rejectReason },
                  { onSuccess: () => setShowReject(false) },
                )
              }
              loading={processPayment.isPending}
              disabled={!rejectReason}
              danger
              className="flex-[1.4]"
            >
              Confirmer le refus
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-2xl bg-[#DEEFE5] p-3 dark:bg-[#1E3A2C]">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" />
            <p className="text-[12.5px] text-[#2E7D52] dark:text-[#7FCBA0]">
              Le wallet de {clientName} sera automatiquement remboursé de {fmt(payment.amount_xaf)} XAF.
            </p>
          </div>
          <div>
            <SecLabel className="mb-2">Motif du refus</SecLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {PAYMENT_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold ring-1 transition-colors',
                    rejectReason === reason
                      ? 'bg-[#FBE7E7] text-[#C0504D] ring-[#C0504D]/40 dark:bg-[#3A2526] dark:text-[#E79A9A]'
                      : cn(SURFACE.canvas, 'ring-transparent', TEXT.strong),
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
          <FormField label="Précision (optionnel — visible par le client)">
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={2}
              placeholder="Détail du motif…"
              className={cn('w-full resize-none rounded-2xl p-3 text-[14px] outline-none', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
          </FormField>
        </div>
      </CenterDialog>

      {/* ── Dialogue : bénéficiaire ─────────────────────────────────────── */}
      <CenterDialog
        open={showBenefEdit}
        onClose={() => setShowBenefEdit(false)}
        onConfirm={!updateBeneficiary.isPending ? saveBeneficiary : undefined}
        title={`Bénéficiaire · ${PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}`}
        footer={
          <>
            <SoftPill onClick={() => setShowBenefEdit(false)} className="flex-1">
              Annuler
            </SoftPill>
            <PrimaryPill onClick={saveBeneficiary} loading={updateBeneficiary.isPending} className="flex-[1.4] bg-[#8B5CF6] text-white dark:bg-[#8B5CF6] dark:text-white">
              Enregistrer
            </PrimaryPill>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nom" className="col-span-2">
            <TextInput value={benefDraft.name} onChange={(e) => setBenefDraft({ ...benefDraft, name: e.target.value })} placeholder="Ex. : Zhang Wei" />
          </FormField>
          {(payment.method === 'alipay' || payment.method === 'wechat') && (
            <>
              <FormField label={payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}>
                <TextInput value={benefDraft.identifier} onChange={(e) => setBenefDraft({ ...benefDraft, identifier: e.target.value })} />
              </FormField>
              <FormField label="QR code (image)">
                <label className={cn('flex h-12 cursor-pointer items-center justify-between rounded-2xl px-4 text-[13px]', SURFACE.card, SURFACE.shadow, benefQrFile ? TEXT.strong : TEXT.muted)}>
                  <span className="truncate">{benefQrFile ? benefQrFile.name : 'Choisir un fichier…'}</span>
                  <Upload className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setBenefQrFile(e.target.files?.[0] ?? null)} />
                </label>
              </FormField>
            </>
          )}
          {payment.method === 'bank_transfer' && (
            <>
              <FormField label="Banque">
                <TextInput value={benefDraft.bank} onChange={(e) => setBenefDraft({ ...benefDraft, bank: e.target.value })} placeholder="Ex. : Bank of China" />
              </FormField>
              <FormField label="N° de compte">
                <TextInput value={benefDraft.account} onChange={(e) => setBenefDraft({ ...benefDraft, account: e.target.value })} />
              </FormField>
              <FormField label="SWIFT / IBAN" className="col-span-2">
                <TextInput value={benefDraft.extra} onChange={(e) => setBenefDraft({ ...benefDraft, extra: e.target.value })} />
              </FormField>
            </>
          )}
          <FormField label="Téléphone">
            <TextInput value={benefDraft.phone} onChange={(e) => setBenefDraft({ ...benefDraft, phone: e.target.value })} type="tel" placeholder="+86 …" />
          </FormField>
          <FormField label="Email">
            <TextInput value={benefDraft.email} onChange={(e) => setBenefDraft({ ...benefDraft, email: e.target.value })} type="email" />
          </FormField>
        </div>
      </CenterDialog>

      {/* ── Dialogue : ajouter des preuves ──────────────────────────────── */}
      <CenterDialog
        open={showUpload}
        onClose={() => {
          setShowUpload(false);
          setUploadFiles([]);
        }}
        onConfirm={uploadFiles.length > 0 && !uploadProof.isPending ? handleUpload : undefined}
        title="Ajouter une preuve de paiement"
        footer={
          <>
            <SoftPill
              onClick={() => {
                setShowUpload(false);
                setUploadFiles([]);
              }}
              className="flex-1"
            >
              Annuler
            </SoftPill>
            <PrimaryPill onClick={handleUpload} loading={uploadProof.isPending} disabled={uploadFiles.length === 0} className="flex-1">
              Ajouter ({uploadFiles.length})
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <PasteDropZone onFiles={(files) => setUploadFiles((prev) => [...prev, ...files])} enabled={false} busy={uploadProof.isPending} />
          <FilePreviewGrid files={uploadFiles} onRemove={(i) => setUploadFiles((prev) => prev.filter((_, idx) => idx !== i))} />
        </div>
      </CenterDialog>

      {/* ── Dialogue : annuler (super admin) ────────────────────────────── */}
      <CenterDialog
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title={`Annuler le paiement ${payment.reference} ?`}
        footer={
          <>
            <SoftPill onClick={() => setShowCancel(false)} className="flex-1">
              Retour
            </SoftPill>
            <PrimaryPill onClick={() => cancelPayment.mutate({ paymentId }, { onSuccess: close })} loading={cancelPayment.isPending} danger className="flex-[1.4]">
              Confirmer l'annulation
            </PrimaryPill>
          </>
        }
      >
        <p className={cn('text-[13px]', TEXT.muted)}>
          Le paiement sera marqué annulé et le wallet de {clientName} remboursé de {fmt(payment.amount_xaf)} XAF.
        </p>
      </CenterDialog>

      {/* ── Visionneuse ─────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black" onClick={() => setLightbox(null)}>
          <button
            type="button"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Fermer"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img src={lightbox} className="max-h-full max-w-full object-contain p-4" onClick={(e) => e.stopPropagation()} alt="Preuve" />
        </div>
      )}
    </aside>
  );
}
