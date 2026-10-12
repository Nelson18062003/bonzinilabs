/**
 * Nouvel achat d'USDT — une fenêtre au centre de l'écran, sans étapes.
 *
 *   · le fournisseur ;
 *   · le ou les comptes qui ont payé — avec plusieurs comptes, chacun son
 *     montant, et le TOTAL se fait tout seul ;
 *   · le total payé, le taux, les USDT reçus : on tape ce qu'on sait, le
 *     reste se calcule (src/lib/treasuryPurchaseMath.ts) :
 *       somme des comptes → total ; total + taux → USDT ; total + USDT →
 *       taux ; USDT + taux → total ; un compte sans montant prend le reste ;
 *   · le taux du dernier achat, à reprendre d'un clic, et un garde-fou si le
 *     taux s'en écarte de plus de 8 % (faute de frappe probable) ;
 *   · la date (maintenant), la référence et la note, repliées.
 *
 * Une fois enregistré, la fenêtre montre le reçu, prêt à copier en image.
 * Ce qui part au serveur ne change pas (`record_usdt_purchase` : l'USDT reçu
 * et la répartition XAF par compte). XAF entier et exact, USDT à 2 décimales.
 */
import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidXafAmount } from '@/lib/amountLimits';
import {
  EMPTY_PURCHASE,
  addAccount,
  rateDeviation,
  removeAccount,
  resolvePurchase,
  splitAccounts,
  typeAmount,
  typeSplit,
  type PurchaseInputs,
} from '@/lib/treasuryPurchaseMath';
import { useCounterparties, useLastPurchaseRate, useRecordUsdtPurchase, useTreasuryAccountBalances, useUsdtWac } from '@/hooks/useTreasury';
import { BTN, TK } from './tstyle';
import { AmountInput, FormModal, Notice, Picker, SubmitButton, TextLink } from './tkit';
import { QuickCounterparty } from './CounterpartyForm';
import { LabeledRow, LinkedField, RefAndNote, SavedView, WhenLine } from './EntryParts';
import { fmtNum, fmtWhen } from './treasuryFormat';
import type { ReceiptData } from './receiptData';

export function PurchaseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [round, setRound] = useState(0);
  if (!open) return null;
  return <PurchaseFormBody key={round} onClose={onClose} onAgain={() => setRound((n) => n + 1)} />;
}

