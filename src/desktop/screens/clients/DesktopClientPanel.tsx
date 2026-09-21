/**
 * Desktop admin — fiche client en vrai panneau desktop (archetype B,
 * docs/admin-redesign 02-foundation §2B).
 *
 * Remplace la fiche mobile écrasée dans l'aside : en-tête épinglé (identité +
 * UNE action primaire « Dépôt »), zone solde avec crédit/débit, grille de
 * faits 2 colonnes, totaux, derniers mouvements inline, raccourcis. Même
 * couche de données et mêmes mutations que MobileClientDetail ; les
 * BottomSheets deviennent des dialogues centrés (CenterDialog).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useClient,
  useClientLedger,
  useClientLedgerCount,
  useResetClientPassword,
  useUpdateClient,
  useCreateAdjustment,
  fetchLedgerEntriesInRange,
  fetchLastLedgerEntryBefore,
} from '@/hooks/useClientManagement';
import { StatementPeriodSheet } from '@/components/statement/StatementPeriodSheet';
import { statementQueryRange, type StatementRange } from '@/lib/statementPeriod';
import { useAdminDeleteClient } from '@/hooks/useAdminDeleteClient';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { formatXAF, formatCurrency, formatDate } from '@/lib/formatters';
import {
  generateStatementForRange,
  buildMovementFromLedgerEntry,
  shouldIncludeLedgerEntry,
} from '@/lib/generateClientStatement';
import { ENTRY_TYPE_CONFIG, AMOUNT_TONE } from '@/lib/ledgerDisplay';
import { normalizePhone } from '@/lib/phone';
import { availableXaf, overdraftUsedXaf } from '@/lib/overdraft';
import { OverdraftDialog } from '@/components/wallet/OverdraftDialog';
import { useClientPhones } from '@/hooks/useClientPhones';
import { useClientDeposits } from '@/hooks/useReception';
import { depositStage, formatCbm, formatKg } from '@/lib/reception';
import { LocationMark, formatDateTime } from '@/mobile/components/reception/bits';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { PhoneCountryInput } from '@/components/auth/PhoneCountryInput';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { countryLabelFr, isoFromCountryLabel } from '@/data/countries';
import { AmountField, TextArea } from '@/components/form';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AdjustmentType } from '@/types/admin';
import {
  SURFACE,
  TEXT,
  TONE_HOLDER,
  PRIMARY_PILL,
  VIOLET_PILL,
  clientStatusTone,
  Avatar,
  Amount,
  StatusPill,
  Holder,
  FormField,
  TextInput,
  PrimaryPill,
  SoftPill,
  SecLabel,
  KV,
  CenterDialog,
  absShort,
} from '@/desktop/designKit';
import { QRCodeSVG } from 'qrcode.react';
import { customerQrPayload } from '@/lib/customerCode';
import { ShippingLabelComposer } from '@/components/customer-code/ShippingLabelComposer';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Copy,
  FileDown,
  Key,
  Link2,
  Loader2,
  MoreHorizontal,
  Minus,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  SUSPENDED: 'Suspendu',
  PENDING_KYC: 'KYC en attente',
};

/* ── Dialogue d'ajustement (crédit / débit) — équivalent desktop du
      AdjustmentDrawer mobile, même mutation useCreateAdjustment. ─────────── */
