// Classes partagées du sous-module « Marché Binance ».
import { cn } from '@/lib/utils';

export const chipCls = (on: boolean) => cn(
  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-semibold transition-colors',
  on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent',
);
