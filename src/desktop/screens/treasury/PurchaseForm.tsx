/**
 * Nouvel achat d'USDT — panneau latéral en quatre étapes (maquette 3).
 *
 *   1. le fournisseur (ou sa création rapide) ;
 *   2. le montant : on tape deux valeurs, la troisième se calcule ;
 *   3. le ou les comptes XAF qui ont payé — la répartition doit tomber
 *      juste sur le total ;
 *   4. la date, la référence, une note.
 *
 * « Vérifier et enregistrer » montre un récapitulatif, avec ce que l'achat
 * fait au stock et à son coût moyen, avant d'écrire quoi que ce soit.
 *
 * Arrondis : le XAF est entier, l'USDT a deux décimales. Les calculs envoyés
 * au serveur restent ceux de l'ancien formulaire (`record_usdt_purchase` :
 * l'USDT reçu et la répartition XAF par compte).
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidXafAmount } from '@/lib/amountLimits';
import {
  useCounterparties,
  useRecordUsdtPurchase,
  useTreasuryAccountBalances,
  useUsdtStock,
  useUsdtWac,
} from '@/hooks/useTreasury';
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

type Mode = 'usdt_rate' | 'xaf_rate' | 'usdt_xaf';

interface Split {
  key: number;
  accountId: string;
  amount: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function PurchaseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PurchaseFormBody onClose={onClose} />;
}

function PurchaseFormBody({ onClose }: { onClose: () => void }) {
  const suppliers = useCounterparties('usdt_supplier');
  const balances = useTreasuryAccountBalances();
  const wac = useUsdtWac();
  const stock = useUsdtStock();
  const submit = useRecordUsdtPurchase();

  const [supplierId, setSupplierId] = useState('');
  const [quick, setQuick] = useState(false);
  const [mode, setMode] = useState<Mode>('usdt_rate');
  const [usdtIn, setUsdtIn] = useState<number | null>(null);
  const [xafIn, setXafIn] = useState<number | null>(null);
  const [rateIn, setRateIn] = useState<number | null>(null);
  const [splits, setSplits] = useState<Split[]>([{ key: 0, accountId: '', amount: null }]);
  const [at, setAt] = useState(() => new Date().toISOString());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Les trois grandeurs : deux tapées, une calculée.
  const r = useMemo(() => {
    if (mode === 'usdt_rate') {
      const xaf = usdtIn && rateIn ? Math.round(usdtIn * rateIn) : null;
      return { usdt: usdtIn, xaf, rate: rateIn };
    }
    if (mode === 'xaf_rate') {
      const usdt = xafIn && rateIn ? round2(xafIn / rateIn) : null;
      return { usdt, xaf: xafIn, rate: rateIn };
    }
    const rate = usdtIn && xafIn ? xafIn / usdtIn : null;
    return { usdt: usdtIn, xaf: xafIn, rate };
  }, [mode, usdtIn, xafIn, rateIn]);

  const accounts = (balances.data ?? []).filter((b) => b.currency === 'XAF' && b.is_active !== false && b.id);
  const accountOptions = accounts.map((a) => ({ value: a.id!, label: a.label ?? '—', hint: `solde ${fmtNum(Number(a.balance ?? 0), 0)}` }));
  const multi = splits.length > 1;
  // Un seul compte : il paie tout. Plusieurs : la répartition est tapée.
  const lines = multi ? splits : splits.map((s) => ({ ...s, amount: r.xaf }));
  const allocated = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const remaining = r.xaf !== null ? r.xaf - allocated : null;

  const supplier = (suppliers.data ?? []).find((s) => s.id === supplierId);
  const errors = {
    supplier: !supplierId ? 'Choisissez le fournisseur.' : null,
    amount: !r.usdt || r.usdt <= 0 || !r.xaf || !isValidXafAmount(r.xaf, 1) ? 'Complétez les deux valeurs du montant.' : null,
    accounts: lines.some((l) => !l.accountId)
      ? 'Choisissez le compte qui a payé.'
      : new Set(lines.map((l) => l.accountId)).size !== lines.length
        ? 'Un même compte apparaît deux fois.'
        : lines.some((l) => !l.amount || !isValidXafAmount(l.amount, 1))
          ? 'Indiquez le montant payé par chaque compte.'
          : remaining !== null && remaining !== 0
            ? `La répartition doit faire ${fmtNum(r.xaf, 0)} XAF : ${remaining > 0 ? `il manque ${fmtNum(remaining, 0)} XAF` : `il y a ${fmtNum(-remaining, 0)} XAF de trop`}.`
            : null,
  };
  const valid = !errors.supplier && !errors.amount && !errors.accounts;
  const dirty = !!(supplierId || usdtIn || xafIn || rateIn || ref || notes || splits.some((s) => s.accountId));

  const wacNow = wac.data ?? null;
  const stockNow = stock.data ?? null;
  const wacAfter = wacNow !== null && stockNow !== null && r.usdt && r.xaf && stockNow + r.usdt > 0 ? (stockNow * wacNow + r.xaf) / (stockNow + r.usdt) : null;

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.label ?? '—';
  const recap = valid
    ? `Achat de ${fmtNum(r.usdt, 2)} USDT à ${fmtNum(r.rate, 2)} XAF chez ${supplier?.short_id ?? ''} · ${supplier?.display_name ?? ''}, payé ${fmtNum(r.xaf, 0)} XAF depuis ${lines.map((l) => accountName(l.accountId)).join(' + ')}.`
    : null;

  const review = () => {
    setTried(true);
    if (valid) setReviewing(true);
  };

  const save = () => {
    if (!valid || !r.usdt || submit.isPending) return;
    submit.mutate(
      {
        supplier_id: supplierId,
        usdt_amount: r.usdt,
        account_splits: lines.map((l) => ({ account_id: l.accountId, xaf_amount: l.amount ?? 0 })),
        occurred_at: at,
        external_ref: ref.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  };

  const setSplit = (key: number, patch: Partial<Split>) => setSplits((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const addSplit = () =>
    setSplits((all) => {
      // Passer à plusieurs comptes : la première ligne garde le total tapé
      // jusqu'ici, à répartir ensuite.
      const first = all.length === 1 ? [{ ...all[0], amount: r.xaf }] : all;
      return [...first, { key: Math.max(...all.map((s) => s.key)) + 1, accountId: '', amount: null }];
    });

  return (
    <SideSheet
      open
      onClose={onClose}
      title="Nouvel achat d’USDT"
      description="Des XAF sortent d’un compte, des USDT entrent dans le pool."
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
      <Step n={1} title="Fournisseur">
        <Field label="Fournisseur" htmlFor="pu-supplier" error={tried ? errors.supplier : null}>
          <Picker
            id="pu-supplier"
            variant="field"
            value={supplierId}
            onChange={setSupplierId}
            options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.display_name, tag: s.short_id }))}
            placeholder={suppliers.isLoading ? 'Chargement…' : 'Choisir le fournisseur USDT…'}
            searchable
            invalid={tried && !!errors.supplier}
          />
        </Field>
        {quick ? (
          <QuickCounterparty
            type="usdt_supplier"
            onCancel={() => setQuick(false)}
            onCreated={(id) => {
              setSupplierId(id);
              setQuick(false);
            }}
          />
        ) : (
          <TextLink onClick={() => setQuick(true)}>
            <Plus className="h-4 w-4" /> Nouveau fournisseur
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
            { value: 'xaf_rate', label: 'XAF + taux' },
            { value: 'usdt_xaf', label: 'USDT + XAF' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          {mode !== 'xaf_rate' && (
            <Field label="USDT reçus" htmlFor="pu-usdt">
              <AmountInput id="pu-usdt" value={usdtIn} onChange={setUsdtIn} unit="USDT" decimals={2} invalid={tried && !r.usdt} />
            </Field>
          )}
          {mode !== 'usdt_rate' && (
            <Field label="XAF payés" htmlFor="pu-xaf">
              <AmountInput id="pu-xaf" value={xafIn} onChange={setXafIn} unit="XAF" decimals={0} invalid={tried && !r.xaf} />
            </Field>
          )}
          {mode !== 'usdt_xaf' && (
            <Field label="Taux" htmlFor="pu-rate">
              <AmountInput id="pu-rate" value={rateIn} onChange={setRateIn} unit="XAF / USDT" decimals={2} invalid={tried && !rateIn} />
            </Field>
          )}
        </div>
        {mode === 'usdt_rate' && <Computed label="Vous payez">{r.xaf ? `${fmtNum(r.xaf, 0)} XAF` : '—'}</Computed>}
        {mode === 'xaf_rate' && <Computed label="Vous recevez">{r.usdt ? `${fmtNum(r.usdt, 2)} USDT` : '—'}</Computed>}
        {mode === 'usdt_xaf' && <Computed label="Taux obtenu">{r.rate ? `${fmtNum(r.rate, 2)} XAF / USDT` : '—'}</Computed>}
        {tried && errors.amount && <div className="text-[12.5px] font-medium text-red-700 dark:text-red-400">{errors.amount}</div>}
      </Step>

      <Step n={3} title="Payé depuis" hint="Répartissez si plusieurs comptes ont servi.">
        <div className="space-y-2">
          {splits.map((s, i) => (
            <div key={s.key} className={cn('grid items-start gap-2', multi ? 'grid-cols-[minmax(0,1fr)_190px_36px]' : 'grid-cols-1')}>
              <Picker
                variant="field"
                value={s.accountId}
                onChange={(v) => setSplit(s.key, { accountId: v })}
                options={accountOptions}
                placeholder={multi ? `Compte ${i + 1}…` : 'Choisir le compte XAF…'}
                invalid={tried && !s.accountId}
                ariaLabel={`Compte ${i + 1}`}
                compact={multi}
              />
              {multi && (
                <>
                  <AmountInput value={s.amount} onChange={(v) => setSplit(s.key, { amount: v })} unit="XAF" decimals={0} invalid={tried && !s.amount} ariaLabel={`Montant payé par le compte ${i + 1}`} />
                  <button
                    type="button"
                    className={cn(BTN.icon, 'h-11 w-9 border-transparent text-muted-foreground hover:text-red-700')}
                    onClick={() => setSplits((all) => all.filter((x) => x.key !== s.key))}
                    aria-label={`Retirer le compte ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <TextLink onClick={addSplit}>
            <Plus className="h-4 w-4" /> Ajouter un compte
          </TextLink>
          {multi && r.xaf !== null && (
            <span className={cn('text-[13px]', TK.num, remaining === 0 ? TK.in : TK.warn)}>
              {remaining === 0 ? 'Répartition complète' : `Reste à répartir : ${fmtNum(remaining, 0)} XAF`}
            </span>
          )}
        </div>
        {tried && errors.accounts && <div className="text-[12.5px] font-medium text-red-700 dark:text-red-400">{errors.accounts}</div>}
      </Step>

      <Step n={4} title="Date et référence">
        <Field label="Date de l’achat" htmlFor="pu-at">
          <WhenField id="pu-at" value={at} onChange={setAt} />
        </Field>
        <Field label="Référence" optional htmlFor="pu-ref" hint="N° d’ordre Binance, de transaction…">
          <TextInput id="pu-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Note" optional htmlFor="pu-notes">
          <TextArea id="pu-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Step>

      <Confirm
        open={reviewing}
        title="Enregistrer cet achat ?"
        confirmLabel="Enregistrer l’achat"
        busy={submit.isPending}
        onCancel={() => setReviewing(false)}
        onConfirm={save}
      >
        <div className="space-y-3 text-foreground">
          <p>{recap}</p>
          <dl className={cn(TK.inset, 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 p-3 text-[13px]')}>
            <dt className="text-muted-foreground">Stock USDT</dt>
            <dd className={cn('whitespace-nowrap text-right font-semibold', TK.num)}>
              {fmtNum(stockNow, 2)} → {stockNow !== null && r.usdt ? fmtNum(stockNow + r.usdt, 2) : '—'}
            </dd>
            <dt className="text-muted-foreground">Coût moyen (XAF / USDT)</dt>
            <dd className={cn('whitespace-nowrap text-right font-semibold', TK.num)}>
              {fmtNum(wacNow, 2)} → {fmtNum(wacAfter, 2)}
            </dd>
          </dl>
          {wacNow !== null && wacAfter !== null && wacAfter > wacNow && (
            <Notice>Ce taux est au-dessus du coût moyen actuel : le coût de tout le stock augmente.</Notice>
          )}
        </div>
      </Confirm>
    </SideSheet>
  );
}
