// ============================================================
// LES DOCUMENTS CARGO — devis, reçu, facture acquittée — sur le modèle de la
// « Packing List client » que le fondateur a validée le 01/10/2026 (session
// « Date de chargement modification », PL de Dolice, conteneur MIEU3611115) :
//
//   · en-tête sur chaque page : le logo bien visible, NORTON GAUSS BONZINI
//     SARL, « Bonzini Trading Cargo · Air Cargo · Sea Cargo » en violet,
//     capital / RCCM / NIU / siège / téléphones ; à droite le titre, la
//     référence, la date ; dessous, la barre tricolore du logo ;
//   · fond blanc, texte noir, sections encadrées « 1.  CLIENT » sur fond
//     gris souligné de violet ; aéré (« il ne faut pas squeeze ») ;
//   · une seule signification par couleur : violet = identité et structure
//     (identifiant Bonzini, lignes de total, ce qui est réglé) ; ambre =
//     dates estimées (arrivée) ; orange = ce que le client doit faire (le
//     montant à régler) et ce qui manque (« À créer », « À mesurer ») ;
//   · « Vos marchandises » (la section que le fondateur a jugée parfaite) :
//     une ligne par colis avec ses mesures, la ligne de total, et juste
//     dessous le montant à régler, en chiffres ET en lettres, la référence
//     à rappeler sur tout paiement — pas de « décompte » à part — puis, pour
//     la société, le lieu, la date et un CACHET dessiné (pas de signature
//     client) ;
//   · au verso : conditions générales, modes de règlement, nos adresses.
//
// Chaque document sort EN UNE SEULE LANGUE (français ou anglais) : titres,
// colonnes, conditions, dates, montants (« 1 234 567 » / « 1,234,567 »),
// montant en lettres, pays. Seul ce que l'équipe a tapé (désignations,
// frais, notes) reste tel qu'écrit.
//
// Pièges du moteur (react-pdf), ici contournés — voir aussi cargoDocFormat.ts :
//   · `wrap={undefined}` vaut « insécable » (il lit `'wrap' in props`) ;
//   · une marge BASSE compte pour décider du saut de page : un bloc qui tient
//     mais dont la marge ne tient pas part en entier à la page suivante. Les
//     écarts entre sections sont donc des marges HAUTES ;
//   · un glyphe absent de la police (« − », « → ») fait basculer la mesure
//     sur Helvetica et désaligne toute la page.
// ============================================================
import type { ComponentProps, ReactNode } from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { PdfLogo } from '../components/PDFHeader';
import '../fonts';
import {
  DOC_TZ, NBSP, PLACE_TZ, addDays, clampLines, commonRate, contactLine, countLabel, docDateTime, docDay, fontFor, kg, m3, money, pdfSafe, rateUnit, splitZh, wrapText, xaf,
} from '../cargoDocFormat';
import type { PaymentMethod, PaymentPlace, Quote, QuoteLine, QuotePayment } from '@/lib/cargoQuote';
import { activePayments, lineNeedsMeasure, quoteBalance, quotePaid } from '@/lib/cargoQuote';
import { clientFullName } from '@/lib/reception';
import type { ShippingSettings } from '@/lib/customerCode';
import { CARGO_COMPANY, companyBankAccounts } from '@/lib/companyIdentity';
import { xafInWords } from '@/lib/amountInWords';
import { countryName, isoFromCountryLabel } from '@/data/countries';
import { formatAwb } from '@/lib/airShipment';

export type CargoDocLang = 'fr' | 'en';

// ── La palette de la packing list (build5.py) ──
const C = {
  violet: '#7A33FF', violetTint: '#F1EAFF',
  amber: '#F3A745', amberText: '#B26A00',
  orange: '#FE560D', orangeTint: '#FFE9DE',
  black: '#111111', grey: '#4B5563', rule: '#D1D5DB', headBg: '#F3F4F6', white: '#FFFFFF',
};
const MM = 2.8346;
const MARGIN = 15 * MM;
const PAD = 8;
const GAP = 14;

// Pas de césure : la coupure par défaut (anglaise) écrivait « Nko-lo », « mar-chandise ». Un mot passe entier à la ligne.
const keepWords = (word: string) => [word];
function T(props: ComponentProps<typeof Text>) {
  return <Text hyphenationCallback={keepWords} {...props} />;
}

const st = StyleSheet.create({
  page: { fontFamily: 'DM Sans', fontSize: 10, color: C.black, backgroundColor: C.white, paddingTop: 48 * MM, paddingBottom: 20 * MM, paddingHorizontal: MARGIN },
  // en-tête (chaque page)
  header: { position: 'absolute', top: 10 * MM, left: MARGIN, right: MARGIN },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  company: { marginLeft: 5 * MM, flexGrow: 1 },
  coName: { fontSize: 16, fontWeight: 700 },
  coTrade: { fontSize: 9.5, fontWeight: 700, color: C.violet, marginTop: 3 },
  coLine: { fontSize: 8.5, marginTop: 2.5 },
  headRight: { position: 'absolute', top: 0, right: 0, width: 62 * MM, alignItems: 'flex-end' },
  docTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textAlign: 'right' },
  docMeta: { fontSize: 9, marginTop: 3, textAlign: 'right' },
  bar: { flexDirection: 'row', height: 1.6 * MM, marginTop: 2.5 * MM },
  // pied (chaque page)
  footer: { position: 'absolute', bottom: 7 * MM, left: MARGIN, right: MARGIN, borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 2.5 * MM, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontSize: 8 },
  footPage: { fontSize: 8.5, fontWeight: 500 },
  // titre du document
  title: { fontSize: 20, fontWeight: 700 },
  subtitle: { fontSize: 11, color: C.grey, marginTop: 2 },
  // sections encadrées
  section: { borderWidth: 0.8, borderColor: C.rule },
  secHead: { backgroundColor: C.headBg, paddingHorizontal: PAD, paddingVertical: 6, borderBottomWidth: 1.2, borderBottomColor: C.violet },
  secTitle: { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 },
  secBody: { padding: PAD },
  // liste clé / valeur
  kvRow: { flexDirection: 'row', paddingVertical: 3.5, borderBottomWidth: 0.4, borderBottomColor: C.rule },
  kvLabel: { width: '40%', fontSize: 9, fontWeight: 500, color: C.grey, paddingRight: 4, paddingTop: 1.5 },
  kvValueBox: { width: '60%' },
  kvValue: { fontSize: 10.5, fontWeight: 700 },
  kvZh: { fontSize: 8.5, color: C.grey, fontFamily: 'Noto Sans SC', marginTop: 1.5 },
  // tableau
  th: { flexDirection: 'row', backgroundColor: C.headBg, borderBottomWidth: 0.8, borderBottomColor: C.black },
  thc: { fontSize: 8.5, fontWeight: 700, paddingVertical: 6, paddingHorizontal: 5 },
  thUnit: { fontSize: 7.5, fontWeight: 500, color: C.grey, marginTop: 1 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: C.rule, alignItems: 'center' },
  td: { fontSize: 9.5, paddingVertical: 5, paddingHorizontal: 5 },
  tdSub: { fontSize: 8.5, color: C.grey, marginTop: 1.5 },
  total: { flexDirection: 'row', backgroundColor: C.violetTint, borderTopWidth: 0.8, borderTopColor: C.black, alignItems: 'center' },
  // bandeau montant
  band: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, paddingVertical: 6, paddingLeft: 9, paddingRight: 8 },
  bandLabel: { fontSize: 10.5, fontWeight: 700 },
  bandSub: { fontSize: 9, color: C.grey, marginTop: 2 },
  bandAmount: { fontSize: 18, fontWeight: 700, textAlign: 'right' },
  bandWords: { fontSize: 9, color: C.grey, textAlign: 'right', marginTop: 1.5 },
  body: { fontSize: 10 },
  grey: { fontSize: 9.5, color: C.grey, lineHeight: 1.4 },
  note: { fontSize: 9, fontWeight: 500, marginTop: 4 },
  // signature : pour la société, lieu, date, cachet
  signRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stampOuter: { width: 60 * MM, minHeight: 27 * MM, borderWidth: 1.6, borderColor: C.violet, borderRadius: 3 * MM, padding: 1.4 * MM, transform: 'rotate(-3deg)' },
  stampInner: { flexGrow: 1, borderWidth: 0.6, borderColor: C.violet, borderRadius: 2 * MM, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 3 },
  stampName: { fontSize: 9.3, fontWeight: 700, color: C.violet, letterSpacing: 0.2, textAlign: 'center' },
  stampTrade: { fontSize: 7, fontWeight: 500, color: C.violet, marginTop: 1.5, textAlign: 'center' },
  stampRule: { width: '82%', borderBottomWidth: 0.5, borderBottomColor: C.violet, marginVertical: 3 },
  stampLine: { fontSize: 6.6, color: C.violet, marginTop: 0.5, textAlign: 'center' },
  stampDate: { fontSize: 8.6, fontWeight: 700, color: C.violet, marginTop: 3, textAlign: 'center' },
  // verso
  condRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.4, borderBottomColor: C.rule },
  condNo: { width: 7 * MM, fontSize: 8.8, fontWeight: 700 },
  condText: { flex: 1, fontSize: 8.8, lineHeight: 1.3 },
  addrCol: { paddingHorizontal: 9 },
  addrTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 3 },
  addrLine: { fontSize: 9, lineHeight: 1.35 },
  addrZh: { fontSize: 8.5, color: C.grey, lineHeight: 1.4, fontFamily: 'Noto Sans SC', marginTop: 2 },
});

