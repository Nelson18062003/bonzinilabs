import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  /** Route path */
  to: string;
  /** Lucide icon component (repli si `iconSrc` est absent ou échoue). */
  icon: LucideIcon;
  /** Image d'icône optionnelle (ex. mascotte) — prioritaire sur `icon`. */
  iconSrc?: string;
  /** Display label below icon */
  label: string;
  /** Use exact route matching (for index routes like "/" or "/m") */
  end?: boolean;
  /** Badge count. Shows badge when > 0. */
  badgeCount?: number;
}

export interface LiquidTabBarProps {
  items: TabItem[];
  className?: string;
}