function AdjustmentDialog({
  open,
  onClose,
  type,
  userId,
  currentBalance,
  overdraftLimit = 0,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  type: AdjustmentType;
  userId: string;
  currentBalance: number;
  overdraftLimit?: number;
  onSuccess: () => void;
}) {
  const [amountNumber, setAmountNumber] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const createAdjustment = useCreateAdjustment();

  const amount = amountNumber ?? 0;
  const isDebit = type === 'DEBIT';
  const available = availableXaf(currentBalance, overdraftLimit);
  const insufficient = isDebit && amount > available;
  const willOverdraw = isDebit && amount > 0 && currentBalance - amount < 0;
  const isValid = amount > 0 && reason.trim().length > 0 && !insufficient;

  const reset = () => {
    setAmountNumber(null);
    setReason('');
  };

  const submit = async () => {
    if (!isValid || createAdjustment.isPending) return;
    try {
      await createAdjustment.mutateAsync({
        userId,
        adjustmentType: type,
        amountXAF: amount,
        reason: reason.trim(),
      });
      reset();
      onSuccess();
    } catch {
      // Error handled by mutation
    }
  };

  const close = () => {
    if (createAdjustment.isPending) return;
    reset();
    onClose();
  };

  return (
    <CenterDialog
      open={open}
      onClose={close}
      onConfirm={submit}
      title={isDebit ? 'Débit manuel' : 'Crédit manuel'}
      width={460}
      footer={
        <>
          <PrimaryPill onClick={submit} disabled={!isValid} loading={createAdjustment.isPending} danger={isDebit} className="flex-1">
            {isDebit ? 'Débiter' : 'Créditer'} {amount > 0 && formatCurrency(amount)}
          </PrimaryPill>
          <SoftPill onClick={close} className="flex-1">
            Annuler
          </SoftPill>
        </>
      }
    >
      <div className="space-y-4">
        <div className={cn('rounded-2xl p-3', SURFACE.canvas)}>
          <p className={cn('text-[13px]', TEXT.muted)}>Solde actuel</p>
          <Amount value={formatCurrency(currentBalance)} size="md" className={cn('mt-0.5', currentBalance < 0 && 'text-[#C00F0C] dark:text-[#FCB3AD]')} />
          {overdraftLimit > 0 && (
            <p className={cn('mt-1 text-[12px]', TEXT.muted)}>Disponible avec découvert : {formatCurrency(available)} (découvert autorisé {formatCurrency(overdraftLimit)})</p>
          )}
        </div>
        <div>
          <AmountField
            id="adjustment-amount"
            label="Montant (XAF) *"
            currency="XAF"
            value={amountNumber}
            onValueChange={setAmountNumber}
            error={insufficient ? 'Solde insuffisant' : undefined}
          />
          {amount > 0 && !insufficient && (
            <p className={cn('mt-2 text-[13px]', willOverdraw ? 'font-semibold text-[#975102] dark:text-[#E8B931]' : TEXT.muted)}>
              Nouveau solde : {formatCurrency(isDebit ? currentBalance - amount : currentBalance + amount)}{willOverdraw ? ' — le client passe en découvert' : ''}
            </p>
          )}
        </div>
        <TextArea
          id="adjustment-reason"
          label="Motif *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Décrivez la raison de cet ajustement..."
          controlClassName="min-h-[90px]"
          hint="Le motif sera enregistré dans l'historique et visible par le client."
        />
        <div className="flex gap-2 rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-[13px] text-amber-700 dark:text-amber-400">
            Cette action sera enregistrée avec votre nom et ne peut pas être annulée.
          </p>
        </div>
      </div>
    </CenterDialog>
  );
}

