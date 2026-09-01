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
  useResetClientPassword,
  useUpdateClient,
  useCreateAdjustment,
} from '@/hooks/useClientManagement';
import { useAdminDeleteClient } from '@/hooks/useAdminDeleteClient';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { formatXAF, formatCurrency, formatDate } from '@/lib/formatters';
import {
  generateClientStatement,
  buildMovementFromLedgerEntry,
  shouldIncludeLedgerEntry,
  fmtDateLong,
} from '@/lib/generateClientStatement';
import { ENTRY_TYPE_CONFIG, AMOUNT_TONE } from '@/lib/ledgerDisplay';
import { normalizePhone } from '@/lib/phone';
import { useClientPhones } from '@/hooks/useClientPhones';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { PhoneCountryInput } from '@/components/auth/PhoneCountryInput';
import { AmountField, TextArea } from '@/components/form';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AdjustmentType } from '@/types/admin';
import {
  SURFACE,
  TEXT,
  TONE_HOLDER,
  PRIMARY_PILL,
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
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  type: AdjustmentType;
  userId: string;
  currentBalance: number;
  onSuccess: () => void;
}) {
  const [amountNumber, setAmountNumber] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const createAdjustment = useCreateAdjustment();

  const amount = amountNumber ?? 0;
  const isDebit = type === 'DEBIT';
  const insufficient = isDebit && amount > currentBalance;
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
          <Amount value={formatCurrency(currentBalance)} size="md" className="mt-0.5" />
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
            <p className={cn('mt-2 text-[13px]', TEXT.muted)}>
              Nouveau solde : {formatCurrency(isDebit ? currentBalance - amount : currentBalance + amount)}
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
  const { hasPermission } = useAdminAuth();
  const canManageUsers = hasPermission('canManageUsers');

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

  const downloadStatement = async () => {
    if (!client || isGeneratingPDF) return;
    if (!ledgerEntries?.length) {
      toast.error('Aucun mouvement à exporter');
      return;
    }
    setIsGeneratingPDF(true);
    try {
      const sorted = [...ledgerEntries]
        .filter((entry) =>
          shouldIncludeLedgerEntry({
            id: entry.id,
            entryType: entry.entryType,
            amountXAF: entry.amountXAF,
            balanceBefore: entry.balanceBefore,
            balanceAfter: entry.balanceAfter,
            description: entry.description,
            createdAt: entry.createdAt,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            isTest: (entry as any).isTest,
          }),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const movements = sorted.map((entry) =>
        buildMovementFromLedgerEntry({
          id: entry.id,
          entryType: entry.entryType,
          amountXAF: entry.amountXAF,
          balanceBefore: entry.balanceBefore,
          balanceAfter: entry.balanceAfter,
          referenceId: entry.referenceId,
          referenceType: entry.referenceType,
          description: entry.description,
          createdAt: entry.createdAt,
        }),
      );
      await generateClientStatement({
        clientName: `${client.firstName} ${client.lastName}`,
        clientPhone: client.phone ?? undefined,
        clientEmail: client.email || undefined,
        movements,
        periodFrom: movements.length > 0 ? fmtDateLong(movements[0].date) : '—',
        periodTo: fmtDateLong(new Date().toISOString()),
        generatedAt: new Date().toLocaleString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
      });
    } catch (err) {
      console.error('Error generating statement:', err);
      toast.error('Erreur lors de la génération du relevé');
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
            {client.phone || '—'}
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
            Solde disponible
          </SecLabel>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <Amount value={formatXAF(client.walletBalance || 0)} unit="XAF" size="xl" />
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
                Voir tout ({ledgerEntries?.length ?? 0})
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
            onClick={downloadStatement}
            disabled={isGeneratingPDF}
            className={cn('flex items-center justify-center gap-2 rounded-md py-2.5 text-[13px] font-semibold disabled:opacity-60', SURFACE.card, 'ring-1 ring-black/[0.07] dark:ring-white/[0.08]', TEXT.strong)}
          >
            {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Relevé PDF
          </button>
        </div>
      </div>

      {/* ── Dialogues ───────────────────────────────────────────────────── */}
      <AdjustmentDialog
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
              <PhoneCountryInput hideLabel value={editForm.phone} onChange={(val) => setEditForm((f) => ({ ...f, phone: val }))} />
            </FormField>
          </div>
          <FormField label="Email" htmlFor="edit-email">
            <TextInput id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </FormField>
          <FormField label="Entreprise" htmlFor="edit-companyName">
            <TextInput id="edit-companyName" value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} />
          </FormField>
          <FormField label="Pays" htmlFor="edit-country">
            <TextInput id="edit-country" value={editForm.country} onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))} />
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
    </aside>
  );
}
