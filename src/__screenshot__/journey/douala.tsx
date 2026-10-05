// Captures du parcours — domaine « douala » : clés « j.douala.<écran> » (données : tools/journey/douala.mjs).
// L'entrepôt de Douala (/w), sur le téléphone de Brice Ndzana : le vol ET 607 arrive avec ses
// paquets PQ-000041 à PQ-000045 ; on reçoit les paquets, on les ouvre, on pointe chaque colis,
// on fait le bilan ; plus tard on remet les colis au client (signature, bon de retrait BR-…).
// Les écrans sont enveloppés comme dans App.tsx : WarehouseShell, avec la barre d'onglets
// sur l'accueil des arrivées et de la remise, sans elle ailleurs.
import type { JourneyEntry } from './types';
import { WarehouseShell } from '@/mobile/components/warehouse/WarehouseRouteWrapper';
import {
  WarehouseArrivals, WarehouseCheckin, WarehouseCheckinParcel, WarehouseCheckinDone, WarehousePickup, WarehouseWaiting,
  WarehousePickupClient, WarehousePay, WarehouseHandover, WarehouseSign, WarehouseReleaseDone,
} from '@/mobile/screens/warehouse';

const ARRIVAL = '/w/arrivees/:kind/:id';

export const SCREENS: Record<string, JourneyEntry> = {
  // 1. Les arrivées du jour : le vol ET 607 (5 paquets) et le conteneur MIEU3611115.
  'j.douala.arrivals': { Comp: () => <WarehouseShell><WarehouseArrivals /></WarehouseShell>, route: '/w/arrivees', wrap: 'lang' },
  // 2–3. Le vol : les paquets d'abord (« Paquets reçus 3 / 5 »), puis un scan PQ-000044.
  'j.douala.checkin': { Comp: () => <WarehouseShell showTabBar={false}><WarehouseCheckin /></WarehouseShell>, route: '/w/arrivees/air/et607', path: ARRIVAL, wrap: 'lang' },
  // 4. Un paquet ouvert : ses colis, pointés un par un.
  'j.douala.package': { Comp: () => <WarehouseShell showTabBar={false}><WarehouseCheckin /></WarehouseShell>, route: '/w/arrivees/air/et607?paquet=PQ-000042', path: ARRIVAL, wrap: 'lang' },
  // 5. La fiche d'un colis du paquet : là, abîmé, manquant — et sa place.
  'j.douala.parcel': { Comp: () => <WarehouseShell showTabBar={false}><WarehouseCheckinParcel /></WarehouseShell>, route: '/w/arrivees/air/et607/colis/p-122-03?paquet=PQ-000042', path: `${ARRIVAL}/colis/:parcelId`, wrap: 'lang' },
  // 6. Le bilan de l'arrivée.
  'j.douala.bilan': { Comp: () => <WarehouseShell showTabBar={false}><WarehouseCheckinDone /></WarehouseShell>, route: '/w/arrivees/air/et607/bilan', path: `${ARRIVAL}/bilan`, wrap: 'lang' },
  // 7. La remise : le scan du client, ceux qui attendent, ses colis, qui emporte, la signature, le bon.
  'j.douala.pickup': { Comp: () => <WarehouseShell><WarehousePickup /></WarehouseShell>, route: '/w/remise', wrap: 'lang' },
  'j.douala.waiting': { Comp: () => <WarehouseShell><WarehouseWaiting /></WarehouseShell>, route: '/w/remise/liste', wrap: 'lang' },
  'j.douala.client': { Comp: () => <WarehouseShell showTabBar={false}><WarehousePickupClient /></WarehouseShell>, route: '/w/remise/BZ-510224', path: '/w/remise/:code', wrap: 'lang' },
  'j.douala.who': { Comp: () => <WarehouseShell showTabBar={false}><WarehouseHandover /></WarehouseShell>, route: '/w/remise/BZ-510224/qui', path: '/w/remise/:code/qui', wrap: 'lang' },
  'j.douala.sign': { Comp: () => <WarehouseShell showTabBar={false}><WarehouseSign /></WarehouseShell>, route: '/w/remise/BZ-510224/signature', path: '/w/remise/:code/signature', wrap: 'lang' },
  'j.douala.done': { Comp: () => <WarehouseShell showTabBar={false}><WarehouseReleaseDone /></WarehouseShell>, route: '/w/bon/rel-012', path: '/w/bon/:releaseId', wrap: 'lang' },
  // 8. Une cliente dont le fret n'est pas soldé : la remise attend l'encaissement.
  'j.douala.blocked': { Comp: () => <WarehouseShell showTabBar={false}><WarehousePickupClient /></WarehouseShell>, route: '/w/remise/BZ-482913', path: '/w/remise/:code', wrap: 'lang' },
  'j.douala.pay': { Comp: () => <WarehouseShell showTabBar={false}><WarehousePay /></WarehouseShell>, route: '/w/remise/BZ-482913/encaisser', path: '/w/remise/:code/encaisser', wrap: 'lang' },
};
