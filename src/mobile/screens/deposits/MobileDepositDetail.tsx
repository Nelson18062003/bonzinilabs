import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  useDepositDetail,
  useDepositProofs,
  useDepositTimeline,
  useValidateDeposit,
  useRejectDeposit,
  useRequestCorrection,
  useWalletByUserId,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS,
} from '@/hooks/useDeposits';
import { formatXAF } from '@/lib/formatters';
import { buildDepositTimelineSteps, safeFormatDate } from '@/lib/depositTimeline';
import { DepositTimelineDisplay } from '@/components/deposit/DepositTimelineDisplay';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Phone,
  Wallet,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  ChevronRight,
  AlertTriangle,
  Download,
  ZoomIn,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

// Motifs de rejet prédéfinis
const REJECTION_REASONS = [
  { id: 'proof_unreadable', label: 'Preuve illisible', description: 'La preuve fournie est floue ou incomplète' },
  { id: 'amount_mismatch', label: 'Montant incorrect', description: 'Le montant sur la preuve ne correspond pas' },
  { id: 'wrong_account', label: 'Mauvais compte', description: 'Le dépôt a été fait sur le mauvais compte' },
  { id: 'reference_missing', label: 'Référence absente', description: 'La référence de transaction est manquante' },
  { id: 'duplicate', label: 'Doublon', description: 'Ce dépôt a déjà été traité' },
  { id: 'other', label: 'Autre', description: 'Raison personnalisée' },
];

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  awaiting_proof: 'bg-yellow-100 text-yellow-700',
  proof_submitted: 'bg-blue-100 text-blue-700',
  admin_review: 'bg-purple-100 text-purple-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending_correction: 'bg-orange-100 text-orange-700',
};

