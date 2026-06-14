// ============================================================
// BeneficiariesPage — carnet client (refonte « Direction A »).
// Liste alias-first (vrais logos de méthode) + recherche + filtres par
// mode · éditeur plein écran (BeneficiaryForm refondu) · archivage
// confirmé. « Supprimer » = archiver (snapshot : les paiements passés ne
// sont jamais affectés). Logique 100% PRÉSERVÉE.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, User, Pencil, Trash2, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import {
  useBeneficiaries,
  useCreateBeneficiary,
  useUpdateBeneficiary,
  useArchiveBeneficiary,
  type Beneficiary,
} from '@/hooks/useBeneficiaries';
import {
  BENEFICIARY_MODE_ORDER,
  type BeneficiaryMode,
  type IdentifierType,
  type RelationType,
} from '@/lib/beneficiaries/spec';
import { modeLabel } from '@/lib/beneficiaries/labels';
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

const BeneficiariesPage = () => {
  const { t } = useTranslation('client');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<BeneficiaryMode | 'all'>('all');
  const [confirmArchive, setConfirmArchive] = useState<Beneficiary | null>(null);

  const { data: beneficiaries, isLoading } = useBeneficiaries();
  const createBeneficiary = useCreateBeneficiary();
  const updateBeneficiary = useUpdateBeneficiary();
  const archiveBeneficiary = useArchiveBeneficiary();

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
  if (view.kind === 'add' || view.kind === 'edit') {
    return (
      <BeneficiaryEditor
        initial={view.kind === 'edit' ? toFormValues(view.beneficiary) : emptyBeneficiaryForm('alipay')}
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
    <MobileLayout>
      <div className={cn('min-h-[100dvh] space-y-4 px-4 pb-6 pt-6', SURFACE.canvas)}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>{t('beneficiaries.title')}</h1>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('beneficiaries.subtitle')}</p>
          </div>
          <button
            onClick={() => setView({ kind: 'add' })}
            aria-label={t('beneficiaries.add')}
            className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95', PRIMARY_PILL)}
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>

        {/* Recherche */}
        <label className={cn('flex items-center gap-2.5 rounded-full px-4 py-3', SURFACE.card, SURFACE.shadow)}>
          <Search className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
          {/* input nu volontaire 16px (anti auto-zoom iOS) */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('beneficiaries.search')}
            className={cn('min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9B98AD]', TEXT.strong)}
          />
        </label>

        {/* Filtres par mode */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setModeFilter('all')}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors',
              modeFilter === 'all' ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
            )}
          >
            {t('beneficiaries.allModes')}
          </button>
          {BENEFICIARY_MODE_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors',
                modeFilter === m ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
              )}
            >
              {modeLabel(m)}
            </button>
          ))}
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="space-y-2.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn('h-[72px] animate-pulse rounded-[18px]', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={cn('mt-2 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
              <User className="h-7 w-7" />
            </div>
            <p className={cn('text-[15px] font-bold', TEXT.strong)}>{t('beneficiaries.noBeneficiary')}</p>
            <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{t('beneficiaries.emptyHint')}</p>
            <button onClick={() => setView({ kind: 'add' })} className="mt-4 text-[14px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">
              {t('beneficiaries.add')}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {filtered.map((b) => (
              <div key={b.id} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
                <PaymentMethodLogo method={b.payment_method} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{b.alias || b.name}</span>
                    {b.relation_type && (
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold', SURFACE.holder)}>
                        {t(`beneficiaries.relations.${b.relation_type}`)}
                      </span>
                    )}
                  </div>
                  <p className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>
                    {b.identifier || b.bank_account || b.phone || b.name || ''}
                  </p>
                </div>
                <button
                  onClick={() => setView({ kind: 'edit', beneficiary: b })}
                  aria-label={t('beneficiaries.edit')}
                  className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.holder)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmArchive(b)}
                  aria-label={t('beneficiaries.actions.archive')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBE7E7] text-[#C0504D] transition active:scale-95 dark:bg-[#3A2526] dark:text-[#E79A9A]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive confirmation */}
      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setConfirmArchive(null)}>
          <div
            className={cn('w-full max-w-sm space-y-4 rounded-[24px] p-5', SURFACE.card)}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={cn('text-[17px] font-black', TEXT.strong)}>{t('beneficiaries.actions.confirmArchiveTitle')}</h3>
            <p className={cn('text-[13px]', TEXT.muted)}>{t('beneficiaries.actions.confirmArchiveBody')}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmArchive(null)} className={cn('flex-1 py-[13px] text-[14px] font-semibold', SOFT_PILL)}>
                {t('beneficiaries.actions.cancel')}
              </button>
              <button
                onClick={async () => {
                  await archiveBeneficiary.mutateAsync(confirmArchive.id);
                  setConfirmArchive(null);
                }}
                disabled={archiveBeneficiary.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#D14343] py-[13px] text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
              >
                {archiveBeneficiary.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('beneficiaries.actions.confirmArchive')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
};

// ── Editor sub-view ────────────────────────────────────────────
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

  const hasQr = !!qrFile || (existingQr && !qrPreview ? existingQr : !!qrPreview);
  const valid = isBeneficiaryFormValid(values, { hasQr });

  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <div className="flex items-center gap-3 px-4 pb-1 pt-4">
          <button
            onClick={onCancel}
            aria-label={t('beneficiaries.actions.cancel')}
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.card, SURFACE.shadow)}
          >
            <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
          </button>
          <span className={cn('truncate text-[17px] font-black', TEXT.strong)}>
            {isEdit ? t('beneficiaries.edit') : t('beneficiaries.add')}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isEdit && (
            <p className={cn('mb-4 rounded-2xl px-3 py-2 text-[12px]', SURFACE.holder)}>{t('beneficiaries.snapshotNotice')}</p>
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

        <div className="flex gap-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <button onClick={onCancel} className={cn('flex-1 py-[15px] text-[15px] font-semibold', SOFT_PILL)}>
            {t('beneficiaries.actions.cancel')}
          </button>
          <button
            onClick={() => onSave(values, qrFile ?? undefined)}
            disabled={!valid || saving}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-[15px] text-[15px] font-bold transition active:scale-[0.99]',
              !valid || saving ? 'rounded-full bg-muted text-muted-foreground' : PRIMARY_PILL,
            )}
          >
            {saving ? <Loader2 className="h-[17px] w-[17px] animate-spin" /> : <Check className="h-[17px] w-[17px]" />}
            {t('beneficiaries.actions.save')}
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}

export default BeneficiariesPage;
