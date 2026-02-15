import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  /** Route path */
  to: string;
  /** Lucide icon component */
  icon: LucideIcon;
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
