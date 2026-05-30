// ============================================================
// MobileClientBeneficiaries — ADMIN view of a client's carnet.
//
// Lets an admin list / add / edit / archive the beneficiaries of ONE
// client, OUTSIDE a payment (Phase 3 §D). Strictly scoped to the
// :clientId from the route (admin RLS + explicit client_id filter →
// no cross-client leak). Reuses the shared <BeneficiaryForm/> and the
// admin beneficiary hooks. Alias-first display; "delete" = archive.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Plus, Search, User, Pencil, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { cn } from '@/lib/utils';
import { useClient } from '@/hooks/useClientManagement';
import {
  useAdminClientBeneficiaries,
  useAdminCreateBeneficiary,
  useAdminUpdateBeneficiary,
  useAdminArchiveBeneficiary,
  type Beneficiary,
} from '@/hooks/useBeneficiaries';
import {
  BENEFICIARY_MODE_ORDER,
  type BeneficiaryMode,
  type IdentifierType,
  type RelationType,
} from '@/lib/beneficiaries/spec';
import { modeColor, modeLabel } from '@/lib/beneficiaries/labels';
import {
  BeneficiaryForm,
  emptyBeneficiaryForm,
  isBeneficiaryFormValid,
  type BeneficiaryFormValues,
} from '@/components/beneficiary/BeneficiaryForm';

type View = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; beneficiary: Beneficiary };

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

