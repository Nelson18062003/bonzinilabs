// ============================================================
// Mobile admin — Cargo › Comptes. Un compte, c'est un gros client (PRC,
// Simon D1, Fabrice B1…) qui regroupe ses propres clients dans notre
// entrepôt de Guangzhou et charge ses conteneurs. Refonte v2 (maquettes
// 10/40 et 10/41) : la liste (leurs colis à Guangzhou en grand, un compte
// par ligne, « + » en haut, les comptes fermés en lien), puis le compte
// (son sigle, ses colis qui attendent, ses clients ; « Rattacher un
// client » en bas ; Corriger et Fermer dans « … »).
// ============================================================
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Package, Pencil, Plus, Power, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAssignCargoAccount, useCargoAccountClients, useCargoAccounts, useUpsertCargoAccount, type CargoAccount } from '@/hooks/useCargoAccounts';
import { useReceptionSearch } from '@/hooks/useReception';
import { clientFullName, initials, type ReceptionClient } from '@/lib/reception';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, Dock, EmptyLine, Initials, ItemList, ItemRow, MoreButton, RoundButton, ScreenLoader, ScreenTop, SearchBox, SURFACE, TEXT, TextArea, TextInput,
} from '@/mobile/designKit';
import { CapsLabel, RowButton } from '@/mobile/components/cargo/v2';

/** Le sigle du compte sur sa pastille : « D1 », sinon les initiales du nom. */
function accountMark(a: Pick<CargoAccount, 'name' | 'code'>) {
  return a.code?.trim() ? a.code.trim().slice(0, 3).toUpperCase() : initials(a.name);
}
const nClients = (n: number) => `${n} client${n > 1 ? 's' : ''}`;

