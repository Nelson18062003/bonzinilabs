// ============================================================
// RÉCEPTION — Dépôt terminé : le reçu (colis, poids, volume, mode, date,
// qui), et les étiquettes : une page par colis, la même étiquette que
// celle des fournisseurs, avec « 3/10 » dans la case Carton no. et la date
// d'arrivée. Le PDF part dans la feuille de partage (AirPrint, WeChat)
// ou se télécharge.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Printer, ScanLine } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import { clientFullName, formatCbm, formatKg } from '@/lib/reception';
import { useReceptionDeposit } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { LABEL_H, LABEL_W, fitOnPage } from '@/lib/shippingLabelCanvas';
import { useShippingLabel } from '@/components/customer-code/useShippingLabel';
import { deliverFile } from '@/components/customer-code/exportShippingLabel';
import { SURFACE, TEXT, TYPE, Card, Holder, PrimaryPill, Row, ScreenLoader, SoftPill } from '@/mobile/designKit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';

export function ReceptionDone() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading } = useReceptionDeposit(depositId);
  const { data: settings } = useAdminShippingSettings();
  const [printing, setPrinting] = useState(false);

  const client = deposit?.client ?? null;
  const { renderWith, qr } = useShippingLabel({
    code: client?.customer_code ?? '',
    clientName: clientFullName(client),
    clientPhone: client?.phone,
    clientEmail: client?.email,
    companyName: client?.company_name,
    clientCity: client?.city,
    clientCountry: client?.country,
    destination: deposit?.location ?? 'warehouse',
    settings: settings ?? DEFAULT_SHIPPING_SETTINGS,
  }, { active: !!client });

  if (isLoading || !deposit) return <ScreenLoader className="min-h-[100dvh]" />;

  const name = client ? clientFullName(client) : t('rc_unknown_client');
  const count = deposit.parcels.length;
  const receivedAt = deposit.closed_at ?? deposit.opened_at;

  const printLabels = async () => {
    if (!client) return;
    setPrinting(true);
    try {
      const shipDate = new Date(receivedAt).toLocaleDateString(getCurrentLocale());
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const box = fitOnPage(LABEL_W, LABEL_H);
      for (let i = 0; i < deposit.parcels.length; i++) {
        const p = deposit.parcels[i];
        const canvas = await renderWith({ cartonNo: `${p.seq}/${count}`, shipDate }, 3);
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', box.x, box.y, box.w, box.h, undefined, 'FAST');
      }
      const file = new File([pdf.output('blob')], `bonzini-etiquettes-${deposit.deposit_no}-${client.customer_code}.pdf`, { type: 'application/pdf' });
      await deliverFile(file, `${deposit.deposit_no} · ${client.customer_code}`);
    } catch (err) {
      console.error('reception labels', err);
      toast.error(t('error'));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      {qr}
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

        <div className="space-y-3 pt-2">
          {client && (
            <>
              <PrimaryPill onClick={() => void printLabels()} loading={printing} className="h-14 w-full text-[17px]">
                <Printer /> {t('rc_print_labels')} ({count})
              </PrimaryPill>
              <p className={cn('text-center', TYPE.small, TEXT.muted)}>{t('rc_labels_hint')}</p>
            </>
          )}
          <SoftPill onClick={() => navigate('/r/new')} className="h-14 w-full text-[17px]"><ScanLine /> {t('rc_next_deposit')}</SoftPill>
          <button type="button" onClick={() => navigate('/r')} className={cn('h-12 w-full', TYPE.bodyStrong, TEXT.muted)}>{t('rc_back_home')}</button>
        </div>
      </div>
    </div>
  );
}
