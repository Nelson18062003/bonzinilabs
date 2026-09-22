// ============================================================
// Mobile admin — Cargo › Comptes. Un compte, c'est un gros client (PRC,
// Simon D1, Fabrice B1…) qui regroupe ses propres clients dans notre
// entrepôt de Guangzhou et charge ses conteneurs. À Guangzhou, un fichier
// par compte ; ici, la même chose : la liste des comptes, puis pour chacun
// ses clients rattachés et ce qui attend. Deux écrans : la liste, le compte.
// ============================================================
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAssignCargoAccount, useCargoAccountClients, useCargoAccounts, useUpsertCargoAccount, type CargoAccount } from '@/hooks/useCargoAccounts';
import { useReceptionSearch } from '@/hooks/useReception';
import { clientFullName, initials, type ReceptionClient } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, FormField, Holder, ListRow, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatCard, StatusPill, TextArea, TextInput } from '@/mobile/designKit';

/** Le sigle du compte sur sa pastille : « D1 », sinon les initiales du nom. */
function accountMark(a: Pick<CargoAccount, 'name' | 'code'>) {
  return a.code?.trim() ? a.code.trim().slice(0, 3).toUpperCase() : initials(a.name);
}

function nClients(n: number) { return `${n} client${n > 1 ? 's' : ''}`; }
function nParcels(n: number) { return `${n} colis`; }

/* ── La fiche compte, à créer ou à corriger ─────────────────────────────── */
function AccountForm({ open, onClose, account }: { open: boolean; onClose: (createdId?: string) => void; account: CargoAccount | null }) {
  const upsert = useUpsertCargoAccount();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? ''); setCode(account?.code ?? ''); setContactName(account?.contact_name ?? '');
    setContactPhone(account?.contact_phone ?? ''); setNotes(account?.notes ?? ''); setActive(account?.is_active ?? true);
  }, [open, account]);

  const save = async () => {
    if (!name.trim()) return;
    const res = await upsert.mutateAsync({ id: account?.id ?? null, name, code, contactName, contactPhone, notes, isActive: active });
    toast.success(account ? 'Compte corrigé' : 'Compte créé', { description: name.trim() });
    onClose(account ? undefined : res.id);
  };

  return (
    <BottomSheet open={open} onClose={() => onClose()} title={account ? 'Corriger le compte' : 'Nouveau compte'}>
      <div className="space-y-4">
        <FormField label="Nom du compte" htmlFor="acc-name" hint="Tel qu'il est dit à Guangzhou : « PRC », « Simon D1 »">
          <TextInput id="acc-name" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" autoFocus className="h-12" />
        </FormField>
        <FormField label="Sigle (facultatif)" htmlFor="acc-code" hint="Court, sur l'étiquette et les listes : « D1 »">
          <TextInput id="acc-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" maxLength={6} className="h-12 w-32 tabular-nums" />
        </FormField>
        <FormField label="Contact" htmlFor="acc-contact">
          <TextInput id="acc-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} autoCapitalize="words" className="h-12" />
        </FormField>
        <FormField label="Téléphone du contact" htmlFor="acc-phone">
          <TextInput id="acc-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" className="h-12" />
        </FormField>
        <FormField label="Notes" htmlFor="acc-notes" hint="Sa place habituelle dans l'entrepôt, ses habitudes de chargement…">
          <TextArea id="acc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </FormField>
        {account && (
          <button type="button" onClick={() => setActive((a) => !a)} className={cn('flex h-12 w-full items-center justify-between rounded-lg px-4', SURFACE.inset)}>
            <span className={cn(TYPE.body, TEXT.strong)}>{active ? 'Compte actif' : 'Compte fermé'}</span>
            <span className={cn(TYPE.smallStrong, TEXT.muted)}>{active ? 'Fermer' : 'Rouvrir'}</span>
          </button>
        )}
        <PrimaryPill onClick={() => void save()} disabled={!name.trim()} loading={upsert.isPending} className="h-14 w-full text-[17px]">{account ? 'Enregistrer' : 'Créer le compte'}</PrimaryPill>
      </div>
    </BottomSheet>
  );
}

