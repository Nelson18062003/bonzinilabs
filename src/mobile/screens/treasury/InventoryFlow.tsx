/**
 * Faire l'inventaire d'un compte — maquettes 07-tresorerie/21 (compter) et
 * 22 (enregistré).
 *
 * On tape ce qu'il y a réellement (caisse, Alipay, WeChat) ; l'attendu et
 * l'écart s'affichent. Un écart exige un motif (10 caractères au moins), en
 * feuille sur le modèle de l'ajustement. Après l'enregistrement, « Suivant »
 * mène au prochain compte pas encore compté aujourd'hui.
 * RPC : `record_inventory_snapshot`.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventorySnapshots, useRecordInventorySnapshot, useTreasuryAccountBalances } from '@/hooks/useTreasury';
import { CURRENCY_DECIMALS, accountKindLabel, type TreasuryCurrency } from '@/desktop/screens/treasury/treasuryFormat';
import { canInventory } from '@/desktop/screens/treasury/treasuryLabels';
import { isValidXafAmount } from '@/lib/amountLimits';
import { cn } from '@/lib/utils';
import {
  BigButton, ConfirmSheet, Dock, EmptyLine, Keypad, SURFACE, ScreenTop, SuccessView, TEXT, WhoCard, applyKey, formatPad, padValue, type KV, type PadKey,
} from '@/mobile/designKit';
import { AccountLogo, AccountPickSheet, GapTag, ReasonField, TreasuryGate } from './parts';
import { BigField } from './EntrySteps';
import { REASON_MIN, daysSince, fmtCur, signed, tp, whenFull, withCur } from './treasuryMobile';

export function InventoryFlow() {
  const { accountId = '' } = useParams<{ accountId: string }>();
  return (
    <TreasuryGate manage>
      <InventoryBody key={accountId} accountId={accountId} />
    </TreasuryGate>
  );
}

function InventoryBody({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const balances = useTreasuryAccountBalances();
  const snaps = useInventorySnapshots(undefined, 100);
  const record = useRecordInventorySnapshot();
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pick, setPick] = useState(false);
  const [done, setDone] = useState<{ expected: number; counted: number; gap: number; reason: string | null; at: string } | null>(null);

  const acc = (balances.data ?? []).find((b) => b.id === accountId);
  const cur = (acc?.currency ?? 'XAF') as TreasuryCurrency;
  const d = CURRENCY_DECIMALS[cur];
  const expected = Number(acc?.balance ?? 0);
  const counted = padValue(text);
  const typed = text.length > 0;
  const gap = typed ? Math.round((counted - expected) * 10 ** d) / 10 ** d : null;
  const needReason = gap !== null && gap !== 0;
  const amountOk = typed && counted >= 0 && (cur !== 'XAF' || (Number.isSafeInteger(counted) && (counted === 0 || isValidXafAmount(counted, 1))));
  const reasonOk = !needReason || reason.trim().length >= REASON_MIN;
  const money = (n: number) => (cur === 'CNY' ? `¥ ${fmtCur(n, cur)}` : withCur(n, cur));

  if (!acc || !canInventory(acc.kind)) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <ScreenTop title="Inventaire" />
        {balances.isLoading ? (
          <EmptyLine>Chargement…</EmptyLine>
        ) : (
          <EmptyLine action={{ label: 'Choisir un compte', onClick: () => setPick(true) }}>{acc ? 'Ce compte se vérifie sur son relevé.' : 'Compte introuvable.'}</EmptyLine>
        )}
        <AccountPickSheet open={pick} onClose={() => setPick(false)} mode="inventory" onPick={(id) => navigate(tp.count(id), { replace: true })} />
      </div>
    );
  }

  if (done) {
    // Le prochain compte à compter : pas encore compté aujourd'hui, dans l'ordre des comptes.
    const queue = (balances.data ?? []).filter((b) => b.id && b.id !== accountId && b.is_active !== false && canInventory(b.kind));
    const next = queue.find((b) => !(snaps.data ?? []).some((s) => s.account_id === b.id && daysSince(s.snapshot_at) === 0));
    const rows: KV[] = [
      { label: 'Attendu', value: money(done.expected) },
      { label: 'Compté', value: money(done.counted) },
      { label: 'Écart', value: <GapTag gap={done.gap} text={signed(done.gap, money(Math.abs(done.gap)))} /> },
    ];
    if (done.reason) rows.push({ label: 'Motif', value: done.reason });
    return (
      <SuccessView
        title="Inventaire enregistré"
        subtitle={`${acc.label} · ${whenFull(done.at)}`}
        rows={rows}
        primary={next ? { label: `Suivant · ${next.label}`, onClick: () => navigate(tp.count(next.id as string), { replace: true }) } : { label: 'Terminer', onClick: () => navigate(tp.inventory, { replace: true }) }}
        secondary={next ? { label: 'Terminer', onClick: () => navigate(tp.inventory, { replace: true }) } : undefined}
      />
    );
  }

  const save = () => {
    if (!amountOk || !reasonOk || record.isPending) return;
    record.mutate(
      { account_id: accountId, actual_balance: counted, variance_reason: needReason ? reason.trim() : undefined },
      {
        onSuccess: () => {
          setConfirm(false);
          setDone({ expected, counted, gap: gap ?? 0, reason: needReason ? reason.trim() : null, at: new Date().toISOString() });
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ScreenTop title="Inventaire" step={confirm && needReason ? '2/2' : '1/2'} />
      <div className="px-5 pt-4">
        <WhoCard leading={<AccountLogo kind={acc.kind} label={acc.label} currency={cur} />} name={acc.label} line={accountKindLabel(acc.kind)} onClick={() => setPick(true)} />
      </div>
      <div className="flex flex-1 flex-col">
        <BigField label="Compté" text={formatPad(text)} prefix={cur === 'CNY' ? '¥' : undefined} unit={cur === 'CNY' ? undefined : cur} active />
        <div className="px-5 pt-5">
          <div className={cn('flex h-[60px] items-center justify-between rounded-lg border px-4', SURFACE.divider)}>
            <span className={cn('text-[16px]', TEXT.muted)}>Attendu</span>
            <span className={cn('text-[22px] font-bold tabular-nums', TEXT.strong)}>{money(expected)}</span>
          </div>
        </div>
        {gap !== null && (
          <div className="flex items-center justify-center gap-2.5 pt-4">
            <span className={cn('text-[17px] font-semibold', TEXT.strong)}>Écart</span>
            <GapTag gap={gap} text={signed(gap, money(Math.abs(gap)))} />
          </div>
        )}
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
        title={needReason ? 'Expliquer l’écart' : 'Enregistrer l’inventaire ?'}
        subtitle={acc.label}
        rows={[
          { label: 'Attendu', value: money(expected) },
          { label: 'Compté', value: money(counted) },
          { label: 'Écart', value: <GapTag gap={gap ?? 0} text={signed(gap ?? 0, money(Math.abs(gap ?? 0)))} /> },
        ]}
        confirmLabel="Enregistrer l’inventaire"
        disabled={!reasonOk}
        loading={record.isPending}
        onConfirm={save}
      >
        {needReason ? <ReasonField id="inv-reason" value={reason} onChange={setReason} placeholder="Ex. frais de retrait non saisis" /> : undefined}
      </ConfirmSheet>
      <AccountPickSheet open={pick} onClose={() => setPick(false)} mode="inventory" value={accountId} onPick={(id) => navigate(tp.count(id), { replace: true })} />
    </div>
  );
}
