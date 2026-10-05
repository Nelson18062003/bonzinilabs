/**
 * Nouvelle vente d'USDT — panneau latéral en quatre étapes, frère de
 * l'achat : l'acheteur, le montant (deux valeurs tapées, la troisième
 * calculée), le compte CNY qui encaisse (facultatif), la date.
 *
 * Le stock après la vente est montré PENDANT la saisie : vendre plus que le
 * stock reste possible (l'achat peut être saisi après), mais jamais sans le
 * voir. Arrondis : USDT et CNY à deux décimales.
 */
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCounterparties, useRecordUsdtSale, useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { BTN, TK } from './tstyle';
import {
  AmountInput,
  Computed,
  Confirm,
  Field,
  Notice,
  Picker,
  Segmented,
  SideSheet,
  Step,
  SubmitButton,
  TextArea,
  TextInput,
  TextLink,
  WhenField,
} from './tkit';
import { QuickCounterparty } from './CounterpartyForm';
import { fmtNum } from './treasuryFormat';

type Mode = 'usdt_rate' | 'cny_rate' | 'usdt_cny';
const round2 = (n: number) => Math.round(n * 100) / 100;

export function SaleForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SaleFormBody onClose={onClose} />;
}

function SaleFormBody({ onClose }: { onClose: () => void }) {
  const buyers = useCounterparties('cny_buyer');
  const balances = useTreasuryAccountBalances();
  const wac = useUsdtWac();
  const stock = useUsdtStock();
  const submit = useRecordUsdtSale();

  const [buyerId, setBuyerId] = useState('');
  const [quick, setQuick] = useState(false);
  const [mode, setMode] = useState<Mode>('usdt_rate');
  const [usdtIn, setUsdtIn] = useState<number | null>(null);
  const [cnyIn, setCnyIn] = useState<number | null>(null);
  const [rateIn, setRateIn] = useState<number | null>(null);
  const [accountId, setAccountId] = useState('');
  const [at, setAt] = useState(() => new Date().toISOString());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const r = useMemo(() => {
    if (mode === 'usdt_rate') return { usdt: usdtIn, cny: usdtIn && rateIn ? round2(usdtIn * rateIn) : null, rate: rateIn };
    if (mode === 'cny_rate') return { usdt: cnyIn && rateIn ? round2(cnyIn / rateIn) : null, cny: cnyIn, rate: rateIn };
    return { usdt: usdtIn, cny: cnyIn, rate: usdtIn && cnyIn ? cnyIn / usdtIn : null };
  }, [mode, usdtIn, cnyIn, rateIn]);

  const accounts = (balances.data ?? []).filter((b) => b.currency === 'CNY' && b.is_active !== false && b.id);
  const buyer = (buyers.data ?? []).find((b) => b.id === buyerId);
  const account = accounts.find((a) => a.id === accountId);

  const stockNow = stock.data ?? null;
  const wacNow = wac.data ?? null;
  const stockAfter = stockNow !== null && r.usdt ? round2(stockNow - r.usdt) : null;
  const negative = stockAfter !== null && stockAfter < 0;
  const costXaf = wacNow !== null && r.usdt ? Math.round(r.usdt * wacNow) : null;

  const errors = {
    buyer: !buyerId ? 'Choisissez l’acheteur.' : null,
    amount: !r.usdt || r.usdt <= 0 || !r.cny || r.cny <= 0 ? 'Complétez les deux valeurs du montant.' : null,
  };
  const valid = !errors.buyer && !errors.amount;
  const dirty = !!(buyerId || usdtIn || cnyIn || rateIn || accountId || ref || notes);
  const recap = valid
    ? `Vente de ${fmtNum(r.usdt, 2)} USDT à ${fmtNum(r.rate, 4)} CNY à ${buyer?.short_id ?? ''} · ${buyer?.display_name ?? ''}, ${fmtNum(r.cny, 2)} CNY ${account ? `encaissés sur ${account.label}` : 'sans compte CNY indiqué'}.`
    : null;

  const review = () => {
    setTried(true);
    if (valid) setReviewing(true);
  };
  const save = () => {
    if (!valid || !r.usdt || !r.cny || submit.isPending) return;
    submit.mutate(
      {
        buyer_id: buyerId,
        cny_account_id: accountId || null,
        usdt_amount: r.usdt,
        cny_amount: r.cny,
        occurred_at: at,
        external_ref: ref.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <SideSheet
      open
      onClose={onClose}
      title="Nouvelle vente d’USDT"
      description="Des USDT sortent du pool, des CNY arrivent sur un compte."
      dirty={dirty}
      footer={
        <div className="space-y-3">
          {recap ? (
            <p className="text-[13.5px] leading-snug">
              <span className="font-bold">Récapitulatif : </span>
              {recap}
            </p>
          ) : (
            tried && <p className="text-[13px] font-medium text-red-700 dark:text-red-400">Il manque des informations : voir les étapes en rouge.</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN.soft} onClick={onClose}>
              Fermer
            </button>
            <SubmitButton onClick={review} busy={submit.isPending}>
              Vérifier et enregistrer
            </SubmitButton>
          </div>
        </div>
      }
    >
      <Step n={1} title="Acheteur">
        <Field label="Acheteur" htmlFor="sa-buyer" error={tried ? errors.buyer : null}>
          <Picker
            id="sa-buyer"
            variant="field"
            value={buyerId}
            onChange={setBuyerId}
            options={(buyers.data ?? []).map((b) => ({ value: b.id, label: b.display_name, tag: b.short_id }))}
            placeholder={buyers.isLoading ? 'Chargement…' : 'Choisir l’acheteur CNY…'}
            searchable
            invalid={tried && !!errors.buyer}
          />
        </Field>
        {quick ? (
          <QuickCounterparty
            type="cny_buyer"
            onCancel={() => setQuick(false)}
            onCreated={(id) => {
              setBuyerId(id);
              setQuick(false);
            }}
          />
        ) : (
          <TextLink onClick={() => setQuick(true)}>
            <Plus className="h-4 w-4" /> Nouvel acheteur
          </TextLink>
        )}
      </Step>

      <Step n={2} title="Montant" hint="Tapez deux valeurs, la troisième se calcule.">
        <Segmented
          ariaLabel="Ce que vous tapez"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'usdt_rate', label: 'USDT + taux' },
            { value: 'cny_rate', label: 'CNY + taux' },
            { value: 'usdt_cny', label: 'USDT + CNY' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          {mode !== 'cny_rate' && (
            <Field label="USDT vendus" htmlFor="sa-usdt">
              <AmountInput id="sa-usdt" value={usdtIn} onChange={setUsdtIn} unit="USDT" decimals={2} invalid={tried && !r.usdt} />
            </Field>
          )}
          {mode !== 'usdt_rate' && (
            <Field label="CNY reçus" htmlFor="sa-cny">
              <AmountInput id="sa-cny" value={cnyIn} onChange={setCnyIn} unit="CNY" decimals={2} invalid={tried && !r.cny} />
            </Field>
          )}
          {mode !== 'usdt_cny' && (
            <Field label="Taux" htmlFor="sa-rate">
              <AmountInput id="sa-rate" value={rateIn} onChange={setRateIn} unit="CNY / USDT" decimals={4} invalid={tried && !rateIn} />
            </Field>
          )}
        </div>
        {mode === 'usdt_rate' && <Computed label="Vous recevez">{r.cny ? `${fmtNum(r.cny, 2)} CNY` : '—'}</Computed>}
        {mode === 'cny_rate' && <Computed label="Vous vendez">{r.usdt ? `${fmtNum(r.usdt, 2)} USDT` : '—'}</Computed>}
        {mode === 'usdt_cny' && <Computed label="Taux obtenu">{r.rate ? `${fmtNum(r.rate, 4)} CNY / USDT` : '—'}</Computed>}
        {tried && errors.amount && <div className="text-[12.5px] font-medium text-red-700 dark:text-red-400">{errors.amount}</div>}
        {stockNow !== null && (
          <div className={cn('flex items-center justify-between text-[13px]', TK.num)}>
            <span className="text-muted-foreground">Stock USDT</span>
            <span className={cn('font-semibold', negative && TK.warn)}>
              {fmtNum(stockNow, 2)} → {stockAfter !== null ? fmtNum(stockAfter, 2) : '…'}
            </span>
          </div>
        )}
        {negative && <Notice>Cette vente dépasse le stock : il deviendra négatif. Enregistrez ensuite l’achat qui l’a alimentée.</Notice>}
      </Step>

      <Step n={3} title="Encaissé sur" hint="Le compte CNY qui reçoit les yuans. Facultatif.">
        <Picker
          variant="field"
          value={accountId}
          onChange={setAccountId}
          options={accounts.map((a) => ({ value: a.id!, label: a.label ?? '—', hint: `solde ${fmtNum(Number(a.balance ?? 0), 2)}` }))}
          allLabel="Aucun compte CNY"
          placeholder="Aucun compte CNY"
          ariaLabel="Compte CNY"
        />
      </Step>

      <Step n={4} title="Date et référence">
        <Field label="Date de la vente" htmlFor="sa-at">
          <WhenField id="sa-at" value={at} onChange={setAt} />
        </Field>
        <Field label="Référence" optional htmlFor="sa-ref">
          <TextInput id="sa-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Note" optional htmlFor="sa-notes">
          <TextArea id="sa-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Step>

      <Confirm open={reviewing} title="Enregistrer cette vente ?" confirmLabel="Enregistrer la vente" busy={submit.isPending} onCancel={() => setReviewing(false)} onConfirm={save}>
        <div className="space-y-3 text-foreground">
          <p>{recap}</p>
          <dl className={cn(TK.inset, 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 p-3 text-[13px]')}>
            <dt className="text-muted-foreground">Stock USDT</dt>
            <dd className={cn('whitespace-nowrap text-right font-semibold', TK.num, negative && TK.warn)}>
              {fmtNum(stockNow, 2)} → {fmtNum(stockAfter, 2)}
            </dd>
            <dt className="text-muted-foreground">Coût de ces USDT (au coût moyen)</dt>
            <dd className={cn('whitespace-nowrap text-right font-semibold', TK.num)}>{costXaf !== null ? `${fmtNum(costXaf, 0)} XAF` : '—'}</dd>
          </dl>
          {negative && <Notice>Le stock deviendra négatif.</Notice>}
        </div>
      </Confirm>
    </SideSheet>
  );
}
