// Captures du parcours — domaine « teams » : clés « j.teams.<écran> » (données : tools/journey/teams.mjs).
// « Mes équipes » vue par le propriétaire (super admin, Nelson Ngango) : la liste
// des accès (sites, numéros), la création d'un accès (commercial, réceptionnaire
// avec deux numéros et son site), la fiche d'un membre, et le pilotage des
// commerciaux (chiffres du mois, objectifs). 07/10 : l'écran « À vérifier »
// (numéro déjà client), la cloche, « Repasser en prospect » sur la fiche d'un
// client et « Créer son compte client » depuis la fiche d'un prospect.
// Ordinateur : la coquille DesktopAppShell, comme AdminRouteWrapper au-dessus de `lg`.
// Téléphone : la coquille MobileAppShell, avec ou sans barre d'onglets comme dans App.tsx.
import React, { useContext } from 'react';
import type { JourneyEntry } from './types';
import { AdminAuthContext } from '@/contexts/AdminAuthContext';
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { MobileAppShell } from '@/mobile/components/layout/MobileAppShell';
import { TeamScreen } from '@/components/team/TeamScreen';
import { TeamNewMember } from '@/components/team/TeamNewMember';
import { TeamMemberScreen } from '@/components/team/TeamMemberScreen';
import { SalesBoard } from '@/components/team/SalesBoard';
import { SalesCommercial } from '@/components/team/SalesCommercial';
import { ProspectClaims } from '@/components/team/ProspectClaims';
import { DesktopClientsScreen } from '@/desktop/screens/clients/DesktopClientsScreen';
import { DesktopCreateClientDialog } from '@/desktop/screens/clients/DesktopCreateClientDialog';
import { MobileClientDetail } from '@/mobile/screens/clients/MobileClientDetail';
import { MobileCreateClient } from '@/mobile/screens/clients/MobileCreateClient';
import { MobileNotificationsScreen } from '@/mobile/screens/more/MobileNotificationsScreen';

