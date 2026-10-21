/**
 * Ajuster le solde d'un compte — maquettes 07-tresorerie/18 (montant),
 * 19 (confirmation avec motif) et 20 (succès).
 *
 * Pour un apport, un retrait ou une correction hors achat et vente. Le motif
 * (10 caractères au moins) part au journal ; un solde qui deviendrait
 * négatif porte le tag rouge. XAF entier et exact (`isValidXafAmount`),
 * USDT et CNY au centime. RPC : `adjust_treasury_account`.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isValidXafAmount } from '@/lib/amountLimits';
import { useAdjustAccount, useTreasuryAccountBalances } from '@/hooks/useTreasury';
import { CURRENCY_DECIMALS, type TreasuryCurrency } from '@/desktop/screens/treasury/treasuryFormat';
import {
  AmountDisplay, BigButton, BoxSegmented, ConfirmSheet, Dock, EmptyLine, Keypad, ScreenTop, SuccessView, Tag, WhoCard,
  applyKey, formatPad, padValue, type PadKey,
} from '@/mobile/designKit';
import { AccountLogo, AccountPickSheet, ReasonField, TreasuryGate } from './parts';
import { REASON_MIN, fmtCur, tp, withCur } from './treasuryMobile';

export function AdjustFlow() {
  const { accountId = '' } = useParams<{ accountId: string }>();
  return (
    <TreasuryGate manage>
      <AdjustBody key={accountId} accountId={accountId} />
    </TreasuryGate>
  );
}

function AdjustBody({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const balances = useTreasuryAccountBalances();
  const adjust = useAdjustAccount();
  const [dir, setDir] = useState<'credit' | 'debit'>('credit');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pick, setPick] = useState(false);
  const [done, setDone] = useState<{ delta: number; after: number } | null>(null);

  const acc = (balances.data ?? []).find((b) => b.id === accountId);
  const cur = (acc?.currency ?? 'XAF') as TreasuryCurrency;
  const d = CURRENCY_DECIMALS[cur];
  const amount = padValue(text);
  const now = Number(acc?.balance ?? 0);
  const delta = dir === 'credit' ? amount : -amount;
  const after = Math.round((now + delta) * 10 ** d) / 10 ** d;
  const amountOk = amount > 0 && (cur !== 'XAF' || (isValidXafAmount(amount, 1) && Number.isSafeInteger(amount)));
  const reasonOk = reason.trim().length >= REASON_MIN;

  if (!acc) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <ScreenTop title="Ajuster le solde" />
        {balances.isLoading ? <EmptyLine>Chargement…</EmptyLine> : <EmptyLine>Compte introuvable.</EmptyLine>}
      </div>
    );
  }

  if (done) {
    return (
      <SuccessView
        title="Solde ajusté"
        subtitle={
          <>
            {done.delta > 0 ? '+' : '−'}{withCur(Math.abs(done.delta), cur)} · {acc.label}
            <br />
            Nouveau solde {withCur(done.after, cur)}
          </>
        }
        primary={{ label: 'Voir le compte', onClick: () => navigate(tp.account(accountId), { replace: true }) }}
        secondary={{ label: 'Retour à la trésorerie', onClick: () => navigate(tp.root, { replace: true }) }}
      />
    );
  }

  const save = () => {
    if (!amountOk || !reasonOk || adjust.isPending) return;
    adjust.mutate(
      { account_id: accountId, delta_amount: delta, reason: reason.trim() },
      {
        onSuccess: () => {
          setConfirm(false);
          setDone({ delta, after });
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ScreenTop title="Ajuster le solde" />
      <div className="space-y-3 px-5 pt-4">
        <WhoCard
          leading={<AccountLogo kind={acc.kind} label={acc.label} currency={cur} />}
          name={acc.label}
          line={`Solde ${withCur(now, cur)}`}
          onClick={() => setPick(true)}
        />
        <BoxSegmented
          ariaLabel="Sens"
          value={dir}
          onChange={setDir}
          options={[
            { value: 'credit', label: 'Créditer' },
            { value: 'debit', label: 'Débiter' },
          ]}
        />
      </div>
      <div className="flex flex-1 flex-col">
        <AmountDisplay
          value={formatPad(text)}
          prefix={cur === 'CNY' ? '¥' : undefined}
          suffix={cur === 'CNY' ? undefined : cur}
          conversion={
            amount > 0 ? (
              <span className="inline-flex items-center gap-2">
                Après : <b className="font-bold tabular-nums">{withCur(after, cur)}</b>
                {after < 0 && <Tag tone="danger">Négatif</Tag>}
              </span>
            ) : undefined
          }
        />
        <div className="mt-auto pt-4">
          <Keypad decimals={d} onKey={(k: PadKey) => setText((t) => applyKey(t, k, d))} />
        </div>
      </div>
      <Dock>
        <BigButton disabled={!amountOk} onClick={() => setConfirm(true)}>Continuer</BigButton>
      </Dock>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`${dir === 'credit' ? 'Créditer' : 'Débiter'} ${withCur(amount, cur)} ?`}
        subtitle={acc.label}
        rows={[{ label: 'Solde', before: fmtCur(now, cur), value: fmtCur(after, cur), tone: after < 0 ? 'danger' : undefined }]}
        confirmLabel="Enregistrer l’ajustement"
        disabled={!reasonOk}
        loading={adjust.isPending}
        onConfirm={save}
      >
        <ReasonField id="adj-reason" value={reason} onChange={setReason} placeholder="Ex. apport de caisse du 21/10" />
      </ConfirmSheet>
      <AccountPickSheet open={pick} onClose={() => setPick(false)} mode="adjust" value={accountId} onPick={(id) => navigate(tp.adjust(id), { replace: true })} />
    </div>
  );
}
