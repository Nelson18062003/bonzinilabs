/**
 * Nouvelle vente USDT — en FENÊTRE par-dessus le module (voir
 * `TreasuryEntryDialog` pour le pourquoi).
 *
 * Quatre décisions : l'acheteur, le montant, le compte CNY crédité (optionnel
 * — le cas courant est qu'aucun compte Bonzini n'est concerné), la date. Le
 * pied de fenêtre montre le STOCK APRÈS LA VENTE : avant, l'opérateur ne
 * découvrait un stock négatif qu'après l'enregistrement, dans un toast.
 *
 * Logique reprise à l'identique du mobile : 3 modes (USDT+CNY → taux,
 * USDT+taux → CNY, CNY+taux → USDT).
 */
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowLineUp, Plus, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { PhoneInputWithCountry } from '@/components/form';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useCreateCounterparty,
  useRecordUsdtSale,
  useTreasuryAccounts,
  useUsdtStock,
  useUsdtWac,
} from '@/hooks/useTreasury';
import { NUM, T, TONE, MChip, MButton, MDialog, MField, MInput } from './marketKit';
import { fmtNum, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryMoneyInput } from './TreasuryMoneyInput';
import { TreasurySelect } from './TreasurySelect';
import { treasuryPaths } from './treasuryNav';
import { TreasuryEntryDialog, EntryStep, EntryComputed, EntryStat, EntryLink } from './TreasuryEntryDialog';

type Mode = 'usdt_cny' | 'usdt_rate' | 'cny_rate';

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 'usdt_cny', label: 'USDT + CNY' },
  { value: 'usdt_rate', label: 'USDT + taux' },
  { value: 'cny_rate', label: 'CNY + taux' },
];

/** Valeur sentinelle du Select : Radix n'accepte pas la chaîne vide. */
const NO_ACCOUNT = '__none__';

