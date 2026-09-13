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
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
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
import { SURFACE, TEXT, Button, Chip, IconButton, Line, TextInput, PrimaryPill, SoftPill, BottomSheet } from '@/mobile/designKit';

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

export default function MobileClientBeneficiaries({ desktop = false }: { desktop?: boolean } = {}) {
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
    ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim()
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
        desktop={desktop}
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
              // `clientId` est requis (invalidation de cache côté hook) et
              // n'était pas transmis.
              clientId: clientId || '',
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
  const total = beneficiaries?.length ?? 0;
  const what = (b: Beneficiary) => {
    const id = b.identifier || b.bank_account || b.phone || b.email;
    const via = modeLabel(b.payment_method);
    if (b.payment_method === 'bank_transfer') return `Par ${via}${b.bank_name ? ` à ${b.bank_name}` : ''}${b.bank_account ? `, compte ${b.bank_account}` : ''}.`;
    return `Par ${via}${id ? `, ${id}` : ''}.`;
  };

  return (
    <div className={desktop ? '' : cn('flex min-h-screen flex-col', SURFACE.canvas)}>
      {desktop ? (
        <header className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>{t('beneficiaries.title')}</h2>
            {clientName && <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{clientName}</p>}
          </div>
          <Button onClick={() => setView({ kind: 'add' })}>
            <Plus /> {t('beneficiaries.add')}
          </Button>
        </header>
      ) : (
        <MobileHeader
          title={t('beneficiaries.title')}
          showBack
          backTo={`/m/clients/${clientId}`}
          rightElement={<IconButton icon={Plus} variant="primary" ariaLabel={t('beneficiaries.add')} onClick={() => setView({ kind: 'add' })} />}
        />
      )}

      <div className={desktop ? 'space-y-4' : 'flex flex-1 flex-col gap-4 px-5 pb-8 pt-4'}>
        {clientName && (
          <Line>
            Les fournisseurs que <b className={TEXT.strong}>{clientName}</b> paie
            {total > 0 ? <> : <b className={cn('tabular-nums', TEXT.strong)}>{total}</b> {total > 1 ? 'bénéficiaires' : 'bénéficiaire'}.</> : '.'}
          </Line>
        )}

        <div className="relative">
          <Search className={cn('pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
          <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, surnom ou numéro" className="pl-10" />
        </div>

        <div className={cn('scrollbar-hide flex gap-2 overflow-x-auto pb-1', !desktop && '-mx-5 px-5')}>
          <Chip label="Tous" active={modeFilter === 'all'} onClick={() => setModeFilter('all')} />
          {BENEFICIARY_MODE_ORDER.map((m) => (
            <Chip key={m} label={modeLabel(m)} active={modeFilter === m} onClick={() => setModeFilter(m)} />
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn('h-20 animate-pulse rounded-lg', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="space-y-3">
            <Line>{total === 0 ? "Aucun bénéficiaire enregistré pour l'instant." : 'Aucun bénéficiaire ne correspond.'}</Line>
            {total === 0 && <Line className={TEXT.muted}>Enregistrez ses fournisseurs une fois : plus rien à ressaisir à chaque paiement.</Line>}
            {total === 0 && (
              <Button className="w-full" onClick={() => setView({ kind: 'add' })}>
                <Plus />
                {t('beneficiaries.add')}
              </Button>
            )}
          </div>
        ) : (
          <ul className={cn('divide-y', SURFACE.divider)}>
            {filtered.map((b) => (
              <li key={b.id} className="flex items-start gap-3 py-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold text-white"
                  style={{ backgroundColor: modeColor(b.payment_method) }}
                >
                  {(b.alias || b.name || '?')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn('break-words text-[18px] font-semibold leading-tight', TEXT.strong)}>{b.alias || b.name}</p>
                  {b.alias && b.name && b.alias !== b.name && <Line className={TEXT.muted}>{b.name}</Line>}
                  <Line className="break-words">{what(b)}</Line>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <IconButton icon={Pencil} ariaLabel={t('beneficiaries.edit')} onClick={() => setView({ kind: 'edit', beneficiary: b })} />
                  <IconButton icon={Trash2} variant="subtle" ariaLabel={t('beneficiaries.actions.confirmArchive')} onClick={() => setConfirmArchive(b)} className="text-[#900B09] dark:text-[#FCB3AD]" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Archive confirmation */}
      <BottomSheet
        open={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        title={t('beneficiaries.actions.confirmArchiveTitle')}
      >
        <Line>
          <b className={TEXT.strong}>{confirmArchive?.alias || confirmArchive?.name}</b> ne sera plus proposé pour les prochains paiements. {t('beneficiaries.snapshotNotice')}
        </Line>
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

function BeneficiaryEditor({
  desktop = false,
  initial,
  isEdit,
  existingQr,
  existingQrUrl,
  saving,
  onCancel,
  onSave,
}: {
  desktop?: boolean;
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
    <div className={desktop ? '' : cn('flex min-h-screen flex-col', SURFACE.canvas)}>
      {desktop ? (
        <header className="mb-5">
          <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>{isEdit ? t('beneficiaries.edit') : t('beneficiaries.add')}</h2>
        </header>
      ) : (
        <MobileHeader
          title={isEdit ? t('beneficiaries.edit') : t('beneficiaries.add')}
          showBack
          onBack={onCancel}
        />
      )}
      <div className={desktop ? 'space-y-3' : 'flex-1 overflow-y-auto px-4 py-5'}>
        {isEdit && (
          <p className={cn('mb-3 rounded-lg p-3 text-[16px]', SURFACE.card, SURFACE.shadow, TEXT.muted)}>
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
