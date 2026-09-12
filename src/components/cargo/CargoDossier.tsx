/**
 * Le dossier complet d'un conteneur — l'écran où l'on travaille.
 *
 * En-tête persistant (identité, arrivée, actions) + barre d'onglets collante,
 * puis le contenu de l'onglet. Une section = une carte à bandeau ; rien
 * d'autre ne sépare deux sujets (02-foundation §1.5.2).
 */
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipment } from '@/hooks/useCargo';
import {
  DossierHeader, DossierTabsBar,
  TabApercu, TabChargement, TabClient, TabCouts, TabDocuments, TabDouane, TabNotes, TabSuivi,
} from '@/components/cargo/dossier';
import { DOSSIER_TABS, type DossierTab } from '@/lib/cargo/dossierNav';
import { cn } from '@/lib/utils';
import { TEXT, ScreenLoader, ScreenError } from '@/desktop/designKit';

export function CargoDossier({
  shipmentId,
  tab,
  onTabChange,
  onRemoved,
  /** Mobile : pas d'en-tête collant (la barre de l'app l'est déjà). */
  sticky = true,
}: {
  shipmentId: string;
  tab: DossierTab;
  onTabChange: (t: DossierTab) => void;
  onRemoved?: () => void;
  sticky?: boolean;
}) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCargo');
  const { data: s, isLoading, error } = useCargoShipment(shipmentId);
  const current = DOSSIER_TABS.find((t) => t.key === tab) ?? DOSSIER_TABS[0];

  if (isLoading) return <ScreenLoader />;
  if (error) return <ScreenError title="Dossier introuvable" description={(error as Error).message} />;
  if (!s) return <ScreenError title="Dossier introuvable" description="Ce conteneur n'est plus dans la flotte." />;

  return (
    <div>
      <div
        className={cn(
          'border-b border-black/[0.06] bg-background pb-0 dark:border-white/[0.06]',
          sticky && 'sticky top-[76px] z-20 -mx-8 px-8 pt-1',
        )}
      >
        <DossierHeader shipment={s} onRemoved={onRemoved} />
        <div className="mt-4">
          <DossierTabsBar value={tab} onChange={onTabChange} />
        </div>
      </div>

      <p className={cn('mt-4 text-[12.5px]', TEXT.muted)}>{current.purpose}</p>

      <div className="mt-3 pb-10">
        {tab === 'apercu' && <TabApercu shipment={s} />}
        {tab === 'suivi' && <TabSuivi shipment={s} />}
        {tab === 'chargement' && <TabChargement shipment={s} canManage={canManage} />}
        {tab === 'documents' && <TabDocuments shipment={s} canManage={canManage} />}
        {tab === 'douane' && <TabDouane shipment={s} canManage={canManage} />}
        {tab === 'couts' && <TabCouts shipment={s} canManage={canManage} />}
        {tab === 'client' && <TabClient shipment={s} canManage={canManage} />}
        {tab === 'notes' && <TabNotes shipment={s} canManage={canManage} />}
      </div>
    </div>
  );
}
