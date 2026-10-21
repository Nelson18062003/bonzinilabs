/**
 * Desktop admin — « Nouveau paiement » dans une FENÊTRE, par-dessus la liste
 * des paiements (retour du 12/10/2026 : « je ne veux pas un écran à part,
 * je veux un pop-up, un mini formulaire bien soigné »).
 *
 * L'ordre est celui du geste :
 *   1. le client, son solde (et le découvert autorisé) à droite ;
 *   2. la destination (Alipay, WeChat, virement, cash) — elle fixe le taux ;
 *   3. les montants : ce que le client paie (XAF) ⇄ ce que le fournisseur
 *      reçoit (¥), l'un se calcule de l'autre au taux du jour (modifiable) ;
 *   4. le bénéficiaire : un du carnet du client, un nouveau — coordonnées
 *      saisies AVEC leur format (téléphone à indicatif, email, ID WeChat ;
 *      src/lib/beneficiaries/contact.ts) — ou « à compléter plus tard » ;
 *   5. replié : la date de l'opération (antidater).
 * Le pied résume le paiement (¥, bénéficiaire, débit, solde après) et porte
 * « Confirmer le paiement » (⌘⏎). Même couche de données et même instantané
 * (beneficiary_details) qu'avant : useAdminCreatePayment.
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toStoredPath } from '@/lib/signedUrls';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { clientCountryRate, formatCountryPct, teamPaymentFromCny, teamPaymentRate } from '@/lib/countryRates';
import { clientCountryToRateKey } from '@/components/payment-form/paymentRateLogic';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { OperationDateCard, resolveOperationDate } from '@/mobile/components/OperationDateCard';
import { useAdminClientBeneficiaries, useAdminClientBeneficiaryNames, useAdminCreateBeneficiary, type Beneficiary } from '@/hooks/useBeneficiaries';
import { getBaseRate } from '@/lib/rateCalculation';
import { MIN_PAYMENT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import type { PaymentMethodKey } from '@/types/rates';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';
import { nextSupplierName } from '@/lib/beneficiaries/defaultName';
import { draftErrors, draftPayload, emptyDraft, type BeneficiaryDraft } from '@/lib/beneficiaries/contact';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { SURFACE, TEXT, FormDialog, PrimaryPill, SoftPill, TextInput } from '@/desktop/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { ClientPickerField } from '@/desktop/components/ClientPickerField';
import { BigAmount, CheckRow, Choice, Disclosure, Section } from '@/desktop/components/formDialogParts';
import { BeneficiaryContactFields } from '@/components/payment-form/BeneficiaryContactFields';
import { DesktopPaymentsScreen } from './DesktopPaymentsScreen';
import { RateUnavailableNotice } from '@/mobile/components/payments/RateUnavailableNotice';


function fmt(n: number): string {
  return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const MODES = [
  { id: 'alipay' as PaymentMethodKey, name: 'Alipay' },
  { id: 'wechat' as PaymentMethodKey, name: 'WeChat Pay' },
  { id: 'virement' as PaymentMethodKey, name: 'Virement' },
  { id: 'cash' as PaymentMethodKey, name: 'Cash' },
] as const;
type Mode = (typeof MODES)[number];

const toDbMode = (id: PaymentMethodKey): BeneficiaryMode => (id === 'virement' ? 'bank_transfer' : (id as BeneficiaryMode));

type BenefTab = 'existing' | 'new' | 'later';

/**
 * /m/payments/new sur ordinateur : la liste des paiements, et la fenêtre par-
 * dessus. Fermer revient d'où l'on vient.
 */
export function DesktopNewPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => (location.key !== 'default' ? navigate(-1) : navigate('/m/payments'));
  return (
    <>
      <DesktopPaymentsScreen />
      <NewPaymentDialog onClose={close} onCreated={(id) => navigate(id ? `/m/payments/${id}` : '/m/payments', { replace: true })} />
    </>
  );
}

