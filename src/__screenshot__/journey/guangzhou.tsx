// Captures du parcours — domaine « guangzhou » : clés « j.guangzhou.<écran> » (données : tools/journey/guangzhou.mjs).
// Le bureau et l'entrepôt de Bonzini à Guangzhou : Kevin Nkolo (réceptionnaire, téléphone, /r)
// reçoit, pèse et étiquette les colis, puis les regroupe en paquets avion de 32 kg (PQ-…) ;
// au bureau, Grace Ebogo (ops, ordinateur) chiffre le fret du dépôt et l'encaisse.
import { useContext, useMemo, type ComponentType, type ReactNode } from 'react';
import type { JourneyEntry } from './types';
import { AdminAuthContext } from '@/contexts/AdminAuthContext';
import { ReceptionHome, ReceptionDeposit, ReceptionDone, ReceptionPackages, ReceptionPackage, ReceptionNewClient } from '@/mobile/screens/reception';
import { ReceptionShell } from '@/mobile/components/reception/ReceptionRouteWrapper';
import { DesktopCargoReception } from '@/desktop/screens/cargo';
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { ShippedClients } from '../adminRedesign/beforeScreens';
import { MobileClientDetail } from '@/mobile/screens/clients/MobileClientDetail';

type Staff = { first: string; last: string; role: string; email: string };
const KEVIN: Staff = { first: 'Kevin', last: 'Nkolo', role: 'receptionist', email: 'kevin.nkolo@bonzinilabs.com' };
const GRACE: Staff = { first: 'Grace', last: 'Ebogo', role: 'ops', email: 'grace.ebogo@bonzinilabs.com' };

/** La fausse session du harnais, au nom de la personne du parcours (toutes permissions gardées). */
function AsStaff({ who, children }: { who: Staff; children: ReactNode }) {
  const ctx = useContext(AdminAuthContext);
  const value = useMemo(() => {
    if (!ctx) return ctx;
    const user = ctx.currentUser ? { ...ctx.currentUser, firstName: who.first, lastName: who.last, email: who.email, role: who.role } : ctx.currentUser;
    return { ...(ctx as object), currentUser: user, profile: { first_name: who.first, last_name: who.last } } as unknown as typeof ctx;
  }, [ctx, who]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

/** Un écran /r de Kevin, dans la coquille de la réception (avec ou sans barre d'onglets, comme dans App.tsx). */
const reception = (Screen: ComponentType, tabBar: boolean): ComponentType => function ReceptionScreen() {
  return (
    <AsStaff who={KEVIN}>
      <ReceptionShell showTabBar={tabBar}>
        <Screen />
      </ReceptionShell>
    </AsStaff>
  );
};

/** La console cargo du bureau, sur ordinateur, au nom de Grace. */
function DeskReception() {
  return (
    <AsStaff who={GRACE}>
      <DesktopAppShell>
        <DesktopCargoReception />
      </DesktopAppShell>
    </AsStaff>
  );
}

const Home = reception(ReceptionHome, true);
const Deposit = reception(ReceptionDeposit, false);
const Done = reception(ReceptionDone, false);
const Packages = reception(ReceptionPackages, true);
const Package = reception(ReceptionPackage, false);
const NewClient = reception(ReceptionNewClient, false);

export const SCREENS: Record<string, JourneyEntry> = {
  'j.guangzhou.home': { Comp: Home, route: '/r', wrap: 'lang' },
  'j.guangzhou.deposit': { Comp: Deposit, route: '/r/deposit/dep1', path: '/r/deposit/:depositId', wrap: 'lang' },
  'j.guangzhou.done': { Comp: Done, route: '/r/deposit/dep1c/done', path: '/r/deposit/:depositId/done', wrap: 'lang' },
  'j.guangzhou.packages': { Comp: Packages, route: '/r/paquets', wrap: 'lang' },
  'j.guangzhou.package': { Comp: Package, route: '/r/paquets/pk45', path: '/r/paquets/:id', wrap: 'lang' },
  'j.guangzhou.quote': { Comp: DeskReception, route: '/m/cargo/reception/dep1c', path: '/m/cargo/reception/:depositId' },
  // Le propriétaire d'un colis n'existe pas : la réception crée le client, l'origine se pose d'office (06/10).
  'j.guangzhou.new-client': { Comp: NewClient, route: '/r/new/client', wrap: 'lang' },
  // La fiche du client au bureau : son origine et « Enregistré par » (qui, quel rôle, quel site),
  // son sexe et sa date de naissance (06/10) — et « Modifier » qui les change.
  'j.guangzhou.client-sheet': { Comp: ShippedClients, route: '/m/clients/u5', path: '/m/clients/:clientId' },
  // La même fiche sur le téléphone de l'équipe (/m).
  'j.guangzhou.client-mobile': { Comp: MobileClientDetail, route: '/m/clients/u5', path: '/m/clients/:clientId' },
};
