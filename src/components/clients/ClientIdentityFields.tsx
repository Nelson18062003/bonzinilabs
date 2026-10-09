// ============================================================
// « Sexe » et « Date de naissance » d'un client — les deux champs, tels
// qu'ils se saisissent partout : création (bureau sur ordinateur et
// téléphone, réception de Guangzhou) et modification de la fiche.
//
//   · Sexe : deux choix côte à côte, Homme / Femme, au bord et à la hauteur
//     des champs voisins ; le choix fait se remplit d'encre et porte une
//     coche. Flèches gauche / droite au clavier, comme un groupe radio.
//   · Date de naissance : un seul champ « JJ/MM/AAAA », clavier numérique
//     sur téléphone, les barres se posent seules ; une fois complète, la
//     date en toutes lettres et l'âge s'affichent dessous. Une date
//     impossible ou hors de 16 à 110 ans se signale tout de suite ; une date
//     commencée mais incomplète, quand on quitte le champ.
// ============================================================
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ageOn, BIRTH_MAX_AGE, BIRTH_MIN_AGE, GENDER_OPTIONS, type Gender } from '@/lib/people';
import { TEXT, TYPE, FormField, TextInput } from '@/mobile/designKit';
import { birthTextIssue, birthTextToIso, formatBirthInput, longBirthDate } from './clientIdentity';

const GENDER_KEY: Record<Gender, string> = { MALE: 'clientForm.genderMale', FEMALE: 'clientForm.genderFemale' };

/** Le libellé « Homme » / « Femme » dans la langue de l'écran. */
function useGenderLabel() {
  const { t } = useTranslation('common');
  return (g: Gender) => t(GENDER_KEY[g], { defaultValue: GENDER_OPTIONS.find((o) => o.value === g)?.label ?? g });
}

export function GenderField({
  id,
  label,
  value,
  onChange,
  hint,
  controlClassName,
  className,
}: {
  id: string;
  label: ReactNode;
  value: Gender | null;
  onChange: (g: Gender) => void;
  hint?: ReactNode;
  /** Hauteur et rayon des champs voisins (desktop : « h-12 rounded-2xl »). */
  controlClassName?: string;
  className?: string;
}) {
  const labelOf = useGenderLabel();
  const labelId = `${id}-label`;
  const focusable = value ?? GENDER_OPTIONS[0].value;

  // Groupe radio : les flèches passent d'un choix à l'autre (et le choisissent).
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
    <div className={cn('space-y-2', className)}>
      <div id={labelId} className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{label}</div>
      <div id={id} role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown} className="grid grid-cols-2 gap-2">
        {GENDER_OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              data-gender={o.value}
              tabIndex={o.value === focusable ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                'relative inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-[16px] font-semibold transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-[#2C2C2C] focus-visible:ring-offset-2 dark:focus-visible:ring-[#E3E3E3] dark:focus-visible:ring-offset-[#1E1E1E]',
                on
                  ? 'border-[#2C2C2C] bg-[#2C2C2C] text-[#F5F5F5] dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]'
                  : 'border-[#949494] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] active:bg-[#EDEDED] dark:border-[#6E6E6E] dark:bg-[#2C2C2C] dark:text-[#F5F5F5] dark:hover:bg-[#383838]',
                controlClassName,
              )}
            >
              <Check aria-hidden className={cn('h-4 w-4 shrink-0 transition-all', on ? 'opacity-100' : '-ml-6 opacity-0')} strokeWidth={2.75} />
              {labelOf(o.value)}
            </button>
          );
        })}
      </div>
      {hint && <p className={cn('text-[14px] leading-snug', TEXT.muted)}>{hint}</p>}
    </div>
  );
}

export function BirthDateField({
  id,
  label,
  value,
  onChange,
  controlClassName,
  className,
  today,
}: {
  id: string;
  label: ReactNode;
  /** Le texte tapé, « JJ/MM/AAAA » (éventuellement incomplet). */
  value: string;
  onChange: (text: string) => void;
  controlClassName?: string;
  className?: string;
  /** Pour les tests : le jour qui sert à calculer l'âge. */
  today?: Date;
}) {
  const { t, i18n } = useTranslation('common');
  const [left, setLeft] = useState(false);
  const hintId = useId();
  const issue = birthTextIssue(value, today);
  const iso = birthTextToIso(value);
  const age = issue === null && iso ? ageOn(iso, today) : null;

  // L'incomplet ne se signale qu'en quittant le champ : on est peut-être en train de taper.
  const error =
    issue === 'invalid' ? t('clientForm.birthInvalid')
    : issue === 'age' ? t('clientForm.birthAge', { min: BIRTH_MIN_AGE, max: BIRTH_MAX_AGE })
    : issue === 'incomplete' && left ? t('clientForm.birthIncomplete')
    : undefined;
  const hint =
    iso && age !== null ? (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <span className={cn('font-semibold', TEXT.strong)}>{longBirthDate(iso, i18n.language)}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{t('clientForm.ageYears', { age })}</span>
      </span>
    ) : (
      t('clientForm.birthHint')
    );

  return (
    <FormField label={label} htmlFor={id} error={error} hint={<span id={hintId} className="text-[14px]">{hint}</span>} className={className}>
      <div className="relative">
        <CalendarDays aria-hidden className={cn('pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2', TEXT.muted)} />
        <TextInput
          id={id}
          value={value}
          onChange={(e) => {
            setLeft(false);
            onChange(formatBirthInput(e.target.value));
          }}
          onBlur={() => setLeft(true)}
          inputMode="numeric"
          autoComplete="bday"
          placeholder={t('clientForm.birthPlaceholder')}
          maxLength={10}
          aria-invalid={!!error}
          aria-describedby={hintId}
          className={cn(
            'pl-10 tabular-nums tracking-[0.04em]',
            error && 'border-[#C00F0C] focus:border-[#C00F0C] focus:ring-[#C00F0C] dark:border-[#FCB3AD]',
            controlClassName,
          )}
        />
      </div>
    </FormField>
  );
}