export function NewPaymentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (paymentId: string | null) => void }) {
  const { data: clients = [], isLoading: clientsLoading } = useAllClients();
  const { data: rateData, isLoading: rateLoading, isFetching: rateFetching, refetch: refetchRate } = useActiveDailyRate();
  const { data: adjustments } = useRateAdjustments();
  const createPayment = useAdminCreatePayment();
  const createBeneficiary = useAdminCreateBeneficiary();

  const { data: walletsMap = new Map<string, { balance: number; overdraft: number }>() } = useQuery({
    queryKey: ['all-wallets-for-new-payment'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('wallets').select('user_id, balance_xaf, overdraft_limit_xaf');
      if (error) throw error;
      return new Map((data ?? []).map((w) => [w.user_id, { balance: w.balance_xaf as number, overdraft: (w.overdraft_limit_xaf as number) ?? 0 }]));
    },
    staleTime: 30_000,
  });

  // ── État ────────────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [lastEdited, setLastEdited] = useState<'xaf' | 'cny'>('xaf');
  const [rawXaf, setRawXaf] = useState<number | null>(null);
  const [rawCny, setRawCny] = useState<number | null>(null);
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRate, setCustomRate] = useState<number | null>(null);
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateStr, setCustomDateStr] = useState('');

  const [benefTab, setBenefTab] = useState<BenefTab>('existing');
  const [selectedBenef, setSelectedBenef] = useState<Beneficiary | null>(null);
  const [draft, setDraft] = useState<BeneficiaryDraft>(() => emptyDraft(null));
  const [saveToCarnet, setSaveToCarnet] = useState(true);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const client = useMemo(() => clients.find((c) => c.user_id === clientId) ?? null, [clients, clientId]);
  const clientName = client ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() : '';
  const clientBalance = client ? (walletsMap.get(client.user_id)?.balance ?? 0) : 0;
  const clientOverdraft = client ? (walletsMap.get(client.user_id)?.overdraft ?? 0) : 0;
  // Ce que l'équipe peut débiter : le solde, plus le découvert autorisé par le super admin.
  const clientAvailable = clientBalance + clientOverdraft;

  // ── Taux et montants ────────────────────────────────────────────────────
  // Aucun taux « sorti de nulle part » : tant que la destination n'est pas
  // choisie (et sans taux perso), il n'y a PAS de taux ni de conversion.
  // Taux du jour de la méthode (référence Cameroun), puis celui du PAYS du
  // client s'il s'en écarte — même dérivation que « Taux par pays » et que la
  // RPC calculate_final_rate — et la TRANCHE du montant (petits paiements).
  // Pas de taux de secours (11 530 présenté comme « Taux du jour ») : sans
  // taux publié, le montant et la confirmation restent bloqués.
  const refRate = rateData && mode ? (getBaseRate(rateData, mode.id) || null) : null;
  const clientKey = client ? clientCountryToRateKey(client.country) : null;
  const baseRate =
    refRate == null
      ? null
      : lastEdited === 'cny'
        ? teamPaymentFromCny(refRate, clientKey, adjustments, rawCny ?? 0).rate
        : teamPaymentRate(refRate, clientKey, adjustments, rawXaf ?? 0);
  const countryRate = refRate != null ? clientCountryRate(refRate, clientKey, adjustments) : null;
  const smallPayment = refRate != null && baseRate !== teamPaymentRate(refRate, clientKey, adjustments, 1_000_000);
  const rateUnavailable = !!mode && refRate == null;
  const rate: number | null = rateUnavailable ? null : useCustomRate ? customRate || baseRate : baseRate;
  const hasRate = rate != null && rate > 0;
  const xaf = lastEdited === 'xaf' ? (rawXaf ?? 0) : hasRate ? Math.round(((rawCny ?? 0) * 1_000_000) / rate!) : 0;
  const cny = lastEdited === 'cny' ? (rawCny ?? 0) : hasRate ? Math.round(((rawXaf ?? 0) * rate!) / 1_000_000) : 0;

  const dbMode: BeneficiaryMode | null = mode ? toDbMode(mode.id) : null;
  const { data: clientBeneficiaries } = useAdminClientBeneficiaries(client?.user_id, dbMode ?? undefined);
  // Noms/alias tous modes confondus — numérote « Supplier NN » sans doublon.
  const { data: beneficiaryNames } = useAdminClientBeneficiaryNames(client?.user_id);
  const autoNameRef = useRef<string | null>(null);
  const prefillSupplierName = () => {
    const auto = nextSupplierName(beneficiaryNames);
    autoNameRef.current = auto;
    return auto;
  };
  // Nom auto posé avant le chargement de la liste → renuméroté, s'il est resté intact.
  useEffect(() => {
    if (!autoNameRef.current) return;
    setDraft((d) => {
      if (d.name !== autoNameRef.current) return d;
      const next = nextSupplierName(beneficiaryNames);
      if (next === d.name) return d;
      autoNameRef.current = next;
      return { ...d, name: next };
    });
  }, [beneficiaryNames]);

  // L'aperçu du QR est une URL d'objet : libérée quand on la remplace, et à la fermeture.
  const qrUrlRef = useRef<string | null>(null);
  const setQrUrl = (url: string | null) => {
    if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current);
    qrUrlRef.current = url;
    setQrPreview(url);
  };
  const setQrFromFiles = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setQrFile(file);
    setQrUrl(URL.createObjectURL(file));
  }, []);
  const removeQr = useCallback(() => {
    setQrFile(null);
    setQrUrl(null);
  }, []);
  useEffect(() => () => {
    if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current);
  }, []);

  const newDraftFor = (m: Mode | null) => {
    const d = emptyDraft(m ? toDbMode(m.id) : null);
    return m && (m.id === 'alipay' || m.id === 'wechat') ? { ...d, name: prefillSupplierName() } : d;
  };

  // Changer de destination remet le bénéficiaire à zéro (le carnet est par méthode).
  const pickMode = (m: Mode) => {
    if (mode?.id === m.id) return;
    setMode(m);
    setSelectedBenef(null);
    setDraft(benefTab === 'new' ? newDraftFor(m) : emptyDraft(toDbMode(m.id)));
    removeQr();
  };
  const openTab = (tab: BenefTab) => {
    setBenefTab(tab);
    if (tab === 'new' && !draft.name.trim() && mode) setDraft(newDraftFor(mode));
  };

  // ── Contrôles ───────────────────────────────────────────────────────────
  const amountValid = isValidXafAmount(xaf, MIN_PAYMENT_XAF);
  const hasEnoughBalance = xaf <= clientAvailable;
  const willOverdraw = xaf > 0 && xaf > clientBalance && hasEnoughBalance;
  const benefErrors = dbMode && benefTab === 'new' ? draftErrors(dbMode, draft, { hasQr: !!qrFile }) : {};
  const benefError =
    !mode || benefTab === 'later'
      ? null
      : benefTab === 'existing'
        ? selectedBenef
          ? null
          : 'Choisissez un bénéficiaire du carnet, ou créez-en un.'
        : Object.values(benefErrors)[0] ?? null;
  const firstError = !client
    ? 'Choisissez le client.'
    : !mode
      ? 'Choisissez la destination.'
      : rateUnavailable
        ? 'Taux du jour indisponible : réessayez avant de confirmer.'
      : !amountValid
        ? `Montant invalide — minimum ${fmt(MIN_PAYMENT_XAF)} XAF.`
        : !hasEnoughBalance
          ? `Solde insuffisant — disponible ${fmt(clientAvailable)} XAF.`
          : benefError;
  const dirty = !!client || !!mode || !!rawXaf || !!rawCny || !!qrFile || !!draft.name.trim();

  // ── Envoi (même instantané que l'assistant mobile) ──────────────────────
  const submit = useCallback(async () => {
    setTried(true);
    if (firstError || !client || !mode || !dbMode || rate == null || createPayment.isPending) return;
    const opDate = resolveOperationDate(useCustomDate, customDateStr);
    if (opDate.error) {
      toast.error(opDate.error);
      return;
    }

    let benefPayload: Record<string, unknown> = {};
    let beneficiaryId: string | undefined;
    let snapshot: Record<string, unknown> | undefined;

    if (benefTab === 'existing' && selectedBenef) {
      beneficiaryId = selectedBenef.id;
      snapshot = {
        id: selectedBenef.id,
        alias: selectedBenef.alias ?? selectedBenef.name,
        name: selectedBenef.name,
        payment_method: selectedBenef.payment_method,
        identifier: selectedBenef.identifier,
        identifier_type: selectedBenef.identifier_type,
        phone: selectedBenef.phone,
        email: selectedBenef.email,
        bank_name: selectedBenef.bank_name,
        bank_account: selectedBenef.bank_account,
        bank_extra: selectedBenef.bank_extra,
        relation_type: selectedBenef.relation_type,
      };
      benefPayload = {
        beneficiary_name: selectedBenef.name || undefined,
        beneficiary_phone: selectedBenef.phone || undefined,
        beneficiary_email: selectedBenef.email || undefined,
        beneficiary_bank_name: selectedBenef.bank_name || undefined,
        beneficiary_bank_account: selectedBenef.bank_account || undefined,
        beneficiary_bank_extra: selectedBenef.bank_extra || undefined,
        beneficiary_identifier: selectedBenef.identifier || undefined,
        beneficiary_identifier_type: selectedBenef.identifier_type || undefined,
        beneficiary_qr_code_url: toStoredPath(selectedBenef.qr_code_url) || undefined,
      };
    } else if (benefTab === 'new') {
      const p = draftPayload(dbMode, draft);
      const isCashSelf = dbMode === 'cash' && draft.isClient;
      const resolvedName = isCashSelf ? clientName || undefined : p.name;
      if (saveToCarnet && !isCashSelf && p.name) {
        try {
          const created = await createBeneficiary.mutateAsync({
            client_id: client.user_id,
            payment_method: dbMode,
            alias: p.name,
            name: p.name,
            identifier: p.identifier,
            identifier_type: p.identifier_type,
            phone: p.phone,
            email: p.email,
            bank_name: p.bank_name,
            bank_account: p.bank_account,
            bank_extra: p.bank_extra,
            qr_code_file: qrFile || undefined,
          });
          beneficiaryId = created.id;
        } catch {
          /* le hook l'a dit ; le paiement part quand même */
        }
      }
      snapshot = {
        relation_type: isCashSelf ? 'self' : 'other',
        name: resolvedName,
        identifier: p.identifier,
        identifier_type: p.identifier_type,
        phone: p.phone,
        email: p.email,
        bank_name: p.bank_name,
        bank_account: p.bank_account,
        bank_extra: p.bank_extra,
      };
      benefPayload = {
        beneficiary_name: resolvedName,
        beneficiary_phone: p.phone,
        beneficiary_email: p.email,
        beneficiary_bank_name: p.bank_name,
        beneficiary_bank_account: p.bank_account,
        beneficiary_bank_extra: p.bank_extra,
        beneficiary_identifier: p.identifier,
        beneficiary_identifier_type: p.identifier_type,
        qr_code_files: qrFile ? [qrFile] : undefined,
      };
    }

    try {
      const res = await createPayment.mutateAsync({
        user_id: client.user_id,
        amount_xaf: xaf,
        amount_rmb: cny,
        exchange_rate: rate,
        method: dbMode,
        rate_is_custom: useCustomRate,
        desired_date: opDate.date,
        beneficiary_id: beneficiaryId,
        beneficiary_details: snapshot,
        ...benefPayload,
      });
      onCreated(res.payment_id ?? null);
    } catch {
      /* toast géré par le hook */
    }
  }, [firstError, client, mode, dbMode, rate, createPayment, useCustomDate, customDateStr, benefTab, selectedBenef, draft, clientName, saveToCarnet, createBeneficiary, qrFile, xaf, cny, useCustomRate, onCreated]);

  const benefLabel =
    !mode
      ? null
      : benefTab === 'later'
        ? 'bénéficiaire à compléter'
        : benefTab === 'existing'
          ? selectedBenef?.alias || selectedBenef?.name || null
          : dbMode === 'cash' && draft.isClient
            ? `${clientName} (le client)`
            : draft.name.trim() || null;

  const balanceMeta = (c: { user_id: string }) => {
    const w = walletsMap.get(c.user_id);
    if (!w) return null;
    return (
      <span className="leading-tight">
        <span className={cn('block text-[11px]', TEXT.muted)}>Solde</span>
        <span className={cn('block text-[13px] font-bold tabular-nums', w.balance > 0 ? TEXT.strong : 'text-red-700 dark:text-red-400')}>{fmt(w.balance)} XAF</span>
      </span>
    );
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      onConfirm={submit}
      title="Nouveau paiement"
      subtitle="Le portefeuille du client est débité tout de suite ; un refus le rembourse."
      dirty={dirty}
      discardTitle="Abandonner ce paiement ?"
      width={680}
      footer={
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 text-[13px] leading-snug">
            {tried && firstError ? (
              <p className="font-semibold text-red-700 dark:text-red-400">{firstError}</p>
            ) : client && cny > 0 ? (
              <p className={TEXT.muted}>
                <b className={cn('tabular-nums', TEXT.strong)}>¥{fmt(cny)}</b>
                {benefLabel ? <> → <b className={TEXT.strong}>{benefLabel}</b></> : null} · débit{' '}
                <b className={cn('tabular-nums', TEXT.strong)}>{fmt(xaf)} XAF</b>
                {hasEnoughBalance && (
                  <>
                    {' '}· solde après{' '}
                    <b className={cn('tabular-nums', willOverdraw ? 'text-amber-700 dark:text-amber-400' : TEXT.strong)}>{clientBalance - xaf < 0 ? '−' : ''}{fmt(clientBalance - xaf)} XAF</b>
                  </>
                )}
              </p>
            ) : (
              <p className={TEXT.muted}>⌘⏎ pour confirmer</p>
            )}
          </div>
          <SoftPill onClick={onClose} className="h-11 shrink-0 px-5">
            Annuler
          </SoftPill>
          <PrimaryPill onClick={submit} loading={createPayment.isPending || createBeneficiary.isPending} className="h-11 shrink-0 px-6">
            Confirmer le paiement
          </PrimaryPill>
        </div>
      }
    >
      <div className="space-y-6">
        <Section label="Client" htmlFor="np-client" error={tried && !client ? 'Choisissez le client.' : null}>
          <ClientPickerField
            id="np-client"
            clients={clients}
            value={clientId}
            onChange={(c) => {
              setClientId(c.user_id);
              setSelectedBenef(null);
            }}
            loading={clientsLoading}
            invalid={tried && !client}
            autoFocus
            meta={balanceMeta}
          />
          {client && clientOverdraft > 0 && (
            <p className={cn('mt-1.5 text-[12.5px]', TEXT.muted)}>
              Découvert autorisé {fmt(clientOverdraft)} XAF · disponible <b className={cn('tabular-nums', TEXT.strong)}>{fmt(clientAvailable)} XAF</b>
            </p>
          )}
        </Section>

        <Section label="Destination" error={tried && client && !mode ? 'Choisissez la destination.' : null}>
          <div className="grid grid-cols-4 gap-2">
            {MODES.map((m) => (
              <Choice key={m.id} active={mode?.id === m.id} onClick={() => pickMode(m)} icon={<PaymentMethodLogo method={toDbMode(m.id)} size={22} />} className="justify-start">
                {m.name}
              </Choice>
            ))}
          </div>
        </Section>

        <Section label="Montant" error={tried && client && mode && !amountValid ? `Indiquez au moins ${fmt(MIN_PAYMENT_XAF)} XAF.` : null}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2.5">
            <div className="min-w-0">
              <p className={cn('mb-1.5 text-[12px] font-semibold', TEXT.muted)}>Le client paie</p>
              <BigAmount
                id="np-xaf"
                value={lastEdited === 'xaf' ? rawXaf : xaf || null}
                onChange={(v) => {
                  setLastEdited('xaf');
                  setRawXaf(v);
                }}
                currency="XAF"
                ariaLabel="Le client paie (XAF)"
                invalid={tried && !!client && !!mode && (!amountValid || !hasEnoughBalance)}
                right={
                  <button
                    type="button"
                    disabled={!client || clientAvailable <= 0}
                    onClick={() => {
                      setLastEdited('xaf');
                      setRawXaf(clientAvailable);
                    }}
                    className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-extrabold text-indigo-700 disabled:opacity-40 dark:bg-indigo-950/50 dark:text-indigo-400"
                  >
                    Max
                  </button>
                }
              />
            </div>
            <div className={cn('flex h-14 items-center', TEXT.muted)}>
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className={cn('mb-1.5 text-[12px] font-semibold', TEXT.muted)}>Le fournisseur reçoit</p>
              <BigAmount
                id="np-cny"
                value={lastEdited === 'cny' ? rawCny : cny || null}
                onChange={(v) => {
                  setLastEdited('cny');
                  setRawCny(v);
                }}
                currency="¥"
                disabled={!hasRate}
                placeholder={hasRate ? '0' : '—'}
                ariaLabel="Le fournisseur reçoit (¥)"
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>
              {!hasRate ? (
                rateUnavailable ? 'Taux du jour indisponible.' : 'Choisissez la destination : le taux du jour de la méthode s’appliquera.'
              ) : (
                <>
                  {useCustomRate
                    ? 'Taux personnalisé'
                    : countryRate
                        ? `Taux du jour ${mode?.name} · ${countryRate.label} ${formatCountryPct(countryRate.percentage)}${smallPayment ? ' · petit paiement' : ''}`
                        : `Taux du jour ${mode?.name}${smallPayment ? ' · petit paiement' : ''}`}{' '}
                  : <b className={TEXT.strong}>¥{fmt(rate!)} pour 1 000 000 XAF</b>
                  {!useCustomRate && countryRate && refRate != null && <span className="ml-1.5">· Cameroun ¥{fmt(refRate)}</span>}
                  {useCustomRate && baseRate != null && <span className="ml-1.5">· du jour ¥{fmt(baseRate)}</span>}
                </>
              )}
            </p>
            {mode && !rateUnavailable && (
              <div className="flex items-center gap-2">
                {useCustomRate && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn('text-[12px]', TEXT.muted)}>1M XAF =</span>
                    <TextInput
                      inputMode="numeric"
                      aria-label="Taux personnalisé (¥ pour 1 000 000 XAF)"
                      value={customRate ? String(customRate) : ''}
                      onChange={(e) => setCustomRate(Number(e.target.value.replace(/\D/g, '')) || null)}
                      className="h-8 w-[92px] text-center text-[13px] font-bold tabular-nums"
                    />
                    <span className={cn('text-[12px]', TEXT.muted)}>¥</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!useCustomRate) setCustomRate(baseRate);
                    setUseCustomRate((v) => !v);
                  }}
                  className="text-[12.5px] font-bold text-indigo-700 hover:underline dark:text-indigo-400"
                >
                  {useCustomRate ? 'Revenir au taux du jour' : 'Modifier le taux'}
                </button>
              </div>
            )}
          </div>
          {rateUnavailable && (
            <RateUnavailableNotice className="mt-2" loading={rateLoading} retrying={rateFetching} onRetry={() => { void refetchRate(); }} />
          )}
          {xaf > 0 && client && !hasEnoughBalance && (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Solde insuffisant — disponible : {fmt(clientAvailable)} XAF{clientOverdraft > 0 ? ' (découvert compris)' : ''}.
            </p>
          )}
          {willOverdraw && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              Le client passe en découvert : solde après paiement −{fmt(xaf - clientBalance)} XAF.
            </p>
          )}
        </Section>

        {mode && dbMode && (
          <Section label="Bénéficiaire" error={tried && benefTab === 'existing' ? benefError : null}>
            <div role="tablist" aria-label="Bénéficiaire" className="mb-3 inline-flex rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.08]">
              {(
                [
                  ['existing', `Carnet${clientBeneficiaries ? ` (${clientBeneficiaries.length})` : ''}`],
                  ['new', 'Nouveau'],
                  ['later', 'Plus tard'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={benefTab === tab}
                  onClick={() => openTab(tab)}
                  className={cn(
                    'rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition',
                    benefTab === tab ? cn(SURFACE.card, TEXT.strong, 'shadow-sm') : cn(TEXT.muted, 'hover:text-foreground'),
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {benefTab === 'existing' &&
              (!client ? (
                <p className={cn('text-[13px]', TEXT.muted)}>Choisissez d’abord le client : son carnet s’affichera ici.</p>
              ) : !clientBeneficiaries || clientBeneficiaries.length === 0 ? (
                <div className={cn('rounded-2xl px-4 py-3.5 text-[13px]', SURFACE.canvas)}>
                  <p className={TEXT.muted}>Aucun bénéficiaire {mode.name} dans le carnet de {client.first_name}.</p>
                  <button type="button" onClick={() => openTab('new')} className="mt-1 text-[13px] font-bold text-indigo-700 hover:underline dark:text-indigo-400">
                    + Nouveau bénéficiaire
                  </button>
                </div>
              ) : (
                <ul className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                  {clientBeneficiaries.map((b) => {
                    const sel = selectedBenef?.id === b.id;
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          aria-pressed={sel}
                          onClick={() => setSelectedBenef(sel ? null : b)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                            sel ? 'bg-foreground text-background' : cn(SURFACE.card, 'ring-1 ring-black/[0.10] hover:ring-black/25 dark:ring-white/[0.12]'),
                          )}
                        >
                          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold', sel ? 'bg-background/15' : SURFACE.holder)}>
                            {(b.alias || b.name)[0]?.toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-[13.5px] font-bold">{b.alias || b.name}</span>
                            <span className={cn('block truncate text-[12px] tabular-nums', sel ? 'opacity-75' : TEXT.muted)}>
                              {[b.alias && b.alias !== b.name ? b.name : null, b.identifier, b.phone, b.email, b.bank_name, b.bank_account].filter(Boolean).join(' · ') || '—'}
                            </span>
                          </span>
                          {sel && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}

            {benefTab === 'new' && (
              <div className="space-y-4">
                <BeneficiaryContactFields
                  mode={dbMode}
                  draft={draft}
                  onChange={setDraft}
                  errors={benefErrors}
                  showErrors={tried}
                  compact
                  idPrefix="np"
                  clientName={clientName}
                  qr={dbMode === 'alipay' || dbMode === 'wechat' ? { preview: qrPreview, onFiles: setQrFromFiles, onRemove: removeQr, pasteEnabled: true } : undefined}
                />
                {!(dbMode === 'cash' && draft.isClient) && (
                  <CheckRow
                    checked={saveToCarnet}
                    onChange={setSaveToCarnet}
                    title="Enregistrer dans le carnet du client"
                    hint="Il sera proposé au prochain paiement."
                  />
                )}
              </div>
            )}

            {benefTab === 'later' && (
              <p className={cn('rounded-2xl px-4 py-3 text-[13px]', SURFACE.canvas, TEXT.muted)}>
                Le paiement sera créé en « Info manquante » : vous compléterez les coordonnées sur sa fiche.
              </p>
            )}
          </Section>
        )}

        <Disclosure title="Plus d’options" summary={useCustomDate ? 'date antidatée' : 'date de l’opération'}>
          <OperationDateCard
            enabled={useCustomDate}
            value={customDateStr}
            onToggle={(on, nowLocal) => {
              setUseCustomDate(on);
              if (on && !customDateStr) setCustomDateStr(nowLocal);
            }}
            onChange={setCustomDateStr}
            accent="#8B5CF6"
          />
        </Disclosure>
      </div>
    </FormDialog>
  );
}