function PurchaseFormBody({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const suppliers = useCounterparties('usdt_supplier');
  const balances = useTreasuryAccountBalances();
  const submit = useRecordUsdtPurchase();
  const wac = useUsdtWac();

  const [supplierId, setSupplierId] = useState('');
  const [quick, setQuick] = useState(false);
  const [inputs, setInputs] = useState<PurchaseInputs>(EMPTY_PURCHASE);
  // Le compte de chaque ligne — même longueur que `inputs.splits`.
  const [accountIds, setAccountIds] = useState<string[]>(['']);
  const [at, setAt] = useState(() => new Date().toISOString());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<ReceiptData | null>(null);

  const lastForSupplier = useLastPurchaseRate(supplierId || undefined);
  const lastAny = useLastPurchaseRate();
  const last = (supplierId ? lastForSupplier.data : null) ?? lastAny.data ?? null;
  const lastIsSupplier = !!supplierId && !!lastForSupplier.data;

  const r = resolvePurchase(inputs);
  const multi = inputs.splits.length > 1;
  const xaf = r.total;
  const usdt = r.usdt;
  const rate = xaf && usdt ? xaf / usdt : r.rate;

  const accounts = (balances.data ?? []).filter((b) => b.currency === 'XAF' && b.is_active !== false && b.id);
  const accountOptions = accounts.map((a) => ({ value: a.id!, label: a.label ?? '—', hint: `${fmtNum(Number(a.balance ?? 0), 0)} XAF` }));
  const account = (id: string) => accounts.find((a) => a.id === id);
  const supplier = (suppliers.data ?? []).find((s) => s.id === supplierId);

  // Le compte qui passe sous zéro : on le montre, sans bloquer (l'écriture peut précéder l'appro).
  const lines = r.splits.map((s, i) => ({ accountId: accountIds[i] ?? '', amount: s.amount, computed: s.computed }));
  const overdrawn = lines
    .map((l) => ({ l, a: account(l.accountId) }))
    .filter(({ l, a }) => a && l.amount && Number(a.balance ?? 0) - l.amount < 0);

  const reference = last?.rate ?? (wac.data && wac.data > 0 ? wac.data : null);
  const deviation = rateDeviation(rate ?? null, reference);

  const error =
    !supplierId ? 'Choisissez le fournisseur.'
    : lines.some((l) => !l.accountId) ? (multi ? 'Choisissez le compte de chaque ligne.' : 'Choisissez le compte qui a payé.')
    : new Set(lines.map((l) => l.accountId)).size !== lines.length ? 'Un même compte apparaît deux fois.'
    : r.totalLocked && !usdt ? 'Tapez le taux ou les USDT reçus : le total est la somme des comptes.'
    : !usdt || usdt <= 0 || !xaf || !isValidXafAmount(xaf, 1) ? (multi ? 'Indiquez les montants des comptes, puis le taux ou les USDT reçus.' : 'Indiquez deux des trois montants : total payé, taux, USDT reçus.')
    : r.remaining !== null && r.remaining > 0 ? `Il reste ${fmtNum(r.remaining, 0)} XAF à répartir entre les comptes.`
    : r.remaining !== null && r.remaining < 0 ? `Les comptes dépassent le total de ${fmtNum(-r.remaining, 0)} XAF.`
    : lines.some((l) => !l.amount || !isValidXafAmount(l.amount, 1)) ? 'Indiquez le montant payé par chaque compte.'
    : null;
  const dirty = !saved && !!(supplierId || inputs.order.length || inputs.splits.some((v) => v !== null) || ref || notes || accountIds.some(Boolean));

  const save = () => {
    setTried(true);
    if (error || !usdt || !xaf || submit.isPending) return;
    const paid = lines.map((l) => ({ account_id: l.accountId, xaf_amount: l.amount ?? 0 }));
    submit.mutate(
      { supplier_id: supplierId, usdt_amount: usdt, account_splits: paid, occurred_at: at, external_ref: ref.trim() || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: (res) =>
          setSaved({
            kind: 'purchase',
            id: res.purchase_id ?? crypto.randomUUID(),
            at,
            voided: false,
            voidReason: null,
            usdt,
            rate: xaf / usdt,
            counter: xaf,
            counterCur: 'XAF',
            counterparty: supplier ? { name: supplier.display_name, short: supplier.short_id, phone: supplier.phone, wechat: supplier.wechat_id } : null,
            accounts: paid.map((p) => ({ label: account(p.account_id)?.label ?? '—', amount: p.xaf_amount })),
            ref: ref.trim() || null,
          }),
      },
    );
  };

  const goMulti = () => {
    setInputs((s) => splitAccounts(s));
    setAccountIds((ids) => [ids[0] ?? '', '']);
  };
  const add = () => {
    setInputs((s) => addAccount(s));
    setAccountIds((ids) => [...ids, '']);
  };
  const remove = (i: number) => {
    setInputs((s) => removeAccount(s, i));
    setAccountIds((ids) => ids.filter((_, j) => j !== i));
  };

  // Ce qui se calcule, dit en clair sous les montants.
  const how =
    r.totalLocked && usdt && rate
      ? r.source.usdt === 'computed'
        ? `${fmtNum(xaf ?? 0, 0)} XAF ÷ ${fmtNum(rate, 2)} = ${fmtNum(usdt, 2)} USDT`
        : `Taux : ${fmtNum(xaf ?? 0, 0)} XAF ÷ ${fmtNum(usdt, 2)} USDT = ${fmtNum(rate, 2)}`
      : r.source.total === 'computed' && xaf
        ? `${fmtNum(usdt ?? 0, 2)} USDT × ${fmtNum(r.rate ?? 0, 2)} = ${fmtNum(xaf, 0)} XAF`
        : r.source.usdt === 'computed' && usdt
          ? `${fmtNum(xaf ?? 0, 0)} XAF ÷ ${fmtNum(r.rate ?? 0, 2)} = ${fmtNum(usdt, 2)} USDT`
          : r.source.rate === 'computed' && rate
            ? `Taux : ${fmtNum(xaf ?? 0, 0)} XAF ÷ ${fmtNum(usdt ?? 0, 2)} USDT = ${fmtNum(rate, 2)}`
            : multi
              ? 'Le total se fait avec les montants des comptes. Tapez ensuite le taux OU les USDT reçus.'
              : 'Tapez deux des trois montants, le troisième se calcule.';

  return (
    <FormModal
      open
      onClose={onClose}
      onConfirm={saved ? undefined : save}
      title={saved ? 'Reçu de l’achat' : 'Nouvel achat d’USDT'}
      description={saved ? undefined : 'Ce que vous avez payé en XAF, et les USDT reçus.'}
      dirty={dirty}
      width={640}
      footer={
        saved ? undefined : (
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              {tried && error ? (
                <p className="text-[13.5px] font-medium text-red-700 dark:text-red-400">{error}</p>
              ) : usdt && xaf ? (
                <p className="text-[14px] leading-snug text-muted-foreground">
                  Vous payez <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(xaf, 0)} XAF</span> et recevez{' '}
                  <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(usdt, 2)} USDT</span>
                  {rate ? <> au taux de <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(rate, 2)}</span></> : null}.
                </p>
              ) : (
                <p className="text-[13px] text-muted-foreground">⌘⏎ pour enregistrer</p>
              )}
            </div>
            <SubmitButton busy={submit.isPending} onClick={save} className="h-12 shrink-0 px-6 text-[15px]">
              Enregistrer l’achat
            </SubmitButton>
          </div>
        )
      }
    >
      {saved ? (
        <SavedView title="Achat enregistré" data={saved} againLabel="Nouvel achat" onAgain={onAgain} onClose={onClose} />
      ) : (
        <div className="space-y-7">
          <LabeledRow
            label="Fournisseur"
            htmlFor="pu-supplier"
            action={!quick && <TextLink onClick={() => setQuick(true)}><Plus className="h-4 w-4" /> Nouveau</TextLink>}
            error={tried && !supplierId ? 'Choisissez le fournisseur.' : null}
          >
            {quick ? (
              <QuickCounterparty type="usdt_supplier" onCancel={() => setQuick(false)} onCreated={(id) => { setSupplierId(id); setQuick(false); }} />
            ) : (
              <Picker
                id="pu-supplier"
                variant="field"
                value={supplierId}
                onChange={setSupplierId}
                options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.display_name, tag: s.short_id }))}
                placeholder={suppliers.isLoading ? 'Chargement…' : suppliers.isError ? 'Liste indisponible' : 'Choisir le fournisseur'}
                searchable
                invalid={tried && !supplierId}
              />
            )}
          </LabeledRow>

          {/* ── Les comptes qui ont payé ───────────────────────────── */}
          <LabeledRow
            label={multi ? 'Payé depuis plusieurs comptes' : 'Payé depuis'}
            action={!multi && <TextLink onClick={goMulti}><Plus className="h-4 w-4" /> Plusieurs comptes</TextLink>}
          >
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className={cn('grid items-center gap-2', multi ? 'grid-cols-[minmax(0,1fr)_200px_40px]' : 'grid-cols-1')}>
                  <Picker
                    variant="field"
                    value={l.accountId}
                    onChange={(v) => setAccountIds((ids) => ids.map((x, j) => (j === i ? v : x)))}
                    options={accountOptions}
                    placeholder="Choisir le compte XAF"
                    invalid={tried && !l.accountId}
                    ariaLabel={`Compte ${i + 1}`}
                    compact={multi}
                  />
                  {multi && (
                    <>
                      <div className={cn('relative', l.computed && '[&>div]:border-transparent [&>div]:bg-muted/60')}>
                        <AmountInput
                          value={l.amount}
                          onChange={(v) => setInputs((s) => typeSplit(s, i, v))}
                          unit="XAF"
                          decimals={0}
                          invalid={tried && !l.amount}
                          ariaLabel={`Montant payé par le compte ${i + 1}`}
                        />
                        {l.computed && (
                          <span className="pointer-events-none absolute -top-2 right-3 rounded bg-card px-1 text-[11px] font-medium text-muted-foreground">le reste</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={cn(BTN.icon, 'h-12 w-10 bg-transparent text-muted-foreground ring-0 hover:text-red-700')}
                        onClick={() => remove(i)}
                        aria-label={`Retirer le compte ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {multi && (
              <div className="mt-2.5 flex items-center justify-between">
                <TextLink onClick={add}>
                  <Plus className="h-4 w-4" /> Ajouter un compte
                </TextLink>
                {r.remaining === 0 ? (
                  <span className={cn('inline-flex items-center gap-1 text-[13px] font-medium', TK.in)}>
                    <Check className="h-4 w-4" /> Le compte est bon
                  </span>
                ) : r.remaining !== null && r.remaining > 0 ? (
                  <span className={cn('text-[13px] font-medium', TK.num, TK.warn)}>Reste à répartir : {fmtNum(r.remaining, 0)} XAF</span>
                ) : r.remaining !== null && r.remaining < 0 ? (
                  <span className={cn('text-[13px] font-medium', TK.num, TK.out)}>Dépasse le total de {fmtNum(-r.remaining, 0)} XAF</span>
                ) : null}
              </div>
            )}
            {overdrawn.length > 0 && (
              <p className={cn('mt-2 text-[12.5px]', TK.warn)}>
                {overdrawn.map(({ a, l }) => `${a!.label} passera à ${fmtNum(Number(a!.balance ?? 0) - (l.amount ?? 0), 0)} XAF`).join(' · ')}.
              </p>
            )}
          </LabeledRow>

          {/* ── Les montants liés ──────────────────────────────────── */}
          <div className="space-y-3 rounded-2xl bg-muted/40 p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            {r.totalLocked ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[13.5px] font-medium text-foreground">
                  Montant payé (total)
                  <span className="text-[12px] font-medium text-muted-foreground">somme des comptes</span>
                </div>
                <div className="[&>div]:border-transparent [&>div]:bg-card [&_input]:text-[22px]">
                  <AmountInput id="pu-xaf" value={xaf} onChange={() => undefined} unit="XAF" decimals={0} readOnly ariaLabel="Montant payé, somme des comptes" />
                </div>
              </div>
            ) : (
              <LinkedField id="pu-xaf" label="Montant payé (total)" unit="XAF" decimals={0} value={r.total} computed={r.source.total === 'computed'} onChange={(v) => setInputs((s) => typeAmount(s, 'total', v))} invalid={tried && !xaf} big />
            )}
            <div className="grid grid-cols-2 gap-3">
              <LinkedField id="pu-rate" label="Taux" unit="XAF / USDT" decimals={2} value={r.rate} computed={r.source.rate === 'computed'} onChange={(v) => setInputs((s) => typeAmount(s, 'rate', v))} />
              <LinkedField id="pu-usdt" label="USDT reçus" unit="USDT" decimals={2} value={r.usdt} computed={r.source.usdt === 'computed'} onChange={(v) => setInputs((s) => typeAmount(s, 'usdt', v))} invalid={tried && !usdt} />
            </div>
            <p className={cn('text-[12.5px] text-muted-foreground', TK.num)}>{how}</p>
            {last && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[13px]">
                <span className="text-muted-foreground">
                  Dernier taux{lastIsSupplier && supplier ? ` chez ${supplier.display_name}` : ''} :{' '}
                  <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(last.rate, 2)}</span> · {fmtWhen(last.at)}
                </span>
                {/* Seulement quand le taux manque : déjà calculé (total + USDT tapés), le reprendre
                    recalculerait en silence un montant que l'opérateur a tapé. */}
                {r.source.rate === null && (
                  <TextLink onClick={() => setInputs((s) => typeAmount(s, 'rate', Math.round(last.rate * 100) / 100))}>Reprendre ce taux</TextLink>
                )}
              </div>
            )}
          </div>
          {deviation !== null && (
            <Notice>
              Taux inhabituel : {fmtNum(Math.abs(deviation) * 100, 0)} % {deviation > 0 ? 'au-dessus' : 'en dessous'} du{' '}
              {last ? 'dernier achat' : 'coût moyen du stock'} ({fmtNum(reference ?? 0, 2)}). Vérifiez la saisie.
            </Notice>
          )}

          <div className="space-y-4 border-t border-border/60 pt-5">
            <WhenLine id="pu-at" value={at} onChange={setAt} />
            <RefAndNote idPrefix="pu" refValue={ref} onRef={setRef} notes={notes} onNotes={setNotes} />
          </div>
        </div>
      )}
    </FormModal>
  );
}
