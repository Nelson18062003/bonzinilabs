/**
 * Desktop admin — Nouvel achat USDT (archétype C : page de création).
 *
 * Remplace le montage du wizard téléphone sur la route desktop
 * (`MobileNewPurchase desktop`). Deux zones : les décisions à gauche, un
 * RÉCAPITULATIF VIVANT collé à droite.
 *
 * Ce récapitulatif est ce qui manquait : on saisissait un montant sans voir
 * son effet. Il montre le taux effectif obtenu et surtout le **WAC avant →
 * après** — acheter au-dessus du coût moyen fait monter le prix de revient de
 * tout le stock, c'est la conséquence réelle de la saisie.
 *
 * La LOGIQUE FINANCIÈRE est reprise à l'identique du mobile (déjà validée) :
 *   · compte unique — 3 modes : XAF+USDT → taux · XAF+taux → USDT · USDT+taux → XAF
 *   · multi-comptes — le total XAF vient des lignes, on saisit l'USDT OU le taux
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  CardHeader,
  Chip,
  SecLabel,
  PRIMARY_PILL,
  SOFT_PILL,
  PrimaryPill,
  SoftPill,
  FormField,
  TextInput,
  CenterDialog,
} from '@/desktop/designKit';
import { OccurredAtField, PhoneInputWithCountry } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useCreateCounterparty,
  useRecordUsdtPurchase,
  useTreasuryAccounts,
  useUsdtStock,
  useUsdtWac,
  type AccountSplit,
} from '@/hooks/useTreasury';
import { fmtNum, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryMoneyInput } from './TreasuryMoneyInput';
import { TreasurySelect } from './TreasurySelect';

type SingleMode = 'xaf_usdt' | 'xaf_rate' | 'usdt_rate';
type MultiInput = 'usdt' | 'rate';

const SINGLE_MODES: ReadonlyArray<{ value: SingleMode; label: string }> = [
  { value: 'xaf_usdt', label: 'XAF + USDT' },
  { value: 'xaf_rate', label: 'XAF + taux' },
  { value: 'usdt_rate', label: 'USDT + taux' },
];

interface SplitRow {
  key: string;
  accountId: string;
  amount: number | null;
}

let splitKeyCounter = 0;
const newSplit = (): SplitRow => ({ key: `s${splitKeyCounter++}`, accountId: '', amount: null });

function RecapRow({ label, value, unit, strong }: { label: string; value: string; unit?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('text-[12px]', TEXT.muted)}>{label}</span>
      <span className={cn('tabular-nums', strong ? cn('text-[15px] font-extrabold', TEXT.strong) : cn('text-[13px] font-semibold', TEXT.body))}>
        {value}
        {unit && <span className={cn('ml-1 text-[10.5px] font-normal', TEXT.muted)}>{unit}</span>}
      </span>
    </div>
  );
}

export function DesktopNewPurchase() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: suppliers } = useCounterparties('usdt_supplier');
  const { data: xafAccounts } = useTreasuryAccounts('XAF');
  const { data: wac } = useUsdtWac();
  const { data: stock } = useUsdtStock();
  const create = useCreateCounterparty();
  const submit = useRecordUsdtPurchase();

  const [supplierId, setSupplierId] = useState('');
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString());
  const [multi, setMulti] = useState(false);
  const [singleAccountId, setSingleAccountId] = useState('');
  const [splits, setSplits] = useState<SplitRow[]>([newSplit(), newSplit()]);

  const [singleMode, setSingleMode] = useState<SingleMode>('xaf_usdt');
  const [multiInput, setMultiInput] = useState<MultiInput>('usdt');
  const [xafAmount, setXafAmount] = useState<number | null>(null);
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);

  const multiTotalXaf = useMemo(() => splits.reduce((s, r) => s + (r.amount ?? 0), 0), [splits]);

  // Résolution des trois grandeurs — identique au mobile.
  const resolved = useMemo(() => {
    if (multi) {
      const xaf = multiTotalXaf > 0 ? multiTotalXaf : null;
      if (multiInput === 'usdt') {
        const r = xaf && usdtAmount && usdtAmount > 0 ? xaf / usdtAmount : null;
        return { xaf, usdt: usdtAmount, rate: r };
      }
      const u = xaf && rate && rate > 0 ? xaf / rate : null;
      return { xaf, usdt: u, rate };
    }
    if (singleMode === 'xaf_usdt') {
      const r = xafAmount && usdtAmount && usdtAmount > 0 ? xafAmount / usdtAmount : null;
      return { xaf: xafAmount, usdt: usdtAmount, rate: r };
    }
    if (singleMode === 'xaf_rate') {
      const u = xafAmount && rate && rate > 0 ? xafAmount / rate : null;
      return { xaf: xafAmount, usdt: u, rate };
    }
    const x = usdtAmount && rate && rate > 0 ? usdtAmount * rate : null;
    return { xaf: x, usdt: usdtAmount, rate };
  }, [multi, multiTotalXaf, multiInput, singleMode, xafAmount, usdtAmount, rate]);

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  // WAC après l'achat : (valeur du stock + XAF payé) / (stock + USDT reçu).
  const wacAfter =
    wac !== undefined && stock !== undefined && resolved.xaf && resolved.usdt && stock + resolved.usdt > 0
      ? (stock * wac + resolved.xaf) / (stock + resolved.usdt)
      : null;
  const wacDelta = wacAfter !== null && wac !== undefined ? wacAfter - wac : null;

  const splitsValid = splits.every((r) => r.accountId && (r.amount ?? 0) > 0);
  const valid =
    !!supplierId &&
    resolved.xaf !== null && resolved.xaf > 0 &&
    resolved.usdt !== null && resolved.usdt > 0 &&
    (multi ? splitsValid : !!singleAccountId);

  const handleSubmit = async () => {
    if (!valid || resolved.xaf === null || resolved.usdt === null || submit.isPending) return;
    const accountSplits: AccountSplit[] = multi
      ? splits.map((r) => ({ account_id: r.accountId, xaf_amount: r.amount ?? 0 }))
      : [{ account_id: singleAccountId, xaf_amount: resolved.xaf }];
    const result = await submit.mutateAsync({
      supplier_id: supplierId,
      usdt_amount: resolved.usdt,
      account_splits: accountSplits,
      occurred_at: occurredAt,
      external_ref: externalRef || undefined,
      notes: notes || undefined,
    });
    if (result.success) navigate('/m/more/treasury');
  };

  const handleCreateSupplier = async () => {
    if (!newName.trim() || create.isPending) return;
    const result = await create.mutateAsync({ type: 'usdt_supplier', display_name: newName.trim(), phone: newPhone ?? undefined });
    if (result.success && result.id) {
      setSupplierId(result.id);
      setNewOpen(false);
      setNewName('');
      setNewPhone(null);
    }
  };

  const updateSplit = (key: string, patch: Partial<SplitRow>) =>
    setSplits((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const accountOptions = (xafAccounts ?? []).map((a) => ({ value: a.id, label: a.label }));

  return (
    <div className="mx-auto max-w-[1080px] space-y-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/m/more/treasury')}
          aria-label="Retour à la trésorerie"
          className={cn('flex h-9 w-9 items-center justify-center rounded-full', SOFT_PILL)}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className={cn('text-[20px] font-bold tracking-tight', TEXT.strong)}>Nouvel achat USDT</h2>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Entrée de stock : XAF payé → USDT reçu</p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Décisions ── */}
        <div className="space-y-4">
          <Card className="p-0">
            <CardHeader title="Fournisseur" />
            <div className="space-y-3 p-5">
              <div className="flex items-end gap-2">
                <FormField label="Fournisseur USDT" htmlFor="supplier" className="flex-1">
                  <TreasurySelect
                    id="supplier"
                    value={supplierId}
                    onChange={setSupplierId}
                    options={(suppliers ?? []).map((s) => ({ value: s.id, label: `${s.short_id} · ${s.display_name}` }))}
                  />
                </FormField>
                <button type="button" onClick={() => setNewOpen(true)} className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-[12px] font-bold', SOFT_PILL)}>
                  <Plus className="h-3.5 w-3.5" /> Nouveau
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <CardHeader
              title="Compte XAF débité"
              meta={multi ? `${splits.length} compte${splits.length > 1 ? 's' : ''}` : undefined}
            />
            <div className="space-y-3 p-5">
              {!multi ? (
                <>
                  <FormField label="Compte" htmlFor="account">
                    <TreasurySelect id="account" value={singleAccountId} onChange={setSingleAccountId} options={accountOptions} />
                  </FormField>
                  <button type="button" onClick={() => setMulti(true)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
                    <Plus className="h-3.5 w-3.5" /> Répartir sur plusieurs comptes
                  </button>
                </>
              ) : (
                <>
                  {splits.map((row, idx) => (
                    <div key={row.key} className={cn('space-y-2.5 rounded-[10px] p-3', SURFACE.inset)}>
                      <SecLabel
                        right={
                          splits.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setSplits((rows) => rows.filter((r) => r.key !== row.key))}
                              aria-label={`Retirer le compte ${idx + 1}`}
                              className="text-[#C0504D] dark:text-[#E79A9A]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : undefined
                        }
                      >
                        Compte {idx + 1}
                      </SecLabel>
                      <TreasurySelect
                        value={row.accountId}
                        onChange={(v) => updateSplit(row.key, { accountId: v })}
                        options={accountOptions}
                        placeholder="Choisir le compte…"
                      />
                      <TreasuryMoneyInput currency="XAF" value={row.amount} onValueChange={(v) => updateSplit(row.key, { amount: v })} decimals={0} />
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setSplits((rows) => [...rows, newSplit()])} className={cn('inline-flex h-9 items-center gap-1.5 px-3 text-[12px] font-bold', SOFT_PILL)}>
                      <Plus className="h-3.5 w-3.5" /> Ajouter un compte
                    </button>
                    <button type="button" onClick={() => setMulti(false)} className="text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
                      ← Un seul compte
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="p-0">
            <CardHeader title="Montant" meta={multi ? 'Le total XAF vient des comptes' : undefined} />
            <div className="space-y-3 p-5">
              {!multi ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Je saisis</span>
                    {SINGLE_MODES.map((m) => (
                      <Chip key={m.value} label={m.label} active={singleMode === m.value} onClick={() => setSingleMode(m.value)} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(singleMode === 'xaf_usdt' || singleMode === 'xaf_rate') && (
                      <FormField label="XAF payé" htmlFor="xaf">
                        <TreasuryMoneyInput id="xaf" currency="XAF" value={xafAmount} onValueChange={setXafAmount} decimals={0} />
                      </FormField>
                    )}
                    {(singleMode === 'xaf_usdt' || singleMode === 'usdt_rate') && (
                      <FormField label="USDT reçu" htmlFor="usdt">
                        <TreasuryMoneyInput id="usdt" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} decimals={2} />
                      </FormField>
                    )}
                    {(singleMode === 'xaf_rate' || singleMode === 'usdt_rate') && (
                      <FormField label="Taux" htmlFor="rate">
                        <TreasuryMoneyInput id="rate" currency="XAF/USDT" value={rate} onValueChange={setRate} decimals={2} />
                      </FormField>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Je saisis</span>
                    <Chip label="USDT reçu" active={multiInput === 'usdt'} onClick={() => setMultiInput('usdt')} />
                    <Chip label="Taux" active={multiInput === 'rate'} onClick={() => setMultiInput('rate')} />
                  </div>
                  {multiInput === 'usdt' ? (
                    <FormField label="USDT reçu" htmlFor="usdt-m">
                      <TreasuryMoneyInput id="usdt-m" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} decimals={2} />
                    </FormField>
                  ) : (
                    <FormField label="Taux" htmlFor="rate-m">
                      <TreasuryMoneyInput id="rate-m" currency="XAF/USDT" value={rate} onValueChange={setRate} decimals={2} />
                    </FormField>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card className="p-0">
            <CardHeader title="Détails" meta="Date · référence · note" />
            <div className="space-y-3 p-5">
              {/* OccurredAtField porte déjà son propre libellé — pas de FormField
                  autour, sinon la ligne « Date » s'affiche deux fois. */}
              <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
              <p className={cn('text-[12px]', TEXT.muted)}>
                Antidatable — saisissez la date réelle de l'achat, pas celle de la saisie.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Référence externe" hint="Binance, hash…">
                  <TextInput value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
                </FormField>
                <FormField label="Note">
                  <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
                </FormField>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Récapitulatif vivant ── */}
        <div className="lg:sticky lg:top-4">
          <Card className="p-0">
            <CardHeader title="Récapitulatif" />
            <div className="space-y-3 p-5">
              <RecapRow label="XAF payé" value={fmtNum(resolved.xaf, 0)} unit="XAF" strong />
              <RecapRow label="USDT reçu" value={fmtNum(resolved.usdt, 2)} unit="USDT" strong />
              <div className="border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
                <RecapRow label="Taux effectif" value={fmtNum(resolved.rate, RATE_DECIMALS.xafPerUsdt)} unit="XAF/USDT" />
              </div>

              <div className="border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
                <SecLabel>Effet sur le stock</SecLabel>
                <div className="mt-2 space-y-2">
                  <RecapRow label="WAC actuel" value={fmtNum(wac, RATE_DECIMALS.xafPerUsdt)} unit="XAF/USDT" />
                  <RecapRow label="WAC après achat" value={fmtNum(wacAfter, RATE_DECIMALS.xafPerUsdt)} unit="XAF/USDT" />
                  {wacDelta !== null && (
                    <div
                      className={cn(
                        'flex items-center justify-between rounded-[10px] px-3 py-2 text-[12px] font-bold',
                        wacDelta > 0
                          ? 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]'
                          : 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]',
                      )}
                    >
                      <span>{wacDelta > 0 ? 'Renchérit le stock' : 'Abaisse le coût du stock'}</span>
                      <span className="tabular-nums">
                        {wacDelta > 0 ? '+' : ''}
                        {fmtNum(wacDelta, RATE_DECIMALS.xafPerUsdt)}
                      </span>
                    </div>
                  )}
                  <RecapRow
                    label="Stock après"
                    value={fmtNum(stock !== undefined && resolved.usdt ? stock + resolved.usdt : stock, 2)}
                    unit="USDT"
                  />
                </div>
              </div>

              <PrimaryPill onClick={handleSubmit} disabled={!valid} loading={submit.isPending} className="w-full">
                Enregistrer l'achat
              </PrimaryPill>
            </div>
          </Card>
        </div>
      </div>

      {/* Créer un fournisseur sans quitter la saisie */}
      <CenterDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onConfirm={handleCreateSupplier}
        title="Nouveau fournisseur USDT"
        width={440}
        footer={
          <>
            <PrimaryPill onClick={handleCreateSupplier} disabled={!newName.trim()} loading={create.isPending} className="flex-1">
              Créer
            </PrimaryPill>
            <SoftPill onClick={() => setNewOpen(false)} className="flex-1">Annuler</SoftPill>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Nom du fournisseur" htmlFor="new-supplier">
            <TextInput id="new-supplier" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </FormField>
          <PhoneInputWithCountry label="Téléphone (optionnel)" value={newPhone} onValueChange={setNewPhone} defaultDialCode="+237" />
        </div>
      </CenterDialog>
    </div>
  );
}
