/**
 * Trésorerie — créer ou modifier une contrepartie (fournisseur USDT,
 * acheteur CNY), et la création RAPIDE depuis une saisie d'achat ou de vente.
 */
import { useState } from 'react';
import { PhoneInputWithCountry } from '@/components/form';
import { useCounterparties, useCreateCounterparty, useUpdateCounterparty } from '@/hooks/useTreasury';
import { BTN, TK } from './tstyle';
import { ErrorState, Field, Loading, Modal, Notice, SubmitButton, TextArea, TextInput } from './tkit';
import type { CounterpartyFilter } from './treasuryNav';
import { cn } from '@/lib/utils';

const NOUN: Record<CounterpartyFilter, { create: string; edit: string; name: string }> = {
  usdt_supplier: { create: 'Nouveau fournisseur USDT', edit: 'Modifier le fournisseur', name: 'Nom du fournisseur' },
  cny_buyer: { create: 'Nouvel acheteur CNY', edit: 'Modifier l’acheteur', name: 'Nom de l’acheteur' },
};

export function CounterpartyForm({ open, type, counterpartyId, onClose }: { open: boolean; type: CounterpartyFilter; counterpartyId?: string; onClose: () => void }) {
  if (!open) return null;
  return <CounterpartyFormBody key={counterpartyId ?? type} type={type} counterpartyId={counterpartyId} onClose={onClose} />;
}

function CounterpartyFormBody({ type, counterpartyId, onClose }: { type: CounterpartyFilter; counterpartyId?: string; onClose: () => void }) {
  const list = useCounterparties(undefined, true);
  const existing = counterpartyId ? (list.data ?? []).find((c) => c.id === counterpartyId) : undefined;
  const editing = !!counterpartyId;
  const t = NOUN[(existing?.type as CounterpartyFilter | undefined) ?? type];

  if (editing && list.isLoading) {
    return (
      <Modal open onClose={onClose} title={t.edit} width={520}>
        <Loading rows={4} className="p-0" />
      </Modal>
    );
  }
  // Fiche introuvable (liste en erreur, contrepartie supprimée) : surtout ne
  // pas retomber sur une CRÉATION sous un titre « Modifier ».
  if (editing && !existing) {
    return (
      <Modal open onClose={onClose} title={t.edit} footer={<button type="button" className={BTN.soft} onClick={onClose}>Fermer</button>}>
        {list.isError ? <ErrorState onRetry={() => void list.refetch()} className="py-4" /> : <Notice tone="info">Cette contrepartie est introuvable.</Notice>}
      </Modal>
    );
  }
  return <CounterpartyFields type={type} existing={existing} title={editing ? t.edit : t.create} nameLabel={t.name} onClose={onClose} />;
}

function CounterpartyFields({
  type,
  existing,
  title,
  nameLabel,
  onClose,
}: {
  type: CounterpartyFilter;
  existing?: { id: string; display_name: string; legal_name: string | null; phone: string | null; wechat_id: string | null; notes: string | null; short_id: string };
  title: string;
  nameLabel: string;
  onClose: () => void;
}) {
  const create = useCreateCounterparty();
  const update = useUpdateCounterparty();
  const [name, setName] = useState(existing?.display_name ?? '');
  const [legal, setLegal] = useState(existing?.legal_name ?? '');
  const [phone, setPhone] = useState<string | null>(existing?.phone ?? null);
  const [wechat, setWechat] = useState(existing?.wechat_id ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [tried, setTried] = useState(false);
  const busy = create.isPending || update.isPending;
  const nameError = tried && name.trim().length < 2 ? 'Indiquez un nom (2 caractères au moins).' : null;

  const save = () => {
    setTried(true);
    if (name.trim().length < 2 || busy) return;
    const payload = {
      display_name: name.trim(),
      legal_name: legal.trim() || null,
      phone: phone || null,
      wechat_id: wechat.trim() || null,
      notes: notes.trim() || null,
    };
    if (existing) {
      update.mutate({ id: existing.id, ...payload }, { onSuccess: onClose });
    } else {
      create.mutate(
        {
          type,
          display_name: payload.display_name,
          legal_name: payload.legal_name ?? undefined,
          phone: payload.phone ?? undefined,
          wechat_id: payload.wechat_id ?? undefined,
          notes: payload.notes ?? undefined,
        },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={existing ? `Identifiant ${existing.short_id} — il ne change pas.` : 'Un identifiant (F-… ou A-…) lui sera attribué.'}
      width={520}
      footer={
        <>
          <button type="button" className={BTN.soft} onClick={onClose}>
            Annuler
          </button>
          <SubmitButton busy={busy} onClick={save}>
            {existing ? 'Enregistrer' : 'Créer'}
          </SubmitButton>
        </>
      }
    >
      <Field label={nameLabel} htmlFor="cp-name" error={nameError}>
        <TextInput id="cp-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} invalid={!!nameError} placeholder="Ex. Ets Kamga & Fils" />
      </Field>
      <Field label="Raison sociale" optional htmlFor="cp-legal">
        <TextInput id="cp-legal" value={legal} onChange={(e) => setLegal(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <PhoneInputWithCountry label="Téléphone" value={phone} onValueChange={setPhone} defaultDialCode={type === 'cny_buyer' ? '+86' : '+237'} />
        <Field label="WeChat" optional htmlFor="cp-wechat">
          <TextInput id="cp-wechat" value={wechat} onChange={(e) => setWechat(e.target.value)} />
        </Field>
      </div>
      <Field label="Note" optional htmlFor="cp-notes">
        <TextArea id="cp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}

/**
 * Création rapide dans une saisie : nom + téléphone, et la nouvelle
 * contrepartie est aussitôt choisie.
 */
export function QuickCounterparty({ type, onCreated, onCancel }: { type: CounterpartyFilter; onCreated: (id: string) => void; onCancel: () => void }) {
  const create = useCreateCounterparty();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const ok = name.trim().length >= 2;

  const save = () => {
    if (!ok || create.isPending) return;
    create.mutate(
      { type, display_name: name.trim(), phone: phone ?? undefined },
      { onSuccess: (r) => r.id && onCreated(r.id) },
    );
  };

  return (
    <div className={cn(TK.inset, 'space-y-3 p-4')}>
      <div className="text-[13.5px] font-bold">{NOUN[type].create}</div>
      <Field label={NOUN[type].name} htmlFor="quick-cp-name">
        <TextInput id="quick-cp-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <PhoneInputWithCountry label="Téléphone (facultatif)" value={phone} onValueChange={setPhone} defaultDialCode={type === 'cny_buyer' ? '+86' : '+237'} />
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN.ghost} onClick={onCancel}>
          Annuler
        </button>
        <SubmitButton busy={create.isPending} disabled={!ok} onClick={save}>
          Créer et choisir
        </SubmitButton>
      </div>
    </div>
  );
}
