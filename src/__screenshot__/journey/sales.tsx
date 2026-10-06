// Captures du parcours — domaine « sales » : clés « j.sales.<écran> » (données : tools/journey/sales.mjs).
//
// L'espace du commercial (« /v ») tel que l'application le monte (App.tsx) :
// CommercialRouteWrapper (LanguageProvider, garde canProspect, coquille et
// barre d'onglets), avec la session de Rodrigue Tchami à la place de la
// fausse session « Demo Admin » du harnais. Le prospect : l'assistant en sept
// étapes, la fiche (complète ou d'avant le 06/10), la modification d'une
// section (« ?modifier=… ») et « Compléter » (« ?completer »). Puis, côté bureau, la fenêtre
// « Nouveau client » de l'administration desktop, ouverte par Nelson Ngango.
import { useContext, useMemo, type ReactNode } from 'react';
import type { JourneyEntry } from './types';
import { AdminAuthContext, type AdminUser } from '@/contexts/AdminAuthContext';
import { CommercialRouteWrapper } from '@/components/sales/CommercialRouteWrapper';
import { CommercialHome } from '@/components/sales/CommercialHome';
import { CommercialProspects } from '@/components/sales/CommercialProspects';
import { CommercialProspectForm } from '@/components/sales/CommercialProspectForm';
import { CommercialClients } from '@/components/sales/CommercialClients';
import { CommercialLogin } from '@/components/sales/CommercialLogin';
import { CommercialPassword } from '@/components/sales/CommercialPassword';
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { DesktopCreateClientDialog } from '@/desktop/screens/clients';

const RODRIGUE: AdminUser = { id: 'staff-rodrigue', email: 'rodrigue.tchami@bonzini.com', firstName: 'Rodrigue', lastName: 'Tchami', role: 'commercial' };
const NELSON: AdminUser = { id: 'staff-nelson', email: 'nelson.ngango@bonzini.com', firstName: 'Nelson', lastName: 'Ngango', role: 'super_admin' };

/** La session du harnais (toutes permissions), au nom d'une personne de la distribution. */
function As({ user, children }: { user: AdminUser; children: ReactNode }) {
  const base = useContext(AdminAuthContext);
  const value = useMemo(
    () => ({ ...base, currentUser: user, profile: { first_name: user.firstName, last_name: user.lastName, avatar_url: null } }) as unknown as NonNullable<typeof base>,
    [base, user],
  );
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

/** Une route de « /v », enveloppée comme dans App.tsx. */
function V({ children, tabs = true }: { children: ReactNode; tabs?: boolean }) {
  return (
    <As user={RODRIGUE}>
      <CommercialRouteWrapper showTabBar={tabs}>{children}</CommercialRouteWrapper>
    </As>
  );
}

const Home = () => (
  <V>
    <CommercialHome />
  </V>
);
const Prospects = () => (
  <V>
    <CommercialProspects />
  </V>
);
const ProspectForm = () => (
  <V tabs={false}>
    <CommercialProspectForm />
  </V>
);
const Clients = () => (
  <V>
    <CommercialClients />
  </V>
);
/** « /v/login » : sans session, comme dans App.tsx. */
const Login = () => (
  <CommercialRouteWrapper requireAuth={false}>
    <CommercialLogin />
  </CommercialRouteWrapper>
);
const Password = () => (
  <As user={RODRIGUE}>
    <CommercialRouteWrapper showTabBar={false} bare>
      <CommercialPassword />
    </CommercialRouteWrapper>
  </As>
);
const OfficeNewClient = () => (
  <As user={NELSON}>
    <DesktopAppShell>
      <DesktopCreateClientDialog />
    </DesktopAppShell>
  </As>
);

export const SCREENS: Record<string, JourneyEntry> = {
  'j.sales.login': { Comp: Login, route: '/v/login' },
  'j.sales.password': { Comp: Password, route: '/v/password' },
  'j.sales.home': { Comp: Home, route: '/v' },
  'j.sales.prospects': { Comp: Prospects, route: '/v/prospects' },
  'j.sales.prospects-closed': { Comp: Prospects, route: '/v/prospects?filtre=clients' },
  'j.sales.prospect-new': { Comp: ProspectForm, route: '/v/prospects/new' },
  'j.sales.prospect-card': { Comp: ProspectForm, route: '/v/prospects/p-mireille', path: '/v/prospects/:id' },
  'j.sales.prospect-incomplete': { Comp: ProspectForm, route: '/v/prospects/p-sylvie', path: '/v/prospects/:id' },
  'j.sales.prospect-edit-needs': { Comp: ProspectForm, route: '/v/prospects/p-mireille?modifier=besoins', path: '/v/prospects/:id' },
  'j.sales.prospect-edit-incomplete': { Comp: ProspectForm, route: '/v/prospects/p-sylvie?completer', path: '/v/prospects/:id' },
  'j.sales.clients': { Comp: Clients, route: '/v/clients' },
  'j.sales.office-new-client': { Comp: OfficeNewClient, route: '/m/clients/new' },
};
