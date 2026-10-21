/**
 * Les « Plus » des espaces de terrain (refonte v2) : un par rôle, sur
 * RoleMoreScreen. Ce qui n'a plus d'onglet à soi y est rangé (la réception
 * y trouve « En attente » ; le commercial, son mot de passe).
 */
import { Inbox, PackagePlus } from 'lucide-react';
import { RoleMoreScreen } from './RoleMoreScreen';

export function ReceptionMore() {
  return (
    <RoleMoreScreen
      loginPath="/r/login"
      links={[
        { label: 'Nouveau dépôt de colis', icon: PackagePlus, to: '/r/new' },
        { label: 'En attente d’attribution', icon: Inbox, to: '/r/pending' },
      ]}
    />
  );
}

export function WarehouseMore() {
  return <RoleMoreScreen loginPath="/w/login" showLanguage={false} />;
}

export function AgentCashMore() {
  return <RoleMoreScreen loginPath="/a/login" />;
}

export function CommercialMore() {
  return <RoleMoreScreen loginPath="/v/login" showLanguage={false} passwordPath="/v/password" />;
}
