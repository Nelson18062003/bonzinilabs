/**
 * Desktop admin — « Nouveau dépôt » as ONE page (archetype surface C).
 *
 * Replaces the 7-step mobile wizard on desktop routes: every decision —
 * client, montant, méthode (+ sous-type / banque / agence), preuves, note —
 * is visible at once, with the payment coordinates the admin dictates to the
 * client and a live recap in the sticky right rail. ⌘⏎ submits.
 * Same data layer as the wizard: useAllClients + useAdminCreateDeposit.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Info,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAllClients, useAdminCreateDeposit, useAdminWalletByUserId } from '@/hooks/useAdminDeposits';
import {
  SUB_METHOD_TO_DB_METHOD,
  type DepositMethodFamily,
  type DepositSubMethod,
} from '@/types/deposit';
import {
  methodFamilies,
  getSubMethodsForFamily,
  banks,
  agencies,
  familyRequiresSubMethod,
  subMethodRequiresBankSelection,
  MOBILE_MONEY_TRANSACTION_LIMIT,
  orangeMoneyAccount,
  mtnMoneyAccount,
  waveAccount,
  omMerchantInfo,
  mtnMerchantInfo,
} from '@/data/depositMethodsData';
import { MIN_DEPOSIT_XAF, MAX_AMOUNT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import { formatCurrency } from '@/lib/formatters';
import { OperationDateCard, resolveOperationDate } from '@/mobile/components/OperationDateCard';
import { matchesClientSearch } from '@/lib/clientSearch';
import { cn } from '@/lib/utils';
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
  StatusPill,
  MIcon,
  SecLabel,
  SearchField,
} from '@/desktop/designKit';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { FilePreviewGrid } from '@/components/upload/FilePreviewGrid';
import { usePasteFiles } from '@/hooks/usePasteFiles';

function fmt(n: number) {
  return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Champ-select de formulaire (h-12, popover local) — le SelectBox du kit forme. */
