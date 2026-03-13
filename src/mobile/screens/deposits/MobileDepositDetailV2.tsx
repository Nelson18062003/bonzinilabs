// ============================================================
// MODULE DEPOTS V2 — MobileDepositDetailV2
// UI selon maquette v3 : header ref + Relevé, sous-header badge+MIcon,
// card montant centré, preuves 70×70, infos rows, suivi collapsible,
// boutons fixes en bas selon statut
// Logique 100% identique à MobileDepositDetail.tsx
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useAdminDepositDetail,
  useAdminDepositProofs,
  useAdminDepositTimeline,
  useAdminWalletByUserId,
  useValidateDeposit,
  useRejectDeposit,
  useRequestCorrection,
  useStartDepositReview,
  useAdminUploadProofs,
  useAdminDeleteProof,
  useDeleteDeposit,
} from '@/hooks/useAdminDeposits';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS_SHORT,
  REJECTION_REASONS,
  PROOF_DELETE_REASONS,
} from '@/types/deposit';
import { buildDepositTimelineSteps, getStepColors, getDepositSlaLevel } from '@/lib/depositTimeline';
import { formatXAF, formatCurrency, formatRelativeDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Loader2,
  FileText,
  CheckCircle,
  AlertTriangle,
  Bell,
  BellOff,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  Plus,
  Eye,
  Download,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { DepositReceiptPDF } from '@/lib/pdf/templates/DepositReceiptPDF';
import type { DepositReceiptData } from '@/lib/pdf/templates/DepositReceiptPDF';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

// ── Couleurs maquette ────────────────────────────────────────
const GR = '#34d399';
const V = '#A947FE';
const O = '#FE560D';
const RED = '#ef4444';
const BLUE = '#3b82f6';
const GOLD = '#F3A745';
const t = {
  bg: '#f5f3f7',
  card: '#ffffff',
  text: '#1a1028',
  sub: '#7a7290',
  dim: '#c4bdd0',
  border: '#ebe6f0',
};

// ── Familles de méthode ──────────────────────────────────────
const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean }> = {
  BANK: { letter: 'B', bg: '#1e3a5f' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true },
  WAVE: { letter: 'W', bg: '#1dc3e3' },
};

function getFamilyFromMethod(method: string): string {
  if (['bank_transfer', 'bank_cash'].includes(method)) return 'BANK';
  if (method === 'agency_cash') return 'AGENCY_BONZINI';
  if (['om_transfer', 'om_withdrawal'].includes(method)) return 'ORANGE_MONEY';
  if (['mtn_transfer', 'mtn_withdrawal'].includes(method)) return 'MTN_MONEY';
  if (method === 'wave') return 'WAVE';
  return 'BANK';
}

// ── Composant MIcon ──────────────────────────────────────────
function MIcon({ family, size = 20 }: { family: string; size?: number }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: f.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.38),
        color: f.dark ? '#1a1028' : '#fff',
        fontWeight: 900,
        flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {f.letter}
    </div>
  );
}

// ── Point SLA ────────────────────────────────────────────────
function SlaDot({ level }: { level: 'fresh' | 'aging' | 'overdue' }) {
  const color = level === 'fresh' ? GR : level === 'aging' ? GOLD : RED;
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined,
      }}
    />
  );
}

// ── Status colors inline ─────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  created: t.sub,
  awaiting_proof: GOLD,
  proof_submitted: BLUE,
  admin_review: V,
  validated: GR,
  rejected: RED,
  pending_correction: O,
  cancelled: t.sub,
};

