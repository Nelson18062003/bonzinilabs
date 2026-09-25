import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  useClient,
  useResetClientPassword,
  useClientLedger,
  useClientLedgerCount,
  useUpdateClient,
  fetchLedgerEntriesInRange,
  fetchLastLedgerEntryBefore,
} from '@/hooks/useClientManagement';
import { StatementPeriodSheet } from '@/components/statement/StatementPeriodSheet';
import { statementQueryRange, type StatementRange } from '@/lib/statementPeriod';
import { useAdminDeleteClient } from '@/hooks/useAdminDeleteClient';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { formatXAF } from '@/lib/formatters';
import { whenSentence } from '@/lib/plainTime';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  generateStatementForRange,
  buildMovementFromLedgerEntry,
  shouldIncludeLedgerEntry,
} from '@/lib/generateClientStatement';
import { cn } from '@/lib/utils';
import {
  ArrowDownCircle,
  ChevronRight,
  Plus,
  Minus,
  FileDown,
  Key,
  Copy,
  Check,
  Loader2,
  Pencil,
  Trash2,
  Users,
  Tag,
  Ship,
} from 'lucide-react';
import { SkeletonClientDetail } from '@/mobile/components/ui/SkeletonCard';
import { AdjustmentDrawer } from '@/mobile/components/clients/AdjustmentDrawer';
import { OverdraftDialog } from '@/components/wallet/OverdraftDialog';
import { availableXaf, overdraftUsedXaf } from '@/lib/overdraft';
import { CustomerCodeCard } from '@/mobile/components/clients/CustomerCodeCard';
import { MobileShippingLabelSheet } from '@/mobile/components/clients/MobileShippingLabelSheet';
import { useClientPhones, useSetClientPhones } from '@/hooks/useClientPhones';
import { ClientPhonesEditor } from '@/components/clients/ClientPhonesEditor';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';
import { useCargoShipments, useCargoFleetDocuments } from '@/hooks/useCargo';
import { useClientDeposits } from '@/hooks/useReception';
import { formatCbm, formatKg } from '@/lib/reception';
import { ALERT, TONE_OF, alertLevel } from '@/lib/cargo/palette';
import { arrivalSentence } from '@/lib/cargo/plain';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { countryLabelFr, isoFromCountryLabel } from '@/data/countries';
import { toast } from 'sonner';
import type { AdjustmentType } from '@/types/admin';
import {
  SURFACE,
  TEXT,
  TONE_HOLDER,
  type Tone,
  clientStatusTone,
  Card,
  Button,
  SectionTitle,
  Line,
  StatusPill,
  ListRow,
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

// Une ligne-geste : pastille ronde (tonée quand la couleur a un sens),
// étiquette 16/600, phrase d'explication 16 sourd, chevron. Un filet entre
// deux lignes pour que le doigt ne se trompe pas.
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
      className={cn('flex min-h-[64px] w-full items-center gap-3.5 border-b py-3 text-left transition last:border-b-0 active:opacity-70 disabled:opacity-60', SURFACE.divider)}
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
        <span className={cn('block text-[16px] font-semibold', destructive ? 'text-[#900B09] dark:text-[#FDD3D0]' : TEXT.strong)}>
          {label}
        </span>
        {description && <span className={cn('block break-words text-[16px] leading-snug', TEXT.muted)}>{description}</span>}
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
  const [statementOpen, setStatementOpen] = useState(false);
  const { data: ledgerEntries } = useClientLedger(clientId || '');
  const { data: ledgerTotal } = useClientLedgerCount(clientId || '');

  // Adjustment drawer state
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('CREDIT');

  // Étiquette colis (feuille)
  const [labelOpen, setLabelOpen] = useState(false);
  const { data: shipping } = useAdminShippingSettings();

  // Password reset drawer state
  const [resetDrawerOpen, setResetDrawerOpen] = useState(false);
  const [passwordResultDrawerOpen, setPasswordResultDrawerOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

  const canManageUsers = hasPermission('canManageUsers');
  const canViewCargo = hasPermission('canViewCargo');
  const canGrantOverdraft = hasPermission('canGrantOverdraft');
  const [overdraftOpen, setOverdraftOpen] = useState(false);
  // Ses conteneurs : la flotte est déjà en cache (badge de l'onglet Cargo).
  // Sans le droit cargo, on ne lance pas les deux requêtes (les papiers de
  // toute la flotte pèsent jusqu'à 3 000 lignes).
  const { data: fleet } = useCargoShipments({ enabled: canViewCargo });
  const { data: clientDeposits } = useClientDeposits(clientId || undefined, canViewCargo);
  const receivedParcels = (clientDeposits ?? []).flatMap((d) => d.parcels);
  const waitingParcels = receivedParcels.filter((p) => !p.shipment_id);
  const { data: docsBy } = useCargoFleetDocuments({ enabled: canViewCargo });
  const containers = canViewCargo && clientId ? (fleet ?? []).filter((c) => c.client_id === clientId) : [];
  const updateClientMutation = useUpdateClient();

  // Edit client drawer state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', email: '', companyName: '', country: '', city: '',
  });
  // `client.id` est le user_id : la clé que lit useClientPhones.
  const { data: clientPhones } = useClientPhones(client?.id);
  const phonesEditor = useClientPhonesEditor();
  const setPhones = useSetClientPhones();

  const openEdit = () => {
    if (!client) return;
    phonesEditor.reset(clientPhones, client.phone, client.country);
    setEditForm({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      companyName: client.companyName,
      country: client.country,
      city: client.city,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!client || updateClientMutation.isPending || setPhones.isPending) return;

    // Un numéro invalide n'est pas seulement mal saisi : le déclencheur de
    // synchronisation met alors phone_e164 à NULL, et le client cesse
    // silencieusement de recevoir ses alertes. Mieux vaut le dire ici.
    if (phonesEditor.primaryInvalid) {
      toast.error('Numéro principal invalide', {
        description: 'Vérifiez le pays et le numéro. Sans numéro valide, ce client ne recevra aucun SMS.',
      });
      return;
    }
    if (phonesEditor.extrasInvalid) {
      toast.error('Un autre numéro est incomplet', { description: 'Complétez-le ou retirez-le.' });
      return;
    }
    const phones = phonesEditor.toInputs();

    try {
      // Les numéros d'abord : la RPC recopie le principal dans la fiche. S'ils
      // sont refusés, rien d'autre n'est écrit.
      if (phonesEditor.changed) await setPhones.mutateAsync({ userId: client.id, phones });
      await updateClientMutation.mutateAsync({
        userId: client.id,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: phones[0].phone_e164,
        email: editForm.email.trim(),
        companyName: editForm.companyName.trim(),
        country: editForm.country.trim(),
        city: editForm.city.trim(),
      });
      setEditOpen(false);
      refetch();
    } catch {
      /* message affiché par le hook */
    }
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

  // Relevé PDF sur une période : la feuille choisit la période, on lit TOUTES
  // les écritures de cette période (plus de plafond à 100), et le solde
  // d'ouverture vient de la dernière écriture avant la période si elle est vide.
  const handleDownloadStatement = async (range: StatementRange) => {
    if (!client) return;
    setIsStatementGenerating(true);
    try {
      const query = statementQueryRange(range);
      const entries = await fetchLedgerEntriesInRange(client.id, query);
      const movements = entries
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((entry) => shouldIncludeLedgerEntry({ ...entry, isTest: (entry as any).isTest }))
        .map((entry) => buildMovementFromLedgerEntry(entry));
      if (query === null && movements.length === 0) {
        toast.error(t('noMovementsToExport', { defaultValue: 'Aucun mouvement à exporter' }));
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
      toast.error(t('statementGenerationError', { defaultValue: 'Erreur lors de la génération du relevé' }));
      return false;
    } finally {
      setIsStatementGenerating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!client) return;
    try {
      const result = await resetPasswordMutation.mutateAsync(client.id);
      if (result.tempPassword) {
        setNewPassword(result.tempPassword);
        setResetDrawerOpen(false);
        setPasswordResultDrawerOpen(true);
      }
    } catch {
      // Le hook affiche déjà l'erreur ; on évite un rejet non géré.
    }
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier : sélectionnez le mot de passe et copiez-le à la main.');
    }
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
  const fullName = `${client.firstName} ${client.lastName}`.trim() || 'Client';
  const statusLabel = t(STATUS_LABEL_KEYS[client.status]?.key ?? 'unknown', { defaultValue: STATUS_LABEL_KEYS[client.status]?.defaultValue ?? client.status });
  const since = format(new Date(client.createdAt), 'd MMMM yyyy', { locale: fr });
  const place = [client.city, client.country].filter(Boolean).join(', ');
  const ledgerCount = ledgerTotal ?? ledgerEntries?.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <MobileHeader title="Client" showBack backTo="/m/clients" />

      <div className={cn('flex flex-1 flex-col gap-6 px-5 pb-8 pt-4', SURFACE.canvas)}>
        {/* ── Qui c'est ─────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[20px] font-semibold', SURFACE.holder)}>
              {initials || '?'}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <StatusPill tone={clientStatusTone(client.status)} label={statusLabel} />
              <h2 className={cn('break-words text-[22px] font-semibold leading-tight', TEXT.strong)}>{fullName}</h2>
              {client.companyName && <Line>{client.companyName}</Line>}
            </div>
          </div>
          {client.phone ? (
            <Line>
              Téléphone :{' '}
              <a href={`tel:${client.phone}`} className={cn("relative font-semibold underline decoration-[#B3B3B3] underline-offset-4 before:absolute before:-inset-y-3 before:-inset-x-1 before:content-['']", TEXT.strong)}>
                {client.phone}
              </a>
              .
            </Line>
          ) : (
            <Line tone="warn">Pas de numéro de téléphone : ce client ne reçoit aucun SMS.</Line>
          )}
          <Line>{client.email ? <>Email : <b className={cn('break-all', TEXT.strong)}>{client.email}</b>.</> : "Pas d'adresse email."}</Line>
          {place && <Line>À {place}.</Line>}
          <Line>Client depuis le {since}.</Line>
          {client.utmSource && (
            <Line>Venu par {client.utmSource}{client.utmCampaign ? ` (campagne ${client.utmCampaign})` : ''}.</Line>
          )}
        </section>

        {/* ── Le colis — le geste le plus fréquent, donc tout en haut ── */}
        {client.customerCode && (
          <Card className="space-y-3">
            <Line>
              Son fournisseur colle <b className={TEXT.strong}>l'étiquette colis</b> sur chaque carton. Sea cargo ou air cargo, en image ou en PDF.
            </Line>
            <Button className="h-12 w-full text-[16px]" onClick={() => setLabelOpen(true)}>
              <Tag />
              Étiquette colis
            </Button>
          </Card>
        )}

        {/* Identifiant client — virement bancaire + étiquette colis */}
        <CustomerCodeCard code={client.customerCode} />

        {/* ── L'argent ──────────────────────────────────────── */}
        <section>
          <SectionTitle action={{ label: 'Historique', onClick: () => navigate(`/m/clients/${client.id}/ledger`) }}>
            L'argent
          </SectionTitle>
          <Card className="space-y-3">
            <p className={cn('text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums', (client.walletBalance || 0) < 0 ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)}>
              {formatXAF(client.walletBalance || 0)} XAF
            </p>
            {(client.walletBalance || 0) < 0 && (
              <Line tone="bad">
                En découvert de {formatXAF(overdraftUsedXaf(client.walletBalance || 0))} XAF
                {(client.walletOverdraftLimit ?? 0) > 0 ? ` sur ${formatXAF(client.walletOverdraftLimit ?? 0)} XAF autorisés.` : '.'}
              </Line>
            )}
            {(client.walletOverdraftLimit ?? 0) > 0 && (client.walletBalance || 0) >= 0 && (
              <Line>
                Découvert autorisé : <b className={cn('tabular-nums', TEXT.strong)}>{formatXAF(client.walletOverdraftLimit ?? 0)} XAF</b>
                {' '}— l'équipe peut débiter jusqu'à <b className={cn('tabular-nums', TEXT.strong)}>{formatXAF(availableXaf(client.walletBalance || 0, client.walletOverdraftLimit ?? 0))} XAF</b>.
              </Line>
            )}
            <Line>
              {client.lastLedgerEntry
                ? `Dernier mouvement ${whenSentence(client.lastLedgerEntry.createdAt)}.`
                : "Aucun mouvement pour l'instant."}
            </Line>
            <Line>
              Au total, ce client a déposé <b className={cn('tabular-nums', TEXT.strong)}>{formatXAF(client.totalDeposits || 0)} XAF</b> et payé{' '}
              <b className={cn('tabular-nums', TEXT.strong)}>{formatXAF(client.totalPayments || 0)} XAF</b>.
            </Line>
            {/* Le serveur garde l'ajustement (admin_adjust_wallet) ; l'UI ne cache rien. */}
            <div className="flex flex-col gap-2 pt-1">
              <Button variant="neutral" className="w-full" onClick={() => openAdjustment('CREDIT')}>
                <Plus />
                Ajouter de l'argent
              </Button>
              <Button variant="neutral" className="w-full" onClick={() => openAdjustment('DEBIT')}>
                <Minus />
                Retirer de l'argent
              </Button>
              {canGrantOverdraft && (
                <Button variant="subtle" className="w-full" onClick={() => setOverdraftOpen(true)}>
                  {(client.walletOverdraftLimit ?? 0) > 0 ? 'Modifier le découvert autorisé' : 'Autoriser un découvert'}
                </Button>
              )}
            </div>
          </Card>
        </section>

        {/* ── Ses colis reçus (Réception, dans Cargo) ─────────── */}
        {canViewCargo && receivedParcels.length > 0 && (
          <section>
            <SectionTitle action={{ label: 'Tout voir', onClick: () => navigate(`/m/clients/${client.id}/parcels`) }}>
              Ses colis reçus
            </SectionTitle>
            <Card className="py-0">
              <ListRow
                title={<span className="tabular-nums">{receivedParcels.length} colis · {formatKg(receivedParcels.reduce((a, p) => a + Number(p.weight_kg ?? 0), 0))} · {formatCbm(receivedParcels.reduce((a, p) => a + Number(p.cbm ?? 0), 0))}</span>}
                subtitle={waitingParcels.length > 0 ? `${waitingParcels.length} à l'entrepôt, pas encore chargés` : 'Tout est chargé dans une boîte'}
                onClick={() => navigate(`/m/clients/${client.id}/parcels`)}
              />
            </Card>
          </section>
        )}

        {/* ── Ses conteneurs (Cargo) ────────────────────────── */}
        {containers.length > 0 && (
          <section>
            <SectionTitle action={{ label: 'Cargo', onClick: () => navigate('/m/cargo') }}>
              {containers.length > 1 ? `Ses ${containers.length} conteneurs` : 'Son conteneur'}
            </SectionTitle>
            <Card className="py-0">
              {containers.map((c) => {
                const level = alertLevel(c, docsBy?.[c.id]);
                return (
                  <ListRow
                    key={c.id}
                    title={<span className="whitespace-nowrap tabular-nums">{c.container_number || c.bl_number || 'Conteneur'}</span>}
                    subtitle={<><span className="block">{arrivalSentence(c)}</span><StatusPill className="mt-1.5" tone={TONE_OF[level]} label={ALERT[level].label} /></>}
                    onClick={() => navigate(`/m/cargo/${c.id}`)}
                  />
                );
              })}
            </Card>
          </section>
        )}

        {/* ── Les gestes ────────────────────────────────────── */}
        <section>
          <SectionTitle>Les gestes</SectionTitle>
          <Card className="py-0">
            <ActionRow
              icon={ArrowDownCircle}
              tone="success"
              label="Déclarer un dépôt"
              description="Le client a versé de l'argent."
              onClick={() => navigate(`/m/deposits/new?clientId=${client.id}`)}
            />
            {canViewCargo && (
              <ActionRow
                icon={Ship}
                tone="info"
                label="Suivre un conteneur"
                description="Un numéro de conteneur ou de bill of lading."
                onClick={() => navigate('/m/cargo/track')}
              />
            )}
            <ActionRow
              icon={Users}
              tone="info"
              label="Ses bénéficiaires"
              description="Les fournisseurs qu'il paie."
              onClick={() => navigate(`/m/clients/${client.id}/beneficiaries`)}
            />
            <ActionRow
              icon={FileDown}
              label={isStatementGenerating ? 'Relevé en préparation…' : 'Télécharger le relevé'}
              description={ledgerCount > 0
                ? `Choisir une période et télécharger le PDF. ${ledgerCount} ${ledgerCount > 1 ? 'opérations' : 'opération'} au total.`
                : 'Choisir une période et télécharger le PDF.'}
              onClick={() => setStatementOpen(true)}
              disabled={isStatementGenerating}
              loading={isStatementGenerating}
            />
            {canManageUsers && (
              <ActionRow
                icon={Pencil}
                label="Modifier ses informations"
                description="Nom, téléphone, email, entreprise."
                onClick={openEdit}
              />
            )}
            {canManageUsers && (
              <ActionRow
                icon={Key}
                tone="pending"
                label="Nouveau mot de passe"
                description="À transmettre au client."
                onClick={() => setResetDrawerOpen(true)}
              />
            )}
            {canManageUsers && (
              <ActionRow
                icon={Trash2}
                destructive
                label="Supprimer ce client"
                description="Définitif : tout son historique disparaît."
                onClick={handleDeleteCheck}
                disabled={deleteChecking}
                loading={deleteChecking}
              />
            )}
          </Card>
        </section>
      </div>

      {/* Étiquette colis — feuille mobile dédiée (mode rapide, sans bloc fournisseur) */}
      <MobileShippingLabelSheet
        open={labelOpen}
        onClose={() => setLabelOpen(false)}
        code={client.customerCode}
        clientName={fullName}
        clientPhone={client.phone}
        clientEmail={client.email}
        companyName={client.companyName}
        clientCity={client.city}
        clientCountry={client.country}
        settings={shipping ?? DEFAULT_SHIPPING_SETTINGS}
      />

      {canGrantOverdraft && (
        <OverdraftDialog
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

      {/* Adjustment Drawer */}
      <AdjustmentDrawer
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        type={adjustmentType}
        userId={client.id}
        overdraftLimit={client.walletOverdraftLimit ?? 0}
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
            <Pencil className="h-5 w-5 text-[#1E1E1E] dark:text-[#F5F5F5]" />
            {t('editProfile', { defaultValue: 'Modifier le profil' })}
          </span>
        }
      >
        <div className="space-y-3">
          {([
            { label: t('firstName', { defaultValue: 'Prénom' }), key: 'firstName' as const },
            { label: t('lastName', { defaultValue: 'Nom' }), key: 'lastName' as const },
            { label: '', key: 'phones' as const },
            { label: t('emailLabel', { defaultValue: 'Email' }), key: 'email' as const },
            { label: t('company', { defaultValue: 'Entreprise' }), key: 'companyName' as const },
            { label: t('country', { defaultValue: 'Pays' }), key: 'country' as const },
            { label: t('city', { defaultValue: 'Ville' }), key: 'city' as const },
          ]).map(({ label, key }) => key === 'phones' ? (
            /* Plusieurs numéros, comme à la création : le premier est le principal. */
            <ClientPhonesEditor key={key} editor={phonesEditor} />
          ) : (
            <FormField key={key} label={label} htmlFor={`edit-${key}`}>
              {key === 'country' ? (
                <CountryCombobox
                  id="edit-country"
                  variant="country"
                  value={isoFromCountryLabel(editForm.country) ?? null}
                  onChange={(iso) => setEditForm(f => ({ ...f, country: countryLabelFr(iso) }))}
                />
              ) : (
                <TextInput
                  id={`edit-${key}`}
                  value={editForm[key]}
                  onChange={(e) => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={label}
                />
              )}
            </FormField>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryPill onClick={handleSaveEdit} loading={updateClientMutation.isPending || setPhones.isPending} className="w-full">
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
          <span className="flex items-center gap-2 text-[#900B09] dark:text-[#FDD3D0]">
            <Trash2 className="h-5 w-5" />
            {t('deleteClient', { defaultValue: 'Supprimer le client' })}
          </span>
        }
      >
        <p className={cn('text-[16px]', TEXT.muted)}>
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
            <Key className="h-5 w-5 text-[#1E1E1E] dark:text-[#F5F5F5]" />
            {t('resetPasswordAction', { defaultValue: 'Réinitialiser le mot de passe' })}
          </span>
        }
      >
        <p className={cn('text-[16px]', TEXT.muted)}>
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
            <Check className="h-5 w-5 text-[#02542D] dark:text-[#CFF7D3]" />
            {t('passwordGenerated', { defaultValue: 'Mot de passe généré' })}
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[16px]', TEXT.muted)}>
            {t('tempPasswordClientMessage', { defaultValue: 'Voici le nouveau mot de passe temporaire. Transmettez-le de manière sécurisée au client.' })}
          </p>
          <div className={cn('flex items-center justify-between gap-3 rounded-lg p-4', SURFACE.canvas)}>
            <code className={cn('font-mono text-[20px]', TEXT.strong)}>{newPassword}</code>
            <Holder icon={passwordCopied ? Check : Copy} tone={passwordCopied ? 'success' : 'neutral'} size="sm" onClick={handleCopyPassword} />
          </div>
          <p className="rounded-lg bg-[#FFF1C2] p-3 text-[16px] text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
            {t('passwordWontBeShownAgain', { defaultValue: 'Ce mot de passe ne sera plus affiché après fermeture de cette fenêtre.' })}
          </p>
        </div>
        <div className="mt-5">
          <PrimaryPill onClick={() => setPasswordResultDrawerOpen(false)} className="w-full">
            {t('close', { defaultValue: 'Fermer' })}
          </PrimaryPill>
        </div>
      </BottomSheet>

      {/* Relevé de compte — choix de la période */}
      <StatementPeriodSheet
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        onGenerate={handleDownloadStatement}
        isGenerating={isStatementGenerating}
      />
    </div>
  );
}
