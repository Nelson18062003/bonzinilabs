/**
 * Les feuilles de la fiche client v2 (maquettes 10/08, 10/13, 10/14 et le
 * mot de passe sur le modèle de 03/10). Mêmes RPC et mêmes gardes que
 * l'ancienne fiche :
 *   · découvert       admin_set_wallet_overdraft (canGrantOverdraft, super admin)
 *   · supprimer       contrôle solde ≠ 0 (découvert compris) et paiements en
 *                     cours, puis admin_delete_client
 *   · prospect        admin_client_prospect_eligibility → admin_client_to_prospect
 *   · mot de passe    admin_reset_client_password, montré une fois
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { isValidXafAmount } from '@/lib/amountLimits';
import { OVERDRAFT_PRESETS_XAF, overdraftUsedXaf } from '@/lib/overdraft';
import { useResetClientPassword, useSetWalletOverdraft } from '@/hooks/useClientManagement';
import { useAdminDeleteClient } from '@/hooks/useAdminDeleteClient';
import { useClientProspectEligibility, useClientToProspect } from '@/hooks/useSales';
import { useClientSources } from '@/hooks/useClientSources';
import { whatsappShareUrl } from '@/components/clients/useCreateClientForm';
import { normalizePhone } from '@/lib/phone';
import { BigButton, BottomSheet, ConfirmSheet, Initials, KVBox, TEXT, Tag } from '@/mobile/designKit';
import { BigInput, ChoiceRow, FieldLabel, SecretCard, Tiles, xaf } from './parts';

const ACTIVE_PAYMENT_STATUSES = ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'cash_pending', 'cash_scanned'] as const;

const digits = (s: string) => Number(s.replace(/\D/g, '') || 0);

/* ── Découvert autorisé (10/08) ──────────────────────────────────────── */

export function OverdraftSheet({
  open, onClose, userId, clientName, balance, limit, note, onDone,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  clientName: string;
  balance: number;
  limit: number;
  note: string | null;
  onDone?: () => void;
}) {
  const setOverdraft = useSetWalletOverdraft();
  const [preset, setPreset] = useState<number | null>(null);
  const [free, setFree] = useState('');
  const [reason, setReason] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!open) return;
    const known = (OVERDRAFT_PRESETS_XAF as readonly number[]).includes(limit);
    setPreset(known ? limit : null);
    setFree(limit > 0 && !known ? String(limit) : '');
    setReason(note ?? '');
  }, [open, limit, note]);

  const used = overdraftUsedXaf(balance);
  const amount = free ? digits(free) : preset ?? 0;
  const belowUsed = amount < used;
  const unchanged = amount === limit && reason.trim() === (note ?? '').trim();
  const valid = Number.isSafeInteger(amount) && isValidXafAmount(amount) && reason.trim().length > 0 && !belowUsed && !unchanged;

  const submit = async (value: number, motif: string) => {
    if (setOverdraft.isPending) return;
    try {
      await setOverdraft.mutateAsync({ userId, limitXaf: value, reason: motif });
      onDone?.();
      setConfirmRemove(false);
      onClose();
    } catch {
      /* toast déjà affiché par la mutation */
    }
  };

  return (
    <>
      <BottomSheet open={open && !confirmRemove} onClose={setOverdraft.isPending ? () => undefined : onClose}>
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Découvert autorisé</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>
          {clientName} · {limit > 0 ? `aujourd'hui ${xaf(limit)}` : 'aucun aujourd’hui'}
        </p>

        <FieldLabel className="mt-5">Nouveau plafond</FieldLabel>
        <Tiles<number>
          ariaLabel="Plafonds proposés"
          options={OVERDRAFT_PRESETS_XAF.map((p) => ({ value: p, label: xaf(p) }))}
          value={free ? null : preset}
          onChange={(v) => { setPreset(v); setFree(''); }}
        />
        <BigInput
          className="mt-2.5"
          inputMode="numeric"
          placeholder="Montant libre (XAF)"
          aria-label="Montant libre (XAF)"
          value={free ? xaf(digits(free)) : ''}
          onChange={(e) => setFree(e.target.value.replace(/\D/g, '').slice(0, 13))}
        />
        {belowUsed && amount > 0 && (
          <p className="mt-2 text-[15px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">Déjà utilisé : {xaf(used)} XAF. Le plafond ne peut pas descendre en dessous.</p>
        )}
        {amount > 0 && !belowUsed && <KVBox className="mt-3" rows={[{ label: 'Solde plancher', value: `−${xaf(amount)} XAF` }]} />}

        <FieldLabel htmlFor="od-reason">Motif</FieldLabel>
        <BigInput id="od-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Facture fournisseur urgente" maxLength={200} />

        <div className="mt-5 flex flex-col gap-2.5">
          <BigButton onClick={() => void submit(amount, reason.trim())} disabled={!valid} loading={setOverdraft.isPending}>
            Enregistrer le plafond
          </BigButton>
          {limit > 0 && used === 0 && (
            <button type="button" onClick={() => setConfirmRemove(true)} className="h-11 text-[17px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">
              Retirer le découvert
            </button>
          )}
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={open && confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Retirer le découvert ?"
        subtitle={clientName}
        rows={[{ label: 'Découvert autorisé', before: xaf(limit), value: '0' }]}
        confirmLabel="Retirer le découvert"
        danger
        loading={setOverdraft.isPending}
        onConfirm={() => void submit(0, '')}
      />
    </>
  );
}

