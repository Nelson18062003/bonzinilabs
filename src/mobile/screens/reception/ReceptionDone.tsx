// ============================================================
// RÉCEPTION — Dépôt terminé : le reçu (colis, poids, volume, mode, date,
// qui), et les étiquettes : une page par colis, la même étiquette que
// celle des fournisseurs, avec « 3/10 » dans la case Carton no. et la date
// d'arrivée. Un aperçu, puis le PDF ou l'image se téléchargent ; le partage
// (AirPrint, WeChat) reste possible. Au bureau (avion), l'étape suivante est
// là aussi : « Mettre en paquet » — le paquet en cours d'abord, puis des
// paquets de 32 kg créés tout seuls (PackSheet).
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, PackagePlus, Printer, ScanLine, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, formatCbm, formatKg, type Deposit } from '@/lib/reception';
import { packableParcels, sumParcelKg } from '@/lib/airPackage';
import { useReceptionDeposit } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { useShippingLabel } from '@/components/customer-code/useShippingLabel';
import { SURFACE, TEXT, TONE_TEXT, TYPE, Card, Holder, PrimaryPill, Row, ScreenLoader, SoftPill } from '@/mobile/designKit';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { ReceptionLabelSheet } from '@/mobile/components/reception/ReceptionLabelSheet';
import { InternalLabelSheet } from '@/mobile/components/reception/InternalLabelSheet';
import { PackSheet } from '@/mobile/components/reception/PackSheet';
import { usePackageText } from '@/mobile/components/reception/packageText';

export function ReceptionDone() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading } = useReceptionDeposit(depositId);
  const { data: settings } = useAdminShippingSettings();
  const [internalOpen, setInternalOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  const client = deposit?.client ?? null;
  const { qr } = useShippingLabel({
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

        {client && (
          <div className="space-y-3 pt-2">
            <PrimaryPill onClick={() => setInternalOpen(true)} className="h-14 w-full text-[17px]">
              <Printer /> {t('rc_print_labels')} ({count})
            </PrimaryPill>
            <p className={cn('text-center', TYPE.small, TEXT.muted)}>{t('rc_labels_hint')}</p>
            <SoftPill onClick={() => setLabelOpen(true)} className="h-14 w-full text-[17px]"><Tag /> {t('rc_client_label_short')}</SoftPill>
          </div>
        )}

        {deposit.location === 'office' && client && <PackCard deposit={deposit} />}

        <div className="space-y-3">
          <SoftPill onClick={() => navigate('/r/new')} className="h-14 w-full text-[17px]"><ScanLine /> {t('rc_next_deposit')}</SoftPill>
          <button type="button" onClick={() => navigate('/r')} className={cn('h-12 w-full', TYPE.bodyStrong, TEXT.muted)}>{t('rc_back_home')}</button>
        </div>
      </div>
      {client && <ReceptionLabelSheet open={labelOpen} onClose={() => setLabelOpen(false)} client={client} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}
      {client && <InternalLabelSheet open={internalOpen} onClose={() => setInternalOpen(false)} deposit={deposit} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}
    </div>
  );
}

/**
 * Au bureau : ces colis partent en avion, dans des paquets de 32 kg. Ce qui
 * est prêt se met en paquet d'un geste ; ce qui y est déjà s'ouvre ; ce qui
 * ne l'est pas encore dit pourquoi (pas pesé…).
 */
function PackCard({ deposit }: { deposit: Deposit }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const tx = usePackageText();
  const labels = useReceptionLabels();
  const [open, setOpen] = useState(false);
  const { ready, blocked } = useMemo(() => packableParcels([deposit]), [deposit]);
  const packages = useMemo(() => {
    const by = new Map<string, string>();
    for (const p of deposit.parcels) if (p.air_package_id) by.set(p.air_package_id, p.package_no ?? '');
    return [...by.entries()].map(([id, no]) => ({ id, no }));
  }, [deposit]);
  if (ready.length === 0 && packages.length === 0 && blocked.length === 0) return null;
  const why = [...new Set(blocked.map((b) => tx.why(b.reason)))].join(' · ');

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <LocationMark location="office" size={40} />
        <span className="min-w-0 flex-1">
          <span className={cn('block', TYPE.lead, TEXT.strong)}>{t('rc_pk_done_title')}</span>
          {ready.length > 0 && (
            <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>
              {ti('rc_pk_done_ready', { parcels: labels.parcels(ready.length), kg: formatKg(sumParcelKg(ready)) })}
            </span>
          )}
          {blocked.length > 0 && (
            <span className={cn('mt-0.5 block', TYPE.smallStrong, TONE_TEXT.pending)}>{ti('rc_pk_done_blocked', { parcels: labels.parcels(blocked.length), why })}</span>
          )}
        </span>
      </div>
      {packages.length > 0 && (
        <div className="space-y-2">
          <p className={cn(TYPE.smallStrong, TONE_TEXT.success)}>{ti('rc_pk_done_packed', { list: packages.map((k) => k.no).join(', ') })}</p>
          {packages.map((k) => (
            <button key={k.id} type="button" onClick={() => navigate(`/r/paquets/${k.id}`)} className={cn('flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 text-left', SURFACE.inset)}>
              <span className={cn('flex-1 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{k.no}</span>
              <span className={cn(TYPE.smallStrong, TEXT.muted)}>{t('rc_pk_open')}</span>
              <ChevronRight className={cn('h-5 w-5', TEXT.muted)} />
            </button>
          ))}
        </div>
      )}
      {ready.length > 0 && (
        <PrimaryPill onClick={() => setOpen(true)} className="h-14 w-full text-[17px]"><PackagePlus /> {t('rc_pk_pack')}</PrimaryPill>
      )}
      <PackSheet open={open} onClose={() => setOpen(false)} items={[...ready, ...blocked]} />
    </Card>
  );
}