// ── Tout ce que les documents écrivent, dans les deux langues ──
type Kinds = Record<string, readonly [string, string]>;
const TXT = {
  fr: {
    hTitleQuote: 'DEVIS DE FRET', hTitleReceipt: 'REÇU DE PAIEMENT', hTitleInvoice: 'FACTURE ACQUITTÉE',
    ref: 'Réf.', issued: 'Émis le', issuedInvoice: 'Émise le',
    titleQuote: { warehouse: 'Devis de fret maritime', office: 'Devis de fret aérien' },
    titleReceipt: 'Reçu de paiement', titleInvoice: 'Facture acquittée', quoteWord: 'Devis',
    capital: 'SARL au capital de', tel: 'Tél.',
    secClient: 'Client', secShipment: 'Expédition', secGoods: 'Vos marchandises',
    secPayment: 'Paiement reçu', secSituation: 'Situation du devis', secSettlements: 'Règlements',
    secConditions: 'Conditions générales de service', secHowToPay: 'Modes de règlement', secAddresses: 'Nos adresses',
    name: 'Nom', company: 'Société', bonziniId: 'Identifiant Bonzini', phone: 'Téléphone', city: 'Ville', account: 'Compte',
    toAssign: 'À attribuer', toCreate: 'À créer', toFill: 'À renseigner',
    deposit: 'Dépôt', mode: 'Mode', reception: 'Réception', receivedBy: 'Reçu par', supplier: 'Fournisseur', buyingAgent: 'Agent d’achat',
    container: 'Conteneur', vessel: 'Navire', flight: 'Vol', awb: 'LTA', eta: 'Arrivée estimée', arrived: 'Arrivée', etaPending: 'À confirmer',
    modeSea: 'Sea Cargo — Groupage', modeAir: 'Air Cargo',
    atWarehouse: 'Entrepôt de Guangzhou', atOffice: 'Bureau de Guangzhou',
    parcelsN: (n: number) => `${n}${NBSP}colis`,
    colNo: 'N°', colLabel: 'Désignation', colDims: 'Dimensions', colWeight: 'Poids', colVolume: 'Volume', colRate: 'Tarif', colAmount: 'Montant', colAmountXaf: 'Montant (XAF)',
    perUnit: (u: string) => `par ${u}`, billedOn: (q: string) => `facturé sur ${q}`,
    flat: 'Forfait', fee: 'Frais', discount: 'Remise', total: 'Total', toMeasure: 'À mesurer',
    kind: { carton: ['carton', 'cartons'], bag: ['sac', 'sacs'], bale: ['ballot', 'ballots'], roll: ['rouleau', 'rouleaux'], pallet: ['palette', 'palettes'], other: ['colis', 'colis'] } as Kinds,
    kindLabel: { carton: 'Carton', bag: 'Sac', bale: 'Ballot', roll: 'Rouleau', pallet: 'Palette', other: 'Colis' } as Record<string, string>,
    parcel: 'Colis', waybill: 'suivi',
    toPay: 'Montant à régler', provisional: 'Montant provisoire', balanceProvisional: 'Reste à régler (provisoire)', balanceToPay: 'Reste à régler', settled: 'Devis réglé', amountPaid: 'Montant réglé', amountReceived: 'Montant reçu',
    totalAndPaid: (total: string, paid: string) => `Total du devis ${total} · déjà réglé ${paid}`,
    pendingMeasure: (n: number) => `${n} colis à peser ou mesurer : le montant sera complété après la mesure.`,
    payRef: (ref: string) => ['Référence à rappeler sur tout paiement : ', ref, '.'],
    validity: (d: string) => `Devis valable 30 jours, jusqu’au ${d}. Le règlement intégral conditionne la remise de la marchandise.`,
    forCompany: 'Pour Norton Gauss Bonzini SARL',
    placeDate: (place: string | null, d: string) => (place ? `${place}, le${NBSP}${d}` : `Le${NBSP}${d}`),
    quoteFootnote: 'Ce devis tient lieu de décompte de fret pour le retrait à Douala.',
    receiptFootnote: 'Conservez ce reçu : il prouve votre paiement jusqu’au retrait de la marchandise.',
    invoiceFootnote: (ref: string | null) => `Facture acquittée : aucun montant ne reste dû sur ce dépôt. Les colis sont remis sur présentation ${ref ? `de la référence ${ref}` : 'de l’identifiant Bonzini'}.`,
    fullyPaid: (ref: string | null) => `Devis entièrement réglé : les colis sont remis sur présentation ${ref ? `de la référence ${ref}` : 'de l’identifiant Bonzini'}.`,
    releaseWhenPaid: 'Le règlement intégral conditionne la remise de la marchandise.',
    stampTrade: 'Bonzini Trading Cargo · Air Cargo · Sea Cargo', stampPaid: 'ACQUITTÉE',
    method: { cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', wallet: 'Solde Bonzini', other: 'Autre' } as Record<PaymentMethod, string>,
    place: { guangzhou: 'Guangzhou, avant le départ', douala: 'Douala, au retrait', other: 'Ailleurs' } as Record<PaymentPlace, string>,
    placeWallet: 'Application Bonzini',
    placeCity: { guangzhou: 'Guangzhou', douala: 'Douala', other: null } as Record<PaymentPlace, string | null>,
    localTime: (place: PaymentPlace): string => (place === 'guangzhou' ? 'heure de Guangzhou' : 'heure de Douala'),
    payMode: 'Mode', payRefLabel: 'Référence', payPlace: 'Lieu', payDate: 'Date', payBy: 'Encaissé par',
    colReceipt: 'Reçu', colDate: 'Date', colMethod: 'Mode', colPlace: 'Lieu', thisReceipt: 'ce reçu',
    bankName: 'Banque', iban: 'IBAN', swift: 'SWIFT',
    bankHolder: (name: string) => `Titulaire : ${name}. `,
    otherWays: (ref: string) => `Également : Mobile Money, espèces à nos bureaux de Guangzhou ou de Douala, ou débit de votre solde Bonzini (sur demande). Rappelez la référence ${ref} sur tout paiement.`,
    addrDouala: 'Douala — siège et retrait', addrOffice: `Guangzhou — bureau (Air${NBSP}Cargo)`, addrWarehouse: `Guangzhou — entrepôt (Sea${NBSP}Cargo)`,
    pickupOffice: 'Bureau de Douala',
    conditions: (where: string) => [
      'Le client dispose de 3 jours ouvrés après l’arrivée de la marchandise à Douala pour en prendre possession. Passé ce délai, des frais de magasinage sont appliqués au moment du retrait.',
      'N.G.B SARL n’est en aucun cas responsable des marchandises contrefaites : le propriétaire en porte l’entière responsabilité.',
      'Les marchandises abandonnées dans nos entrepôts au-delà de 2 mois sont vendues aux enchères afin de couvrir les frais engagés par l’entreprise.',
      'Nous ne transportons ni matériel militaire ni produits assimilés. Toute violation de la présente clause fait l’objet d’une dénonciation aux autorités.',
      'Les colis fragiles non protégés voyagent aux risques du client : aucune responsabilité n’est assumée en cas de dommage.',
      'Les montants s’entendent pour une livraison à Douala. Pour les autres villes (Yaoundé, Buea, Bamenda, Bafoussam…), le transport intérieur se négocie au Cameroun.',
      `Les poids et volumes sont ceux mesurés à notre ${where}. Le règlement intégral conditionne la remise de la marchandise.`,
    ],
    whereWarehouse: 'entrepôt de Guangzhou', whereOffice: 'bureau de Guangzhou',
    footer: (dep: string) => `Dépôt ${dep}`,
    page: (n: number, total: number) => `Page ${n} / ${total}`,
  },
  en: {
    hTitleQuote: 'FREIGHT QUOTE', hTitleReceipt: 'PAYMENT RECEIPT', hTitleInvoice: 'PAID INVOICE',
    ref: 'Ref.', issued: 'Issued', issuedInvoice: 'Issued',
    titleQuote: { warehouse: 'Sea freight quote', office: 'Air freight quote' },
    titleReceipt: 'Payment receipt', titleInvoice: 'Paid invoice', quoteWord: 'Quote',
    capital: 'SARL with a share capital of', tel: 'Tel.',
    secClient: 'Customer', secShipment: 'Shipment', secGoods: 'Your goods',
    secPayment: 'Payment received', secSituation: 'Quote status', secSettlements: 'Payments',
    secConditions: 'General terms of service', secHowToPay: 'How to pay', secAddresses: 'Our addresses',
    name: 'Name', company: 'Company', bonziniId: 'Bonzini ID', phone: 'Phone', city: 'City', account: 'Account',
    toAssign: 'To be assigned', toCreate: 'To be created', toFill: 'To be provided',
    deposit: 'Deposit', mode: 'Mode', reception: 'Received', receivedBy: 'Received by', supplier: 'Supplier', buyingAgent: 'Buying agent',
    container: 'Container', vessel: 'Vessel', flight: 'Flight', awb: 'AWB', eta: 'Estimated arrival', arrived: 'Arrival', etaPending: 'To be confirmed',
    modeSea: 'Sea Cargo — LCL', modeAir: 'Air Cargo',
    atWarehouse: 'Guangzhou warehouse', atOffice: 'Guangzhou office',
    parcelsN: (n: number) => `${n}${NBSP}parcel${n === 1 ? '' : 's'}`,
    colNo: 'No.', colLabel: 'Description', colDims: 'Dimensions', colWeight: 'Weight', colVolume: 'Volume', colRate: 'Rate', colAmount: 'Amount', colAmountXaf: 'Amount (XAF)',
    perUnit: (u: string) => `per ${u}`, billedOn: (q: string) => `billed on ${q}`,
    flat: 'Flat rate', fee: 'Fee', discount: 'Discount', total: 'Total', toMeasure: 'To be measured',
    kind: { carton: ['carton', 'cartons'], bag: ['bag', 'bags'], bale: ['bale', 'bales'], roll: ['roll', 'rolls'], pallet: ['pallet', 'pallets'], other: ['parcel', 'parcels'] } as Kinds,
    kindLabel: { carton: 'Carton', bag: 'Bag', bale: 'Bale', roll: 'Roll', pallet: 'Pallet', other: 'Parcel' } as Record<string, string>,
    parcel: 'Parcel', waybill: 'tracking',
    toPay: 'Amount due', provisional: 'Provisional amount', balanceProvisional: 'Balance due (provisional)', balanceToPay: 'Balance due', settled: 'Quote paid', amountPaid: 'Amount paid', amountReceived: 'Amount received',
    totalAndPaid: (total: string, paid: string) => `Quote total ${total} · already paid ${paid}`,
    pendingMeasure: (n: number) => `${n} parcel${n === 1 ? '' : 's'} still to be weighed or measured: the amount will be updated once they are measured.`,
    payRef: (ref: string) => ['Include this reference with every payment: ', ref, '.'],
    validity: (d: string) => `Quote valid for 30 days, until ${d}. Goods are released upon full payment.`,
    forCompany: 'For Norton Gauss Bonzini SARL',
    placeDate: (place: string | null, d: string) => (place ? `${place}, ${d}` : d),
    quoteFootnote: 'This quote serves as the freight statement for collection in Douala.',
    receiptFootnote: 'Keep this receipt: it proves your payment until the goods are collected.',
    invoiceFootnote: (ref: string | null) => `Paid invoice: nothing remains due on this deposit. Parcels are released on presentation of ${ref ? `reference ${ref}` : 'the Bonzini ID'}.`,
    fullyPaid: (ref: string | null) => `Quote paid in full: parcels are released on presentation of ${ref ? `reference ${ref}` : 'the Bonzini ID'}.`,
    releaseWhenPaid: 'Goods are released upon full payment.',
    stampTrade: 'Bonzini Trading Cargo · Air Cargo · Sea Cargo', stampPaid: 'PAID',
    method: { cash: 'Cash', mobile_money: 'Mobile Money', bank_transfer: 'Bank transfer', wallet: 'Bonzini balance', other: 'Other' } as Record<PaymentMethod, string>,
    place: { guangzhou: 'Guangzhou, before departure', douala: 'Douala, on collection', other: 'Elsewhere' } as Record<PaymentPlace, string>,
    placeWallet: 'Bonzini app',
    placeCity: { guangzhou: 'Guangzhou', douala: 'Douala', other: null } as Record<PaymentPlace, string | null>,
    localTime: (place: PaymentPlace): string => (place === 'guangzhou' ? 'Guangzhou time' : 'Douala time'),
    payMode: 'Method', payRefLabel: 'Reference', payPlace: 'Place', payDate: 'Date', payBy: 'Cashier',
    colReceipt: 'Receipt', colDate: 'Date', colMethod: 'Method', colPlace: 'Place', thisReceipt: 'this receipt',
    bankName: 'Bank', iban: 'IBAN', swift: 'SWIFT',
    bankHolder: (name: string) => `Account holder: ${name}. `,
    otherWays: (ref: string) => `Also: Mobile Money, cash at our Guangzhou or Douala offices, or a debit from your Bonzini balance (on request). Include reference ${ref} with every payment.`,
    addrDouala: 'Douala — head office and collection', addrOffice: `Guangzhou — office (Air${NBSP}Cargo)`, addrWarehouse: `Guangzhou — warehouse (Sea${NBSP}Cargo)`,
    pickupOffice: 'Douala office',
    conditions: (where: string) => [
      'The customer has 3 working days after the goods arrive in Douala to collect them. After that, storage fees are charged on collection.',
      'N.G.B SARL is in no way liable for counterfeit goods: their owner bears full responsibility.',
      'Goods left in our warehouses for more than 2 months are auctioned to cover the costs incurred by the company.',
      'We do not carry military equipment or similar goods. Any breach of this clause is reported to the authorities.',
      'Unprotected fragile parcels travel at the customer’s risk: no liability is accepted for damage.',
      'Amounts are for delivery in Douala. For other cities (Yaoundé, Buea, Bamenda, Bafoussam…), inland transport is negotiated in Cameroon.',
      `Weights and volumes are those measured at our ${where}. Goods are released upon full payment.`,
    ],
    whereWarehouse: 'Guangzhou warehouse', whereOffice: 'Guangzhou office',
    footer: (dep: string) => `Deposit ${dep}`,
    page: (n: number, total: number) => `Page ${n} / ${total}`,
  },
};
type Txt = (typeof TXT)['fr'];

/** Un colis sans description prend son TYPE, traduit — jamais la valeur brute de la base (« bag »). */
const lineLabel = (l: QuoteLine, t: Txt) =>
  l.kind === 'parcel' ? (l.description || l.label || (l.kind_of_parcel ? t.kindLabel[l.kind_of_parcel] ?? t.parcel : t.parcel)) : l.label;

/** Le pays du client, enregistré en français (« Cameroun », « RD Congo ») ; en anglais pour un document anglais. */
const countryIn = (c: string | null | undefined, lang: CargoDocLang) => {
  if (!c || lang !== 'en') return c;
  const iso = isoFromCountryLabel(c);
  return iso ? countryName(iso, 'en') : c;
};

/** Le texte TAPÉ et sa police : ramené aux glyphes des polices (pdfSafe), coupé pour sa colonne, au plus `maxLines` lignes. */
const fitted = (s: string | null | undefined, width: number, size: number, maxLines = 6) => {
  const safe = pdfSafe(s);
  return { text: clampLines(safe, width, size, maxLines), font: fontFor(safe) };
};
/** Un numéro et son libellé ne se séparent pas : « B/L MAEU 2261 8834 ». */
const nb = (s: string) => s.replace(/ /g, NBSP);
/** « A · B · C » : le point reste collé au mot qui le précède. */
const dots = (parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(`${NBSP}· `);

// ============================================================
// Le cadre de chaque page : en-tête, barre tricolore, pied
// ============================================================
function Header({ title, reference, issuedLabel, issuedOn, lang }: { title: string; reference: string; issuedLabel: string; issuedOn: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const co = CARGO_COMPANY;
  return (
    <View style={st.header} fixed>
      <View style={st.headRow}>
        <PdfLogo size={24 * MM} tight />
        <View style={st.company}>
          <T style={st.coName}>{co.legalName}</T>
          <T style={st.coTrade}>{co.tradeName}{'   ·   '}{co.activities[lang]}</T>
          <T style={[st.coLine, { marginTop: 4 }]}>{t.capital} {co.capital[lang]}{'   ·   '}RCCM {co.rccm}</T>
          <T style={st.coLine}>NIU {co.niu}{'   ·   '}{co.seat[lang]}</T>
          <T style={st.coLine}>{t.tel} {co.phonesCameroon.join(' · ')}{'   ·   '}{co.email}</T>
        </View>
        <View style={st.headRight}>
          <T style={st.docTitle}>{title}</T>
          <T style={[st.docMeta, { marginTop: 5 }]}>{t.ref} {reference}</T>
          <T style={st.docMeta}>{issuedLabel} {issuedOn}</T>
        </View>
      </View>
      <View style={st.bar}>
        <View style={{ flex: 1, backgroundColor: C.violet }} />
        <View style={{ flex: 1, backgroundColor: C.amber }} />
        <View style={{ flex: 1, backgroundColor: C.orange }} />
      </View>
    </View>
  );
}

function Footer({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  return (
    <View style={st.footer} fixed>
      <T style={st.footText}>{CARGO_COMPANY.tradeName}  —  {CARGO_COMPANY.legalName}  ·  {CARGO_COMPANY.email}  ·  {t.footer(q.deposit_no)}</T>
      <T style={st.footPage} render={({ pageNumber, totalPages }) => t.page(pageNumber, totalPages)} />
    </View>
  );
}

function Shell({ q, lang, headTitle, reference, issuedLabel, issuedOn, children }: { q: Quote; lang: CargoDocLang; headTitle: string; reference: string; issuedLabel: string; issuedOn: string; children: ReactNode }) {
  return (
    <Document language={lang} title={`${headTitle} ${reference}`} author={CARGO_COMPANY.legalName} subject={TXT[lang].footer(q.deposit_no)}>
      <Page size="A4" style={st.page}>
        <Header title={headTitle} reference={reference} issuedLabel={issuedLabel} issuedOn={issuedOn} lang={lang} />
        {children}
        <Footer q={q} lang={lang} />
      </Page>
    </Document>
  );
}

// ============================================================
// Les briques
// ============================================================
function DocHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ marginBottom: GAP }}>
      <T style={st.title}>{title}</T>
      <T style={st.subtitle}>{subtitle}</T>
    </View>
  );
}

