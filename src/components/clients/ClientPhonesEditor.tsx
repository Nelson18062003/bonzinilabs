// ============================================================
// Les numéros d'un client EXISTANT — « Modifier le profil » (fiche client
// desktop et mobile). La logique est dans useClientPhonesEditor.
//
// Une carte par numéro. Le PREMIER est le principal (connexion, mot de
// passe, SMS) : il porte un badge ; les autres, un libellé choisi d'un
// toucher (MTN, Orange, Bureau…) ou saisi. Actions courtes : « ☆ Principal »
// et la corbeille. On ne parle que des problèmes (numéro incomplet,
// doublon) — pas de ligne verte sous chaque numéro juste.
//
// Enregistrement : `admin_set_client_phones` remplace le lot entier et
// recopie le principal dans `clients.phone` — une seule écriture, gardée
// côté serveur par canManageUsers (le même droit que le bouton Modifier).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, TextInput } from '@/mobile/designKit';
import { PhoneNumberInput, isPhoneComplete, toE164 } from '@/components/form/PhoneNumberInput';
import { countryName, toCountryLang } from '@/data/countries';
import { MAX_PHONES } from './useCreateClientForm';
import type { ClientPhonesEditorApi } from './useClientPhonesEditor';

/** Les libellés les plus fréquents, à choisir d'un toucher. */
const QUICK_LABELS = ['mtn', 'orange', 'office', 'china', 'personal'] as const;
const QUICK_DEFAULT: Record<(typeof QUICK_LABELS)[number], string> = { mtn: 'MTN', orange: 'Orange', office: 'Bureau', china: 'Chine', personal: 'Perso' };

const PILL_ON = 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]';

