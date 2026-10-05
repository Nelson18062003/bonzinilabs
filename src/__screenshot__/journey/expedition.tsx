// Captures du parcours — domaine « expedition » : clés « j.expedition.<écran> » (données : tools/journey/expedition.mjs).
// L'organisation des départs, faite au bureau par Grace Ebogo (ops et cargo) dans /m/cargo :
// vols Air cargo (paquets de 32 kg, scan au départ, refus de l'aéroport, manifeste) et conteneur MIEU3611115.
import { useContext, useEffect, useState, type ContextType, type ReactNode } from 'react';
import { AdminAuthContext, ROLE_PERMISSIONS, type RolePermission } from '@/contexts/AdminAuthContext';
import { MobileCargoAir, MobileCargoAirDetail, MobileCargoAirForm } from '@/mobile/screens/cargo';
import { DesktopCargoAir, DesktopCargoDossier } from '@/desktop/screens/cargo';
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { useAirShipment } from '@/hooks/useAirShipments';
import { buildAirManifestPdf, manifestFileName } from '@/lib/airManifestPdf';
import type { JourneyEntry } from './types';

/** La session de Grace Ebogo (rôle « ops ») : son nom dans le shell, les droits réels de son rôle. */
function AsGrace({ children }: { children: ReactNode }) {
  const outer = useContext(AdminAuthContext);
  const perms = ROLE_PERMISSIONS.ops;
  const value = {
    ...(outer as object),
    currentUser: { id: 'grace', email: 'grace.ebogo@bonzinilabs.com', firstName: 'Grace', lastName: 'Ebogo', role: 'ops' },
    profile: { first_name: 'Grace', last_name: 'Ebogo' },
    hasPermission: (p: keyof RolePermission) => !!perms[p],
    canManageUsers: perms.canManageUsers,
  } as ContextType<typeof AdminAuthContext>;
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

const desk = (node: ReactNode) => <AsGrace><DesktopAppShell>{node}</DesktopAppShell></AsGrace>;

/** Le manifeste du vol ET 607 du 06/10, fabriqué par le vrai moteur (jsPDF) ; le PDF est posé sur window.__manifest. */
function ManifestDoc() {
  const { data: a } = useAirShipment('et607');
  const [state, setState] = useState('Fabrication du manifeste…');
  useEffect(() => {
    if (!a) return;
    try {
      const pdf = buildAirManifestPdf(a);
      const b64 = String(pdf.output('datauristring')).split('base64,')[1] ?? '';
      (window as unknown as { __manifest?: { name: string; b64: string } }).__manifest = { name: manifestFileName(a), b64 };
      setState(`PDF prêt : ${manifestFileName(a)}`);
    } catch (e) {
      setState(`Erreur : ${String(e)}`);
    }
  }, [a]);
  return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>{state}</div>;
}

const AIR_DETAIL = '/m/cargo/avion/:airId';

export const SCREENS: Record<string, JourneyEntry> = {
  // Avion — téléphone
  'j.expedition.form': { Comp: () => <AsGrace><MobileCargoAirForm /></AsGrace>, route: '/m/cargo/avion/nouveau' },
  'j.expedition.list': { Comp: () => <AsGrace><MobileCargoAir /></AsGrace>, route: '/m/cargo/avion' },
  'j.expedition.add': { Comp: () => <AsGrace><MobileCargoAirDetail /></AsGrace>, route: '/m/cargo/avion/et607-vide', path: AIR_DETAIL },
  'j.expedition.detail': { Comp: () => <AsGrace><MobileCargoAirDetail /></AsGrace>, route: '/m/cargo/avion/et607', path: AIR_DETAIL },
  'j.expedition.lta': { Comp: () => <AsGrace><MobileCargoAirDetail /></AsGrace>, route: '/m/cargo/avion/et607-1013', path: AIR_DETAIL },
  'j.expedition.refuse': { Comp: () => <AsGrace><MobileCargoAirDetail /></AsGrace>, route: '/m/cargo/avion/et607-0404', path: AIR_DETAIL },
  // Avion — ordinateur
  'j.expedition.desk-list': { Comp: () => desk(<DesktopCargoAir />), route: '/m/cargo/avion' },
  'j.expedition.desk-detail': { Comp: () => desk(<DesktopCargoAir />), route: '/m/cargo/avion/et607', path: AIR_DETAIL },
  'j.expedition.manifest': { Comp: () => <AsGrace><ManifestDoc /></AsGrace>, route: '/' },
  // Maritime — le dossier du conteneur MIEU3611115, onglet Suivi (« Marquer arrivé »)
  'j.expedition.container': { Comp: () => desk(<DesktopCargoDossier />), route: '/m/cargo/ct-mieu/suivi', path: '/m/cargo/:shipmentId/:tab' },
};