function Section({ n, title, children, flush = false, style, wrap }: { n: number; title: string; children: ReactNode; flush?: boolean; style?: Style; wrap?: boolean }) {
  return (
    // `wrap` seulement s'il est donné : react-pdf lit `'wrap' in props`, et wrap={undefined} rendait la section insécable.
    <View style={[st.section, ...(style ? [style] : [])]} {...(wrap === undefined ? {} : { wrap })}>
      <View style={st.secHead} wrap={false} minPresenceAhead={70}><T style={st.secTitle}>{n}.  {title.toUpperCase()}</T></View>
      <View style={flush ? undefined : st.secBody}>{children}</View>
    </View>
  );
}

type Tone = 'violet' | 'orange' | 'amber' | 'muted';
/** Une valeur simple, ou une liste [repère, valeur] quand il y a plusieurs conteneurs ou vols (le repère en gris au-dessus). */
type KvVal = string | Array<[id: string, value: string, tone?: Tone]>;
type Kv = [label: string, value: KvVal, tone?: Tone];
const TONE: Record<Tone, Style> = { violet: { color: C.violet }, orange: { color: C.orange }, amber: { color: C.amberText }, muted: { color: C.grey, fontWeight: 500 } };

/** Une valeur : le latin en gras (DM Sans), le chinois en ligne grise dessous — comme les noms de produits de la packing list. */
function KvValue({ value, tone }: { value: KvVal; tone?: Tone }) {
  if (Array.isArray(value)) {
    return (
      <View style={st.kvValueBox}>
        {value.map(([id, v, own], i) => (
          <View key={`${id}-${i}`} style={i ? { marginTop: 3 } : undefined}>
            <T style={[st.kvZh, { fontFamily: 'DM Sans', marginTop: 0 }]}>{id}</T>
            <T style={[st.kvValue, ...((own ?? tone) ? [TONE[(own ?? tone) as Tone]] : [])]}>{fitted(v, 134, 10.5, 2).text}</T>
          </View>
        ))}
      </View>
    );
  }
  const { main, zh } = splitZh(pdfSafe(value));
  // Au plus 3 lignes pour un texte tapé ; une valeur déjà mise en lignes (conteneurs, B/L) les garde toutes.
  const m = fitted(main, 134, 10.5, Math.max(3, main.split('\n').length * 2));
  return (
    <View style={st.kvValueBox}>
      <T style={[st.kvValue, { fontFamily: m.font }, ...(tone ? [TONE[tone]] : [])]}>{m.text}</T>
      {zh ? <T style={st.kvZh}>{clampLines(zh, 134, 8.5, 2)}</T> : null}
    </View>
  );
}

