/**
 * Trésorerie — les deux gestes sur un compte : ajuster son solde, faire son
 * inventaire. Fenêtres courtes ; le compte peut arriver déjà choisi (depuis
 * sa ligne ou sa fiche).
 *
 * Garde-fous conservés : un ajustement exige un motif (il part au journal),
 * un inventaire exige un motif DÈS QU'IL Y A UN ÉCART. Seuls les comptes
 * cash, Alipay et WeChat s'inventorient.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAdjustAccount, useRecordInventorySnapshot, useTreasuryAccountBalances } from '@/hooks/useTreasury';
import { isValidXafAmount } from '@/lib/amountLimits';
import { BTN, REASON_MIN, TK, reasonError } from './tstyle';
import { AmountInput, Computed, Field, Modal, Notice, Picker, Segmented, SubmitButton, TextInput } from './tkit';
import { CURRENCY_DECIMALS, fmtNum, type TreasuryCurrency } from './treasuryFormat';
import { canInventory } from './treasuryLabels';

/* ── Ajuster ──────────────────────────────────────────────────────────── */

export function AdjustForm({ open, accountId, onClose }: { open: boolean; accountId: string | null; onClose: () => void }) {
  if (!open) return null;
  return <AdjustBody initial={accountId} onClose={onClose} />;
}

function AdjustBody({ initial, onClose }: { initial: string | null; onClose: () => void }) {
  const balances = useTreasuryAccountBalances();
  const adjust = useAdjustAccount();
  const [accountId, setAccountId] = useState(initial ?? '');
  const [dir, setDir] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);

  const accounts = (balances.data ?? []).filter((b) => b.is_active !== false && b.id);
  const acc = accounts.find((a) => a.id === accountId);
  const cur = (acc?.currency ?? 'XAF') as TreasuryCurrency;
  const d = CURRENCY_DECIMALS[cur];
  const now = Number(acc?.balance ?? 0);
  const delta = amount ? (dir === 'credit' ? amount : -amount) : 0;
  const rErr = reasonError(reason, tried);
  // Le XAF est entier et exact (≤ 2^53) ; USDT et CNY gardent leurs décimales.
  const amountOk = !!amount && amount > 0 && (cur !== 'XAF' || isValidXafAmount(amount, 1));
  const valid = !!acc && amountOk && reason.trim().length >= REASON_MIN;

  const save = () => {
    setTried(true);
    if (!valid || adjust.isPending) return;
    adjust.mutate({ account_id: accountId, delta_amount: delta, reason: reason.trim() }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajuster le solde d’un compte"
      description="Pour un apport, un retrait ou une correction hors achat et vente. Le motif est gardé au journal."
      width={520}
      footer={
        <>
          <button type="button" className={BTN.soft} onClick={onClose}>
            Annuler
          </button>
          <SubmitButton busy={adjust.isPending} onClick={save}>
            {amount && acc ? `${dir === 'credit' ? 'Ajouter' : 'Retirer'} ${fmtNum(amount, d)} ${cur}` : 'Ajuster'}
          </SubmitButton>
        </>
      }
    >
      <Field label="Compte" htmlFor="adj-account" error={tried && !acc ? 'Choisissez le compte.' : null}>
        <Picker
          id="adj-account"
          variant="field"
          value={accountId}
          onChange={(v) => {
            // Les décimales changent avec la devise : on ne garde pas 12,50 CNY
            // affiché « 13 » sur un compte XAF.
            setAccountId(v);
            setAmount(null);
          }}
          options={accounts.map((a) => ({ value: a.id!, label: a.label ?? '—', hint: a.currency ?? undefined }))}
          placeholder="Choisir le compte…"
          invalid={tried && !acc}
        />
      </Field>
      <Field label="Sens">
        <Segmented
          ariaLabel="Sens de l’ajustement"
          value={dir}
          onChange={setDir}
          options={[
            { value: 'credit', label: 'Ajouter au solde' },
            { value: 'debit', label: 'Retirer du solde' },
          ]}
        />
      </Field>
      <Field label="Montant" htmlFor="adj-amount" error={tried && !amountOk ? 'Indiquez un montant valide.' : null}>
        <AmountInput id="adj-amount" value={amount} onChange={setAmount} unit={cur} decimals={d} invalid={tried && !amountOk} />
      </Field>
      {acc && (
        <Computed label="Solde actuel → après">
          <span className={cn(TK.num, now + delta < 0 && TK.warn)}>
            {fmtNum(now, d)} → {fmtNum(now + delta, d)} {cur}
          </span>
        </Computed>
      )}
      {acc && now + delta < 0 && <Notice>Le solde deviendra négatif.</Notice>}
      <Field label="Motif" htmlFor="adj-reason" error={rErr} hint={`${REASON_MIN} caractères au moins.`}>
        <TextInput id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!rErr} placeholder="Ex. apport de caisse du 12/08" />
      </Field>
    </Modal>
  );
}

