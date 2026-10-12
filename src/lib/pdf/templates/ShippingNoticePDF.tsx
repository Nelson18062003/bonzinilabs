// ============================================================
// L'AVIS D'EXPÉDITION — quand les colis quittent l'entrepôt ou le bureau de
// Guangzhou (demande du fondateur, 12/10/2026) : un avis par CONTENEUR (Sea
// cargo, colis classés client par client) ou par VOL (Air cargo, colis rangés
// dans leurs PAQUETS de 32 kg). Il remplace le manifeste (jsPDF, Helvetica) :
// même contenu — transport, dates, colis, mesures, état du règlement — dans la
// charte des documents cargo (DM Sans, en-tête officiel, barre tricolore).
// Document interne : il circule entre Guangzhou, le transitaire et Douala ;
// l'état du règlement dit à l'entrepôt de Douala ce qui peut être remis.
// ============================================================
import { View } from '@react-pdf/renderer';
import { DOC_TZ, NBSP, docDay, kg, m3, money } from '../cargoDocFormat';
import {
  C, GAP, MM, PAD, T, TXT, KvList, Section, Shell, SignOff, DocHead, dots, fitted, nb, st,
  type CargoDocLang, type Kv, type Tone, type Txt,
} from './CargoDocumentsPDF';
import { clientFullName, type ReceptionCondition } from '@/lib/reception';
import { formatAwb, isProvisionalAwb, type AirParcel } from '@/lib/airShipment';
import type { AirPackage } from '@/lib/airPackage';

const S = {
  fr: {
    hTitle: 'AVIS D’EXPÉDITION', title: 'Avis d’expédition',
    modeSea: 'Fret maritime — groupage', modeAir: 'Fret aérien',
    secTransport: 'Le transport', secSummary: 'En résumé', secByClient: 'Les colis, client par client', secByPackage: 'Les paquets et leurs colis',
    container: 'Conteneur', bl: 'B/L', vessel: 'Navire', carrier: 'Armateur', awb: 'LTA', awbPending: 'LTA à venir', airline: 'Compagnie', flight: 'Vol',
    from: 'Départ', to: 'Arrivée', eta: 'Arrivée estimée', arrived: 'Arrivé', toConfirm: 'à confirmer',
    parcels: 'Colis', clients: 'Clients', weight: 'Poids', volume: 'Volume', packages: 'Paquets', unpaid: 'Non soldés', allPaid: 'tout est payé',
    parcelsN: (n: number) => `${n}${NBSP}colis`, clientsN: (n: number) => `${n}${NBSP}client${n > 1 ? 's' : ''}`, packagesN: (n: number) => `${n}${NBSP}paquet${n > 1 ? 's' : ''}`,
    colNo: 'Colis', colClient: 'Client', colLabel: 'Désignation', colDims: 'Dimensions', colWeight: 'Poids', colVol: 'Volume', colPay: 'Règlement',
    paid: 'payé', invoiced: (n: string) => `facturé ${n}`, rest: (x: string) => `reste ${x}`, noPrice: 'sans prix',
    toAssign: 'Client à attribuer', loose: 'Colis hors paquet',
    pkg: 'Paquet', gross: 'brut', net: 'net',
    reserve: 'Réserve à la réception : ',
    condition: { good: 'bon état apparent', damaged: 'carton abîmé', opened: 'colis ouvert', wet: 'colis mouillé' } as Record<ReceptionCondition, string>,
    forDouala: 'Document interne — pour l’entrepôt de Douala et le transitaire. Un colis « non soldé » ne se remet pas avant paiement complet.',
  },
  en: {
    hTitle: 'SHIPPING NOTICE', title: 'Shipping notice',
    modeSea: 'Sea freight — LCL', modeAir: 'Air freight',
    secTransport: 'Transport', secSummary: 'Summary', secByClient: 'Parcels, customer by customer', secByPackage: 'Packages and their parcels',
    container: 'Container', bl: 'B/L', vessel: 'Vessel', carrier: 'Shipping line', awb: 'AWB', awbPending: 'AWB to come', airline: 'Airline', flight: 'Flight',
    from: 'Departure', to: 'Arrival', eta: 'Estimated arrival', arrived: 'Arrived', toConfirm: 'to be confirmed',
    parcels: 'Parcels', clients: 'Customers', weight: 'Weight', volume: 'Volume', packages: 'Packages', unpaid: 'Unpaid', allPaid: 'all paid',
    parcelsN: (n: number) => `${n}${NBSP}parcel${n === 1 ? '' : 's'}`, clientsN: (n: number) => `${n}${NBSP}customer${n === 1 ? '' : 's'}`, packagesN: (n: number) => `${n}${NBSP}package${n === 1 ? '' : 's'}`,
    colNo: 'Parcel', colClient: 'Customer', colLabel: 'Description', colDims: 'Dimensions', colWeight: 'Weight', colVol: 'Volume', colPay: 'Payment',
    paid: 'paid', invoiced: (n: string) => `invoiced ${n}`, rest: (x: string) => `due ${x}`, noPrice: 'no price',
    toAssign: 'Customer to be assigned', loose: 'Parcels outside packages',
    pkg: 'Package', gross: 'gross', net: 'net',
    reserve: 'Reserve on receipt: ',
    condition: { good: 'good apparent condition', damaged: 'damaged carton', opened: 'opened parcel', wet: 'wet parcel' } as Record<ReceptionCondition, string>,
    forDouala: 'Internal document — for the Douala warehouse and the forwarder. An “unpaid” parcel is not released before full payment.',
  },
};
type St = (typeof S)['fr'];

