/**
 * Sélecteur de pays — recherche, drapeaux, tous les pays du monde.
 *
 * Un seul composant pour deux usages :
 *   · `variant="dial"`    : le bouton compact d'un champ téléphone
 *                           (drapeau + « +237 ») ;
 *   · `variant="country"` : le champ « Pays » d'un formulaire
 *                           (drapeau + nom, pleine largeur).
 *
 * Le panneau s'ouvre en popover sur grand écran et en feuille basse sur
 * téléphone : un popover de 245 lignes sous un clavier virtuel est
 * inutilisable. Dans les deux cas : un champ de recherche en tête (nom dans
 * les trois langues, code ISO, indicatif avec ou sans « + »), les pays
 * fréquents épinglés, puis tout le monde par ordre alphabétique — aucune
 * rubrique par zone.
 *
 * Navigation clavier et filtrage par cmdk ; le filtrage est le nôtre
 * (`searchCountries`) pour garder un ordre déterministe.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Command as CommandPrimitive } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  PRIORITY_COUNTRIES,
  findCountry,
  searchCountries,
  toCountryLang,
  type Country,
  type CountryIso,
} from '@/data/countries';
import { CountryFlag } from './CountryFlag';

export interface CountryComboboxProps {
  value: CountryIso | null | undefined;
  onChange: (iso: CountryIso, country: Country) => void;
  variant?: 'dial' | 'country';
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  /** Classes du bouton déclencheur (hauteur, rayon, bordure du contexte). */
  className?: string;
  'aria-label'?: string;
}

const TRIGGER_BASE =
  'inline-flex items-center gap-2 bg-white text-[16px] outline-none transition-colors dark:bg-[#2C2C2C] ' +
  'border border-[#949494] text-[#1E1E1E] focus-visible:border-[#2C2C2C] focus-visible:ring-1 focus-visible:ring-[#2C2C2C] ' +
  'dark:border-[#6E6E6E] dark:text-[#F5F5F5] dark:focus-visible:border-[#E3E3E3] dark:focus-visible:ring-[#E3E3E3] ' +
  'disabled:cursor-not-allowed disabled:border-[#B3B3B3] disabled:bg-[#D9D9D9] disabled:text-[#B3B3B3]';

