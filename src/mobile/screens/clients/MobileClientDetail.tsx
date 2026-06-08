import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClient, useResetClientPassword, useClientLedger, useUpdateClient } from '@/hooks/useClientManagement';
import { useAdminDeleteClient } from '@/hooks/useAdminDeleteClient';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { formatXAF, formatDate } from '@/lib/formatters';
import {
  generateClientStatement,
  buildMovementFromLedgerEntry,
  shouldIncludeLedgerEntry,
  fmtDateLong,
} from '@/lib/generateClientStatement';
import { cn } from '@/lib/utils';
import {
  Phone,
  Mail,
  Calendar,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  History,
  Plus,
  Minus,
  FileDown,
  Key,
  Copy,
  Check,
  Loader2,
  Pencil,
  Building2,
  MapPin,
  Trash2,
  Link2,
  Users,
} from 'lucide-react';
import { SkeletonClientDetail } from '@/mobile/components/ui/SkeletonCard';
import { AdjustmentDrawer } from '@/mobile/components/clients/AdjustmentDrawer';
import { toast } from 'sonner';
import type { AdjustmentType } from '@/types/admin';
import {
  SURFACE,
  TEXT,
  TONE_HOLDER,
  type Tone,
  clientStatusTone,
  Card,
  Amount,
  StatCard,
  StatusPill,
  Holder,
  BottomSheet,
  FormField,
  TextInput,
  PrimaryPill,
  SoftPill,
} from '@/mobile/designKit';

// Status labels are resolved via i18n inside the component
const STATUS_LABEL_KEYS: Record<string, { key: string; defaultValue: string }> = {
  ACTIVE:      { key: 'active', defaultValue: 'Actif' },
  INACTIVE:    { key: 'inactive', defaultValue: 'Inactif' },
  SUSPENDED:   { key: 'suspendedStatus', defaultValue: 'Suspendu' },
  PENDING_KYC: { key: 'kycPending', defaultValue: 'KYC en attente' },
};