/* ── Supprimer le client (10/14) ─────────────────────────────────────── */

function CheckIcon({ ok }: { ok: boolean }) {
  return (
    <span className={cn('ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full align-middle', ok ? 'bg-[#CFF7D3] text-[#02542D]' : 'bg-[#FDD3D0] text-[#900B09]')}>
      {ok ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
}

export function DeleteClientSheet({
  open, onClose, userId, clientName, customerCode, balance, limit,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  clientName: string;
  customerCode: string;
  balance: number;
  limit: number;
}) {
  const del = useAdminDeleteClient();
  const [pending, setPending] = useState<number | null>(null);
  const [checkError, setCheckError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPending(null);
    setCheckError(false);
    void supabaseAdmin
      .from('payments')
      .select('id')
      .eq('user_id', userId)
      .in('status', ACTIVE_PAYMENT_STATUSES)
      .limit(5)
      .then(({ data, error }) => {
        if (!alive) return;
        // Une lecture échouée ne vaut pas « aucun paiement en cours ».
        if (error) setCheckError(true);
        else setPending(data?.length ?? 0);
      });
    return () => { alive = false; };
  }, [open, userId]);

  const balanceOk = balance === 0;
  const limitOk = limit === 0;
  const paymentsOk = pending === 0;
  const ready = balanceOk && paymentsOk && !checkError;

  return (
    <BottomSheet open={open} onClose={del.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Supprimer {clientName} ?</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{customerCode ? `${customerCode} · ` : ''}définitif</p>
      <KVBox
        className="mt-4"
        rows={[
          { label: 'Solde', value: <>{xaf(balance)} XAF<CheckIcon ok={balanceOk} /></> },
          { label: 'Découvert', value: <>{limit > 0 ? xaf(limit) : 'Aucun'}<CheckIcon ok={limitOk || balance >= 0} /></> },
          {
            label: 'Paiements en cours',
            value: checkError ? <>À vérifier<CheckIcon ok={false} /></> : pending === null ? '…' : <>{pending === 0 ? 'Aucun' : pending}<CheckIcon ok={paymentsOk} /></>,
          },
        ]}
      />
      <div className="mt-5 flex flex-col gap-2.5">
        <BigButton variant="danger" disabled={!ready} loading={del.isPending} onClick={() => del.mutate(userId)}>
          Supprimer le client
        </BigButton>
        <BigButton variant="soft" onClick={onClose} disabled={del.isPending}>Garder</BigButton>
      </div>
    </BottomSheet>
  );
}

/* ── Repasser en prospect (10/13) ────────────────────────────────────── */

export function ToProspectSheet({ open, onClose, userId, clientName }: { open: boolean; onClose: () => void; userId: string; clientName: string }) {
  const navigate = useNavigate();
  const eligibility = useClientProspectEligibility(userId, open);
  const sources = useClientSources();
  const toProspect = useClientToProspect();
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) { setPicked(null); setReason(''); setConfirmed(false); }
  }, [open]);

  const commercials = (sources.data ?? []).filter((s) => s.kind === 'commercial' && s.is_active);
  const data = eligibility.data;
  const suggested = data?.suggested_source_id && commercials.some((c) => c.id === data.suggested_source_id) ? data.suggested_source_id : null;
  const sourceId = picked ?? suggested;
  const chosen = commercials.find((c) => c.id === sourceId) ?? null;
  const ready = !!data?.eligible && !!chosen && confirmed && !toProspect.isPending;
  const first = clientName.split(' ')[0] || clientName;

  const submit = () => {
    if (!ready || !chosen) return;
    const target = chosen.id;
    const commercial = chosen.label;
    toProspect.mutate(
      { userId, sourceId: target, reason },
      {
        onSuccess: () => {
          onClose();
          navigate('/m/clients', { replace: true });
          toast(`${clientName} est maintenant un prospect de ${commercial}`, {
            action: { label: 'Voir le commercial', onClick: () => navigate(`/m/equipe/ventes/${target}`) },
          });
        },
      },
    );
  };

  return (
    <BottomSheet open={open} onClose={toProspect.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>{first} redevient prospect ?</h3>
      {eligibility.isLoading || (data?.eligible && sources.isLoading) ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />
          <div className="h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />
        </div>
      ) : eligibility.isError || !data ? (
        <div className="mt-3 space-y-3">
          <p className={cn('text-[16px]', TEXT.muted)}>La vérification n’a pas pu se faire.</p>
          <BigButton variant="soft" onClick={() => void eligibility.refetch()}>Réessayer</BigButton>
        </div>
      ) : !data.eligible ? (
        <>
          <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{clientName} ne peut pas redevenir prospect</p>
          <ul aria-label="Ce qui bloque" className="mt-4 rounded-lg border border-[#D9D9D9] dark:border-[#444444]">
            {(data.blockers ?? []).map((b) => (
              <li key={b} className={cn('flex items-center justify-between gap-3 border-b border-[#D9D9D9] px-4 py-3.5 text-[16px] last:border-b-0 dark:border-[#444444]', TEXT.strong)}>
                {b}<CheckIcon ok={false} />
              </li>
            ))}
          </ul>
          <BigButton variant="soft" className="mt-5" onClick={onClose}>Fermer</BigButton>
        </>
      ) : (
        <>
          <p className={cn('mt-1 text-[16px]', TEXT.muted)}>
            {data.reopen_prospect_id ? 'Aucune opération · son compte est supprimé, son ancienne fiche rouverte' : 'Aucune opération · son compte est supprimé'}
          </p>
          {(data.warnings ?? []).length > 0 && (
            <ul aria-label="Effacé aussi avec le compte (gardé au journal)" className="mt-3 flex flex-wrap gap-2">
              {(data.warnings ?? []).map((w) => <li key={w}><Tag tone="pending" className="whitespace-normal text-left leading-snug">{w}</Tag></li>)}
            </ul>
          )}
          <FieldLabel className="mt-5">Le commercial</FieldLabel>
          {commercials.length === 0 ? (
            <p className={cn('text-[16px]', TEXT.muted)}>Aucun commercial actif.</p>
          ) : (
            <div role="radiogroup" aria-label="Le commercial">
              {commercials.map((c) => (
                <ChoiceRow
                  key={c.id}
                  radioRight
                  on={sourceId === c.id}
                  onClick={() => setPicked(c.id)}
                  leading={<Initials name={c.label} />}
                  title={c.label}
                  aside={c.id === suggested ? <Tag tone="neutral">Proposé</Tag> : undefined}
                />
              ))}
            </div>
          )}
          <FieldLabel htmlFor="tp-reason">Motif</FieldLabel>
          <BigInput id="tp-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compte créé trop tôt…" maxLength={300} />
          <label className="mt-4 flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-7 w-7 shrink-0 rounded accent-[#2C2C2C]" />
            <span className={cn('text-[16px]', TEXT.strong)}>Son compte devient une fiche prospect</span>
          </label>
          <BigButton className="mt-5" onClick={submit} disabled={!ready} loading={toProspect.isPending}>Repasser en prospect</BigButton>
        </>
      )}
    </BottomSheet>
  );
}

