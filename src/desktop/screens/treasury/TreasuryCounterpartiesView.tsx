/**
 * Trésorerie — vue « Contreparties » (docs/admin-redesign/07 §3.5), habillage
 * « salle des marchés ».
 *
 * Deux populations derrière un même objet : les fournisseurs USDT (Cameroun,
 * +237) et les acheteurs CNY (Chine, +86, WeChat). L'onglet choisit la
 * population ET l'indicatif par défaut du formulaire.
 *
 * La suppression est refusée côté serveur quand des opérations existent —
 * l'archivage est la vraie sortie. Le dialogue le dit AVANT de tenter, au lieu
 * de laisser remonter une erreur brute.
 */
import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  M,
  T,
  NUM,
  MCard,
  MCardHeader,
  MChip,
  MSearch,
  MButton,
  MTh,
  MTd,
  MTag,
  MDialog,
  MField,
  MInput,
  MEmpty,
  MLoading,
} from './marketKit';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];

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

  const toggleArchive = (c: TreasuryCounterparty) => update.mutate({ id: c.id, is_active: !c.is_active });

  const confirmDelete = () => {
    if (!deleting || remove.isPending) return;
    remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <MCard className="flex min-h-0 flex-col overflow-hidden">
      <MCardHeader
        title={isSupplier ? 'Fournisseurs USDT' : 'Acheteurs CNY'}
        meta={`${rows.length} contrepartie${rows.length > 1 ? 's' : ''}`}
      />

      <div className={cn('flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5', M.border)}>
        {TABS.map((t) => (
          <MChip key={t.value} label={t.label} active={tab === t.value} onClick={() => setTab(t.value)} />
        ))}
        <MChip label="Avec archivées" active={showArchived} onClick={() => setShowArchived((v) => !v)} />
        <MSearch value={search} onChange={setSearch} placeholder="Rechercher…" className="ml-auto w-[190px]" />
        {canManage && (
          <MButton variant="primary" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Nouvelle
          </MButton>
        )}
      </div>

      {isLoading ? (
        <MLoading />
      ) : rows.length === 0 ? (
        <MEmpty icon={Users}>{search ? 'Aucune contrepartie pour cette recherche.' : 'Aucune contrepartie enregistrée.'}</MEmpty>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className={cn('sticky top-0 z-10 border-b', M.inset, M.border)}>
              <tr>
                <MTh>Nom</MTh>
                <MTh>Réf.</MTh>
                <MTh>{isSupplier ? 'Téléphone' : 'WeChat / Téléphone'}</MTh>
                <MTh>Note</MTh>
                <MTh className="w-[104px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={M.hover}>
                  <MTd>
                    <div className="flex items-center gap-2">
                      <span className={cn('truncate text-[12.5px] font-semibold', T.ink)}>{c.display_name}</span>
                      {!c.is_active && <MTag>Archivée</MTag>}
                    </div>
                    {c.legal_name && <div className={cn('truncate text-[10.5px]', T.faint)}>{c.legal_name}</div>}
                  </MTd>
                  <MTd className={cn('text-[11.5px]', NUM, T.muted)}>{c.short_id ?? '—'}</MTd>
                  <MTd className={cn('text-[12px]', T.body)}>
                    {c.wechat_id ? c.wechat_id : c.phone ? <span className={NUM}>{c.phone}</span> : '—'}
                    {c.wechat_id && c.phone && <div className={cn('text-[10.5px]', NUM, T.faint)}>{c.phone}</div>}
                  </MTd>
                  <MTd className={cn('max-w-[220px] truncate text-[11.5px]', T.muted)}>{c.notes ?? '—'}</MTd>
                  <MTd align="right">
                    {canManage ? (
                      <span className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(c)} title="Modifier" aria-label={`Modifier ${c.display_name}`} className={cn('flex h-6 w-6 items-center justify-center rounded-[4px] border', M.border, T.body)}>
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => toggleArchive(c)} title={c.is_active ? 'Archiver' : 'Réactiver'} aria-label={c.is_active ? `Archiver ${c.display_name}` : `Réactiver ${c.display_name}`} className={cn('flex h-6 w-6 items-center justify-center rounded-[4px] border', M.border, T.body)}>
                          {c.is_active ? <Archive className="h-3 w-3" /> : <ArchiveRestore className="h-3 w-3" />}
                        </button>
                        <button type="button" onClick={() => setDeleting(c)} title="Supprimer" aria-label={`Supprimer ${c.display_name}`} className={cn('flex h-6 w-6 items-center justify-center rounded-[4px] border border-[#FECACA] text-[#B91C1C] dark:border-[#5B2121] dark:text-[#F87171]')}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <span aria-hidden />
                    )}
                  </MTd>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Créer / modifier ── */}
      <MDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        onConfirm={save}
        title={editing === 'new' ? (isSupplier ? 'Nouveau fournisseur USDT' : 'Nouvel acheteur CNY') : 'Modifier la contrepartie'}
        width={470}
        footer={
          <>
            <MButton variant="primary" onClick={save} disabled={!nameValid} loading={saving} className="flex-1">
              {editing === 'new' ? 'Créer' : 'Enregistrer'}
            </MButton>
            <MButton onClick={() => setEditing(null)} className="flex-1">Annuler</MButton>
          </>
        }
      >
        <div className="space-y-3">
          <MField label="Nom" htmlFor="cp-name">
            <MInput id="cp-name" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Nom affiché" />
          </MField>
          <MField label="Entreprise" hint="Optionnel">
            <MInput value={form.legal_name} onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))} />
          </MField>
          <PhoneInputWithCountry
            label="Téléphone (optionnel)"
            value={form.phone}
            onValueChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            defaultDialCode={defaultDialCode}
          />
          {!isSupplier && (
            <MField label="WeChat ID" hint="Optionnel — c'est souvent le seul contact d'un acheteur">
              <MInput value={form.wechat_id} onChange={(e) => setForm((f) => ({ ...f, wechat_id: e.target.value }))} />
            </MField>
          )}
          <MField label="Note" hint="Optionnel">
            <MInput value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </MField>
        </div>
      </MDialog>

      {/* ── Supprimer ── */}
      <MDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Supprimer la contrepartie"
        footer={
          <>
            <MButton variant="danger" onClick={confirmDelete} loading={remove.isPending} className="flex-1">Supprimer</MButton>
            <MButton onClick={() => setDeleting(null)} className="flex-1">Annuler</MButton>
          </>
        }
      >
        <p className={cn('text-[12.5px]', T.body)}>
          Supprimer <b className={T.ink}>{deleting?.display_name}</b> ?
        </p>
        <p className={cn('mt-2 text-[11.5px] leading-relaxed', T.muted)}>
          La suppression n'est possible que si aucune opération n'est rattachée à cette contrepartie. Si elle a déjà servi,
          utilisez plutôt <b>Archiver</b> : l'historique reste lisible et elle disparaît des listes de saisie.
        </p>
      </MDialog>
    </MCard>
  );
}
