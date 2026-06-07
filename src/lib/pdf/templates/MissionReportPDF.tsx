import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import '../fonts';
import { PDFFooter } from '../components/PDFFooter';
import type { ByCurrency, ProcCurrency, ProcMissionReport } from '@/integrations/supabase/procurement';

// Palette (identique à ClientStatementPDF — cohérence des documents).
const C = {
  dark: '#1a1028', violet: '#a64af7', violetLight: '#f3ecf8', gold: '#f3a745',
  orange: '#fe560d', orangeLight: '#fdeee8', green: '#10b981', greenLight: '#ecfdf5',
  text: '#2d2040', muted: '#7a7290', light: '#f8f6fa', border: '#ebe6f0', white: '#ffffff',
};

function fmtNum(n: number): string {
  const abs = Math.abs(Math.round(n));
  const str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return n < 0 ? `-${str}` : str;
}
function san(t: string): string {
  return t.replace(/→/g, '>').replace(/—/g, '-').replace(/–/g, '-')
    .replace(/·/g, '-').replace(/ /g, ' ').replace(/ /g, ' ');
}
function money(by: ByCurrency): string {
  const e = (Object.entries(by) as [ProcCurrency, number][]).filter(([, v]) => Math.abs(v) > 0.000001);
  return e.length === 0 ? '-' : e.map(([c, v]) => `${fmtNum(v)} ${c}`).join('  /  ');
}