/* ── La liste ───────────────────────────────────────────────────────────── */
export function MobileCargoAccounts() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [showClosed, setShowClosed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, error, refetch } = useCargoAccounts(showClosed);
  const canEdit = hasPermission('canEditClients');

  if (!hasPermission('canViewCargo') && !hasPermission('canViewClients')) return <Navigate to="/m/cargo" replace />;
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message} onRetry={() => void refetch()} />;

  const clients = data.reduce((s, a) => s + a.client_count, 0);
  const waiting = data.reduce((s, a) => s + a.parcels_waiting, 0);

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Comptes cargo" subtitle={`${data.length} compte${data.length > 1 ? 's' : ''} · ${nClients(clients)}`} showBack backTo="/m/cargo/reception" />
      <div className="flex-1 space-y-5 px-4 pb-10 pt-4">
        <p className={cn(TYPE.body, TEXT.muted)}>Un compte, c'est un gros client qui regroupe ses propres clients dans notre entrepôt et charge ses conteneurs. Chaque colis de ses clients sort sur sa liste.</p>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Colis qui attendent" value={waiting} hint="pour tous les comptes" />
          <StatCard label="Clients rattachés" value={clients} />
        </div>

        {data.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Aucun compte pour l'instant.</p></Card>
        ) : (
          <Card className="py-0">
            {data.map((a) => (
              <ListRow
                key={a.id}
                onClick={() => navigate(`/m/cargo/comptes/${a.id}`)}
                leading={<Holder size="lg" tone={a.is_active ? 'neutral' : 'pending'}>{accountMark(a)}</Holder>}
                title={<span className="flex items-center gap-2">{a.name}{!a.is_active && <StatusPill tone="pending" label="Fermé" className="h-6 text-[13px]" />}</span>}
                subtitle={<span className="tabular-nums">{nClients(a.client_count)} · {nParcels(a.parcels_waiting)} en attente{a.contact_name ? ` · ${a.contact_name}` : ''}</span>}
              />
            ))}
          </Card>
        )}

        <button type="button" onClick={() => setShowClosed((s) => !s)} className={cn('h-10 w-full text-center', TYPE.smallStrong, TEXT.muted)}>{showClosed ? 'Masquer les comptes fermés' : 'Voir aussi les comptes fermés'}</button>

        {canEdit && <PrimaryPill onClick={() => setFormOpen(true)} className="h-14 w-full text-[17px]"><Plus /> Nouveau compte</PrimaryPill>}
      </div>
      <AccountForm open={formOpen} account={null} onClose={(id) => { setFormOpen(false); if (id) navigate(`/m/cargo/comptes/${id}`); }} />
    </div>
  );
}

