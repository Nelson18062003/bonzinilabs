/**
 * Fiche client › Bénéficiaires (maquettes 03/07 et 10/12) : recherche,
 * filtres par mode (avec le total), une ligne par fournisseur avec le vrai
 * logo, « Ajouter un bénéficiaire » en bas. Toucher une ligne ouvre ses
 * gestes : combien de paiements terminés et le dernier, Payer, Modifier,
 * Archiver (avec confirmation). Ajouter / Modifier : le formulaire partagé
 * (BeneficiaryForm, QR compris) dans un écran v2.
 * Mêmes hooks admin qu'avant (supabaseAdmin, filtre client_id explicite).
 */
import { useMemo, useState, type ElementType } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArrowUpRight, Pencil } from 'lucide-react';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useClient } from '@/hooks/useClientManagement';
import {
  useAdminArchiveBeneficiary, useAdminClientBeneficiaries, useAdminCreateBeneficiary, useAdminUpdateBeneficiary, type Beneficiary,
} from '@/hooks/useBeneficiaries';
import { BENEFICIARY_MODE_ORDER, type BeneficiaryMode, type IdentifierType, type RelationType } from '@/lib/beneficiaries/spec';
import { modeLabel } from '@/lib/beneficiaries/labels';
import { BeneficiaryForm, emptyBeneficiaryForm, isBeneficiaryFormValid, type BeneficiaryFormValues } from '@/components/beneficiary/BeneficiaryForm';
import { cn } from '@/lib/utils';
import {
  BigButton, BottomSheet, Chip, ConfirmSheet, Dock, EmptyLine, ItemList, ItemRow, KVBox, MethodCircle, ScreenTop, SearchBox, TEXT,
} from '@/mobile/designKit';
import { ChipRow } from './parts';
import { shortDay } from './ledgerRows';

function toFormValues(b: Beneficiary): BeneficiaryFormValues {
  return {
    payment_method: b.payment_method,
    alias: b.alias ?? '',
    name: b.name ?? '',
    identifier: b.identifier ?? '',
    identifier_type: (b.identifier_type as IdentifierType) ?? 'id',
    phone: b.phone ?? '',
    email: b.email ?? '',
    bank_name: b.bank_name ?? '',
    bank_account: b.bank_account ?? '',
    bank_extra: b.bank_extra ?? '',
    relation_type: (b.relation_type as RelationType) ?? 'supplier',
    notes: b.notes ?? '',
  };
}

/** Ce qu'on lit d'un bénéficiaire sous son nom : identifiant, compte ou téléphone. */
function line(b: Beneficiary): string {
  if (b.payment_method === 'bank_transfer') {
    const acc = b.bank_account ? `****${b.bank_account.replace(/\s/g, '').slice(-4)}` : '';
    return [b.bank_name, acc].filter(Boolean).join(' ') || modeLabel(b.payment_method);
  }
  return b.identifier || b.phone || b.email || modeLabel(b.payment_method);
}

/** Les paiements terminés vers ce bénéficiaire (pour la feuille des gestes). */
function useBeneficiaryStats(id: string | null) {
  return useQuery({
    queryKey: ['admin-beneficiary-stats', id],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('amount_rmb, created_at')
        .eq('beneficiary_id', id!)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data ?? [];
      return { count: rows.length, rmb: rows.reduce((s, r) => s + Number(r.amount_rmb || 0), 0), last: rows[0]?.created_at ?? null };
    },
  });
}

type View = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; b: Beneficiary };