export default function MobileClientBeneficiaries() {
  const { t } = useTranslation('client');
  const { clientId } = useParams();
  const { data: client } = useClient(clientId || '');

  const [view, setView] = useState<View>({ kind: 'list' });
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<BeneficiaryMode | 'all'>('all');
  const [confirmArchive, setConfirmArchive] = useState<Beneficiary | null>(null);

  const { data: beneficiaries, isLoading } = useAdminClientBeneficiaries(clientId || undefined);
  const createBeneficiary = useAdminCreateBeneficiary();
  const updateBeneficiary = useAdminUpdateBeneficiary();
  const archiveBeneficiary = useAdminArchiveBeneficiary();

  const clientName = client
    ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()
    : '';

  const filtered = useMemo(() => {
    let list = beneficiaries ?? [];
    if (modeFilter !== 'all') list = list.filter((b) => b.payment_method === modeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        [b.alias, b.name, b.identifier, b.bank_account, b.phone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [beneficiaries, modeFilter, search]);

  // ── Add / Edit sub-view ──────────────────────────────────────
  if ((view.kind === 'add' || view.kind === 'edit') && clientId) {
    return (
      <BeneficiaryEditor
        initial={
          view.kind === 'edit' ? toFormValues(view.beneficiary) : emptyBeneficiaryForm('alipay')
        }
        isEdit={view.kind === 'edit'}
        existingQr={view.kind === 'edit' ? !!view.beneficiary.qr_code_url : false}
        saving={createBeneficiary.isPending || updateBeneficiary.isPending}
        onCancel={() => setView({ kind: 'list' })}
        onSave={async (vals, qrFile) => {
          if (view.kind === 'edit') {
            await updateBeneficiary.mutateAsync({
              beneficiaryId: view.beneficiary.id,
              updates: {
                alias: vals.alias,
                name: vals.name,
                identifier: vals.identifier || null,
                identifier_type: vals.identifier_type,
                phone: vals.phone || null,
                email: vals.email || null,
                bank_name: vals.bank_name || null,
                bank_account: vals.bank_account || null,
                bank_extra: vals.bank_extra || null,
                relation_type: vals.relation_type,
                notes: vals.notes || null,
              },
              qrCodeFile: qrFile,
            });
          } else {
            await createBeneficiary.mutateAsync({
              client_id: clientId,
              payment_method: vals.payment_method,
              alias: vals.alias,
              name: vals.name,
              identifier: vals.identifier || undefined,
              identifier_type: vals.identifier_type,
              phone: vals.phone || undefined,
              email: vals.email || undefined,
              bank_name: vals.bank_name || undefined,
              bank_account: vals.bank_account || undefined,
              bank_extra: vals.bank_extra || undefined,
              relation_type: vals.relation_type,
              notes: vals.notes || undefined,
              qr_code_file: qrFile,
            });
          }
          setView({ kind: 'list' });
        }}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('beneficiaries.title')}
        subtitle={clientName || undefined}
        showBack
        backTo={`/m/clients/${clientId}`}
        rightElement={
          <button
            onClick={() => setView({ kind: 'add' })}
            aria-label={t('beneficiaries.add')}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-4 py-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('beneficiaries.search')}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          <FilterChip active={modeFilter === 'all'} onClick={() => setModeFilter('all')}>
            {t('beneficiaries.allModes')}
          </FilterChip>
          {BENEFICIARY_MODE_ORDER.map((m) => (
            <FilterChip
              key={m}
              active={modeFilter === m}
              color={modeColor(m)}
              onClick={() => setModeFilter(m)}
            >
              {modeLabel(m)}
            </FilterChip>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">{t('beneficiaries.noBeneficiary')}</p>
            <p className="text-sm text-muted-foreground mb-4">{t('beneficiaries.emptyHint')}</p>
            <button onClick={() => setView({ kind: 'add' })} className="text-sm text-primary font-medium">
              {t('beneficiaries.add')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                  style={{ backgroundColor: modeColor(b.payment_method) }}
                >
                  {(b.alias || b.name || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.alias || b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.identifier || b.bank_account || b.phone || b.name || ''}
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `${modeColor(b.payment_method)}1a`, color: modeColor(b.payment_method) }}
                >
                  {modeLabel(b.payment_method)}
                </span>
                <button
                  onClick={() => setView({ kind: 'edit', beneficiary: b })}
                  aria-label={t('beneficiaries.edit')}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmArchive(b)}
                  aria-label={t('beneficiaries.actions.archive')}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4">
            <h3 className="text-lg font-semibold">{t('beneficiaries.actions.confirmArchiveTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('beneficiaries.actions.confirmArchiveBody')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmArchive(null)}
                className="flex-1 py-3 rounded-xl border border-border font-medium"
              >
                {t('beneficiaries.actions.cancel')}
              </button>
              <button
                onClick={async () => {
                  await archiveBeneficiary.mutateAsync(confirmArchive.id);
                  setConfirmArchive(null);
                }}
                disabled={archiveBeneficiary.isPending}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium flex items-center justify-center gap-2"
              >
                {archiveBeneficiary.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('beneficiaries.actions.confirmArchive')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'whitespace-nowrap px-3 h-8 rounded-full text-sm font-medium border-2 transition-colors',
        active ? 'border-current' : 'border-border text-muted-foreground',
      )}
      style={active ? { color: color ?? 'hsl(var(--primary))' } : undefined}
    >
      {children}
    </button>
  );
}

function BeneficiaryEditor({
  initial,
  isEdit,
  existingQr,
  saving,
  onCancel,
  onSave,
}: {
  initial: BeneficiaryFormValues;
  isEdit: boolean;
  existingQr: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: BeneficiaryFormValues, qrFile?: File) => void | Promise<void>;
}) {
  const { t } = useTranslation('client');
  const [values, setValues] = useState<BeneficiaryFormValues>(initial);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const hasQr = !!qrFile || existingQr;
  const valid = isBeneficiaryFormValid(values, { hasQr });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MobileHeader
        title={isEdit ? t('beneficiaries.edit') : t('beneficiaries.add')}
        showBack
        onBack={onCancel}
      />
      <div className="px-4 py-4 flex-1 overflow-y-auto">
        {isEdit && (
          <p className="text-xs text-muted-foreground mb-3 bg-muted/50 rounded-lg p-2">
            {t('beneficiaries.snapshotNotice')}
          </p>
        )}
        <BeneficiaryForm
          values={values}
          onChange={setValues}
          lockMode={isEdit}
          qrPreview={qrPreview}
          hasStoredQr={existingQr}
          onQrSelect={(file) => {
            if (qrPreview) URL.revokeObjectURL(qrPreview);
            setQrFile(file);
            setQrPreview(URL.createObjectURL(file));
          }}
          onQrRemove={() => {
            if (qrPreview) URL.revokeObjectURL(qrPreview);
            setQrFile(null);
            setQrPreview(null);
          }}
        />
      </div>
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 flex gap-2 border-t border-border">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-border font-medium">
          <span className="inline-flex items-center gap-1 justify-center w-full">
            <ArrowLeft className="w-4 h-4" />
            {t('beneficiaries.actions.cancel')}
          </span>
        </button>
        <button
          onClick={() => onSave(values, qrFile ?? undefined)}
          disabled={!valid || saving}
          className={cn(
            'flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2',
            !valid || saving
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground',
          )}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('beneficiaries.actions.save')}
        </button>
      </div>
    </div>
  );
}