/** Ce que l'avis dit du transport : déjà mis en mots par l'appelant (conteneur ou vol). */
export interface NoticeTransport {
  mode: 'sea' | 'air';
  /** « MSKU 482913-7 », ou la LTA brute (PROV-… s'imprime « LTA à venir »). */
  ref: string;
  /** Lignes déjà prêtes (un numéro ne se coupe pas : espaces insécables) : conteneur / B/L / navire, ou compagnie / vol. */
  idRows: Array<[key: 'container' | 'bl' | 'vessel' | 'carrier' | 'airline' | 'flight', value: string | null | undefined]>;
  fromPlace: string | null; fromDate: string | null;
  toPlace: string | null; toDate: string | null;
  notes?: string | null;
}

const unpaidOf = (p: Pick<AirParcel, 'quote_total_xaf' | 'quote_paid_xaf'>) => {
  const total = Number(p.quote_total_xaf ?? 0); const paid = Number(p.quote_paid_xaf ?? 0);
  return total <= 0 || paid < total;
};

function payCell(p: AirParcel, s: St, lang: CargoDocLang): { text: string; tone: 'ok' | 'due' | 'none' } {
  const total = Math.round(Number(p.quote_total_xaf ?? 0));
  const paid = Math.round(Number(p.quote_paid_xaf ?? 0));
  if (total <= 0) return { text: s.noPrice, tone: 'none' };
  if (paid >= total) return { text: p.invoice_no ? s.invoiced(p.invoice_no) : s.paid, tone: 'ok' };
  return { text: s.rest(`${money(total - paid, lang)}${NBSP}XAF`), tone: 'due' };
}

const COL = { no: 82, dims: 76, weight: 44, vol: 48, pay: 84 };

/** Une ligne de colis ; `withClient` : la colonne client (avion, où un paquet mêle plusieurs clients). */
function ParcelRow({ p, withClient, lang }: { p: AirParcel; withClient: boolean; lang: CargoDocLang }) {
  const t: Txt = TXT[lang];
  const s: St = S[lang];
  const right = { textAlign: 'right' as const };
  const pay = payCell(p, s, lang);
  const labelW = 180 * MM - (COL.no + COL.dims + COL.weight + COL.vol + COL.pay) - (withClient ? 96 : 0) - 10;
  const label = fitted(p.description || t.kindLabel[p.kind] || t.parcel, labelW, 9, 2);
  const reserve = p.reception_condition && p.reception_condition !== 'good' ? `${s.reserve}${s.condition[p.reception_condition]}` : null;
  return (
    <View style={st.tr} wrap={false}>
      <T style={[st.td, { width: COL.no, fontSize: 8.8, fontWeight: 700 }]}>{nb(p.parcel_no)}</T>
      {withClient ? (
        <View style={[st.td, { width: 96 }]}>
          <T style={{ fontSize: 8.8 }}>{fitted(p.client ? clientFullName(p.client) : s.toAssign, 86, 8.8, 2).text}</T>
          {p.client?.customer_code ? <T style={[st.tdSub, { color: C.violet }]}>{p.client.customer_code}</T> : null}
        </View>
      ) : null}
      <View style={[st.td, { flex: 1 }]}>
        <T style={{ fontSize: 9, fontFamily: label.font }}>{label.text}</T>
        {reserve ? <T style={{ fontSize: 7.8, color: C.orange, fontWeight: 700, marginTop: 1 }}>{reserve}</T> : null}
      </View>
      <T style={[st.td, { width: COL.dims, textAlign: 'center', fontSize: 8.8 }]}>{p.length_cm && p.width_cm && p.height_cm ? [p.length_cm, p.width_cm, p.height_cm].map((v) => kg(v, lang)).join(`${NBSP}× `) : '—'}</T>
      <T style={[st.td, { width: COL.weight, fontSize: 9 }, right]}>{p.weight_kg == null ? '—' : kg(p.weight_kg, lang)}</T>
      <T style={[st.td, { width: COL.vol, fontSize: 9 }, right]}>{m3(p.cbm, lang)}</T>
      <T style={[st.td, { width: COL.pay, fontSize: 8.6, fontWeight: 700, color: pay.tone === 'due' ? C.orange : pay.tone === 'ok' ? C.violet : C.grey }, right]}>{pay.text}</T>
    </View>
  );
}

