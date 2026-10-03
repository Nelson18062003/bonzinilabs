/** Les classes et constantes du site Douane (séparées des composants pour le rechargement à chaud). */
import { cn } from '@/lib/utils';

export const EASE = [0.16, 1, 0.3, 1] as const;

export type Variant = 'primary' | 'secondary' | 'ghost' | 'brand';
export type Size = 'sm' | 'md' | 'lg';
const BTN = 'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,background-color,border-color,color,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-dz-primary text-dz-on-primary hover:bg-dz-primary/85',
  secondary: 'border border-dz-line bg-dz-card text-dz-ink hover:border-dz-ink/25 hover:bg-dz-soft',
  ghost: 'text-dz-ink2 hover:bg-dz-soft hover:text-dz-ink',
  // Le violet Bonzini : réservé à l'action qui paie un fournisseur.
  brand: 'bg-[#7428e8] text-white shadow-[0_10px_30px_-10px_rgba(116,40,232,.7)] hover:bg-[#6620d6]',
};
const SIZE: Record<Size, string> = { sm: 'h-9 px-4 text-[15px]', md: 'h-12 px-6 text-[16px]', lg: 'h-14 px-7 text-[17px]' };

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) => cn(BTN, VARIANT[variant], SIZE[size], className);

export const inputClass = 'h-12 w-full rounded-xl border border-dz-line bg-dz-card px-4 text-[17px] text-dz-ink placeholder:text-dz-ink3/70 transition-[border-color,box-shadow] focus:border-dz-brand focus:outline-none focus:ring-4 focus:ring-dz-brand/15';
