/**
 * Desktop admin — Nouvel achat USDT (archétype C : page de création),
 * habillage « salle des marchés ».
 *
 * Remplace le montage du wizard téléphone sur la route desktop. Deux zones :
 * les décisions à gauche, un RÉCAPITULATIF VIVANT collé à droite.
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
import { ArrowLeft, Plus, Trash as Trash2 } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { PhoneInputWithCountry } from '@/components/form';
import { DateTimePicker } from '@/components/ui/date-time-picker';
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
import { M, T, NUM, TONE, MCard, MCardHeader, MChip, MButton, MSection, MDialog, MField, MInput, MIcons, M_PAGE } from './marketKit';
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
      <span className={cn('text-[11.5px]', T.muted)}>{label}</span>
      <span className={cn(NUM, strong ? cn('text-[14px] font-bold', T.ink) : cn('text-[12.5px] font-semibold', T.body))}>
        {value}
        {unit && <span className={cn('ml-1 text-[10px] font-normal', T.faint)}>{unit}</span>}
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
    <MIcons>
    <div className={cn(M_PAGE, T.ink)}>
      <div className="mx-auto max-w-[1080px] space-y-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/m/more/treasury')}
          aria-label="Retour à la trésorerie"
          className={cn('flex h-8 w-8 items-center justify-center rounded-[6px] border', M.border, T.body)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div>
          <h2 className={cn('text-[19px] font-bold tracking-[-0.02em]', T.ink)}>Nouvel achat USDT</h2>
          <p className={cn('mt-0.5 text-[12.5px]', T.muted)}>Entrée de stock : XAF payé → USDT reçu</p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ── Décisions ── */}
        <div className="space-y-3">
          <MCard>
            <MCardHeader title="Fournisseur" />
            <div className="flex items-end gap-2 p-4">
              <MField label="Fournisseur USDT" htmlFor="supplier" className="flex-1">
                <TreasurySelect
                  id="supplier"
                  value={supplierId}
                  onChange={setSupplierId}
                  options={(suppliers ?? []).map((s) => ({ value: s.id, label: `${s.short_id} · ${s.display_name}` }))}
                />
              </MField>
              <MButton onClick={() => setNewOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Nouveau
              </MButton>
            </div>
          </MCard>

          <MCard>
            <MCardHeader title="Compte XAF débité" meta={multi ? `${splits.length} compte${splits.length > 1 ? 's' : ''}` : undefined} />
            <div className="space-y-3 p-4">
              {!multi ? (
                <>
                  <MField label="Compte" htmlFor="account">
                    <TreasurySelect id="account" value={singleAccountId} onChange={setSingleAccountId} options={accountOptions} />
                  </MField>
                  <button type="button" onClick={() => setMulti(true)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary underline-offset-2 hover:underline">
                    <Plus className="h-3 w-3" /> Répartir sur plusieurs comptes
                  </button>
                </>
              ) : (
                <>
                  {splits.map((row, idx) => (
                    <div key={row.key} className={cn('space-y-2 rounded-[6px] border p-3', M.border, M.inset)}>
                      <MSection
                        right={
                          splits.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setSplits((rows) => rows.filter((r) => r.key !== row.key))}
                              aria-label={`Retirer le compte ${idx + 1}`}
                              className={TONE.negative}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : undefined
                        }
                      >
                        Compte {idx + 1}
                      </MSection>
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
                    <MButton onClick={() => setSplits((rows) => [...rows, newSplit()])}>
                      <Plus className="h-3.5 w-3.5" /> Ajouter un compte
                    </MButton>
                    <button type="button" onClick={() => setMulti(false)} className="text-[11.5px] font-semibold text-primary underline-offset-2 hover:underline">
                      ← Un seul compte
                    </button>
                  </div>
                </>
              )}
            </div>
          </MCard>

          <MCard>
            <MCardHeader title="Montant" meta={multi ? 'Le total XAF vient des comptes' : undefined} />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', T.muted)}>Je saisis</span>
                {!multi
                  ? SINGLE_MODES.map((m) => (
                      <MChip key={m.value} label={m.label} active={singleMode === m.value} onClick={() => setSingleMode(m.value)} />
                    ))
                  : (
                    <>
                      <MChip label="USDT reçu" active={multiInput === 'usdt'} onClick={() => setMultiInput('usdt')} />
                      <MChip label="Taux" active={multiInput === 'rate'} onClick={() => setMultiInput('rate')} />
                    </>
                  )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!multi && (singleMode === 'xaf_usdt' || singleMode === 'xaf_rate') && (
                  <MField label="XAF payé" htmlFor="xaf">
                    <TreasuryMoneyInput id="xaf" currency="XAF" value={xafAmount} onValueChange={setXafAmount} decimals={0} />
                  </MField>
                )}
                {((!multi && (singleMode === 'xaf_usdt' || singleMode === 'usdt_rate')) || (multi && multiInput === 'usdt')) && (
                  <MField label="USDT reçu" htmlFor="usdt">
                    <TreasuryMoneyInput id="usdt" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} decimals={2} />
                  </MField>
                )}
                {((!multi && (singleMode === 'xaf_rate' || singleMode === 'usdt_rate')) || (multi && multiInput === 'rate')) && (
                  <MField label="Taux" htmlFor="rate">
                    <TreasuryMoneyInput id="rate" currency="XAF/USDT" value={rate} onValueChange={setRate} decimals={2} />
                  </MField>
                )}
              </div>
            </div>
          </MCard>

          <MCard>
            <MCardHeader title="Détails" meta="Date · référence · note" />
            <div className="space-y-3 p-4">
              <MField label="Date / heure de l'opération" htmlFor="occurred-at">
                <DateTimePicker id="occurred-at" value={occurredAt} onChange={setOccurredAt} />
              </MField>
              <p className={cn('text-[11.5px]', T.muted)}>Antidatable — saisissez la date réelle de l'achat, pas celle de la saisie.</p>
              <div className="grid grid-cols-2 gap-3">
                <MField label="Référence externe" hint="Binance, hash…">
                  <MInput value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
                </MField>
                <MField label="Note">
                  <MInput value={notes} onChange={(e) => setNotes(e.target.value)} />
                </MField>
              </div>
            </div>
          </MCard>
        </div>

        {/* ── Récapitulatif vivant ── */}
        <div className="lg:sticky lg:top-4">
          <MCard>
            <MCardHeader title="Récapitulatif" />
            <div className="space-y-2.5 p-4">
              <RecapRow label="XAF payé" value={fmtNum(resolved.xaf, 0)} unit="XAF" strong />
              <RecapRow label="USDT reçu" value={fmtNum(resolved.usdt, 2)} unit="USDT" strong />
              <div className={cn('border-t pt-2.5', M.border)}>
                <RecapRow label="Taux effectif" value={fmtNum(resolved.rate, RATE_DECIMALS.xafPerUsdt)} unit="XAF/USDT" />
              </div>

              <div className={cn('border-t pt-2.5', M.border)}>
                <MSection>Effet sur le stock</MSection>
                <div className="mt-2 space-y-2">
                  <RecapRow label="WAC actuel" value={fmtNum(wac, RATE_DECIMALS.xafPerUsdt)} unit="XAF/USDT" />
                  <RecapRow label="WAC après achat" value={fmtNum(wacAfter, RATE_DECIMALS.xafPerUsdt)} unit="XAF/USDT" />
                  {wacDelta !== null && (
                    <div className={cn('flex items-center justify-between rounded-[4px] px-2.5 py-1.5 text-[11.5px] font-semibold', M.inset)}>
                      <span className={T.muted}>{wacDelta > 0 ? 'Renchérit le stock' : 'Abaisse le coût du stock'}</span>
                      <span className={cn(NUM, 'font-bold', wacDelta > 0 ? TONE.sale : TONE.positive)}>
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

              <MButton variant="primary" onClick={handleSubmit} disabled={!valid} loading={submit.isPending} className="w-full">
                Enregistrer l'achat
              </MButton>
            </div>
          </MCard>
        </div>
      </div>

      {/* Créer un fournisseur sans quitter la saisie */}
      <MDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onConfirm={handleCreateSupplier}
        title="Nouveau fournisseur USDT"
        footer={
          <>
            <MButton variant="primary" onClick={handleCreateSupplier} disabled={!newName.trim()} loading={create.isPending} className="flex-1">
              Créer
            </MButton>
            <MButton onClick={() => setNewOpen(false)} className="flex-1">Annuler</MButton>
          </>
        }
      >
        <div className="space-y-3">
          <MField label="Nom du fournisseur" htmlFor="new-supplier">
            <MInput id="new-supplier" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </MField>
          <PhoneInputWithCountry label="Téléphone (optionnel)" value={newPhone} onValueChange={setNewPhone} defaultDialCode="+237" />
        </div>
      </MDialog>
      </div>
    </div>
    </MIcons>
  );
}
