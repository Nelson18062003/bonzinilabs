/**
 * Les champs d'un NOUVEAU fournisseur, v2 (maquette 10-complements/07) :
 * le QR en photo, le nom, un seul champ « ID » (téléphone, e-mail ou ID
 * WeChat, reconnu à la saisie) ; virement : banque, compte, SWIFT ; cash :
 * le client lui-même, ou une autre personne et son téléphone.
 *
 * Mêmes règles que l'assistant v1 : le brouillon est un BeneficiaryDraft,
 * contrôlé par draftErrors et mis en forme par draftPayload
 * (src/lib/beneficiaries/contact.ts, testés).
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { TextInput } from '@/mobile/designKit';
import { ACCEPT_IMAGE } from '@/lib/clipboardFiles';
import { detectAccountKind, phoneFromText, type BeneficiaryDraft, type DraftErrors } from '@/lib/beneficiaries/contact';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';
import { CheckRow, FieldLabel, PhotoDrop } from '@/mobile/screens/operations/parts';

const ID_LABEL: Record<'alipay' | 'wechat', string> = { alipay: 'ID Alipay', wechat: 'ID WeChat' };

/** Le texte du champ unique « ID », tel que le brouillon le porte. */
export function accountTextOf(d: BeneficiaryDraft): string {
  return d.accountKind === 'phone' ? d.accountPhone.national : d.accountText;
}

/** Une saisie dans le champ « ID » → la nature du compte et sa valeur. */
export function withAccount(mode: BeneficiaryMode, d: BeneficiaryDraft, raw: string): BeneficiaryDraft {
  let kind = detectAccountKind(raw);
  if (mode === 'alipay' && kind === 'id') kind = raw.includes('@') ? 'email' : 'phone';
  if (mode === 'wechat' && kind === 'email') kind = 'id';
  if (!raw.trim()) kind = mode === 'wechat' ? 'id' : 'phone';
  if (kind === 'phone') return { ...d, accountKind: 'phone', accountPhone: raw.trim() ? phoneFromText(raw, d.accountPhone.country) : { ...d.accountPhone, national: '' }, accountText: '' };
  return { ...d, accountKind: kind, accountText: raw };
}

export function SupplierFields({ mode, draft, onChange, errors, showErrors, qr, clientName }: {
  mode: BeneficiaryMode;
  draft: BeneficiaryDraft;
  onChange: (d: BeneficiaryDraft) => void;
  errors: DraftErrors;
  showErrors: boolean;
  qr?: { preview: string | null; fileName?: string | null; onFiles: (files: File[]) => void; onRemove: () => void };
  clientName?: string;
}) {
  const set = (patch: Partial<BeneficiaryDraft>) => onChange({ ...draft, ...patch });
  // Ce que l'opérateur tape, tel quel : le brouillon garde la version lue (pays, format).
  const [idText, setIdText] = useState(() => accountTextOf(draft));
  const [phoneText, setPhoneText] = useState(() => draft.phone.national);
  const err = (k: keyof DraftErrors) => (showErrors ? errors[k] : undefined);
  const Err = ({ k }: { k: keyof DraftErrors }) => (err(k) ? <p className="mt-1.5 text-[15px] font-medium text-[#C00F0C] dark:text-[#FCB3AD]">{err(k)}</p> : null);

  if (mode === 'cash') {
    return (
      <div>
        <CheckRow checked={draft.isClient} onChange={(v) => set({ isClient: v })} label={clientName ? `${clientName} retire lui-même` : 'Le client retire lui-même'} className="mt-3" />
        {!draft.isClient && (
          <>
            <FieldLabel>Nom de la personne</FieldLabel>
            <TextInput className="h-14 text-[17px]" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
            <Err k="name" />
            <FieldLabel>Téléphone</FieldLabel>
            <TextInput className="h-14 text-[17px]" type="tel" inputMode="tel" value={phoneText} onChange={(e) => { setPhoneText(e.target.value); set({ phone: phoneFromText(e.target.value, draft.phone.country) }); }} placeholder="+86 138 0000 0000" />
            <Err k="phone" />
          </>
        )}
      </div>
    );
  }

  if (mode === 'bank_transfer') {
    return (
      <div>
        <FieldLabel>Titulaire</FieldLabel>
        <TextInput className="h-14 text-[17px]" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
        <Err k="name" />
        <FieldLabel>Banque</FieldLabel>
        <TextInput className="h-14 text-[17px]" value={draft.bank} onChange={(e) => set({ bank: e.target.value })} placeholder="ICBC, Bank of China…" autoComplete="off" />
        <Err k="bank" />
        <FieldLabel>N° de compte</FieldLabel>
        <TextInput className="h-14 text-[17px] tabular-nums" value={draft.account} onChange={(e) => set({ account: e.target.value })} autoComplete="off" />
        <Err k="bankAccount" />
        <FieldLabel>SWIFT · facultatif</FieldLabel>
        <TextInput className="h-14 text-[17px]" value={draft.bankExtra} onChange={(e) => set({ bankExtra: e.target.value })} autoComplete="off" />
      </div>
    );
  }

  const label = ID_LABEL[mode];
  return (
    <div>
      {qr && (
        <>
          <FieldLabel>QR du fournisseur</FieldLabel>
          <PhotoDrop label="Photo ou capture du QR" accept={ACCEPT_IMAGE} onFiles={qr.onFiles} preview={qr.preview} fileName={qr.fileName} onClear={qr.preview ? qr.onRemove : undefined} />
        </>
      )}
      <FieldLabel>Nom</FieldLabel>
      <TextInput className="h-14 text-[17px]" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
      <Err k="name" />
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        className={cn('h-14 text-[17px]', err('account') && 'border-[#C00F0C]')}
        value={idText}
        onChange={(e) => { setIdText(e.target.value); onChange(withAccount(mode, draft, e.target.value)); }}
        placeholder={mode === 'wechat' ? 'ID WeChat ou téléphone' : 'Téléphone ou e-mail'}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <Err k="account" />
    </div>
  );
}
