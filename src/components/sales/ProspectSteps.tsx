// ============================================================
// ESPACE COMMERCIAL — les écrans de l'assistant « prospect », une idée par
// écran : Qui est-ce ? · Comment le joindre ? · Où est installée son
// activité ? · Qu'est-ce qui le bloque ? · Que pouvons-nous faire pour
// lui ? · Et maintenant ?
//
// Chaque champ est taillé pour sa donnée : prénom et nom à majuscule
// initiale, sexe en deux grandes cartes, numéros à drapeau et indicatif
// (plusieurs, avec un libellé « WhatsApp », « WeChat »…), email en
// minuscules avec ses fins d'adresse, ville en pastilles ou en saisie
// suggérée, date de naissance « JJ/MM/AAAA » au pavé numérique et l'âge
// qui s'affiche, idées de problèmes qu'un toucher ajoute au texte. Chaque
// contrôle porte `aria-describedby` (son erreur ou son indice) et
// `aria-required` s'il est obligatoire.
// Chaque numéro complet est vérifié EN DIRECT (07/10, usePhoneCheck) : déjà
// un de ses clients, un de ses prospects, suivi par un autre commercial —
// refusé sous le champ ; celui d'un client Bonzini — une note ambre, sans
// nom ni blocage : la fiche partira « À vérifier », la direction décidera.
// Rendu seulement : le brouillon, les règles et les erreurs viennent de
// l'assistant (ProspectWizard) et de prospectDraft.ts.
// ============================================================
import { useEffect, useLayoutEffect, useRef, useState, type ElementType, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, Check, ChevronRight, Info, MapPin, Plane, Plus, Ship, Wallet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAMEROON_CITIES, GENDER_OPTIONS, ageOn, emailError, formatBirthDate, type Gender } from '@/lib/people';
import { CHINESE_PHONE_LABELS, CLIENT_NUMBER_NOTE, INTERESTS, PAIN_IDEAS, PHONE_LABEL_IDEAS, type Interest } from '@/lib/sales';
import { PhoneNumberInput, formatE164ForDisplay, toE164 } from '@/components/form/PhoneNumberInput';
import { Field } from './SalesUi';
import { AREA, CHIP, FIELD, btn, descId } from './uiClasses';
import {
  FIELD_ID,
  MAX_OTHER_PHONES,
  addIdea,
  birthError,
  birthIso,
  canonicalCity,
  capitalizeFirst,
  capitalizeName,
  citySuggestions,
  emailCompletions,
  formatBirthInput,
  hasIdea,
  ideaLineEnd,
  isNewNumber,
  newRowKey,
  normalizeEmail,
  otherPhoneId,
  PHONE_CHECK_REFUSAL,
  removeIdea,
  samePhone,
  type PhoneCheckResult,
  type PhoneRow,
  type ProspectDraft,
  type StepErrors,
} from './prospectDraft';
import { addDays, doualaDay, fmtWeekday } from './salesHelpers';
import { useLivePhoneCheck, type OnPhoneCheck } from './usePhoneCheck';

export interface StepProps {
  d: ProspectDraft;
  set: <K extends keyof ProspectDraft>(k: K, v: ProspectDraft[K]) => void;
  update: (fn: (d: ProspectDraft) => ProspectDraft) => void;
  /** Les erreurs à MONTRER (après « Continuer », ou à la sortie d'un champ à format). */
  errors: StepErrors;
  /** Un champ à format (date, email, numéro) quitté : son erreur peut se montrer. */
  onTouch: (id: string) => void;
  autoFocus?: boolean;
  /** La fiche avant modification. */
  original?: ProspectDraft;
  /** Devenu client : ses numéros sont figés (seuls les libellés changent). */
  won?: boolean;
  /**
   * La vérification en direct des numéros (« Comment le joindre ? ») :
   * `excludeId` = la fiche modifiée (null à la création) ; `onResult`
   * remonte chaque réponse à l'assistant, qui arrête « Continuer » sur un refus.
   */
  phoneCheck?: { excludeId: string | null; onResult: OnPhoneCheck };
}

const NOTES_MAX = 1000;

/** Un champ long qui grandit avec son texte (rien ne se cache derrière une barre de défilement). */
function GrowArea({ value, className, areaRef, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; areaRef?: { current: HTMLTextAreaElement | null } }) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = areaRef ?? own;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, ref]);
  // eslint-disable-next-line no-restricted-syntax -- champ long de « /v » à 17 px
  return <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} value={value} className={cn(className, 'overflow-hidden')} {...rest} />;
}
const FREE_MAX = 2000;
const LABEL_MAX = 40;