/** La session simulée devient celle du propriétaire : Nelson Ngango, super admin (barre latérale, « c'est vous »). */
function AsNelson({ children }: { children: React.ReactNode }) {
  const parent = useContext(AdminAuthContext);
  const value = {
    ...parent,
    currentUser: { id: 'u-nelson', email: 'nelson@bonzinilabs.com', firstName: 'Nelson', lastName: 'Ngango', role: 'super_admin' },
    profile: { first_name: 'Nelson', last_name: 'Ngango' },
  } as unknown as React.ContextType<typeof AdminAuthContext>;
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

const desk = (Screen: React.ComponentType) =>
  function DeskScreen() {
    return (
      <AsNelson>
        <DesktopAppShell>
          <Screen />
        </DesktopAppShell>
      </AsNelson>
    );
  };

const phone = (Screen: React.ComponentType, showTabBar = false) =>
  function PhoneScreen() {
    return (
      <AsNelson>
        <MobileAppShell showTabBar={showTabBar}>
          <Screen />
        </MobileAppShell>
      </AsNelson>
    );
  };

export const SCREENS: Record<string, JourneyEntry> = {
  // 1–2. La liste des accès, rangée par équipe.
  'j.teams.list-desk': { Comp: desk(TeamScreen), route: '/m/equipe' },
  'j.teams.list-phone': { Comp: phone(TeamScreen, true), route: '/m/equipe' },
  // 3–4. Nouvel accès pour un commercial (le rôle est prérempli par « + Ajouter un commercial »).
  'j.teams.new-desk': { Comp: desk(TeamNewMember), route: '/m/equipe/nouveau?role=commercial', path: '/m/equipe/nouveau' },
  'j.teams.new-phone': { Comp: phone(TeamNewMember), route: '/m/equipe/nouveau?role=commercial', path: '/m/equipe/nouveau' },
  'j.teams.new-roles': { Comp: desk(TeamNewMember), route: '/m/equipe/nouveau', path: '/m/equipe/nouveau' },
  // Un réceptionnaire : le site proposé (Guangzhou · bureau), deux numéros (Cameroun, Chine « WeChat »).
  'j.teams.new-reception-desk': { Comp: desk(TeamNewMember), route: '/m/equipe/nouveau?role=receptionist', path: '/m/equipe/nouveau' },
  'j.teams.new-reception-phone': { Comp: phone(TeamNewMember), route: '/m/equipe/nouveau?role=receptionist', path: '/m/equipe/nouveau' },
  // 5. La fiche d'un membre.
  'j.teams.member-desk': { Comp: desk(TeamMemberScreen), route: '/m/equipe/u-rodrigue', path: '/m/equipe/:userId' },
  'j.teams.member-phone': { Comp: phone(TeamMemberScreen), route: '/m/equipe/u-rodrigue', path: '/m/equipe/:userId' },
  'j.teams.member-kevin': { Comp: phone(TeamMemberScreen), route: '/m/equipe/u-kevin', path: '/m/equipe/:userId' },
  'j.teams.member-kevin-desk': { Comp: desk(TeamMemberScreen), route: '/m/equipe/u-kevin', path: '/m/equipe/:userId' },
  // Une réponse d'avant le 06/10 (ni `phones` ni `site`) : la fiche tient.
  'j.teams.member-paul': { Comp: phone(TeamMemberScreen), route: '/m/equipe/u-paul', path: '/m/equipe/:userId' },
  // 6. Ventes : l'équipe commerciale, sur 6 mois (par défaut) puis 12 semaines.
  'j.teams.sales-desk': { Comp: desk(SalesBoard), route: '/m/equipe/ventes', path: '/m/equipe/ventes' },
  'j.teams.sales-phone': { Comp: phone(SalesBoard), route: '/m/equipe/ventes', path: '/m/equipe/ventes' },
  'j.teams.sales-weeks-desk': { Comp: desk(SalesBoard), route: '/m/equipe/ventes?periode=12w', path: '/m/equipe/ventes' },
  'j.teams.sales-weeks-phone': { Comp: phone(SalesBoard), route: '/m/equipe/ventes?periode=12w', path: '/m/equipe/ventes' },
  // 7. Un commercial en détail ; Hervé Nkoulou, fiche archivée (12 mois : son histoire ; 3 mois : rien).
  'j.teams.commercial-desk': { Comp: desk(SalesCommercial), route: '/m/equipe/ventes/src-rodrigue', path: '/m/equipe/ventes/:sourceId' },
  'j.teams.commercial-phone': { Comp: phone(SalesCommercial), route: '/m/equipe/ventes/src-rodrigue', path: '/m/equipe/ventes/:sourceId' },
  'j.teams.commercial-herve-desk': { Comp: desk(SalesCommercial), route: '/m/equipe/ventes/src-herve?periode=12m', path: '/m/equipe/ventes/:sourceId' },
  'j.teams.commercial-herve-phone': { Comp: phone(SalesCommercial), route: '/m/equipe/ventes/src-herve?periode=3m', path: '/m/equipe/ventes/:sourceId' },
  // 8. « À vérifier » (07/10).
  'j.teams.claims-desk': { Comp: desk(ProspectClaims), route: '/m/equipe/ventes/a-verifier', path: '/m/equipe/ventes/a-verifier' },
  'j.teams.claims-phone': { Comp: phone(ProspectClaims), route: '/m/equipe/ventes/a-verifier', path: '/m/equipe/ventes/a-verifier' },
  // 9. La cloche sur téléphone (sur ordinateur : le menu de la barre du haut).
  'j.teams.notifications-phone': { Comp: phone(MobileNotificationsScreen), route: '/m/more/notifications', path: '/m/more/notifications' },
  // 10. Repasser en prospect, depuis la fiche d'un client.
  'j.teams.client-desk': { Comp: desk(DesktopClientsScreen), route: '/m/clients/u7', path: '/m/clients/:clientId' },
  'j.teams.client-blocked-desk': { Comp: desk(DesktopClientsScreen), route: '/m/clients/u5', path: '/m/clients/:clientId' },
  'j.teams.client-phone': { Comp: phone(MobileClientDetail), route: '/m/clients/u7', path: '/m/clients/:clientId' },
  'j.teams.client-blocked-phone': { Comp: phone(MobileClientDetail), route: '/m/clients/u5', path: '/m/clients/:clientId' },
  // 11. Prospect → client : le formulaire « Nouveau client », le numéro de Paul Etoga déjà saisi.
  'j.teams.prospect-client-desk': { Comp: desk(DesktopCreateClientDialog), route: '/m/clients/new?phone=%2B237699123456', path: '/m/clients/new' },
  'j.teams.prospect-client-phone': { Comp: phone(MobileCreateClient), route: '/m/clients/new?phone=%2B237699123456', path: '/m/clients/new' },
};
