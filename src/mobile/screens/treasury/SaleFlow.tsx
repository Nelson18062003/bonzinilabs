/**
 * Vendre des USDT — 3 étapes (maquettes 07-tresorerie/10 à 13) :
 *
 *   1/3 l'acheteur (récents, dernier taux, « + Nouvel acheteur ») ;
 *   2/3 les montants au clavier : USDT vendus, ¥ reçus, taux CNY/USDT (deux
 *       tapés, le troisième calculé), stock avant → après avec le tag
 *       « Stock dépassé », le compte d'encaissement (facultatif) ;
 *   3/3 la confirmation : taux, coût moyen, coût de sortie, stock et compte
 *       CNY avant → après, date et référence.
 *
 * Puis le reçu, avec les comptes touchés et « Nouvelle vente ». Vendre plus
 * que le stock reste possible (l'achat peut venir après), jamais sans le
 * voir. Ce qui part au serveur ne change pas (`record_usdt_sale`).
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  useCounterparties, useOperationEntries, useRecordUsdtSale, useTreasuryAccountBalances, useUsdtStock, useUsdtWac,
} from '@/hooks/useTreasury';
import { useLinkedAmounts, type AmountField } from '@/desktop/screens/treasury/linkedAmounts';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import type { ReceiptData } from '@/desktop/screens/treasury/receiptData';
import { cn } from '@/lib/utils';
import {
  BigButton, ConfirmSheet, Dock, FOCUS_RING, Initials, Keypad, ScreenTop, SURFACE, TEXT, Tag, WhoCard,
  applyKey, formatPad, padValue, type KV, type PadKey,
} from '@/mobile/designKit';
import { AbandonSheet, AccountLogo, CapsLabel, DateRefValue, DetailsSheet, PickerSheet, ReceiptButtons, ReceiptCard, TouchedRow, TreasuryGate } from './parts';
import { BigField, BoxField, CounterpartyStep, RateLine } from './EntrySteps';
import { fmtUsdt, shortAccount, tp, useGoBack, useReceiptActions, whenShort } from './treasuryMobile';

const DECIMALS: Record<AmountField, number> = { usdt: 2, counter: 2, rate: 4 };

export function SaleFlow() {
  const [round, setRound] = useState(0);
  return (
    <TreasuryGate manage>
      <SaleBody key={round} onAgain={() => setRound((n) => n + 1)} />
    </TreasuryGate>
  );
}

function SaleBody({ onAgain }: { onAgain: () => void }) {
  const leave = useGoBack();
  const buyers = useCounterparties('cny_buyer');
  const balances = useTreasuryAccountBalances();
  const stock = useUsdtStock();
  const wac = useUsdtWac();
  const submit = useRecordUsdtSale();
  const amounts = useLinkedAmounts(2);

  const [step, setStep] = useState<1 | 2>(1);
  const [buyerId, setBuyerId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [texts, setTexts] = useState<Record<AmountField, string>>({ usdt: '', counter: '', rate: '' });
  const [active, setActive] = useState<AmountField>('usdt');
  const [at, setAt] = useState(() => new Date().toISOString());
  const [atTouched, setAtTouched] = useState(false);
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [details, setDetails] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [pickAccount, setPickAccount] = useState(false);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<ReceiptData | null>(null);

  const buyer = (buyers.data ?? []).find((b) => b.id === buyerId);
  const cnyAccounts = (balances.data ?? []).filter((b) => b.currency === 'CNY' && b.is_active !== false && b.id);
  const account = cnyAccounts.find((a) => a.id === accountId);
  const usdt = amounts.usdt;
  const cny = amounts.counter;
  const rate = amounts.rate;
  const stockNow = stock.data;
  const stockAfter = stockNow !== undefined && usdt ? Math.round((stockNow - usdt) * 100) / 100 : null;
  const over = stockAfter !== null && stockAfter < 0;
  const error = !buyerId ? 'Choisissez l’acheteur.' : !usdt || usdt <= 0 || !cny || cny <= 0 ? 'Indiquez deux des trois montants : USDT, ¥, taux.' : null;
  const dirty = !saved && !!(buyerId || amounts.touched || accountId || ref || notes);

  const fieldText = (k: AmountField) => {
    const v = k === 'usdt' ? usdt : k === 'counter' ? cny : rate;
    if (amounts.computed !== k && texts[k]) return formatPad(texts[k]);
    if (v === null || v === undefined) return '0';
    return fmtNum(v, DECIMALS[k]);
  };
  const onKey = (key: PadKey) => {
    const k = active;
    const base = amounts.computed === k ? '' : texts[k];
    const next = applyKey(base, key, DECIMALS[k]);
    setTexts((t) => ({ ...t, [k]: next }));
    const v = padValue(next);
    amounts.set(k, v > 0 ? v : null);
  };
  const back = () => {
    if (confirm) return setConfirm(false);
    if (step === 2) return setStep(1);
    if (dirty) return setAbandon(true);
    leave();
  };

  const save = () => {
    setTried(true);
    if (error || !usdt || !cny || submit.isPending) return;
    submit.mutate(
      { buyer_id: buyerId, cny_account_id: accountId || null, usdt_amount: usdt, cny_amount: cny, occurred_at: at, external_ref: ref.trim() || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: (res) => {
          setConfirm(false);
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
          });
        },
      },
    );
  };

  if (saved) return <Saved data={saved} onAgain={onAgain} />;

  const w = wac.data ?? 0;
  const rows: KV[] = [];
  if (rate) rows.push({ label: 'Taux', value: `${fmtNum(rate, 4)} CNY/USDT` });
  rows.push({ label: 'Coût moyen', value: `${fmtNum(w, 2)} XAF/USDT` });
  if (usdt) rows.push({ label: 'Coût de sortie', value: `${fmtNum(usdt * w, 0)} XAF` });
  if (stockNow !== undefined && stockAfter !== null) rows.push({ label: 'Stock USDT', before: fmtNum(stockNow, 2), value: fmtNum(stockAfter, 2), tone: over ? 'danger' : undefined });
  if (account && cny) rows.push({ label: shortAccount(account.label), before: fmtNum(Number(account.balance ?? 0), 0), value: fmtNum(Number(account.balance ?? 0) + cny, 0) });
  rows.push({
    label: 'Date · réf.',
    value: (
      <DateRefValue
        when={atTouched ? whenShort(at) : 'Maintenant'}
        refText={ref.trim()}
        onEdit={() => {
          setConfirm(false);
          setDetails(true);
        }}
      />
    ),
  });

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ScreenTop title="Vendre des USDT" step={`${confirm ? 3 : step}/3`} onBack={back} />

      {step === 1 && (
        <CounterpartyStep
          type="cny_buyer"
          onPick={(id) => {
            setBuyerId(id);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <>
          <div className="px-5 pt-4">
            {buyer && <WhoCard leading={<Initials name={buyer.display_name} />} name={buyer.display_name} line={`Acheteur CNY · ${buyer.short_id}`} onClick={() => setStep(1)} />}
          </div>
          <div className="flex flex-1 flex-col">
            <BigField compact label="Vendus" text={fieldText('usdt')} unit="USDT" computed={amounts.computed === 'usdt' && usdt !== null} active={active === 'usdt'} onClick={() => setActive('usdt')} />
            <div className="px-5 pt-3">
              <BoxField label="Reçu" text={fieldText('counter')} unit="CNY" computed={amounts.computed === 'counter' && cny !== null} active={active === 'counter'} onClick={() => setActive('counter')} />
            </div>
            <div className="space-y-1 px-5 pt-3 text-center">
              <RateLine
                text={rate ? fmtNum(rate, 4) : active === 'rate' ? fieldText('rate') : '—'}
                unit="CNY/USDT"
                active={active === 'rate'}
                onClick={() => setActive('rate')}
                tag={over ? <Tag tone="danger">Stock dépassé</Tag> : undefined}
              />
              {stockNow !== undefined && (
                <p className={cn('text-[16px] tabular-nums', TEXT.muted)}>
                  {over
                    ? `Stock ${fmtNum(stockNow, 2)} · il manque ${fmtNum(-(stockAfter ?? 0), 2)}`
                    : `Stock ${fmtNum(stockNow, 2)}${stockAfter !== null ? ` → ${fmtNum(stockAfter, 2)}` : ''}`}
                </p>
              )}
              {tried && error && <p className="text-[16px] font-medium text-[#900B09] dark:text-[#FCB3AD]">{error}</p>}
            </div>
            <div className="px-5 pt-3">
              <button
                type="button"
                onClick={() => setPickAccount(true)}
                className={cn('flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}
              >
                {account ? <AccountLogo kind={account.kind} label={account.label} currency="CNY" /> : <span className="h-11 w-11 shrink-0 rounded-full bg-[#F5F5F5] dark:bg-[#383838]" />}
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[15px]', TEXT.muted)}>Encaissé sur</span>
                  <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>
                    {account ? `${account.label} · ¥ ${fmtNum(Number(account.balance ?? 0), 0)}` : 'Aucun compte CNY'}
                  </span>
                </span>
              </button>
            </div>
            <div className="mt-auto pt-2">
              <Keypad onKey={onKey} decimals={DECIMALS[active]} />
            </div>
          </div>
          <Dock>
            <BigButton
              onClick={() => {
                setTried(true);
                if (!error) setConfirm(true);
              }}
            >
              Continuer
            </BigButton>
          </Dock>
        </>
      )}

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Vendre ${fmtUsdt(usdt)} USDT ?`}
        subtitle={`à ${buyer?.display_name ?? '—'}, pour ¥ ${fmtNum(cny ?? 0, 2)}`}
        rows={rows}
        confirmLabel="Enregistrer la vente"
        loading={submit.isPending}
        onConfirm={save}
      />
      <DetailsSheet
        open={details}
        onClose={() => {
          setDetails(false);
          setConfirm(true);
        }}
        at={at}
        onAt={(v) => {
          setAt(v);
          setAtTouched(true);
        }}
        refValue={ref}
        onRef={setRef}
        notes={notes}
        onNotes={setNotes}
      />
      <PickerSheet
        open={pickAccount}
        onClose={() => setPickAccount(false)}
        title="Encaissé sur"
        value={accountId}
        onPick={setAccountId}
        options={[
          { value: '', label: 'Aucun compte CNY' },
          ...cnyAccounts.map((a) => ({
            value: a.id as string,
            label: a.label ?? '—',
            hint: `¥ ${fmtNum(Number(a.balance ?? 0), 2)}`,
            leading: <AccountLogo kind={a.kind} label={a.label} currency="CNY" />,
          })),
        ]}
      />
      <AbandonSheet open={abandon} onClose={() => setAbandon(false)} onLeave={leave} />
    </div>
  );
}

/** Vente enregistrée : le reçu, les comptes touchés (solde après), Copier l'image · Télécharger. */
function Saved({ data, onAgain }: { data: ReceiptData; onAgain: () => void }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const actions = useReceiptActions(ref, data);
  const entries = useOperationEntries(data.id);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className={cn('sticky top-0 z-40 border-b bg-white pt-[env(safe-area-inset-top)] dark:bg-[#1E1E1E]', SURFACE.divider)}>
        <div className="flex h-14 items-center gap-1.5 pl-1.5 pr-4">
          <button type="button" aria-label="Fermer" onClick={() => navigate(tp.root, { replace: true })} className={cn('flex h-11 w-11 items-center justify-center rounded-full', FOCUS_RING, TEXT.strong)}>
            <X className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <h1 className={cn('min-w-0 flex-1 truncate text-[18px] font-semibold', TEXT.strong)}>Vente enregistrée</h1>
          <button type="button" onClick={onAgain} className={cn('h-11 shrink-0 text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
            Nouvelle vente
          </button>
        </div>
      </header>
      <div className="space-y-5 px-5 pt-4">
        <ReceiptCard ref={ref} data={data} />
        <div>
          <CapsLabel>Comptes touchés</CapsLabel>
          <div className="mt-1">
            {(entries.data ?? []).filter((e) => e.entry_kind !== 'void').map((e) => <TouchedRow key={e.id} e={e} />)}
          </div>
        </div>
      </div>
      <Dock>
        <ReceiptButtons actions={actions} />
      </Dock>
    </div>
  );
}