export function MobileClientBeneficiariesV2() {
  const { clientId = '' } = useParams();
  const navigate = useNavigate();
  const { data: client } = useClient(clientId);
  const { data: list, isLoading } = useAdminClientBeneficiaries(clientId || undefined);
  const create = useAdminCreateBeneficiary();
  const update = useAdminUpdateBeneficiary();
  const archive = useAdminArchiveBeneficiary();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<BeneficiaryMode | 'all'>('all');
  const [open, setOpen] = useState<Beneficiary | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Beneficiary | null>(null);
  const stats = useBeneficiaryStats(open?.id ?? null);

  const all = useMemo(() => list ?? [], [list]);
  const modes = BENEFICIARY_MODE_ORDER.filter((m) => all.some((b) => b.payment_method === m));
  const shown = useMemo(() => {
    let l = all;
    if (mode !== 'all') l = l.filter((b) => b.payment_method === mode);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((b) => [b.alias, b.name, b.identifier, b.bank_account, b.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(s)));
    return l;
  }, [all, mode, q]);

  const first = client?.firstName || 'Client';

  if (view.kind !== 'list') {
    return (
      <BeneficiaryEditorV2
        initial={view.kind === 'edit' ? toFormValues(view.b) : emptyBeneficiaryForm('alipay')}
        isEdit={view.kind === 'edit'}
        existingQrUrl={view.kind === 'edit' ? view.b.qr_code_url : null}
        saving={create.isPending || update.isPending}
        onCancel={() => setView({ kind: 'list' })}
        onSave={async (vals, qrFile) => {
          try {
            if (view.kind === 'edit') {
              await update.mutateAsync({
                beneficiaryId: view.b.id,
                clientId,
                updates: {
                  alias: vals.alias, name: vals.name, identifier: vals.identifier || null, identifier_type: vals.identifier_type,
                  phone: vals.phone || null, email: vals.email || null, bank_name: vals.bank_name || null, bank_account: vals.bank_account || null,
                  bank_extra: vals.bank_extra || null, relation_type: vals.relation_type, notes: vals.notes || null,
                },
                qrCodeFile: qrFile,
              });
            } else {
              await create.mutateAsync({
                client_id: clientId, payment_method: vals.payment_method, alias: vals.alias, name: vals.name,
                identifier: vals.identifier || undefined, identifier_type: vals.identifier_type, phone: vals.phone || undefined,
                email: vals.email || undefined, bank_name: vals.bank_name || undefined, bank_account: vals.bank_account || undefined,
                bank_extra: vals.bank_extra || undefined, relation_type: vals.relation_type, notes: vals.notes || undefined, qr_code_file: qrFile,
              });
            }
            setView({ kind: 'list' });
          } catch {
            /* le hook affiche l'erreur ; l'écran reste ouvert */
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title={`Bénéficiaires · ${first}`} backTo={`/m/clients/${clientId}`} />
      <div className="px-5 pt-5">
        <SearchBox value={q} onChange={setQ} placeholder="Nom, compte ou téléphone" />
      </div>
      <ChipRow className="mt-3.5">
        <Chip label="Tous" count={all.length} active={mode === 'all'} onClick={() => setMode('all')} />
        {modes.map((m) => <Chip key={m} label={m === 'bank_transfer' ? 'Banque' : modeLabel(m)} active={mode === m} onClick={() => setMode(m)} />)}
      </ChipRow>

      {isLoading ? (
        <ItemList className="mt-3">{[0, 1, 2].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
      ) : shown.length === 0 ? (
        <EmptyLine>{all.length === 0 ? 'Aucun bénéficiaire enregistré.' : 'Aucun bénéficiaire ne correspond.'}</EmptyLine>
      ) : (
        <ItemList className="mt-1">
          {shown.map((b) => (
            <ItemRow key={b.id} leading={<MethodCircle method={b.payment_method} />} title={b.alias || b.name} subtitle={line(b)} chevron onClick={() => setOpen(b)} />
          ))}
        </ItemList>
      )}

      <Dock>
        <BigButton onClick={() => setView({ kind: 'add' })}>Ajouter un bénéficiaire</BigButton>
      </Dock>

      <BottomSheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <>
            <div className="flex items-center gap-3.5">
              <MethodCircle method={open.payment_method} size={52} />
              <div className="min-w-0">
                <h3 className={cn('truncate text-[22px] font-semibold leading-tight', TEXT.strong)}>{open.alias || open.name}</h3>
                <p className={cn('truncate text-[16px]', TEXT.muted)}>{modeLabel(open.payment_method)} · {line(open)}</p>
              </div>
            </div>
            <KVBox
              className="mt-4"
              rows={[
                { label: 'Payé', value: stats.isLoading ? '…' : stats.data && stats.data.count > 0 ? `${stats.data.count} fois · ¥ ${stats.data.rmb.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\u202F/g, '\u00A0')}` : 'Jamais' },
                { label: 'Dernier paiement', value: stats.data?.last ? shortDay(stats.data.last) : '—' },
              ]}
            />
          </>
        )}
        <ActionSheetRows
          actions={open ? [
            { label: `Payer ${open.alias || open.name}`, icon: ArrowUpRight, onClick: () => navigate(`/m/payments/new?clientId=${clientId}&beneficiaryId=${open.id}`) },
            { label: 'Modifier', icon: Pencil, onClick: () => setView({ kind: 'edit', b: open }) },
            { label: 'Archiver', hint: 'plus proposé', icon: Archive, onClick: () => setConfirmArchive(open) },
          ] : []}
          onPick={() => setOpen(null)}
        />
      </BottomSheet>

      <ConfirmSheet
        open={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        title={`Archiver ${confirmArchive?.alias || confirmArchive?.name || ''} ?`}
        subtitle="Plus proposé aux prochains paiements · les anciens restent"
        confirmLabel="Archiver"
        danger
        loading={archive.isPending}
        onConfirm={async () => {
          if (!confirmArchive) return;
          try { await archive.mutateAsync(confirmArchive.id); setConfirmArchive(null); } catch { /* toast du hook */ }
        }}
      />
    </div>
  );
}

/** Les lignes d'actions de la feuille (même dessin que l'ActionSheet du kit, posées sous un en-tête). */
function ActionSheetRows({ actions, onPick }: { actions: { label: string; hint?: string; icon: ElementType; onClick: () => void }[]; onPick: () => void }) {
  return (
    <div className="mt-3">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={() => { onPick(); a.onClick(); }}
            className="flex min-h-[56px] w-full items-center gap-3.5 border-b border-[#D9D9D9] py-2.5 text-left last:border-b-0 active:bg-[#F5F5F5] dark:border-[#444444] dark:active:bg-[#383838]"
          >
            <Icon className={cn('h-[22px] w-[22px] shrink-0', TEXT.strong)} strokeWidth={2} />
            <span className={cn('min-w-0 flex-1 text-[17px] font-semibold', TEXT.strong)}>{a.label}</span>
            {a.hint && <span className={cn('text-[15px]', TEXT.muted)}>{a.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function BeneficiaryEditorV2({
  initial, isEdit, existingQrUrl, saving, onCancel, onSave,
}: {
  initial: BeneficiaryFormValues;
  isEdit: boolean;
  existingQrUrl: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: BeneficiaryFormValues, qrFile?: File) => void | Promise<void>;
}) {
  const [values, setValues] = useState<BeneficiaryFormValues>(initial);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const existingQr = !!existingQrUrl;
  const valid = isBeneficiaryFormValid(values, { hasQr: !!qrFile || existingQr });
  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title={isEdit ? 'Modifier le bénéficiaire' : 'Nouveau bénéficiaire'} onBack={onCancel} />
      <div className="px-5 pb-4 pt-5">
        <BeneficiaryForm
          values={values}
          onChange={setValues}
          lockMode={isEdit}
          qrPreview={qrPreview}
          hasStoredQr={existingQr}
          storedQrUrl={existingQrUrl}
          onQrSelect={(file) => { if (qrPreview) URL.revokeObjectURL(qrPreview); setQrFile(file); setQrPreview(URL.createObjectURL(file)); }}
          onQrRemove={() => { if (qrPreview) URL.revokeObjectURL(qrPreview); setQrFile(null); setQrPreview(null); }}
        />
      </div>
      <Dock>
        <BigButton onClick={() => void onSave(values, qrFile ?? undefined)} disabled={!valid} loading={saving}>Enregistrer</BigButton>
      </Dock>
    </div>
  );
}
