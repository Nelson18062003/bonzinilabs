/** Les classes et constantes du site Douane (séparées des composants pour le rechargement à chaud). */
import { cn } from '@/lib/utils';

export const EASE = [0.16, 1, 0.3, 1] as const;

export type Variant = 'primary' | 'secondary' | 'ghost' | 'brand';
export type Size = 'sm' | 'md' | 'lg';
const BTN = 'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-[transform,background-color,color,box-shadow] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0';
const VARIANT: Record<Variant, string> = {
  // L'encre : l'action principale, une seule à la fois.
  primary: 'bg-dz-primary text-dz-on-primary hover:bg-dz-primary/85',
  // Le gris d'Apple : l'action secondaire, sans bordure.
  secondary: 'bg-dz-fill text-dz-ink hover:bg-dz-line',
  ghost: 'text-dz-ink2 hover:bg-dz-fill hover:text-dz-ink',
  // Le violet du logo, en aplat : réservé à l'action qui paie un fournisseur.
  brand: 'bg-dz-violet text-white hover:bg-dz-violet/90',
};
const SIZE: Record<Size, string> = { sm: 'h-9 px-4 text-[15px]', md: 'h-12 px-6 text-[16px]', lg: 'h-14 px-7 text-[17px]' };

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) => cn(BTN, VARIANT[variant], SIZE[size], className);

/** Les champs : gris plein dans une carte blanche, blancs au focus (Apple, Revolut). */
export const inputClass = 'h-12 w-full rounded-2xl border border-transparent bg-dz-soft px-4 text-[17px] font-medium text-dz-ink placeholder:font-normal placeholder:text-dz-ink3/70 transition-[border-color,background-color,box-shadow] focus:border-dz-brand/40 focus:bg-dz-card focus:outline-none focus:ring-4 focus:ring-dz-violet/15';

/** Une carte : blanche, sans bordure, posée sur le fond gris. */
export const cardClass = 'rounded-[28px] bg-dz-card';
