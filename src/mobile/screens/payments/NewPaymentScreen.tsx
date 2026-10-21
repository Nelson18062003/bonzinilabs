/**
 * Nouveau paiement, v2 (maquettes validées index.html écrans 2, 3, 4 et
 * 10-complements/07) — trois écrans :
 *   1/3 Quel client ? (recherche, récents, tous les clients et leur solde)
 *   2/3 Combien ? (gros clavier, ¥ RMB ou XAF, la conversion au taux du jour)
 *   3/3 Quel fournisseur ? (son carnet, ou « Nouveau fournisseur »), puis la
 *       feuille « Payer ¥ 7 493 ? » (Client · Débité · Solde après).
 * Rare, dans « … » : taux personnalisé, date de l'opération (antidater),
 * fournisseur plus tard.
 *
 * Le moyen (Alipay, WeChat, virement, cash) vient du fournisseur choisi :
 * le taux de l'étape 2 est celui du moyen le plus probable (le dernier
 * fournisseur du client), puis la feuille de confirmation recalcule au taux
 * du moyen réel, avec le pays du client et la tranche du montant — même
 * règle que l'assistant v1 (teamPaymentRate / teamPaymentFromCny).
 * Création : useAdminCreatePayment (create_admin_payment), carnet :
 * useAdminCreateBeneficiary — repris tels quels de MobileNewPayment.
 */
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Clock3, Percent, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { useAdminClientBeneficiaries, useAdminClientBeneficiaryNames, useAdminCreateBeneficiary, type Beneficiary } from '@/hooks/useBeneficiaries';
import { clientCountryToRateKey } from '@/components/payment-form/paymentRateLogic';
import { teamPaymentFromCny, teamPaymentRate } from '@/lib/countryRates';
import { getBaseRate } from '@/lib/rateCalculation';
import { MIN_PAYMENT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import { toStoredPath } from '@/lib/signedUrls';
import { nextSupplierName } from '@/lib/beneficiaries/defaultName';
import { draftErrors, draftPayload, emptyDraft, type BeneficiaryDraft } from '@/lib/beneficiaries/contact';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';
import type { PaymentMethodKey } from '@/types/rates';
import { cn } from '@/lib/utils';
import {
  AmountDisplay, BigButton, BottomSheet, ConfirmSheet, Dock, EmptyLine, IconCircle, Initials, ItemList, ItemRow, Keypad, MethodCircle,
  MoreButton, PAYMENT_METHOD, ScreenTop, SuccessView, TEXT, WhoCard, applyKey, formatPad, padValue, useSheet, type PadKey,
} from '@/mobile/designKit';
import { OperationDateCard, resolveOperationDate } from '@/mobile/components/OperationDateCard';
import { RateUnavailableNotice } from '@/mobile/components/payments/RateUnavailableNotice';
import { ClientPicker, type PickedClient } from '@/mobile/screens/operations/ClientPicker';
import { FieldLabel, MenuSheet, MethodTile, TileGrid, ToggleRow } from '@/mobile/screens/operations/parts';
import { n0, yuan } from '@/mobile/screens/operations/opsLabels';
import { useWalletsMap } from '@/mobile/screens/operations/opsQueries';
import { SupplierFields } from './SupplierFields';

type Step = 1 | 2 | 3 | 'new';
type Unit = 'cny' | 'xaf';

const MODES: { key: BeneficiaryMode; label: string; rateKey: PaymentMethodKey }[] = [
  { key: 'alipay', label: 'Alipay', rateKey: 'alipay' },
  { key: 'wechat', label: 'WeChat', rateKey: 'wechat' },
  { key: 'bank_transfer', label: 'Virement', rateKey: 'virement' },
  { key: 'cash', label: 'Cash', rateKey: 'cash' },
];
const rateKeyOf = (m: BeneficiaryMode): PaymentMethodKey => MODES.find((x) => x.key === m)?.rateKey ?? 'alipay';
const nameOf = (c: { first_name?: string | null; last_name?: string | null } | null) => (c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '') || 'Client';

export function NewPaymentScreen() {
  const navigate = useNavigate();
  const { data: rateData, isLoading: rateLoading, isFetching: rateFetching, refetch: refetchRate } = useActiveDailyRate();
  const { data: adjustments } = useRateAdjustments();
  const { data: wallets } = useWalletsMap();
  const createPayment = useAdminCreatePayment();
  const createBeneficiary = useAdminCreateBeneficiary();

  const [step, setStep] = useState<Step>(1);
  const [client, setClient] = useState<PickedClient | null>(null);
  const [unit, setUnit] = useState<Unit>('cny');
  const [raw, setRaw] = useState('');
  const [customRate, setCustomRate] = useState<number | null>(null);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [rateSheet, setRateSheet] = useState(false);
  const [rateText, setRateText] = useState('');
  const [dateSheet, setDateSheet] = useState(false);
  const [later, setLater] = useState(false);
  const [laterSheet, setLaterSheet] = useState(false);
  const more = useSheet();

  // Fournisseur
  const [picked, setPicked] = useState<Beneficiary | null>(null);
  const [mode, setMode] = useState<BeneficiaryMode>('alipay');
  const [draft, setDraft] = useState<BeneficiaryDraft>(() => emptyDraft('alipay'));
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [keep, setKeep] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const carnetIdRef = useRef<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState<{ id: string; cny: number; xaf: number; instruction: boolean } | null>(null);

  const { data: carnet } = useAdminClientBeneficiaries(client?.user_id);
  const { data: carnetNames } = useAdminClientBeneficiaryNames(client?.user_id);

  // ── Le prix ───────────────────────────────────────────────────────────
  const clientKey = client ? clientCountryToRateKey((client as { country?: string | null }).country) : null;
  const balance = client ? wallets?.get(client.user_id)?.balance ?? 0 : 0;
  const overdraft = client ? wallets?.get(client.user_id)?.overdraft ?? 0 : 0;
  const available = balance + overdraft;
  const amount = Math.round(padValue(raw));
  const price = useCallback((m: BeneficiaryMode) => {
    const ref = rateData ? getBaseRate(rateData, rateKeyOf(m)) || 0 : 0;
    const published = ref > 0;
    const fromCny = published && unit === 'cny' ? teamPaymentFromCny(ref, clientKey, adjustments, amount) : null;
    const base = !published ? ref : fromCny ? fromCny.rate : teamPaymentRate(ref, clientKey, adjustments, amount);
    const rate = customRate && customRate > 0 ? customRate : base;
    const xaf = rate > 0 ? (unit === 'xaf' ? amount : Math.round((amount * 1_000_000) / rate)) : 0;
    const cny = rate > 0 ? (unit === 'xaf' ? Math.round((amount * rate) / 1_000_000) : amount) : 0;
    return { published, rate, xaf, cny };
  }, [rateData, unit, clientKey, adjustments, amount, customRate]);

  // Le moyen probable à l'étape 2 : celui du dernier fournisseur du client.
  const guess: BeneficiaryMode = (carnet?.[0]?.payment_method as BeneficiaryMode | undefined) ?? 'alipay';
  const finalMode: BeneficiaryMode = picked ? (picked.payment_method as BeneficiaryMode) : mode;
  const est = price(step === 2 || step === 1 ? guess : finalMode);
  const fin = price(finalMode);
  const amountOk = isValidXafAmount(est.xaf, MIN_PAYMENT_XAF);
  const enough = est.xaf <= available;

  // ── Fournisseur nouveau ───────────────────────────────────────────────
  const errors = later ? {} : draftErrors(finalMode, draft, { hasQr: !!qrFile });
  const firstError = Object.values(errors)[0] ?? null;

  const resetSupplier = (m: BeneficiaryMode) => {
    setMode(m);
    setDraft((d) => {
      const fresh = emptyDraft(m);
      // Le nom (requis) est prérempli « Supplier NN » en Alipay / WeChat, comme en v1.
      if ((m === 'alipay' || m === 'wechat') && !d.name.trim()) fresh.name = nextSupplierName(carnetNames);
      else fresh.name = d.name;
      return fresh;
    });
    setQrFile(null);
    setQrPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
    carnetIdRef.current = null;
    setShowErrors(false);
  };
  const setQrFromFiles = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setQrFile(f);
    setQrPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
  };

  const pickClient = (c: PickedClient) => {
    if (c.user_id !== client?.user_id) { setPicked(null); carnetIdRef.current = null; }
    setClient(c);
    setStep(2);
  };

  const reset = () => {
    setDone(null); setStep(1); setClient(null); setUnit('cny'); setRaw(''); setCustomRate(null); setCustomDate(null);
    setLater(false); setPicked(null); setDraft(emptyDraft('alipay')); setMode('alipay'); setQrFile(null); setQrPreview(null);
    setKeep(true); setShowErrors(false); carnetIdRef.current = null;
  };

  const goBack = () => {
    if (step === 1) navigate(-1);
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else setStep(3);
  };

  // ── La création ───────────────────────────────────────────────────────
  const create = async () => {
    if (!client) return;
    const m = finalMode;
    const { published, rate, xaf, cny } = fin;
    if (!published || !(rate > 0)) { toast.error('Taux du jour indisponible : le paiement attend le taux publié.'); return; }
    if (!isValidXafAmount(xaf, MIN_PAYMENT_XAF) || !Number.isSafeInteger(xaf)) { toast.error('Montant invalide.'); return; }
    if (xaf > available) { toast.error('Solde insuffisant pour ce paiement.'); return; }
    const opDate = resolveOperationDate(!!customDate, customDate ?? '');
    if (opDate.error) { toast.error(opDate.error); return; }

    let benefPayload: Record<string, unknown> = {};
    let beneficiaryId: string | undefined;
    let snapshot: Record<string, unknown> | undefined;
    if (!later && picked) {
      beneficiaryId = picked.id;
      snapshot = {
        id: picked.id, alias: picked.alias ?? picked.name, name: picked.name, payment_method: picked.payment_method, identifier: picked.identifier,
        identifier_type: picked.identifier_type, phone: picked.phone, email: picked.email, bank_name: picked.bank_name, bank_account: picked.bank_account,
        bank_extra: picked.bank_extra, relation_type: picked.relation_type,
      };
      benefPayload = {
        beneficiary_name: picked.name || undefined, beneficiary_phone: picked.phone || undefined, beneficiary_email: picked.email || undefined,
        beneficiary_bank_name: picked.bank_name || undefined, beneficiary_bank_account: picked.bank_account || undefined, beneficiary_bank_extra: picked.bank_extra || undefined,
        beneficiary_identifier: picked.identifier || undefined, beneficiary_identifier_type: picked.identifier_type || undefined,
        beneficiary_qr_code_url: toStoredPath(picked.qr_code_url) || undefined,
      };
    } else if (!later) {
      const p = draftPayload(m, draft);
      const cashSelf = m === 'cash' && draft.isClient;
      const resolvedName = cashSelf ? nameOf(client) : p.name;
      if (carnetIdRef.current) beneficiaryId = carnetIdRef.current;
      else if (keep && !cashSelf && p.name) {
        try {
          const created = await createBeneficiary.mutateAsync({
            client_id: client.user_id, payment_method: m, alias: p.name, name: p.name, identifier: p.identifier, identifier_type: p.identifier_type,
            phone: p.phone, email: p.email, bank_name: p.bank_name, bank_account: p.bank_account, bank_extra: p.bank_extra, qr_code_file: qrFile || undefined,
          });
          beneficiaryId = created.id;
          carnetIdRef.current = created.id;
        } catch { /* le hook prévient ; le paiement part quand même */ }
      }
      snapshot = {
        relation_type: cashSelf ? 'self' : 'other', name: resolvedName, identifier: p.identifier, identifier_type: p.identifier_type,
        phone: p.phone, email: p.email, bank_name: p.bank_name, bank_account: p.bank_account, bank_extra: p.bank_extra,
      };
      benefPayload = {
        beneficiary_name: resolvedName, beneficiary_phone: p.phone, beneficiary_email: p.email, beneficiary_bank_name: p.bank_name,
        beneficiary_bank_account: p.bank_account, beneficiary_bank_extra: p.bank_extra, beneficiary_identifier: p.identifier,
        beneficiary_identifier_type: p.identifier_type, qr_code_files: qrFile ? [qrFile] : undefined,
      };
    }

    try {
      const res = await createPayment.mutateAsync({
        user_id: client.user_id, amount_xaf: xaf, amount_rmb: cny, exchange_rate: rate, method: m,
        rate_is_custom: !!customRate, desired_date: opDate.date, beneficiary_id: beneficiaryId, beneficiary_details: snapshot, ...benefPayload,
      });
      setConfirmOpen(false);
      setDone({ id: res.payment_id ?? '', cny, xaf, instruction: m !== 'cash' && !later });
    } catch { /* toast par le hook */ }
  };

  const supplierLabel = later ? 'Plus tard'
    : picked ? (picked.alias || picked.name)
    : finalMode === 'cash' && draft.isClient ? nameOf(client) : (draft.name.trim() || 'Fournisseur');
  const methodName = PAYMENT_METHOD[MODES.find((x) => x.key === finalMode)?.rateKey ?? 'alipay'].label;

  // ── Succès ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex min-h-full flex-col">
        <SuccessView
          title="Paiement créé"
          subtitle={<>{yuan(done.cny)} · {n0(done.xaf)} XAF<br />{nameOf(client)}{later ? '' : ` → ${supplierLabel}`}</>}
          primary={done.instruction && done.id
            ? { label: "Envoyer l'instruction", onClick: () => navigate(`/m/payments/${done.id}?instruction=1`) }
            : { label: 'Voir le paiement', onClick: () => navigate(`/m/payments/${done.id}`) }}
          secondary={done.instruction ? { label: 'Voir le paiement', onClick: () => navigate(`/m/payments/${done.id}`) } : { label: 'Nouveau paiement', onClick: reset }}
        />
      </div>
    );
  }

  const confirmRows = [
    { label: 'Client', value: nameOf(client) },
    { label: 'Débité', value: `${n0(fin.xaf)} XAF` },
    { label: 'Solde après', value: `${n0(balance - fin.xaf)} XAF`, tone: balance - fin.xaf < 0 ? ('danger' as const) : undefined },
    ...(customRate ? [{ label: 'Taux', value: `¥ ${n0(fin.rate)} · perso` }] : []),
    ...(customDate ? [{ label: 'Date', value: new Date(customDate).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }] : []),
  ];
  const finOk = fin.published && isValidXafAmount(fin.xaf, MIN_PAYMENT_XAF) && fin.xaf <= available;

  const stepLabel = step === 'new' ? '3/3' : `${step}/3`;
  const title = step === 'new' ? 'Nouveau fournisseur' : 'Nouveau paiement';

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop
        title={title}
        onBack={goBack}
        step={stepLabel}
        right={step === 2 || step === 3 ? <MoreButton onClick={more.show} /> : undefined}
      />

      {step === 1 && <ClientPicker onPick={pickClient} balances={wallets} selectedId={client?.user_id} />}

      {step === 2 && client && (
        <div className="flex flex-1 flex-col">
          <div className="px-5 pt-4">
            <WhoCard leading={<Initials name={nameOf(client)} />} name={nameOf(client)} line={`Solde ${n0(balance)} XAF${overdraft > 0 ? ` · découvert ${n0(overdraft)}` : ''}`} onClick={() => setStep(1)} />
          </div>
          {!est.published && (
            <RateUnavailableNotice className="mx-5 mt-3" loading={rateLoading} retrying={rateFetching} onRetry={() => { void refetchRate(); }} />
          )}
          <AmountDisplay
            value={formatPad(raw)}
            prefix={unit === 'cny' ? '¥' : undefined}
            suffix={unit === 'xaf' ? 'XAF' : undefined}
            units={[{ value: 'cny', label: '¥ RMB' }, { value: 'xaf', label: 'XAF' }]}
            unit={unit}
            onUnit={(u) => { setUnit(u as Unit); setRaw(''); }}
            conversion={amount > 0 && est.rate > 0 ? (unit === 'cny' ? <>= {n0(est.xaf)} XAF</> : <>= {yuan(est.cny)}</>) : ' '}
            note={est.rate > 0 ? <>{customRate ? 'Taux perso' : 'Taux du jour'} · 1 000 000 XAF = ¥ {n0(est.rate)}{customDate ? ' · antidaté' : ''}</> : undefined}
          />
          {amount > 0 && !enough && (
            <p className="mt-2 px-5 text-center text-[16px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">Solde insuffisant · disponible {n0(available)} XAF</p>
          )}
          <div className="mt-auto pt-4">
            <Keypad onKey={(k: PadKey) => setRaw((r) => applyKey(r, k, 0, 10))} />
          </div>
          <Dock>
            <BigButton onClick={() => setStep(3)} disabled={!est.published || !amountOk || !enough}>Continuer</BigButton>
          </Dock>
        </div>
      )}

      {step === 3 && client && (
        <div className="pb-6">
          <FieldLabel className="px-5 pt-5">Fournisseurs de {client.first_name || nameOf(client)}</FieldLabel>
          <ItemList>
            {(carnet ?? []).map((b) => {
              const m = PAYMENT_METHOD[rateKeyOf(b.payment_method as BeneficiaryMode)];
              const line = [m.label, b.identifier || b.phone || (b.bank_name && b.bank_account ? `${b.bank_name} ${b.bank_account}` : b.bank_account) || b.email].filter(Boolean).join(' · ');
              return (
                <ItemRow
                  key={b.id}
                  leading={<MethodCircle method={rateKeyOf(b.payment_method as BeneficiaryMode)} />}
                  title={b.alias || b.name}
                  subtitle={line}
                  onClick={() => { setPicked(b); setLater(false); setConfirmOpen(true); }}
                />
              );
            })}
            <ItemRow
              leading={<IconCircle icon={Plus} />}
              title="Nouveau fournisseur"
              subtitle="QR, compte ou cash"
              onClick={() => { setPicked(null); setLater(false); resetSupplier(guess); setStep('new'); }}
            />
          </ItemList>
          {(carnet ?? []).length === 0 && <EmptyLine>{client.first_name || 'Ce client'} n'a pas encore de fournisseur.</EmptyLine>}
        </div>
      )}

      {step === 'new' && client && (
        <div className="px-5 pb-6 pt-4">
          <WhoCard leading={<Initials name={nameOf(client)} />} name={<>{yuan(fin.cny)} · {nameOf(client)}</>} line={`${n0(fin.xaf)} XAF`} />
          <FieldLabel>Par</FieldLabel>
          <TileGrid>
            {MODES.map((m) => (
              <MethodTile key={m.key} logo={<MethodCircle method={m.rateKey} size={36} />} label={m.label} selected={mode === m.key} onClick={() => resetSupplier(m.key)} />
            ))}
          </TileGrid>
          <SupplierFields
            key={mode}
            mode={mode}
            draft={draft}
            onChange={setDraft}
            errors={errors}
            showErrors={showErrors}
            clientName={client.first_name || nameOf(client)}
            qr={mode === 'alipay' || mode === 'wechat' ? { preview: qrPreview, fileName: qrFile?.name, onFiles: setQrFromFiles, onRemove: () => { setQrFile(null); setQrPreview(null); } } : undefined}
          />
          {!(mode === 'cash' && draft.isClient) && <ToggleRow className="mt-4" label="Garder dans ses fournisseurs" on={keep} onChange={setKeep} />}
          <Dock>
            <BigButton onClick={() => { if (firstError) { setShowErrors(true); toast.error(firstError); return; } setConfirmOpen(true); }}>Continuer</BigButton>
          </Dock>
        </div>
      )}

      {/* Payer ¥ 7 493 ? */}
      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={<>Payer {yuan(fin.cny)} ?</>}
        subtitle={later ? <>Fournisseur plus tard, par {methodName}</> : <>à {supplierLabel}, par {methodName}</>}
        rows={confirmRows}
        confirmLabel="Créer le paiement"
        onConfirm={() => void create()}
        loading={createPayment.isPending || createBeneficiary.isPending}
        disabled={!finOk}
      >
        {!fin.published && <RateUnavailableNotice loading={rateLoading} retrying={rateFetching} onRetry={() => { void refetchRate(); }} />}
        {fin.published && fin.xaf > available && <p className="text-[16px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">Solde insuffisant · disponible {n0(available)} XAF</p>}
        {fin.published && fin.xaf <= available && fin.xaf > balance && <p className="text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">Passe en découvert</p>}
      </ConfirmSheet>

      {/* « … » */}
      <MenuSheet
        open={more.open}
        onClose={more.hide}
        items={[
          { label: 'Taux personnalisé', icon: Percent, hint: customRate ? `¥ ${n0(customRate)}` : undefined, onClick: () => { setRateText(customRate ? String(customRate) : String(est.rate || '')); setRateSheet(true); } },
          { label: "Date de l'opération", icon: CalendarClock, hint: customDate ? 'antidatée' : undefined, onClick: () => setDateSheet(true) },
          { label: 'Fournisseur plus tard', icon: Clock3, onClick: () => { setPicked(null); setLater(true); setStep(3); setLaterSheet(true); }, hidden: step !== 3 },
        ]}
      />

      <BottomSheet open={rateSheet} onClose={() => setRateSheet(false)}>
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Taux personnalisé</h3>
        <FieldLabel>1 000 000 XAF = ¥</FieldLabel>
        <input
          autoFocus
          inputMode="numeric"
          aria-label="Taux personnalisé"
          value={rateText}
          onChange={(e) => setRateText(e.target.value.replace(/\D/g, ''))}
          className={cn('h-14 w-full rounded-lg border-2 border-[#2C2C2C] bg-transparent px-4 !text-[26px] font-bold tabular-nums outline-none dark:border-[#E3E3E3]', TEXT.strong)}
        />
        <div className="mt-5 flex flex-col gap-2.5">
          <BigButton onClick={() => { const v = Number(rateText); setCustomRate(v > 0 ? v : null); setRateSheet(false); }} disabled={!(Number(rateText) > 0)}>Appliquer</BigButton>
          {customRate != null && <BigButton variant="soft" onClick={() => { setCustomRate(null); setRateSheet(false); }}>Taux du jour</BigButton>}
        </div>
      </BottomSheet>

      <BottomSheet open={dateSheet} onClose={() => setDateSheet(false)}>
        <h3 className={cn('mb-4 text-[22px] font-semibold', TEXT.strong)}>Date de l'opération</h3>
        <OperationDateCard
          enabled={!!customDate}
          value={customDate ?? ''}
          onToggle={(on, nowLocal) => setCustomDate(on ? (customDate || nowLocal) : null)}
          onChange={(v) => setCustomDate(v)}
          accent="#2C2C2C"
        />
        <BigButton className="mt-5" onClick={() => setDateSheet(false)}>OK</BigButton>
      </BottomSheet>

      <LaterSheet
        open={laterSheet}
        onClose={() => setLaterSheet(false)}
        mode={mode}
        onPick={(m) => { setMode(m); setLaterSheet(false); setConfirmOpen(true); }}
      />
    </div>
  );
}

/** « Fournisseur plus tard » : il faut seulement le moyen. */
function LaterSheet({ open, onClose, mode, onPick }: { open: boolean; onClose: () => void; mode: BeneficiaryMode; onPick: (m: BeneficiaryMode) => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Fournisseur plus tard</h3>
      <FieldLabel>Par</FieldLabel>
      <TileGrid>
        {MODES.map((m) => (
          <MethodTile key={m.key} logo={<MethodCircle method={m.rateKey} size={36} />} label={m.label} selected={mode === m.key} onClick={() => onPick(m.key)} />
        ))}
      </TileGrid>
    </BottomSheet>
  );
}