function KvList({ rows }: { rows: Kv[] }) {
  return (
    <View>
      {rows.map(([label, value, tone], i) => (
        <View key={label} style={[st.kvRow, ...(i === rows.length - 1 ? [{ borderBottomWidth: 0 }] : [])]} wrap={false}>
          <T style={st.kvLabel}>{label}</T>
          <KvValue value={value} tone={tone} />
        </View>
      ))}
    </View>
  );
}

function ClientBlock({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  const c = q.client;
  if (!c) return <KvList rows={[[t.name, t.toAssign, 'orange'], [t.company, '—'], [t.bonziniId, t.toCreate, 'orange'], [t.phone, t.toFill, 'orange']]} />;
  const rows: Kv[] = [
    [t.name, clientFullName(c) || '—'],
    [t.company, c.company_name || '—'],
    [t.bonziniId, c.customer_code || t.toCreate, c.customer_code ? 'violet' : 'orange'],
    [t.phone, c.phone || t.toFill, c.phone ? undefined : 'orange'],
  ];
  const city = [c.city, countryIn(c.country, lang)].filter(Boolean).join(', ');
  if (city) rows.push([t.city, city]);
  if (c.account_name) rows.push([t.account, c.account_name]);
  return <KvList rows={rows} />;
}

/** `asOf` : la date du document. Une arrivée passée à cette date n'est plus « estimée ». */
function ShipmentBlock({ q, lang, asOf }: { q: Quote; lang: CargoDocLang; asOf?: string | null }) {
  const t = TXT[lang];
  const sea = q.location !== 'office';
  const parcels = q.lines.filter((l) => l.kind === 'parcel');
  const rows: Kv[] = [
    [t.deposit, dots([q.deposit_no, t.parcelsN(parcels.length)])],
    [t.mode, sea ? t.modeSea : t.modeAir],
    // La réception a lieu à Guangzhou : sa date est celle de Guangzhou.
    [t.reception, `${sea ? t.atWarehouse : t.atOffice}\n${docDay(q.opened_at, lang, PLACE_TZ.guangzhou)}`],
  ];
  if (q.received_by_name) rows.push([t.receivedBy, q.received_by_name]);
  if (q.supplier_name) rows.push([q.supplier_kind === 'buying_agent' ? t.buyingAgent : t.supplier, q.supplier_name]);
  const containers = q.containers ?? [];
  const flights = q.flights ?? [];
  // Plusieurs moyens de transport : chaque navire et chaque arrivée disent à quoi ils se rapportent (repère gris au-dessus).
  const multi = containers.length + flights.length > 1;
  const awb = (n: string) => nb(`${t.awb} ${formatAwb(n)}`);
  if (containers.length) {
    rows.push([t.container, containers.map((c) => [nb(c.container_number), c.bl_number ? nb(`B/L ${c.bl_number}`) : null].filter(Boolean).join('\n')).join('\n')]);
    if (containers.some((c) => c.vessel_name || c.voyage)) {
      const vessels = containers.map((c): [string, string] => [nb(c.container_number), dots([c.vessel_name, c.voyage]) || '—']);
      rows.push([t.vessel, multi ? vessels : vessels[0][1]]);
    }
  }
  if (flights.length) {
    rows.push([t.flight, flights.map((f) => dots([awb(f.awb_number), nb([f.airline, f.flight_no].filter(Boolean).join(' '))])).join('\n')]);
  }
  if (containers.length || flights.length) {
    const etas = [...containers.map((c) => ({ id: nb(c.container_number), eta: c.eta })), ...flights.map((f) => ({ id: awb(f.awb_number), eta: f.eta }))];
    const today = asOf ? new Intl.DateTimeFormat('en-CA', { timeZone: DOC_TZ }).format(new Date(asOf)) : null;
    const dated = etas.filter((e) => e.eta);
    // Toutes les arrivées connues sont passées à la date du document : c'est l'arrivée, plus une estimation.
    const arrived = !!today && dated.length === etas.length && dated.every((e) => String(e.eta).slice(0, 10) <= today);
    const label = arrived ? t.arrived : t.eta;
    if (!dated.length) rows.push([t.eta, t.etaPending, 'muted']);
    else if (multi) rows.push([label, etas.map((e): [string, string, Tone?] => [e.id, e.eta ? docDay(e.eta, lang) : t.etaPending, e.eta ? (arrived ? undefined : 'amber') : 'muted'])]);
    else rows.push([label, docDay(dated[0].eta, lang), arrived ? undefined : 'amber']);
  }
  return <KvList rows={rows} />;
}

// Sécable entre deux lignes (chaque ligne clé / valeur, elle, est insécable) : un dépôt réparti sur beaucoup de
// conteneurs ou de vols ne peut pas dépasser une page et se faire écraser.
function PartiesRow({ q, lang, asOf }: { q: Quote; lang: CargoDocLang; asOf?: string | null }) {
  const t = TXT[lang];
  return (
    <View style={{ flexDirection: 'row' }}>
      <Section n={1} title={t.secClient} style={{ flex: 1, marginRight: 6 * MM }}><ClientBlock q={q} lang={lang} /></Section>
      <Section n={2} title={t.secShipment} style={{ flex: 1 }}><ShipmentBlock q={q} lang={lang} asOf={asOf} /></Section>
    </View>
  );
}

// Colonnes du tableau des marchandises (largeur de la section : 180 mm)
const COL = { no: 26, dims: 86, weight: 54, vol: 54, rate: 60, amount: 72 };
const DESIGNATION_W = 180 * MM - (COL.no + COL.dims + COL.weight + COL.vol + COL.rate + COL.amount) - 10;

/** Où voyage le colis, quand le dépôt est réparti entre plusieurs conteneurs ou vols. */
const whereIs = (l: QuoteLine, t: Txt) => (l.container_number ? nb(l.container_number) : l.awb_number ? nb(`${t.awb} ${formatAwb(l.awb_number)}`) : null);

/** `footer` : ce qui suit la ligne de total (le montant, la signature) — total et montant changent de page ensemble. */
function GoodsTable({ q, lang, footer }: { q: Quote; lang: CargoDocLang; footer?: ReactNode }) {
  const t = TXT[lang];
  const parcels = q.lines.filter((l) => l.kind === 'parcel');
  const others = q.lines.filter((l) => l.kind !== 'parcel');
  const unit = rateUnit(parcels);
  const split = new Set(parcels.map((l) => whereIs(l, t))).size > 1;
  const sum = (f: (l: QuoteLine) => number | null | undefined) => parcels.reduce((s, l) => s + Number(f(l) ?? 0), 0);
  const hasWeight = parcels.some((l) => l.weight_kg != null);
  const hasVol = parcels.some((l) => l.cbm != null);
  const right = { textAlign: 'right' as const };
  const th = (label: string, u?: string, width?: number, align: 'left' | 'center' | 'right' = 'left') => (
    <View key={label} style={[st.thc, width ? { width } : { flex: 1 }]}>
      <T style={{ textAlign: align }}>{label}</T>
      <T style={[st.thUnit, { textAlign: align }]}>{u ?? ' '}</T>
    </View>
  );
  // Le tarif : le nombre ; l'unité dans l'en-tête si tous les colis ont la même base, sinon sous le nombre.
  const rateCell = (l: QuoteLine) => (
    <View style={[st.td, { width: COL.rate }]}>
      <T style={right}>{l.basis === 'fixed' || l.unit_price_xaf == null ? t.flat : money(l.unit_price_xaf, lang)}</T>
      {!unit && l.basis !== 'fixed' && l.unit_price_xaf != null ? <T style={[st.tdSub, right]}>{t.perUnit(l.basis === 'per_kg' ? 'kg' : 'm³')}</T> : null}
    </View>
  );
  // La quantité facturée, quand elle n'est plus la mesure du colis (colis repesé après l'envoi du devis).
  const billed = (l: QuoteLine) => {
    const measured = l.basis === 'per_kg' ? l.weight_kg : l.basis === 'per_cbm' ? l.cbm : null;
    if (l.quantity == null || measured == null || Math.abs(Number(l.quantity) - Number(measured)) < 0.0005) return null;
    return t.billedOn(l.basis === 'per_kg' ? `${kg(l.quantity, lang)}${NBSP}kg` : `${m3(l.quantity, lang)}${NBSP}m³`);
  };
  const parcelRow = (l: QuoteLine) => {
    const label = fitted(lineLabel(l, t), DESIGNATION_W, 9.5, 3);
    const sub = dots([nb(l.parcel_no ?? ''), l.description && l.kind_of_parcel ? t.kindLabel[l.kind_of_parcel] : null, l.courier_waybill ? `${t.waybill} ${l.courier_waybill}` : null, split ? whereIs(l, t) : null, billed(l)]);
    const subFit = fitted(sub, DESIGNATION_W, 8.5, 2);
    const needs = lineNeedsMeasure(l);
    return (
      <View key={l.id} style={st.tr} wrap={false}>
        <T style={[st.td, { width: COL.no }]}>{String(l.parcel_seq ?? l.seq).padStart(2, '0')}</T>
        <View style={[st.td, { flex: 1 }]}>
          <T style={{ fontFamily: label.font }}>{label.text}</T>
          {sub ? <T style={[st.tdSub, { fontFamily: subFit.font }]}>{subFit.text}</T> : null}
        </View>
        <T style={[st.td, { width: COL.dims, textAlign: 'center' }]}>{l.length_cm && l.width_cm && l.height_cm ? [l.length_cm, l.width_cm, l.height_cm].map((x) => kg(x, lang)).join(`${NBSP}× `) : '—'}</T>
        <T style={[st.td, { width: COL.weight }, right]}>{l.weight_kg == null ? '—' : kg(l.weight_kg, lang)}</T>
        <T style={[st.td, { width: COL.vol }, right]}>{m3(l.cbm, lang)}</T>
        {rateCell(l)}
        {needs
          ? <T style={[st.td, { width: COL.amount, fontSize: 8.5, fontWeight: 700, color: C.orange }, right]}>{t.toMeasure}</T>
          : <T style={[st.td, { width: COL.amount, fontWeight: 700 }, right]}>{money(l.amount_xaf, lang)}</T>}
      </View>
    );
  };
  return (
    <View>
      {/* `fixed` : l'en-tête des colonnes se répète sur chaque page que le tableau occupe. */}
      <View style={st.th} wrap={false} fixed>
        {th(t.colNo, undefined, COL.no)}
        {th(t.colLabel)}
        {th(t.colDims, 'cm', COL.dims, 'center')}
        {th(t.colWeight, 'kg', COL.weight, 'right')}
        {th(t.colVolume, 'm³', COL.vol, 'right')}
        {th(t.colRate, unit ? `XAF / ${unit}` : 'XAF', COL.rate, 'right')}
        {th(t.colAmount, 'XAF', COL.amount, 'right')}
      </View>
      {parcels.slice(0, -1).map(parcelRow)}
      {/* La dernière ligne de colis, les frais, le total et le montant changent de page ENSEMBLE : la page
          suivante ne s'ouvre jamais sur un total sans colis au-dessus. */}
      <View wrap={false}>
      {parcels.slice(-1).map(parcelRow)}
      {others.map((l) => {
        const label = fitted(l.label, DESIGNATION_W, 9.5, 2);
        return (
          <View key={l.id} style={st.tr} wrap={false}>
            <T style={[st.td, { width: COL.no }]}> </T>
            <View style={[st.td, { flex: 1 }]}>
              <T style={{ fontFamily: label.font }}>{label.text}</T>
              <T style={st.tdSub}>{l.kind === 'discount' ? t.discount : t.fee}</T>
            </View>
            <T style={[st.td, { width: COL.dims + COL.weight + COL.vol + COL.rate }]}> </T>
            <T style={[st.td, { width: COL.amount, fontWeight: 700 }, right]}>{money(l.kind === 'discount' ? -Math.abs(Number(l.amount_xaf)) : l.amount_xaf, lang)}</T>
          </View>
        );
      })}
      <View style={st.total}>
        <T style={[st.td, { width: COL.no }]}> </T>
        <T style={[st.td, { flex: 1, fontWeight: 700 }]}>{t.total}{`${NBSP}· `}{countLabel(parcels.map((p) => p.kind_of_parcel), t.kind)}</T>
        <T style={[st.td, { width: COL.dims }]}> </T>
        <T style={[st.td, { width: COL.weight, fontWeight: 700 }, right]}>{hasWeight ? kg(sum((l) => l.weight_kg), lang) : '—'}</T>
        <T style={[st.td, { width: COL.vol, fontWeight: 700 }, right]}>{hasVol ? m3(sum((l) => l.cbm), lang) : '—'}</T>
        <T style={[st.td, { width: COL.rate, fontWeight: 700 }, right]}>{commonRate(parcels, lang, t.flat) || ' '}</T>
        <T style={[st.td, { width: COL.amount, fontWeight: 700 }, right]}>{money(q.total_xaf, lang)}</T>
      </View>
      {footer}
      </View>
    </View>
  );
}

/** Le bandeau du montant : orange quand le client doit payer, violet quand c'est réglé ou reçu. */
function AmountBand({ label, sub, amount, tone, lang }: { label: string; sub?: string | null; amount: number; tone: 'due' | 'paid'; lang: CargoDocLang }) {
  const due = tone === 'due';
  const words = xafInWords(amount, lang);
  return (
    <View style={[st.band, { backgroundColor: due ? C.orangeTint : C.violetTint, borderLeftColor: due ? C.orange : C.violet }]} wrap={false}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <T style={st.bandLabel}>{label}</T>
        {sub ? <T style={st.bandSub}>{sub}</T> : null}
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 1, maxWidth: '58%' }}>
        <T style={st.bandAmount}>{xaf(amount, lang)}</T>
        {words ? <T style={st.bandWords}>{words}</T> : null}
      </View>
    </View>
  );
}