/* ── Le compte : ses clients, ce qui attend, rattacher ──────────────────── */
export function MobileCargoAccount() {
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();
  const { hasPermission } = useAdminAuth();
  const accounts = useCargoAccounts(true);
  const clients = useCargoAccountClients(accountId);
  const assign = useAssignCargoAccount();
  const [formOpen, setFormOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(id); }, [query]);
  const search = useReceptionSearch(attachOpen ? debounced : '');
  const canEdit = hasPermission('canEditClients');

  if (!hasPermission('canViewCargo') && !hasPermission('canViewClients')) return <Navigate to="/m/cargo" replace />;
  if (accounts.isLoading || clients.isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  const account = accounts.data?.find((a) => a.id === accountId) ?? null;
  if (!account) return <ScreenError description="Compte introuvable" onRetry={() => void accounts.refetch()} />;

  const rows = clients.data ?? [];
  const attach = async (c: ReceptionClient) => {
    if (c.account_id === account.id) { toast.message(`${clientFullName(c)} est déjà sur ce compte`); return; }
    await assign.mutateAsync({ clientUserId: c.user_id, accountId: account.id });
    toast.success(`${clientFullName(c)} rattaché à ${account.name}`, { description: c.account_name ? `Il était sur ${c.account_name}` : undefined });
    setQuery(''); setAttachOpen(false);
  };
  const detach = async (c: ReceptionClient) => {
    await assign.mutateAsync({ clientUserId: c.user_id, accountId: null });
    toast.success(`${clientFullName(c)} détaché de ${account.name}`);
  };
  const results = (search.data ?? []).filter((c) => c.account_id !== account.id);

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={account.name} subtitle={[account.code, account.contact_name, account.contact_phone].filter(Boolean).join(' · ') || 'Compte cargo'} showBack backTo="/m/cargo/comptes" />
      <div className="flex-1 space-y-5 px-4 pb-10 pt-4">
        <div className="flex items-center gap-4">
          <Holder size="lg" tone={account.is_active ? 'neutral' : 'pending'} className="h-16 w-16 text-[22px]">{accountMark(account)}</Holder>
          <div className="min-w-0 flex-1">
            <p className={cn(TYPE.lead, TEXT.strong)}>{account.name}</p>
            <p className={cn(TYPE.small, TEXT.muted)}>{account.is_active ? 'Compte actif' : 'Compte fermé'}{account.notes ? ` · ${account.notes}` : ''}</p>
          </div>
          {canEdit && <SoftPill onClick={() => setFormOpen(true)} className="h-11 px-4"><Pencil /> Corriger</SoftPill>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Clients rattachés" value={rows.length} icon={Users} />
          <StatCard label="Colis qui attendent" value={account.parcels_waiting} hint="à Guangzhou, pas encore chargés" tone={account.parcels_waiting > 0 ? 'pending' : 'neutral'} />
        </div>

        <section>
          <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Ses clients</h2>
          {rows.length === 0 ? (
            <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Aucun client rattaché. Les colis de ses clients sortiront sur sa liste dès qu'ils le seront.</p></Card>
          ) : (
            <Card className="py-0">
              {rows.map(({ client: c, parcels_waiting }) => (
                <ListRow
                  key={c.user_id}
                  onClick={() => navigate(`/m/clients/${c.user_id}/parcels`)}
                  leading={<Holder size="md">{initials(clientFullName(c))}</Holder>}
                  title={clientFullName(c)}
                  subtitle={<span className="tabular-nums">{[c.customer_code, c.phone].filter(Boolean).join(' · ')}{parcels_waiting > 0 ? ` · ${nParcels(parcels_waiting)} en attente` : ''}</span>}
                  trailing={canEdit ? <button type="button" onClick={(e) => { e.stopPropagation(); void detach(c); }} className={cn('shrink-0 px-2 py-2', TYPE.smallStrong, TEXT.muted)}>Détacher</button> : undefined}
                  chevron={!canEdit}
                />
              ))}
            </Card>
          )}
        </section>

        {canEdit && <PrimaryPill onClick={() => setAttachOpen(true)} className="h-14 w-full text-[17px]"><UserPlus /> Rattacher un client</PrimaryPill>}
      </div>

      <AccountForm open={formOpen} account={account} onClose={() => setFormOpen(false)} />

      <BottomSheet open={attachOpen} onClose={() => { setAttachOpen(false); setQuery(''); }} title={`Rattacher à ${account.name}`}>
        <div className="space-y-4">
          <div className="relative">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, téléphone ou code client" className="h-14 pl-12 text-[17px]" autoComplete="off" inputMode="search" autoFocus aria-label="Chercher un client" />
          </div>
          {debounced.trim().length >= 2 && (
            <Card className="max-h-[50vh] overflow-y-auto py-0">
              {search.isLoading ? (
                <p className={cn('py-5 text-center', TYPE.body, TEXT.muted)}>…</p>
              ) : results.length === 0 ? (
                <p className={cn('py-5 text-center', TYPE.body, TEXT.muted)}>Aucun client à rattacher</p>
              ) : results.map((c) => (
                <ListRow
                  key={c.user_id}
                  onClick={() => void attach(c)}
                  leading={<Holder size="md">{initials(clientFullName(c))}</Holder>}
                  title={clientFullName(c)}
                  subtitle={<span className="tabular-nums">{[c.customer_code, c.phone].filter(Boolean).join(' · ')}{c.account_name ? ` · déjà sur ${c.account_name}` : ''}</span>}
                />
              ))}
            </Card>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