export function MobileDepositDetail() {
  const { depositId } = useParams();
  const navigate = useNavigate();

  const { data: deposit, isLoading: loadingDeposit } = useDepositDetail(depositId);
  const { data: proofs } = useDepositProofs(depositId);
  const { data: timelineEvents } = useDepositTimeline(depositId);
  const { data: wallet } = useWalletByUserId(deposit?.user_id);

  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  const requestCorrection = useRequestCorrection();

  // Drawer states
  const [isValidateOpen, setIsValidateOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  const timelineSteps = useMemo(() => {
    if (!deposit) return [];
    return buildDepositTimelineSteps(deposit.status, timelineEvents || []);
  }, [deposit, timelineEvents]);

  // Dépôt en attente de traitement (tous sauf validé ou rejeté)
  const isPending = deposit && !['validated', 'rejected'].includes(deposit.status);

  // Calcul du nouveau solde prévu
  const currentBalance = wallet?.balance_xaf || 0;
  const newBalance = currentBalance + (deposit?.amount_xaf || 0);

  const handleValidate = async () => {
    if (!deposit) return;
    try {
      await validateDeposit.mutateAsync({
        depositId: deposit.id,
        adminComment: adminComment || undefined,
      });
      setIsValidateOpen(false);
      toast.success('Dépôt validé avec succès');
      navigate('/m/deposits');
    } catch {
      // Error handled by mutation
    }
  };

  const handleReject = async () => {
    if (!deposit) return;
    const reason = selectedReasonId === 'other'
      ? customReason
      : REJECTION_REASONS.find(r => r.id === selectedReasonId)?.label + (customReason ? `: ${customReason}` : '');

    if (!reason?.trim()) {
      toast.error('Veuillez indiquer un motif de rejet');
      return;
    }
    try {
      await rejectDeposit.mutateAsync({
        depositId: deposit.id,
        reason,
      });
      setIsRejectOpen(false);
      toast.success('Dépôt rejeté');
      navigate('/m/deposits');
    } catch {
      // Error handled by mutation
    }
  };

  const handleRequestCorrection = async () => {
    if (!deposit) return;
    if (!correctionReason.trim()) {
      toast.error('Veuillez indiquer ce qui doit être corrigé');
      return;
    }
    try {
      await requestCorrection.mutateAsync({
        depositId: deposit.id,
        reason: correctionReason,
      });
      setIsCorrectionOpen(false);
      toast.success('Demande de correction envoyée au client');
      navigate('/m/deposits');
    } catch {
      // Error handled by mutation
    }
  };

  if (loadingDeposit) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail dépôt" showBack backTo="/m/deposits" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!deposit) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail dépôt" showBack backTo="/m/deposits" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">Dépôt non trouvé</p>
        </div>
      </div>
    );
  }

  const clientName = deposit.profiles
    ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
    : 'Client inconnu';
  const initials = deposit.profiles
    ? `${deposit.profiles.first_name?.[0] || ''}${deposit.profiles.last_name?.[0] || ''}`
    : '??';

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <MobileHeader
        title={`Dépôt #${deposit.reference?.slice(-6) || ''}`}
        showBack
        backTo="/m/deposits"
      />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-center">
          <span className={cn(
            "px-4 py-2 rounded-full text-sm font-semibold",
            STATUS_COLORS[deposit.status]
          )}>
            {DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status}
          </span>
        </div>

        {/* Amount Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
          <p className="text-sm text-muted-foreground mb-1">Montant du dépôt</p>
          <p className="text-3xl font-bold">{formatXAF(deposit.amount_xaf)}</p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
            <span className="text-sm text-muted-foreground">
              {DEPOSIT_METHOD_LABELS[deposit.method]}
            </span>
            <span className="text-xs text-muted-foreground">
              {safeFormatDate(deposit.created_at, 'dd MMM yyyy HH:mm')}
            </span>
          </div>
        </div>

        {/* Client Info with Wallet Balance */}
        <button
          onClick={() => navigate(`/m/clients/${deposit.user_id}`)}
          className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-medium text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{clientName}</p>
              {deposit.profiles?.phone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {deposit.profiles.phone}
                </div>
              )}
            </div>
            {wallet && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm">
                  <Wallet className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium">{formatXAF(wallet.balance_xaf)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Solde actuel</p>
              </div>
            )}
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </button>

        {/* Proofs Gallery */}
        {proofs && proofs.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Preuves ({proofs.length})
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {proofs.map((proof) => (
                <button
                  key={proof.id}
                  onClick={() => setSelectedProof(proof.file_url)}
                  className="relative aspect-[4/3] rounded-xl bg-muted overflow-hidden active:scale-95 transition-transform group"
                >
                  <img
                    src={proof.file_url}
                    alt="Preuve"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Admin Comments */}
        {deposit.admin_comment && (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800 mb-1">Commentaire de validation</p>
            <p className="text-sm text-green-700">{deposit.admin_comment}</p>
          </div>
        )}

        {deposit.rejection_reason && (
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <p className="text-sm font-medium text-red-800 mb-1">Motif de rejet</p>
            <p className="text-sm text-red-700">{deposit.rejection_reason}</p>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <h3 className="font-medium mb-4">Historique</h3>
          <DepositTimelineDisplay steps={timelineSteps} />
        </div>
      </div>

      {/* Fixed Bottom Actions - Toujours visible si dépôt en attente */}
      {isPending && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="flex gap-2 max-w-lg mx-auto">
            {/* Rejeter */}
            <button
              onClick={() => setIsRejectOpen(true)}
              className="h-12 px-4 rounded-xl border-2 border-red-500 text-red-500 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <XCircle className="w-5 h-5" />
            </button>
            {/* Demander correction */}
            <button
              onClick={() => setIsCorrectionOpen(true)}
              className="h-12 px-4 rounded-xl border-2 border-orange-500 text-orange-500 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* Valider */}
            <button
              onClick={() => setIsValidateOpen(true)}
              className="flex-1 h-12 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <CheckCircle className="w-5 h-5" />
              Valider
            </button>
          </div>
        </div>
      )}

      {/* Validate Drawer */}
      <Drawer open={isValidateOpen} onOpenChange={setIsValidateOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Valider le dépôt</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-4">
            {/* Balance Preview */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-green-600 mb-1">Solde actuel</p>
                  <p className="text-lg font-semibold text-green-800">{formatXAF(currentBalance)}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-green-500" />
                <div className="text-right">
                  <p className="text-xs text-green-600 mb-1">Nouveau solde</p>
                  <p className="text-lg font-bold text-green-800">{formatXAF(newBalance)}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-green-200">
                <p className="text-sm text-green-700 text-center">
                  +{formatXAF(deposit.amount_xaf)} sera crédité
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Référence</span>
                <span className="font-medium">{deposit.reference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Méthode</span>
                <span className="font-medium">{DEPOSIT_METHOD_LABELS[deposit.method]}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Commentaire (optionnel)</label>
              <textarea
                placeholder="Ajouter un commentaire..."
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                className="w-full h-20 p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>
          <DrawerFooter className="flex-row gap-3">
            <button
              onClick={() => setIsValidateOpen(false)}
              className="flex-1 h-12 rounded-xl border border-border font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleValidate}
              disabled={validateDeposit.isPending}
              className="flex-1 h-12 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {validateDeposit.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              Confirmer
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Reject Drawer */}
      <Drawer open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Rejeter le dépôt</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  Cette action va rejeter définitivement le dépôt. Le client sera notifié.
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Motif du rejet *</label>
              <div className="space-y-2">
                {REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedReasonId(reason.id)}
                    className={cn(
                      "w-full p-3 rounded-xl border text-left transition-colors",
                      selectedReasonId === reason.id
                        ? "border-red-500 bg-red-50"
                        : "border-border bg-card"
                    )}
                  >
                    <p className={cn(
                      "font-medium text-sm",
                      selectedReasonId === reason.id ? "text-red-700" : ""
                    )}>
                      {reason.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{reason.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedReasonId && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {selectedReasonId === 'other' ? 'Détaillez le motif *' : 'Détails supplémentaires (optionnel)'}
                </label>
                <textarea
                  placeholder="Ajoutez des détails..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full h-20 p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            )}
          </div>
          <DrawerFooter className="flex-row gap-3">
            <button
              onClick={() => {
                setIsRejectOpen(false);
                setSelectedReasonId(null);
                setCustomReason('');
              }}
              className="flex-1 h-12 rounded-xl border border-border font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleReject}
              disabled={rejectDeposit.isPending || !selectedReasonId || (selectedReasonId === 'other' && !customReason.trim())}
              className="flex-1 h-12 rounded-xl bg-red-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {rejectDeposit.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              Rejeter
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Request Correction Drawer */}
      <Drawer open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Demander une correction</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-4">
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-orange-800">
                  Le client pourra corriger sa preuve et resoumettre le dépôt.
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Que doit corriger le client ? *</label>
              <textarea
                placeholder="Ex: La preuve est floue, merci de renvoyer une photo plus nette..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full h-24 p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>
          <DrawerFooter className="flex-row gap-3">
            <button
              onClick={() => {
                setIsCorrectionOpen(false);
                setCorrectionReason('');
              }}
              className="flex-1 h-12 rounded-xl border border-border font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleRequestCorrection}
              disabled={requestCorrection.isPending || !correctionReason.trim()}
              className="flex-1 h-12 rounded-xl bg-orange-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {requestCorrection.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              Envoyer
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Proof Viewer Drawer */}
      <Drawer open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Preuve de dépôt</DrawerTitle>
          </DrawerHeader>
          <div className="p-4">
            {selectedProof && (
              <div className="space-y-3">
                <img
                  src={selectedProof}
                  alt="Preuve"
                  className="w-full rounded-xl"
                />
                <a
                  href={selectedProof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-12 rounded-xl border border-border font-medium"
                >
                  <Download className="w-4 h-4" />
                  Ouvrir en plein écran
                </a>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
