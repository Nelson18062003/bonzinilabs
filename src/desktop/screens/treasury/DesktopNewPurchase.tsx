/**
 * Nouvel achat USDT — en FENÊTRE par-dessus le module (voir
 * `TreasuryEntryDialog` pour le pourquoi).
 *
 * Quatre décisions, dans l'ordre : le fournisseur, le compte XAF débité, le
 * montant, la date. Le pied de fenêtre montre ce que la saisie FAIT au stock —
 * le WAC avant → après, parce qu'acheter au-dessus du coût moyen renchérit
 * tout le stock, et c'est la conséquence réelle qu'on doit voir avant de
 * valider.
 *
 * La LOGIQUE FINANCIÈRE ne bouge pas (déjà validée sur mobile) :
 *   · compte unique — 3 modes : XAF+USDT → taux · XAF+taux → USDT · USDT+taux → XAF
 *   · multi-comptes — le total XAF vient des lignes, on saisit l'USDT OU le taux
 *   · WAC après = (stock × WAC + XAF payé) / (stock + USDT reçu)
 */
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowLineDown, Plus, Trash } from '@phosphor-icons/react';
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
import { NUM, T, TONE, MChip, MButton, MDialog, MField, MInput } from './marketKit';
import { fmtNum, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryMoneyInput } from './TreasuryMoneyInput';
import { TreasurySelect } from './TreasurySelect';
import { treasuryPaths } from './treasuryNav';
import { TreasuryEntryDialog, EntryStep, EntryComputed, EntryStat, EntryLink } from './TreasuryEntryDialog';

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

