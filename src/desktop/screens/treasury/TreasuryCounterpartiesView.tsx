/**
 * Trésorerie — vue « Contreparties » (docs/admin-redesign/07 §3.5).
 *
 * Deux populations distinctes derrière un même objet : les fournisseurs USDT
 * (Cameroun, +237) et les acheteurs CNY (Chine, +86, WeChat). L'onglet choisit
 * la population ET l'indicatif par défaut du formulaire.
 *
 * La suppression est refusée côté serveur quand des opérations existent —
 * l'archivage est la vraie sortie. Le dialogue le dit AVANT de tenter, au lieu
 * de laisser remonter une erreur brute.
 */
import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  CardHeader,
  Chip,
  SearchField,
  Th,
  Td,
  Holder,
  ScreenLoader,
  StatusPill,
  CenterDialog,
  PrimaryPill,
  SoftPill,
  PRIMARY_PILL,
  FormField,
  TextInput,
} from '@/desktop/designKit';
import { PhoneInputWithCountry } from '@/components/form';
import {
  useCounterparties,
  useCreateCounterparty,
  useDeleteCounterparty,
  useUpdateCounterparty,
  type TreasuryCounterparty,
} from '@/hooks/useTreasury';
import { normalizeText } from '@/lib/clientSearch';
import type { Database } from '@/integrations/supabase/types';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];

// Libellés courts : l'en-tête de carte porte déjà le nom complet de la
// population affichée, le répéter dans la puce active faisait doublon.
const TABS: ReadonlyArray<{ value: CounterpartyType; label: string }> = [
  { value: 'usdt_supplier', label: 'Fournisseurs' },
  { value: 'cny_buyer', label: 'Acheteurs' },
];

interface FormState {
  display_name: string;
  legal_name: string;
  phone: string | null;
  wechat_id: string;
  notes: string;
}

const EMPTY: FormState = { display_name: '', legal_name: '', phone: null, wechat_id: '', notes: '' };