// ── Formatage montant ────────────────────────────────────────
function fmt(n: number) {
  return Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

// ── Composant principal ──────────────────────────────────────
export function MobileDepositDetailV2() {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { data: deposit, isLoading } = useAdminDepositDetail(depositId);
  const { data: proofs } = useAdminDepositProofs(depositId);
  const { data: timeline } = useAdminDepositTimeline(depositId);
  const { data: wallet } = useAdminWalletByUserId(deposit?.user_id);

  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  const requestCorrection = useRequestCorrection();
  const startReview = useStartDepositReview();
  const uploadProofs = useAdminUploadProofs();
  const deleteProof = useAdminDeleteProof();
  const deleteDeposit = useDeleteDeposit();

  // Validate modal state
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [sendNotification, setSendNotification] = useState(true);

  // Reject modal state
  const [showRejectSheet, setShowRejectSheet] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');

  // Correction modal state
  const [showCorrectionSheet, setShowCorrectionSheet] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  // Proof management state
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [showDeleteProofSheet, setShowDeleteProofSheet] = useState<string | null>(null);
  const [deleteProofReason, setDeleteProofReason] = useState('');
  const [customDeleteReason, setCustomDeleteReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Delete deposit state
  const [showDeleteDepositSheet, setShowDeleteDepositSheet] = useState(false);

  // Suivi collapsible
  const [showSuivi, setShowSuivi] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Initialize confirmed amount when deposit loads
  useEffect(() => {
    if (deposit) {
      setConfirmedAmount(deposit.amount_xaf.toString());
    }
  }, [deposit]);

  const timelineSteps = buildDepositTimelineSteps(
    deposit?.status || 'created',
    deposit?.method || 'bank_transfer',
    timeline || [],
  );

  // ── Handlers ────────────────────────────────────────────────

  const handleValidate = useCallback(() => {
    if (!depositId || !deposit) return;
    const amt = Number(confirmedAmount);
    if (!amt || amt <= 0) return;
    validateDeposit.mutate(
      {
        depositId,
        adminComment: adminComment || undefined,
        confirmedAmount: amt !== deposit.amount_xaf ? amt : undefined,
        sendNotification,
      },
      { onSuccess: () => setShowValidateConfirm(false) },
    );
  }, [depositId, deposit, confirmedAmount, adminComment, sendNotification, validateDeposit]);

  const handleReject = useCallback(() => {
    if (!depositId || !rejectionCategory || !clientMessage) return;
    rejectDeposit.mutate(
      {
        depositId,
        reason: clientMessage,
        rejectionCategory,
        adminNote: adminNote || undefined,
      },
      {
        onSuccess: () => {
          setShowRejectSheet(false);
          setRejectionCategory('');
          setClientMessage('');
          setAdminNote('');
        },
      },
    );
  }, [depositId, rejectionCategory, clientMessage, adminNote, rejectDeposit]);

  const handleStartReview = useCallback(() => {
    if (!depositId) return;
    startReview.mutate({ depositId });
  }, [depositId, startReview]);

  const handleRequestCorrection = useCallback(() => {
    if (!depositId || !correctionReason.trim()) return;
    requestCorrection.mutate(
      { depositId, reason: correctionReason },
      {
        onSuccess: () => {
          setShowCorrectionSheet(false);
          setCorrectionReason('');
        },
      },
    );
  }, [depositId, correctionReason, requestCorrection]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) setSelectedFiles(Array.from(files));
  };

  const handleUploadProofs = useCallback(() => {
    if (!depositId || !deposit || selectedFiles.length === 0) return;
    uploadProofs.mutate(
      {
        depositId,
        userId: deposit.user_id,
        files: selectedFiles,
        depositStatus: deposit.status,
      },
      {
        onSuccess: () => {
          setShowUploadSheet(false);
          setSelectedFiles([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      },
    );
  }, [depositId, deposit, selectedFiles, uploadProofs]);

  const handleDeleteProof = useCallback(() => {
    if (!showDeleteProofSheet || !depositId) return;
    const reason = deleteProofReason === 'Autre' ? customDeleteReason : deleteProofReason;
    if (!reason) return;
    deleteProof.mutate(
      { proofId: showDeleteProofSheet, depositId, reason },
      {
        onSuccess: () => {
          setShowDeleteProofSheet(null);
          setDeleteProofReason('');
          setCustomDeleteReason('');
        },
      },
    );
  }, [showDeleteProofSheet, depositId, deleteProofReason, customDeleteReason, deleteProof]);

  const handleDownloadReceipt = async () => {
    if (!deposit || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = deposit.profiles
        ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
        : 'Client';
      const receiptData: DepositReceiptData = {
        id: deposit.id,
        reference: deposit.reference,
        created_at: deposit.created_at,
        validated_at: deposit.validated_at,
        amount_xaf: deposit.amount_xaf,
        confirmed_amount_xaf: deposit.confirmed_amount_xaf,
        method: deposit.method,
        status: deposit.status,
        bank_name: deposit.bank_name,
        agency_name: deposit.agency_name,
        client_name: clientName,
        client_phone: deposit.profiles?.phone,
        company_name: deposit.profiles?.company_name,
      };
      await downloadPDF(
        <DepositReceiptPDF data={receiptData} />,
        `recu_depot_${deposit.reference}_${clientName.replace(/\s+/g, '_')}.pdf`,
      );
      toast.success('Relevé téléchargé');
    } catch (error) {
      console.error('Error generating deposit PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ── Loading / Error ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <div
          style={{
            flexShrink: 0,
            padding: '10px 20px',
            background: t.card,
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              onClick={() => navigate('/m/deposits')}
              style={{ fontSize: 18, color: t.sub, cursor: 'pointer', fontWeight: 300 }}
            >
              ‹
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>Dépôt</span>
          </div>
        </div>
        <SkeletonDetail />
      </div>
    );
  }

  if (!deposit) {
    return (
      <div className="flex flex-col min-h-full">
        <div
          style={{
            flexShrink: 0,
            padding: '10px 20px',
            background: t.card,
            borderBottom: `1px solid ${t.border}`,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span
            onClick={() => navigate('/m/deposits')}
            style={{ fontSize: 18, color: t.sub, cursor: 'pointer' }}
          >
            ‹ Retour
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Dépôt introuvable
        </div>
      </div>
    );
  }

  // ── Computed values ─────────────────────────────────────────

  const clientName = deposit.profiles
    ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
    : 'Client inconnu';
  const isLocked = ['validated', 'rejected', 'cancelled'].includes(deposit.status);
  const canValidate = !isLocked;
  const canReject = !isLocked;
  const canStartReview = deposit.status === 'proof_submitted';
  const hasProofs = proofs && proofs.length > 0;
  const canAddProof = !isLocked;
  const confirmedAmountNum = Number(confirmedAmount) || 0;
  const amountDiffers = confirmedAmountNum !== deposit.amount_xaf && confirmedAmountNum > 0;
  const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
  const statusColor = STATUS_COLOR[deposit.status] || t.sub;
  const statusLabel = DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status;
  const family = getFamilyFromMethod(deposit.method);
  const methodShort = DEPOSIT_METHOD_LABELS_SHORT[deposit.method] || deposit.method;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        background: t.bg,
        fontFamily: "'DM Sans', sans-serif",
        color: t.text,
        paddingBottom: 120,
      }}
    >
      <style>{`
        @keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      {/* ── Header : ← REF + [Relevé] ──────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 20px',
          background: t.card,
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            onClick={() => navigate('/m/deposits')}
            style={{ fontSize: 18, color: t.sub, cursor: 'pointer', fontWeight: 300 }}
          >
            ‹
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{deposit.reference}</span>
        </div>
        <button
          onClick={handleDownloadReceipt}
          disabled={isGeneratingPDF}
          style={{
            padding: '5px 12px',
            borderRadius: 7,
            background: GR,
            border: 'none',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: "'DM Sans', sans-serif",
            opacity: isGeneratingPDF ? 0.6 : 1,
          }}
        >
          {isGeneratingPDF ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : null}
          Relevé
        </button>
      </div>

      {/* ── Sous-header : badge · icône famille · date + SLA ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          background: t.card,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: `${statusColor}10`,
            fontSize: 12,
            fontWeight: 800,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MIcon family={family} size={20} />
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{methodShort}</span>
          {slaLevel && <SlaDot level={slaLevel} />}
          <span style={{ fontSize: 11, color: t.dim }}>{formatRelativeDate(deposit.created_at)}</span>
        </div>
      </div>

      {/* ── Corps ──────────────────────────────────────── */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Card montant centré */}
        <div
          style={{
            padding: '20px 16px',
            borderRadius: 14,
            background: t.card,
            border: `1px solid ${t.border}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: t.text }}>
            {fmt(deposit.amount_xaf)}{' '}
            <span style={{ fontSize: 16, fontWeight: 600, color: t.sub }}>XAF</span>
          </div>
          <div style={{ height: 1, background: t.border, margin: '14px 40px' }} />
          <div style={{ fontSize: 12, color: t.sub }}>
            Client :{' '}
            <span style={{ fontWeight: 700, color: t.text }}>{clientName}</span>
          </div>
          {deposit.confirmed_amount_xaf && deposit.confirmed_amount_xaf !== deposit.amount_xaf && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: t.dim, textDecoration: 'line-through' }}>
                {fmt(deposit.amount_xaf)} XAF
              </span>
              <ArrowRight style={{ width: 14, height: 14, color: GR }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>
                {fmt(deposit.confirmed_amount_xaf)} XAF crédité
              </span>
            </div>
          )}
          {wallet && (
            <div style={{ fontSize: 11, color: t.dim, marginTop: 6 }}>
              Solde wallet : <strong style={{ color: t.text }}>{formatCurrency(wallet.balance_xaf)}</strong>
            </div>
          )}
        </div>

        {/* Section preuves */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: t.card,
            border: `1px solid ${t.border}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>
              Preuves ({proofs?.length || 0})
            </span>
            {canAddProof && (
              <button
                onClick={() => setShowUploadSheet(true)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: GR,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Plus style={{ width: 12, height: 12 }} />
                Ajouter
              </button>
            )}
          </div>

          {!hasProofs ? (
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                textAlign: 'center',
                border: `2px dashed ${GOLD}25`,
                background: `${GOLD}03`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>Preuve manquante</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {proofs!.map((proof) => {
                const signedUrl = proof.signedUrl;
                const isImage = proof.file_type?.startsWith('image/');
                return (
                  <div
                    key={proof.id}
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #e8eef6, #f0ecf8)',
                      border: `1px solid ${t.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      color: t.dim,
                      position: 'relative',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {isImage && signedUrl ? (
                      <img
                        src={signedUrl}
                        alt={proof.file_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4 }}>
                        <FileText style={{ width: 22, height: 22, color: t.dim }} />
                        <span style={{ fontSize: 8, color: t.dim, textAlign: 'center', overflow: 'hidden', maxWidth: 60 }}>
                          {proof.file_name}
                        </span>
                      </div>
                    )}

                    {/* Date badge */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        left: 2,
                        background: 'rgba(0,0,0,0.55)',
                        color: '#fff',
                        fontSize: 8,
                        padding: '1px 4px',
                        borderRadius: 3,
                      }}
                    >
                      {format(new Date(proof.uploaded_at), 'dd/MM HH:mm', { locale: fr })}
                    </div>

                    {/* Action buttons */}
                    <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {signedUrl && (
                        <>
                          <button
                            onClick={() => setViewingProof(signedUrl)}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: 'rgba(0,0,0,0.55)',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Eye style={{ width: 9, height: 9, color: '#fff' }} />
                          </button>
                          <a
                            href={signedUrl}
                            download={proof.file_name}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: 'rgba(0,0,0,0.55)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Download style={{ width: 9, height: 9, color: '#fff' }} />
                          </a>
                        </>
                      )}
                      {!isLocked && (
                        <button
                          onClick={() => setShowDeleteProofSheet(proof.id)}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: `${RED}CC`,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X style={{ width: 9, height: 9, color: '#fff' }} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section infos */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: t.card,
            border: `1px solid ${t.border}`,
          }}
        >
          {[
            { l: 'Référence', v: deposit.reference },
            { l: 'Méthode', v: methodShort },
            deposit.bank_name ? { l: 'Banque', v: deposit.bank_name } : null,
            deposit.agency_name ? { l: 'Agence', v: deposit.agency_name } : null,
            { l: 'Date', v: format(new Date(deposit.created_at), 'dd MMM yyyy, HH:mm', { locale: fr }) },
            deposit.admin_comment ? { l: 'Note admin', v: deposit.admin_comment } : null,
          ]
            .filter(Boolean)
            .map((r, i, a) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 11, color: t.sub }}>{r!.l}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.text, textAlign: 'right', maxWidth: '60%' }}>
                  {r!.v}
                </span>
              </div>
            ))}
        </div>

        {/* Section suivi collapsible */}
        <div
          style={{
            borderRadius: 12,
            background: t.card,
            border: `1px solid ${t.border}`,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setShowSuivi(!showSuivi)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>Suivi</span>
            {showSuivi ? (
              <ChevronUp style={{ width: 16, height: 16, color: t.sub }} />
            ) : (
              <ChevronDown style={{ width: 16, height: 16, color: t.sub }} />
            )}
          </button>

          {showSuivi && (
            <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
              {timelineSteps.map((step, index) => (
                <div key={step.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        getStepColors(step.key, step.status),
                      )}
                    >
                      {step.status === 'completed' && <CheckCircle style={{ width: 12, height: 12 }} />}
                      {step.status === 'current' && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
                      )}
                    </div>
                    {index < timelineSteps.length - 1 && (
                      <div
                        style={{
                          width: 2,
                          height: 28,
                          margin: '2px 0',
                          background: step.status === 'completed' ? GR : t.border,
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingBottom: 12, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: step.status === 'pending' ? t.sub : t.text,
                        margin: 0,
                      }}
                    >
                      {step.label}
                    </p>
                    <p style={{ fontSize: 11, color: t.sub, margin: 0 }}>{step.description}</p>
                    {step.formattedDate && (
                      <p style={{ fontSize: 10, color: t.dim, margin: 0 }}>{step.formattedDate}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Boutons fixes en bas ────────────────────────── */}
      {(canValidate || canReject || canStartReview || isSuperAdmin) && (
        <div
          style={{
            position: 'fixed',
            bottom: 56,
            left: 0,
            right: 0,
            background: t.card,
            borderTop: `1px solid ${t.border}`,
            padding: '10px 20px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 40,
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          {canStartReview && (
            <button
              onClick={handleStartReview}
              disabled={startReview.isPending}
              style={{
                width: '100%',
                padding: 13,
                borderRadius: 10,
                background: V,
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: "'DM Sans', sans-serif",
                opacity: startReview.isPending ? 0.6 : 1,
              }}
            >
              {startReview.isPending && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
              Commencer la vérification
            </button>
          )}

          {canValidate && (
            <>
              <button
                onClick={() => {
                  setConfirmedAmount(deposit.amount_xaf.toString());
                  setShowValidateConfirm(true);
                }}
                style={{
                  width: '100%',
                  padding: 13,
                  borderRadius: 10,
                  background: GR,
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Valider le dépôt
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setShowRejectSheet(true)}
                  style={{
                    flex: 1,
                    padding: 11,
                    borderRadius: 10,
                    background: 'none',
                    border: `1px solid ${RED}20`,
                    fontSize: 12,
                    fontWeight: 600,
                    color: RED,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Rejeter
                </button>
                <button
                  onClick={() => setShowCorrectionSheet(true)}
                  style={{
                    flex: 1,
                    padding: 11,
                    borderRadius: 10,
                    background: 'none',
                    border: `1px solid ${O}20`,
                    fontSize: 12,
                    fontWeight: 600,
                    color: O,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Corriger
                </button>
              </div>
            </>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setShowDeleteDepositSheet(true)}
              style={{
                width: '100%',
                padding: 11,
                borderRadius: 10,
                background: 'none',
                border: `1px solid ${t.border}`,
                fontSize: 11,
                fontWeight: 600,
                color: t.dim,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Trash2 style={{ width: 12, height: 12 }} />
              Supprimer
            </button>
          )}
        </div>
      )}

      {/* ── Modale validation ───────────────────────────── */}
      {showValidateConfirm && (
        <div className="bottom-sheet-overlay" onClick={() => setShowValidateConfirm(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-0">
              <h3 className="text-lg font-bold">Valider ce dépôt</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
              <div className="bg-muted rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Montant déclaré</span>
                  <span className="font-medium">{formatCurrency(deposit.amount_xaf)}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Montant confirmé (XAF)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    value={confirmedAmount}
                    onChange={(e) => setConfirmedAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full mt-1 p-3 rounded-xl border bg-background text-sm font-bold text-lg"
                  />
                </div>
              </div>
              {amountDiffers && (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Le montant confirmé ({formatCurrency(confirmedAmountNum)}) diffère du montant déclaré.
                  </p>
                </div>
              )}
              <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Le wallet sera crédité de{' '}
                  <strong>{formatCurrency(confirmedAmountNum || deposit.amount_xaf)}</strong>
                </p>
                {wallet && (
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Nouveau solde estimé :{' '}
                    {formatCurrency(wallet.balance_xaf + (confirmedAmountNum || deposit.amount_xaf))}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Note interne (optionnel)</label>
                <textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  enterKeyHint="done"
                  className="w-full mt-1 p-3 rounded-xl border bg-muted text-sm resize-none"
                  rows={2}
                  placeholder="Commentaire visible uniquement par les admins..."
                />
              </div>
              <label className="flex items-center justify-between p-3 rounded-xl border cursor-pointer">
                <div className="flex items-center gap-2">
                  {sendNotification ? (
                    <Bell className="w-4 h-4 text-primary" />
                  ) : (
                    <BellOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">Notifier le client</span>
                </div>
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="w-5 h-5 rounded accent-primary"
                />
              </label>
            </div>
            <div className="px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t flex gap-2">
              <button onClick={() => setShowValidateConfirm(false)} className="flex-1 h-12 rounded-xl border text-sm font-medium">
                Annuler
              </button>
              <button
                onClick={handleValidate}
                disabled={validateDeposit.isPending || confirmedAmountNum <= 0}
                className="flex-1 h-12 rounded-xl bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {validateDeposit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer la validation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale rejet ────────────────────────────────── */}
      {showRejectSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowRejectSheet(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-0">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Refuser ce dépôt
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Motif du refus</p>
                <div className="space-y-2">
                  {REJECTION_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => {
                        setRejectionCategory(reason);
                        if (!clientMessage.trim()) {
                          setClientMessage(`Votre dépôt a été refusé : ${reason.toLowerCase()}.`);
                        }
                      }}
                      className={cn(
                        'w-full p-3 rounded-xl border text-left text-sm transition-all',
                        rejectionCategory === reason
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                          : 'border-border hover:border-muted-foreground',
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  Message client <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border bg-muted text-sm resize-none"
                  rows={2}
                  placeholder="Expliquez au client pourquoi son dépôt est refusé..."
                />
                <p className="text-[10px] text-muted-foreground mt-1">Ce message sera visible par le client</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Note interne (optionnel)</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  enterKeyHint="done"
                  className="w-full mt-1 p-3 rounded-xl border bg-muted text-sm resize-none"
                  rows={2}
                  placeholder="Note visible uniquement par les admins..."
                />
              </div>
            </div>
            <div className="px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t flex gap-2">
              <button
                onClick={() => { setShowRejectSheet(false); setRejectionCategory(''); setClientMessage(''); setAdminNote(''); }}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={rejectDeposit.isPending || !rejectionCategory || !clientMessage.trim()}
                className="flex-1 h-12 rounded-xl bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {rejectDeposit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale correction ───────────────────────────── */}
      {showCorrectionSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowCorrectionSheet(false)}>
          <div className="bottom-sheet-content p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Demander une correction
            </h3>
            <p className="text-sm text-muted-foreground">
              Le client sera notifié et pourra renvoyer une preuve corrigée.
            </p>
            <div>
              <label className="text-sm text-muted-foreground">
                Motif de la correction <span className="text-red-500">*</span>
              </label>
              <textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl border bg-muted text-sm resize-none"
                rows={3}
                placeholder="Expliquez au client ce qu'il faut corriger..."
              />
              <p className="text-[10px] text-muted-foreground mt-1">Ce message sera visible par le client</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCorrectionSheet(false); setCorrectionReason(''); }}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleRequestCorrection}
                disabled={requestCorrection.isPending || !correctionReason.trim()}
                className="flex-1 h-12 rounded-xl bg-orange-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {requestCorrection.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Demander la correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale upload preuve ─────────────────────────── */}
      {showUploadSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowUploadSheet(false)}>
          <div className="bottom-sheet-content p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Ajouter une preuve</h3>
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="proof-upload-v2"
              />
              <label htmlFor="proof-upload-v2" className="cursor-pointer flex flex-col items-center gap-2">
                <Plus className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Choisir des fichiers</p>
                <p className="text-xs text-muted-foreground">JPG, PNG ou PDF</p>
              </label>
            </div>
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {(file.size / 1024).toFixed(0)} Ko
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowUploadSheet(false); setSelectedFiles([]); }}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleUploadProofs}
                disabled={uploadProofs.isPending || selectedFiles.length === 0}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploadProofs.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Ajouter ({selectedFiles.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale suppression preuve ───────────────────── */}
      {showDeleteProofSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowDeleteProofSheet(null)}>
          <div className="bottom-sheet-content p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer cette preuve ?
            </h3>
            <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
            <div className="space-y-2">
              {PROOF_DELETE_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setDeleteProofReason(reason)}
                  className={cn(
                    'w-full p-3 rounded-xl border text-left text-sm transition-all',
                    deleteProofReason === reason
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                      : 'border-border hover:border-muted-foreground',
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
            {deleteProofReason === 'Autre' && (
              <textarea
                value={customDeleteReason}
                onChange={(e) => setCustomDeleteReason(e.target.value)}
                className="w-full p-3 rounded-xl border bg-muted text-sm resize-none"
                rows={2}
                placeholder="Précisez le motif..."
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteProofSheet(null); setDeleteProofReason(''); setCustomDeleteReason(''); }}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteProof}
                disabled={deleteProof.isPending || !deleteProofReason || (deleteProofReason === 'Autre' && !customDeleteReason)}
                className="flex-1 h-12 rounded-xl bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleteProof.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale suppression dépôt ─────────────────────── */}
      {showDeleteDepositSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowDeleteDepositSheet(false)}>
          <div className="bottom-sheet-content p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer ce dépôt ?
            </h3>
            <p className="text-sm text-muted-foreground">
              Voulez-vous supprimer ce dépôt ? Toutes ses preuves seront supprimées.
              Cette action est <strong>irréversible</strong>.
            </p>
            <div style={{ fontSize: 13, color: t.sub, textAlign: 'center' }}>
              {clientName} — {fmt(deposit.amount_xaf)} XAF
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteDepositSheet(false)} className="flex-1 h-12 rounded-xl border text-sm font-medium">
                Annuler
              </button>
              <button
                onClick={() => {
                  if (!depositId) return;
                  deleteDeposit.mutate({ depositId }, {
                    onSuccess: () => navigate('/m/deposits'),
                  });
                }}
                disabled={deleteDeposit.isPending}
                className="flex-1 h-12 rounded-xl bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleteDeposit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Visionneuse preuve plein écran ───────────────── */}
      {viewingProof && (
        <div
          className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
          onClick={() => setViewingProof(null)}
        >
          <button
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            onClick={() => setViewingProof(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={viewingProof}
            className="max-w-full max-h-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
            alt="Preuve"
          />
        </div>
      )}
    </div>
  );
}
