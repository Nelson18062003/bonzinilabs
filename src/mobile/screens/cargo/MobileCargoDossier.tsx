/**
 * Mobile admin — le dossier d'un conteneur, pensé pour un écran de 390 px.
 *
 * Un en-tête de ~120 px et pas un de plus : le numéro de boîte, le statut,
 * le client, l'armateur, l'arrivée. Les huit sections du dossier sont des
 * chips qui défilent — toutes atteignables, l'active ramenée en vue — et
 * l'URL reste l'état (/m/cargo/:id/:section). Le contenu des sections est
 * celui du desktop (mêmes composants) posé dans le thème neutre `.admin-theme`
 * pour que ses jetons parlent la même langue que le kit mobile.
 */
import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipment } from '@/hooks/useCargo';
import {
  DossierActions,
  TabApercu, TabChargement, TabClient, TabCouts, TabDocuments, TabDouane, TabNotes, TabSuivi,
} from '@/components/cargo/dossier';
import { DEFAULT_TAB, DOSSIER_TABS, dossierPath, isDossierTab, type DossierTab } from '@/lib/cargo/dossierNav';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay, statusMeta } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, TYPE, SURFACE, Chip, ScreenError, ScreenLoader, StatusPill } from '@/mobile/designKit';

export function MobileCargoDossier() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId, tab: rawTab } = useParams<{ shipmentId: string; tab?: string }>();
  const tab: DossierTab = isDossierTab(rawTab) ? rawTab : DEFAULT_TAB;
  const canManage = hasPermission('canManageCargo');
  const { data: s, isLoading, error } = useCargoShipment(shipmentId ?? null);
  const chipsRef = useRef<HTMLDivElement>(null);

  // La chip active revient toujours en vue, même quand on arrive par l'URL.
  useEffect(() => {
    const el = chipsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;
  if (rawTab && !isDossierTab(rawTab)) return <Navigate to={dossierPath(shipmentId)} replace />;

  const current = DOSSIER_TABS.find((t) => t.key === tab) ?? DOSSIER_TABS[0];

  return (
    <div className="admin-theme flex min-h-full flex-col bg-white dark:bg-[#1E1E1E]">
      <MobileHeader
        title={s ? s.container_number : 'Dossier conteneur'}
        subtitle={s ? `${s.client_label} · ${CARRIER_LABEL[s.carrier] ?? s.carrier}` : undefined}
        showBack
        backTo="/m/cargo"
        rightElement={s ? <DossierActions shipment={s} onRemoved={() => navigate('/m/cargo')} /> : undefined}
      />

      {isLoading && <ScreenLoader />}
      {error && <ScreenError title="Dossier introuvable" description={(error as Error).message} />}
      {!isLoading && !error && !s && <ScreenError title="Dossier introuvable" description="Ce conteneur n'est plus dans la flotte." />}

      {s && (() => {
        const meta = statusMeta(s.status);
        const eta = bestEta(s);
        const inDays = daysUntilArrival(s);
        const slip = etaSlipDays(s);
        return (
          <>
            {/* L'identité et la décision, en 120 px. */}
            <div className={cn('border-b px-4 py-3', SURFACE.divider)}>
              <div className="flex items-center justify-between gap-2">
                <div className={cn('min-w-0 truncate', TYPE.small, TEXT.muted)}>
                  B/L <span className={cn('tabular-nums', TEXT.strong)}>{s.bl_number}</span>
                  {s.vessel_name && <> · {s.vessel_name}{s.voyage ? ` · ${s.voyage}` : ''}</>}
                </div>
                <StatusPill tone={meta.tone} label={meta.label} />
              </div>
              <div className={cn('mt-2 flex items-baseline justify-between gap-3 rounded-lg p-3', SURFACE.inset)}>
                <span className={cn(TYPE.small, TEXT.muted)}>{eta.source === 'carrier' ? 'Arrivée' : 'Arrivée promise'}</span>
                <span className="text-right tabular-nums">
                  <span className={cn(TYPE.bodyStrong, TEXT.strong)}>{s.pod_name} · {fmtDay(eta.date)}</span>
                  <span className={cn('block', TYPE.small, slip > 0 ? 'text-[#975102] dark:text-[#E8B931]' : TEXT.muted)}>
                    {inDays != null && (inDays > 0 ? `dans ${inDays} j` : inDays === 0 ? "aujourd'hui" : `il y a ${-inDays} j`)}
                    {slip > 0 && ` · +${slip} j vs promesse`}
                  </span>
                </span>
              </div>
            </div>

            {/* Les huit sections, toutes atteignables. */}
            <div ref={chipsRef} className={cn('scrollbar-hide sticky top-14 z-30 flex gap-2 overflow-x-auto border-b bg-white px-4 py-2 dark:bg-[#1E1E1E]', SURFACE.divider)}>
              {DOSSIER_TABS.map((t) => (
                <Chip key={t.key} label={t.label} active={t.key === tab} onClick={() => navigate(dossierPath(s.id, t.key))} />
              ))}
            </div>

            <div className="px-4 pb-6 pt-3">
              <p className={cn('mb-3', TYPE.small, TEXT.muted)}>{current.purpose}</p>
              {tab === 'apercu' && <TabApercu shipment={s} />}
              {tab === 'suivi' && <TabSuivi shipment={s} />}
              {tab === 'chargement' && <TabChargement shipment={s} canManage={canManage} />}
              {tab === 'documents' && <TabDocuments shipment={s} canManage={canManage} />}
              {tab === 'douane' && <TabDouane shipment={s} canManage={canManage} />}
              {tab === 'couts' && <TabCouts shipment={s} canManage={canManage} />}
              {tab === 'client' && <TabClient shipment={s} canManage={canManage} />}
              {tab === 'notes' && <TabNotes shipment={s} canManage={canManage} />}
            </div>
          </>
        );
      })()}
    </div>
  );
}