/* ── Mot de passe du client ──────────────────────────────────────────── */

export function ClientPasswordSheets({
  open, onClose, userId, clientName, phone,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  clientName: string;
  phone: string;
}) {
  const reset = useResetClientPassword();
  const [secret, setSecret] = useState<string | null>(null);
  useEffect(() => { if (open) setSecret(null); }, [open]);
  const e164 = normalizePhone(phone, 'CM')?.e164 ?? null;
  const message = secret
    ? `Bonjour ${clientName.split(' ')[0]}, votre nouveau mot de passe Bonzini Labs : ${secret}`
    : '';

  const go = async () => {
    try {
      const r = await reset.mutateAsync(userId);
      if (r.tempPassword) setSecret(r.tempPassword);
    } catch {
      /* le hook affiche l'erreur */
    }
  };

  return (
    <>
      <ConfirmSheet
        open={open && !secret}
        onClose={onClose}
        title="Nouveau mot de passe ?"
        subtitle={`${clientName} · l’ancien ne marchera plus`}
        confirmLabel="Générer"
        loading={reset.isPending}
        onConfirm={() => void go()}
      />
      <BottomSheet open={open && !!secret} onClose={onClose}>
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Mot de passe généré</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{clientName} · montré une seule fois</p>
        {secret && <SecretCard secret={secret} />}
        <div className="mt-5 flex flex-col gap-2.5">
          {e164 && (
            <a
              href={whatsappShareUrl(e164, message)}
              target="_blank"
              rel="noreferrer"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#2C2C2C] text-[18px] font-semibold text-[#F5F5F5] active:bg-[#1E1E1E] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]"
            >
              <MessageCircle className="h-5 w-5" /> Envoyer sur WhatsApp
            </a>
          )}
          <BigButton variant="soft" onClick={onClose}>Fermer</BigButton>
        </div>
      </BottomSheet>
    </>
  );
}
