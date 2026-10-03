// ============================================================
// RÉCEPTION — La fiche d'un client, pour ce que le réceptionnaire a le
// droit d'en faire : son code et son QR, l'étiquette colis à réimprimer ou
// à lui envoyer, un nouveau dépôt pour lui, et ses dépôts (les étiquettes
// par colis se réimpriment depuis chaque dépôt terminé). Ni solde, ni
// paiement, ni historique financier.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, ScanLine, Tag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, initials } from '@/lib/reception';
import { customerQrPayload, DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { useClientDeposits, useReceptionClient } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Card, Holder, PrimaryPill, ScreenError, ScreenLoader, SoftPill } from '@/mobile/designKit';
import { DepositRow } from '@/mobile/components/reception/bits';
import { ReceptionLabelSheet } from '@/mobile/components/reception/ReceptionLabelSheet';

export function ReceptionClientCard() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { t } = useLanguage();
  const { data: client, isLoading, error, refetch } = useReceptionClient(userId);
  const { data: deposits } = useClientDeposits(userId, !!userId);
  const { data: settings } = useAdminShippingSettings();
  const [labelOpen, setLabelOpen] = useState(false);

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !client) return <ScreenError title={t('error')} retryLabel={t('rc_retry')} description={(error as Error | null)?.message ?? t('rc_client_not_found')} onRetry={() => void refetch()} />;

  const name = clientFullName(client);
  const goDeposit = () => navigate(`/r/new/how?client=${client.user_id}&name=${encodeURIComponent(name)}&code=${client.customer_code}`);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={client.customer_code} subtitle={name} showBack backTo="/r/clients" />
      <div className="space-y-6 px-5 pb-10 pt-5">
        {/* L'identité et le QR : ce que le réceptionnaire scanne, ce que le client montre. */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <Holder size="lg">{initials(name)}</Holder>
            <span className="min-w-0 flex-1">
              <span className={cn('block break-words', TYPE.title, TEXT.strong)}>{name}</span>
              {client.company_name && <span className={cn('block', TYPE.small, TEXT.muted)}>{client.company_name}</span>}
            </span>
          </div>
          <div className={cn('flex items-center gap-4 border-t pt-4', SURFACE.divider)}>
            <span className={cn('shrink-0 rounded-lg bg-white p-2', 'ring-1 ring-[#D9D9D9] dark:ring-[#444444]')}>
              <QRCodeSVG value={customerQrPayload(client.customer_code)} size={88} level="H" marginSize={0} />
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className={cn('block whitespace-nowrap text-[22px] font-semibold tabular-nums', TEXT.strong)}>{client.customer_code}</span>
              {client.phone && <span className={cn('flex items-center gap-2 tabular-nums', TYPE.body, TEXT.muted)}><Phone className="h-4 w-4 shrink-0" />{client.phone}</span>}
              {(client.city || client.country) && <span className={cn('block', TYPE.small, TEXT.muted)}>{[client.city, client.country].filter(Boolean).join(', ')}</span>}
            </span>
          </div>
        </Card>

        <div className="space-y-3">
          <PrimaryPill onClick={() => setLabelOpen(true)} className="h-14 w-full text-[17px]"><Tag /> {t('rc_client_label')}</PrimaryPill>
          <SoftPill onClick={goDeposit} className="h-14 w-full text-[17px]"><ScanLine /> {t('rc_new_deposit_for')}</SoftPill>
        </div>

        <section>
          <h2 className={cn('mb-3', TYPE.lead, TEXT.strong)}>{t('rc_client_deposits')}</h2>
          {!deposits ? (
            <ScreenLoader />
          ) : deposits.length === 0 ? (
            <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
              <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_no_deposits_yet')}</p>
            </Card>
          ) : (
            <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
              {deposits.map((d) => (
                <DepositRow key={d.id} deposit={d} onClick={() => navigate(d.status === 'open' ? `/r/deposit/${d.id}` : `/r/deposit/${d.id}/done`)} />
              ))}
            </Card>
          )}
        </section>
      </div>

      <ReceptionLabelSheet open={labelOpen} onClose={() => setLabelOpen(false)} client={client} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />
    </div>
  );
}
