/**
 * Nouvel achat d'USDT — un seul écran, sans étapes ni « mode ».
 *
 *   · le fournisseur ;
 *   · trois montants liés (USDT, taux, XAF) : on en tape deux, le troisième
 *     se calcule ;
 *   · le compte qui a payé (ou plusieurs, au besoin) ;
 *   · la date (maintenant, sauf si on la change), la référence et la note,
 *     repliées.
 *
 * Une fois enregistré, le panneau montre le reçu, prêt à copier en image.
 * Ce qui part au serveur ne change pas (`record_usdt_purchase` : l'USDT reçu
 * et la répartition XAF par compte). XAF entier et exact, USDT à 2 décimales.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidXafAmount } from '@/lib/amountLimits';
import { useCounterparties, useRecordUsdtPurchase, useTreasuryAccountBalances } from '@/hooks/useTreasury';
import { BTN, TK } from './tstyle';
import { AmountInput, Picker, SideSheet, SubmitButton, TextLink } from './tkit';
import { QuickCounterparty } from './CounterpartyForm';
import { LabeledRow, LinkedField, RefAndNote, SavedView, WhenLine } from './EntryParts';
import { useLinkedAmounts } from './linkedAmounts';
import { fmtNum } from './treasuryFormat';
import type { ReceiptData } from './receiptData';

interface Split {
  key: number;
  accountId: string;
  amount: number | null;
}

export function PurchaseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [round, setRound] = useState(0);
  if (!open) return null;
  return <PurchaseFormBody key={round} onClose={onClose} onAgain={() => setRound((n) => n + 1)} />;
}

function PurchaseFormBody({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const suppliers = useCounterparties('usdt_supplier');
  const balances = useTreasuryAccountBalances();
  const submit = useRecordUsdtPurchase();
  const amounts = useLinkedAmounts(0);

  const [supplierId, setSupplierId] = useState('');
  const [quick, setQuick] = useState(false);
  const [splits, setSplits] = useState<Split[]>([{ key: 0, accountId: '', amount: null }]);
  const [at, setAt] = useState(() => new Date().toISOString());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<ReceiptData | null>(null);

  const xaf = amounts.counter;
  const usdt = amounts.usdt;
  const accounts = (balances.data ?? []).filter((b) => b.currency === 'XAF' && b.is_active !== false && b.id);
  const accountOptions = accounts.map((a) => ({ value: a.id!, label: a.label ?? '—', hint: `${fmtNum(Number(a.balance ?? 0), 0)} XAF` }));
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.label ?? '—';
  const multi = splits.length > 1;
  // Un seul compte : il paie tout. Plusieurs : la répartition est tapée.
  const lines = multi ? splits : splits.map((s) => ({ ...s, amount: xaf }));
  const remaining = xaf !== null ? xaf - lines.reduce((s, l) => s + (l.amount ?? 0), 0) : null;
  const supplier = (suppliers.data ?? []).find((s) => s.id === supplierId);

  const error =
    !supplierId ? 'Choisissez le fournisseur.'
    : !usdt || usdt <= 0 || !xaf || !isValidXafAmount(xaf, 1) ? 'Indiquez deux des trois montants (USDT, taux, XAF).'
    : lines.some((l) => !l.accountId) ? 'Choisissez le compte qui a payé.'
    : new Set(lines.map((l) => l.accountId)).size !== lines.length ? 'Un même compte apparaît deux fois.'
    : lines.some((l) => !l.amount || !isValidXafAmount(l.amount, 1)) ? 'Indiquez le montant payé par chaque compte.'
    : remaining !== 0 ? `La répartition doit faire ${fmtNum(xaf, 0)} XAF (${remaining! > 0 ? `il manque ${fmtNum(remaining, 0)}` : `${fmtNum(-remaining!, 0)} de trop`}).`
    : null;
  const dirty = !saved && !!(supplierId || amounts.touched || ref || notes || splits.some((s) => s.accountId));

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
            accounts: paid.map((p) => ({ label: accountName(p.account_id), amount: p.xaf_amount })),
            ref: ref.trim() || null,
          }),
      },
    );
  };

  const setSplit = (key: number, patch: Partial<Split>) => setSplits((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const addSplit = () =>
    setSplits((all) => [...(all.length === 1 ? [{ ...all[0], amount: xaf }] : all), { key: Math.max(...all.map((s) => s.key)) + 1, accountId: '', amount: null }]);

  return (
    <SideSheet
      open
      onClose={onClose}
      title={saved ? 'Reçu de l’achat' : 'Nouvel achat d’USDT'}
      dirty={dirty}
      width={540}
      footer={
        saved ? undefined : (
          <div className="space-y-3">
            {tried && error ? (
              <p className="text-[13.5px] font-medium text-red-700 dark:text-red-400">{error}</p>
            ) : usdt && xaf ? (
              <p className="text-[14px] text-muted-foreground">
                Vous recevez <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(usdt, 2)} USDT</span> et payez{' '}
                <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(xaf, 0)} XAF</span>.
              </p>
            ) : null}
            <SubmitButton busy={submit.isPending} onClick={save} className="h-12 w-full text-[15px]">
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

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <LinkedField id="pu-usdt" label="USDT reçus" unit="USDT" decimals={2} value={amounts.usdt} computed={amounts.computed === 'usdt'} onChange={(v) => amounts.set('usdt', v)} invalid={tried && !usdt} />
              <LinkedField id="pu-rate" label="Taux" unit="XAF / USDT" decimals={2} value={amounts.rate} computed={amounts.computed === 'rate'} onChange={(v) => amounts.set('rate', v)} />
            </div>
            <LinkedField id="pu-xaf" label="Montant payé" unit="XAF" decimals={0} value={amounts.counter} computed={amounts.computed === 'counter'} onChange={(v) => amounts.set('counter', v)} invalid={tried && !xaf} big />
            <p className="text-[12.5px] text-muted-foreground">Tapez deux valeurs, la troisième se calcule.</p>
          </div>

          <LabeledRow
            label={multi ? 'Payé depuis plusieurs comptes' : 'Payé depuis'}
            action={!multi && <TextLink onClick={addSplit}>Plusieurs comptes ?</TextLink>}
          >
            <div className="space-y-2">
              {splits.map((s, i) => (
                <div key={s.key} className={cn('grid items-center gap-2', multi ? 'grid-cols-[minmax(0,1fr)_170px_40px]' : 'grid-cols-1')}>
                  <Picker
                    variant="field"
                    value={s.accountId}
                    onChange={(v) => setSplit(s.key, { accountId: v })}
                    options={accountOptions}
                    placeholder="Choisir le compte XAF"
                    invalid={tried && !s.accountId}
                    ariaLabel={`Compte ${i + 1}`}
                    compact={multi}
                  />
                  {multi && (
                    <>
                      <AmountInput value={s.amount} onChange={(v) => setSplit(s.key, { amount: v })} unit="XAF" decimals={0} invalid={tried && !s.amount} ariaLabel={`Montant payé par le compte ${i + 1}`} />
                      <button
                        type="button"
                        className={cn(BTN.icon, 'h-12 w-10 bg-transparent ring-0 text-muted-foreground hover:text-red-700')}
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
            {multi && (
              <div className="mt-2 flex items-center justify-between">
                <TextLink onClick={addSplit}>
                  <Plus className="h-4 w-4" /> Ajouter un compte
                </TextLink>
                {xaf !== null && (
                  <span className={cn('text-[13px] font-medium', TK.num, remaining === 0 ? TK.in : TK.warn)}>
                    {remaining === 0 ? 'Le compte est bon' : `Reste ${fmtNum(remaining, 0)} XAF`}
                  </span>
                )}
              </div>
            )}
          </LabeledRow>

          <div className="space-y-4 border-t border-border/60 pt-5">
            <WhenLine id="pu-at" value={at} onChange={setAt} />
            <RefAndNote idPrefix="pu" refValue={ref} onRef={setRef} notes={notes} onNotes={setNotes} />
          </div>
        </div>
      )}
    </SideSheet>
  );
}
