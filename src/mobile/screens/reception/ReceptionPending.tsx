// ============================================================
// RÉCEPTION — Les dépôts en attente d'attribution : reçus sans savoir à qui
// ils sont. Chaque carte montre ce qu'on sait (bordereau, colis, date) et
// un seul bouton : attribuer à un client.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { Barcode, UserSearch } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatCbm, formatKg } from '@/lib/reception';
import { useReceptionPending } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Button, Card, Holder, ScreenLoader } from '@/mobile/designKit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';

export function ReceptionPending() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data, isLoading } = useReceptionPending();

  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
      <MobileHeader title={t('rc_pending_title')} />
      <div className="space-y-5 px-5 pb-8 pt-5">
        <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_pending_hint')}</p>
        {isLoading ? (
          <ScreenLoader />
        ) : !data || data.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
            <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_pending_empty')}</p>
          </Card>
        ) : (
          data.map((d) => {
            const waybills = d.parcels.map((p) => p.courier_waybill).filter(Boolean) as string[];
            const descriptions = d.parcels.map((p) => p.description).filter(Boolean) as string[];
            return (
              <Card key={d.id} className="space-y-4">
                <div className="flex items-start gap-4">
                  <Holder icon={Barcode} tone="pending" size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className={cn('truncate tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{waybills[0] ?? d.deposit_no}</span>
                      <LocationMark location={d.location} size={24} />
                    </span>
                    <span className={cn('mt-1 block tabular-nums', TYPE.small, TEXT.muted)}>
                      {d.parcels.length} {t('rc_parcels').toLowerCase()} · {formatKg(d.total_weight_kg)} · {formatCbm(d.total_cbm)}
                    </span>
                    <span className={cn('mt-1 block', TYPE.small, TEXT.muted)}>{formatDateTime(d.opened_at)} · {labels.broughtBy(d.brought_by)}{d.received_by_name ? ` · ${d.received_by_name}` : ''}</span>
                    {descriptions.length > 0 && <span className={cn('mt-1 block truncate', TYPE.small, TEXT.muted)}>{descriptions.join(', ')}</span>}
                  </span>
                </div>
                <Button variant="primary" className="h-12 w-full" onClick={() => navigate(`/r/new?assign=${d.id}`)}>
                  <UserSearch /> {t('rc_assign')}
                </Button>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