/* ── 1. Qui est-ce ? ───────────────────────────────────────────────────── */

export function WhoStep({ d, set, update, errors, onTouch, autoFocus }: StepProps) {
  const iso = birthIso(d.birth);
  const age = iso ? ageOn(iso) : null;
  const plausible = age !== null && age >= 16 && age <= 110;
  // Comme côté client : une date complète mais impossible se dit tout de suite ;
  // une date commencée, seulement en quittant le champ (on est peut-être en train de taper).
  const [typingBirth, setTypingBirth] = useState(false);
  const birthNow = iso ? birthError(d.birth) : null;
  const birthErr = birthNow ?? (typingBirth && iso === null ? undefined : errors[FIELD_ID.birth]);
  const longDate = iso && plausible ? formatBirthDate(iso)?.replace(/\s*\(\d+ ans\)$/, '') : null;
  const bornLabel = d.gender === 'FEMALE' ? `Née le ${longDate}` : d.gender === 'MALE' ? `Né le ${longDate}` : `Le ${longDate}`;
  return (
    <div className="space-y-6">
      <Field label="Prénom(s)" required htmlFor={FIELD_ID.firstName} error={errors[FIELD_ID.firstName]}>
        {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
        <input
          id={FIELD_ID.firstName}
          autoFocus={autoFocus}
          className={FIELD}
          value={d.firstName}
          onChange={(e) => set('firstName', capitalizeFirst(e.target.value))}
          onBlur={() => update((x) => ({ ...x, firstName: capitalizeName(x.firstName) }))}
          autoComplete="given-name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={80}
          placeholder="Ex. : Jean-Paul"
          aria-required
          aria-invalid={!!errors[FIELD_ID.firstName]}
          aria-describedby={descId(FIELD_ID.firstName)}
        />
      </Field>
      <Field label="Nom" required htmlFor={FIELD_ID.lastName} error={errors[FIELD_ID.lastName]}>
        {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
        <input
          id={FIELD_ID.lastName}
          className={FIELD}
          value={d.lastName}
          onChange={(e) => set('lastName', capitalizeFirst(e.target.value))}
          onBlur={() => update((x) => ({ ...x, lastName: capitalizeName(x.lastName) }))}
          autoComplete="family-name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={80}
          placeholder="Ex. : Etoga"
          aria-required
          aria-invalid={!!errors[FIELD_ID.lastName]}
          aria-describedby={descId(FIELD_ID.lastName)}
        />
      </Field>
      <Field label="Sexe" required group htmlFor={FIELD_ID.gender} error={errors[FIELD_ID.gender]}>
        <GenderCards value={d.gender} onChange={(g) => set('gender', g)} invalid={!!errors[FIELD_ID.gender]} />
      </Field>
      <Field
        label="Date de naissance"
        optional
        htmlFor={FIELD_ID.birth}
        error={birthErr}
        hint={longDate ? bornLabel : 'Le jour, le mois, l’année : les barres se posent seules.'}
      >
        <div className="relative">
          {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
          <input
            id={FIELD_ID.birth}
            className={cn(FIELD, 'pr-24 tabular-nums tracking-[0.04em]')}
            inputMode="numeric"
            autoComplete="bday"
            enterKeyHint="next"
            placeholder="JJ/MM/AAAA"
            maxLength={10}
            value={d.birth}
            onChange={(e) => {
              setTypingBirth(true);
              set('birth', formatBirthInput(e.target.value));
            }}
            onBlur={() => {
              setTypingBirth(false);
              onTouch(FIELD_ID.birth);
            }}
            // Entrée (« Suivant ») : la frappe est finie, une date incomplète peut se dire.
            onKeyDown={(e) => e.key === 'Enter' && setTypingBirth(false)}
            aria-invalid={!!birthErr}
            aria-describedby={descId(FIELD_ID.birth)}
          />
          {plausible && !birthErr && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <span key={age} className="s-card s-pop rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums s-ink-2">
                {age} ans
              </span>
            </span>
          )}
        </div>
      </Field>
    </div>
  );
}

/**
 * Homme / Femme : deux grandes cartes, un rond qui se remplit. Un groupe
 * radio au clavier, comme côté client (GenderField) : un seul arrêt de
 * tabulation (le choix, ou la première carte), les flèches passent d'une
 * carte à l'autre et la choisissent.
 */
function GenderCards({ value, onChange, invalid }: { value: Gender | ''; onChange: (g: Gender) => void; invalid: boolean }) {
  const focusable = value || GENDER_OPTIONS[0].value;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    // Depuis la carte qui a le focus (rien de choisi : la première), comme un groupe radio.
    const from = (e.target as HTMLElement).closest<HTMLElement>('[data-gender]')?.dataset.gender ?? value;
    const i = Math.max(0, GENDER_OPTIONS.findIndex((o) => o.value === from));
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = GENDER_OPTIONS[(i + step + GENDER_OPTIONS.length) % GENDER_OPTIONS.length].value;
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-gender="${next}"]`)?.focus();
  };
  return (
    <div
      id={FIELD_ID.gender}
      role="radiogroup"
      aria-labelledby={`${FIELD_ID.gender}-label`}
      aria-required
      aria-invalid={invalid}
      aria-describedby={descId(FIELD_ID.gender)}
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 gap-3"
    >
      {GENDER_OPTIONS.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-gender={o.value}
            tabIndex={o.value === focusable ? 0 : -1}
            data-invalid={invalid && !value}
            onClick={() => onChange(o.value)}
            className="s-option flex h-16 items-center gap-3 rounded-2xl px-4 text-left text-[17px] font-semibold"
          >
            <span className="s-radio flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" aria-hidden>
              <i className="block h-2 w-2 rounded-full" />
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── 2. Comment le joindre ? ───────────────────────────────────────────── */

const LINK = 'inline-flex items-center gap-0.5 whitespace-nowrap font-semibold underline underline-offset-2';

/** Le refus d'une vérification en direct, avec le lien utile (sa fiche, ses clients). */
function refusalOf(check: PhoneCheckResult | null): { message: string; action?: ReactNode } | null {
  const message = check ? PHONE_CHECK_REFUSAL[check.status] : undefined;
  if (!check || !message) return null;
  if (check.status === 'mine' && check.prospectId)
    return {
      message,
      action: (
        <Link to={`/v/prospects/${check.prospectId}`} className={LINK}>
          Ouvrir sa fiche
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ),
    };
  if (check.status === 'own_client')
    return {
      message,
      action: (
        <Link to="/v/clients" className={LINK}>
          Voir mes clients
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ),
    };
  return { message };
}

/** Le numéro d'un client Bonzini : rien ne bloque, la direction décidera (aucun nom : le commercial ne sait pas lequel). */
function ClientNumberNote({ id, className }: { id?: string; className?: string }) {
  return (
    <div id={id} role="status" data-tone="warn" className={cn('s-note s-pop flex items-start gap-2.5 rounded-[12px] px-3.5 py-2.5 text-[14px] leading-snug', className)}>
      <Info className="mt-[2px] h-4 w-4 shrink-0 s-warn" aria-hidden />
      <p className="min-w-0 s-ink-2">
        <strong className="font-semibold s-ink">{CLIENT_NUMBER_NOTE.title}</strong> {CLIENT_NUMBER_NOTE.next}
      </p>
    </div>
  );
}

export function ReachStep({ d, set, update, errors, onTouch, autoFocus, original, won, phoneCheck }: StepProps) {
  const e164 = toE164(d.phone);
  const changed = !original || !samePhone(d.phone, original.phone);
  // Vérifiés en direct : les numéros complets, nouveaux sur la fiche (un numéro devenu client ne change plus).
  const checking = !!phoneCheck && !won;
  const excludeId = phoneCheck?.excludeId ?? null;
  const mainCheck = useLivePhoneCheck(FIELD_ID.phone, checking && e164 && isNewNumber(e164, original) ? e164 : null, excludeId, phoneCheck?.onResult);
  // Une erreur du formulaire ou du serveur passe avant la réponse de la vérification.
  const mainRefusal = errors[FIELD_ID.phone] ? null : refusalOf(mainCheck);
  const mainErr = errors[FIELD_ID.phone] ?? mainRefusal?.message;
  const mainIsClient = !mainErr && mainCheck?.status === 'client';
  const emailErr = errors[FIELD_ID.email];
  const completions = !emailError(d.email) && d.email.includes('@') && d.email.split('@')[1]?.includes('.') ? [] : emailCompletions(d.email);

  // Un numéro ajouté : le curseur y va tout de suite.
  const count = d.others.length;
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) document.getElementById(otherPhoneId(d.others[count - 1].key))?.focus();
    prev.current = count;
  }, [count, d.others]);

  const setRow = (key: string, patch: Partial<PhoneRow>) => update((x) => ({ ...x, others: x.others.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const addRow = () =>
    update((x) => (x.others.length >= MAX_OTHER_PHONES ? x : { ...x, others: [...x.others, { key: newRowKey(), value: { country: x.phone.country, national: '' }, label: '' }] }));
  // Le compteur ne se montre qu'à l'approche de la limite (« Encore 2 possibles »).
  const left = MAX_OTHER_PHONES - count;
  const removeRow = (key: string) => update((x) => ({ ...x, others: x.others.filter((r) => r.key !== key) }));
  // Le numéro de chaque ligne à vérifier : complet, nouveau sur la fiche, pas déjà plus haut dans la liste.
  const seen = new Set<string>(e164 ? [e164] : []);
  const toCheck = d.others.map((r) => {
    const x = toE164(r.value);
    if (!x || seen.has(x)) return null;
    seen.add(x);
    return isNewNumber(x, original) ? x : null;
  });

  return (
    <div className="space-y-6">
      <Field
        label="Numéro principal"
        required={!won}
        htmlFor={FIELD_ID.phone}
        error={mainErr}
        errorAction={mainRefusal?.action}
        hint={
          won ? (
            'Devenu client : ses numéros ne changent plus ici.'
          ) : mainIsClient ? (
            <ClientNumberNote />
          ) : e164 && changed ? (
            `Sera enregistré : ${formatE164ForDisplay(e164)}`
          ) : (
            'Le Cameroun d’abord ; pour un autre pays, touchez le drapeau.'
          )
        }
      >
        <div className="s-phone" data-invalid={!!mainErr}>
          <PhoneNumberInput
            id={FIELD_ID.phone}
            aria-label="Numéro principal"
            aria-required={!won}
            aria-describedby={descId(FIELD_ID.phone)}
            value={d.phone}
            onChange={(v) => set('phone', v)}
            showValidity={false}
            invalid={!!mainErr}
            disabled={won}
            autoFocus={autoFocus && !won}
          />
        </div>
      </Field>

      <div>
        <div className="mb-2 flex min-h-[20px] items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold s-ink">
            Autres numéros <span className="ml-1 font-normal s-ink-3">facultatif</span>
          </span>
          {count > 0 && left <= 3 && (
            <span className="text-[13px] tabular-nums s-ink-3">{left === 0 ? 'C’est le maximum' : `Encore ${left} possible${left > 1 ? 's' : ''}`}</span>
          )}
        </div>
        <div className="space-y-3">
          {d.others.map((r, i) => (
            <OtherPhone
              key={r.key}
              row={r}
              index={i}
              won={won}
              error={errors[otherPhoneId(r.key)]}
              checkE164={checking ? toCheck[i] : null}
              excludeId={excludeId}
              onCheck={phoneCheck?.onResult}
              onChange={(patch) => setRow(r.key, patch)}
              onRemove={() => removeRow(r.key)}
              onBlur={() => onTouch(otherPhoneId(r.key))}
            />
          ))}
          {!won && count < MAX_OTHER_PHONES && (
            <button type="button" onClick={addRow} className="s-add flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold">
              <Plus className="h-4 w-4" aria-hidden />
              {count === 0 ? 'Ajouter un numéro (WhatsApp, WeChat…)' : 'Ajouter un autre numéro'}
            </button>
          )}
        </div>
      </div>

      <Field label="Email" optional htmlFor={FIELD_ID.email} error={emailErr}>
        {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
        <input
          id={FIELD_ID.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={254}
          className={FIELD}
          placeholder="nom@exemple.com"
          value={d.email}
          onChange={(e) => set('email', normalizeEmail(e.target.value))}
          onBlur={() => onTouch(FIELD_ID.email)}
          aria-invalid={!!emailErr}
          aria-describedby={descId(FIELD_ID.email)}
        />
        {completions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Compléter l’adresse">
            {completions.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Compléter : ${c}`}
                onClick={() => set('email', c)}
                className="s-idea s-pop inline-flex h-8 items-center rounded-full px-3 text-[14px] font-medium"
              >
                {c.slice(c.indexOf('@'))}
              </button>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}

