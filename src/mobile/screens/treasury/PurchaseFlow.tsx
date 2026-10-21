/**
 * Acheter des USDT — 4 étapes (maquettes 07-tresorerie/05 à 09, puis
 * 05-tresorerie-taux/05) :
 *
 *   1/4 le fournisseur (récents, dernier taux, « + Nouveau fournisseur ») ;
 *   2/4 le ou les comptes qui ont payé, chacun avec son solde ;
 *   3/4 les montants au clavier : on tape ce qu'on sait, le reste se calcule
 *       (`resolvePurchase`, le calcul de l'ordinateur), la formule s'affiche,
 *       « Dernier chez X · Reprendre », tag « Inhabituel » au-delà de 8 % ;
 *   4/4 la confirmation en feuille : chaque compte et le stock avant → après,
 *       date et référence (« Ajouter »).
 *
 * Puis le succès : copier le reçu, télécharger, « Nouvel achat ». Ce qui part
 * au serveur ne change pas (`record_usdt_purchase`, XAF entier et exact).
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { isValidXafAmount } from '@/lib/amountLimits';
import {
  EMPTY_PURCHASE, addAccount, rateDeviation, removeAccount, resolvePurchase, splitAccounts, typeAmount, typeSplit, type LinkedKey, type PurchaseInputs,
} from '@/lib/treasuryPurchaseMath';
import { useCounterparties, useLastPurchaseRate, useRecordUsdtPurchase, useTreasuryAccountBalances, useUsdtStock, useUsdtWac } from '@/hooks/useTreasury';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import { parseAmount } from '@/desktop/screens/treasury/tstyle';
import type { ReceiptData } from '@/desktop/screens/treasury/receiptData';
import { cn } from '@/lib/utils';
import {
  BigButton, ConfirmSheet, Dock, IconCircle, Initials, Keypad, ScreenTop, SURFACE, SuccessView, TEXT, Tag, TextInput, WhoCard,
  applyKey, formatPad, padValue, type KV, type PadKey,
} from '@/mobile/designKit';
import { AbandonSheet, AccountLogo, CapsLabel, DateRefValue, DetailsSheet, PickerSheet, ReceiptButtons, ReceiptCard, TreasuryGate } from './parts';
import { BigField, BoxField, CounterpartyStep, RateLine } from './EntrySteps';
import { fmtUsdt, shortAccount, tp, useGoBack, useReceiptActions, whenShort, withCur } from './treasuryMobile';

const DECIMALS: Record<LinkedKey, number> = { total: 0, usdt: 2, rate: 2 };

export function PurchaseFlow() {
  const [round, setRound] = useState(0);
  return (
    <TreasuryGate manage>
      <PurchaseBody key={round} onAgain={() => setRound((n) => n + 1)} />
    </TreasuryGate>
  );
}

function PurchaseBody({ onAgain }: { onAgain: () => void }) {
  const leave = useGoBack();
  const suppliers = useCounterparties('usdt_supplier');
  const balances = useTreasuryAccountBalances();
  const stock = useUsdtStock();
  const wac = useUsdtWac();
  const submit = useRecordUsdtPurchase();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [supplierId, setSupplierId] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [splitTexts, setSplitTexts] = useState<string[]>([]);
  const [inputs, setInputs] = useState<PurchaseInputs>(EMPTY_PURCHASE);
  const [texts, setTexts] = useState<Record<LinkedKey, string>>({ total: '', rate: '', usdt: '' });
  const [active, setActive] = useState<LinkedKey>('total');
  const [at, setAt] = useState(() => new Date().toISOString());
  const [atTouched, setAtTouched] = useState(false);
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [details, setDetails] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [pickFor, setPickFor] = useState<number | 'add' | null>(null);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<ReceiptData | null>(null);

  const supplier = (suppliers.data ?? []).find((s) => s.id === supplierId);
  const lastForSupplier = useLastPurchaseRate(supplierId || undefined);
  const lastAny = useLastPurchaseRate();
  const last = (supplierId ? lastForSupplier.data : null) ?? lastAny.data ?? null;
  const lastIsSupplier = !!supplierId && !!lastForSupplier.data;

  const xafAccounts = (balances.data ?? []).filter((b) => b.currency === 'XAF' && b.is_active !== false && b.id);
  const account = (id: string) => xafAccounts.find((a) => a.id === id);
  const multi = accountIds.length > 1;
  const r = resolvePurchase(inputs);
  const xaf = r.total;
  const usdt = r.usdt;
  const rate = xaf && usdt ? xaf / usdt : r.rate;
  const lines = accountIds.map((id, i) => ({ id, amount: multi ? r.splits[i]?.amount ?? null : xaf, computed: multi ? !!r.splits[i]?.computed : true }));
  const reference = last?.rate ?? (wac.data && wac.data > 0 ? wac.data : null);
  const deviation = rateDeviation(rate ?? null, reference);
  const dirty = !saved && !!(supplierId || accountIds.length || inputs.order.length || ref || notes);

  const error =
    !supplierId ? 'Choisissez le fournisseur.'
    : accountIds.length === 0 ? 'Choisissez le compte qui a payé.'
    : new Set(accountIds).size !== accountIds.length ? 'Un même compte apparaît deux fois.'
    : r.totalLocked && !usdt ? 'Tapez les USDT reçus ou le taux.'
    : !usdt || usdt <= 0 || !xaf || !isValidXafAmount(xaf, 1) ? 'Indiquez deux des trois montants : payé, reçu, taux.'
    : r.remaining !== null && r.remaining > 0 ? `Il reste ${fmtNum(r.remaining, 0)} XAF à répartir entre les comptes.`
    : r.remaining !== null && r.remaining < 0 ? `Les comptes dépassent le total de ${fmtNum(-r.remaining, 0)} XAF.`
    : lines.some((l) => !l.amount || !isValidXafAmount(l.amount, 1)) ? 'Indiquez le montant payé par chaque compte.'
    : null;

  /* ── Les comptes ── */
  const addLine = (id: string) => {
    if (accountIds.length === 0) {
      setAccountIds([id]);
      return;
    }
    setInputs((s) => (accountIds.length === 1 ? splitAccounts(s) : addAccount(s)));
    setAccountIds((ids) => [...ids, id]);
    setSplitTexts((t) => (accountIds.length === 1 ? ['', ''] : [...t, '']));
  };
  const removeLine = (i: number) => {
    if (accountIds.length > 1) setInputs((s) => removeAccount(s, i));
    setAccountIds((ids) => ids.filter((_, j) => j !== i));
    setSplitTexts((t) => (accountIds.length <= 2 ? [] : t.filter((_, j) => j !== i)));
  };
  const setSplit = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 12);
    setSplitTexts((t) => t.map((x, j) => (j === i ? digits : x)));
    setInputs((s) => typeSplit(s, i, digits ? parseAmount(digits, 0) : null));
  };

  /* ── Le clavier ── */
  const source = r.source;
  const fieldText = (k: LinkedKey) => {
    const v = k === 'total' ? xaf : k === 'usdt' ? usdt : rate;
    if (source[k] === 'typed' && texts[k]) return formatPad(texts[k]);
    if (v === null || v === undefined) return '0';
    return fmtNum(v, DECIMALS[k]);
  };
  const isComputed = (k: LinkedKey) => source[k] === 'computed' || source[k] === 'sum';
  const onKey = (key: PadKey) => {
    const k = active;
    if (k === 'total' && r.totalLocked) return;
    const base = source[k] === 'typed' ? texts[k] : '';
    const next = applyKey(base, key, DECIMALS[k]);
    setTexts((t) => ({ ...t, [k]: next }));
    const v = padValue(next);
    setInputs((s) => typeAmount(s, k, v > 0 ? v : null));
  };
  const reprendre = () => {
    if (!last) return;
    const v = Math.round(last.rate * 100) / 100;
    setTexts((t) => ({ ...t, rate: String(v).replace(".", ",") }));
    setInputs((s) => typeAmount(s, 'rate', v));
  };

  const goStep3 = () => {
    setActive(r.totalLocked ? 'usdt' : 'total');
    setStep(3);
  };
  const back = () => {
    if (confirm) return setConfirm(false);
    if (step === 3) return setStep(2);
    if (step === 2) return setStep(1);
    if (dirty) return setAbandon(true);
    leave();
  };

  const save = () => {
    setTried(true);
    if (error || !usdt || !xaf || submit.isPending) return;
    if (!Number.isSafeInteger(xaf) || lines.some((l) => !Number.isSafeInteger(l.amount ?? 0))) return;
    const paid = lines.map((l) => ({ account_id: l.id, xaf_amount: l.amount ?? 0 }));
    submit.mutate(
      { supplier_id: supplierId, usdt_amount: usdt, account_splits: paid, occurred_at: at, external_ref: ref.trim() || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: (res) => {
          setConfirm(false);
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
          });
        },
      },
    );
  };

  if (saved) return <Saved data={saved} onAgain={onAgain} />;

  const who = supplier && (
    <WhoCard
      leading={<Initials name={supplier.display_name} />}
      name={supplier.display_name}
      line={
        step === 2
          ? `Fournisseur USDT · ${supplier.short_id}`
          : multi
            ? `${accountIds.length} comptes · ${fmtNum(xaf ?? 0, 0)} XAF`
            : `Depuis ${account(accountIds[0])?.label ?? '—'} · ${withCur(Number(account(accountIds[0])?.balance ?? 0), 'XAF')}`
      }
      onClick={() => setStep(step === 3 ? 2 : 1)}
    />
  );

  const confirmRows: KV[] = [];
  if (rate) confirmRows.push({ label: 'Taux', value: `${fmtNum(rate, 2)} XAF/USDT` });
  for (const l of lines) {
    const a = account(l.id);
    const now = Number(a?.balance ?? 0);
    const after = now - (l.amount ?? 0);
    confirmRows.push({ label: shortAccount(a?.label), before: fmtNum(now, 0), value: fmtNum(after, 0), tone: after < 0 ? 'danger' : undefined });
  }
  if (stock.data !== undefined && usdt) confirmRows.push({ label: 'Stock USDT', before: fmtNum(stock.data, 2), value: fmtNum(stock.data + usdt, 2) });
  confirmRows.push({
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
      <ScreenTop title="Acheter des USDT" step={`${confirm ? 4 : step}/4`} onBack={back} />

      {step === 1 && (
        <CounterpartyStep
          type="usdt_supplier"
          onPick={(id) => {
            setSupplierId(id);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <>
          <div className="px-5 pt-4">{who}</div>
          <div className="px-5 pt-6">
            <CapsLabel>Payé depuis</CapsLabel>
          </div>
          <div className="px-5">
            {accountIds.length === 0 ? (
              xafAccounts.map((a) => (
                <button key={a.id} type="button" onClick={() => addLine(a.id as string)} className={cn('flex w-full items-center gap-3.5 border-b py-3.5 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider)}>
                  <AccountLogo kind={a.kind} label={a.label} currency="XAF" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{a.label}</span>
                    <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>{withCur(Number(a.balance ?? 0), 'XAF')}</span>
                  </span>
                </button>
              ))
            ) : (
              <>
                {lines.map((l, i) => {
                  const a = account(l.id);
                  const after = Number(a?.balance ?? 0) - (l.amount ?? 0);
                  return (
                    <div key={`${l.id}-${i}`} className={cn('flex items-center gap-3.5 border-b py-3', SURFACE.divider)}>
                      <button type="button" onClick={() => setPickFor(i)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                        <AccountLogo kind={a?.kind} label={a?.label} currency="XAF" />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{a?.label ?? '—'}</span>
                          <span className={cn('flex items-center gap-2 text-[15px] tabular-nums', TEXT.muted)}>
                            {withCur(Number(a?.balance ?? 0), 'XAF')}
                            {l.amount ? after < 0 && <Tag tone="danger">Négatif</Tag> : null}
                          </span>
                        </span>
                      </button>
                      {multi && (
                        <TextInput
                          inputMode="numeric"
                          aria-label={`Montant payé par ${a?.label ?? 'ce compte'}`}
                          value={splitTexts[i] ? formatPad(splitTexts[i]) : l.computed && l.amount ? fmtNum(l.amount, 0) : ''}
                          placeholder="le reste"
                          onChange={(e) => setSplit(i, e.target.value)}
                          className={cn('h-12 w-[136px] shrink-0 text-right text-[17px] font-bold tabular-nums', l.computed && 'text-[#757575]')}
                        />
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setPickFor('add')} className="flex w-full items-center gap-3.5 py-3.5 text-left">
                  <IconCircle icon={Plus} />
                  <span className={cn('text-[17px] font-semibold', TEXT.strong)}>Ajouter un compte</span>
                </button>
                {multi && (
                  <div className={cn('mt-2 flex items-center justify-between rounded-lg border px-4 py-4', SURFACE.divider)}>
                    <span className={cn('text-[16px]', TEXT.muted)}>Total payé</span>
                    <span className={cn('text-[22px] font-bold tabular-nums', TEXT.strong)}>{fmtNum(lines.reduce((s, l) => s + (l.computed ? 0 : l.amount ?? 0), 0), 0)} XAF</span>
                  </div>
                )}
              </>
            )}
          </div>
          <Dock>
            <BigButton disabled={accountIds.length === 0 || (multi && lines.filter((l) => !l.amount && !l.computed).length > 1)} onClick={goStep3}>Continuer</BigButton>
          </Dock>
        </>
      )}

      {step === 3 && (
        <>
          <div className="px-5 pt-4">{who}</div>
          <div className="flex flex-1 flex-col">
            {!r.totalLocked && (
              <BigField label="Payé" text={fieldText('total')} unit="XAF" computed={isComputed('total')} active={active === 'total'} onClick={() => setActive('total')} />
            )}
            {r.totalLocked ? (
              <BigField label="Reçu" text={fieldText('usdt')} unit="USDT" computed={isComputed('usdt')} active={active === 'usdt'} onClick={() => setActive('usdt')} />
            ) : (
              <div className="px-5 pt-5">
                <BoxField label="Reçu" text={fieldText('usdt')} unit="USDT" computed={isComputed('usdt')} active={active === 'usdt'} onClick={() => setActive('usdt')} />
              </div>
            )}
            <div className="space-y-1.5 px-5 pt-4 text-center">
              <RateLine
                text={rate ? fmtNum(rate, 2) : active === 'rate' ? fieldText('rate') : '—'}
                unit="XAF/USDT"
                active={active === 'rate'}
                onClick={() => setActive('rate')}
                tag={deviation !== null ? <Tag tone="pending">Inhabituel · {deviation > 0 ? '+' : '−'}{fmtNum(Math.abs(deviation) * 100, 1)} %</Tag> : undefined}
              />
              {xaf && usdt && rate ? (
                <p className={cn('text-[16px] tabular-nums', TEXT.muted)}>
                  {fmtNum(xaf, 0)} ÷ {fmtUsdt(usdt)} = {fmtNum(rate, 2)}
                </p>
              ) : null}
              {last && (
                <p className={cn('text-[16px]', TEXT.muted)}>
                  Dernier{lastIsSupplier && supplier ? ` chez ${supplier.display_name.split(' ')[0]}` : ''} : {fmtNum(last.rate, 2)}
                  {source.rate === null && (
                    <>
                      {' · '}
                      <button type="button" onClick={reprendre} className={cn('font-semibold underline underline-offset-[3px]', TEXT.strong)}>Reprendre</button>
                    </>
                  )}
                </p>
              )}
              {tried && error && <p className="text-[16px] font-medium text-[#900B09] dark:text-[#FCB3AD]">{error}</p>}
            </div>
            <div className="mt-auto pt-4">
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
        title={`Acheter ${fmtUsdt(usdt)} USDT ?`}
        subtitle={`à ${supplier?.display_name ?? '—'}, pour ${fmtNum(xaf ?? 0, 0)} XAF`}
        rows={confirmRows}
        confirmLabel="Enregistrer l’achat"
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
        open={pickFor !== null}
        onClose={() => setPickFor(null)}
        title={pickFor === 'add' ? 'Ajouter un compte' : 'Payé depuis'}
        value={typeof pickFor === 'number' ? accountIds[pickFor] : null}
        options={xafAccounts.map((a) => ({
          value: a.id as string,
          label: a.label ?? '—',
          hint: withCur(Number(a.balance ?? 0), 'XAF'),
          leading: <AccountLogo kind={a.kind} label={a.label} currency="XAF" />,
          disabled: accountIds.includes(a.id as string) && (pickFor === 'add' || accountIds[pickFor as number] !== a.id),
        }))}
        onPick={(id) => {
          if (pickFor === 'add') addLine(id);
          else if (typeof pickFor === 'number') setAccountIds((ids) => ids.map((x, j) => (j === pickFor ? id : x)));
        }}
        footer={
          typeof pickFor === 'number' ? (
            <BigButton
              variant="soft"
              className="mt-4"
              onClick={() => {
                removeLine(pickFor);
                setPickFor(null);
              }}
            >
              Retirer ce compte
            </BigButton>
          ) : undefined
        }
      />
      <AbandonSheet open={abandon} onClose={() => setAbandon(false)} onLeave={leave} />
    </div>
  );
}

function Saved({ data, onAgain }: { data: ReceiptData; onAgain: () => void }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const actions = useReceiptActions(ref, data);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SuccessView
        title="Achat enregistré"
        subtitle={
          <>
            {fmtUsdt(data.usdt)} USDT pour {fmtNum(data.counter, 0)} XAF
            <br />
            {data.counterparty?.name ?? '—'} · {fmtNum(data.rate, 2)} XAF/USDT
          </>
        }
        primary={{ label: 'Nouvel achat', onClick: onAgain }}
        secondary={{ label: 'Voir l’opération', onClick: () => navigate(tp.operation('purchase', data.id), { replace: true }) }}
      >
        <div className="mx-auto mt-6 w-full max-w-[340px]">
          <ReceiptButtons actions={actions} copyLabel="Copier le reçu" soft />
        </div>
      </SuccessView>
      {/* Le reçu à capturer, hors de l'écran. */}
      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 w-[360px]">
        <ReceiptCard ref={ref} data={data} />
      </div>
    </div>
  );
}
