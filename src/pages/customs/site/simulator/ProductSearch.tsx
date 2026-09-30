/**
 * Trouver le code d'un produit, avec les mots du marché : « mèches », « okada »,
 * « 手机 », ou le code de la proforma. Le piège à éviter s'affiche sous le
 * premier résultat qu'il concerne, là où on l'oublierait.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, Search, X } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchTariff, type Nomenclature, type TariffLine } from '@/lib/customs/nomenclature';
import { formatHs } from '@/lib/customs/hsCode';
import { lineTitle, rateLabel } from '../../components/lineText';
import { EASE } from '../styles';
import { Input } from '../ui';

const POPULAR = [
  { q: 'téléphone', key: 'phones' }, { q: 'mèches', key: 'wigs' }, { q: 'panneau solaire', key: 'solar' },
  { q: 'friperie', key: 'thrift' }, { q: 'moto', key: 'moto' }, { q: 'carreaux', key: 'tiles' },
] as const;

export function ProductSearch({ nom, onPick, exclude, initialQuery = '', autoFocus, inputId = 'dz-search' }: {
  nom: Nomenclature;
  onPick: (line: TariffLine) => void;
  exclude?: string | null;
  initialQuery?: string;
  autoFocus?: boolean;
  inputId?: string;
}) {
  const { t, i18n } = useTranslation('customs');
  const lang = (i18n.language?.slice(0, 2) ?? 'fr') as 'fr' | 'en' | 'zh';
  const [query, setQuery] = useState(initialQuery);
  const q = useDebouncedValue(query, 120);
  const hits = useMemo(() => searchTariff(nom, q, 10).filter((h) => h.line.code !== exclude), [nom, q, exclude]);
  const tipShown = new Set<unknown>();

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="sr-only">{t('sim.searchLabel')}</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dz-ink3" />
        <Input id={inputId} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={autoFocus}
          autoComplete="off" enterKeyHint="search" placeholder={t('sim.searchPlaceholder')}
          className="h-14 rounded-2xl pl-12 pr-12" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('site.sim.clear')}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-dz-ink3 hover:bg-dz-soft hover:text-dz-ink">
            <X aria-hidden className="h-5 w-5" />
          </button>
        )}
      </div>

      {!q.trim() ? (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 dz-scroll-x sm:mx-0 sm:flex-wrap sm:px-0">
          {POPULAR.map((p) => (
            <button key={p.key} type="button" onClick={() => setQuery(p.q)}
              className="h-10 shrink-0 rounded-full border border-dz-line bg-dz-card px-4 text-[15px] font-medium text-dz-ink2 transition-colors hover:border-dz-ink/25 hover:text-dz-ink">
              {t(`site.home.popular.${p.key}`)}
            </button>
          ))}
        </div>
      ) : hits.length === 0 ? (
        <p className="rounded-2xl bg-dz-soft px-4 py-3 text-[15px] text-dz-ink2">{t('sim.noResult')}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-dz-line bg-dz-card">
          <AnimatePresence initial={false}>
            {hits.map((h, i) => {
              const tip = h.term?.tip && !tipShown.has(h.term) ? h.term.tip : null;
              if (tip) tipShown.add(h.term);
              return (
                <motion.li key={h.line.code} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 6) * 0.02, ease: EASE }} className="border-b border-dz-line last:border-b-0">
                  <button type="button" onClick={() => onPick(h.line)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-dz-soft focus-visible:bg-dz-soft">
                    <span className="w-[72px] shrink-0 pt-px text-[15px] font-bold tabular-nums text-dz-ink">{formatHs(h.line.code)}</span>
                    <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug text-dz-ink2">{lineTitle(nom, h.line, lang)}</span>
                    <span className="shrink-0 rounded-full bg-dz-soft px-2.5 py-0.5 text-[14px] font-semibold tabular-nums text-dz-ink">{rateLabel(h.line)}</span>
                  </button>
                  {tip && (
                    <p className="flex gap-2 px-4 pb-3.5 text-[14px] leading-snug text-dz-ink3">
                      <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-dz-warn" />
                      <span>{tip}</span>
                    </p>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
