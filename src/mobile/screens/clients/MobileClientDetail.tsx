import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClient, useResetClientPassword, useClientLedger, useUpdateClient } from '@/hooks/useClientManagement';
import { useAdminDeleteClient } from '@/hooks/useAdminDeleteClient';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useCurrentExchangeRate } from '@/hooks/useExchangeRates';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { formatCurrencyRMB, formatXAF, formatDate } from '@/lib/formatters';
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
} from 'lucide-react';
import { SkeletonClientDetail } from '@/mobile/components/ui/SkeletonCard';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { AdjustmentDrawer } from '@/mobile/components/clients/AdjustmentDrawer';
import { toast } from 'sonner';
import type { AdjustmentType } from '@/types/admin';

const STATUS_BADGE_STYLES: Record<string, string> = {
  ACTIVE:      'bg-green-500/10 text-green-600 dark:text-green-400',
  INACTIVE:    'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  SUSPENDED:   'bg-red-500/10 text-red-600 dark:text-red-400',
  PENDING_KYC: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

// Status labels are resolved via i18n inside the component
const STATUS_LABEL_KEYS: Record<string, { key: string; defaultValue: string }> = {
  ACTIVE:      { key: 'active', defaultValue: 'Actif' },
  INACTIVE:    { key: 'inactive', defaultValue: 'Inactif' },
  SUSPENDED:   { key: 'suspendedStatus', defaultValue: 'Suspendu' },
  PENDING_KYC: { key: 'kycPending', defaultValue: 'KYC en attente' },
};

export function MobileClientDetail() {
  const { t } = useTranslation('common');
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading, refetch } = useClient(clientId || '');
  const { data: currentRate } = useCurrentExchangeRate();
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
      <div className="flex flex-col min-h-screen">
        <MobileHeader title={t('clientDetail', { defaultValue: 'Détail client' })} showBack backTo="/m/clients" />
        <SkeletonClientDetail />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title={t('clientDetail', { defaultValue: 'Détail client' })} showBack backTo="/m/clients" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">{t('clientNotFound', { defaultValue: 'Client non trouvé' })}</p>
        </div>
      </div>
    );
  }

  const initials = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`;

  return (
    <div className="flex flex-col min-h-screen pb-4">
      <MobileHeader title="Fiche client" showBack backTo="/m/clients" />

      <div className="flex-1 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
        {/* Profile Card */}
        <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center text-lg sm:text-xl font-semibold text-primary flex-shrink-0">
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold truncate">
                  {client.firstName} {client.lastName}
                </h2>
                <span className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium',
                  STATUS_BADGE_STYLES[client.status]
                )}>
                  {STATUS_LABELS[client.status]}
                </span>
              </div>

              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {client.phone}
                </a>
              )}

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <Mail className="w-3.5 h-3.5" />
                {client.email || 'Non renseigné'}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Calendar className="w-3 h-3" />
                Client depuis {formatDate(client.createdAt)}
              </div>

              {client.utmSource && (
                <div className="flex items-center gap-1.5 text-xs mt-1.5">
                  <Link2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Source :</span>
                  <span className="font-medium capitalize px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {client.utmSource}
                  </span>
                  {client.utmCampaign && (
                    <span className="text-muted-foreground truncate">· {client.utmCampaign}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-5 border border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Solde disponible</span>
            </div>
            <button
              onClick={() => navigate(`/m/clients/${client.id}/ledger`)}
              className="text-primary text-sm font-medium"
            >
              Historique
            </button>
          </div>

          <p className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
            {formatXAF(client.walletBalance || 0)}{' '}
            <span className="text-xl font-medium text-primary/70">XAF</span>
          </p>
          {currentRate && (
            <p className="text-base font-semibold text-muted-foreground mt-1">
              ≈ {formatCurrencyRMB((client.walletBalance || 0) * currentRate.rate_xaf_to_rmb)}
            </p>
          )}

          {client.lastLedgerEntry && (
            <p className="text-xs text-muted-foreground mt-2">
              Dernier mouvement : {formatDate(client.lastLedgerEntry.createdAt)}
            </p>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-primary/10">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/15"
              onClick={() => openAdjustment('CREDIT')}
            >
              <Plus className="w-4 h-4 mr-1" />
              Crédit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/15"
              onClick={() => openAdjustment('DEBIT')}
            >
              <Minus className="w-4 h-4 mr-1" />
              Débit
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <ArrowDownCircle className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatXAF(client.totalDeposits || 0)}{' '}
              <span className="text-sm font-medium">XAF</span>
            </p>
            <p className="text-xs text-muted-foreground">Total dépôts</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ArrowUpCircle className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatXAF(client.totalPayments || 0)}{' '}
              <span className="text-sm font-medium">XAF</span>
            </p>
            <p className="text-xs text-muted-foreground">Total paiements</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => navigate(`/m/clients/${client.id}/ledger`)}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <History className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Historique mouvements</p>
                <p className="text-xs text-muted-foreground">Voir le ledger complet</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button
            onClick={() => navigate(`/m/deposits/new?clientId=${client.id}`)}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <ArrowDownCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-left">
                <p className="font-medium">Déclarer un dépôt</p>
                <p className="text-xs text-muted-foreground">Créer un nouveau dépôt</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button
            onClick={handleDownloadStatement}
            disabled={isStatementGenerating}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                {isStatementGenerating ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <FileDown className="w-5 h-5 text-blue-500" />
                )}
              </div>
              <div className="text-left">
                <p className="font-medium">
                  {isStatementGenerating ? 'Génération en cours…' : 'Exporter relevé PDF'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ledgerEntries?.length
                    ? `${ledgerEntries.length} opération${ledgerEntries.length > 1 ? 's' : ''}`
                    : 'Télécharger l\'historique'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Edit Client */}
          {canManageUsers && (
            <button
              onClick={openEdit}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Modifier le profil</p>
                  <p className="text-xs text-muted-foreground">Nom, téléphone, email, entreprise…</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          )}

          {/* Reset Password */}
          {canManageUsers && (
            <button
              onClick={() => setResetDrawerOpen(true)}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Key className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Réinitialiser mot de passe</p>
                  <p className="text-xs text-muted-foreground">Générer un nouveau mot de passe</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          )}

          {/* Delete Client */}
          {canManageUsers && (
            <button
              onClick={handleDeleteCheck}
              disabled={deleteChecking}
              className="w-full flex items-center justify-between p-4 bg-destructive/5 rounded-xl border border-destructive/20 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  {deleteChecking ? <Loader2 className="w-5 h-5 text-destructive animate-spin" /> : <Trash2 className="w-5 h-5 text-destructive" />}
                </div>
                <div className="text-left">
                  <p className="font-medium text-destructive">Supprimer le client</p>
                  <p className="text-xs text-muted-foreground">Suppression définitive et irréversible</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>
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

      {/* Edit Client Drawer */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Modifier le profil
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-3 overflow-y-auto max-h-[60vh]">
            {[
              { label: 'Prénom', key: 'firstName' as const, icon: <Phone className="w-4 h-4" /> },
              { label: 'Nom', key: 'lastName' as const, icon: <Phone className="w-4 h-4" /> },
              { label: 'Téléphone / WhatsApp', key: 'phone' as const, icon: <Phone className="w-4 h-4" /> },
              { label: 'Email', key: 'email' as const, icon: <Mail className="w-4 h-4" /> },
              { label: 'Entreprise', key: 'companyName' as const, icon: <Building2 className="w-4 h-4" /> },
              { label: 'Pays', key: 'country' as const, icon: <MapPin className="w-4 h-4" /> },
              { label: 'Ville', key: 'city' as const, icon: <MapPin className="w-4 h-4" /> },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-bold mb-1">{label}</label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  value={editForm[key]}
                  onChange={(e) => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={label}
                />
              </div>
            ))}
          </div>
          <DrawerFooter>
            <Button onClick={handleSaveEdit} disabled={updateClientMutation.isPending}>
              {updateClientMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete Client Confirmation Drawer */}
      <Drawer open={deleteDrawerOpen} onOpenChange={setDeleteDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Supprimer le client
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <p className="text-muted-foreground">
              Voulez-vous vraiment supprimer{' '}
              <strong>{client?.firstName} {client?.lastName}</strong> ?
              Cette action est <strong>irréversible</strong> et supprimera toutes ses données
              (historique de transactions, relevés, etc.).
            </p>
          </div>
          <DrawerFooter>
            <Button
              variant="destructive"
              onClick={() => client && deleteClientMutation.mutate(client.id)}
              disabled={deleteClientMutation.isPending}
            >
              {deleteClientMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer la suppression
            </Button>
            <Button variant="outline" onClick={() => setDeleteDrawerOpen(false)}>
              Annuler
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Reset Password Confirmation Drawer */}
      <Drawer open={resetDrawerOpen} onOpenChange={setResetDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Réinitialiser le mot de passe
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <p className="text-muted-foreground">
              Un nouveau mot de passe temporaire sera généré pour{' '}
              <strong>{client.firstName} {client.lastName}</strong>. Vous devrez le
              transmettre manuellement au client.
            </p>
          </div>
          <DrawerFooter>
            <Button onClick={handleResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Générer nouveau mot de passe
            </Button>
            <Button variant="outline" onClick={() => setResetDrawerOpen(false)}>
              Annuler
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Password Result Drawer */}
      <Drawer open={passwordResultDrawerOpen} onOpenChange={setPasswordResultDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Mot de passe généré
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-4">
            <p className="text-muted-foreground">
              Voici le nouveau mot de passe temporaire. Transmettez-le de manière sécurisée au client.
            </p>
            <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
              <code className="text-lg font-mono">{newPassword}</code>
              <Button variant="ghost" size="icon" onClick={handleCopyPassword}>
                {passwordCopied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg">
              Ce mot de passe ne sera plus affiché après fermeture de cette fenêtre.
            </p>
          </div>
          <DrawerFooter>
            <Button onClick={() => setPasswordResultDrawerOpen(false)}>Fermer</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
