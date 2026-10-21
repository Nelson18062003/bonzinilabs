// ============================================================
// RÉCEPTION — Dépôt terminé : le reçu (colis, poids, volume, mode, date,
// qui), et les étiquettes : une page par colis, la même étiquette que
// celle des fournisseurs, avec « 3/10 » dans la case Carton no. et la date
// d'arrivée. Un aperçu, puis le PDF ou l'image se téléchargent ; le partage
// (AirPrint, WeChat) reste possible. Rien d'autre : l'étiquette du client
// est dans sa fiche (Clients), la mise en paquet se fait plus tard, depuis
// l'onglet Paquets.
// Refonte v2 (maquette 10/45) : l'écran de succès, « Dépôt suivant » en noir.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { clientFullName, formatCbm, formatKg } from '@/lib/reception';
import { useReceptionDeposit } from '@/hooks/useReception';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { SuccessView, Tag } from '@/mobile/designKit';
import { DepositLoadState, formatTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { InternalLabelSheet } from '@/mobile/components/reception/InternalLabelSheet';
import { assignPath } from '@/mobile/components/reception/useAssignFlow';
import { useReceptionBack } from '@/mobile/components/reception/useReceptionBack';

export function ReceptionDone() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const { depositId } = useParams<{ depositId: string }>();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading, error, refetch } = useReceptionDeposit(depositId);
  const { data: settings } = useAdminShippingSettings();
  const [internalOpen, setInternalOpen] = useState(false);

  // Chargement et erreur : un en-tête avec sa flèche, jamais un sablier sans fin.
  if (!deposit) { // une relecture ratée en arrière-plan garde l'écran déjà affiché
    return <DepositLoadState title={t('rc_done_title')} onBack={() => back('/r')} isLoading={isLoading} error={error} onRetry={() => void refetch()} />;
  }

  const client = deposit.client ?? null;
  const name = client ? clientFullName(client) : t('rc_unknown_client');
  const count = deposit.parcels.length;
  const receivedAt = deposit.closed_at ?? deposit.opened_at;

  // Le dépôt suivant remplace celui-ci : le retour du téléphone ne revient pas sur un dépôt terminé.
  const nextDeposit = { label: t('rc_next_deposit'), onClick: () => navigate('/r/new', { replace: true }) };
  return (
    <>
      <SuccessView
        title={t('rc_done_title')}
        subtitle={`${deposit.deposit_no} · ${name}${client ? ` · ${t('rc_v2_in_app')}` : ''}`}
        rows={[
          { label: t('rc_parcels'), value: count },
          { label: t('rc_weight'), value: formatKg(deposit.total_weight_kg) },
          { label: t('rc_volume'), value: formatCbm(deposit.total_cbm) },
          { label: t('rc_mode'), value: labels.location(deposit.location) },
          { label: t('rc_brought_by'), value: labels.broughtBy(deposit.brought_by) },
          { label: t('rc_received_by'), value: `${deposit.received_by_name ?? '—'} · ${formatTime(receivedAt)}` },
        ]}
        primary={client ? nextDeposit : { label: t('rc_assign_now'), onClick: () => navigate(assignPath(deposit.id)) }}
        secondary={client ? { label: `${t('rc_print_labels')} (${count})`, onClick: () => setInternalOpen(true) } : nextDeposit}
      >
        {!client && <div className="mt-4 text-center"><Tag tone="pending">{t('rc_status_unassigned')}</Tag></div>}
        <div className="mt-4 text-center">
          <button type="button" onClick={() => back('/r')} className="min-h-11 rounded px-2 text-[16px] font-semibold text-[#5A5A5A] underline underline-offset-[3px] dark:text-[#CDCDCD]">{t('rc_done_finish')}</button>
        </div>
      </SuccessView>
      {client && <InternalLabelSheet open={internalOpen} onClose={() => setInternalOpen(false)} deposit={deposit} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} />}
    </>
  );
}
