// ============================================================
// L'AVIS D'EXPÉDITION en PDF — un par conteneur (Sea cargo) ou par vol (Air
// cargo, avec ses paquets de 32 kg). Remplace le manifeste jsPDF : même
// contenu, la charte des documents cargo. Une langue (FR | EN), celle des
// documents cargo retenue sur l'appareil. Remise : téléchargé sur
// ordinateur, partagé sur téléphone (saveOrShareFile).
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveOrShareFile, type Outcome } from '@/components/customer-code/exportShippingLabel';
import { readCargoDocLang, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { ShippingNoticePDF, type NoticeTransport } from '@/lib/pdf/templates/ShippingNoticePDF';
import { arrivalPort, bestEta, bestEtd, type CargoShipment } from '@/lib/cargo/model';
import { awbFileRef, awbLabel, type AirParcel, type AirShipment } from '@/lib/airShipment';
import type { ParcelWithDeposit } from '@/lib/reception';
import { NBSP } from '@/lib/pdf/cargoDocFormat';

/** « MSKU 482913-7 · 45G1 » : chaque morceau insécable, la ligne se coupe entre eux. */
const parts = (...xs: Array<string | null | undefined>) => xs.filter(Boolean).map((x) => String(x).replace(/ /g, NBSP)).join(' · ') || null;

/** Le transport d'une boîte, tel que l'avis l'imprime. Dates : réelles si connues, sinon annoncées. */
export function seaNoticeTransport(s: CargoShipment): NoticeTransport {
  const etd = bestEtd(s);
  const eta = bestEta(s).date;
  return {
    mode: 'sea',
    ref: s.container_number,
    idRows: [
      ['container', parts(s.container_number, s.container_iso)],
      ['bl', parts(s.bl_number)],
      ['vessel', parts(s.vessel_name, s.voyage)],
      ['carrier', s.carrier],
    ],
    fromPlace: s.pol_name || 'Guangzhou', fromDate: etd ? etd.toISOString() : null,
    toPlace: arrivalPort(s), toDate: eta ? eta.toISOString() : null,
    notes: s.notes,
  };
}

/** Le transport d'un vol (LTA), tel que l'avis l'imprime. */
export function airNoticeTransport(a: AirShipment): NoticeTransport {
  return {
    mode: 'air',
    ref: a.awb_number,
    idRows: [
      ['airline', a.airline],
      ['flight', parts(a.flight_no)],
    ],
    fromPlace: a.origin, fromDate: a.departed_at ?? a.etd,
    toPlace: a.destination, toDate: a.arrived_at ?? a.eta,
    notes: a.notes,
  };
}

export function noticeFileName(ref: string, lang: CargoDocLang = 'fr'): string {
  return lang === 'en' ? `bonzini-shipping-notice-${ref}.pdf` : `bonzini-avis-expedition-${ref}.pdf`;
}

async function render(el: ReactElement, name: string): Promise<File> {
  const blob = await pdf(el).toBlob();
  return new File([blob], name, { type: 'application/pdf' });
}

export function buildSeaNoticePdf(s: CargoShipment, parcels: ParcelWithDeposit[], lang: CargoDocLang = 'fr', asOf: string = new Date().toISOString()): Promise<File> {
  return render(createElement(ShippingNoticePDF, { transport: seaNoticeTransport(s), parcels: parcels as AirParcel[], asOf, lang }), noticeFileName(s.container_number.replace(/\s+/g, ''), lang));
}

export function buildAirNoticePdf(a: AirShipment, lang: CargoDocLang = 'fr', asOf: string = new Date().toISOString()): Promise<File> {
  return render(createElement(ShippingNoticePDF, { transport: airNoticeTransport(a), parcels: a.parcels ?? [], packages: a.packages ?? [], asOf, lang }), noticeFileName(awbFileRef(a), lang));
}

export async function deliverSeaNoticePdf(s: CargoShipment, parcels: ParcelWithDeposit[], lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildSeaNoticePdf(s, parcels, lang), `Avis d’expédition ${s.container_number}`);
}

export async function deliverAirNoticePdf(a: AirShipment, lang: CargoDocLang = readCargoDocLang()): Promise<Outcome> {
  return saveOrShareFile(await buildAirNoticePdf(a, lang), `Avis d’expédition ${awbLabel(a)}`);
}
