/**
 * Nouvelle vente d'USDT — un seul écran, frère de l'achat : l'acheteur, trois
 * montants liés (USDT, taux, CNY — deux tapés, le troisième calculé), le
 * compte CNY qui encaisse (facultatif), la date et la référence repliées.
 *
 * Vendre plus que le stock reste possible (l'achat peut être saisi après),
 * mais jamais sans le voir. Une fois enregistrée, le reçu s'affiche.
 * Ce qui part au serveur ne change pas (`record_usdt_sale`).
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCounterparties, useRecordUsdtSale, useTreasuryAccountBalances, useUsdtStock } from '@/hooks/useTreasury';
import { TK } from './tstyle';
import { Notice, Picker, SideSheet, SubmitButton, TextLink } from './tkit';
import { QuickCounterparty } from './CounterpartyForm';
import { LabeledRow, LinkedField, RefAndNote, SavedView, WhenLine } from './EntryParts';
import { useLinkedAmounts } from './linkedAmounts';
import { fmtNum } from './treasuryFormat';
import type { ReceiptData } from './receiptData';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function SaleForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [round, setRound] = useState(0);
  if (!open) return null;
  return <SaleFormBody key={round} onClose={onClose} onAgain={() => setRound((n) => n + 1)} />;
}

function SaleFormBody({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const buyers = useCounterparties('cny_buyer');
  const balances = useTreasuryAccountBalances();
  const stock = useUsdtStock();
  const submit = useRecordUsdtSale();
  const amounts = useLinkedAmounts(2);

  const [buyerId, setBuyerId] = useState('');
  const [quick, setQuick] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [at, setAt] = useState(() => new Date().toISOString());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<ReceiptData | null>(null);

  const usdt = amounts.usdt;
  const cny = amounts.counter;
  const accounts = (balances.data ?? []).filter((b) => b.currency === 'CNY' && b.is_active !== false && b.id);
  const account = accounts.find((a) => a.id === accountId);
  const buyer = (buyers.data ?? []).find((b) => b.id === buyerId);
  const stockAfter = stock.data !== undefined && usdt ? round2(stock.data - usdt) : null;

  const error = !buyerId ? 'Choisissez l’acheteur.' : !usdt || usdt <= 0 || !cny || cny <= 0 ? 'Indiquez deux des trois montants (USDT, taux, CNY).' : null;
  const dirty = !saved && !!(buyerId || amounts.touched || accountId || ref || notes);

  const save = () => {
    setTried(true);
    if (error || !usdt || !cny || submit.isPending) return;
    submit.mutate(
      { buyer_id: buyerId, cny_account_id: accountId || null, usdt_amount: usdt, cny_amount: cny, occurred_at: at, external_ref: ref.trim() || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: (res) =>
          setSaved({
            kind: 'sale',
            id: res.sale_id ?? crypto.randomUUID(),
            at,
            voided: false,
            voidReason: null,
            usdt,
            rate: cny / usdt,
            counter: cny,
            counterCur: 'CNY',
            counterparty: buyer ? { name: buyer.display_name, short: buyer.short_id, phone: buyer.phone, wechat: buyer.wechat_id } : null,
            accounts: account ? [{ label: account.label ?? '—', amount: cny }] : [],
            ref: ref.trim() || null,
          }),
      },
    );
  };

  return (
    <SideSheet
      open
      onClose={onClose}
      title={saved ? 'Reçu de la vente' : 'Nouvelle vente d’USDT'}
      dirty={dirty}
      width={540}
      footer={
        saved ? undefined : (
          <div className="space-y-3">
            {tried && error ? (
              <p className="text-[13.5px] font-medium text-red-700 dark:text-red-400">{error}</p>
            ) : usdt && cny ? (
              <p className="text-[14px] text-muted-foreground">
                Vous vendez <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(usdt, 2)} USDT</span> et recevez{' '}
                <span className={cn('font-semibold text-foreground', TK.num)}>{fmtNum(cny, 2)} CNY</span>.
              </p>
            ) : null}
            <SubmitButton busy={submit.isPending} onClick={save} className="h-12 w-full text-[15px]">
              Enregistrer la vente
            </SubmitButton>
          </div>
        )
      }
    >
      {saved ? (
        <SavedView title="Vente enregistrée" data={saved} againLabel="Nouvelle vente" onAgain={onAgain} onClose={onClose} />
      ) : (
        <div className="space-y-7">
          <LabeledRow
            label="Acheteur"
            htmlFor="sa-buyer"
            action={!quick && <TextLink onClick={() => setQuick(true)}><Plus className="h-4 w-4" /> Nouveau</TextLink>}
            error={tried && !buyerId ? 'Choisissez l’acheteur.' : null}
          >
            {quick ? (
              <QuickCounterparty type="cny_buyer" onCancel={() => setQuick(false)} onCreated={(id) => { setBuyerId(id); setQuick(false); }} />
            ) : (
              <Picker
                id="sa-buyer"
                variant="field"
                value={buyerId}
                onChange={setBuyerId}
                options={(buyers.data ?? []).map((b) => ({ value: b.id, label: b.display_name, tag: b.short_id }))}
                placeholder={buyers.isLoading ? 'Chargement…' : buyers.isError ? 'Liste indisponible' : 'Choisir l’acheteur'}
                searchable
                invalid={tried && !buyerId}
              />
            )}
          </LabeledRow>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <LinkedField id="sa-usdt" label="USDT vendus" unit="USDT" decimals={2} value={amounts.usdt} computed={amounts.computed === 'usdt'} onChange={(v) => amounts.set('usdt', v)} invalid={tried && !usdt} />
              <LinkedField id="sa-rate" label="Taux" unit="CNY / USDT" decimals={4} value={amounts.rate} computed={amounts.computed === 'rate'} onChange={(v) => amounts.set('rate', v)} />
            </div>
            <LinkedField id="sa-cny" label="Montant reçu" unit="CNY" decimals={2} value={amounts.counter} computed={amounts.computed === 'counter'} onChange={(v) => amounts.set('counter', v)} invalid={tried && !cny} big />
            <p className="text-[12.5px] text-muted-foreground">
              Tapez deux valeurs, la troisième se calcule.
              {stock.data !== undefined && (
                <>
                  {' '}Stock disponible : <span className={cn('font-medium text-foreground', TK.num)}>{fmtNum(stock.data, 2)} USDT</span>.
                </>
              )}
            </p>
            {stockAfter !== null && stockAfter < 0 && (
              <Notice>Cette vente dépasse le stock de {fmtNum(-stockAfter, 2)} USDT. Pensez à enregistrer l’achat correspondant.</Notice>
            )}
          </div>

          <LabeledRow label="Encaissé sur">
            <Picker
              variant="field"
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id!, label: a.label ?? '—', hint: `${fmtNum(Number(a.balance ?? 0), 2)} CNY` }))}
              allLabel="Aucun compte CNY"
              placeholder="Aucun compte CNY"
              ariaLabel="Compte CNY"
            />
          </LabeledRow>

          <div className="space-y-4 border-t border-border/60 pt-5">
            <WhenLine id="sa-at" value={at} onChange={setAt} />
            <RefAndNote idPrefix="sa" refValue={ref} onRef={setRef} notes={notes} onNotes={setNotes} />
          </div>
        </div>
      )}
    </SideSheet>
  );
}