export function TreasuryCounterpartiesView({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<CounterpartyType>('usdt_supplier');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCounterparties(tab, showArchived);

  const create = useCreateCounterparty();
  const update = useUpdateCounterparty();
  const remove = useDeleteCounterparty();

  const [editing, setEditing] = useState<TreasuryCounterparty | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleting, setDeleting] = useState<TreasuryCounterparty | null>(null);

  const isSupplier = tab === 'usdt_supplier';
  const defaultDialCode = isSupplier ? '+237' : '+86';

  const rows = useMemo(() => {
    const tokens = normalizeText(search).split(' ').filter(Boolean);
    if (tokens.length === 0) return data ?? [];
    return (data ?? []).filter((c) => {
      const hay = normalizeText(`${c.display_name} ${c.legal_name ?? ''} ${c.wechat_id ?? ''} ${c.phone ?? ''} ${c.short_id ?? ''}`);
      return tokens.every((t) => hay.includes(t));
    });
  }, [data, search]);

  const openNew = () => {
    setForm(EMPTY);
    setEditing('new');
  };
  const openEdit = (c: TreasuryCounterparty) => {
    setForm({
      display_name: c.display_name,
      legal_name: c.legal_name ?? '',
      phone: c.phone,
      wechat_id: c.wechat_id ?? '',
      notes: c.notes ?? '',
    });
    setEditing(c);
  };

  const nameValid = form.display_name.trim().length > 0;
  const saving = create.isPending || update.isPending;

  const save = () => {
    if (!nameValid || saving) return;
    if (editing === 'new') {
      create.mutate(
        {
          type: tab,
          display_name: form.display_name.trim(),
          legal_name: form.legal_name.trim() || undefined,
          phone: form.phone ?? undefined,
          wechat_id: form.wechat_id.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        { onSuccess: () => setEditing(null) },
      );
    } else if (editing) {
      update.mutate(
        {
          id: editing.id,
          display_name: form.display_name.trim(),
          legal_name: form.legal_name.trim() || null,
          phone: form.phone,
          wechat_id: form.wechat_id.trim() || null,
          notes: form.notes.trim() || null,
        },
        { onSuccess: () => setEditing(null) },
      );
    }
  };

  const toggleArchive = (c: TreasuryCounterparty) =>
    update.mutate({ id: c.id, is_active: !c.is_active });

  const confirmDelete = () => {
    if (!deleting || remove.isPending) return;
    remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-0">
      <CardHeader title={isSupplier ? 'Fournisseurs USDT' : 'Acheteurs CNY'} meta={`${rows.length} contrepartie${rows.length > 1 ? 's' : ''}`} />

      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
        {TABS.map((t) => (
          <Chip key={t.value} label={t.label} active={tab === t.value} onClick={() => setTab(t.value)} />
        ))}
        <Chip label="Avec archivées" active={showArchived} onClick={() => setShowArchived((v) => !v)} />
        <SearchField value={search} onChange={setSearch} placeholder="Rechercher…" className="ml-auto w-[200px]" />
        {canManage && (
          <button type="button" onClick={openNew} className={cn('inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-bold', PRIMARY_PILL)}>
            <Plus className="h-4 w-4" /> Nouvelle
          </button>
        )}
      </div>

      {isLoading ? (
        <ScreenLoader />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Holder icon={Users} size="lg" />
          <p className={cn('mt-3 text-[13px]', TEXT.muted)}>
            {search ? 'Aucune contrepartie pour cette recherche.' : 'Aucune contrepartie enregistrée.'}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className={cn('sticky top-0 z-10', SURFACE.inset)}>
              <tr>
                <Th first>Nom</Th>
                <Th>Réf.</Th>
                <Th>{isSupplier ? 'Téléphone' : 'WeChat / Téléphone'}</Th>
                <Th>Note</Th>
                <Th last className="w-[112px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="group">
                  <Td first>
                    <div className="flex items-center gap-2">
                      <span className={cn('truncate text-[13px] font-semibold', TEXT.strong)}>{c.display_name}</span>
                      {!c.is_active && <StatusPill tone="neutral" label="Archivée" />}
                    </div>
                    {c.legal_name && <div className={cn('truncate text-[11px]', TEXT.muted)}>{c.legal_name}</div>}
                  </Td>
                  <Td className={cn('text-[12px] tabular-nums', TEXT.muted)}>{c.short_id ?? '—'}</Td>
                  <Td className={cn('text-[12.5px]', TEXT.body)}>
                    {c.wechat_id ? c.wechat_id : c.phone ? c.phone : '—'}
                    {c.wechat_id && c.phone && <div className={cn('text-[11px]', TEXT.muted)}>{c.phone}</div>}
                  </Td>
                  <Td className={cn('max-w-[220px] truncate text-[12px]', TEXT.muted)}>{c.notes ?? '—'}</Td>
                  <Td last align="right">
                    {canManage ? (
                      <span className="inline-flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button type="button" onClick={() => openEdit(c)} title="Modifier" aria-label={`Modifier ${c.display_name}`} className={cn('flex h-7 w-7 items-center justify-center rounded-full', SURFACE.holder)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => toggleArchive(c)} title={c.is_active ? 'Archiver' : 'Réactiver'} aria-label={c.is_active ? `Archiver ${c.display_name}` : `Réactiver ${c.display_name}`} className={cn('flex h-7 w-7 items-center justify-center rounded-full', SURFACE.holder)}>
                          {c.is_active ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => setDeleting(c)} title="Supprimer" aria-label={`Supprimer ${c.display_name}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : (
                      <span aria-hidden />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Créer / modifier ── */}
      <CenterDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        onConfirm={save}
        title={editing === 'new' ? (isSupplier ? 'Nouveau fournisseur USDT' : 'Nouvel acheteur CNY') : 'Modifier la contrepartie'}
        width={480}
        footer={
          <>
            <PrimaryPill onClick={save} disabled={!nameValid} loading={saving} className="flex-1">
              {editing === 'new' ? 'Créer' : 'Enregistrer'}
            </PrimaryPill>
            <SoftPill onClick={() => setEditing(null)} className="flex-1">Annuler</SoftPill>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Nom" htmlFor="cp-name">
            <TextInput id="cp-name" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Nom affiché" />
          </FormField>
          <FormField label="Entreprise" hint="Optionnel">
            <TextInput value={form.legal_name} onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))} />
          </FormField>
          <PhoneInputWithCountry
            label="Téléphone (optionnel)"
            value={form.phone}
            onValueChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            defaultDialCode={defaultDialCode}
          />
          {!isSupplier && (
            <FormField label="WeChat ID" hint="Optionnel — c'est souvent le seul contact d'un acheteur">
              <TextInput value={form.wechat_id} onChange={(e) => setForm((f) => ({ ...f, wechat_id: e.target.value }))} />
            </FormField>
          )}
          <FormField label="Note" hint="Optionnel">
            <TextInput value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </FormField>
        </div>
      </CenterDialog>

      {/* ── Supprimer ── */}
      <CenterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Supprimer la contrepartie"
        width={440}
        footer={
          <>
            <PrimaryPill danger onClick={confirmDelete} loading={remove.isPending} className="flex-1">Supprimer</PrimaryPill>
            <SoftPill onClick={() => setDeleting(null)} className="flex-1">Annuler</SoftPill>
          </>
        }
      >
        <p className={cn('text-[13px]', TEXT.body)}>
          Supprimer <b className={TEXT.strong}>{deleting?.display_name}</b> ?
        </p>
        <p className={cn('mt-2 text-[12px]', TEXT.muted)}>
          La suppression n'est possible que si aucune opération n'est rattachée à cette contrepartie. Si elle a déjà servi,
          utilisez plutôt <b>Archiver</b> : l'historique reste lisible et elle disparaît des listes de saisie.
        </p>
      </CenterDialog>
    </Card>
  );
}
