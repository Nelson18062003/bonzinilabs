/**
 * Crédit / Débit d'un client (maquettes 03/04 et 03/05) : le client et son
 * solde, Créditer / Débiter, le gros clavier, « Solde après » en direct, puis
 * la feuille de confirmation (solde avant → après, motif vu par le client) et
 * l'écran de succès.
 *
 * Réservé aux rôles qui ont `canAdjustWallets` côté serveur (super_admin,
 * ops — `admin_has_permission`), les seuls à voir l'entrée « … › Crédit /
 * Débit » ; la RPC `create_wallet_adjustment` revérifie. Un débit descend au
 * plus au plancher du découvert autorisé (`availableXaf`).
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClient, useCreateAdjustment } from '@/hooks/useClientManagement';
import { isValidXafAmount } from '@/lib/amountLimits';
import { availableXaf } from '@/lib/overdraft';
import { cn } from '@/lib/utils';
import {
  AmountDisplay, BigButton, BoxSegmented, ConfirmSheet, Dock, Initials, Keypad, ScreenLoader, ScreenTop, SuccessView, TEXT, WhoCard,
  applyKey, formatPad, padValue, type PadKey,
} from '@/mobile/designKit';
import { BigInput, FieldLabel, xaf } from './parts';

/** Les rôles que le serveur laisse ajuster un portefeuille (`canAdjustWallets`). */
export const ADJUST_ROLES = ['super_admin', 'ops'];

type Kind = 'CREDIT' | 'DEBIT';

export function MobileClientAdjust() {
  const { clientId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const { data: client, isLoading } = useClient(clientId);
  const adjust = useCreateAdjustment();
  const [kind, setKind] = useState<Kind>(params.get('type') === 'DEBIT' ? 'DEBIT' : 'CREDIT');
  const [pad, setPad] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<{ kind: Kind; amount: number; after: number } | null>(null);

  if (!ADJUST_ROLES.includes(currentUser?.role ?? '')) return <Navigate to={`/m/clients/${clientId}`} replace />;
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (!client) return <Navigate to="/m/clients" replace />;

  const name = `${client.firstName} ${client.lastName}`.trim() || 'Client';
  const balance = client.walletBalance || 0;
  const limit = client.walletOverdraftLimit ?? 0;
  const amount = padValue(pad);
  const after = kind === 'CREDIT' ? balance + amount : balance - amount;
  const tooMuch = kind === 'DEBIT' && amount > availableXaf(balance, limit);
  const amountOk = Number.isSafeInteger(amount) && isValidXafAmount(amount) && !tooMuch;
  const verb = kind === 'CREDIT' ? 'Créditer' : 'Débiter';

  const submit = async () => {
    if (!amountOk || !reason.trim() || adjust.isPending) return;
    try {
      await adjust.mutateAsync({ userId: client.id, adjustmentType: kind, amountXAF: amount, reason: reason.trim() });
      setConfirm(false);
      setDone({ kind, amount, after });
    } catch {
      /* message affiché par le hook */
    }
  };

  if (done) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <SuccessView
          title={done.kind === 'CREDIT' ? 'Crédité' : 'Débité'}
          subtitle={`${name} · ${xaf(done.amount)} XAF`}
          rows={[{ label: 'Solde après', value: `${xaf(done.after)} XAF`, tone: done.after < 0 ? 'danger' : undefined }]}
          primary={{ label: 'Voir la fiche', onClick: () => navigate(`/m/clients/${client.id}`, { replace: true }) }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title="Crédit / Débit" backTo={`/m/clients/${client.id}`} />
      <div className="px-5 pt-5">
        <WhoCard leading={<Initials name={name} />} name={name} line={`Solde ${xaf(balance)} XAF`} />
        <BoxSegmented<Kind>
          className="mt-3"
          ariaLabel="Sens"
          options={[{ value: 'CREDIT', label: 'Créditer' }, { value: 'DEBIT', label: 'Débiter' }]}
          value={kind}
          onChange={setKind}
        />
      </div>
      <AmountDisplay
        value={formatPad(pad)}
        note={
          amount > 0 ? (
            <span className={cn(tooMuch && 'font-semibold text-[#C00F0C] dark:text-[#FCB3AD]')}>
              {tooMuch ? `Au plus ${xaf(availableXaf(balance, limit))} XAF` : `Solde après · ${xaf(after)} XAF`}
            </span>
          ) : undefined
        }
      />
      <div className={cn('-mt-1 text-center text-[20px] font-semibold', TEXT.muted)}>XAF</div>
      <div className="flex-1" />
      <Keypad onKey={(k: PadKey) => setPad((p) => applyKey(p, k, 0, 12))} className="pb-3" />
      <Dock>
        <BigButton disabled={!amountOk} onClick={() => setConfirm(true)}>Continuer</BigButton>
      </Dock>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`${verb} ${xaf(amount)} XAF ?`}
        subtitle={`${name} · à votre nom`}
        rows={[
          { label: 'Solde avant', value: `${xaf(balance)} XAF` },
          { label: 'Solde après', value: `${xaf(after)} XAF`, tone: after < 0 ? 'danger' : undefined },
        ]}
        confirmLabel={`${verb} ${xaf(amount)} XAF`}
        disabled={!reason.trim() || !amountOk}
        loading={adjust.isPending}
        onConfirm={() => void submit()}
      >
        <FieldLabel htmlFor="adj-reason" className="mt-0">Motif · vu par le client</FieldLabel>
        <BigInput id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Frais de douane MSCU 4417092" maxLength={200} />
      </ConfirmSheet>
    </div>
  );
}