function SelectField<T extends string>({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: T | null;
  options: ReadonlyArray<{ value: T; label: string; meta?: string }>;
  onChange: (v: T) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn('flex h-12 w-full items-center justify-between rounded-2xl px-4 text-[14px]', SURFACE.card, SURFACE.shadow, current ? TEXT.strong : TEXT.muted)}
      >
        <span className={cn('truncate', current && 'font-semibold')}>{current?.label ?? placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', TEXT.muted, open && 'rotate-180')} />
      </button>
      {open && (
        <div className={cn('absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[260px] overflow-y-auto rounded-2xl p-1.5', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors',
                o.value === value ? 'bg-accent' : 'hover:bg-muted/50 dark:hover:bg-white/[0.05]',
                TEXT.strong,
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{o.label}</span>
                {o.meta && <span className={cn('block truncate text-[11px] font-normal', TEXT.muted)}>{o.meta}</span>}
              </span>
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-700 dark:text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copié !');
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };
  return (
    <button type="button" onClick={copy} className={cn('flex w-full items-center justify-between gap-2 rounded-2xl p-3 text-left', SURFACE.canvas)}>
      <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>{label}</span>
      <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[13px] font-bold', TEXT.strong, mono && 'font-mono text-[12.5px]')}>
        <span className="truncate">{value}</span>
        <Copy className={cn('h-3.5 w-3.5 shrink-0', TEXT.muted)} />
      </span>
    </button>
  );
}

/** Coordonnées + instructions à communiquer, selon la méthode choisie. */
function coordinates(
  family: DepositMethodFamily | null,
  subMethod: DepositSubMethod | null,
  bank: string | null,
  agency: string | null,
  amount: number,
): { lines: { label: string; value: string; mono?: boolean }[]; instructions: string[] } | null {
  const montant = amount > 0 ? formatCurrency(amount) : 'le montant exact';
  if (family === 'BANK' && bank) {
    const b = banks.find((x) => x.bank === bank);
    if (!b) return null;
    return {
      lines: [
        { label: 'Banque', value: b.bonziniAccount.bankName },
        { label: 'N° compte', value: b.bonziniAccount.accountNumber, mono: true },
        { label: 'Titulaire', value: b.bonziniAccount.accountName },
        { label: 'IBAN', value: b.bonziniAccount.iban, mono: true },
      ],
      instructions:
        subMethod === 'BANK_TRANSFER'
          ? ['Le client fait un virement vers ce compte', `Montant exact : ${montant}`, 'Il conserve le reçu → preuve']
          : [`Le client dépose en agence ${b.label}`, `Montant exact : ${montant}`, 'Il conserve le bordereau → preuve'],
    };
  }
  if (family === 'ORANGE_MONEY') {
    if (subMethod === 'OM_TRANSFER') {
      return {
        lines: [
          { label: 'Numéro', value: orangeMoneyAccount.phone, mono: true },
          { label: 'Titulaire', value: orangeMoneyAccount.accountName },
        ],
        instructions: ['Composer #150*1*1#', `Montant : ${montant}`, 'Capture du SMS → preuve'],
      };
    }
    return {
      lines: [
        { label: 'Code marchand', value: omMerchantInfo.merchantCode.replace('MONTANT', String(amount || '…')), mono: true },
        { label: 'Titulaire', value: omMerchantInfo.accountName },
      ],
      instructions: ['Le client compose le code marchand', 'Il valide avec son PIN Orange Money', 'Capture du SMS → preuve'],
    };
  }
  if (family === 'MTN_MONEY') {
    if (subMethod === 'MTN_TRANSFER') {
      return {
        lines: [
          { label: 'Numéro', value: mtnMoneyAccount.phone, mono: true },
          { label: 'Titulaire', value: mtnMoneyAccount.accountName },
        ],
        instructions: [`Transfert MoMo vers ${mtnMoneyAccount.phone}`, `Montant : ${montant}`, 'Capture du SMS → preuve'],
      };
    }
    return {
      lines: [
        { label: 'Code marchand', value: mtnMerchantInfo.merchantCode.replace('MONTANT', String(amount || '…')), mono: true },
        { label: 'Titulaire', value: mtnMerchantInfo.accountName },
      ],
      instructions: ['Le client compose le code marchand', 'Il valide avec son PIN MTN', 'Capture du SMS → preuve'],
    };
  }
  if (family === 'WAVE') {
    return {
      lines: [
        { label: 'Numéro Wave', value: waveAccount.phone, mono: true },
        { label: 'Titulaire', value: waveAccount.accountName },
      ],
      instructions: ["Ouvrir l'app Wave → « Envoyer »", `Numéro : ${waveAccount.phone}`, `Montant : ${montant}`],
    };
  }
  if (family === 'AGENCY_BONZINI' && agency) {
    const a = agencies.find((x) => x.agency === agency);
    if (!a) return null;
    return {
      lines: [
        { label: 'Agence', value: a.label },
        { label: 'Adresse', value: a.address },
        { label: 'Horaires', value: a.hours },
      ],
      instructions: [`Le client se rend à ${a.label}`, "Pièce d'identité + espèces", 'Il conserve le reçu'],
    };
  }
  return null;
}

const PRESETS = [100_000, 250_000, 500_000, 1_000_000, 2_000_000];

export function DesktopNewDeposit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');

  const { data: clients, isLoading: clientsLoading } = useAllClients();
  const createDeposit = useAdminCreateDeposit();

  const [clientId, setClientId] = useState<string | null>(preselectedClientId);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [family, setFamily] = useState<DepositMethodFamily | null>(null);
  const [subMethod, setSubMethod] = useState<DepositSubMethod | null>(null);
  const [bank, setBank] = useState<string | null>(null);
  const [agency, setAgency] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [adminComment, setAdminComment] = useState('');
  // Date de l'opération — « maintenant » par défaut, antidatable (parité
  // avec le wizard mobile MobileNewDepositV2 et le paiement desktop).
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateStr, setCustomDateStr] = useState('');
  const clientRef = useRef<HTMLDivElement>(null);

  const client = useMemo(() => clients?.find((c) => c.user_id === clientId) ?? null, [clients, clientId]);
  const { data: wallet } = useAdminWalletByUserId(client?.user_id);
  const amountNum = parseInt(amount) || 0;

  useEffect(() => {
    if (!clientOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!clientRef.current?.contains(e.target as Node)) setClientOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [clientOpen]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    const s = clientSearch.trim();
    const list = s
      ? clients.filter((c) =>
          matchesClientSearch({ firstName: c.first_name ?? '', lastName: c.last_name ?? '', phone: c.phone ?? '' }, s),
        )
      : clients;
    return list.slice(0, 8);
  }, [clients, clientSearch]);

  const pickFamily = (f: DepositMethodFamily) => {
    setFamily(f);
    setBank(null);
    setAgency(null);
    if (familyRequiresSubMethod(f)) setSubMethod(null);
    else if (f === 'AGENCY_BONZINI') setSubMethod('AGENCY_CASH');
    else if (f === 'WAVE') setSubMethod('WAVE_TRANSFER');
  };

  const subOptions = family && familyRequiresSubMethod(family)
    ? getSubMethodsForFamily(family).map((s) => ({ value: s.subMethod, label: s.label, meta: s.description }))
    : [];
  const needsBank = !!subMethod && subMethodRequiresBankSelection(subMethod);
  const needsAgency = family === 'AGENCY_BONZINI';

  const methodComplete =
    !!family &&
    (!familyRequiresSubMethod(family) || !!subMethod) &&
    (!needsBank || !!bank) &&
    (!needsAgency || !!agency);

  const amountValid = isValidXafAmount(amountNum, MIN_DEPOSIT_XAF);
  const canSubmit = !!client && amountValid && methodComplete && !createDeposit.isPending;

  const getDbMethod = () => {
    if (subMethod) return SUB_METHOD_TO_DB_METHOD[subMethod];
    return 'bank_transfer' as const;
  };

  const submit = useCallback(async () => {
    if (!client || !family) {
      toast.error('Informations manquantes');
      return;
    }
    if (!amountValid) {
      toast.error(`Montant invalide — entre ${fmt(MIN_DEPOSIT_XAF)} et ${fmt(MAX_AMOUNT_XAF)} XAF`);
      return;
    }
    // Re-vérifié ici (pas seulement dans le champ) : la page peut rester
    // ouverte au-delà du max affiché par le picker.
    const opDate = resolveOperationDate(useCustomDate, customDateStr);
    if (opDate.error) {
      toast.error(opDate.error);
      return;
    }
    try {
      const result = await createDeposit.mutateAsync({
        user_id: client.user_id,
        amount_xaf: amountNum,
        method: getDbMethod(),
        desired_date: opDate.date,
        bank_name: bank ? banks.find((b) => b.bank === bank)?.label : undefined,
        agency_name: agency ? agencies.find((a) => a.agency === agency)?.label : undefined,
        admin_comment: adminComment || undefined,
        proofFiles: proofFiles.length > 0 ? proofFiles : undefined,
      });
      navigate(`/m/deposits/${result.id}`);
    } catch {
      /* toast handled by the hook */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, family, amountNum, amountValid, useCustomDate, customDateStr, bank, agency, adminComment, proofFiles, createDeposit, navigate]);

  // ⌘⏎ submits from anywhere on the page.
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

  // Ctrl+V anywhere stages a proof.
  usePasteFiles({
    onFiles: useCallback((files: File[]) => setProofFiles((prev) => [...prev, ...files]), []),
    enabled: true,
  });

  const coords = coordinates(family, subMethod, bank, agency, amountNum);
  const familyLabel = methodFamilies.find((f) => f.family === family)?.label;
  const subLabel = family && familyRequiresSubMethod(family)
    ? getSubMethodsForFamily(family).find((s) => s.subMethod === subMethod)?.label
    : undefined;

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => navigate('/m/deposits')} className={cn('text-[13px] font-semibold', TEXT.muted)}>
          Dépôts
        </button>
        <ChevronRight className={cn('h-3.5 w-3.5', TEXT.muted)} />
        <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Nouveau dépôt</h2>
      </header>

      <div className="mt-5 grid grid-cols-[1fr_360px] items-start gap-5">
        {/* ── Colonne principale ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <SecLabel>1 · Client & montant</SecLabel>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <FormField label="Client">
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
                        <span className={cn('hidden truncate text-[12px] tabular-nums xl:inline', TEXT.muted)}>{client.phone}</span>
                      </span>
                    ) : (
                      <span className={TEXT.muted}>{clientsLoading ? 'Chargement…' : 'Choisir un client…'}</span>
                    )}
                    <ChevronDown className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                  </button>
                  {clientOpen && (
                    <div className={cn('absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-2xl p-2', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
                      <SearchField value={clientSearch} onChange={setClientSearch} placeholder="Nom ou téléphone…" />
                      <div className="mt-1.5 max-h-[240px] overflow-y-auto">
                        {filteredClients.map((c) => (
                          <button
                            key={c.user_id}
                            type="button"
                            onClick={() => {
                              setClientId(c.user_id);
                              setClientOpen(false);
                              setClientSearch('');
                            }}
                            className={cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-muted/50 dark:hover:bg-white/[0.05]')}
                          >
                            <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                            <span className="min-w-0 leading-[16px]">
                              <span className={cn('block truncate text-[13px] font-bold', TEXT.strong)}>
                                {c.first_name} {c.last_name}
                              </span>
                              <span className={cn('block truncate text-[11px] tabular-nums', TEXT.muted)}>{c.phone ?? '—'}</span>
                            </span>
                          </button>
                        ))}
                        {filteredClients.length === 0 && (
                          <p className={cn('px-2.5 py-3 text-[12px]', TEXT.muted)}>Aucun client trouvé</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </FormField>
              <FormField label="Montant (XAF)" hint={`Min ${fmt(MIN_DEPOSIT_XAF)} · Max ${fmt(MAX_AMOUNT_XAF)}`}>
                <TextInput
                  inputMode="numeric"
                  placeholder="0"
                  value={amountNum > 0 ? fmt(amountNum) : ''}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  className="font-extrabold tabular-nums"
                />
              </FormField>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={cn('rounded-md px-3 py-1.5 text-[12px] font-semibold', amountNum === p ? PRIMARY_PILL : SOFT_PILL)}
                >
                  {p >= 1_000_000 ? `${p / 1_000_000}M` : `${p / 1_000}K`}
                </button>
              ))}
              {wallet && (
                <span className={cn('ml-2 inline-flex items-center gap-1.5 text-[12px]', TEXT.muted)}>
                  <Wallet className="h-3.5 w-3.5" /> Solde actuel :{' '}
                  <b className={cn('tabular-nums', TEXT.strong)}>{fmt(wallet.balance_xaf)} XAF</b>
                </span>
              )}
            </div>
            <OperationDateCard
              className="mt-3"
              enabled={useCustomDate}
              value={customDateStr}
              onToggle={(on, nowLocal) => {
                setUseCustomDate(on);
                if (on && !customDateStr) setCustomDateStr(nowLocal);
              }}
              onChange={setCustomDateStr}
              accent="#10B981"
            />
          </Card>

          <Card>
            <SecLabel>2 · Méthode de dépôt</SecLabel>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {methodFamilies.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  onClick={() => pickFamily(f.family)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[12px] font-semibold',
                    family === f.family ? PRIMARY_PILL : SOFT_PILL,
                  )}
                >
                  <MIcon family={f.family} size={18} />
                  {f.label}
                </button>
              ))}
            </div>
            {amountNum > MOBILE_MONEY_TRANSACTION_LIMIT && (family === 'ORANGE_MONEY' || family === 'MTN_MONEY' || family === 'WAVE') && (
              <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                Le montant dépasse la limite mobile money ({formatCurrency(MOBILE_MONEY_TRANSACTION_LIMIT)}) — prévoir plusieurs opérations.
              </div>
            )}
            {family && (subOptions.length > 0 || needsBank || needsAgency) && (
              <div className="mt-3.5 grid grid-cols-2 gap-4">
                {subOptions.length > 0 && (
                  <FormField label="Type d'opération">
                    <SelectField
                      value={subMethod}
                      options={subOptions}
                      onChange={(v) => {
                        setSubMethod(v);
                        setBank(null);
                      }}
                      placeholder="Choisir…"
                    />
                  </FormField>
                )}
                {needsBank && (
                  <FormField label="Banque">
                    <SelectField
                      value={bank}
                      options={banks.map((b) => ({ value: b.bank as string, label: b.label }))}
                      onChange={setBank}
                      placeholder="Choisir la banque…"
                    />
                  </FormField>
                )}
                {needsAgency && (
                  <FormField label="Agence">
                    <SelectField
                      value={agency}
                      options={agencies.map((a) => ({ value: a.agency as string, label: a.label, meta: a.address }))}
                      onChange={setAgency}
                      placeholder="Choisir l'agence…"
                    />
                  </FormField>
                )}
              </div>
            )}
          </Card>

          <Card>
            <SecLabel>3 · Preuves & note (optionnel)</SecLabel>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <PasteDropZone onFiles={(files) => setProofFiles((prev) => [...prev, ...files])} enabled={false} busy={createDeposit.isPending} />
                {proofFiles.length > 0 && (
                  <div className="mt-2">
                    <FilePreviewGrid files={proofFiles} onRemove={(i) => setProofFiles((prev) => prev.filter((_, idx) => idx !== i))} />
                  </div>
                )}
              </div>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Note interne — visible uniquement par les admins…"
                className={cn('h-[110px] w-full resize-none rounded-2xl p-3 text-[13px] outline-none', SURFACE.canvas, TEXT.strong, 'placeholder:text-muted-foreground focus:ring-2 focus:ring-ring')}
              />
            </div>
          </Card>
        </div>

        {/* ── Rail : coordonnées + récap + CTA ───────────────────────────── */}
        <div className="space-y-4">
          {coords && (
            <Card>
              <SecLabel right={family ? <MIcon family={family} size={20} /> : undefined}>Coordonnées à communiquer</SecLabel>
              <div className="mt-3 space-y-2">
                {coords.lines.map((l) => (
                  <CopyLine key={l.label} label={l.label} value={l.value} mono={l.mono} />
                ))}
              </div>
              <ol className="mt-3 space-y-2">
                {coords.instructions.map((s, i) => (
                  <li key={s} className="flex gap-2.5">
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', SURFACE.holder)}>
                      {i + 1}
                    </span>
                    <span className={cn('text-[12.5px]', TEXT.muted)}>{s}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card>
            <SecLabel>Récapitulatif</SecLabel>
            <div className="mt-2.5 space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className={TEXT.muted}>Client</span>
                <span className={cn('truncate font-semibold', client ? TEXT.strong : TEXT.muted)}>
                  {client ? `${client.first_name} ${client.last_name}` : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={TEXT.muted}>Montant</span>
                <span className={cn('font-bold tabular-nums', amountNum > 0 ? TEXT.strong : TEXT.muted)}>
                  {amountNum > 0 ? `${fmt(amountNum)} XAF` : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={TEXT.muted}>Méthode</span>
                <span className={cn('truncate font-semibold', family ? TEXT.strong : TEXT.muted)}>
                  {family ? [familyLabel, subLabel].filter(Boolean).join(' · ') : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className={TEXT.muted}>Date de l'opération</span>
                <span className={cn('font-semibold tabular-nums', TEXT.strong)}>
                  {useCustomDate && customDateStr
                    ? new Date(customDateStr).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Maintenant'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={TEXT.muted}>Statut initial</span>
                <StatusPill tone="neutral" label={proofFiles.length > 0 ? 'Preuve envoyée' : 'Demande créée'} />
              </div>
              {proofFiles.length > 0 && (
                <div className="flex justify-between gap-3">
                  <span className={TEXT.muted}>Preuves</span>
                  <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{proofFiles.length}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-indigo-50 p-3 dark:bg-indigo-950/50">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-indigo-700 dark:text-indigo-400" />
              <p className="text-[12px] leading-[16px] text-indigo-700 dark:text-indigo-400">
                Le wallet n'est crédité qu'à la validation de la preuve.
              </p>
            </div>
            <PrimaryPill onClick={submit} loading={createDeposit.isPending} disabled={!canSubmit} className="mt-4 w-full">
              Créer le dépôt
            </PrimaryPill>
            <SoftPill onClick={() => navigate('/m/deposits')} className="mt-2 w-full">
              Annuler
            </SoftPill>
            <p className={cn('mt-2 text-center text-[11px]', TEXT.muted)}>⌘⏎ pour créer · Ctrl+V colle une preuve</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