export function CountryCombobox({
  value,
  onChange,
  variant = 'country',
  placeholder,
  disabled,
  invalid,
  id,
  className,
  'aria-label': ariaLabel,
}: CountryComboboxProps) {
  const { t, i18n } = useTranslation('common');
  const lang = toCountryLang(i18n.language);
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const selected = findCountry(value, lang);
  const results = React.useMemo(() => searchCountries(query, lang), [query, lang]);
  const pinned = query.trim() === '' ? results.filter((c) => PRIORITY_COUNTRIES.includes(c.iso)) : [];
  const others = query.trim() === '' ? results.filter((c) => !PRIORITY_COUNTRIES.includes(c.iso)) : results;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (country: Country) => {
    onChange(country.iso, country);
    close();
  };

  const trigger = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-label={ariaLabel ?? (variant === 'dial' ? t('countryPicker.dialCode') : t('countryPicker.country'))}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      className={cn(
        TRIGGER_BASE,
        'h-11 rounded-lg',
        variant === 'dial' ? 'shrink-0 px-3' : 'w-full px-3',
        invalid && 'border-[#EC221F] dark:border-[#EC221F]',
        className,
      )}
    >
      {selected ? (
        <CountryFlag iso={selected.iso} size={22} />
      ) : (
        <span className="inline-block h-[16px] w-[22px] shrink-0 rounded-[3px] bg-[#E6E6E6] dark:bg-[#444444]" aria-hidden />
      )}
      {variant === 'dial' ? (
        <span className="tabular-nums font-semibold">{selected?.dialCode ?? '+'}</span>
      ) : (
        <span className={cn('min-w-0 flex-1 truncate text-left', !selected && 'text-[#B3B3B3] dark:text-[#757575]')}>
          {selected?.name ?? placeholder ?? t('countryPicker.choose')}
        </span>
      )}
      <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
    </button>
  );

  const list = (
    <CommandPrimitive
      shouldFilter={false}
      loop
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <div className="flex items-center gap-2 border-b border-[#D9D9D9] px-3 dark:border-[#444444]">
        <Search className="h-4 w-4 shrink-0 text-[#757575]" />
        <CommandPrimitive.Input
          autoFocus={!isMobile}
          value={query}
          onValueChange={setQuery}
          placeholder={t('countryPicker.search')}
          className="h-12 w-full bg-transparent text-[16px] text-[#1E1E1E] outline-none placeholder:text-[#B3B3B3] dark:text-[#F5F5F5] dark:placeholder:text-[#757575]"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('countryPicker.clear')} className="rounded-full p-1 text-[#757575]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <CommandPrimitive.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        <CommandPrimitive.Empty className="px-4 py-8 text-center text-[16px] text-[#5A5A5A] dark:text-[#CDCDCD]">
          {t('countryPicker.noResult')}
        </CommandPrimitive.Empty>
        {pinned.length > 0 && (
          <CommandPrimitive.Group heading={t('countryPicker.frequent')} className={GROUP_CLASS}>
            {pinned.map((c) => (
              <CountryRow key={c.iso} country={c} selected={c.iso === selected?.iso} onSelect={() => pick(c)} />
            ))}
          </CommandPrimitive.Group>
        )}
        <CommandPrimitive.Group heading={pinned.length > 0 ? t('countryPicker.all') : undefined} className={GROUP_CLASS}>
          {others.map((c) => (
            <CountryRow key={c.iso} country={c} selected={c.iso === selected?.iso} onSelect={() => pick(c)} />
          ))}
        </CommandPrimitive.Group>
      </CommandPrimitive.List>
    </CommandPrimitive>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              className="fixed inset-x-0 bottom-0 z-[71] flex h-[82dvh] flex-col rounded-t-2xl border-t border-[#D9D9D9] bg-white pb-[env(safe-area-inset-bottom)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 dark:border-[#444444] dark:bg-[#2C2C2C]"
              aria-label={t('countryPicker.country')}
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#D9D9D9] dark:bg-[#444444]" />
              <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
                <DialogPrimitive.Title className="text-[20px] font-semibold text-[#1E1E1E] dark:text-[#F5F5F5]">
                  {variant === 'dial' ? t('countryPicker.dialCode') : t('countryPicker.country')}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label={t('countryPicker.close')}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#303030] active:bg-[#F5F5F5] dark:text-[#E3E3E3] dark:active:bg-[#383838]"
                >
                  <X className="h-5 w-5" />
                </DialogPrimitive.Close>
              </div>
              {list}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[80] flex h-[380px] w-[360px] flex-col overflow-hidden rounded-xl border-[#D9D9D9] bg-white p-0 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.25)] dark:border-[#444444] dark:bg-[#2C2C2C]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {list}
      </PopoverContent>
    </Popover>
  );
}

const GROUP_CLASS =
  '[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[14px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[#5A5A5A] dark:[&_[cmdk-group-heading]]:text-[#CDCDCD]';

function CountryRow({ country, selected, onSelect }: { country: Country; selected: boolean; onSelect: () => void }) {
  return (
    <CommandPrimitive.Item
      value={country.iso}
      onSelect={onSelect}
      className={cn(
        'flex h-12 cursor-pointer select-none items-center gap-3 px-4 text-[16px] text-[#1E1E1E] outline-none dark:text-[#F5F5F5]',
        'data-[selected=true]:bg-[#F5F5F5] dark:data-[selected=true]:bg-[#383838]',
        selected && 'font-semibold',
      )}
    >
      <CountryFlag iso={country.iso} size={24} />
      <span className="min-w-0 flex-1 truncate">{country.name}</span>
      <span className="shrink-0 tabular-nums text-[#5A5A5A] dark:text-[#CDCDCD]">{country.dialCode}</span>
      {selected && <Check className="h-4 w-4 shrink-0" />}
    </CommandPrimitive.Item>
  );
}
