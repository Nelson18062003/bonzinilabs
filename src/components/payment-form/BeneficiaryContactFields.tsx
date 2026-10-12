/**
 * Les coordonnées d'un NOUVEAU bénéficiaire, saisies avec leur format — la
 * même saisie sur ordinateur (fenêtre « Nouveau paiement ») et sur
 * téléphone (assistant de paiement).
 *
 *   · Alipay : le compte est un téléphone (indicatif du pays, formaté à la
 *     frappe) ou un email ; WeChat : l'ID WeChat ou le téléphone. Coller un
 *     numéro ou une adresse dans le champ choisit le bon type tout seul.
 *   · Le QR code remplace ou complète le compte.
 *   · Les autres coordonnées (téléphone, email) sont facultatives et
 *     vérifiées elles aussi.
 *   · Virement : titulaire, banque, numéro de compte, SWIFT ; cash : le
 *     client lui-même, ou quelqu'un d'autre avec son téléphone.
 *
 * Les règles vivent dans src/lib/beneficiaries/contact.ts (testées) ; ce
 * composant ne fait que les montrer.
 */
import type { ClipboardEvent, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT, TextInput } from '@/mobile/designKit';
import { PhoneNumberInput } from '@/components/form/PhoneNumberInput';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { ACCEPT_IMAGE } from '@/lib/clipboardFiles';
import {
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LABEL,
  detectAccountKind,
  normalizeEmail,
  phoneFromText,
  storedPhone,
  isAccountPhoneValid,
  isEmail,
  type AccountKind,
  type BeneficiaryDraft,
  type DraftErrors,
} from '@/lib/beneficiaries/contact';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';

const METHOD_NAME: Record<BeneficiaryMode, string> = { alipay: 'Alipay', wechat: 'WeChat', bank_transfer: 'virement', cash: 'cash' };

function Label({ children, htmlFor, optional, compact, right }: { children: ReactNode; htmlFor?: string; optional?: boolean; compact?: boolean; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className={cn(compact ? 'text-[13px] font-semibold' : 'text-[16px] font-semibold', TEXT.strong)}>
        {children}
        {optional && <span className={cn('ml-1 font-normal', TEXT.muted)}>(facultatif)</span>}
      </label>
      {right}
    </div>
  );
}

function Hint({ error, ok, children }: { error?: string; ok?: boolean; children?: ReactNode }) {
  if (error) return <p className="mt-1.5 text-[13px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">{error}</p>;
  if (!children) return null;
  return <p className={cn('mt-1.5 text-[13px]', ok ? 'text-[#009951] dark:text-[#14AE5C]' : TEXT.muted)}>{children}</p>;
}