/** Un numéro de plus : son libellé d'un toucher (« WhatsApp »…, « Autre… » pour le sien), le numéro, la croix. */
function OtherPhone({
  row,
  index,
  won,
  error: formError,
  checkE164,
  excludeId,
  onCheck,
  onChange,
  onRemove,
  onBlur,
}: {
  row: PhoneRow;
  index: number;
  won?: boolean;
  error?: string;
  /** Le numéro à vérifier en direct (null : rien à vérifier). */
  checkE164: string | null;
  excludeId: string | null;
  onCheck?: OnPhoneCheck;
  onChange: (patch: Partial<PhoneRow>) => void;
  onRemove: () => void;
  onBlur: () => void;
}) {
  const label = row.label.trim();
  const isQuick = (l: string) => PHONE_LABEL_IDEAS.some((q) => q.toLowerCase() === l.toLowerCase());
  const custom = label !== '' && !isQuick(label);
  const [otherOpen, setOtherOpen] = useState(custom);
  const title = label || `Numéro ${index + 2}`;
  const inputId = otherPhoneId(row.key);
  const check = useLivePhoneCheck(inputId, checkE164, excludeId, onCheck);
  const refusal = formError ? null : refusalOf(check);
  const error = formError ?? refusal?.message;
  const isClient = !error && check?.status === 'client';
  return (
    <div className="s-inset s-enter space-y-3 rounded-2xl p-3" onBlur={onBlur}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="min-w-0 truncate pl-1 text-[14px] font-semibold s-ink">
          {title}
        </label>
        {!won && (
          <button type="button" onClick={onRemove} aria-label={`Retirer : ${title}`} className={btn('ghost', 'icon-sm')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="s-phone" data-invalid={!!error}>
        <PhoneNumberInput
          id={inputId}
          aria-label={title}
          aria-describedby={error || isClient ? descId(inputId) : undefined}
          value={row.value}
          onChange={(v) => onChange({ value: v })}
          showValidity={false}
          invalid={!!error}
          disabled={won}
        />
      </div>
      {error ? (
        <p key={error} id={descId(inputId)} role="alert" className="s-pop -mt-1 pl-1 text-[14px] font-medium s-bad">
          {error}
          {refusal?.action && <> {refusal.action}</>}
        </p>
      ) : (
        isClient && <ClientNumberNote id={descId(inputId)} className="-mt-1" />
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Libellé de ${title}`}>
        {PHONE_LABEL_IDEAS.map((q) => {
          const on = !otherOpen && label.toLowerCase() === q.toLowerCase();
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setOtherOpen(false);
                // « WeChat », « Chine » sur une ligne encore vide : l'indicatif passe à +86 (pas de feuille des pays à ouvrir).
                const chinese = !on && CHINESE_PHONE_LABELS.includes(q) && !row.value.national.replace(/\D/g, '') && !won;
                onChange(chinese ? { label: q, value: { country: 'CN', national: '' } } : { label: on ? '' : q });
              }}
              className="s-chip h-8 rounded-full px-3 text-[14px] font-medium"
            >
              {q}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={otherOpen || custom}
          onClick={() => {
            if (otherOpen || custom) {
              setOtherOpen(false);
              if (custom) onChange({ label: '' });
            } else {
              setOtherOpen(true);
              if (label) onChange({ label: '' });
            }
          }}
          className="s-chip h-8 rounded-full px-3 text-[14px] font-medium"
        >
          Autre…
        </button>
      </div>
      {(otherOpen || custom) && (
        // eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 16 px
        <input
          autoFocus={otherOpen && !custom}
          className={cn(FIELD, 'h-11 text-[16px]')}
          placeholder="Son libellé : Boutique, Maison…"
          value={row.label}
          maxLength={LABEL_MAX}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label={`Libellé de ${title}`}
        />
      )}
    </div>
  );
}

/* ── 3. Où est installée son activité ? ────────────────────────────────── */

/** Les villes en pastilles : les plus fréquentes de CAMEROON_CITIES. */
const FREQUENT_CITIES = CAMEROON_CITIES.slice(0, 8);

export function BusinessStep({ d, set, update, errors, autoFocus }: StepProps) {
  const [typing, setTyping] = useState(false);
  const canon = canonicalCity(d.city);
  const suggestions = typing ? citySuggestions(d.city) : [];
  const cityErr = errors[FIELD_ID.city];
  return (
    <div className="space-y-6">
      <Field label="Ville au Cameroun" required htmlFor={FIELD_ID.city} error={cityErr}>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Villes fréquentes">
          {FREQUENT_CITIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={canon === c}
              onClick={() => {
                setTyping(false);
                set('city', canon === c ? '' : c);
              }}
              className={CHIP}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 s-ink-3" aria-hidden />
          {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
          <input
            id={FIELD_ID.city}
            autoFocus={autoFocus}
            className={cn(FIELD, 'pl-11')}
            value={d.city}
            onChange={(e) => {
              set('city', capitalizeFirst(e.target.value));
              setTyping(true);
            }}
            onBlur={() => {
              setTyping(false);
              update((x) => ({ ...x, city: canonicalCity(x.city) }));
            }}
            placeholder="Ou tapez sa ville…"
            autoComplete="address-level2"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={80}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="pr-city-list"
            aria-autocomplete="list"
            aria-required
            aria-invalid={!!cityErr}
            aria-describedby={descId(FIELD_ID.city)}
          />
        </div>
        {suggestions.length > 0 && (
          <ul id="pr-city-list" role="listbox" aria-label="Villes" className="s-raised s-pop mt-2 overflow-hidden rounded-[14px] p-1">
            {suggestions.map((c) => (
              <li key={c} role="option" aria-selected={false}>
                <button
                  type="button"
                  // Garde le focus dans le champ : sa sortie relirait la saisie avant le choix.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTyping(false);
                    set('city', c);
                  }}
                  className="s-row flex h-11 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[16px] s-ink"
                >
                  <MapPin className="h-4 w-4 shrink-0 s-ink-3" aria-hidden />
                  {c}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>
      <Field label="Entreprise" optional htmlFor={FIELD_ID.company}>
        {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
        <input
          id={FIELD_ID.company}
          className={FIELD}
          value={d.company}
          onChange={(e) => set('company', capitalizeFirst(e.target.value))}
          autoComplete="organization"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={120}
          placeholder="Ex. : Etoga Quincaillerie"
        />
      </Field>
    </div>
  );
}

/* ── 4. Qu'est-ce qui le bloque ? ──────────────────────────────────────── */

const INTEREST_ICON: Record<Interest, ElementType> = { payments: Wallet, air: Plane, sea: Ship };

export function NeedsStep({ d, set, errors }: StepProps) {
  const painErr = errors[FIELD_ID.pain];
  const area = useRef<HTMLTextAreaElement | null>(null);
  // Une idée déjà complétée, touchée à nouveau : le curseur va au bout de sa ligne, la pastille tressaute.
  const [nudge, setNudge] = useState<{ idea: string; n: number } | null>(null);
  const toggle = (idea: string) => {
    if (!hasIdea(d.painPoints, idea)) return set('painPoints', addIdea(d.painPoints, idea));
    const without = removeIdea(d.painPoints, idea);
    if (without !== d.painPoints) return set('painPoints', without);
    // Complétée : on n'efface jamais ce qu'il a écrit — on y emmène.
    setNudge((x) => ({ idea, n: (x?.n ?? 0) + 1 }));
    const end = ideaLineEnd(d.painPoints, idea);
    const el = area.current;
    if (el && end !== null) {
      el.focus();
      el.setSelectionRange(end, end);
    }
  };
  return (
    <div className="space-y-6">
      <Field label="Ses plus gros problèmes aujourd’hui" required htmlFor={FIELD_ID.pain} error={painErr}>
        <p className="-mt-1 mb-3 text-[14px] leading-snug s-ink-2">Touchez une idée pour l’ajouter, puis complétez-la avec ses mots.</p>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Idées de problèmes">
          {PAIN_IDEAS.map((idea) => {
            const on = hasIdea(d.painPoints, idea);
            const nudged = nudge?.idea === idea;
            return (
              <button
                key={nudged ? `${idea}:${nudge.n}` : idea}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(idea)}
                className={cn('s-idea inline-flex h-9 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[14px] font-medium', nudged && 's-pop')}
              >
                {on ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                {idea}
              </button>
            );
          })}
        </div>
        <GrowArea
          id={FIELD_ID.pain}
          areaRef={area}
          rows={4}
          maxLength={FREE_MAX}
          className={AREA}
          value={d.painPoints}
          onChange={(e) => set('painPoints', e.target.value)}
          placeholder="Ex. : ses fournisseurs de Guangzhou veulent être payés avant l’expédition, et sa banque met deux semaines…"
          aria-required
          aria-invalid={!!painErr}
          aria-describedby={descId(FIELD_ID.pain)}
        />
      </Field>
    </div>
  );
}

/* ── 5. Que pouvons-nous faire pour lui ? ──────────────────────────────── */

export function HelpStep({ d, set }: StepProps) {
  return (
    <div className="space-y-7">
      {/* Le titre pose déjà la question (« Que pouvons-nous faire pour Gaëlle ? ») : le libellé ne la redit pas. */}
      <Field label="Ses attentes, avec ses mots" optional htmlFor={FIELD_ID.help}>
        <GrowArea
          id={FIELD_ID.help}
          rows={4}
          maxLength={FREE_MAX}
          className={AREA}
          value={d.helpNeeded}
          onChange={(e) => set('helpNeeded', e.target.value)}
          placeholder="Ex. : régler ses fournisseurs en 48 h, grouper ses colis dans un conteneur partagé…"
        />
      </Field>
      <Field label="Ce qui l’intéresse chez Bonzini" optional group htmlFor={FIELD_ID.interests}>
        <div role="group" aria-labelledby={`${FIELD_ID.interests}-label`} className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = d.interests.includes(i.value);
            const Icon = INTEREST_ICON[i.value];
            return (
              <button
                key={i.value}
                type="button"
                aria-pressed={on}
                onClick={() => set('interests', on ? d.interests.filter((x) => x !== i.value) : [...d.interests, i.value])}
                className="s-idea inline-flex h-10 items-center gap-2 rounded-full pl-3 pr-4 text-[15px] font-medium"
              >
                {on ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                {i.label}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

/* ── 5. Et maintenant ? ────────────────────────────────────────────────── */

const QUICK_FOLLOW_UPS = [
  { label: 'Demain', days: 1 },
  { label: 'Dans 3 jours', days: 3 },
  { label: 'Dans une semaine', days: 7 },
];

export function NextStep({ d, set }: StepProps) {
  const today = doualaDay();
  return (
    <div className="space-y-7">
      <Field label="Prochaine relance" optional group htmlFor={FIELD_ID.follow}>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${FIELD_ID.follow}-label`}>
          {QUICK_FOLLOW_UPS.map((q) => {
            const day = addDays(today, q.days);
            const on = d.followUp === day;
            return (
              <button key={q.days} type="button" aria-pressed={on} onClick={() => set('followUp', on ? '' : day)} className={CHIP}>
                {q.label}
              </button>
            );
          })}
        </div>
        <label htmlFor={FIELD_ID.follow} className="mb-2 mt-4 block text-[14px] s-ink-2">
          Ou une autre date
        </label>
        {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px (date) */}
        <input
          id={FIELD_ID.follow}
          type="date"
          min={today}
          value={d.followUp}
          onChange={(e) => set('followUp', e.target.value)}
          className={cn(FIELD, 'tabular-nums')}
        />
        {d.followUp ? (
          <div data-tone="accent" className="s-note s-pop mt-3 flex items-center gap-3 rounded-[14px] py-2.5 pl-4 pr-2">
            <AlarmClock className="h-5 w-5 shrink-0 s-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold first-letter:uppercase s-ink">{fmtWeekday(d.followUp)}</div>
              <div className="text-[13px] s-ink-2">À 9 h, heure de Douala · dans «&nbsp;À&nbsp;relancer&nbsp;» ce jour-là</div>
            </div>
            <button type="button" onClick={() => set('followUp', '')} className={btn('ghost', 'sm')}>
              Retirer
            </button>
          </div>
        ) : (
          <p className="mt-2.5 text-[14px] s-ink-2">Sans date, il reste dans «&nbsp;Ouverts&nbsp;», sans rappel.</p>
        )}
      </Field>
      <Field
        label="Notes"
        optional
        htmlFor={FIELD_ID.notes}
        aside={d.notes.length > 0 ? <span className="text-[13px] tabular-nums s-ink-3">{d.notes.length} / {NOTES_MAX}</span> : undefined}
      >
        <GrowArea
          id={FIELD_ID.notes}
          rows={3}
          maxLength={NOTES_MAX}
          className={AREA}
          value={d.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Ce qu’il importe, ses volumes, le bon moment pour le rappeler…"
        />
      </Field>
    </div>
  );
}
