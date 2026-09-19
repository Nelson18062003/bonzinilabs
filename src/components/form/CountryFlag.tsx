/**
 * Drapeau d'un pays — en SVG, pas en emoji.
 *
 * Windows n'a aucune police de drapeaux : l'emoji 🇨🇲 s'y affiche « CM »,
 * deux lettres grises. C'est ce que l'opérateur voyait dans le sélecteur
 * d'indicatif. Les SVG de `flag-icons` (245 pays, ~2 Ko chacun) sont chargés
 * à la demande par Vite ; le bundle n'en embarque aucun (voir
 * `assetsInlineLimit` dans vite.config.ts).
 *
 * Format 4:3, coins doucement arrondis, un filet fin pour que les drapeaux
 * à fond blanc (Japon, Finlande…) gardent un contour sur une carte blanche.
 */
import { cn } from '@/lib/utils';

const FLAG_URLS = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function flagUrl(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  return FLAG_URLS[`/node_modules/flag-icons/flags/4x3/${iso.toLowerCase()}.svg`];
}

interface CountryFlagProps {
  iso: string | null | undefined;
  /** Largeur en px ; la hauteur suit le format 4:3. */
  size?: number;
  className?: string;
}

export function CountryFlag({ iso, size = 20, className }: CountryFlagProps) {
  const url = flagUrl(iso);
  const style = { width: size, height: Math.round((size * 3) / 4) };
  if (!url) {
    // Territoires sans drapeau dans la bibliothèque (Ascension, Tristan da
    // Cunha) : le code ISO, dans une pastille, plutôt qu'une image cassée.
    return (
      <span
        aria-hidden
        style={style}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-[3px] bg-[#E6E6E6] text-[9px] font-bold uppercase leading-none text-[#5A5A5A] dark:bg-[#444444] dark:text-[#CDCDCD]',
          className,
        )}
      >
        {iso ?? '?'}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      aria-hidden
      draggable={false}
      style={style}
      loading="lazy"
      className={cn('inline-block shrink-0 rounded-[3px] object-cover ring-1 ring-black/10 dark:ring-white/10', className)}
    />
  );
}