/** La pastille ronde du compte. */
function Mark({ text, size = 44, closed }: { text: string; size?: number; closed?: boolean }) {
  return (
    <span style={{ width: size, height: size, fontSize: Math.max(16, Math.round(size * 0.36)) }}
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', closed ? 'bg-[#FFF1C2] text-[#682D03]' : cn(SURFACE.holder, TEXT.strong))}>
      {text}
    </span>
  );
}

/** « 46 colis » à droite d'une ligne. */
function Count({ n }: { n: number }) {
  return (
    <span className="shrink-0 text-right">
      <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{n}</span>
      <span className={cn('block text-[15px]', TEXT.muted)}>colis</span>
    </span>
  );
}

/* ── La fiche compte, à créer ou à corriger ─────────────────────────────── */
function AccountForm({ open, onClose, account }: { open: boolean; onClose: (createdId?: string) => void; account: CargoAccount | null }) {
  const upsert = useUpsertCargoAccount();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? ''); setCode(account?.code ?? ''); setContactName(account?.contact_name ?? '');
    setContactPhone(account?.contact_phone ?? ''); setNotes(account?.notes ?? '');
  }, [open, account]);

  const save = async () => {
    if (!name.trim()) return;
    const res = await upsert.mutateAsync({ id: account?.id ?? null, name, code, contactName, contactPhone, notes, isActive: account?.is_active ?? true });
    toast.success(account ? 'Compte corrigé' : 'Compte créé', { description: name.trim() });
    onClose(account ? undefined : res.id);
  };

  return (
    <BottomSheet open={open} onClose={() => onClose()} title={account ? 'Corriger le compte' : 'Nouveau compte'}>
      <div className="space-y-4">
        <div><CapsLabel as="label">Nom du compte</CapsLabel><TextInput className="mt-2 h-14" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" placeholder="Simon D1" aria-label="Nom du compte" /></div>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <div><CapsLabel as="label">Sigle</CapsLabel><TextInput className="mt-2 h-14 tabular-nums" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" maxLength={6} placeholder="D1" aria-label="Sigle" /></div>
          <div><CapsLabel as="label">Contact</CapsLabel><TextInput className="mt-2 h-14" value={contactName} onChange={(e) => setContactName(e.target.value)} autoCapitalize="words" aria-label="Contact" /></div>
        </div>
        <div><CapsLabel as="label">Téléphone</CapsLabel><TextInput className="mt-2 h-14" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" placeholder="+237 6…" aria-label="Téléphone du contact" /></div>
        <div><CapsLabel as="label">Notes</CapsLabel><TextArea className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sa place dans l'entrepôt…" aria-label="Notes" /></div>
        <BigButton onClick={() => void save()} disabled={!name.trim()} loading={upsert.isPending}>{account ? 'Enregistrer' : 'Créer le compte'}</BigButton>
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

  const list = data ?? [];
  const open = list.filter((a) => a.is_active);
  const clients = open.reduce((s, a) => s + a.client_count, 0);
  const waiting = open.reduce((s, a) => s + a.parcels_waiting, 0);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <ScreenTop title="Comptes cargo" backTo="/m/cargo/reception" right={canEdit ? <RoundButton icon={Plus} ariaLabel="Nouveau compte" onClick={() => setFormOpen(true)} /> : undefined} />
      {isLoading ? <ScreenLoader /> : error || !data ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Erreur'}</EmptyLine>
      ) : (
        <>
          <div className="px-5 pt-5">
            <div className="rounded-lg border border-[#D9D9D9] px-5 py-4 dark:border-[#444444]">
              <p className={cn('text-[16px]', TEXT.muted)}>Leurs colis à Guangzhou</p>
              <p className="mt-1">
                <span className={cn('text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>{waiting}</span>
                <span className={cn('ml-2 text-[22px] font-semibold', TEXT.muted)}>colis</span>
              </p>
              <p className={cn('mt-2 text-[16px] tabular-nums', TEXT.muted)}>
                <b className={TEXT.strong}>{open.length}</b> compte{open.length > 1 ? 's' : ''}<span className="ml-4"><b className={TEXT.strong}>{clients}</b> clients rattachés</span>
              </p>
            </div>
          </div>
          {list.length === 0 ? <EmptyLine>Aucun compte.</EmptyLine> : (
            <ItemList className="pt-2">
              {list.map((a) => (
                <ItemRow
                  key={a.id}
                  onClick={() => navigate(`/m/cargo/comptes/${a.id}`)}
                  leading={<Mark text={accountMark(a)} closed={!a.is_active} />}
                  title={a.name}
                  subtitle={[a.code, nClients(a.client_count), a.is_active ? null : 'fermé'].filter(Boolean).join(' · ')}
                  right={<Count n={a.parcels_waiting} />}
                />
              ))}
            </ItemList>
          )}
          <div className="px-5 pt-4">
            <RowButton link onClick={() => setShowClosed((s) => !s)}>{showClosed ? 'Masquer les comptes fermés' : 'Voir aussi les comptes fermés'}</RowButton>
          </div>
        </>
      )}
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
  const upsert = useUpsertCargoAccount();
  const [formOpen, setFormOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [closing, setClosing] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<ReceptionClient | null>(null);
  const [detaching, setDetaching] = useState<ReceptionClient | null>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(id); }, [query]);
  const search = useReceptionSearch(attachOpen ? debounced : '');
  const canEdit = hasPermission('canEditClients');

  if (!hasPermission('canViewCargo') && !hasPermission('canViewClients')) return <Navigate to="/m/cargo" replace />;
  if (accounts.isLoading || clients.isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  const account = accounts.data?.find((a) => a.id === accountId) ?? null;
  if (!account) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title="Compte cargo" backTo="/m/cargo/comptes" />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void accounts.refetch() }}>Compte introuvable.</EmptyLine>
      </div>
    );
  }

  const rows = clients.data ?? [];
  const attach = async (c: ReceptionClient) => {
    if (c.account_id === account.id) { toast.message(`${clientFullName(c)} est déjà sur ce compte`); return; }
    await assign.mutateAsync({ clientUserId: c.user_id, accountId: account.id });
    toast.success(`${clientFullName(c)} rattaché à ${account.name}`, { description: c.account_name ? `Il était sur ${c.account_name}` : undefined });
    setQuery(''); setAttachOpen(false);
  };
  const detach = async () => {
    if (!detaching) return;
    await assign.mutateAsync({ clientUserId: detaching.user_id, accountId: null });
    toast.success(`${clientFullName(detaching)} détaché de ${account.name}`);
    setDetaching(null);
  };
  const toggleActive = async () => {
    await upsert.mutateAsync({ id: account.id, name: account.name, code: account.code ?? '', contactName: account.contact_name ?? '', contactPhone: account.contact_phone ?? '', notes: account.notes ?? '', isActive: !account.is_active });
    toast.success(account.is_active ? 'Compte fermé' : 'Compte rouvert', { description: account.name });
    setClosing(false);
  };
  const results = (search.data ?? []).filter((c) => c.account_id !== account.id);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <ScreenTop title="Compte cargo" backTo="/m/cargo/comptes" right={canEdit ? <MoreButton onClick={() => setMore(true)} /> : undefined} />
      <div className="px-5 pt-6 text-center">
        <span className="mx-auto flex w-fit"><Mark text={accountMark(account)} size={72} closed={!account.is_active} /></span>
        <p className={cn('mt-4 text-[22px] font-semibold', TEXT.strong)}>{account.name}</p>
        <p className={cn('mt-1 text-[16px] tabular-nums', TEXT.muted)}>{[account.code, account.contact_name !== account.name ? account.contact_name : null, account.contact_phone, account.is_active ? null : 'fermé'].filter(Boolean).join(' · ') || 'Compte cargo'}</p>
        <p className="mt-5">
          <span className={cn('text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>{account.parcels_waiting}</span>
          <span className={cn('ml-2 text-[22px] font-semibold', TEXT.muted)}>colis</span>
        </p>
        <p className={cn('mt-2 text-[16px]', TEXT.muted)}>À Guangzhou, pas encore chargés</p>
        {account.notes && <p className={cn('mt-2 text-[15px]', TEXT.muted)}>{account.notes}</p>}
      </div>

      <h2 className={cn('px-5 pt-7 text-[22px] font-semibold', TEXT.strong)}>Ses clients · {rows.length}</h2>
      {rows.length === 0 ? <EmptyLine>Aucun client rattaché.</EmptyLine> : (
        <ItemList>
          {rows.map(({ client: c, parcels_waiting }) => (
            <ItemRow
              key={c.user_id}
              onClick={() => (canEdit ? setRowMenu(c) : navigate(`/m/clients/${c.user_id}/parcels`))}
              leading={<Initials name={clientFullName(c)} />}
              title={clientFullName(c)}
              subtitle={[c.customer_code, c.phone].filter(Boolean).join(' · ')}
              right={<Count n={parcels_waiting} />}
            />
          ))}
        </ItemList>
      )}

      {canEdit && <Dock><BigButton onClick={() => setAttachOpen(true)}>Rattacher un client</BigButton></Dock>}

      <ActionSheet
        open={more}
        onClose={() => setMore(false)}
        actions={[
          { label: 'Corriger le compte', icon: Pencil, onClick: () => { setMore(false); setFormOpen(true); } },
          { label: account.is_active ? 'Fermer le compte' : 'Rouvrir le compte', icon: Power, danger: account.is_active, onClick: () => { setMore(false); setClosing(true); } },
        ]}
      />
      <ActionSheet
        open={!!rowMenu}
        onClose={() => setRowMenu(null)}
        title={rowMenu ? clientFullName(rowMenu) : undefined}
        actions={[
          { label: 'Ses colis', icon: Package, onClick: () => navigate(`/m/clients/${rowMenu!.user_id}/parcels`) },
          { label: `Détacher de ${account.name}`, icon: Unlink, danger: true, onClick: () => { setDetaching(rowMenu); setRowMenu(null); } },
        ]}
      />
      <ConfirmSheet
        open={!!detaching}
        onClose={() => setDetaching(null)}
        title={detaching ? `Détacher ${clientFullName(detaching)} ?` : ''}
        rows={[{ label: 'Compte', before: account.name, value: 'aucun' }]}
        confirmLabel="Détacher"
        danger
        onConfirm={() => void detach()}
        loading={assign.isPending}
      />
      <ConfirmSheet
        open={closing}
        onClose={() => setClosing(false)}
        title={account.is_active ? `Fermer ${account.name} ?` : `Rouvrir ${account.name} ?`}
        rows={[{ label: 'État', before: account.is_active ? 'actif' : 'fermé', value: account.is_active ? 'fermé' : 'actif' }]}
        confirmLabel={account.is_active ? 'Fermer' : 'Rouvrir'}
        danger={account.is_active}
        onConfirm={() => void toggleActive()}
        loading={upsert.isPending}
      />

      <AccountForm open={formOpen} account={account} onClose={() => setFormOpen(false)} />

      <BottomSheet open={attachOpen} onClose={() => { setAttachOpen(false); setQuery(''); }} title={`Rattacher à ${account.name}`}>
        <div className="space-y-2">
          <SearchBox value={query} onChange={setQuery} placeholder="Nom, téléphone ou BZ-" autoFocus />
          {debounced.trim().length >= 2 && (
            search.isLoading ? <ScreenLoader className="min-h-[100px]" />
            : results.length === 0 ? <EmptyLine>Aucun client à rattacher.</EmptyLine>
            : (
              <div className="max-h-[50vh] overflow-y-auto">
                {results.map((c) => (
                  <ItemRow
                    key={c.user_id}
                    onClick={() => void attach(c)}
                    leading={<Initials name={clientFullName(c)} />}
                    title={clientFullName(c)}
                    subtitle={[c.customer_code, c.phone, c.account_name ? `sur ${c.account_name}` : null].filter(Boolean).join(' · ')}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