// Action row in the Ofspace/Mola language: neutral (or toned) round holder +
// label/desc + chevron. No divider hairlines (cards group items).
function ActionRow({
  icon: Icon,
  tone = 'neutral',
  label,
  description,
  onClick,
  disabled,
  destructive,
  loading,
}: {
  icon: React.ElementType;
  tone?: Tone;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left transition active:scale-[0.99] disabled:opacity-60"
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          destructive ? TONE_HOLDER.danger : TONE_HOLDER[tone],
        )}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-semibold', destructive ? 'text-[#C0504D] dark:text-[#E79A9A]' : TEXT.strong)}>
          {label}
        </span>
        {description && <span className={cn('block truncate text-[12.5px]', TEXT.muted)}>{description}</span>}
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

export function MobileClientDetail() {
  const { t } = useTranslation('common');
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading, refetch } = useClient(clientId || '');
  const { hasPermission } = useAdminAuth();
  const resetPasswordMutation = useResetClientPassword();

  const [isStatementGenerating, setIsStatementGenerating] = useState(false);
  const { data: ledgerEntries } = useClientLedger(clientId || '');

  // Adjustment drawer state
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('CREDIT');

  // Password reset drawer state
  const [resetDrawerOpen, setResetDrawerOpen] = useState(false);
  const [passwordResultDrawerOpen, setPasswordResultDrawerOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

  const canManageUsers = hasPermission('canManageUsers');
  const updateClientMutation = useUpdateClient();

  // Edit client drawer state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', companyName: '', country: '', city: '',
  });

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

  const handleSaveEdit = async () => {
    if (!client) return;
    await updateClientMutation.mutateAsync({
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
  };

  const deleteClientMutation = useAdminDeleteClient();

  // Delete client drawer state
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);

  const handleDeleteCheck = async () => {
    if (!client) return;
    setDeleteChecking(true);
    try {
      if ((client.walletBalance || 0) > 0) {
        toast.error(t('cannotDeleteClientPositiveBalance', { defaultValue: `Impossible de supprimer un client avec un solde positif (${formatXAF(client.walletBalance || 0)} XAF)` }));
        return;
      }
      const { data: pending } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('user_id', client.id)
        .in('status', ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'cash_pending', 'cash_scanned'])
        .limit(1);
      if (pending && pending.length > 0) {
        toast.error(t('cannotDeleteClientPendingPayments', { defaultValue: 'Impossible de supprimer un client ayant des paiements en cours' }));
        return;
      }
      setDeleteDrawerOpen(true);
    } finally {
      setDeleteChecking(false);
    }
  };

  const openAdjustment = (type: AdjustmentType) => {
    setAdjustmentType(type);
    setAdjustmentOpen(true);
  };

  const handleDownloadStatement = async () => {
    if (!client) return;
    if (!ledgerEntries?.length) {
      toast.error(t('noMovementsToExport', { defaultValue: 'Aucun mouvement à exporter' }));
      return;
    }
    setIsStatementGenerating(true);
    try {
      const sorted = [...ledgerEntries]
        .filter(entry => shouldIncludeLedgerEntry({
          id: entry.id,
          entryType: entry.entryType,
          amountXAF: entry.amountXAF,
          balanceBefore: entry.balanceBefore,
          balanceAfter: entry.balanceAfter,
          description: entry.description,
          createdAt: entry.createdAt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          isTest: (entry as any).isTest,
        }))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const movements = sorted.map(entry =>
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
        })
      );

      await generateClientStatement({
        clientName: `${client.firstName} ${client.lastName}`,
        clientPhone: client.phone ?? undefined,
        clientEmail: client.email || undefined,
        movements,
        periodFrom: movements.length > 0 ? fmtDateLong(movements[0].date) : '—',
        periodTo: fmtDateLong(new Date().toISOString()),
        generatedAt: new Date().toLocaleString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
      });
    } catch (err) {
      console.error('Error generating statement:', err);
      toast.error(t('statementGenerationError', { defaultValue: 'Erreur lors de la génération du relevé' }));
    } finally {
      setIsStatementGenerating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!client) return;
    const result = await resetPasswordMutation.mutateAsync(client.id);
    if (result.tempPassword) {
      setNewPassword(result.tempPassword);
      setResetDrawerOpen(false);
      setPasswordResultDrawerOpen(true);
    }
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(newPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <MobileHeader title={t('clientDetail', { defaultValue: 'Détail client' })} showBack backTo="/m/clients" />
        <div className={cn('flex-1', SURFACE.canvas)}>
          <SkeletonClientDetail />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-screen flex-col">
        <MobileHeader title={t('clientDetail', { defaultValue: 'Détail client' })} showBack backTo="/m/clients" />
        <div className={cn('flex flex-1 items-center justify-center p-4', SURFACE.canvas)}>
          <p className={TEXT.muted}>{t('clientNotFound', { defaultValue: 'Client non trouvé' })}</p>
        </div>
      </div>
    );
  }

  const initials = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`;

  return (
    <div className="flex min-h-screen flex-col">
      <MobileHeader title={t('clientProfile', { defaultValue: 'Fiche client' })} showBack backTo="/m/clients" />

      <div className={cn('flex-1 space-y-4 px-4 py-5', SURFACE.canvas)}>
        {/* Profile Card */}
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold', SURFACE.holder)}>
              {initials || '?'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className={cn('truncate text-[18px] font-bold', TEXT.strong)}>
                  {client.firstName} {client.lastName}
                </h2>
                <StatusPill
                  tone={clientStatusTone(client.status)}
                  label={t(STATUS_LABEL_KEYS[client.status]?.key ?? 'unknown', { defaultValue: STATUS_LABEL_KEYS[client.status]?.defaultValue ?? client.status })}
                />
              </div>

              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className={cn('mt-1.5 flex items-center gap-1.5 text-[13px]', TEXT.muted)}
                >
                  <Phone className="h-3.5 w-3.5" />
                  {client.phone}
                </a>
              )}

              <div className={cn('mt-1 flex items-center gap-1.5 text-[13px]', TEXT.muted)}>
                <Mail className="h-3.5 w-3.5" />
                {client.email || t('notProvided', { defaultValue: 'Non renseigné' })}
              </div>

              <div className={cn('mt-2 flex items-center gap-1.5 text-[12px]', TEXT.muted)}>
                <Calendar className="h-3 w-3" />
                {t('clientSince', { defaultValue: 'Client depuis' })} {formatDate(client.createdAt)}
              </div>

              {client.utmSource && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
                  <Link2 className={cn('h-3 w-3 shrink-0', TEXT.muted)} />
                  <span className={TEXT.muted}>Source :</span>
                  <StatusPill tone="info" label={<span className="capitalize">{client.utmSource}</span>} />
                  {client.utmCampaign && (
                    <span className={cn('truncate', TEXT.muted)}>· {client.utmCampaign}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Wallet Balance Card */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Holder icon={Wallet} size="sm" />
              <span className={cn('text-[13px] font-medium', TEXT.muted)}>{t('availableBalance', { defaultValue: 'Solde disponible' })}</span>
            </div>
            <button
              onClick={() => navigate(`/m/clients/${client.id}/ledger`)}
              className="text-[13px] font-semibold text-[#6B5BD2] active:opacity-70 dark:text-[#A99BF0]"
            >
              {t('history', { defaultValue: 'Historique' })}
            </button>
          </div>

          <Amount value={formatXAF(client.walletBalance || 0)} unit="XAF" size="xl" />

          {client.lastLedgerEntry && (
            <p className={cn('mt-2 text-[12px]', TEXT.muted)}>
              {t('lastMovement', { defaultValue: 'Dernier mouvement' })} : {formatDate(client.lastLedgerEntry.createdAt)}
            </p>
          )}

          {/* Quick Actions */}
          <div className="mt-4 flex gap-2.5">
            <button
              onClick={() => openAdjustment('CREDIT')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-[14px] font-bold transition active:scale-[0.99]',
                TONE_HOLDER.success,
              )}
            >
              <Plus className="h-4 w-4" />
              {t('credit', { defaultValue: 'Crédit' })}
            </button>
            <button
              onClick={() => openAdjustment('DEBIT')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-[14px] font-bold transition active:scale-[0.99]',
                TONE_HOLDER.danger,
              )}
            >
              <Minus className="h-4 w-4" />
              {t('debitLabel', { defaultValue: 'Débit' })}
            </button>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={ArrowDownCircle}
            tone="success"
            label={t('totalDeposits', { defaultValue: 'Total dépôts' })}
            value={formatXAF(client.totalDeposits || 0)}
            unit="XAF"
          />
          <StatCard
            icon={ArrowUpCircle}
            tone="info"
            label={t('totalPayments', { defaultValue: 'Total paiements' })}
            value={formatXAF(client.totalPayments || 0)}
            unit="XAF"
          />
        </div>

        {/* Actions */}
        <Card className="space-y-0.5 p-2">
          <ActionRow
            icon={History}
            label={t('movementHistory', { defaultValue: 'Historique mouvements' })}
            description={t('viewFullLedger', { defaultValue: 'Voir le ledger complet' })}
            onClick={() => navigate(`/m/clients/${client.id}/ledger`)}
          />
          <ActionRow
            icon={ArrowDownCircle}
            tone="success"
            label={t('declareDeposit', { defaultValue: 'Déclarer un dépôt' })}
            description={t('createNewDeposit', { defaultValue: 'Créer un nouveau dépôt' })}
            onClick={() => navigate(`/m/deposits/new?clientId=${client.id}`)}
          />
          <ActionRow
            icon={Users}
            tone="info"
            label={t('beneficiaries', { defaultValue: 'Bénéficiaires' })}
            description={t('manageBeneficiaries', { defaultValue: 'Gérer le carnet du client' })}
            onClick={() => navigate(`/m/clients/${client.id}/beneficiaries`)}
          />
          <ActionRow
            icon={FileDown}
            tone="info"
            label={isStatementGenerating ? t('generatingStatement', { defaultValue: 'Génération en cours…' }) : t('exportPDFStatement', { defaultValue: 'Exporter relevé PDF' })}
            description={
              ledgerEntries?.length
                ? `${ledgerEntries.length} ${t('operations', { defaultValue: 'opération', count: ledgerEntries.length })}${ledgerEntries.length > 1 ? 's' : ''}`
                : t('downloadHistory', { defaultValue: "Télécharger l'historique" })
            }
            onClick={handleDownloadStatement}
            disabled={isStatementGenerating}
            loading={isStatementGenerating}
          />

          {/* Edit Client */}
          {canManageUsers && (
            <ActionRow
              icon={Pencil}
              label={t('editProfile', { defaultValue: 'Modifier le profil' })}
              description={t('namePhoneEmailCompany', { defaultValue: 'Nom, téléphone, email, entreprise…' })}
              onClick={openEdit}
            />
          )}

          {/* Reset Password */}
          {canManageUsers && (
            <ActionRow
              icon={Key}
              tone="pending"
              label={t('resetPasswordAction', { defaultValue: 'Réinitialiser mot de passe' })}
              description={t('generateNewPassword', { defaultValue: 'Générer un nouveau mot de passe' })}
              onClick={() => setResetDrawerOpen(true)}
            />
          )}

          {/* Delete Client */}
          {canManageUsers && (
            <ActionRow
              icon={Trash2}
              destructive
              label={t('deleteClient', { defaultValue: 'Supprimer le client' })}
              description={t('permanentDeletion', { defaultValue: 'Suppression définitive et irréversible' })}
              onClick={handleDeleteCheck}
              disabled={deleteChecking}
              loading={deleteChecking}
            />
          )}
        </Card>
      </div>

      {/* Adjustment Drawer */}
      <AdjustmentDrawer
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        type={adjustmentType}
        userId={client.id}
        currentBalance={client.walletBalance || 0}
        onSuccess={() => {
          refetch();
          setAdjustmentOpen(false);
        }}
      />

      {/* Edit Client Sheet */}
      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-[#6B5BD2] dark:text-[#A99BF0]" />
            {t('editProfile', { defaultValue: 'Modifier le profil' })}
          </span>
        }
      >
        <div className="space-y-3">
          {([
            { label: t('firstName', { defaultValue: 'Prénom' }), key: 'firstName' as const },
            { label: t('lastName', { defaultValue: 'Nom' }), key: 'lastName' as const },
            { label: t('phoneWhatsApp', { defaultValue: 'Téléphone / WhatsApp' }), key: 'phone' as const },
            { label: t('emailLabel', { defaultValue: 'Email' }), key: 'email' as const },
            { label: t('company', { defaultValue: 'Entreprise' }), key: 'companyName' as const },
            { label: t('country', { defaultValue: 'Pays' }), key: 'country' as const },
            { label: t('city', { defaultValue: 'Ville' }), key: 'city' as const },
          ]).map(({ label, key }) => (
            <FormField key={key} label={label} htmlFor={`edit-${key}`}>
              <TextInput
                id={`edit-${key}`}
                value={editForm[key]}
                onChange={(e) => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={label}
              />
            </FormField>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryPill onClick={handleSaveEdit} loading={updateClientMutation.isPending} className="w-full">
            {t('save', { defaultValue: 'Enregistrer' })}
          </PrimaryPill>
          <SoftPill onClick={() => setEditOpen(false)} className="w-full">
            {t('cancel', { defaultValue: 'Annuler' })}
          </SoftPill>
        </div>
      </BottomSheet>

      {/* Delete Client Confirmation Sheet */}
      <BottomSheet
        open={deleteDrawerOpen}
        onClose={() => setDeleteDrawerOpen(false)}
        title={
          <span className="flex items-center gap-2 text-[#C0504D] dark:text-[#E79A9A]">
            <Trash2 className="h-5 w-5" />
            {t('deleteClient', { defaultValue: 'Supprimer le client' })}
          </span>
        }
      >
        <p className={cn('text-[14px]', TEXT.muted)}>
          Voulez-vous vraiment supprimer{' '}
          <strong className={TEXT.strong}>{client?.firstName} {client?.lastName}</strong> ?
          Cette action est <strong className={TEXT.strong}>irréversible</strong> et supprimera toutes ses données
          (historique de transactions, relevés, etc.).
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryPill
            danger
            onClick={() => client && deleteClientMutation.mutate(client.id)}
            loading={deleteClientMutation.isPending}
            className="w-full"
          >
            {t('confirmDeletion', { defaultValue: 'Confirmer la suppression' })}
          </PrimaryPill>
          <SoftPill onClick={() => setDeleteDrawerOpen(false)} className="w-full">
            {t('cancel', { defaultValue: 'Annuler' })}
          </SoftPill>
        </div>
      </BottomSheet>

      {/* Reset Password Confirmation Sheet */}
      <BottomSheet
        open={resetDrawerOpen}
        onClose={() => setResetDrawerOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[#6B5BD2] dark:text-[#A99BF0]" />
            {t('resetPasswordAction', { defaultValue: 'Réinitialiser le mot de passe' })}
          </span>
        }
      >
        <p className={cn('text-[14px]', TEXT.muted)}>
          {t('resetPasswordClientMessage', { defaultValue: 'Un nouveau mot de passe temporaire sera généré pour' })}{' '}
          <strong className={TEXT.strong}>{client.firstName} {client.lastName}</strong>. {t('resetPasswordClientSuffix', { defaultValue: 'Vous devrez le transmettre manuellement au client.' })}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryPill onClick={handleResetPassword} loading={resetPasswordMutation.isPending} className="w-full">
            {t('generateNewPassword', { defaultValue: 'Générer nouveau mot de passe' })}
          </PrimaryPill>
          <SoftPill onClick={() => setResetDrawerOpen(false)} className="w-full">
            {t('cancel', { defaultValue: 'Annuler' })}
          </SoftPill>
        </div>
      </BottomSheet>

      {/* Password Result Sheet */}
      <BottomSheet
        open={passwordResultDrawerOpen}
        onClose={() => setPasswordResultDrawerOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Check className="h-5 w-5 text-[#2E7D52] dark:text-[#7FCBA0]" />
            {t('passwordGenerated', { defaultValue: 'Mot de passe généré' })}
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[14px]', TEXT.muted)}>
            {t('tempPasswordClientMessage', { defaultValue: 'Voici le nouveau mot de passe temporaire. Transmettez-le de manière sécurisée au client.' })}
          </p>
          <div className={cn('flex items-center justify-between gap-3 rounded-2xl p-4', SURFACE.canvas)}>
            <code className={cn('font-mono text-[18px]', TEXT.strong)}>{newPassword}</code>
            <Holder icon={passwordCopied ? Check : Copy} tone={passwordCopied ? 'success' : 'neutral'} size="sm" onClick={handleCopyPassword} />
          </div>
          <p className="rounded-2xl bg-[#F8EFD8] p-3 text-[13px] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
            {t('passwordWontBeShownAgain', { defaultValue: 'Ce mot de passe ne sera plus affiché après fermeture de cette fenêtre.' })}
          </p>
        </div>
        <div className="mt-5">
          <PrimaryPill onClick={() => setPasswordResultDrawerOpen(false)} className="w-full">
            {t('close', { defaultValue: 'Fermer' })}
          </PrimaryPill>
        </div>
      </BottomSheet>
    </div>
  );
}
