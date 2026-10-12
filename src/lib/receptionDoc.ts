// ============================================================
// LE BON DE RÉCEPTION ET DEVIS — ce que le document assemble, sans dessiner :
// le dépôt (ce qu'on a reçu : photos, mesures, état) et, s'il existe, son
// devis (ce que ça coûte). Règle du fondateur (12/10/2026) : « si on a déjà
// mis les prix, tu affiches les prix ; sinon, tu ne les affiches pas ».
//
// Sans devis, on fabrique un devis « à blanc » tiré du dépôt : mêmes lignes,
// sans prix — le gabarit (CargoDocumentsPDF) n'a qu'un seul tableau à tenir.
// Avec un devis, un colis ajouté après coup (sans ligne) s'imprime « À
// chiffrer » et le montant devient provisoire. Fonctions pures, testées.
// ============================================================
import type { PdfPhoto } from '@/lib/pdf/pdfPhotos';
import { defaultBasis, type Quote, type QuoteContainer, type QuoteFlight, type QuoteLine } from '@/lib/cargoQuote';
import { parcelPhotoPaths, sortedParcels, type BroughtBy, type Deposit, type Parcel, type ReceptionCondition } from '@/lib/reception';

/** Les photos d'un colis dans l'annexe du bon : quatre au plus (une rangée). */
export const DOC_PHOTOS_PER_PARCEL = 4;

/** Ce que le bon dit d'un colis en plus de sa ligne : ses photos et son état à la réception. */
export interface ReceptionParcelExtra {
  /** La couverture, en vignette dans le tableau. */
  cover: PdfPhoto | null;
  /** Les photos de l'annexe (chargées), couverture en tête. */
  photos: PdfPhoto[];
  /** Combien de photos le colis a en tout (l'annexe en montre au plus quatre). */
  photoCount: number;
  condition: ReceptionCondition | null;
  conditionNote: string | null;
  /** Le colis n'a pas de ligne au devis (ajouté après) : « À chiffrer ». */
  unpriced: boolean;
}

export interface ReceptionDocData {
  /** Le devis réel, ou un devis à blanc tiré du dépôt. */
  q: Quote;
  hasQuote: boolean;
  /** Des prix sont posés : le tableau montre tarif et montant, le bas de page le montant à régler. */
  priced: boolean;
  broughtBy: BroughtBy | null;
  representative: string | null;
  /** Par colis (id) — null quand le dépôt n'est pas connu (pas de photo, pas d'état). */
  extras: Map<string, ReceptionParcelExtra> | null;
}

/** Une ligne de colis sans prix, tirée du colis. */
function parcelLine(p: Parcel, basis: QuoteLine['basis']): QuoteLine {
  return {
    id: p.id, seq: p.seq, kind: 'parcel', label: '', basis, quantity: null, unit_price_xaf: null, amount_xaf: 0,
    parcel_id: p.id, parcel_no: p.parcel_no, parcel_seq: p.seq, kind_of_parcel: p.kind, description: p.description,
    weight_kg: p.weight_kg, cbm: p.cbm, length_cm: p.length_cm, width_cm: p.width_cm, height_cm: p.height_cm,
    courier_waybill: p.courier_waybill, container_number: p.container_number ?? null, awb_number: p.awb_number ?? null,
  };
}

/** Les conteneurs et vols du dépôt, d'après ses colis (sans dates : le dépôt ne les porte pas). */
function transportsOf(d: Deposit): { containers: QuoteContainer[]; flights: QuoteFlight[] } {
  const containers = [...new Set(d.parcels.map((p) => p.container_number).filter((v): v is string => !!v))].sort();
  const flights = [...new Set(d.parcels.map((p) => p.awb_number).filter((v): v is string => !!v))].sort();
  return {
    containers: containers.map((container_number) => ({ container_number, bl_number: null, carrier: null, vessel_name: null, voyage: null, pol_name: null, pod_name: null, etd: null, eta: null })),
    flights: flights.map((awb_number) => ({ awb_number, airline: null, flight_no: null, origin: null, destination: null, etd: null, eta: null })),
  };
}

