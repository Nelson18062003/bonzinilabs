// ============================================================
// L'état partagé de l'app : qui est connecté (d'après le site), la page du
// site affichée, la poignée de la WebView (pour naviguer, rendre un scan,
// poser une session, déconnecter), et le scanner en cours.
// ============================================================
import { createContext, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { StaffUser } from './roles';

export interface WebHandle {
  reload: () => void;
  navigate: (path: string) => void;
  setSession: (tokens: { access_token: string; refresh_token: string }) => void;
  logout: () => void;
  deliverScan: (text: string) => void;
}

/** Qui a ouvert le scanner : un écran du site (le texte lui revient) ou l'onglet Scanner. */
export type ScanSource = { from: 'web'; continuous: boolean } | { from: 'tab' };

interface HQ {
  /** undefined : pas encore su (le site charge) ; null : personne. */
  user: StaffUser | null | undefined;
  setUser: (u: StaffUser | null) => void;
  route: string;
  setRoute: (r: string) => void;
  web: RefObject<WebHandle | null>;
  scan: ScanSource | null;
  setScan: (s: ScanSource | null) => void;
  /** L'écran natif affiché par-dessus le site (accueil), ou null = le site. */
  nativeTab: 'home' | null;
  setNativeTab: (t: 'home' | null) => void;
}

const Ctx = createContext<HQ | null>(null);

export function HQProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null | undefined>(undefined);
  const [route, setRoute] = useState('');
  const [scan, setScan] = useState<ScanSource | null>(null);
  const [nativeTab, setNativeTab] = useState<'home' | null>(null);
  const web = useRef<WebHandle | null>(null);
  const value = useMemo(() => ({ user, setUser, route, setRoute, web, scan, setScan, nativeTab, setNativeTab }), [user, route, scan, nativeTab]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHQ(): HQ {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHQ hors de HQProvider');
  return v;
}