function KindToggle({ kinds, value, onChange, idPrefix }: { kinds: AccountKind[]; value: AccountKind; onChange: (k: AccountKind) => void; idPrefix: string }) {
  return (
    <div role="radiogroup" aria-label="Type de compte" className="inline-flex rounded-lg bg-black/[0.05] p-0.5 dark:bg-white/[0.08]">
      {kinds.map((k) => (
        <button
          key={k}
          id={`${idPrefix}-kind-${k}`}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition',
            value === k ? 'bg-white text-[#1E1E1E] shadow-sm dark:bg-[#444] dark:text-white' : cn(TEXT.muted, 'hover:text-foreground'),
          )}
        >
          {ACCOUNT_KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

export function BeneficiaryContactFields({
  mode,
  draft,
  onChange,
  errors,
  showErrors,
  qr,
  clientName,
  compact = false,
  idPrefix = 'bf',
}: {
  mode: BeneficiaryMode;
  draft: BeneficiaryDraft;
  onChange: (next: BeneficiaryDraft) => void;
  errors: DraftErrors;
  /** Montrer les erreurs (après un premier essai d'envoi). Un format faux se montre toujours. */
  showErrors: boolean;
  /** Alipay / WeChat : le QR code, collé ou choisi. */
  qr?: { preview: string | null; onFiles: (files: File[]) => void; onRemove: () => void; pasteEnabled: boolean };
  /** Cash : le nom du client, pour « le client lui-même ». */
  clientName?: string;
  /** Libellés resserrés (fenêtre d'ordinateur). */
  compact?: boolean;
  idPrefix?: string;
}) {
  const set = (patch: Partial<BeneficiaryDraft>) => onChange({ ...draft, ...patch });
  // Un format faux se signale dès la saisie ; un champ simplement vide, seulement à l'envoi.
  const err = (field: keyof DraftErrors, typed: boolean) => (showErrors || typed ? errors[field] : undefined);
  const phoneTyped = (v: { national: string }) => v.national.replace(/\D/g, '').length > 0;

  const nameField = (label: string, placeholder: string) => (
    <div>
      <Label htmlFor={`${idPrefix}-name`} compact={compact}>
        {label}
      </Label>
      <TextInput id={`${idPrefix}-name`} placeholder={placeholder} value={draft.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
      <Hint error={showErrors ? errors.name : undefined} />
    </div>
  );

  const contactPhone = (label: string, optional: boolean) => (
    <div>
      <Label htmlFor={`${idPrefix}-phone`} optional={optional} compact={compact}>
        {label}
      </Label>
      <PhoneNumberInput id={`${idPrefix}-phone`} value={draft.phone} onChange={(phone) => set({ phone })} showValidity={false} invalid={!!err('phone', phoneTyped(draft.phone))} aria-label={label} />
      <Hint error={err('phone', phoneTyped(draft.phone))} ok>
        {storedPhone(draft.phone) ?? undefined}
      </Hint>
    </div>
  );

  const contactEmail = (
    <div>
      <Label htmlFor={`${idPrefix}-email`} optional compact={compact}>
        Email
      </Label>
      <TextInput
        id={`${idPrefix}-email`}
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nom@exemple.com"
        value={draft.email}
        onChange={(e) => set({ email: e.target.value })}
        onBlur={() => draft.email && set({ email: normalizeEmail(draft.email) })}
      />
      <Hint error={err('email', !!draft.email.trim())} />
    </div>
  );

  // ── Alipay / WeChat ───────────────────────────────────────────────
  if (mode === 'alipay' || mode === 'wechat') {
    const kinds = ACCOUNT_KINDS[mode];
    const name = METHOD_NAME[mode];
    const accountTyped = draft.accountKind === 'phone' ? phoneTyped(draft.accountPhone) : !!draft.accountText.trim();
    const accountError = err('account', accountTyped);
    const preview =
      draft.accountKind === 'phone'
        ? isAccountPhoneValid(draft.accountPhone)
          ? storedPhone(draft.accountPhone)
          : null
        : draft.accountKind === 'email'
          ? isEmail(draft.accountText)
            ? normalizeEmail(draft.accountText)
            : null
          : !errors.account && draft.accountText.trim()
            ? draft.accountText.trim()
            : null;

    // Coller un numéro ou une adresse DANS LE CHAMP DU COMPTE choisit le bon
    // type de compte (pas dans la recherche du pays, qui est aussi dans ce bloc).
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.id !== `${idPrefix}-account` && target.id !== `${idPrefix}-account-phone`) return;
      const text = e.clipboardData.getData('text');
      if (!text) return;
      const kind = detectAccountKind(text);
      if (!kinds.includes(kind)) return;
      if (kind === 'phone') {
        e.preventDefault();
        set({ accountKind: 'phone', accountPhone: phoneFromText(text, draft.accountPhone.country) });
      } else if (kind !== draft.accountKind) {
        e.preventDefault();
        set({ accountKind: kind, accountText: kind === 'email' ? normalizeEmail(text) : text.trim() });
      }
    };

    return (
      <div className="space-y-4">
        {nameField('Nom du bénéficiaire', 'Ex. : Zhang Wei')}

        <div onPasteCapture={onPaste}>
          <Label
            htmlFor={draft.accountKind === 'phone' ? `${idPrefix}-account-phone` : `${idPrefix}-account`}
            compact={compact}
            right={<KindToggle kinds={kinds} value={draft.accountKind} onChange={(k) => set({ accountKind: k })} idPrefix={idPrefix} />}
          >
            Compte {name}
          </Label>
          {draft.accountKind === 'phone' ? (
            <PhoneNumberInput
              id={`${idPrefix}-account-phone`}
              value={draft.accountPhone}
              onChange={(accountPhone) => set({ accountPhone })}
              showValidity={false}
              invalid={!!accountError}
              aria-label={`Compte ${name} (téléphone)`}
            />
          ) : (
            <TextInput
              id={`${idPrefix}-account`}
              type={draft.accountKind === 'email' ? 'email' : 'text'}
              inputMode={draft.accountKind === 'email' ? 'email' : 'text'}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label={`Compte ${name} (${ACCOUNT_KIND_LABEL[draft.accountKind]})`}
              aria-invalid={!!accountError}
              placeholder={draft.accountKind === 'email' ? 'nom@exemple.com' : 'ex. zhangwei_88'}
              value={draft.accountText}
              onChange={(e) => set({ accountText: e.target.value })}
              onBlur={() => draft.accountKind === 'email' && draft.accountText && set({ accountText: normalizeEmail(draft.accountText) })}
              className={cn(accountError && 'border-[#EC221F] dark:border-[#EC221F]')}
            />
          )}
          <Hint error={accountError} ok={!!preview}>
            {preview ? `Le partenaire lira : ${preview}` : draft.accountKind === 'id' ? '6 à 20 caractères, une lettre d’abord.' : undefined}
          </Hint>
        </div>

        {qr && (
          <div>
            <Label compact={compact} optional>
              QR code {name}
            </Label>
            {qr.preview ? (
              <div className="relative overflow-hidden rounded-xl bg-white ring-1 ring-black/10">
                <img src={qr.preview} alt={`QR code ${name}`} className="mx-auto block h-[150px] object-contain" />
                <button type="button" onClick={qr.onRemove} aria-label="Retirer le QR code" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <PasteDropZone onFiles={qr.onFiles} enabled={qr.pasteEnabled} single accept={ACCEPT_IMAGE} compact title="Collez, glissez ou cliquez le QR code" hint="Ctrl+V colle votre capture d’écran" />
            )}
          </div>
        )}

        <div className={cn('grid gap-4', compact && 'sm:grid-cols-2')}>
          {draft.accountKind !== 'phone' && contactPhone('Téléphone', true)}
          {draft.accountKind !== 'email' && contactEmail}
        </div>
      </div>
    );
  }

  // ── Virement ──────────────────────────────────────────────────────
  if (mode === 'bank_transfer') {
    return (
      <div className="space-y-4">
        {nameField('Titulaire du compte', 'Ex. : Guangzhou Hongfa Trade Co.')}
        <div className={cn('grid gap-4', compact && 'sm:grid-cols-2')}>
          <div>
            <Label htmlFor={`${idPrefix}-bank`} compact={compact}>
              Banque
            </Label>
            <TextInput id={`${idPrefix}-bank`} placeholder="Ex. : Bank of China" value={draft.bank} onChange={(e) => set({ bank: e.target.value })} autoComplete="off" />
            <Hint error={showErrors ? errors.bank : undefined} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-bank-account`} compact={compact}>
              Numéro de compte
            </Label>
            <TextInput
              id={`${idPrefix}-bank-account`}
              placeholder="Ex. : 6214 8802 3391 5588"
              value={draft.account}
              onChange={(e) => set({ account: e.target.value.toUpperCase() })}
              autoComplete="off"
              spellCheck={false}
              className="tabular-nums"
            />
            <Hint error={err('bankAccount', !!draft.account.replace(/\s/g, '') && draft.account.replace(/[\s-]/g, '').length >= 6)} />
          </div>
        </div>
        <div className={cn('grid gap-4', compact && 'sm:grid-cols-2')}>
          <div>
            <Label htmlFor={`${idPrefix}-bank-extra`} optional compact={compact}>
              SWIFT / code banque
            </Label>
            <TextInput id={`${idPrefix}-bank-extra`} placeholder="Ex. : BKCHCNBJ" value={draft.bankExtra} onChange={(e) => set({ bankExtra: e.target.value.toUpperCase() })} autoComplete="off" spellCheck={false} />
          </div>
          {contactPhone('Téléphone', true)}
        </div>
      </div>
    );
  }

  // ── Cash ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Qui retire le cash" className="grid grid-cols-2 gap-2">
        {[
          { self: true, label: 'Le client lui-même', hint: clientName },
          { self: false, label: 'Quelqu’un d’autre', hint: 'Nom et téléphone' },
        ].map((o) => (
          <button
            key={String(o.self)}
            type="button"
            role="radio"
            aria-checked={draft.isClient === o.self}
            onClick={() => set({ isClient: o.self })}
            className={cn(
              'rounded-xl px-3 py-2.5 text-left transition',
              draft.isClient === o.self ? 'bg-foreground text-background' : 'ring-1 ring-black/[0.12] hover:ring-black/30 dark:ring-white/[0.15]',
            )}
          >
            <span className="block text-[13.5px] font-bold">{o.label}</span>
            {o.hint && <span className={cn('block truncate text-[12px]', draft.isClient === o.self ? 'opacity-75' : TEXT.muted)}>{o.hint}</span>}
          </button>
        ))}
      </div>
      {!draft.isClient && (
        <>
          {nameField('Nom de la personne', 'Ex. : Wang Fang')}
          {contactPhone('Téléphone', false)}
        </>
      )}
    </div>
  );
}