function TableHead({ withClient, lang }: { withClient: boolean; lang: CargoDocLang }) {
  const s: St = S[lang];
  const right = { textAlign: 'right' as const };
  return (
    <View style={st.th} wrap={false} fixed>
      <T style={[st.thc, { width: COL.no }]}>{s.colNo}</T>
      {withClient ? <T style={[st.thc, { width: 96 }]}>{s.colClient}</T> : null}
      <T style={[st.thc, { flex: 1 }]}>{s.colLabel}</T>
      <View style={[st.thc, { width: COL.dims }]}><T style={{ textAlign: 'center' }}>{s.colDims}</T><T style={[st.thUnit, { textAlign: 'center' }]}>cm</T></View>
      <View style={[st.thc, { width: COL.weight }]}><T style={right}>{s.colWeight}</T><T style={[st.thUnit, right]}>kg</T></View>
      <View style={[st.thc, { width: COL.vol }]}><T style={right}>{s.colVol}</T><T style={[st.thUnit, right]}>m³</T></View>
      <T style={[st.thc, { width: COL.pay }, right]}>{s.colPay}</T>
    </View>
  );
}

/** La bande violette qui ouvre un groupe (un client, un paquet) : son nom à gauche, ses totaux à droite. */
function GroupBand({ title, sub, totals }: { title: string; sub?: string | null; totals: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.violetTint, paddingHorizontal: PAD, paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: C.rule }} wrap={false} minPresenceAhead={70}>
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 9.5, fontWeight: 700 }}>{title}</T>
        {sub ? <T style={{ fontSize: 8.2, color: C.grey, marginTop: 1 }}>{sub}</T> : null}
      </View>
      <T style={{ fontSize: 8.8, fontWeight: 500 }}>{totals}</T>
    </View>
  );
}

const sumKg = (ps: AirParcel[]) => ps.reduce((t, p) => t + Number(p.weight_kg ?? 0), 0);
const sumCbm = (ps: AirParcel[]) => ps.reduce((t, p) => t + Number(p.cbm ?? 0), 0);

