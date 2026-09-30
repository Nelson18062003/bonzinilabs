/** Les cinq outils du site Douane, dans l'ordre de la barre du haut. */
import { BellRing, Calculator, FileSearch, Route, ScanLine, type LucideIcon } from 'lucide-react';

export interface NavItem { key: 'simulator' | 'classify' | 'audit' | 'routes' | 'news'; to: string; icon: LucideIcon }
export const SITE_NAV: NavItem[] = [
  { key: 'simulator', to: '/douane/simulateur', icon: Calculator },
  { key: 'classify', to: '/douane/classer', icon: FileSearch },
  { key: 'audit', to: '/douane/audit', icon: ScanLine },
  { key: 'routes', to: '/douane/routes', icon: Route },
  { key: 'news', to: '/douane/veille', icon: BellRing },
];