function Stamp({ dateLine, paid, lang }: { dateLine: string; paid?: boolean; lang: CargoDocLang }) {
  const t = TXT[lang];
  const co = CARGO_COMPANY;
  return (
    <View style={st.stampOuter}>
      <View style={st.stampInner}>
        <T style={st.stampName}>{co.legalName}</T>
        <T style={st.stampTrade}>{t.stampTrade}</T>
        <View style={st.stampRule} />
        <T style={st.stampLine}>RCCM {co.rccm}  ·  NIU {co.niu}</T>
        <T style={st.stampLine}>{co.seat[lang]}  ·  {co.phonesCameroon[0]}</T>
        {paid ? <T style={[st.stampDate, { letterSpacing: 1.2 }]}>{t.stampPaid}</T> : null}
        <T style={[st.stampDate, ...(paid ? [{ marginTop: 1 }] : [])]}>{dateLine}</T>
      </View>
    </View>
  );
}

/**
 * La validation, comme sur la packing list : pour la société, le lieu et la
 * date, et le cachet — sans signature client. Elle vit sous le montant, dans
 * la même section : un devis de 4 ou 5 colis tient sur une page, comme la PL.
 * `children` : ce qui précède la signature à gauche (référence, validité…).
 */
function SignOff({ place, date, note, paid, lang, children }: { place: string | null; date: string; note: string; paid?: boolean; lang: CargoDocLang; children?: ReactNode }) {
  const t = TXT[lang];
  const dateLine = t.placeDate(place, date);
  return (
    <View style={st.signRow} wrap={false}>
      <View style={{ flex: 1, paddingRight: 14 }}>
        {children}
        <T style={{ fontSize: 10, fontWeight: 700, marginTop: children ? 7 : 0 }}>{t.forCompany}</T>
        <T style={[st.body, { marginTop: 2 }]}>{dateLine}</T>
        <T style={[st.grey, { marginTop: 3 }]}>{note}</T>
      </View>
      <View style={{ paddingRight: 6, paddingVertical: 4 }}><Stamp dateLine={dateLine} paid={paid} lang={lang} /></View>
    </View>
  );
}