export function ShippingNoticePDF({ transport: tr, parcels, packages, asOf, lang = 'fr' }: {
  transport: NoticeTransport; parcels: AirParcel[]; packages?: AirPackage[] | null; asOf: string; lang?: CargoDocLang;
}) {
  const t: Txt = TXT[lang];
  const s: St = S[lang];
  const air = tr.mode === 'air';
  const refText = air ? (isProvisionalAwb(tr.ref) ? s.awbPending : `${s.awb} ${formatAwb(tr.ref)}`) : tr.ref;
  const day = docDay(asOf, lang, 'Asia/Shanghai');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: DOC_TZ }).format(new Date(asOf));
  const arrived = !!tr.toDate && String(tr.toDate).slice(0, 10) <= today;

  // Les groupes : par paquet (avion), par client (bateau).
  const byClient = new Map<string, AirParcel[]>();
  for (const p of parcels) { const k = p.client?.user_id ?? '∅'; byClient.set(k, [...(byClient.get(k) ?? []), p]); }
  const clientGroups = [...byClient.values()].sort((a, b) => (a[0].client ? clientFullName(a[0].client) : '~').localeCompare(b[0].client ? clientFullName(b[0].client) : '~'));
  const pkgs = [...(packages ?? [])].sort((a, b) => a.package_no.localeCompare(b.package_no));
  const inPkg = (id: string) => parcels.filter((p) => p.air_package_id === id);
  const loose = parcels.filter((p) => !p.air_package_id || !pkgs.some((k) => k.id === p.air_package_id));
  const unpaid = parcels.filter(unpaidOf).length;
  const gross = pkgs.reduce((x, k) => x + Number(k.gross_weight_kg ?? k.net_weight_kg ?? 0), 0);

  const idLabel: Record<NoticeTransport['idRows'][number][0], string> = { container: s.container, bl: s.bl, vessel: s.vessel, carrier: s.carrier, airline: s.airline, flight: s.flight };
  const left: Kv[] = [
    [t.mode, air ? s.modeAir : s.modeSea],
    ...(air ? [[s.awb, isProvisionalAwb(tr.ref) ? s.awbPending : formatAwb(tr.ref), isProvisionalAwb(tr.ref) ? 'orange' : 'violet'] as Kv] : []),
    ...tr.idRows.filter(([, v]) => !!v).map(([k, v]): Kv => [idLabel[k], String(v), k === 'container' ? 'violet' : undefined]),
    [s.from, [tr.fromPlace, tr.fromDate ? docDay(tr.fromDate, lang, 'Asia/Shanghai') : null].filter(Boolean).join('\n') || '—'],
    [arrived ? s.arrived : s.eta, [tr.toPlace, tr.toDate ? docDay(tr.toDate, lang) : s.toConfirm].filter(Boolean).join('\n'), tr.toDate ? (arrived ? undefined : 'amber') : 'muted'],
  ];
  const right: Kv[] = [
    [s.parcels, s.parcelsN(parcels.length)],
    [s.clients, s.clientsN(clientGroups.length)],
    [s.weight, `${kg(sumKg(parcels), lang)}${NBSP}kg`],
    [s.volume, `${m3(sumCbm(parcels), lang)}${NBSP}m³`],
    ...(air && pkgs.length ? [[s.packages, dots([s.packagesN(pkgs.length), gross > 0 ? `${kg(gross, lang)}${NBSP}kg ${s.gross}` : null])] as Kv] : []),
    [s.unpaid, unpaid ? s.parcelsN(unpaid) : s.allPaid, (unpaid ? 'orange' : 'violet') as Tone],
  ];

  return (
    <Shell footRef={nb(refText)} lang={lang} headTitle={s.hTitle} reference={nb(refText)} issuedLabel={t.issued} issuedOn={day}>
      <DocHead title={`${s.title} — ${refText}`} subtitle={dots([air ? s.modeAir : s.modeSea, s.parcelsN(parcels.length), s.clientsN(clientGroups.length), `${kg(sumKg(parcels), lang)}${NBSP}kg`, `${m3(sumCbm(parcels), lang)}${NBSP}m³`])} />
      <View style={{ flexDirection: 'row' }}>
        <Section n={1} title={s.secTransport} style={{ flex: 1, marginRight: 6 * MM }}><KvList rows={left} /></Section>
        <Section n={2} title={s.secSummary} style={{ flex: 1 }}><KvList rows={right} /></Section>
      </View>

      {air && pkgs.length ? (
        <Section n={3} title={s.secByPackage} flush style={{ marginTop: GAP }}>
          <TableHead withClient lang={lang} />
          {pkgs.map((k) => {
            const ps = inPkg(k.id);
            const dims = k.length_cm && k.width_cm && k.height_cm ? `${[k.length_cm, k.width_cm, k.height_cm].map((v) => kg(v, lang)).join(`${NBSP}× `)}${NBSP}cm` : null;
            return (
              <View key={k.id}>
                <GroupBand title={`${s.pkg} ${nb(k.package_no)}`} sub={dims}
                  totals={dots([s.parcelsN(ps.length), k.gross_weight_kg != null ? `${kg(k.gross_weight_kg, lang)}${NBSP}kg ${s.gross}` : `${kg(sumKg(ps), lang)}${NBSP}kg ${s.net}`])} />
                {ps.map((p) => <ParcelRow key={p.id} p={p} withClient lang={lang} />)}
              </View>
            );
          })}
          {loose.length ? (
            <View>
              <GroupBand title={s.loose} totals={dots([s.parcelsN(loose.length), `${kg(sumKg(loose), lang)}${NBSP}kg`])} />
              {loose.map((p) => <ParcelRow key={p.id} p={p} withClient lang={lang} />)}
            </View>
          ) : null}
        </Section>
      ) : (
        <Section n={3} title={s.secByClient} flush style={{ marginTop: GAP }}>
          <TableHead withClient={false} lang={lang} />
          {clientGroups.map((ps) => {
            const c = ps[0].client;
            const due = ps.filter(unpaidOf).length;
            return (
              <View key={c?.user_id ?? '∅'}>
                <GroupBand title={c ? clientFullName(c) : s.toAssign} sub={dots([c?.customer_code, c?.phone, c?.city])}
                  totals={dots([s.parcelsN(ps.length), `${kg(sumKg(ps), lang)}${NBSP}kg`, `${m3(sumCbm(ps), lang)}${NBSP}m³`, due ? `${due} ${s.unpaid.toLowerCase()}` : null])} />
                {ps.map((p) => <ParcelRow key={p.id} p={p} withClient={false} lang={lang} />)}
              </View>
            );
          })}
        </Section>
      )}

      {tr.notes ? <T style={[st.note, { marginTop: 8, fontFamily: fitted(tr.notes, 470, 9, 4).font }]}>{fitted(tr.notes, 470, 9, 4).text}</T> : null}
      <View wrap={false} style={{ marginTop: GAP }}>
        <SignOff place="Guangzhou" date={day} note={s.forDouala} lang={lang} />
      </View>
    </Shell>
  );
}
