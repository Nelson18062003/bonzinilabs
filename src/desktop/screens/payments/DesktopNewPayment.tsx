/**
 * Desktop admin — « Nouveau paiement » as ONE page (archetype surface C, §4).
 *
 * Replaces the 5-step phone wizard on desktop: client + both currency legs
 * side-by-side with live conversion, custom rate and backdating inline, the
 * client's carnet facing the new-beneficiary fields, QR paste zone, and a
 * live recap rail with the balance after debit. Same data layer and submit
 * logic as MobileNewPayment (useAdminCreatePayment + frozen snapshot).
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toStoredPath } from '@/lib/signedUrls';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { OperationDateCard, resolveOperationDate } from '@/mobile/components/OperationDateCard';
import { useAdminClientBeneficiaries, useAdminCreateBeneficiary, type Beneficiary } from '@/hooks/useBeneficiaries';
import { getBaseRate } from '@/lib/rateCalculation';
import { MAX_AMOUNT_XAF_LABEL, MIN_PAYMENT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import type { PaymentMethodKey } from '@/types/rates';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';
import { nextSupplierName } from '@/lib/beneficiaries/defaultName';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronRight, Info, Wallet, X } from 'lucide-react';
import {
  SURFACE,
  TEXT,
  SOFT_PILL,
  PRIMARY_PILL,
  Card,
  Avatar,
  TextInput,
  FormField,
  PrimaryPill,
  SoftPill,
  Amount,
  SecLabel,
  SearchField,
} from '@/desktop/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { ACCEPT_IMAGE } from '@/lib/clipboardFiles';

const VIOLET = '#8B5CF6';
const FALLBACK_RATE = 11530;

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

function logoMethod(id: PaymentMethodKey): 'alipay' | 'wechat' | 'bank_transfer' | 'cash' {
  return id === 'virement' ? 'bank_transfer' : id;
}

interface Benef {
  name: string;
  ident: string;
  phone: string;
  email: string;
  bank: string;
  account: string;
  isClient: boolean;
}
const BENEF0: Benef = { name: '', ident: '', phone: '', email: '', bank: '', account: '', isClient: false };

export function DesktopNewPayment() {
  const navigate = useNavigate();

  const { data: clients = [] } = useAllClients();
  const { data: rateData } = useActiveDailyRate();
  const createPayment = useAdminCreatePayment();
  const createBeneficiary = useAdminCreateBeneficiary();

  const { data: walletsMap = new Map<string, number>() } = useQuery({
    queryKey: ['all-wallets-for-new-payment'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('wallets').select('user_id, balance_xaf');
      if (error) throw error;
      return new Map((data ?? []).map((w) => [w.user_id, w.balance_xaf as number]));
    },
    staleTime: 30_000,
  });

  // ── Form state ──────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const clientRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode | null>(null);
  const [lastEdited, setLastEdited] = useState<'xaf' | 'cny'>('xaf');
  const [rawXaf, setRawXaf] = useState('');
  const [rawCny, setRawCny] = useState('');
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRateStr, setCustomRateStr] = useState(String(FALLBACK_RATE));
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateStr, setCustomDateStr] = useState('');

  const [benefTab, setBenefTab] = useState<'existing' | 'new'>('existing');
  const [selectedBenef, setSelectedBenef] = useState<Beneficiary | null>(null);
  const [benef, setBenef] = useState<Benef>(BENEF0);
  const [skipBenef, setSkipBenef] = useState(false);
  const [saveToCarnet, setSaveToCarnet] = useState(true);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const client = useMemo(() => clients.find((c) => c.user_id === clientId) ?? null, [clients, clientId]);
  const clientBalance = client ? (walletsMap.get(client.user_id) ?? 0) : 0;

  useEffect(() => {
    if (!clientOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!clientRef.current?.contains(e.target as Node)) setClientOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [clientOpen]);

  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    const list = s
      ? clients.filter((c) => `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase().includes(s) || (c.phone ?? '').includes(s))
      : clients;
    return list.slice(0, 8);
  }, [clients, clientSearch]);

  // ── Money math ──────────────────────────────────────────────────────────
  // Aucun taux « sorti de nulle part » : tant que la destination n'est pas
  // choisie (et sans taux perso), il n'y a PAS de taux ni de conversion.
  const baseRate = rateData && mode ? getBaseRate(rateData, mode.id) : null;
  const fallbackActive = !!mode && !useCustomRate && baseRate == null;
  const rate: number | null = useCustomRate ? parseInt(customRateStr) || FALLBACK_RATE : (baseRate ?? (mode ? FALLBACK_RATE : null));
  const hasRate = rate != null && rate > 0;
  const xaf = lastEdited === 'xaf' ? parseInt(rawXaf) || 0 : hasRate ? Math.round(((parseInt(rawCny) || 0) * 1_000_000) / rate!) : 0;
  const cny = lastEdited === 'cny' ? parseInt(rawCny) || 0 : hasRate ? Math.round(((parseInt(rawXaf) || 0) * rate!) / 1_000_000) : 0;

  const dbMode: BeneficiaryMode | null = mode ? (mode.id === 'virement' ? 'bank_transfer' : (mode.id as BeneficiaryMode)) : null;
  const { data: clientBeneficiaries } = useAdminClientBeneficiaries(client?.user_id, dbMode ?? undefined);
  // Tous modes confondus — numérote le nom par défaut « Supplier NN » sans
  // dupliquer un numéro déjà pris sur un autre mode.
  const { data: allClientBeneficiaries } = useAdminClientBeneficiaries(client?.user_id);

  // Sur « Nouveau » en Alipay/WeChat, le nom (requis) est prérempli
  // « Supplier NN » — l'admin peut le remplacer librement.
  const openBenefTab = (tab: 'existing' | 'new') => {
    setBenefTab(tab);
    if (tab === 'new' && (mode?.id === 'alipay' || mode?.id === 'wechat') && !benef.name.trim()) {
      setBenef((b) => ({ ...b, name: nextSupplierName(allClientBeneficiaries) }));
    }
  };

  const setQrFromFiles = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setQrFile(file);
    setQrPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }, []);
  const removeQr = useCallback(() => {
    setQrFile(null);
    setQrPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  // Changing mode resets destination choices (the carnet is per-mode).
  const pickMode = (m: Mode) => {
    setMode(m);
    setSelectedBenef(null);
    setBenef(
      benefTab === 'new' && (m.id === 'alipay' || m.id === 'wechat')
        ? { ...BENEF0, name: nextSupplierName(allClientBeneficiaries) }
        : BENEF0,
    );
    removeQr();
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const amountValid = isValidXafAmount(xaf, MIN_PAYMENT_XAF);
  const hasEnoughBalance = xaf <= clientBalance;
  const benefValid = skipBenef
    ? true
    : benefTab === 'existing'
      ? !!selectedBenef
      : mode?.id === 'cash' && benef.isClient
        ? true
        : benef.name.trim().length > 0 && (mode?.id !== 'virement' || (benef.bank.trim().length > 0 && benef.account.trim().length > 0));
  const canSubmit = !!client && !!mode && amountValid && hasEnoughBalance && benefValid && !createPayment.isPending;

  // ── Submit (same snapshot semantics as the wizard) ──────────────────────
  const submit = useCallback(async () => {
    if (!client || !mode || !dbMode || rate == null) return;
    if (!amountValid || !hasEnoughBalance) {
      toast.error(amountValid ? 'Solde insuffisant pour ce paiement.' : `Montant invalide — maximum ${MAX_AMOUNT_XAF_LABEL} XAF.`);
      return;
    }
    const opDate = resolveOperationDate(useCustomDate, customDateStr);
    if (opDate.error) {
      toast.error(opDate.error);
      return;
    }

    const autoName = mode.id === 'cash' && benef.isClient ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() : undefined;
    let benefPayload: Record<string, unknown> = {};
    let beneficiaryId: string | undefined;
    let snapshot: Record<string, unknown> | undefined;

    if (!skipBenef) {
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
      } else {
        const isCashSelf = mode.id === 'cash' && benef.isClient;
        const resolvedName = autoName ?? (benef.name || undefined);
        if (saveToCarnet && !isCashSelf && benef.name.trim()) {
          try {
            const created = await createBeneficiary.mutateAsync({
              client_id: client.user_id,
              payment_method: dbMode,
              alias: benef.name.trim(),
              name: benef.name.trim(),
              identifier: benef.ident || undefined,
              identifier_type: benef.ident ? 'id' : undefined,
              phone: benef.phone || undefined,
              email: benef.email || undefined,
              bank_name: benef.bank || undefined,
              bank_account: benef.account || undefined,
              qr_code_file: qrFile || undefined,
            });
            beneficiaryId = created.id;
          } catch {
            /* hook toasts; payment proceeds */
          }
        }
        snapshot = {
          relation_type: isCashSelf ? 'self' : 'other',
          name: resolvedName,
          identifier: benef.ident || undefined,
          identifier_type: benef.ident ? 'id' : undefined,
          phone: benef.phone || undefined,
          email: benef.email || undefined,
          bank_name: benef.bank || undefined,
          bank_account: benef.account || undefined,
        };
        benefPayload = {
          beneficiary_name: resolvedName,
          beneficiary_phone: benef.phone || undefined,
          beneficiary_email: benef.email || undefined,
          beneficiary_bank_name: benef.bank || undefined,
          beneficiary_bank_account: benef.account || undefined,
          beneficiary_identifier: benef.ident || undefined,
          beneficiary_identifier_type: benef.ident ? ('id' as const) : undefined,
          qr_code_files: qrFile ? [qrFile] : undefined,
        };
      }
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
      if (res.payment_id) navigate(`/m/payments/${res.payment_id}`);
      else navigate('/m/payments');
    } catch {
      /* toast handled by hook */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, mode, dbMode, xaf, cny, rate, useCustomRate, useCustomDate, customDateStr, skipBenef, benefTab, selectedBenef, benef, saveToCarnet, qrFile, amountValid, hasEnoughBalance, createPayment, createBeneficiary, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSubmit, submit]);

  const benefLabel = skipBenef
    ? 'À compléter plus tard'
    : selectedBenef
      ? selectedBenef.alias || selectedBenef.name
      : mode?.id === 'cash' && benef.isClient
        ? `${client?.first_name ?? ''} ${client?.last_name ?? ''} (le client)`
        : benef.name || '—';

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => navigate('/m/payments')} className={cn('text-[13px] font-semibold', TEXT.muted)}>
          Paiements
        </button>
        <ChevronRight className={cn('h-3.5 w-3.5', TEXT.muted)} />
        <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Nouveau paiement</h2>
      </header>

      <div className="mt-5 grid grid-cols-[1fr_360px] items-start gap-5">
        <div className="space-y-4">
          {/* ── 1 · Client & montant ─────────────────────────────────────── */}
          <Card>
            <SecLabel>1 · Client & montant</SecLabel>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <FormField
                label="Client"
                hint={
                  client ? (
                    <>
                      Solde : <b className={cn('tabular-nums', clientBalance > 0 ? TEXT.strong : 'text-[#C0504D] dark:text-[#E79A9A]')}>{fmt(clientBalance)} XAF</b>
                    </>
                  ) : undefined
                }
              >
                <div ref={clientRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setClientOpen((v) => !v)}
                    className={cn('flex h-12 w-full items-center justify-between rounded-2xl px-3.5 text-[14px]', SURFACE.card, SURFACE.shadow)}
                  >
                    {client ? (
                      <span className="inline-flex min-w-0 items-center gap-2.5">
                        <Avatar name={`${client.first_name} ${client.last_name}`} size="sm" />
                        <span className={cn('truncate font-bold', TEXT.strong)}>
                          {client.first_name} {client.last_name}
                        </span>
                      </span>
                    ) : (
                      <span className={TEXT.muted}>Choisir un client…</span>
                    )}
                    <ChevronDown className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                  </button>
                  {clientOpen && (
                    <div className={cn('absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-2xl p-2', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
                      <SearchField value={clientSearch} onChange={setClientSearch} placeholder="Nom ou téléphone…" />
                      <div className="mt-1.5 max-h-[240px] overflow-y-auto">
                        {filteredClients.map((c) => {
                          const bal = walletsMap.get(c.user_id);
                          return (
                            <button
                              key={c.user_id}
                              type="button"
                              onClick={() => {
                                setClientId(c.user_id);
                                setClientOpen(false);
                                setClientSearch('');
                                setSelectedBenef(null);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#EDEAFA]/50 dark:hover:bg-white/[0.05]"
                            >
                              <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                              <span className="min-w-0 flex-1 leading-[16px]">
                                <span className={cn('block truncate text-[13px] font-bold', TEXT.strong)}>
                                  {c.first_name} {c.last_name}
                                </span>
                                <span className={cn('block truncate text-[11px] tabular-nums', TEXT.muted)}>{c.phone ?? '—'}</span>
                              </span>
                              {bal != null && (
                                <span className={cn('shrink-0 text-[12px] font-bold tabular-nums', bal > 0 ? TEXT.strong : TEXT.muted)}>
                                  {fmt(bal)} XAF
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {filteredClients.length === 0 && <p className={cn('px-2.5 py-3 text-[12px]', TEXT.muted)}>Aucun client trouvé</p>}
                      </div>
                    </div>
                  )}
                </div>
              </FormField>
              <FormField label="Date de l'opération">
                <OperationDateCard
                  enabled={useCustomDate}
                  value={customDateStr}
                  onToggle={(on, nowLocal) => {
                    setUseCustomDate(on);
                    if (on && !customDateStr) setCustomDateStr(nowLocal);
                  }}
                  onChange={setCustomDateStr}
                  accent={VIOLET}
                />
              </FormField>
            </div>

            <div className="mt-3.5 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <FormField label="Le client paie (XAF)">
                <div className="relative">
                  <TextInput
                    inputMode="numeric"
                    placeholder="0"
                    value={xaf > 0 ? fmt(xaf) : lastEdited === 'xaf' ? '' : ''}
                    onChange={(e) => {
                      setLastEdited('xaf');
                      setRawXaf(e.target.value.replace(/[^0-9]/g, ''));
                    }}
                    className="pr-16 font-extrabold tabular-nums"
                  />
                  {/* « Max » = tout le solde du client (équivalent du « Tout » mobile). */}
                  <button
                    type="button"
                    disabled={!client || clientBalance <= 0}
                    onClick={() => {
                      setLastEdited('xaf');
                      setRawXaf(String(clientBalance));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#EAE7FA] px-2.5 py-1 text-[11px] font-extrabold text-[#5B4CC4] disabled:opacity-40 dark:bg-[#272252] dark:text-[#B5AAF0]"
                  >
                    Max
                  </button>
                </div>
              </FormField>
              <div className={cn('flex h-12 items-center', TEXT.muted)}>
                <ArrowRight className="h-4 w-4" />
              </div>
              <FormField label="Le fournisseur reçoit (¥)">
                <TextInput
                  inputMode="numeric"
                  placeholder={hasRate ? '0' : 'Choisir la destination'}
                  disabled={!hasRate}
                  value={cny > 0 ? fmt(cny) : ''}
                  onChange={(e) => {
                    setLastEdited('cny');
                    setRawCny(e.target.value.replace(/[^0-9]/g, ''));
                  }}
                  className="font-extrabold tabular-nums disabled:opacity-60"
                />
              </FormField>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {/* La source du taux est toujours nommée : du jour / perso / secours. */}
              <p className={cn('text-[12px] tabular-nums', TEXT.muted)}>
                {!hasRate ? (
                  <>Choisissez la destination — le taux du jour de la méthode s'appliquera.</>
                ) : (
                  <>
                    {useCustomRate ? 'Taux personnalisé' : fallbackActive ? 'Taux de secours' : `Taux du jour ${mode?.name}`} :{' '}
                    <b className={TEXT.strong}>¥{fmt(rate!)} pour 1 000 000 XAF</b>
                    {useCustomRate && (
                      <span className="ml-1.5 rounded-full bg-[#EAE7FA] px-1.5 py-px text-[9px] font-extrabold uppercase text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">
                        perso
                      </span>
                    )}
                    {useCustomRate && baseRate != null && <span className="ml-1.5">· taux du jour ¥{fmt(baseRate)}</span>}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                {useCustomRate && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn('text-[12px]', TEXT.muted)}>1M XAF =</span>
                    <TextInput
                      inputMode="numeric"
                      value={customRateStr}
                      onChange={(e) => setCustomRateStr(e.target.value.replace(/\D/g, ''))}
                      className="h-8 w-[90px] rounded-full text-center text-[13px] font-bold tabular-nums"
                    />
                    <span className={cn('text-[12px]', TEXT.muted)}>¥</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomRate((v) => {
                      if (!v) setCustomRateStr(String(baseRate ?? FALLBACK_RATE));
                      return !v;
                    });
                  }}
                  className="text-[12px] font-bold"
                  style={{ color: VIOLET }}
                >
                  {useCustomRate ? 'Revenir au taux du jour' : 'Modifier le taux'}
                </button>
              </div>
            </div>
            {fallbackActive && (
              <div className="mt-2.5 flex items-center gap-2.5 rounded-2xl bg-[#F8EFD8] p-3 dark:bg-[#372D14]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
                <p className="text-[12.5px] font-semibold text-[#9A6B12] dark:text-[#E7C083]">
                  Taux du jour indisponible — taux de secours ¥{fmt(FALLBACK_RATE)} appliqué. Vérifiez avant de confirmer.
                </p>
              </div>
            )}
            {xaf > 0 && !hasEnoughBalance && (
              <div className="mt-2.5 flex items-center gap-2.5 rounded-2xl bg-[#FBE7E7] p-3 dark:bg-[#3A2526]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />
                <p className="text-[12.5px] font-semibold text-[#C0504D] dark:text-[#E79A9A]">
                  Solde insuffisant — disponible : {fmt(clientBalance)} XAF
                </p>
              </div>
            )}
          </Card>

          {/* ── 2 · Destination ──────────────────────────────────────────── */}
          <Card>
            <SecLabel>2 · Destination</SecLabel>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickMode(m)}
                  className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-semibold', mode?.id === m.id ? PRIMARY_PILL : SOFT_PILL)}
                >
                  <PaymentMethodLogo method={logoMethod(m.id)} size={18} />
                  {m.name}
                </button>
              ))}
            </div>

            {mode && (
              <>
                <button
                  type="button"
                  onClick={() => setSkipBenef((v) => !v)}
                  className={cn('mt-3.5 flex w-full items-center gap-2.5 rounded-2xl p-3 text-left', SURFACE.canvas)}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition"
                    style={{ background: skipBenef ? VIOLET : 'transparent', boxShadow: skipBenef ? 'none' : 'inset 0 0 0 2px rgba(0,0,0,0.18)' }}
                  >
                    {skipBenef && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 leading-[16px]">
                    <span className={cn('block text-[13px] font-bold', TEXT.strong)}>Bénéficiaire à compléter plus tard</span>
                    <span className={cn('block text-[11px]', TEXT.muted)}>Le paiement sera créé en statut « Info manquante »</span>
                  </span>
                </button>

                {!skipBenef && (
                  <div className="mt-3.5 grid grid-cols-2 gap-4">
                    {/* Carnet */}
                    <div>
                      <SecLabel
                        right={
                          <button type="button" onClick={() => openBenefTab(benefTab === 'existing' ? 'new' : 'existing')} className="text-[12px] font-bold" style={{ color: VIOLET }}>
                            {benefTab === 'existing' ? '+ Nouveau' : '← Carnet'}
                          </button>
                        }
                      >
                        {benefTab === 'existing'
                          ? `Carnet${client ? ` de ${client.first_name}` : ''} · ${mode.name} (${clientBeneficiaries?.length ?? 0})`
                          : 'Nouveau bénéficiaire'}
                      </SecLabel>

                      {benefTab === 'existing' ? (
                        <div className="mt-2 space-y-2">
                          {!client ? (
                            <p className={cn('py-4 text-[12px]', TEXT.muted)}>Choisissez d'abord un client.</p>
                          ) : !clientBeneficiaries || clientBeneficiaries.length === 0 ? (
                            <div className="py-3">
                              <p className={cn('text-[12px]', TEXT.muted)}>Aucun bénéficiaire {mode.name} enregistré pour ce client.</p>
                              <button type="button" onClick={() => openBenefTab('new')} className="mt-1 text-[12.5px] font-bold" style={{ color: VIOLET }}>
                                + Créer un bénéficiaire
                              </button>
                            </div>
                          ) : (
                            clientBeneficiaries.map((b) => {
                              const sel = selectedBenef?.id === b.id;
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => setSelectedBenef(sel ? null : b)}
                                  className={cn('flex w-full items-center gap-3 rounded-[22px] p-3 text-left', SURFACE.card, SURFACE.shadow)}
                                  style={sel ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold" style={{ background: `${VIOLET}14`, color: VIOLET }}>
                                    {(b.alias || b.name)[0]?.toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1 leading-[16px]">
                                    <div className={cn('truncate text-[13px] font-bold', TEXT.strong)}>{b.alias || b.name}</div>
                                    <div className={cn('truncate text-[11px] tabular-nums', TEXT.muted)}>
                                      {b.identifier || b.phone || b.bank_account || b.name || ''}
                                    </div>
                                  </div>
                                  {sel && <Check className="h-4 w-4 shrink-0" style={{ color: VIOLET }} />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 space-y-3">
                          {mode.id === 'cash' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setBenef({ ...benef, isClient: true, name: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim(), phone: '' })
                                }
                                className={cn('flex-1 rounded-full px-3 py-2 text-[12px] font-bold', benef.isClient ? PRIMARY_PILL : SOFT_PILL)}
                              >
                                Le client lui-même
                              </button>
                              <button
                                type="button"
                                onClick={() => setBenef({ ...benef, isClient: false, name: '', phone: '' })}
                                className={cn('flex-1 rounded-full px-3 py-2 text-[12px] font-bold', !benef.isClient ? PRIMARY_PILL : SOFT_PILL)}
                              >
                                Quelqu'un d'autre
                              </button>
                            </div>
                          )}
                          {!(mode.id === 'cash' && benef.isClient) && (
                            <FormField label="Nom *">
                              <TextInput placeholder="Ex. : Zhang Wei" value={benef.name} onChange={(e) => setBenef({ ...benef, name: e.target.value })} />
                            </FormField>
                          )}
                          {(mode.id === 'alipay' || mode.id === 'wechat') && (
                            <FormField label={`Identifiant ${mode.name} (optionnel)`}>
                              <TextInput value={benef.ident} onChange={(e) => setBenef({ ...benef, ident: e.target.value })} />
                            </FormField>
                          )}
                          {mode.id === 'virement' && (
                            <>
                              <FormField label="Banque *">
                                <TextInput placeholder="Ex. : Bank of China" value={benef.bank} onChange={(e) => setBenef({ ...benef, bank: e.target.value })} />
                              </FormField>
                              <FormField label="Numéro de compte *">
                                <TextInput value={benef.account} onChange={(e) => setBenef({ ...benef, account: e.target.value })} />
                              </FormField>
                            </>
                          )}
                          <FormField label="Téléphone (optionnel)">
                            <TextInput type="tel" placeholder="+86 …" value={benef.phone} onChange={(e) => setBenef({ ...benef, phone: e.target.value })} />
                          </FormField>
                          {!(mode.id === 'cash' && benef.isClient) && (
                            <button type="button" onClick={() => setSaveToCarnet((v) => !v)} className="flex items-center gap-2">
                              <span
                                className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md"
                                style={{ background: saveToCarnet ? VIOLET : 'transparent', boxShadow: saveToCarnet ? 'none' : 'inset 0 0 0 2px rgba(0,0,0,0.18)', width: 18, height: 18 }}
                              >
                                {saveToCarnet && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </span>
                              <span className={cn('text-[12px] font-semibold', TEXT.strong)}>Enregistrer dans le carnet du client</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* QR (alipay/wechat, nouveau bénéficiaire) */}
                    <div className="space-y-3">
                      {(mode.id === 'alipay' || mode.id === 'wechat') && benefTab === 'new' && (
                        <FormField label={`QR code ${mode.name}`} hint="Ctrl+V colle la capture — prioritaire sur l'identifiant">
                          {qrPreview ? (
                            <div className="relative overflow-hidden rounded-2xl ring-2" style={{ boxShadow: `inset 0 0 0 2px ${VIOLET}40` }}>
                              <img src={qrPreview} alt="QR code" className="block h-[180px] w-full object-contain bg-white" />
                              <button
                                type="button"
                                onClick={removeQr}
                                aria-label="Retirer"
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <PasteDropZone
                              onFiles={setQrFromFiles}
                              enabled
                              single
                              accept={ACCEPT_IMAGE}
                              title="Collez, glissez ou cliquez le QR code"
                              hint="Ctrl+V colle directement votre capture"
                            />
                          )}
                        </FormField>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* ── Rail : récap vivant ──────────────────────────────────────────── */}
        <Card>
          <SecLabel>Récapitulatif</SecLabel>
          <div className={cn('mt-3 rounded-2xl py-4 text-center', SURFACE.canvas)}>
            <Amount value={`¥${fmt(cny)}`} size="xl" />
            <div className={cn('mt-1 text-[12px] tabular-nums', TEXT.muted)}>
              {fmt(xaf)} XAF{mode ? ` · ${mode.name}` : ''}
            </div>
          </div>
          <div className="mt-3 space-y-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <span className={TEXT.muted}>Client</span>
              <span className={cn('truncate font-semibold', client ? TEXT.strong : TEXT.muted)}>
                {client ? `${client.first_name} ${client.last_name}` : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className={TEXT.muted}>Bénéficiaire</span>
              <span className={cn('truncate font-semibold', benefLabel !== '—' ? TEXT.strong : TEXT.muted)}>{benefLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className={TEXT.muted}>Taux</span>
              <span className={cn('font-semibold tabular-nums', hasRate ? TEXT.strong : TEXT.muted)}>
                {hasRate ? (
                  <>
                    ¥{fmt(rate!)} <span className={cn('text-[11px] font-normal', TEXT.muted)}>/ 1M XAF</span>{' '}
                    {useCustomRate && <span className="text-[10px] font-extrabold uppercase text-[#5B4CC4] dark:text-[#B5AAF0]">perso</span>}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
            <div className="flex justify-between gap-3">
              <span className={cn('inline-flex items-center gap-1', TEXT.muted)}>
                <Wallet className="h-3 w-3" /> Solde actuel
              </span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{client ? `${fmt(clientBalance)} XAF` : '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className={TEXT.muted}>Après débit</span>
              <span className={cn('font-bold tabular-nums', xaf > 0 && hasEnoughBalance ? 'text-[#2E7D52] dark:text-[#7FCBA0]' : TEXT.muted)}>
                {client && xaf > 0 && hasEnoughBalance ? `${fmt(clientBalance - xaf)} XAF` : '—'}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#EAE7FA] p-3 dark:bg-[#272252]">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[#5B4CC4] dark:text-[#B5AAF0]" />
            <p className="text-[12px] leading-[16px] text-[#5B4CC4] dark:text-[#B5AAF0]">
              Le wallet est débité immédiatement. Un rejet rembourse automatiquement.
            </p>
          </div>
          <PrimaryPill onClick={submit} loading={createPayment.isPending} disabled={!canSubmit} className="mt-4 w-full bg-[#8B5CF6] text-white dark:bg-[#8B5CF6] dark:text-white">
            Confirmer le paiement
          </PrimaryPill>
          <SoftPill onClick={() => navigate('/m/payments')} className="mt-2 w-full">
            Annuler
          </SoftPill>
          <p className={cn('mt-2 text-center text-[11px]', TEXT.muted)}>⌘⏎ pour confirmer</p>
        </Card>
      </div>
    </div>
  );
}