const payPlace = (p: QuotePayment, t: Txt) => (p.method === 'wallet' ? t.placeWallet : t.place[p.place]);
/** La référence d'un paiement — sauf pour le solde Bonzini, où la base écrit « Solde Bonzini » (déjà dit par le mode). */
const payReference = (p: QuotePayment) => (p.reference && p.method !== 'wallet' ? p.reference : null);

/** La hauteur estimée du tableau des paiements (pt) : une section insécable plus haute qu'une page serait écrasée. */
const REF_W = 120;
const paymentsHeight = (ps: QuotePayment[]) => ps.reduce((h, x) => {
  const ref = fitted(payReference(x), REF_W, 8.5, 3).text;
  return h + 26 + (ref ? ref.split('\n').length * 10.5 : 0);
}, 30);

function PaymentsTable({ payments, highlight, lang }: { payments: QuotePayment[]; highlight?: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const right = { textAlign: 'right' as const };
  return (
    <View>
      <View style={st.th} wrap={false} fixed>
        <T style={[st.thc, { width: 74 }]}>{t.colReceipt}</T>
        <T style={[st.thc, { width: 70 }]}>{t.colDate}</T>
        <T style={[st.thc, { flex: 1 }]}>{t.colMethod}</T>
        <T style={[st.thc, { width: 142 }]}>{t.colPlace}</T>
        <T style={[st.thc, { width: 76 }, right]}>{t.colAmountXaf}</T>
      </View>
      {payments.map((p) => {
        const mine = p.id === highlight;
        const b = mine ? { fontWeight: 700 } : {};
        const ref = payReference(p);
        const refFit = fitted(ref, REF_W, 8.5, 3);
        return (
          <View key={p.id} style={[st.tr, ...(mine ? [{ backgroundColor: C.violetTint }] : [])]} wrap={false}>
            <T style={[st.td, { width: 74 }, b]}>{p.receipt_no}</T>
            <T style={[st.td, { width: 70 }]}>{docDay(p.paid_at, lang, PLACE_TZ[p.place])}</T>
            <View style={[st.td, { flex: 1 }]}>
              <T style={b}>{t.method[p.method]}{mine ? `${NBSP}· ${t.thisReceipt}` : ''}</T>
              {ref ? <T style={[st.tdSub, { fontFamily: refFit.font }]}>{refFit.text}</T> : null}
            </View>
            <T style={[st.td, { width: 142 }]}>{payPlace(p, t)}</T>
            <T style={[st.td, { width: 76, fontWeight: 700 }, right]}>{money(p.amount_xaf, lang)}</T>
          </View>
        );
      })}
    </View>
  );
}

function Conditions({ n, where, lang }: { n: number; where: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const items = t.conditions(where);
  return (
    <Section n={n} title={t.secConditions} wrap={false}>
      {items.map((c, i) => (
        <View key={i} style={[st.condRow, ...(i === items.length - 1 ? [{ borderBottomWidth: 0 }] : [])]} wrap={false}>
          <T style={st.condNo}>{i + 1}.</T>
          <T style={st.condText}>{c}</T>
        </View>
      ))}
    </Section>
  );
}

function HowToPay({ n, payRef, lang }: { n: number; payRef: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const accounts = companyBankAccounts();
  return (
    <Section n={n} title={t.secHowToPay} style={{ marginTop: 10 }} wrap={false}>
      {accounts.length ? (
        <View style={{ marginBottom: 6, marginHorizontal: -PAD, marginTop: -PAD }}>
          <View style={st.th}>
            <T style={[st.thc, { width: 160, paddingLeft: PAD }]}>{t.bankName}</T>
            <T style={[st.thc, { flex: 1 }]}>{t.iban}</T>
            <T style={[st.thc, { width: 82, paddingRight: PAD }]}>{t.swift}</T>
          </View>
          {accounts.map((a) => (
            <View key={a.iban} style={st.tr} wrap={false}>
              <T style={[st.td, { width: 160, paddingLeft: PAD, paddingVertical: 4.5, fontSize: 9, fontWeight: 700 }]}>{a.bank}</T>
              <T style={[st.td, { flex: 1, paddingVertical: 4.5, fontSize: 9 }]}>{a.iban}</T>
              <T style={[st.td, { width: 82, paddingRight: PAD, paddingVertical: 4.5, fontSize: 9 }]}>{a.swift}</T>
            </View>
          ))}
        </View>
      ) : null}
      <T style={st.grey}>{accounts.length ? t.bankHolder(CARGO_COMPANY.legalName) : ''}{t.otherWays(payRef)}</T>
    </Section>
  );
}

function Addresses({ n, settings, lang }: { n: number; settings: ShippingSettings; lang: CargoDocLang }) {
  const t = TXT[lang];
  const co = CARGO_COMPANY;
  const { office, warehouse } = settings;
  // Largeur utile des colonnes bureau et entrepôt (flex 1 / 0.9 / 1.3 sur ≈ 494 pt, moins 18 pt de marges)
  const W = { office: 120, warehouse: 183 };
  const contact = (l: typeof office, w: number) => fitted(contactLine(l), w, 9);
  return (
    <Section n={n} title={t.secAddresses} style={{ marginTop: 10 }} wrap={false}>
      <View style={{ flexDirection: 'row', marginHorizontal: -9 }}>
        <View style={[st.addrCol, { flex: 1 }]}>
          <T style={st.addrTitle}>{t.addrDouala}</T>
          <T style={st.addrLine}>{co.seat[lang]}</T>
          <T style={[st.addrLine, { color: C.grey }]}>{t.pickupOffice}</T>
          <T style={[st.addrLine, { marginTop: 4 }]}>{co.phonesCameroon.map(nb).join('\n')}</T>
          <T style={[st.addrLine, { fontSize: 8.5 }]}>{co.email}</T>
        </View>
        <View style={[st.addrCol, { flex: 0.9, borderLeftWidth: 0.5, borderLeftColor: C.rule }]}>
          <T style={st.addrTitle}>{t.addrOffice}</T>
          {office.addressEn ? <T style={st.addrLine}>{office.addressEn}</T> : null}
          {office.addressZh ? <T style={st.addrZh}>{wrapText(office.addressZh, W.office, 8.5)}</T> : null}
          {/* Comme sur la packing list : le bureau finit par le téléphone chinois de la société. */}
          <T style={[st.addrLine, { marginTop: 4 }]}>{t.tel} {nb(co.phoneChina)}</T>
        </View>
        <View style={[st.addrCol, { flex: 1.3, borderLeftWidth: 0.5, borderLeftColor: C.rule }]}>
          <T style={st.addrTitle}>{t.addrWarehouse}</T>
          {warehouse.addressEn ? <T style={st.addrLine}>{warehouse.addressEn}</T> : null}
          {warehouse.addressZh ? <T style={st.addrZh}>{wrapText(warehouse.addressZh, W.warehouse, 8.5)}</T> : null}
          {contactLine(warehouse) ? <T style={[st.addrLine, { marginTop: 4, fontFamily: contact(warehouse, W.warehouse).font }]}>{contact(warehouse, W.warehouse).text}</T> : null}
        </View>
      </View>
    </Section>
  );
}

/** « Dépôt RC-000122 · 10 colis · 84 kg · 0,96 m³ », précédé d'un en-tête (« Devis DV-000031 ») sur le reçu et la facture. */
const docSubtitle = (q: Quote, lang: CargoDocLang, lead?: string) => {
  const t = TXT[lang];
  const parcels = q.lines.filter((l) => l.kind === 'parcel');
  const w = parcels.reduce((s, l) => s + Number(l.weight_kg ?? 0), 0);
  const v = parcels.reduce((s, l) => s + Number(l.cbm ?? 0), 0);
  return dots([lead, nb(`${t.deposit} ${q.deposit_no}`), t.parcelsN(parcels.length), w ? `${kg(w, lang)}${NBSP}kg` : null, v ? `${m3(v, lang)}${NBSP}m³` : null]);
};
/** La référence à rappeler : l'identifiant Bonzini du client, sinon le numéro du devis. */
const payRefOf = (q: Quote) => q.client?.customer_code || q.quote_no;

// ============================================================
// Le devis
// ============================================================
export function CargoQuotePDF({ q, settings, lang = 'fr' }: { q: Quote; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  const sea = q.location !== 'office';
  const issued = q.sent_at ?? q.updated_at;
  // Le devis est établi et signé à Guangzhou : ses dates sont celles de Guangzhou.
  const tz = PLACE_TZ.guangzhou;
  const paid = quotePaid(q);
  const balance = quoteBalance(q);
  const toMeasure = q.lines.filter(lineNeedsMeasure).length;
  // Réglé : rien ne reste dû ET rien ne reste à mesurer (un colis non mesuré ajoutera un montant).
  const settled = paid > 0 && balance === 0 && toMeasure === 0;
  const ref = payRefOf(q);
  const [refBefore, refValue, refAfter] = t.payRef(ref);
  const where = sea ? t.whereWarehouse : t.whereOffice;
  const dueLabel = toMeasure ? (paid > 0 ? t.balanceProvisional : t.provisional) : paid > 0 ? t.balanceToPay : t.toPay;
  return (
    <Shell q={q} lang={lang} headTitle={t.hTitleQuote} reference={q.quote_no} issuedLabel={t.issued} issuedOn={docDay(issued, lang, tz)}>
      <DocHead title={t.titleQuote[sea ? 'warehouse' : 'office']} subtitle={docSubtitle(q, lang)} />
      <PartiesRow q={q} lang={lang} asOf={issued} />
      <Section n={3} title={t.secGoods} flush style={{ marginTop: GAP }}>
        <GoodsTable q={q} lang={lang} footer={
        <View style={{ padding: PAD }}>
          {settled
            ? <AmountBand label={t.settled} amount={q.total_xaf} tone="paid" lang={lang} />
            : <AmountBand label={dueLabel} sub={paid > 0 ? t.totalAndPaid(xaf(q.total_xaf, lang), xaf(paid, lang)) : null} amount={balance} tone="due" lang={lang} />}
          {toMeasure ? <T style={[st.note, { color: C.orange, marginTop: 6 }]}>{t.pendingMeasure(toMeasure)}</T> : null}
          {q.notes ? <T style={[st.note, { fontFamily: fontFor(q.notes) }]}>{fitted(q.notes, 470, 9, 4).text}</T> : null}
          <SignOff place="Guangzhou" date={docDay(issued, lang, tz)} note={t.quoteFootnote} lang={lang}>
            {settled
              ? <T style={st.body}>{t.fullyPaid(q.client?.customer_code ? null : q.quote_no)}</T>
              : <>
                  <T style={st.body}>{refBefore}<T style={{ fontWeight: 700 }}>{nb(refValue)}</T>{refAfter}</T>
                  <T style={[st.grey, { marginTop: 3 }]}>{t.validity(docDay(addDays(issued, 30), lang, tz))}</T>
                </>}
          </SignOff>
        </View>} />
      </Section>
      {/* Le verso. Un devis à régler : au dos, comme la packing list (conditions, banques, adresses tiennent une page).
          Un devis réglé : conditions et adresses suivent, et passent ensemble à la page suivante s'il le faut. */}
      {!settled ? (
        <View break>
          <Conditions n={4} where={where} lang={lang} />
          <HowToPay n={5} payRef={ref} lang={lang} />
          <Addresses n={6} settings={settings} lang={lang} />
        </View>
      ) : (
        <View wrap={false} style={{ marginTop: GAP }}>
          <Conditions n={4} where={where} lang={lang} />
          <Addresses n={5} settings={settings} lang={lang} />
        </View>
      )}
    </Shell>
  );
}

// ============================================================
// Le reçu d'un encaissement
// ============================================================
// `settings` reste dans la signature (les appelants le passent) ; le reçu n'imprime pas les adresses.
export function CargoReceiptPDF({ q, p, lang = 'fr' }: { q: Quote; p: QuotePayment; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  const paid = quotePaid(q);
  const balance = quoteBalance(q);
  const toMeasure = q.lines.filter(lineNeedsMeasure).length;
  const settled = balance === 0 && toMeasure === 0;
  const payments = activePayments(q);
  const others = payments.some((x) => x.id !== p.id);
  const tz = PLACE_TZ[p.place];
  const ref = payReference(p);
  const left: Kv[] = [[t.payMode, t.method[p.method]], ...(ref ? [[t.payRefLabel, ref] as Kv] : []), ...(p.received_by_name ? [[t.payBy, p.received_by_name] as Kv] : [])];
  const rightKv: Kv[] = [[t.payPlace, payPlace(p, t)], [t.payDate, `${docDateTime(p.paid_at, lang, tz)}\n(${t.localTime(p.method === 'wallet' ? 'douala' : p.place)})`]];
  // Où en est le devis après ce paiement : ce qui reste, ou « réglé ».
  const situation = (
    <View wrap={false}>
      {settled
        ? <AmountBand label={t.settled} amount={q.total_xaf} tone="paid" lang={lang} />
        : <AmountBand label={toMeasure ? t.balanceProvisional : t.balanceToPay} sub={t.totalAndPaid(xaf(q.total_xaf, lang), xaf(paid, lang))} amount={balance} tone="due" lang={lang} />}
      {toMeasure ? <T style={[st.note, { color: C.orange, marginTop: 6 }]}>{t.pendingMeasure(toMeasure)}</T> : null}
      <T style={[st.grey, { marginTop: 6 }]}>{settled ? t.fullyPaid(q.client?.customer_code ? null : q.quote_no) : t.releaseWhenPaid}</T>
    </View>
  );
  return (
    <Shell q={q} lang={lang} headTitle={t.hTitleReceipt} reference={p.receipt_no} issuedLabel={t.issued} issuedOn={docDay(p.paid_at, lang, tz)}>
      <DocHead title={t.titleReceipt} subtitle={docSubtitle(q, lang, nb(`${t.quoteWord} ${q.quote_no}`))} />
      <PartiesRow q={q} lang={lang} asOf={p.paid_at} />
      <Section n={3} title={t.secPayment} style={{ marginTop: GAP }} wrap={false}>
        <AmountBand label={t.amountReceived} sub={p.receipt_no} amount={p.amount_xaf} tone="paid" lang={lang} />
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <View style={{ flex: 1, marginRight: 6 * MM }}><KvList rows={left} /></View>
          <View style={{ flex: 1 }}><KvList rows={rightKv} /></View>
        </View>
        {p.note ? <T style={[st.note, { fontFamily: fontFor(p.note) }]}>{fitted(p.note, 470, 9, 4).text}</T> : null}
        {/* Un seul paiement : la situation du devis tient ici, sans section ni tableau qui répèteraient ce paiement. */}
        {others ? null : <View style={{ marginTop: 8 }}>{situation}</View>}
        <SignOff place={t.placeCity[p.place]} date={docDay(p.paid_at, lang, tz)} note={t.receiptFootnote} lang={lang} />
      </Section>
      {others ? (
        <Section n={4} title={t.secSituation} flush style={{ marginTop: GAP }} {...(paymentsHeight(payments) > 430 ? {} : { wrap: false })}>
          <PaymentsTable payments={payments} highlight={p.id} lang={lang} />
          <View style={{ padding: PAD }}>{situation}</View>
        </Section>
      ) : null}
    </Shell>
  );
}

// ============================================================
// La facture acquittée
// ============================================================
export function CargoInvoicePDF({ q, settings, lang = 'fr' }: { q: Quote; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  const sea = q.location !== 'office';
  const payments = activePayments(q);
  // Le dernier encaissement dit où le compte a été soldé (souvent Douala, au retrait) ; sans encaissement, Guangzhou.
  const last = payments.length ? payments[payments.length - 1] : null;
  const tz = last ? PLACE_TZ[last.place] : PLACE_TZ.guangzhou;
  const issued = q.invoiced_at ?? q.paid_at ?? q.updated_at;
  return (
    <Shell q={q} lang={lang} headTitle={t.hTitleInvoice} reference={q.invoice_no ?? q.quote_no} issuedLabel={t.issuedInvoice} issuedOn={docDay(issued, lang, tz)}>
      <DocHead title={t.titleInvoice} subtitle={docSubtitle(q, lang, nb(`${t.quoteWord} ${q.quote_no}`))} />
      <PartiesRow q={q} lang={lang} asOf={issued} />
      <Section n={3} title={t.secGoods} flush style={{ marginTop: GAP }}>
        <GoodsTable q={q} lang={lang} footer={
        <View style={{ padding: PAD }}>
          <AmountBand label={t.amountPaid} sub={q.paid_at ? docDay(q.paid_at, lang, tz) : null} amount={quotePaid(q)} tone="paid" lang={lang} />
          {q.notes ? <T style={[st.note, { fontFamily: fontFor(q.notes) }]}>{fitted(q.notes, 470, 9, 4).text}</T> : null}
          <SignOff place={last ? t.placeCity[last.place] : 'Guangzhou'} date={docDay(issued, lang, tz)} note={t.invoiceFootnote(q.client?.customer_code ? null : q.quote_no)} paid lang={lang} />
        </View>} />
      </Section>
      {payments.length ? (
        <Section n={4} title={t.secSettlements} flush style={{ marginTop: GAP }} {...(paymentsHeight(payments) > 520 ? {} : { wrap: false })}>
          <PaymentsTable payments={payments} lang={lang} />
        </Section>
      ) : null}
      <View wrap={false} style={{ marginTop: GAP }}>
        <Conditions n={payments.length ? 5 : 4} where={sea ? t.whereWarehouse : t.whereOffice} lang={lang} />
        <Addresses n={payments.length ? 6 : 5} settings={settings} lang={lang} />
      </View>
    </Shell>
  );
}
