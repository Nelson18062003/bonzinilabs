// ============================================================
// RÉCEPTION — les textes des paquets avion (l'état traduit, l'expédition en
// une ligne, « reste X kg », la boîte de scan), partagés par la liste, la
// fiche d'un paquet et l'accueil. Les pièces visuelles : packageBits.tsx.
// ============================================================
import { useTranslation } from 'react-i18next';
import { getCurrentLocale } from '@/i18n';
import { formatKg } from '@/lib/reception';
import { formatAwb, isProvisionalAwb } from '@/lib/airShipment';
import { packageStatusMeta, type AirPackage, type AirPackageStatus, type WeightGauge } from '@/lib/airPackage';
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
  };
}

/** Les textes de la boîte de scan, dans la langue du réceptionnaire. */
export function useScanTexts(hint: string): Partial<ScanBoxTexts> {
  const { t } = useTranslation('agent');
  return { hint, openCamera: t('rc_scan_cam_open'), closeCamera: t('rc_scan_cam_close'), cameraStarting: t('rc_scan_cam_starting'), cameraError: t('rc_scan_cam_error') };
}