export function DesktopNewPurchase({ onClose }: { onClose: () => void }) {
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
  const [noteOpen, setNoteOpen] = useState(false);

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
    return <Navigate to={treasuryPaths.operations} replace />;
  }

  // WAC après l'achat : (valeur du stock + XAF payé) / (stock + USDT reçu).
  const wacAfter =
    wac !== undefined && stock !== undefined && resolved.xaf && resolved.usdt && stock + resolved.usdt > 0
      ? (stock * wac + resolved.xaf) / (stock + resolved.usdt)
      : null;
  const wacDelta = wacAfter !== null && wac !== undefined ? wacAfter - wac : null;
  const stockAfter = stock !== undefined && resolved.usdt ? stock + resolved.usdt : stock;

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
    if (result.success) onClose();
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

  // Quels champs on tape, et laquelle des trois grandeurs en découle.
  const showXaf = !multi && (singleMode === 'xaf_usdt' || singleMode === 'xaf_rate');
  const showUsdt = multi ? multiInput === 'usdt' : singleMode === 'xaf_usdt' || singleMode === 'usdt_rate';
  const showRate = multi ? multiInput === 'rate' : singleMode === 'xaf_rate' || singleMode === 'usdt_rate';
  const derived: { label: string; value: string; unit: string } =
    (!multi && singleMode === 'xaf_usdt') || (multi && multiInput === 'usdt')
      ? { label: 'Taux effectif', value: fmtNum(resolved.rate, RATE_DECIMALS.xafPerUsdt), unit: 'XAF/USDT' }
      : (!multi && singleMode === 'xaf_rate') || (multi && multiInput === 'rate')
        ? { label: 'USDT reçu', value: fmtNum(resolved.usdt, 2), unit: 'USDT' }
        : { label: 'XAF payé', value: fmtNum(resolved.xaf, 0), unit: 'XAF' };

  return (
    <TreasuryEntryDialog
      title="Nouvel achat USDT"
      description="Entrée de stock : XAF payé → USDT reçu"
      icon={ArrowLineDown}
      tone="purchase"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <EntryStat
              label="WAC actuel → après"
              value={
                <>
                  {fmtNum(wac, RATE_DECIMALS.xafPerUsdt)}
                  <span className={cn('mx-1.5 font-normal', T.faint)}>→</span>
                  {fmtNum(wacAfter, RATE_DECIMALS.xafPerUsdt)}
                  {wacDelta !== null && (
                    <span className={cn('ml-1.5 text-[11px] font-semibold', wacDelta > 0 ? TONE.sale : TONE.positive)}>
                      ({wacDelta > 0 ? '+' : ''}
                      {fmtNum(wacDelta, RATE_DECIMALS.xafPerUsdt)})
                    </span>
                  )}
                </>
              }
              unit="XAF/USDT"
            />
            <EntryStat label="Stock après" value={fmtNum(stockAfter, 2)} unit="USDT" />
          </div>
          <div className="flex items-center gap-2">
            <MButton onClick={onClose}>Annuler</MButton>
            <MButton variant="primary" onClick={handleSubmit} disabled={!valid} loading={submit.isPending}>
              Enregistrer l'achat
            </MButton>
          </div>
        </div>
      }
    >
      <EntryStep
        n={1}
        title="Fournisseur"
        aside={
          <EntryLink onClick={() => setNewOpen(true)}>
            <Plus className="size-3" /> Nouveau fournisseur
          </EntryLink>
        }
      >
        <TreasurySelect
          id="pu-supplier"
          value={supplierId}
          onChange={setSupplierId}
          options={(suppliers ?? []).map((s) => ({ value: s.id, label: `${s.short_id} · ${s.display_name}` }))}
          placeholder="Choisir le fournisseur USDT…"
        />
      </EntryStep>

      <EntryStep
        n={2}
        title="Compte XAF débité"
        aside={
          multi ? (
            <EntryLink onClick={() => setMulti(false)}>Un seul compte</EntryLink>
          ) : (
            <EntryLink onClick={() => setMulti(true)}>
              <Plus className="size-3" /> Répartir sur plusieurs comptes
            </EntryLink>
          )
        }
      >
        {!multi ? (
          <TreasurySelect
            id="pu-account"
            value={singleAccountId}
            onChange={setSingleAccountId}
            options={accountOptions}
            placeholder="Choisir le compte…"
          />
        ) : (
          <div className="space-y-2">
            {splits.map((row, idx) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_180px_28px] items-center gap-2">
                <TreasurySelect
                  value={row.accountId}
                  onChange={(v) => updateSplit(row.key, { accountId: v })}
                  options={accountOptions}
                  placeholder={`Compte ${idx + 1}…`}
                />
                <TreasuryMoneyInput currency="XAF" value={row.amount} onValueChange={(v) => updateSplit(row.key, { amount: v })} decimals={0} />
                <button
                  type="button"
                  onClick={() => setSplits((rows) => rows.filter((r) => r.key !== row.key))}
                  disabled={splits.length <= 1}
                  aria-label={`Retirer le compte ${idx + 1}`}
                  className={cn('flex size-7 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30', TONE.negative)}
                >
                  <Trash className="size-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <EntryLink onClick={() => setSplits((rows) => [...rows, newSplit()])}>
                <Plus className="size-3" /> Ajouter un compte
              </EntryLink>
              <span className={cn('text-[11.5px]', T.muted)}>
                Total{' '}
                <span className={cn(NUM, 'font-semibold', T.ink)}>{fmtNum(multiTotalXaf, 0)}</span> XAF
              </span>
            </div>
          </div>
        )}
      </EntryStep>

      <EntryStep
        n={3}
        title="Montant"
        aside={
          <div className="flex flex-wrap items-center gap-1">
            {!multi ? (
              SINGLE_MODES.map((m) => (
                <MChip key={m.value} label={m.label} active={singleMode === m.value} onClick={() => setSingleMode(m.value)} />
              ))
            ) : (
              <>
                <MChip label="USDT reçu" active={multiInput === 'usdt'} onClick={() => setMultiInput('usdt')} />
                <MChip label="Taux" active={multiInput === 'rate'} onClick={() => setMultiInput('rate')} />
              </>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {showXaf && (
            <MField label="XAF payé" htmlFor="pu-xaf">
              <TreasuryMoneyInput id="pu-xaf" currency="XAF" value={xafAmount} onValueChange={setXafAmount} decimals={0} />
            </MField>
          )}
          {showUsdt && (
            <MField label="USDT reçu" htmlFor="pu-usdt">
              <TreasuryMoneyInput id="pu-usdt" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} decimals={2} />
            </MField>
          )}
          {showRate && (
            <MField label="Taux" htmlFor="pu-rate">
              <TreasuryMoneyInput id="pu-rate" currency="XAF/USDT" value={rate} onValueChange={setRate} decimals={2} />
            </MField>
          )}
        </div>
        {multi && <EntryComputed label="XAF payé · total des comptes" value={fmtNum(resolved.xaf, 0)} unit="XAF" />}
        <EntryComputed label={derived.label} value={derived.value} unit={derived.unit} />
      </EntryStep>

      <EntryStep n={4} title="Date et référence">
        <div className="grid grid-cols-2 gap-3">
          <MField label="Date de l'opération" htmlFor="pu-occurred-at" hint="Antidatable : la date réelle de l'achat.">
            <DateTimePicker id="pu-occurred-at" value={occurredAt} onChange={setOccurredAt} />
          </MField>
          <MField label="Référence externe" htmlFor="pu-ref" hint="Binance, hash… (optionnel)">
            <MInput id="pu-ref" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
          </MField>
        </div>
        {noteOpen || notes ? (
          <MField label="Note" htmlFor="pu-note">
            <MInput id="pu-note" value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus={noteOpen} />
          </MField>
        ) : (
          <EntryLink onClick={() => setNoteOpen(true)}>
            <Plus className="size-3" /> Ajouter une note
          </EntryLink>
        )}
      </EntryStep>

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
    </TreasuryEntryDialog>
  );
}
