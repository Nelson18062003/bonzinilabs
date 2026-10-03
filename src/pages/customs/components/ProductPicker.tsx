/**
 * Trouver le code d'un produit : un numéro, un mot du marché (« mèches »,
 * « okada », « 手机 ») ou un mot du libellé. Le piège à éviter s'affiche avec
 * le premier résultat qu'il concerne — c'est là qu'on l'oublierait.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Chip, TextInput, SURFACE, TEXT, TYPE, FOCUS_RING } from '@/mobile/designKit';
import { searchTariff, type Nomenclature, type TariffLine } from '@/lib/customs/nomenclature';
import { formatHs } from '@/lib/customs/hsCode';
import { lineTitle, rateLabel } from './lineText';

const POPULAR = [
  { q: 'téléphone', fr: 'Téléphones', en: 'Phones', zh: '手机' },
  { q: 'mèches', fr: 'Mèches', en: 'Hair extensions', zh: '假发' },
  { q: 'friperie', fr: 'Friperie', en: 'Second-hand clothes', zh: '旧衣服' },
  { q: 'panneau solaire', fr: 'Panneaux solaires', en: 'Solar panels', zh: '太阳能板' },
  { q: 'moto', fr: 'Motos', en: 'Motorcycles', zh: '摩托车' },
  { q: 'carreaux', fr: 'Carreaux', en: 'Tiles', zh: '瓷砖' },
  { q: 'pièces auto', fr: 'Pièces auto', en: 'Car parts', zh: '汽车配件' },
  { q: 'groupe électrogène', fr: 'Groupes électrogènes', en: 'Generators', zh: '发电机' },
] as const;

export function ProductPicker({
  nom, onPick, exclude, autoFocus, inputId = 'customs-search',
}: {
  nom: Nomenclature;
  onPick: (line: TariffLine) => void;
  /** Un code à ne pas proposer (la comparaison ne compare pas un code à lui-même). */
  exclude?: string | null;
  autoFocus?: boolean;
  inputId?: string;
}) {
  const { t, i18n } = useTranslation('customs');
  const lang = (i18n.language?.slice(0, 2) ?? 'fr') as 'fr' | 'en' | 'zh';
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query, 150);
  const hits = useMemo(() => searchTariff(nom, q, 12).filter((h) => h.line.code !== exclude), [nom, q, exclude]);

  // Le conseil ne s'écrit qu'une fois, sous le premier résultat qu'il concerne.
  const tipShown = new Set<unknown>();

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="sr-only">{t('sim.searchLabel')}</label>
      <div className="relative">
        <Search aria-hidden className={cn('pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
        <TextInput
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sim.searchPlaceholder')}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 pl-10 text-[17px]"
        />
      </div>

      {!q.trim() ? (
        <div>
          <p className={cn('mb-2', TYPE.small, TEXT.muted)}>{t('sim.popular')}</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR.map((p) => (
              <Chip key={p.q} label={p[lang] ?? p.fr} onClick={() => setQuery(p.q)} />
            ))}
          </div>
        </div>
      ) : hits.length === 0 ? (
        <p className={cn(TYPE.body, TEXT.muted)}>{t('sim.noResult')}</p>
      ) : (
        <ul className={cn('overflow-hidden rounded-lg', SURFACE.card, SURFACE.shadow)}>
          {hits.map((h) => {
            const tip = h.term?.tip && !tipShown.has(h.term) ? h.term.tip : null;
            if (tip) tipShown.add(h.term);
            return (
              <li key={h.line.code} className={cn('border-b last:border-b-0', SURFACE.divider)}>
                <button
                  type="button"
                  onClick={() => onPick(h.line)}
                  className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING)}
                >
                  <span className={cn('mt-0.5 w-[74px] shrink-0 font-semibold tabular-nums', TEXT.strong)}>{formatHs(h.line.code)}</span>
                  <span className={cn('line-clamp-3 min-w-0 flex-1 text-[16px] leading-snug', TEXT.body)}>{lineTitle(nom, h.line, lang)}</span>
                  <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[14px] font-semibold tabular-nums', SURFACE.inset, TEXT.strong)}>
                    {rateLabel(h.line)}
                  </span>
                </button>
                {tip && (
                  <p className={cn('flex gap-2 px-4 pb-3 text-[15px] leading-snug', TEXT.muted)}>
                    <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#975102] dark:text-[#E8B931]" />
                    <span>{tip}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
