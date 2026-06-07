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
import { Plus, Search, User, Pencil, Trash2 } from 'lucide-react';
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
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  Card,
  Holder,
  TextInput,
  PrimaryPill,
  SoftPill,
  BottomSheet,
} from '@/mobile/designKit';

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
        existingQrUrl={view.kind === 'edit' ? view.beneficiary.qr_code_url : null}
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
    <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
      <MobileHeader
        title={t('beneficiaries.title')}
        subtitle={clientName || undefined}
        showBack
        backTo={`/m/clients/${clientId}`}
        rightElement={
          <button
            onClick={() => setView({ kind: 'add' })}
            aria-label={t('beneficiaries.add')}
            className={cn('flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95', PRIMARY_PILL)}
          >
            <Plus className="h-5 w-5" />
          </button>
        }
      />

      <div className="flex-1 space-y-3 px-4 py-5">
        <div className="relative">
          <Search className={cn('absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('beneficiaries.search')}
            className="pl-10"
          />
        </div>

        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
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
              <div key={i} className={cn('h-16 animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Holder icon={User} size="lg" className="mx-auto" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.strong)}>{t('beneficiaries.noBeneficiary')}</p>
            <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{t('beneficiaries.emptyHint')}</p>
            <PrimaryPill onClick={() => setView({ kind: 'add' })} className="mt-4">
              {t('beneficiaries.add')}
            </PrimaryPill>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => (
              <Card key={b.id} className="flex items-center gap-3 p-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
                  style={{ backgroundColor: modeColor(b.payment_method) }}
                >
                  {(b.alias || b.name || '?')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>{b.alias || b.name}</p>
                  <p className={cn('truncate text-[12px]', TEXT.muted)}>
                    {b.identifier || b.bank_account || b.phone || b.name || ''}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `${modeColor(b.payment_method)}1a`, color: modeColor(b.payment_method) }}
                >
                  {modeLabel(b.payment_method)}
                </span>
                <Holder
                  icon={Pencil}
                  size="sm"
                  onClick={() => setView({ kind: 'edit', beneficiary: b })}
                />
                <Holder
                  icon={Trash2}
                  tone="danger"
                  size="sm"
                  onClick={() => setConfirmArchive(b)}
                />
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Archive confirmation */}
      <BottomSheet
        open={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        title={t('beneficiaries.actions.confirmArchiveTitle')}
      >
        <p className={cn('text-[14px]', TEXT.muted)}>{t('beneficiaries.actions.confirmArchiveBody')}</p>
        <div className="mt-5 flex gap-2">
          <SoftPill onClick={() => setConfirmArchive(null)} className="flex-1">
            {t('beneficiaries.actions.cancel')}
          </SoftPill>
          <PrimaryPill
            danger
            onClick={async () => {
              if (!confirmArchive) return;
              await archiveBeneficiary.mutateAsync(confirmArchive.id);
              setConfirmArchive(null);
            }}
            loading={archiveBeneficiary.isPending}
            className="flex-1"
          >
            {t('beneficiaries.actions.confirmArchive')}
          </PrimaryPill>
        </div>
      </BottomSheet>
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
        'whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
        active ? PRIMARY_PILL : SOFT_PILL,
      )}
      // Active mode chip keeps its brand accent (color carries the mode meaning).
      style={active && color ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {children}
    </button>
  );
}

function BeneficiaryEditor({
  initial,
  isEdit,
  existingQr,
  existingQrUrl,
  saving,
  onCancel,
  onSave,
}: {
  initial: BeneficiaryFormValues;
  isEdit: boolean;
  existingQr: boolean;
  existingQrUrl?: string | null;
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
    <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
      <MobileHeader
        title={isEdit ? t('beneficiaries.edit') : t('beneficiaries.add')}
        showBack
        onBack={onCancel}
      />
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {isEdit && (
          <p className={cn('mb-3 rounded-2xl p-3 text-[12px]', SURFACE.card, SURFACE.shadow, TEXT.muted)}>
            {t('beneficiaries.snapshotNotice')}
          </p>
        )}
        <BeneficiaryForm
          values={values}
          onChange={setValues}
          lockMode={isEdit}
          qrPreview={qrPreview}
          hasStoredQr={existingQr}
          storedQrUrl={existingQrUrl}
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
      <div className={cn('flex gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2', SURFACE.card, SURFACE.shadow)}>
        <SoftPill onClick={onCancel} className="flex-1">
          {t('beneficiaries.actions.cancel')}
        </SoftPill>
        <PrimaryPill
          onClick={() => onSave(values, qrFile ?? undefined)}
          disabled={!valid}
          loading={saving}
          className="flex-1"
        >
          {t('beneficiaries.actions.save')}
        </PrimaryPill>
      </div>
    </div>
  );
}