export function DesktopClientPanel({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const { data: client, isLoading, refetch } = useClient(clientId);
  const { data: ledgerEntries } = useClientLedger(clientId);
  const { data: ledgerTotal } = useClientLedgerCount(clientId);
  const { hasPermission } = useAdminAuth();
  const canManageUsers = hasPermission('canManageUsers');
  const { data: clientDeposits } = useClientDeposits(clientId, hasPermission('canViewCargo'));
  const canGrantOverdraft = hasPermission('canGrantOverdraft');
  const [overdraftOpen, setOverdraftOpen] = useState(false);

  const updateClient = useUpdateClient();
  const resetPassword = useResetClientPassword();
  const deleteClient = useAdminDeleteClient();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Le menu « ⋯ » se ferme au clic extérieur et à Échap (même contrat que
  // DropChip) — sinon « Supprimer le client » reste suspendu sous le curseur.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', companyName: '', country: '', city: '',
  });
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const { data: shipping } = useAdminShippingSettings();

  const copyCustomerCode = async () => {
    if (!client?.customerCode) return;
    try {
      await navigator.clipboard.writeText(client.customerCode);
      setCodeCopied(true);
      toast.success('Identifiant copié');
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error('Copie impossible');
    }
  };

  // `client.id` est le user_id (voir la construction de l'objet client).
  const { data: clientPhones } = useClientPhones(client?.id);
  const extraPhones = (clientPhones ?? []).filter((p) => !p.isPrimary);

  const close = () => navigate('/m/clients');

  const openEdit = () => {
    if (!client) return;
    setEditForm({
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      companyName: client.companyName,
      country: client.country,
      city: client.city,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    // Le garde isPending compte : ⌘⏎ (onConfirm du CenterDialog) peut
    // relancer la mutation pendant qu'elle est en vol.
    if (!client || updateClient.isPending) return;
    // Un numéro invalide met phone_e164 à NULL côté DB : le client cesse
    // silencieusement de recevoir ses SMS. On bloque ici.
    const phone = editForm.phone.trim();
    if (phone !== '' && !normalizePhone(phone)) {
      toast.error('Numéro invalide', {
        description: 'Vérifiez le pays et le numéro. Sans numéro valide, ce client ne recevra aucun SMS.',
      });
      return;
    }
    try {
      await updateClient.mutateAsync({
        userId: client.id,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        companyName: editForm.companyName.trim(),
        country: editForm.country.trim(),
        city: editForm.city.trim(),
      });
      setEditOpen(false);
      refetch();
    } catch {
      /* toast handled by the hook */
    }
  };

  const handleResetPassword = async () => {
    // Deux appels concurrents généreraient deux mots de passe : celui affiché
    // pourrait ne pas être celui appliqué en base.
    if (!client || resetPassword.isPending) return;
    try {
      const result = await resetPassword.mutateAsync(client.id);
      if (result.tempPassword) {
        setNewPassword(result.tempPassword);
        setResetOpen(false);
      }
    } catch {
      /* toast handled by the hook */
    }
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(newPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleDeleteCheck = async () => {
    if (!client) return;
    setDeleteChecking(true);
    try {
      if ((client.walletBalance || 0) > 0) {
        toast.error(`Impossible de supprimer un client avec un solde positif (${formatXAF(client.walletBalance || 0)} XAF)`);
        return;
      }
      const { data: pending, error } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('user_id', client.id)
        .in('status', ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'cash_pending', 'cash_scanned'])
        .limit(1);
      // Une requête échouée ne doit pas se confondre avec « aucun paiement
      // en cours » — sinon la confirmation de suppression s'ouvre quand même.
      if (error) {
        toast.error('Vérification des paiements impossible — réessayez.');
        return;
      }
      if (pending && pending.length > 0) {
        toast.error('Impossible de supprimer un client ayant des paiements en cours');
        return;
      }
      setDeleteOpen(true);
    } finally {
      setDeleteChecking(false);
    }
  };

  // Relevé PDF sur une période : la feuille choisit la période, on lit TOUTES
  // les écritures de cette période (plus de plafond à 100), et le solde
  // d'ouverture vient de la dernière écriture avant la période si elle est vide.
  const downloadStatement = async (range: StatementRange) => {
    if (!client || isGeneratingPDF) return false;
    setIsGeneratingPDF(true);
    try {
      const query = statementQueryRange(range);
      const entries = await fetchLedgerEntriesInRange(client.id, query);
      const movements = entries
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((entry) => shouldIncludeLedgerEntry({ ...entry, isTest: (entry as any).isTest }))
        .map((entry) => buildMovementFromLedgerEntry(entry));
      if (query === null && movements.length === 0) {
        toast.error('Aucun mouvement à exporter');
        return false;
      }
      const lastBefore = query && movements.length === 0
        ? await fetchLastLedgerEntryBefore(client.id, query.from)
        : null;
      await generateStatementForRange({
        client: {
          name: `${client.firstName} ${client.lastName}`,
          phone: client.phone,
          email: client.email,
          country: client.country,
          ref: client.customerCode,
        },
        range: query,
        movements,
        lastBalanceBefore: lastBefore?.balanceAfter ?? null,
      });
      return true;
    } catch (err) {
      console.error('Error generating statement:', err);
      toast.error('Erreur lors de la génération du relevé');
      return false;
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const panelClasses = cn(
    'flex w-[560px] shrink-0 flex-col overflow-hidden rounded-[24px]',
    SURFACE.card,
    'ring-1 ring-black/[0.06] dark:ring-white/[0.06]',
  );

  if (isLoading || !client) {
    return (
      <aside className={panelClasses}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
          {isLoading ? (
            <Loader2 className={cn('h-6 w-6 animate-spin', TEXT.muted)} />
          ) : (
            <>
              <Holder icon={AlertTriangle} tone="danger" size="lg" />
              <p className={cn('text-[13px]', TEXT.muted)}>Client introuvable</p>
            </>
          )}
        </div>
      </aside>
    );
  }

  const name = `${client.firstName} ${client.lastName}`.trim() || '?';
  const recentEntries = (ledgerEntries ?? []).slice(0, 6);

  const menuItem = (onClick: () => void, icon: React.ReactNode, label: string, danger?: boolean) => (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        onClick();
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold',
        danger
          ? 'text-destructive hover:bg-destructive/10 dark:text-destructive dark:hover:bg-destructive/10'
          : cn(TEXT.strong, 'hover:bg-muted/50 dark:hover:bg-white/[0.05]'),
      )}
    >
      {icon} {label}
    </button>
  );

  return (
    <aside className={panelClasses}>
      {/* ── En-tête épinglé : identité + UNE action primaire ────────────── */}
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
        <Avatar name={name} size="sm" />
        <div className="min-w-0 flex-1 leading-[17px]">
          <div className="flex items-center gap-2">
            <span className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{name}</span>
            <StatusPill tone={clientStatusTone(client.status)} label={STATUS_LABEL[client.status] ?? client.status} />
          </div>
          <div className={cn('truncate text-[11px] tabular-nums', TEXT.muted)}>
            <span className={cn('font-bold', TEXT.body)}>{client.customerCode}</span>
            {client.phone ? ` · ${client.phone}` : ''}
            {client.companyName ? ` · ${client.companyName}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/m/deposits/new?clientId=${client.id}`)}
          className={cn('shrink-0 px-3.5 py-2 text-[12px]', PRIMARY_PILL)}
        >
          Dépôt
        </button>
        {canManageUsers && (
          <div ref={menuRef} className="relative shrink-0">
            <Holder icon={MoreHorizontal} size="sm" onClick={() => setMenuOpen((v) => !v)} ariaLabel="Plus d'actions" />
            {menuOpen && (
              <div
                className={cn(
                  'absolute right-0 top-[calc(100%+6px)] z-40 min-w-[230px] overflow-hidden rounded-2xl p-1.5',
                  SURFACE.card,
                  'ring-1 ring-black/[0.10] dark:ring-white/[0.10]',
                )}
              >
                {menuItem(openEdit, <Pencil className="h-3.5 w-3.5" />, 'Modifier le profil')}
                {menuItem(() => setResetOpen(true), <Key className="h-3.5 w-3.5" />, 'Réinitialiser mot de passe')}
                {menuItem(handleDeleteCheck, deleteChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />, 'Supprimer le client', true)}
              </div>
            )}
          </div>
        )}
        <Holder icon={X} size="sm" onClick={close} ariaLabel="Fermer" />
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
        {/* Zone solde — la donnée que l'opérateur vient chercher */}
        <div className={cn('rounded-2xl p-4', SURFACE.canvas)}>
          <SecLabel
            right={
              <button
                type="button"
                onClick={() => navigate(`/m/clients/${client.id}/ledger`)}
                className="text-[12px] font-bold text-indigo-700 dark:text-indigo-400"
              >
                Historique complet →
              </button>
            }
          >
            {(client.walletBalance || 0) < 0 ? 'Solde — en découvert' : 'Solde disponible'}
          </SecLabel>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <Amount value={formatXAF(client.walletBalance || 0)} unit="XAF" size="xl" className={(client.walletBalance || 0) < 0 ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : undefined} />
            <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => setAdjustmentType('CREDIT')}
                className={cn('flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-bold', TONE_HOLDER.success)}
              >
                <Plus className="h-3.5 w-3.5" /> Crédit
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('DEBIT')}
                className={cn('flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-bold', TONE_HOLDER.danger)}
              >
                <Minus className="h-3.5 w-3.5" /> Débit
              </button>
            </div>
          </div>
          {client.lastLedgerEntry && (
            <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
              Dernier mouvement : {formatDate(client.lastLedgerEntry.createdAt)}
            </p>
          )}
          {/* Découvert : ce que l'équipe peut encore débiter, et qui l'a autorisé. */}
          {((client.walletOverdraftLimit ?? 0) > 0 || (client.walletBalance || 0) < 0 || canGrantOverdraft) && (
            <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2', (client.walletBalance || 0) < 0 ? 'bg-[#FDD3D0]/60 dark:bg-[#900B09]/40' : SURFACE.card)}>
              <p className={cn('text-[12.5px] font-semibold', (client.walletBalance || 0) < 0 ? 'text-[#900B09] dark:text-[#FDD3D0]' : TEXT.strong)}>
                {(client.walletOverdraftLimit ?? 0) > 0
                  ? `Découvert autorisé ${formatXAF(client.walletOverdraftLimit ?? 0)} XAF · utilisé ${formatXAF(overdraftUsedXaf(client.walletBalance || 0))} XAF · disponible ${formatXAF(availableXaf(client.walletBalance || 0, client.walletOverdraftLimit ?? 0))} XAF`
                  : 'Aucun découvert autorisé'}
              </p>
              {canGrantOverdraft && (
                <button type="button" onClick={() => setOverdraftOpen(true)} className="text-[12px] font-bold text-indigo-700 dark:text-indigo-400">
                  {(client.walletOverdraftLimit ?? 0) > 0 ? 'Modifier →' : 'Autoriser un découvert →'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Totaux */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn('rounded-2xl p-3.5', SURFACE.canvas)}>
            <div className="flex items-center gap-2">
              <Holder icon={ArrowDownCircle} tone="success" size="sm" />
              <div className="min-w-0">
                <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Total dépôts</div>
                <div className={cn('text-[15px] font-bold tabular-nums', TEXT.strong)}>{formatXAF(client.totalDeposits || 0)}</div>
              </div>
            </div>
          </div>
          <div className={cn('rounded-2xl p-3.5', SURFACE.canvas)}>
            <div className="flex items-center gap-2">
              <Holder icon={ArrowUpCircle} tone="info" size="sm" />
              <div className="min-w-0">
                <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Total paiements</div>
                <div className={cn('text-[15px] font-bold tabular-nums', TEXT.strong)}>{formatXAF(client.totalPayments || 0)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Identifiant client — ce qu'on compare au libellé d'un virement, et
            ce que le fournisseur colle sur les cartons. */}
        <div className="flex items-center gap-3.5 rounded-2xl px-4 py-3 ring-1 ring-black/[0.05] dark:ring-white/[0.05]">
          <div className="shrink-0 rounded-xl bg-white p-1.5 ring-1 ring-black/[0.06]">
            <QRCodeSVG value={customerQrPayload(client.customerCode)} size={56} level="M" marginSize={0} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Identifiant client</div>
            <div className={cn('mt-0.5 text-[20px] font-black leading-none tracking-[0.04em] tabular-nums', TEXT.strong)}>{client.customerCode}</div>
            <div className={cn('mt-1 text-[11.5px]', TEXT.muted)}>Libellé de virement · étiquette colis (QR)</div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-1.5">
            <button
              type="button"
              onClick={copyCustomerCode}
              className={cn('flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-bold', codeCopied ? TONE_HOLDER.success : SURFACE.holder)}
            >
              {codeCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {codeCopied ? 'Copié' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={() => setLabelOpen(true)}
              className={cn('flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-bold', VIOLET_PILL)}
            >
              <Tag className="h-3.5 w-3.5" /> Étiquette colis
            </button>
          </div>
        </div>

        <CenterDialog open={labelOpen} onClose={() => setLabelOpen(false)} title="Étiquette colis" width={960}>
          <ShippingLabelComposer
            code={client.customerCode}
            clientName={name}
            clientPhone={client.phone}
            clientEmail={client.email}
            companyName={client.companyName}
            clientCity={client.city}
            clientCountry={client.country}
            settings={shipping ?? DEFAULT_SHIPPING_SETTINGS}
            mode="admin"
            layout="split"
          />
        </CenterDialog>

        {/* Grille de faits */}
        <div className="rounded-2xl px-4 pb-3 pt-3.5 ring-1 ring-black/[0.05] dark:ring-white/[0.05]">
          <SecLabel
            right={
              canManageUsers ? (
                <button type="button" onClick={openEdit} className="text-[12px] font-bold text-indigo-700 dark:text-indigo-400">
                  Modifier
                </button>
              ) : undefined
            }
          >
            Coordonnées
          </SecLabel>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Le numéro PRINCIPAL, plus les autres s'il y en a. Sans cette
                liste, les numéros supplémentaires saisis à la création
                seraient enregistrés puis jamais montrés — une donnée
                invisible vaut moins que pas de donnée du tout. */}
            <KV
              k="Téléphone"
              v={
                extraPhones.length === 0 ? (
                  formatE164ForDisplay(client.phone) || '—'
                ) : (
                  <span className="flex flex-col gap-0.5">
                    <span>{formatE164ForDisplay(client.phone)}</span>
                    {extraPhones.map((p) => (
                      <span key={p.id} className={cn('text-[12px]', TEXT.muted)}>
                        {formatE164ForDisplay(p.phoneE164)}
                        {p.label ? ` · ${p.label}` : ''}
                      </span>
                    ))}
                  </span>
                )
              }
            />
            <KV k="E-mail" v={client.email || '—'} />
            <KV k="Entreprise" v={client.companyName || '—'} />
            <KV k="Ville / Pays" v={[client.city, client.country].filter(Boolean).join(' · ') || '—'} />
            <KV k="Client depuis" v={formatDate(client.createdAt)} />
            <KV
              k="Source"
              v={
                client.utmSource ? (
                  <span className="inline-flex items-center gap-1">
                    <Link2 className={cn('h-3 w-3 shrink-0', TEXT.muted)} />
                    <span className="capitalize">{client.utmSource}</span>
                    {client.utmCampaign ? <span className={TEXT.muted}> · {client.utmCampaign}</span> : null}
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </div>

        {/* Derniers mouvements */}
        <div className="rounded-2xl px-4 pb-2 pt-3.5 ring-1 ring-black/[0.05] dark:ring-white/[0.05]">
          <SecLabel
            right={
              <button
                type="button"
                onClick={() => navigate(`/m/clients/${client.id}/ledger`)}
                className="text-[12px] font-bold text-indigo-700 dark:text-indigo-400"
              >
                Voir tout ({ledgerTotal ?? ledgerEntries?.length ?? 0})
              </button>
            }
          >
            Derniers mouvements
          </SecLabel>
          {recentEntries.length === 0 ? (
            <p className={cn('py-4 text-[12.5px]', TEXT.muted)}>Aucun mouvement enregistré</p>
          ) : (
            <div className="mt-1">
              {recentEntries.map((entry) => {
                const config = ENTRY_TYPE_CONFIG[entry.entryType];
                const Icon = config.icon;
                return (
                  <div key={entry.id} className="flex items-center gap-2.5 border-t border-black/[0.04] py-2 first:border-t-0 dark:border-white/[0.05]">
                    <Holder icon={Icon} tone={config.tone} size="sm" />
                    <div className="min-w-0 flex-1 leading-[16px]">
                      <div className={cn('truncate text-[13px] font-semibold', TEXT.strong)}>{config.label}</div>
                      <div className={cn('truncate text-[11px]', TEXT.muted)}>{entry.description || '—'}</div>
                    </div>
                    <div className="shrink-0 text-right leading-[16px]">
                      <div className={cn('text-[13px] font-bold tabular-nums', AMOUNT_TONE[config.tone])}>
                        {config.prefix}
                        {formatCurrency(entry.amountXAF)}
                      </div>
                      <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>{absShort(entry.createdAt.toISOString())}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colis reçus — la réception, dans Cargo */}
        {hasPermission('canViewCargo') && (clientDeposits?.length ?? 0) > 0 && (() => {
          const parcels = (clientDeposits ?? []).flatMap((d) => d.parcels);
          const waiting = parcels.filter((p) => !p.shipment_id).length;
          return (
            <div className="rounded-2xl px-4 pb-2 pt-3.5 ring-1 ring-black/[0.05] dark:ring-white/[0.05]">
              <SecLabel
                right={
                  <button type="button" onClick={() => navigate(`/m/clients/${client.id}/parcels`)} className="text-[12px] font-bold text-indigo-700 dark:text-indigo-400">
                    Voir tout ({clientDeposits?.length ?? 0})
                  </button>
                }
              >
                Colis reçus
              </SecLabel>
              <p className={cn('mt-1 text-[12.5px] tabular-nums', TEXT.body)}>
                <b className={TEXT.strong}>{parcels.length} colis</b> · {formatKg(parcels.reduce((a, p) => a + Number(p.weight_kg ?? 0), 0))} · {formatCbm(parcels.reduce((a, p) => a + Number(p.cbm ?? 0), 0))}
                {waiting > 0 ? <> · <span className="font-semibold text-emerald-700 dark:text-emerald-400">{waiting} à l'entrepôt</span></> : ' · tout est chargé'}
              </p>
              <div className="mt-1">
                {(clientDeposits ?? []).slice(0, 3).map((d) => {
                  const st = depositStage(d.parcels);
                  return (
                    <button key={d.id} type="button" onClick={() => navigate(`/m/cargo/reception/${d.id}`)} className="flex w-full items-center gap-2.5 border-t border-black/[0.04] py-2 text-left first:border-t-0 dark:border-white/[0.05]">
                      <LocationMark location={d.location} size={26} />
                      <div className="min-w-0 flex-1 leading-[16px]">
                        <div className={cn('truncate font-mono text-[12.5px] font-semibold', TEXT.strong)}>{d.deposit_no} <span className={cn('font-sans font-normal', TEXT.muted)}>· {d.parcels.length} colis · {formatKg(d.total_weight_kg)} · {formatCbm(d.total_cbm)}</span></div>
                        <div className={cn('truncate text-[11px]', TEXT.muted)}>{formatDateTime(d.closed_at ?? d.opened_at)}{d.received_by_name ? ` · reçu par ${d.received_by_name}` : ''}</div>
                      </div>
                      <span className={cn('shrink-0 text-[11.5px] font-semibold', st.tone === 'success' ? 'text-emerald-700 dark:text-emerald-400' : st.tone === 'pending' ? 'text-amber-700 dark:text-amber-400' : 'text-indigo-700 dark:text-indigo-400')}>
                        {st.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Raccourcis */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate(`/m/clients/${client.id}/beneficiaries`)}
            className={cn('flex items-center justify-center gap-2 rounded-md py-2.5 text-[13px] font-semibold', SURFACE.card, 'ring-1 ring-black/[0.07] dark:ring-white/[0.08]', TEXT.strong)}
          >
            <Users className="h-4 w-4" /> Bénéficiaires
          </button>
          <button
            type="button"
            onClick={() => setStatementOpen(true)}
            disabled={isGeneratingPDF}
            title="Choisir une période et télécharger le PDF"
            className={cn('flex items-center justify-center gap-2 rounded-md py-2.5 text-[13px] font-semibold disabled:opacity-60', SURFACE.card, 'ring-1 ring-black/[0.07] dark:ring-white/[0.08]', TEXT.strong)}
          >
            {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Relevé PDF
          </button>
        </div>
      </div>

      {/* ── Dialogues ───────────────────────────────────────────────────── */}
      <AdjustmentDialog
        overdraftLimit={client.walletOverdraftLimit ?? 0}
        open={adjustmentType !== null}
        onClose={() => setAdjustmentType(null)}
        type={adjustmentType ?? 'CREDIT'}
        userId={client.id}
        currentBalance={client.walletBalance || 0}
        onSuccess={() => {
          refetch();
          setAdjustmentType(null);
        }}
      />

      {canGrantOverdraft && (
        <OverdraftDialog
          variant="dialog"
          open={overdraftOpen}
          onClose={() => setOverdraftOpen(false)}
          userId={client.id}
          clientName={`${client.firstName} ${client.lastName}`}
          currentBalance={client.walletBalance || 0}
          currentLimit={client.walletOverdraftLimit ?? 0}
          currentNote={client.walletOverdraftNote}
          onSuccess={() => refetch()}
        />
      )}

      {/* Modifier le profil */}
      <CenterDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onConfirm={saveEdit}
        title="Modifier le profil"
        width={560}
        footer={
          <>
            <PrimaryPill onClick={saveEdit} loading={updateClient.isPending} className="flex-1">
              Enregistrer
            </PrimaryPill>
            <SoftPill onClick={() => setEditOpen(false)} className="flex-1">
              Annuler
            </SoftPill>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prénom" htmlFor="edit-firstName">
            <TextInput id="edit-firstName" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
          </FormField>
          <FormField label="Nom" htmlFor="edit-lastName">
            <TextInput id="edit-lastName" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Téléphone / WhatsApp" htmlFor="edit-phone">
              <PhoneCountryInput hideLabel value={editForm.phone} onChange={(val) => setEditForm((f) => ({ ...f, phone: val }))} controlClassName="h-11 rounded-lg" />
            </FormField>
          </div>
          <FormField label="Email" htmlFor="edit-email">
            <TextInput id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </FormField>
          <FormField label="Entreprise" htmlFor="edit-companyName">
            <TextInput id="edit-companyName" value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} />
          </FormField>
          <FormField label="Pays" htmlFor="edit-country">
            <CountryCombobox id="edit-country" variant="country" value={isoFromCountryLabel(editForm.country) ?? null} onChange={(iso) => setEditForm((f) => ({ ...f, country: countryLabelFr(iso) }))} />
          </FormField>
          <FormField label="Ville" htmlFor="edit-city">
            <TextInput id="edit-city" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
          </FormField>
        </div>
      </CenterDialog>

      {/* Réinitialisation du mot de passe — confirmation */}
      <CenterDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetPassword}
        title="Réinitialiser le mot de passe"
        width={460}
        footer={
          <>
            <PrimaryPill onClick={handleResetPassword} loading={resetPassword.isPending} className="flex-1">
              Générer nouveau mot de passe
            </PrimaryPill>
            <SoftPill onClick={() => setResetOpen(false)} className="flex-1">
              Annuler
            </SoftPill>
          </>
        }
      >
        <p className={cn('text-[14px]', TEXT.muted)}>
          Un nouveau mot de passe temporaire sera généré pour{' '}
          <strong className={TEXT.strong}>{name}</strong>. Vous devrez le transmettre manuellement au client.
        </p>
      </CenterDialog>

      {/* Mot de passe généré */}
      <CenterDialog
        open={!!newPassword}
        onClose={() => setNewPassword('')}
        title="Mot de passe généré"
        width={460}
        footer={
          <PrimaryPill onClick={() => setNewPassword('')} className="flex-1">
            Fermer
          </PrimaryPill>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[14px]', TEXT.muted)}>
            Voici le nouveau mot de passe temporaire. Transmettez-le de manière sécurisée au client.
          </p>
          <div className={cn('flex items-center justify-between gap-3 rounded-2xl p-4', SURFACE.canvas)}>
            <code className={cn('font-mono text-[18px]', TEXT.strong)}>{newPassword}</code>
            <Holder icon={passwordCopied ? Check : Copy} tone={passwordCopied ? 'success' : 'neutral'} size="sm" onClick={copyPassword} />
          </div>
          <p className="rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            Ce mot de passe ne sera plus affiché après fermeture de cette fenêtre.
          </p>
        </div>
      </CenterDialog>

      {/* Suppression — confirmation */}
      <CenterDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer le client"
        width={460}
        footer={
          <>
            <PrimaryPill danger onClick={() => deleteClient.mutate(client.id)} loading={deleteClient.isPending} className="flex-1">
              Confirmer la suppression
            </PrimaryPill>
            <SoftPill onClick={() => setDeleteOpen(false)} className="flex-1">
              Annuler
            </SoftPill>
          </>
        }
      >
        <p className={cn('text-[14px]', TEXT.muted)}>
          Voulez-vous vraiment supprimer <strong className={TEXT.strong}>{name}</strong> ? Cette action est{' '}
          <strong className={TEXT.strong}>irréversible</strong> et supprimera toutes ses données (historique de
          transactions, relevés, etc.).
        </p>
      </CenterDialog>

      {/* Relevé de compte — choix de la période */}
      <StatementPeriodSheet
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        onGenerate={downloadStatement}
        isGenerating={isGeneratingPDF}
      />
    </aside>
  );
}