/* ── Inventaire ───────────────────────────────────────────────────────── */

export function InventoryForm({ open, accountId, onClose }: { open: boolean; accountId: string | null; onClose: () => void }) {
  if (!open) return null;
  return <InventoryBody initial={accountId} onClose={onClose} />;
}

function InventoryBody({ initial, onClose }: { initial: string | null; onClose: () => void }) {
  const balances = useTreasuryAccountBalances();
  const record = useRecordInventorySnapshot();
  const [accountId, setAccountId] = useState(initial ?? '');
  const [counted, setCounted] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);

  const accounts = (balances.data ?? []).filter((b) => b.is_active !== false && b.id && canInventory(b.kind));
  const acc = accounts.find((a) => a.id === accountId);
  const cur = (acc?.currency ?? 'XAF') as TreasuryCurrency;
  const d = CURRENCY_DECIMALS[cur];
  const expected = Number(acc?.balance ?? 0);
  const gap = counted !== null ? Math.round((counted - expected) * 10 ** d) / 10 ** d : null;
  const needReason = gap !== null && gap !== 0;
  const rErr = needReason ? reasonError(reason, tried) : null;
  const valid = !!acc && counted !== null && (!needReason || reason.trim().length >= REASON_MIN);

  const save = () => {
    setTried(true);
    if (!valid || counted === null || record.isPending) return;
    record.mutate(
      { account_id: accountId, actual_balance: counted, variance_reason: needReason ? reason.trim() : undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Faire un inventaire"
      description="Comptez ce qu’il y a réellement sur le compte. L’écart avec le solde attendu est enregistré."
      width={520}
      footer={
        <>
          <button type="button" className={BTN.soft} onClick={onClose}>
            Annuler
          </button>
          <SubmitButton busy={record.isPending} onClick={save}>
            Enregistrer l’inventaire
          </SubmitButton>
        </>
      }
    >
      <Field label="Compte" htmlFor="inv-account" hint="Caisses, Alipay et WeChat. Une banque se vérifie sur son relevé." error={tried && !acc ? 'Choisissez le compte.' : null}>
        <Picker
          id="inv-account"
          variant="field"
          value={accountId}
          onChange={(v) => {
            setAccountId(v);
            setCounted(null);
          }}
          options={accounts.map((a) => ({ value: a.id!, label: a.label ?? '—', hint: a.currency ?? undefined }))}
          placeholder="Choisir le compte…"
          invalid={tried && !acc}
        />
      </Field>
      {initial && !acc && !!balances.data && <Notice tone="info">Ce compte ne s’inventorie pas : choisissez une caisse, Alipay ou WeChat.</Notice>}
      {acc && (
        <>
          <Computed label="Solde attendu">
            {fmtNum(expected, d)} {cur}
          </Computed>
          <Field label="Montant compté" htmlFor="inv-counted" error={tried && counted === null ? 'Indiquez le montant compté.' : null}>
            <AmountInput id="inv-counted" value={counted} onChange={setCounted} unit={cur} decimals={d} invalid={tried && counted === null} autoFocus />
          </Field>
          {gap !== null && (
            <Computed label="Écart" tone={gap !== 0 ? 'warn' : undefined}>
              <span className={gap === 0 ? TK.in : gap > 0 ? TK.in : TK.out}>
                {gap === 0 ? 'Aucun écart' : `${gap > 0 ? '+' : '−'} ${fmtNum(Math.abs(gap), d)} ${cur}`}
              </span>
            </Computed>
          )}
          {needReason && (
            <Field label="Explication de l’écart" htmlFor="inv-reason" error={rErr} hint={`${REASON_MIN} caractères au moins.`}>
              <TextInput id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!rErr} placeholder="Ex. billet manquant, erreur de rendu" />
            </Field>
          )}
        </>
      )}
    </Modal>
  );
}
