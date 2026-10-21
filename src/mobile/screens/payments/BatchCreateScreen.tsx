/**
 * Paiement groupé, v2 (maquettes 10-complements/01, 02 et 03) : le client à
 * débiter ; les fournisseurs du lot (¥ et XAF) ; « Ajouter un fournisseur »
 * (feuille : moyen, montant ¥ avec ¥1K · ¥2,5K · ¥5K · Restant, bénéficiaire,
 * « Enregistrer dans son carnet », lien « Son carnet ») ; en bas le total et
 * le restant, et « Vérifier le lot » → « Créer le lot ? » (tout ou rien).
 *
 * Création : useCreatePaymentBatch (create_payment_batch, atomique), puis
 * l'enregistrement au carnet des nouveaux fournisseurs (useAdminCreateBeneficiary),
 * comme BulkPaymentCreate — qui reste l'écran de l'ordinateur. Taux : pays du
 * client et tranche du montant (teamPaymentFromCny), ou taux perso par ligne.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { useCreatePaymentBatch, type CreatePaymentBatchInput } from '@/hooks/usePaymentBatches';
import { useAdminClientBeneficiaries, useAdminClientBeneficiaryNames, useAdminCreateBeneficiary, type Beneficiary } from '@/hooks/useBeneficiaries';
import { nextSupplierName } from '@/lib/beneficiaries/defaultName';
import { clientCountryToRateKey } from '@/components/payment-form/paymentRateLogic';
import { teamPaymentFromCny } from '@/lib/countryRates';
import { getBaseRate } from '@/lib/rateCalculation';
import { MIN_PAYMENT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import { toStoredPath } from '@/lib/signedUrls';
import { draftErrors, draftPayload, emptyDraft, type BeneficiaryDraft } from '@/lib/beneficiaries/contact';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';
import type { PaymentMethodKey } from '@/types/rates';
import { cn } from '@/lib/utils';
import {
  BigButton, BottomSheet, ConfirmSheet, Dock, IconCircle, Initials, ItemList, ItemRow, MethodCircle, MoreButton, PAYMENT_METHOD,
  ScreenTop, TextInput, TEXT, SURFACE, WhoCard, useSheet,
} from '@/mobile/designKit';
import { RateUnavailableNotice } from '@/mobile/components/payments/RateUnavailableNotice';
import { ClientPicker, type PickedClient } from '@/mobile/screens/operations/ClientPicker';
import { ChoiceChips, FieldLabel, MenuSheet, MethodTile, TextLink, TileGrid, ToggleRow } from '@/mobile/screens/operations/parts';
import { n0, yuan } from '@/mobile/screens/operations/opsLabels';
import { useWalletsMap } from '@/mobile/screens/operations/opsQueries';
import { SupplierFields } from './SupplierFields';

const MODES: { key: BeneficiaryMode; label: string; rateKey: PaymentMethodKey }[] = [
  { key: 'alipay', label: 'Alipay', rateKey: 'alipay' },
  { key: 'wechat', label: 'WeChat', rateKey: 'wechat' },
  { key: 'bank_transfer', label: 'Virement', rateKey: 'virement' },
  { key: 'cash', label: 'Cash', rateKey: 'cash' },
];
const rateKeyOf = (m: BeneficiaryMode): PaymentMethodKey => MODES.find((x) => x.key === m)?.rateKey ?? 'alipay';
const nameOf = (c: { first_name?: string | null; last_name?: string | null } | null) => (c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '') || 'Client';
const uid = () => Math.random().toString(36).slice(2, 10);

interface Line {
  id: string;
  mode: BeneficiaryMode;
  cny: number;
  xaf: number;
  rate: number;
  custom: boolean;
  draft: BeneficiaryDraft;
  picked: Beneficiary | null;
  qrFile: File | null;
  keep: boolean;
}

export function BatchCreateScreen() {
  const navigate = useNavigate();
  const { data: rateData, isLoading: rateLoading, isFetching: rateFetching, refetch: refetchRate } = useActiveDailyRate();
  const { data: adjustments } = useRateAdjustments();
  const { data: wallets } = useWalletsMap();
  const createBatch = useCreatePaymentBatch();
  const createBeneficiary = useAdminCreateBeneficiary();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [picking, setPicking] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [verify, setVerify] = useState(false);
  const more = useSheet();

  // La feuille d'une ligne
  const [editing, setEditing] = useState<Line | null>(null);
  const [cnyText, setCnyText] = useState('');
  const [rateText, setRateText] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const carnetSheet = useSheet();
  const [lineMenu, setLineMenu] = useState<Line | null>(null);

  const { data: carnet } = useAdminClientBeneficiaries(client?.user_id);
  const { data: carnetNames } = useAdminClientBeneficiaryNames(client?.user_id);
  // « Supplier NN » proposé en Alipay / WeChat (comme le paiement seul), sans reprendre un numéro déjà pris dans le lot.
  const autoName = () => nextSupplierName([...(carnetNames ?? []), ...lines.map((l) => ({ name: l.draft.name, alias: null }))]);

  const balance = client ? wallets?.get(client.user_id)?.balance ?? 0 : 0;
  const overdraft = client ? wallets?.get(client.user_id)?.overdraft ?? 0 : 0;
  const available = balance + overdraft;
  const totalXaf = lines.reduce((s, l) => s + l.xaf, 0);
  const totalCny = lines.reduce((s, l) => s + l.cny, 0);
  const others = editing ? lines.filter((l) => l.id !== editing.id).reduce((s, l) => s + l.xaf, 0) : totalXaf;
  const clientKey = client ? clientCountryToRateKey((client as { country?: string | null }).country) : null;

  const priceOf = (mode: BeneficiaryMode, cny: number, custom: number | null) => {
    const ref = rateData ? getBaseRate(rateData, rateKeyOf(mode)) || 0 : 0;
    if (!(ref > 0)) return { published: false, rate: 0, xaf: 0 };
    const rate = custom && custom > 0 ? custom : teamPaymentFromCny(ref, clientKey, adjustments, cny).rate;
    return { published: true, rate, xaf: rate > 0 ? Math.round((cny * 1_000_000) / rate) : 0 };
  };

  const eCny = Math.round(Number(cnyText.replace(/\s/g, '')) || 0);
  const eCustom = editing?.custom ? Number(rateText) || 0 : null;
  const ePrice = editing ? priceOf(editing.mode, eCny, eCustom) : { published: false, rate: 0, xaf: 0 };
  const eErrors = editing && !editing.picked ? draftErrors(editing.mode, editing.draft, { hasQr: !!editing.qrFile }) : {};
  const eFirstError = Object.values(eErrors)[0] ?? null;
  const eAmountOk = ePrice.published && ePrice.rate > 0 && isValidXafAmount(ePrice.xaf, MIN_PAYMENT_XAF) && eCny >= 1;

  const openLine = (l?: Line) => {
    const base: Line = l ?? { id: uid(), mode: 'alipay', cny: 0, xaf: 0, rate: 0, custom: false, draft: { ...emptyDraft('alipay'), name: autoName() }, picked: null, qrFile: null, keep: true };
    setEditing(base);
    setCnyText(base.cny ? String(base.cny) : '');
    setRateText(base.custom ? String(base.rate) : '');
    setShowErrors(false);
    setQrPreview((old) => { if (old) URL.revokeObjectURL(old); return base.qrFile ? URL.createObjectURL(base.qrFile) : null; });
  };
  const patch = (p: Partial<Line>) => setEditing((e) => (e ? { ...e, ...p } : e));

  const remainingCny = () => {
    if (!editing) return 0;
    const left = available - others;
    const ref = rateData ? getBaseRate(rateData, rateKeyOf(editing.mode)) || 0 : 0;
    const rate = eCustom && eCustom > 0 ? eCustom : ref > 0 ? teamPaymentFromCny(ref, clientKey, adjustments, Math.floor((left * ref) / 1_000_000)).rate : 0;
    return rate > 0 && left > 0 ? Math.floor((left * rate) / 1_000_000) : 0;
  };

  const commit = () => {
    if (!editing) return;
    if (!eAmountOk) { toast.error(ePrice.published ? 'Renseignez un montant valide' : 'Taux du jour indisponible'); return; }
    if (eFirstError) { setShowErrors(true); toast.error(eFirstError); return; }
    const line: Line = { ...editing, cny: eCny, xaf: ePrice.xaf, rate: ePrice.rate, custom: !!(eCustom && eCustom > 0) };
    setLines((prev) => (prev.some((x) => x.id === line.id) ? prev.map((x) => (x.id === line.id ? line : x)) : [...prev, line]));
    setEditing(null);
  };

  const pickFromCarnet = (b: Beneficiary) => {
    patch({ mode: b.payment_method as BeneficiaryMode, picked: b, keep: false, qrFile: null });
    carnetSheet.hide();
  };

  const labelOf = (l: Line) => (l.picked ? l.picked.alias || l.picked.name : l.mode === 'cash' && l.draft.isClient ? nameOf(client) : l.draft.name.trim() || PAYMENT_METHOD[rateKeyOf(l.mode)].label);
  const accountOf = (l: Line) => {
    if (l.picked) return l.picked.identifier || l.picked.phone || l.picked.bank_account || l.picked.email || '';
    const p = draftPayload(l.mode, l.draft);
    return p.identifier || p.bank_account || p.phone || (l.qrFile ? 'QR' : '');
  };

  const create = () => {
    if (!client || lines.length === 0) return;
    if (totalXaf > available) { toast.error('Solde insuffisant pour ce lot.'); return; }
    if (lines.some((l) => !(l.rate > 0) || !Number.isSafeInteger(l.xaf))) { toast.error('Un montant est invalide.'); return; }
    const input: CreatePaymentBatchInput = {
      user_id: client.user_id,
      note: note.trim() || undefined,
      lines: lines.map((l) => {
        if (l.picked) {
          const b = l.picked;
          return {
            method: l.mode, amount_xaf: l.xaf, amount_rmb: l.cny, exchange_rate: l.rate, rate_is_custom: l.custom,
            beneficiary_name: b.name || undefined, beneficiary_identifier: b.identifier || undefined,
            beneficiary_identifier_type: b.identifier ? (b.identifier_type as 'qr' | 'id' | 'email' | 'phone' | null) ?? undefined : b.qr_code_url ? 'qr' : undefined,
            beneficiary_phone: b.phone || undefined, beneficiary_email: b.email || undefined, beneficiary_bank_name: b.bank_name || undefined,
            beneficiary_bank_account: b.bank_account || undefined, beneficiary_bank_extra: b.bank_extra || undefined,
            beneficiary_qr_code_url: toStoredPath(b.qr_code_url) || undefined, beneficiary_id: b.id,
          };
        }
        const p = draftPayload(l.mode, l.draft);
        const cashSelf = l.mode === 'cash' && l.draft.isClient;
        return {
          method: l.mode, amount_xaf: l.xaf, amount_rmb: l.cny, exchange_rate: l.rate, rate_is_custom: l.custom,
          beneficiary_name: (cashSelf ? nameOf(client) : p.name) || undefined, beneficiary_identifier: p.identifier,
          beneficiary_identifier_type: p.identifier ? p.identifier_type : l.qrFile ? 'qr' : undefined,
          beneficiary_phone: p.phone, beneficiary_email: p.email, beneficiary_bank_name: p.bank_name, beneficiary_bank_account: p.bank_account,
          beneficiary_bank_extra: p.bank_extra, qr_code_files: l.qrFile ? [l.qrFile] : undefined,
        };
      }),
    };
    createBatch.mutate(input, {
      onSuccess: async (res) => {
        for (const l of lines.filter((x) => x.keep && !x.picked && !(x.mode === 'cash' && x.draft.isClient))) {
          const p = draftPayload(l.mode, l.draft);
          if (!p.name) continue;
          try {
            await createBeneficiary.mutateAsync({
              client_id: client.user_id, payment_method: l.mode, alias: p.name, name: p.name, identifier: p.identifier, identifier_type: p.identifier_type,
              phone: p.phone, email: p.email, bank_name: p.bank_name, bank_account: p.bank_account, bank_extra: p.bank_extra, qr_code_file: l.qrFile || undefined,
            });
          } catch { /* le hook prévient ; le lot est créé */ }
        }
        navigate(res.batch_id ? `/m/payments/batch/${res.batch_id}` : '/m/payments/batches');
      },
    });
  };

  if (picking || !client) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Paiement groupé" onBack={() => (client ? setPicking(false) : navigate(-1))} />
        <ClientPicker onPick={(c) => { if (c.user_id !== client?.user_id) setLines([]); setClient(c); setPicking(false); }} balances={wallets} selectedId={client?.user_id} />
      </div>
    );
  }

  const over = totalXaf > available;

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Paiement groupé" backTo="/m/payments/batches" right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pt-4">
        <WhoCard leading={<Initials name={nameOf(client)} />} name={nameOf(client)} line={`Solde ${n0(balance)} XAF${overdraft > 0 ? ` · découvert ${n0(overdraft)}` : ''}`} onClick={() => setPicking(true)} />
      </div>
      <FieldLabel className="px-5">{lines.length} fournisseur{lines.length > 1 ? 's' : ''}</FieldLabel>
      <ItemList>
        {lines.map((l) => (
          <ItemRow
            key={l.id}
            leading={<MethodCircle method={rateKeyOf(l.mode)} />}
            title={labelOf(l)}
            subtitle={[PAYMENT_METHOD[rateKeyOf(l.mode)].label, accountOf(l)].filter(Boolean).join(' · ')}
            right={
              <span className="shrink-0 text-right">
                <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{yuan(l.cny)}</span>
                <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>{n0(l.xaf)}</span>
              </span>
            }
            onClick={() => setLineMenu(l)}
          />
        ))}
        <ItemRow leading={<IconCircle icon={Plus} />} title="Ajouter un fournisseur" subtitle="Nouveau ou depuis son carnet" onClick={() => openLine()} />
      </ItemList>
      <div aria-hidden className="h-12" />

      <Dock>
        <div className="flex items-baseline justify-between gap-3 text-[16px]">
          <span className={TEXT.muted}>Total <b className={cn('font-bold', TEXT.strong)}>{yuan(totalCny)}</b></span>
          <span className={over ? 'font-semibold text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.muted}>Restant <b className={cn('font-bold', over ? '' : TEXT.strong)}>{n0(available - totalXaf)} XAF</b></span>
        </div>
        <BigButton onClick={() => setVerify(true)} disabled={lines.length === 0 || over}>Vérifier le lot · {lines.length}</BigButton>
      </Dock>

      {/* Une ligne : modifier, dupliquer, retirer */}
      <MenuSheet
        open={!!lineMenu}
        onClose={() => setLineMenu(null)}
        title={lineMenu ? `${yuan(lineMenu.cny)} · ${labelOf(lineMenu)}` : undefined}
        items={lineMenu ? [
          { label: 'Modifier', icon: UserRound, onClick: () => openLine(lineMenu) },
          { label: 'Dupliquer', icon: Copy, onClick: () => setLines((p) => [...p, { ...lineMenu, id: uid(), picked: lineMenu.picked, keep: false }]) },
          { label: 'Retirer du lot', icon: Trash2, danger: true, onClick: () => setLines((p) => p.filter((x) => x.id !== lineMenu.id)) },
        ] : []}
      />

      {/* Nouveau fournisseur (feuille) */}
      <BottomSheet open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>{lines.some((x) => x.id === editing.id) ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3>
              {(carnet ?? []).length > 0 && <TextLink onClick={carnetSheet.show}>Son carnet</TextLink>}
            </div>
            {!ePrice.published && editing && <RateUnavailableNotice className="mt-3" loading={rateLoading} retrying={rateFetching} onRetry={() => { void refetchRate(); }} />}
            <FieldLabel>Par</FieldLabel>
            <TileGrid>
              {MODES.map((m) => (
                <MethodTile
                  key={m.key}
                  logo={<MethodCircle method={m.rateKey} size={36} />}
                  label={m.label}
                  selected={editing.mode === m.key}
                  onClick={() => patch({ mode: m.key, picked: null, draft: { ...emptyDraft(m.key), name: editing.draft.name || ((m.key === 'alipay' || m.key === 'wechat') ? autoName() : '') }, qrFile: null })}
                />
              ))}
            </TileGrid>
            <FieldLabel right={<TextLink onClick={() => { patch({ custom: !editing.custom }); if (!editing.custom) setRateText(String(ePrice.rate || '')); }}>{editing.custom ? 'Taux du jour' : 'Taux perso'}</TextLink>}>Montant</FieldLabel>
            <label className="flex h-16 items-center gap-2 rounded-lg border-2 border-[#2C2C2C] px-4 dark:border-[#E3E3E3]">
              <span className={cn('text-[26px] font-bold', TEXT.strong)}>¥</span>
              {/* eslint-disable-next-line no-restricted-syntax -- saisie de montant en gros (!text-[…] ≥ 16 px : pas de zoom iOS) */}
              <input
                inputMode="numeric"
                aria-label="Montant en yuans"
                value={cnyText ? n0(Number(cnyText)) : ''}
                onChange={(e) => setCnyText(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
                placeholder="0"
                className={cn('min-w-0 flex-1 bg-transparent !text-[26px] font-bold tabular-nums outline-none placeholder:text-[#B3B3B3]', TEXT.strong)}
              />
              {ePrice.xaf > 0 && <span className={cn('shrink-0 text-[16px] font-semibold', TEXT.muted)}>= {n0(ePrice.xaf)} XAF</span>}
            </label>
            {editing.custom && (
              <label className={cn('mt-2 flex h-14 items-center gap-2 rounded-lg border px-4', SURFACE.field)}>
                <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>1 M XAF = ¥</span>
                {/* eslint-disable-next-line no-restricted-syntax -- saisie de montant en gros (!text-[…] ≥ 16 px : pas de zoom iOS) */}
                <input inputMode="numeric" aria-label="Taux personnalisé" value={rateText} onChange={(e) => setRateText(e.target.value.replace(/\D/g, ''))} className={cn('min-w-0 flex-1 bg-transparent !text-[17px] font-semibold tabular-nums outline-none', TEXT.strong)} />
              </label>
            )}
            <ChoiceChips<string>
              className="mt-3"
              options={[{ value: '1000', label: '¥1K' }, { value: '2500', label: '¥2,5K' }, { value: '5000', label: '¥5K' }, { value: 'rest', label: 'Restant' }]}
              value={null}
              onChange={(v) => setCnyText(v === 'rest' ? String(remainingCny() || '') : v)}
            />
            {editing.picked ? (
              <div className={cn('mt-5 flex items-center gap-3 rounded-lg border px-3.5 py-3', SURFACE.divider)}>
                <MethodCircle method={rateKeyOf(editing.mode)} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{editing.picked.alias || editing.picked.name}</span>
                  <span className={cn('block truncate text-[15px]', TEXT.muted)}>{editing.picked.identifier || editing.picked.bank_account || editing.picked.phone || 'Carnet'}</span>
                </span>
                <TextLink onClick={() => patch({ picked: null })}>Changer</TextLink>
              </div>
            ) : (
              <SupplierFields
                key={`${editing.id}-${editing.mode}`}
                mode={editing.mode}
                draft={editing.draft}
                onChange={(d) => patch({ draft: d })}
                errors={eErrors}
                showErrors={showErrors}
                clientName={client.first_name || nameOf(client)}
                qr={editing.mode === 'alipay' || editing.mode === 'wechat' ? {
                  preview: qrPreview,
                  fileName: editing.qrFile?.name,
                  onFiles: (f) => { patch({ qrFile: f[0] }); setQrPreview((old) => { if (old) URL.revokeObjectURL(old); return f[0] ? URL.createObjectURL(f[0]) : null; }); },
                  onRemove: () => { patch({ qrFile: null }); setQrPreview(null); },
                } : undefined}
              />
            )}
            {!editing.picked && !(editing.mode === 'cash' && editing.draft.isClient) && (
              <ToggleRow className="mt-3" label="Enregistrer dans son carnet" on={editing.keep} onChange={(v) => patch({ keep: v })} />
            )}
            <BigButton className="mt-5" onClick={commit} disabled={!eAmountOk}>{lines.some((x) => x.id === editing.id) ? 'Enregistrer' : 'Ajouter au lot'}</BigButton>
          </>
        )}
      </BottomSheet>

      {/* Le carnet du client */}
      <BottomSheet open={carnetSheet.open} onClose={carnetSheet.hide}>
        <h3 className={cn('mb-2 text-[22px] font-semibold', TEXT.strong)}>Son carnet</h3>
        <div>
          {(carnet ?? []).map((b) => (
            <ItemRow
              key={b.id}
              leading={<MethodCircle method={rateKeyOf(b.payment_method as BeneficiaryMode)} />}
              title={b.alias || b.name}
              subtitle={[PAYMENT_METHOD[rateKeyOf(b.payment_method as BeneficiaryMode)].label, b.identifier || b.phone || b.bank_account].filter(Boolean).join(' · ')}
              onClick={() => pickFromCarnet(b)}
            />
          ))}
        </div>
      </BottomSheet>

      {/* Créer le lot ? */}
      <ConfirmSheet
        open={verify}
        onClose={() => setVerify(false)}
        title="Créer le lot ?"
        subtitle={`${lines.length} paiement${lines.length > 1 ? 's' : ''} · ${nameOf(client)} · tout ou rien`}
        rows={[
          { label: 'Total', value: yuan(totalCny) },
          { label: 'Débité', value: `${n0(totalXaf)} XAF` },
          { label: 'Solde avant', value: `${n0(balance)} XAF` },
          { label: 'Solde après', value: `${n0(balance - totalXaf)} XAF`, tone: balance - totalXaf < 0 ? 'danger' : undefined },
        ]}
        confirmLabel="Créer le lot"
        onConfirm={create}
        loading={createBatch.isPending}
        disabled={lines.length === 0 || over}
      >
        <FieldLabel className="pt-0">Note</FieldLabel>
        <TextInput className="h-14 text-[17px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Commande d'octobre, facture…" />
      </ConfirmSheet>

      <MenuSheet
        open={more.open}
        onClose={more.hide}
        items={[
          { label: 'Changer de client', icon: UserRound, onClick: () => setPicking(true) },
          { label: 'Tous les lots', icon: Copy, onClick: () => navigate('/m/payments/batches') },
        ]}
      />
    </div>
  );
}
