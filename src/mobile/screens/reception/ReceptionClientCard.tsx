// ============================================================
// RÉCEPTION — La fiche d'un client, pour ce que le réceptionnaire a le
// droit d'en faire : son code et son QR, l'étiquette colis à réimprimer ou
// à lui envoyer, un nouveau dépôt pour lui, et ses dépôts (les étiquettes
// par colis se réimpriment depuis chaque dépôt terminé). Ni solde, ni
// paiement, ni historique financier.
// Refonte v2 (maquette 10/47) : le client au centre, son QR et son code,
// deux ronds (Nouveau dépôt · Étiquette), puis ses dépôts.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, Plus, Tag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, formatKg, listDate } from '@/lib/reception';
import { customerQrPayload, DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { useClientDeposits, useReceptionClient } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { ActionCircles, EmptyLine, IconCircle, Initials, ItemList, ItemRow, ScreenLoader, ScreenTop, SectionHead, SURFACE, TEXT } from '@/mobile/designKit';
import { useReceptionLabels } from '@/mobile/components/reception/bits';
import { ReceptionLabelSheet } from '@/mobile/components/reception/ReceptionLabelSheet';
import { useReceptionBack } from '@/mobile/components/reception/useReceptionBack';

export function ReceptionClientCard() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const { userId } = useParams<{ userId: string }>();
  const { t } = useLanguage();
  const { data: client, isLoading, error, refetch } = useReceptionClient(userId);
  const { data: deposits } = useClientDeposits(userId, !!userId);
  const { data: settings } = useAdminShippingSettings();
  const [labelOpen, setLabelOpen] = useState(false);
  const labels = useReceptionLabels();

  // Chargement et erreur gardent l'en-tête et sa flèche : jamais d'écran sans sortie.
  if (isLoading || error || !client) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title={t('rc_client')} onBack={() => back('/r/clients')} />
        {isLoading ? <ScreenLoader /> : <EmptyLine action={{ label: t('rc_retry'), onClick: () => void refetch() }}>{(error as Error | null)?.message ?? t('rc_client_not_found')}</EmptyLine>}
      </div>
    );
  }

  const name = clientFullName(client);
  const goDeposit = () => navigate(`/r/new/how?client=${client.user_id}&name=${encodeURIComponent(name)}&code=${client.customer_code}&from=client`);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <ScreenTop title={t('rc_client')} onBack={() => back('/r/clients')} />
      {/* L'identité et le QR : ce que le réceptionnaire scanne, ce que le client montre. */}
      <div className="flex flex-col items-center px-5 pt-6 text-center">
        <Initials name={name} size={64} />
        <p className={cn('mt-3 text-[22px] font-semibold leading-tight', TEXT.strong)}>{name}</p>
        <p className={cn('mt-0.5 text-[16px] tabular-nums', TEXT.muted)}>{[client.phone, client.company_name].filter(Boolean).join(' · ')}</p>
        <span className="mt-4 rounded-lg border border-[#D9D9D9] bg-white p-3 dark:border-[#444444]">
          <QRCodeSVG value={customerQrPayload(client.customer_code)} size={148} level="H" marginSize={0} />
        </span>
        <p className={cn('mt-3 text-[28px] font-bold tabular-nums tracking-tight', TEXT.strong)}>{client.customer_code}</p>
      </div>
      <ActionCircles
        className="mx-auto w-full max-w-[300px]"
        actions={[
          { label: t('rc_new_deposit'), icon: Plus, onClick: goDeposit },
          { label: t('rc_v2_label'), icon: Tag, onClick: () => setLabelOpen(true), primary: false },
        ]}
      />
      <SectionHead title={t('rc_client_deposits')} />
      {!deposits ? <ScreenLoader /> : deposits.length === 0 ? <EmptyLine>{t('rc_no_deposits_yet')}</EmptyLine> : (
        <ItemList>
          {deposits.map((d) => {
            const st = labels.status(d);
            return (
              <ItemRow
                key={d.id}
                leading={<IconCircle icon={Package} />}
                title={d.deposit_no}
                subtitle={`${listDate(d.opened_at)} · ${labels.parcels(d.parcel_count)} · ${formatKg(d.total_weight_kg)}`}
                tag={{ tone: st.tone === 'info' ? 'pending' : st.tone, label: st.label }}
                onClick={() => navigate(`/r/deposit/${d.id}`)}
              />
            );
          })}
        </ItemList>
      )}

      <ReceptionLabelSheet open={labelOpen} onClose={() => setLabelOpen(false)} client={client} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />
    </div>
  );
}