const PAD = 30;
const s = StyleSheet.create({
  page: { padding: PAD, paddingBottom: PAD + 24, fontFamily: 'DM Sans', fontSize: 9, color: C.text, backgroundColor: C.white },
  header: { backgroundColor: C.dark, marginTop: -PAD, marginHorizontal: -PAD, paddingHorizontal: PAD, paddingTop: 16, paddingBottom: 12 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 16, fontWeight: 900, color: C.white },
  brandSub: { fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  docLabel: { fontSize: 6, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'right' },
  docTitle: { fontSize: 13, fontWeight: 800, color: C.white, marginTop: 2, textAlign: 'right' },
  stripe: { flexDirection: 'row', height: 2.5, marginHorizontal: -PAD, marginVertical: 10 },
  stripeGold: { flex: 2, backgroundColor: C.gold }, stripeViolet: { flex: 3, backgroundColor: C.violet }, stripeOrange: { flex: 2, backgroundColor: C.orange },
  hInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  goldLabel: { fontSize: 8, fontWeight: 800, color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 3 },
  hClient: { fontSize: 13, fontWeight: 800, color: C.white },
  hSub: { fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  hRight: { alignItems: 'flex-end' },

  totalsBox: { marginTop: 12, borderWidth: 1, borderColor: C.border, borderRadius: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
  totalLabel: { fontSize: 9, color: C.muted, fontWeight: 600 },
  totalVal: { fontSize: 10, fontWeight: 800, color: C.text },

  sectionTitle: { fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 6 },
  supplierName: { fontSize: 11, fontWeight: 800, color: C.violet, marginTop: 10, marginBottom: 4 },

  poBox: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 10, marginBottom: 8 },
  poTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  poRef: { fontSize: 10, fontWeight: 800, color: C.text },
  poMeta: { fontSize: 8, color: C.muted },
  poAmtRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  poAmt: { fontSize: 9, fontWeight: 700, color: C.text },
  poOut: { fontSize: 9, fontWeight: 800, color: C.orange },

  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottomWidth: 0.3, borderBottomColor: C.border },
  lineDesc: { flex: 1, fontSize: 8.5, color: C.text, paddingRight: 6 },
  lineQty: { fontSize: 8, color: C.muted, width: 120, textAlign: 'right' },
  lineTot: { fontSize: 8.5, fontWeight: 700, color: C.text, width: 70, textAlign: 'right' },

  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
  payText: { fontSize: 8, color: C.muted },
  payAmt: { fontSize: 8.5, fontWeight: 700, color: C.green },

  badge: { fontSize: 8, fontWeight: 700, marginTop: 4 },
  subLabel: { fontSize: 7, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6, marginBottom: 2 },
});

const PO_STATUS: Record<string, string> = { open: 'Ouverte', closed: 'Soldée', cancelled: 'Annulée' };

export function MissionReportPDF({ report }: { report: ProcMissionReport }) {
  const m = report.mission;
  const clientName = m.client.company_name || `${m.client.first_name ?? ''} ${m.client.last_name ?? ''}`.trim() || 'Client';
  const period = [m.started_on, m.ended_on].filter(Boolean).join(' > ') || '-';

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed>
          <View style={s.brandRow}>
            <View>
              <Text style={s.brand}>Bonzini</Text>
              <Text style={s.brandSub}>Centrale d'achat - sourcing Chine</Text>
            </View>
            <View>
              <Text style={s.docLabel}>Document</Text>
              <Text style={s.docTitle}>Rapport de mission</Text>
            </View>
          </View>
          <View style={s.stripe}><View style={s.stripeGold} /><View style={s.stripeViolet} /><View style={s.stripeOrange} /></View>
          <View style={s.hInfo}>
            <View>
              <Text style={s.goldLabel}>Mission</Text>
              <Text style={s.hClient}>{san(m.label)}</Text>
              <Text style={s.hSub}>{san(m.reference)} - {san(clientName)}</Text>
              {m.location ? <Text style={s.hSub}>{san(m.location)}</Text> : null}
            </View>
            <View style={s.hRight}>
              <Text style={s.goldLabel}>Période</Text>
              <Text style={s.hSub}>{san(period)}</Text>
            </View>
          </View>
        </View>

        {/* Totaux */}
        <View style={s.totalsBox}>
          <View style={s.totalRow}><Text style={s.totalLabel}>Commandé</Text><Text style={s.totalVal}>{money(report.totals.ordered_by_currency)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Payé</Text><Text style={s.totalVal}>{money(report.totals.paid_by_currency)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Reste à payer</Text><Text style={[s.totalVal, { color: C.orange }]}>{money(report.totals.outstanding_by_currency)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Commission</Text><Text style={[s.totalVal, { color: C.violet }]}>{money(report.totals.commission_by_currency)}</Text></View>
          <View style={[s.totalRow, { borderBottomWidth: 0 }]}><Text style={s.totalLabel}>Frais</Text><Text style={s.totalVal}>{money(report.totals.expenses_by_currency)}</Text></View>
        </View>

        {/* Fournisseurs / commandes */}
        <Text style={s.sectionTitle}>Fournisseurs & commandes</Text>
        {report.suppliers.length === 0 ? (
          <Text style={{ fontSize: 9, color: C.muted }}>Aucune commande enregistrée.</Text>
        ) : report.suppliers.map((sup) => (
          <View key={sup.supplier_id} wrap={false}>
            <Text style={s.supplierName}>{san(sup.display_name)}{sup.city ? ` - ${san(sup.city)}` : ''}</Text>
            {sup.purchase_orders.map((po) => (
              <View key={po.purchase_order_id} style={s.poBox} wrap={false}>
                <View style={s.poTop}>
                  <Text style={s.poRef}>{san(po.reference)}</Text>
                  <Text style={s.poMeta}>{PO_STATUS[po.status] ?? po.status}{po.incoterm ? ` - ${po.incoterm}` : ''}{po.production_status ? ` - ${po.production_status}` : ''}</Text>
                </View>
                <View style={s.poAmtRow}>
                  <Text style={s.poAmt}>Total {fmtNum(po.total_amount)} {po.currency}  -  payé {fmtNum(po.paid_amount)}</Text>
                  <Text style={s.poOut}>reste {fmtNum(po.outstanding_amount)} {po.currency}</Text>
                </View>

                {po.order_lines.length > 0 && (
                  <>
                    <Text style={s.subLabel}>Lignes</Text>
                    {po.order_lines.map((l) => (
                      <View key={l.id} style={s.lineRow}>
                        <Text style={s.lineDesc}>{san(l.description)}</Text>
                        <Text style={s.lineQty}>{fmtNum(l.quantity)}{l.unit ? ` ${san(l.unit)}` : ''} x {fmtNum(l.unit_price)}</Text>
                        <Text style={s.lineTot}>{fmtNum(l.line_total)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {po.payments.length > 0 && (
                  <>
                    <Text style={s.subLabel}>Paiements</Text>
                    {po.payments.map((p) => (
                      <View key={p.id} style={s.payRow}>
                        <Text style={s.payText}>{san(p.leg)} - {san(p.method)} - {new Date(p.occurred_at).toLocaleDateString('fr-FR')}</Text>
                        <Text style={s.payAmt}>{fmtNum(p.amount)} {p.currency}</Text>
                      </View>
                    ))}
                  </>
                )}

                {(po.qc.length > 0 || po.commission) && (
                  <Text style={[s.badge, { color: C.muted }]}>
                    {po.qc.map((q) => `QC ${q.inspection_type}: ${q.result}`).join('  -  ')}
                    {po.commission ? `${po.qc.length ? '  -  ' : ''}Commission ${fmtNum(po.commission.computed_amount ?? 0)} ${po.commission.currency}` : ''}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}

        {/* Commissions mission + frais */}
        {(report.mission_commissions.length > 0 || report.expenses.length > 0) && (
          <>
            <Text style={s.sectionTitle}>Commission & frais (mission)</Text>
            {report.mission_commissions.map((c) => (
              <View key={c.id} style={s.totalRow}>
                <Text style={s.totalLabel}>Commission ({c.input_mode === 'percentage' ? `${c.input_value}%` : 'fixe'})</Text>
                <Text style={[s.totalVal, { color: C.violet }]}>{fmtNum(c.computed_amount ?? 0)} {c.currency}</Text>
              </View>
            ))}
            {report.expenses.map((e) => (
              <View key={e.id} style={s.totalRow}>
                <Text style={s.totalLabel}>{san(e.category)}{e.billable_to_client ? ' (refacturable)' : ''}</Text>
                <Text style={s.totalVal}>{fmtNum(e.amount)} {e.currency}</Text>
              </View>
            ))}
          </>
        )}

        <PDFFooter />
      </Page>
    </Document>
  );
}