export function ClientPhonesEditor({ editor, idPrefix = 'edit-phone' }: { editor: ClientPhonesEditorApi; idPrefix?: string }) {
  const { t, i18n } = useTranslation('common');
  const lang = toCountryLang(i18n.language);
  const quick = QUICK_LABELS.map((k) => t(`clientForm.quickLabel.${k}`, { defaultValue: QUICK_DEFAULT[k] }));
  const isQuick = (label: string) => quick.some((q) => q.toLowerCase() === label.trim().toLowerCase());

  // Un numéro ajouté : le curseur y va tout de suite.
  const count = editor.rows.length;
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) document.getElementById(`${idPrefix}-${count - 1}`)?.focus();
    prevCount.current = count;
  }, [count, idPrefix]);

  // « Autre… » : le champ libre ne s'ouvre qu'à la demande (ou si le libellé est déjà libre).
  const [otherOpen, setOtherOpen] = useState<Set<string>>(() => new Set());
  const openOther = (key: string, open: boolean) =>
    setOtherOpen((prev) => { const next = new Set(prev); if (open) next.add(key); else next.delete(key); return next; });

  // Doublons : dits sur la ligne, plutôt qu'avalés en silence à l'enregistrement.
  const e164s = editor.rows.map((r) => toE164(r.value));

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('clientForm.phonesTitle', { defaultValue: 'Numéros de téléphone' })}</span>
        <span className={cn(TYPE.small, 'tabular-nums', TEXT.muted)}>{count} / {MAX_PHONES}</span>
      </div>

      {editor.rows.map((row, index) => {
        const primary = index === 0;
        const incomplete = row.value.national.replace(/\D/g, '') !== '' && !isPhoneComplete(row.value);
        const duplicate = !!e164s[index] && e164s.indexOf(e164s[index]) < index;
        const title = primary
          ? t('clientForm.primaryNumber', { defaultValue: 'Numéro principal (WhatsApp)' })
          : row.label.trim() || t('clientForm.otherNumber', { n: index + 1 });
        return (
          <div key={row.key} className={cn('space-y-2.5 rounded-xl p-3', primary ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : SURFACE.shadow)}>
            <div className="flex min-h-9 items-center justify-between gap-2">
              {primary ? (
                <label htmlFor={`${idPrefix}-${index}`} className={cn('inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[14px] font-semibold', PILL_ON)}>
                  <Star className="h-3.5 w-3.5 shrink-0 fill-current" />
                  <span className="truncate">{t('clientForm.primaryBadge', { defaultValue: 'Principal · connexion et SMS' })}</span>
                </label>
              ) : (
                <label htmlFor={`${idPrefix}-${index}`} className={cn('min-w-0 truncate', TYPE.bodyStrong, TEXT.strong)}>{title}</label>
              )}
              {!primary && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => editor.makePrimary(row.key)}
                    title={t('clientForm.makePrimary', { defaultValue: 'Mettre en principal' })}
                    className={cn('inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[14px] font-semibold transition-colors', SURFACE.inset, TEXT.strong)}
                  >
                    <Star className="h-4 w-4" /> {t('clientForm.makePrimaryShort', { defaultValue: 'Principal' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.removePhone(row.key)}
                    aria-label={t('clientForm.removeNumber')}
                    title={t('clientForm.removeNumber')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#900B09] transition-colors hover:bg-[#FDE9E7] dark:text-[#FCB3AD] dark:hover:bg-[#4A1D1B]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <PhoneNumberInput
              id={`${idPrefix}-${index}`}
              value={row.value}
              onChange={(value) => editor.setPhone(row.key, { value })}
              aria-label={title}
              showValidity={false}
              invalid={duplicate}
            />
            {(incomplete || duplicate) && (
              <p className={cn('text-[14px]', duplicate ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : 'text-[#975102] dark:text-[#E8B931]')}>
                {duplicate
                  ? t('clientForm.duplicateNumber', { defaultValue: 'Ce numéro est déjà dans la liste.' })
                  : t('phoneField.incompleteFor', { country: countryName(row.value.country, lang) })}
              </p>
            )}

            {primary ? (
              <p className={cn(TYPE.small, TEXT.muted)}>
                {t('clientForm.primaryHint', { defaultValue: 'Il sert à la connexion et reçoit le mot de passe et les SMS.' })}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('clientForm.numberLabel')}>
                  {quick.map((text) => {
                    const on = row.label.trim().toLowerCase() === text.toLowerCase();
                    return (
                      <button
                        key={text}
                        type="button"
                        aria-pressed={on}
                        onClick={() => { editor.setPhone(row.key, { label: on ? '' : text }); openOther(row.key, false); }}
                        className={cn('h-9 rounded-full px-3 text-[14px] font-semibold transition-colors', on ? PILL_ON : cn(SURFACE.inset, TEXT.body))}
                      >
                        {text}
                      </button>
                    );
                  })}
                  {(() => {
                    const custom = row.label.trim() !== '' && !isQuick(row.label);
                    const on = custom || otherOpen.has(row.key);
                    return (
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          if (on) { openOther(row.key, false); if (custom) editor.setPhone(row.key, { label: '' }); }
                          else { openOther(row.key, true); if (isQuick(row.label)) editor.setPhone(row.key, { label: '' }); }
                        }}
                        className={cn('h-9 rounded-full px-3 text-[14px] font-semibold transition-colors', on ? PILL_ON : cn(SURFACE.inset, TEXT.body))}
                      >
                        {t('clientForm.quickLabel.other', { defaultValue: 'Autre…' })}
                      </button>
                    );
                  })()}
                </div>
                {((row.label.trim() !== '' && !isQuick(row.label)) || otherOpen.has(row.key)) && (
                  <TextInput
                    autoFocus={otherOpen.has(row.key)}
                    placeholder={t('clientForm.labelOther', { defaultValue: 'Votre libellé : WeChat, Maison…' })}
                    value={isQuick(row.label) ? '' : row.label}
                    onChange={(e) => editor.setPhone(row.key, { label: e.target.value })}
                    aria-label={t('clientForm.numberLabel')}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {count < MAX_PHONES && (
        <button
          type="button"
          onClick={editor.addPhone}
          className={cn(
            'flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-[16px] font-semibold transition-colors',
            'border-[#B3B3B3] text-[#1E1E1E] hover:border-[#2C2C2C] hover:bg-[#F5F5F5]',
            'dark:border-[#6E6E6E] dark:text-[#F5F5F5] dark:hover:border-[#E3E3E3] dark:hover:bg-[#383838]',
          )}
        >
          <Plus className="h-5 w-5" /> {t('clientForm.addNumberShort', { defaultValue: 'Ajouter un numéro' })}
        </button>
      )}
    </div>
  );
}
