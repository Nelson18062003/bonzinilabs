// ============================================================
// RÉCEPTION — les textes des paquets avion (l'état traduit, l'expédition en
// une ligne, « reste X kg », la boîte de scan), partagés par la liste, la
// fiche d'un paquet et l'accueil. Les pièces visuelles : packageBits.tsx.
// ============================================================
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { getCurrentLocale } from '@/i18n';
import { formatKg } from '@/lib/reception';
import { formatAwb, isProvisionalAwb } from '@/lib/airShipment';
import { packageStatusMeta, type AirPackage, type AirPackageStatus, type PackBlock, type PackRefusal, type WeightGauge } from '@/lib/airPackage';
import type { Deposit, Parcel } from '@/lib/reception';
import type { ScanBoxTexts } from '@/mobile/components/cargo/ParcelScanBox';
import type { Tone } from '@/mobile/designKit';

/** La couleur de la jauge : vert, ambre, puis rouge quand il ne rentre plus rien. */
export const GAUGE_TONE: Record<WeightGauge['tone'], Tone> = { ok: 'success', near: 'pending', full: 'danger' };

/** « jeu. 08/10 » : la date de départ prévue (colonne DATE), dans la langue de l'écran. */
export function formatEtd(etd: string): string {
  const d = new Date(`${etd.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? etd : d.toLocaleDateString(getCurrentLocale(), { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function usePackageText() {
  const { t } = useTranslation('agent');
  return {
    status: (s: AirPackageStatus): { tone: Tone; label: string } => ({ tone: packageStatusMeta(s).tone, label: t(`rc_pk_st_${s}`) }),
    clients: (n: number) => t('rc_pk_n_clients', { count: n }),
    /** « LTA 071-12345675 · Vol ET 607 · départ jeu. 08/10 » — null hors expédition. */
    expedition: (p: Pick<AirPackage, 'air_shipment_id' | 'awb_number' | 'flight_no' | 'etd'>): string | null => {
      if (!p.air_shipment_id) return null;
      const parts = [p.awb_number && !isProvisionalAwb(p.awb_number) ? t('rc_pk_awb', { awb: formatAwb(p.awb_number) }) : t('rc_pk_awb_pending')];
      if (p.flight_no) parts.push(t('rc_pk_flight', { flight: p.flight_no }));
      if (p.etd) parts.push(t('rc_pk_etd', { date: formatEtd(p.etd) }));
      return parts.join(' · ');
    },
    /** « reste 13,6 kg » ou « Plein ». */
    left: (g: WeightGauge) => (g.tone === 'full' ? t('rc_pk_full') : t('rc_pk_left', { kg: formatKg(g.left) })),
    /** Pourquoi un colis n'entre pas dans un paquet — et quoi faire : « pas pesé : pesez-le ». */
    why: (reason: PackRefusal, parcel?: Pick<Parcel, 'package_no'>): string =>
      reason === 'packed'
        ? (parcel?.package_no ? t('rc_pk_why_packed', { no: parcel.package_no }) : t('rc_pk_why_packed_any'))
        : t(`rc_pk_why_${reason}`),
  };
}

/** Les textes de la boîte de scan, dans la langue du réceptionnaire. */
export function useScanTexts(hint: string): Partial<ScanBoxTexts> {
  const { t } = useTranslation('agent');
  return { hint, openCamera: t('rc_scan_cam_open'), closeCamera: t('rc_scan_cam_close'), cameraStarting: t('rc_scan_cam_starting'), cameraError: t('rc_scan_cam_error') };
}

/**
 * « ouvert par Nelson » — seulement quand c'est quelqu'un d'autre : un paquet
 * préparé depuis l'ordinateur (ou par un collègue) se reconnaît d'un coup d'œil.
 */
export function useOpenedBy(pkg: Pick<AirPackage, 'created_by' | 'created_by_name'>): string | null {
  const { t } = useTranslation('agent');
  const { currentUser } = useAdminAuth();
  if (!pkg.created_by_name || !pkg.created_by || pkg.created_by === currentUser?.id) return null;
  return t('rc_pk_by', { name: pkg.created_by_name });
}

/**
 * Où compléter un colis qui n'est pas encore prêt pour un paquet — null : rien
 * à faire ici (plus de 32 kg : il part seul), ou ce n'est pas à moi (le serveur
 * ne laisse corriger un dépôt qu'à celui qui l'a reçu, ou à l'équipe cargo).
 * Un dépôt sans client s'attribue, lui, par n'importe quel réceptionnaire.
 */
export function usePackFix() {
  const { currentUser, hasPermission } = useAdminAuth();
  return (it: { parcel: Pick<Parcel, 'id'>; deposit: Pick<Deposit, 'id' | 'received_by'>; reason: PackBlock }): string | null => {
    if (it.reason === 'no_client') return `/r/new?assign=${it.deposit.id}`;
    if (it.reason === 'too_heavy') return null;
    if (it.deposit.received_by !== currentUser?.id && !hasPermission('canManageCargo')) return null;
    if (it.reason === 'deposit_open') return `/r/deposit/${it.deposit.id}`;
    return `/r/deposit/${it.deposit.id}/parcel/${it.parcel.id}?step=weight`; // droit à la pesée
  };
}