export function DesktopNewSale({ onClose }: { onClose: () => void }) {
  const { hasPermission } = useAdminAuth();
  const { data: buyers } = useCounterparties('cny_buyer');
  const { data: cnyAccounts } = useTreasuryAccounts('CNY');
  const { data: wac } = useUsdtWac();
  const { data: stock } = useUsdtStock();
  const create = useCreateCounterparty();
  const submit = useRecordUsdtSale();

  const [buyerId, setBuyerId] = useState('');
  const [cnyAccountId, setCnyAccountId] = useState('');
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString());
  const [mode, setMode] = useState<Mode>('usdt_cny');
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [cnyAmount, setCnyAmount] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);
  const [newWechat, setNewWechat] = useState('');

  const resolved = useMemo(() => {
    if (mode === 'usdt_cny') {
      const r = usdtAmount && cnyAmount && usdtAmount > 0 ? cnyAmount / usdtAmount : null;
      return { usdt: usdtAmount, cny: cnyAmount, rate: r };
    }
    if (mode === 'usdt_rate') {
      const c = usdtAmount && rate && rate > 0 ? usdtAmount * rate : null;
      return { usdt: usdtAmount, cny: c, rate };
    }
    const u = cnyAmount && rate && rate > 0 ? cnyAmount / rate : null;
    return { usdt: u, cny: cnyAmount, rate };
  }, [mode, usdtAmount, cnyAmount, rate]);

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to={treasuryPaths.operations} replace />;
  }

  const costBasis = wac !== undefined && resolved.usdt ? resolved.usdt * wac : null;
  const stockAfter = stock !== undefined && resolved.usdt !== null ? stock - resolved.usdt : null;
  const willGoNegative = stockAfter !== null && stockAfter < 0;

  const valid = !!buyerId && resolved.usdt !== null && resolved.usdt > 0 && resolved.cny !== null && resolved.cny > 0;

  const handleSubmit = async () => {
    if (!valid || resolved.usdt === null || resolved.cny === null || submit.isPending) return;
    const result = await submit.mutateAsync({
      buyer_id: buyerId,
      cny_account_id: cnyAccountId || null,
      usdt_amount: resolved.usdt,
      cny_amount: resolved.cny,
      occurred_at: occurredAt,
      external_ref: externalRef || undefined,
      notes: notes || undefined,
    });
    if (result.success) onClose();
  };

  const handleCreateBuyer = async () => {
    if (!newName.trim() || create.isPending) return;
    const result = await create.mutateAsync({
      type: 'cny_buyer',
      display_name: newName.trim(),
      legal_name: newCompany.trim() || undefined,
      phone: newPhone ?? undefined,
      wechat_id: newWechat.trim() || undefined,
    });
    if (result.success && result.id) {
      setBuyerId(result.id);
      setNewOpen(false);
      setNewName('');
      setNewCompany('');
      setNewPhone(null);
      setNewWechat('');
    }
  };

  const derived: { label: string; value: string; unit: string } =
    mode === 'usdt_cny'
      ? { label: 'Taux effectif', value: fmtNum(resolved.rate, RATE_DECIMALS.cnyPerUsdt), unit: 'CNY/USDT' }
      : mode === 'usdt_rate'
        ? { label: 'CNY reçu', value: fmtNum(resolved.cny, 2), unit: 'CNY' }
        : { label: 'USDT vendu', value: fmtNum(resolved.usdt, 2), unit: 'USDT' };

  return (
    <TreasuryEntryDialog
      title="Nouvelle vente USDT"
      description="Sortie de stock : USDT vendu → CNY reçu"
      icon={ArrowLineUp}
      tone="sale"
      onClose={onClose}
      footer={
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <EntryStat label="Coût de revient (au WAC)" value={fmtNum(costBasis, 0)} unit="XAF" />
              <EntryStat
                label="Stock actuel → après"
                value={
                  <>
                    {fmtNum(stock, 2)}
                    <span className={cn('mx-1.5 font-normal', T.faint)}>→</span>
                    {fmtNum(stockAfter, 2)}
                  </>
                }
                unit="USDT"
                tone={willGoNegative ? 'negative' : 'neutral'}
              />
            </div>
            <div className="flex items-center gap-2">
              <MButton onClick={onClose}>Annuler</MButton>
              <MButton variant="primary" onClick={handleSubmit} disabled={!valid} loading={submit.isPending}>
                Enregistrer la vente
              </MButton>
            </div>
          </div>
          {willGoNegative && (
            <p className={cn('flex items-start gap-1.5 text-[11.5px] font-medium leading-snug', TONE.negative)}>
              <Warning className="mt-0.5 size-3.5 shrink-0" weight="bold" />
              <span>
                Cette vente rendrait le stock négatif (<span className={NUM}>{fmtNum(stockAfter, 2)}</span> USDT). Il manque
                probablement un achat au journal — saisissez-le d'abord, sinon le WAC et le bénéfice seront faux.
              </span>
            </p>
          )}
        </div>
      }
    >
      <EntryStep
        n={1}
        title="Acheteur"
        aside={
          <EntryLink onClick={() => setNewOpen(true)}>
            <Plus className="size-3" /> Nouvel acheteur
          </EntryLink>
        }
      >
        <TreasurySelect
          id="sa-buyer"
          value={buyerId}
          onChange={setBuyerId}
          options={(buyers ?? []).map((b) => ({
            value: b.id,
            label: `${b.display_name}${b.wechat_id ? ` · ${b.wechat_id}` : b.phone ? ` · ${b.phone}` : ''}`,
          }))}
          placeholder="Choisir l'acheteur CNY…"
        />
      </EntryStep>

      <EntryStep
        n={2}
        title="Montant"
        aside={
          <div className="flex flex-wrap items-center gap-1">
            {MODES.map((m) => (
              <MChip key={m.value} label={m.label} active={mode === m.value} onClick={() => setMode(m.value)} />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {(mode === 'usdt_cny' || mode === 'usdt_rate') && (
            <MField label="USDT vendu" htmlFor="sa-usdt">
              <TreasuryMoneyInput id="sa-usdt" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} decimals={2} />
            </MField>
          )}
          {(mode === 'usdt_cny' || mode === 'cny_rate') && (
            <MField label="CNY reçu" htmlFor="sa-cny">
              <TreasuryMoneyInput id="sa-cny" currency="CNY" value={cnyAmount} onValueChange={setCnyAmount} decimals={2} />
            </MField>
          )}
          {(mode === 'usdt_rate' || mode === 'cny_rate') && (
            <MField label="Taux" htmlFor="sa-rate">
              <TreasuryMoneyInput id="sa-rate" currency="CNY/USDT" value={rate} onValueChange={setRate} decimals={4} />
            </MField>
          )}
        </div>
        <EntryComputed label={derived.label} value={derived.value} unit={derived.unit} />
      </EntryStep>

      <EntryStep n={3} title="Compte CNY crédité">
        <MField
          label="Compte"
          htmlFor="sa-cny-account"
          hint="Seulement si le CNY a atterri sur un compte Bonzini (cash Guangzhou, Alipay/WeChat…)."
        >
          <TreasurySelect
            id="sa-cny-account"
            value={cnyAccountId || NO_ACCOUNT}
            onChange={(v) => setCnyAccountId(v === NO_ACCOUNT ? '' : v)}
            options={[
              { value: NO_ACCOUNT, label: 'Aucun compte Bonzini concerné' },
              ...(cnyAccounts ?? []).map((a) => ({ value: a.id, label: a.label })),
            ]}
          />
        </MField>
      </EntryStep>

      <EntryStep n={4} title="Date et référence">
        <div className="grid grid-cols-2 gap-3">
          <MField label="Date de l'opération" htmlFor="sa-occurred-at" hint="Antidatable : la date réelle de la vente.">
            <DateTimePicker id="sa-occurred-at" value={occurredAt} onChange={setOccurredAt} />
          </MField>
          <MField label="Référence externe" htmlFor="sa-ref" hint="Optionnel">
            <MInput id="sa-ref" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
          </MField>
        </div>
        {noteOpen || notes ? (
          <MField label="Note" htmlFor="sa-note">
            <MInput id="sa-note" value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus={noteOpen} />
          </MField>
        ) : (
          <EntryLink onClick={() => setNoteOpen(true)}>
            <Plus className="size-3" /> Ajouter une note
          </EntryLink>
        )}
      </EntryStep>

      <MDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onConfirm={handleCreateBuyer}
        title="Nouvel acheteur CNY"
        footer={
          <>
            <MButton variant="primary" onClick={handleCreateBuyer} disabled={!newName.trim()} loading={create.isPending} className="flex-1">
              Créer
            </MButton>
            <MButton onClick={() => setNewOpen(false)} className="flex-1">Annuler</MButton>
          </>
        }
      >
        <div className="space-y-3">
          <MField label="Nom" htmlFor="new-buyer">
            <MInput id="new-buyer" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </MField>
          <MField label="Entreprise (optionnel)">
            <MInput value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
          </MField>
          <PhoneInputWithCountry label="Téléphone (optionnel)" value={newPhone} onValueChange={setNewPhone} defaultDialCode="+86" />
          <MField label="WeChat ID (optionnel)">
            <MInput value={newWechat} onChange={(e) => setNewWechat(e.target.value)} />
          </MField>
        </div>
      </MDialog>
    </TreasuryEntryDialog>
  );
}
