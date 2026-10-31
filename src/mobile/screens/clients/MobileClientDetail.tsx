/**
 * Fiche client — refonte v2 (maquettes 03/02 et 03/03).
 *
 * Façon Wave : le gros solde (disponible · découvert autorisé dessous),
 * quatre ronds — Dépôt (noir), Paiement, Message, Colis —, puis les derniers
 * mouvements et « Tout voir » vers le relevé. Tout le reste est dans « … » :
 * Crédit / Débit (rôles `canAdjustWallets` seulement), Découvert
 * (`canGrantOverdraft`), Relevé PDF, Bénéficiaires, Étiquette colis,
 * Téléphones, Identité, Mot de passe, Repasser en prospect, Supprimer (rouge,
 * à part). Mêmes hooks et RPC que l'ancienne fiche ; le desktop a la sienne.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDownToLine, ArrowUpRight, CircleMinus, Diff, FileText, IdCard, KeyRound, MessageSquare, Package, Phone, Tag as TagIcon, Trash2, Undo2, Users,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClient, useClientLedger } from '@/hooks/useClientManagement';
import { useClientPhones } from '@/hooks/useClientPhones';
import { useAdminClientBeneficiaries } from '@/hooks/useBeneficiaries';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { availableXaf } from '@/lib/overdraft';
import { normalizePhone } from '@/lib/phone';
import { whatsappLink } from '@/lib/sales';
import { cn } from '@/lib/utils';
import { StatementPeriodSheet } from '@/components/statement/StatementPeriodSheet';
import {
  ActionCircles, ActionSheet, BigFigure, EmptyLine, Initials, ItemList, MoreButton, ScreenTop, SectionHead, Tag, TEXT, useSheet,
  type CircleAction, type SheetAction,
} from '@/mobile/designKit';
import { ClientPasswordSheets, DeleteClientSheet, OverdraftSheet, ToProspectSheet } from './clientSheets';
import { LedgerItem } from './ledgerRows';
import { ADJUST_ROLES } from './MobileClientAdjust';
import { clientTag } from './MobileClientsScreen';
import { useClientStatement } from './useClientStatement';
import { xaf } from './parts';

type Sheet = null | 'overdraft' | 'delete' | 'prospect' | 'password';

export function MobileClientDetail() {
  const { clientId = '' } = useParams();
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const { data: client, isLoading, refetch } = useClient(clientId);
  const { data: ledger } = useClientLedger(clientId);
  const { data: phones } = useClientPhones(client?.id);
  const { data: beneficiaries } = useAdminClientBeneficiaries(clientId || undefined);
  const statement = useClientStatement(client);
  const more = useSheet();
  const [sheet, setSheet] = useState<Sheet>(null);

  const canManageUsers = hasPermission('canManageUsers');
  const canAdjust = ADJUST_ROLES.includes(currentUser?.role ?? '');
  const canGrantOverdraft = hasPermission('canGrantOverdraft');
  const canMakeProspect = canManageUsers && hasPermission('canManageSales');

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <ScreenTop title="Client" backTo="/m/clients" />
        <div className="flex flex-col items-center gap-3 px-5 pt-8">
          <span className="h-[92px] w-[92px] animate-pulse rounded-full bg-[#F5F5F5] dark:bg-[#383838]" />
          <span className="h-6 w-44 animate-pulse rounded bg-[#F5F5F5] dark:bg-[#383838]" />
          <span className="mt-4 h-12 w-56 animate-pulse rounded bg-[#F5F5F5] dark:bg-[#383838]" />
        </div>
      </div>
    );
  }
  if (!client) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <ScreenTop title="Client" backTo="/m/clients" />
        <EmptyLine action={{ label: 'Retour aux clients', onClick: () => navigate('/m/clients') }}>Client introuvable.</EmptyLine>
      </div>
    );
  }

  const name = `${client.firstName} ${client.lastName}`.trim() || 'Client';
  const balance = client.walletBalance || 0;
  const limit = client.walletOverdraftLimit ?? 0;
  const tag = clientTag(client.status, balance);
  const phoneCount = Math.max(phones?.length ?? 0, client.phone ? 1 : 0);
  const recent = (ledger ?? []).slice(0, 6);

  // Message : la conversation du client s'il en a une, sinon WhatsApp.
  const openMessage = async () => {
    if (hasPermission('canAccessSupportChat')) {
      const { data } = await supabaseAdmin
        .from('chat_conversations')
        .select('id')
        .eq('client_id', client.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) { navigate(`/m/support/${data.id}`); return; }
    }
    const e164 = normalizePhone(client.phone, 'CM')?.e164;
    if (e164) window.open(whatsappLink(e164), '_blank', 'noopener');
    else toast.error('Pas de numéro valide pour ce client.');
  };

  const circles: CircleAction[] = [];
  if (hasPermission('canProcessDeposits')) circles.push({ label: 'Dépôt', icon: ArrowDownToLine, primary: true, onClick: () => navigate(`/m/deposits/new?clientId=${client.id}`) });
  if (hasPermission('canProcessPayments')) circles.push({ label: 'Paiement', icon: ArrowUpRight, primary: circles.length === 0, onClick: () => navigate(`/m/payments/new?clientId=${client.id}`) });
  circles.push({ label: 'Message', icon: MessageSquare, primary: circles.length === 0, onClick: () => void openMessage() });
  if (hasPermission('canViewCargo') || hasPermission('canViewClients')) circles.push({ label: 'Colis', icon: Package, primary: false, onClick: () => navigate(`/m/clients/${client.id}/parcels`) });

  const actions: SheetAction[] = [
    { label: 'Crédit / Débit', icon: Diff, hidden: !canAdjust, onClick: () => navigate(`/m/clients/${client.id}/ajuster`) },
    { label: 'Découvert', icon: CircleMinus, hint: limit > 0 ? `${xaf(limit)} XAF` : 'Aucun', hidden: !canGrantOverdraft, onClick: () => setSheet('overdraft') },
    { label: 'Relevé PDF', icon: FileText, onClick: statement.show },
    { label: 'Bénéficiaires', icon: Users, hint: beneficiaries ? String(beneficiaries.length) : undefined, onClick: () => navigate(`/m/clients/${client.id}/beneficiaries`) },
    { label: 'Étiquette colis', icon: TagIcon, hidden: !client.customerCode, onClick: () => navigate(`/m/clients/${client.id}/etiquette`) },
    { label: 'Téléphones', icon: Phone, hint: phoneCount ? String(phoneCount) : undefined, onClick: () => navigate(`/m/clients/${client.id}/telephones`) },
    { label: 'Identité', icon: IdCard, onClick: () => navigate(`/m/clients/${client.id}/identite`) },
    { label: 'Mot de passe', icon: KeyRound, hidden: !canManageUsers, onClick: () => setSheet('password') },
    { label: 'Repasser en prospect', icon: Undo2, hidden: !canMakeProspect, onClick: () => setSheet('prospect') },
    { label: 'Supprimer', icon: Trash2, danger: true, hidden: !canManageUsers, onClick: () => setSheet('delete') },
  ];

  return (
    <div className="min-h-[100dvh] bg-white pb-8 dark:bg-[#1E1E1E]">
      <ScreenTop title="Client" backTo="/m/clients" right={<MoreButton onClick={more.show} />} />

      <div className="flex flex-col items-center px-5 pt-7 text-center">
        <Initials name={name} size={92} />
        <h2 className={cn('mt-3.5 text-[22px] font-semibold leading-tight', TEXT.strong)}>{name}</h2>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{[client.customerCode, client.city].filter(Boolean).join(' · ')}</p>
        <BigFigure
          center
          className="mt-5"
          value={<span className={cn(balance < 0 && 'text-[#C00F0C] dark:text-[#FCB3AD]')}>{xaf(balance)}</span>}
          unit="XAF"
          note={
            limit > 0 ? (
              <span>
                Disponible <b className="font-bold tabular-nums">{xaf(availableXaf(balance, limit))}</b> · Découvert <b className="font-bold tabular-nums">{xaf(limit)}</b>
              </span>
            ) : undefined
          }
          delta={tag && limit === 0 ? { tone: tag.tone, label: tag.label } : undefined}
        />
        {tag && limit > 0 && <Tag tone={tag.tone} className="mt-2">{tag.label}</Tag>}
      </div>

      <ActionCircles actions={circles} />

      <SectionHead title="Opérations" link={{ label: 'Tout voir', onClick: () => navigate(`/m/clients/${client.id}/ledger`) }} />
      {recent.length === 0 ? (
        <EmptyLine>Aucune opération pour l'instant.</EmptyLine>
      ) : (
        <ItemList>
          {recent.map((e) => <LedgerItem key={e.id} entry={e} />)}
        </ItemList>
      )}

      <ActionSheet open={more.open} onClose={more.hide} actions={actions} />

      {canGrantOverdraft && (
        <OverdraftSheet
          open={sheet === 'overdraft'}
          onClose={() => setSheet(null)}
          userId={client.id}
          clientName={name}
          balance={balance}
          limit={limit}
          note={client.walletOverdraftNote ?? null}
          onDone={() => void refetch()}
        />
      )}
      {canManageUsers && (
        <>
          <DeleteClientSheet open={sheet === 'delete'} onClose={() => setSheet(null)} userId={client.id} clientName={name} customerCode={client.customerCode} balance={balance} limit={limit} />
          <ClientPasswordSheets open={sheet === 'password'} onClose={() => setSheet(null)} userId={client.id} clientName={name} phone={client.phone} />
        </>
      )}
      {canMakeProspect && sheet === 'prospect' && (
        <ToProspectSheet open onClose={() => setSheet(null)} userId={client.id} clientName={name} />
      )}
      <StatementPeriodSheet open={statement.open} onClose={statement.hide} onGenerate={statement.generate} isGenerating={statement.generating} />
    </div>
  );
}
