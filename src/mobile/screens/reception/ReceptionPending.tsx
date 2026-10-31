// ============================================================
// RÉCEPTION — Les dépôts en attente d'attribution : reçus sans savoir à qui
// ils sont. Chaque carte montre ce qu'on sait (bordereau, colis, date) et
// un seul bouton : attribuer à un client.
// Refonte v2 (maquette 10/46) : le chiffre (colis reçus sans client, le plus
// ancien), puis une ligne par dépôt avec « Attribuer ».
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { listDate } from '@/lib/reception';
import { useReceptionPending } from '@/hooks/useReception';
import { EmptyLine, HeroFigure, ItemList, ScreenLoader, ScreenTop, SURFACE } from '@/mobile/designKit';
import { ParcelLine, useReceptionLabels } from '@/mobile/components/reception/bits';
import { RowButton } from '@/mobile/components/cargo/v2';
import { assignPath } from '@/mobile/components/reception/useAssignFlow';

export function ReceptionPending() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data, isLoading, error, refetch } = useReceptionPending();

  const list = data ?? [];
  const parcels = list.reduce((n, d) => n + d.parcels.length, 0);
  const oldest = list.reduce<number | null>((m, d) => { const age = Math.floor((Date.now() - new Date(d.opened_at).getTime()) / 86_400_000); return m == null || age > m ? age : m; }, null);
  return (
    <div className={cn('min-h-[100dvh] pb-6', SURFACE.canvas)}>
      <ScreenTop title={t('rc_pending_title')} backTo="/r" />
      {isLoading ? <ScreenLoader /> : error ? (
        // Une coupure réseau ne se montre jamais comme « rien en attente ».
        <EmptyLine action={{ label: t('rc_retry'), onClick: () => void refetch() }}>{(error as Error).message}</EmptyLine>
      ) : list.length === 0 ? (
        <EmptyLine>{t('rc_pending_empty')}</EmptyLine>
      ) : (
        <>
          <div className="px-5 pt-4">
            <HeroFigure
              label={t('rc_v2_received_no_client')}
              value={parcels}
              unit={t('rc_parcels').toLowerCase()}
              sub={[
                <><b className="font-bold">{list.length}</b> {t('rc_deposits').toLowerCase()}</>,
                ...(oldest != null ? [<>{t('rc_v2_oldest')} <b className="font-bold">{oldest} j</b></>] : []),
              ]}
            />
          </div>
          <ItemList className="pt-2">
            {list.map((d) => {
              const hint = d.notes ?? d.parcels.map((p) => p.courier_waybill).find(Boolean) ?? d.parcels.map((p) => p.description).find(Boolean) ?? t('rc_v2_no_name');
              return (
                <ParcelLine
                  key={d.id}
                  parcel={{ ...d.parcels[0], photo_path: d.parcels[0]?.photo_path ?? null, parcel_no: d.deposit_no, description: d.deposit_no, kind: 'carton', weight_kg: d.total_weight_kg, cbm: d.total_cbm }}
                  title={d.deposit_no}
                  subtitle={`${labels.parcels(d.parcels.length)} · ${hint} · ${listDate(d.opened_at)}`}
                  onClick={() => navigate(`/r/deposit/${d.id}`)}
                  right={<RowButton onClick={() => navigate(assignPath(d.id))}>{t('rc_v2_assign_short')}</RowButton>}
                />
              );
            })}
          </ItemList>
        </>
      )}
    </div>
  );
}
