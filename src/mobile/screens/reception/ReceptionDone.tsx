// ============================================================
// RÉCEPTION — Dépôt terminé : le reçu (colis, poids, volume, mode, date,
// qui), et les étiquettes : une page par colis, la même étiquette que
// celle des fournisseurs, avec « 3/10 » dans la case Carton no. et la date
// d'arrivée. Un aperçu, puis le PDF ou l'image se téléchargent ; le partage
// (AirPrint, WeChat) reste possible. Rien d'autre : l'étiquette du client
// est dans sa fiche (Clients), la mise en paquet se fait plus tard, depuis
// l'onglet Paquets.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Printer, ScanLine } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, formatCbm, formatKg } from '@/lib/reception';
import { useReceptionDeposit } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { SURFACE, TEXT, TYPE, Card, Holder, PrimaryPill, Row, ScreenLoader, SoftPill } from '@/mobile/designKit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { InternalLabelSheet } from '@/mobile/components/reception/InternalLabelSheet';

export function ReceptionDone() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading } = useReceptionDeposit(depositId);
  const { data: settings } = useAdminShippingSettings();
  const [internalOpen, setInternalOpen] = useState(false);

  if (isLoading || !deposit) return <ScreenLoader className="min-h-[100dvh]" />;

  const client = deposit.client ?? null;
  const name = client ? clientFullName(client) : t('rc_unknown_client');
  const count = deposit.parcels.length;
  const receivedAt = deposit.closed_at ?? deposit.opened_at;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <div className="flex-1 space-y-6 px-5 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center"><Holder icon={Check} tone="success" size="lg" className="h-16 w-16 [&_svg]:h-8 [&_svg]:w-8" /></div>
          <h1 className={cn(TYPE.heading, TEXT.strong)}>{t('rc_done_title')}</h1>
          <p className={cn('mt-2 tabular-nums', TYPE.body, TEXT.muted)}>{deposit.deposit_no} · {name}{client ? ` · ${client.customer_code}` : ''}</p>
        </div>

        <Card className="divide-y divide-[#D9D9D9] py-1 dark:divide-[#444444]">
          <Row label={t('rc_parcels')} value={count} />
          <Row label={t('rc_weight')} value={formatKg(deposit.total_weight_kg)} />
          <Row label={t('rc_volume')} value={formatCbm(deposit.total_cbm)} />
          <Row label={t('rc_mode')} value={<span className="inline-flex items-center gap-2"><LocationMark location={deposit.location} size={24} />{labels.location(deposit.location)}</span>} />
          <Row label={t('rc_brought_by')} value={labels.broughtBy(deposit.brought_by)} />
          <Row label={t('rc_received_on')} value={formatDateTime(receivedAt)} />
          {deposit.received_by_name && <Row label={t('rc_received_by')} value={deposit.received_by_name} />}
        </Card>

        {client && (
          <div className="rounded-lg bg-[#CFF7D3] px-4 py-4 text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]">
            <p className={TYPE.bodyStrong}>{t('rc_done_receipt')}</p>
          </div>
        )}

        {client && (
          <div className="space-y-3 pt-2">
            <PrimaryPill onClick={() => setInternalOpen(true)} className="h-14 w-full text-[17px]">
              <Printer /> {t('rc_print_labels')} ({count})
            </PrimaryPill>
            <p className={cn('text-center', TYPE.small, TEXT.muted)}>{t('rc_labels_hint')}</p>
          </div>
        )}

        <div className="space-y-3">
          <SoftPill onClick={() => navigate('/r/new')} className="h-14 w-full text-[17px]"><ScanLine /> {t('rc_next_deposit')}</SoftPill>
          <button type="button" onClick={() => navigate('/r')} className={cn('h-12 w-full', TYPE.bodyStrong, TEXT.muted)}>{t('rc_back_home')}</button>
        </div>
      </div>
      {client && <InternalLabelSheet open={internalOpen} onClose={() => setInternalOpen(false)} deposit={deposit} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}
    </div>
  );
}

