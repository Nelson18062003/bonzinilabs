// ============================================================
// Les numéros d'un client EXISTANT — « Modifier le profil » (fiche client
// desktop et mobile). Même rendu et même règle qu'à la création
// (ClientFormSections) : le PREMIER numéro est le principal (connexion, mot
// de passe, SMS) ; on peut en ajouter, en retirer, leur donner un libellé,
// et faire d'un autre numéro le principal.
//
// Enregistrement : `admin_set_client_phones` remplace le lot entier et
// recopie le principal dans `clients.phone` — une seule écriture, gardée
// côté serveur par canManageUsers (le même droit que le bouton Modifier).
// ============================================================
import { useTranslation } from 'react-i18next';
import { ArrowUp, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT, TYPE, TextInput, Button } from '@/mobile/designKit';
import { PhoneNumberInput } from '@/components/form/PhoneNumberInput';
import { MAX_PHONES } from './useCreateClientForm';
import type { ClientPhonesEditorApi } from './useClientPhonesEditor';

export function ClientPhonesEditor({ editor, idPrefix = 'edit-phone' }: { editor: ClientPhonesEditorApi; idPrefix?: string }) {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-3">
      {editor.rows.map((row, index) => {
        const name = index === 0 ? t('clientForm.primaryNumber', { defaultValue: 'Numéro principal (WhatsApp)' }) : t('clientForm.otherNumber', { n: index + 1 });
        return (
          <div key={row.key} className="space-y-2">
            <div className="flex min-h-9 items-center justify-between gap-2">
              <label htmlFor={`${idPrefix}-${index}`} className={cn(TYPE.bodyStrong, TEXT.strong)}>{name}</label>
              {index > 0 && (
                <button type="button" onClick={() => editor.removePhone(row.key)} className={cn('inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[14px] font-semibold', TEXT.muted)} aria-label={t('clientForm.removeNumber')}>
                  <X className="h-4 w-4" /> {t('clientForm.remove')}
                </button>
              )}
            </div>
            <PhoneNumberInput id={`${idPrefix}-${index}`} value={row.value} onChange={(value) => editor.setPhone(row.key, { value })} aria-label={name} />
            {index > 0 && (
              <>
                <TextInput
                  placeholder={t('clientForm.labelPlaceholder')}
                  value={row.label}
                  onChange={(e) => editor.setPhone(row.key, { label: e.target.value })}
                  aria-label={t('clientForm.numberLabel')}
                />
                <button type="button" onClick={() => editor.makePrimary(row.key)} className={cn('-ml-2 inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[14px] font-semibold', TEXT.muted)}>
                  <ArrowUp className="h-4 w-4" /> {t('clientForm.makePrimary', { defaultValue: 'Mettre en principal' })}
                </button>
              </>
            )}
          </div>
        );
      })}
      {editor.rows.length < MAX_PHONES && (
        <Button variant="subtle" size="sm" onClick={editor.addPhone} className="-ml-2">
          <Plus /> {t('clientForm.addNumber')}
        </Button>
      )}
      <p className={cn(TYPE.small, TEXT.muted)}>
        {t('clientForm.primaryIsMain', { defaultValue: 'Le numéro principal sert à la connexion et reçoit les SMS. Les autres restent sur la fiche.' })}
      </p>
    </div>
  );
}