/** Le devis à blanc d'un dépôt pas encore chiffré : une ligne par colis, aucun prix. */
export function blankQuoteFromDeposit(d: Deposit): Quote {
  const basis = defaultBasis(d.location);
  return {
    id: `blank-${d.id}`, quote_no: '', deposit_id: d.id, status: 'draft', currency: 'XAF', total_xaf: 0, amount_paid_xaf: 0,
    notes: null, sent_at: null, created_at: d.opened_at, updated_at: d.updated_at ?? d.closed_at ?? d.opened_at,
    deposit_no: d.deposit_no, location: d.location, opened_at: d.opened_at, closed_at: d.closed_at, client: d.client,
    lines: sortedParcels(d.parcels).map((p) => parcelLine(p, basis)), payments: [],
    supplier_kind: d.supplier_kind ?? null, supplier_name: d.supplier_name ?? null, received_by_name: d.received_by_name,
    ...transportsOf(d),
  };
}

/** Les chemins des photos à charger pour le bon : quatre par colis au plus, couverture en tête. */
export function receptionPhotoPaths(d: Pick<Deposit, 'parcels'>): string[] {
  return d.parcels.flatMap((p) => parcelPhotoPaths(p).slice(0, DOC_PHOTOS_PER_PARCEL));
}

/**
 * Assemble le bon. `photos` : ce que loadPdfPhotos a pu charger, par chemin.
 * Un devis sans montant (créé, rien de posé) compte comme « pas de prix ».
 */
export function receptionDocData(d: Deposit | null, quote: Quote | null, photos: ReadonlyMap<string, PdfPhoto> = new Map()): ReceptionDocData {
  const hasQuote = !!quote && quote.lines.length > 0;
  const priced = hasQuote && Number(quote!.total_xaf) > 0;
  let q: Quote;
  if (!d) {
    q = quote as Quote;
  } else if (!hasQuote) {
    q = blankQuoteFromDeposit(d);
  } else {
    // Le devis fait foi ; un colis du dépôt qui n'y a pas de ligne s'ajoute derrière les colis, sans prix.
    const inQuote = new Set(quote!.lines.map((l) => l.parcel_id).filter(Boolean));
    const missing = sortedParcels(d.parcels).filter((p) => !inQuote.has(p.id)).map((p) => parcelLine(p, defaultBasis(d.location)));
    const parcels = quote!.lines.filter((l) => l.kind === 'parcel');
    const others = quote!.lines.filter((l) => l.kind !== 'parcel');
    q = {
      ...quote!,
      lines: [...parcels, ...missing, ...others],
      // Le dépôt connaît mieux ses conteneurs que le devis d'avant la migration : on complète.
      containers: quote!.containers?.length ? quote!.containers : transportsOf(d).containers,
      flights: quote!.flights?.length ? quote!.flights : transportsOf(d).flights,
      supplier_name: quote!.supplier_name ?? d.supplier_name ?? null,
      supplier_kind: quote!.supplier_kind ?? d.supplier_kind ?? null,
      received_by_name: quote!.received_by_name ?? d.received_by_name,
    };
  }
  let extras: Map<string, ReceptionParcelExtra> | null = null;
  if (d) {
    const lined = new Set((quote?.lines ?? []).map((l) => l.parcel_id).filter(Boolean));
    extras = new Map(d.parcels.map((p) => {
      const paths = parcelPhotoPaths(p);
      const loaded = paths.slice(0, DOC_PHOTOS_PER_PARCEL).map((path) => photos.get(path)).filter((x): x is PdfPhoto => !!x);
      return [p.id, {
        cover: paths[0] ? photos.get(paths[0]) ?? null : null,
        photos: loaded,
        photoCount: paths.length,
        condition: p.reception_condition ?? null,
        conditionNote: p.reception_condition_note?.trim() || null,
        unpriced: priced && !lined.has(p.id),
      }];
    }));
  }
  return { q, hasQuote, priced, broughtBy: d?.brought_by ?? null, representative: d?.representative_name ?? null, extras };
}
