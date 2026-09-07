// ============================================================
// BatchPaymentsPDF — l'export de TOUS les paiements en cours.
//
// Une page de synthèse (compte, total, tableau), puis UNE page par paiement.
// Cette page-là n'est plus définie ici : c'est `PaymentInstructionPage`, la
// même que celle du bouton « Instruction de paiement » de la fiche. Deux
// chemins, un seul document — ce que le partenaire reçoit ne peut pas
// dépendre de la façon dont on l'a produit.
//
// Bilingue EN / 中文, aucun libellé français : ce document sort de la maison.
// ============================================================
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors } from '../styles';
import { formatRMB } from '../helpers';
import '../fonts';
import {
  FONT,
  BilingualFooter,
  PaymentInstructionPage,
  formatDateIso,
  methodLabel,
  type PaymentInstructionEntry,
} from './PaymentInstructionPDF';

/** Une entrée du lot est une instruction de paiement — même forme, même contenu. */
export type BatchPaymentEntry = PaymentInstructionEntry;

// ── Styles propres à la page de SYNTHÈSE ────────────────────
// (ceux de la page de détail vivent avec elle, dans PaymentInstructionPDF.)
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },

  summaryHeader: {
    backgroundColor: colors.violetDark,
    padding: 18,
    paddingBottom: 14,
    marginHorizontal: -30,
    marginTop: -30,
    marginBottom: 18,
    alignItems: 'center',
  },
  summaryTitleEn: { fontSize: 18, fontFamily: FONT, fontWeight: 400, color: colors.white, letterSpacing: 1 },
  summaryTitleZh: {
    fontSize: 14,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.white,
    opacity: 0.9,
    marginTop: 2,
  },
  summarySubtitle: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.white,
    opacity: 0.7,
    marginTop: 6,
  },

  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 18 },
  statBox: {
    alignItems: 'center',
    backgroundColor: colors.violetLight,
    borderWidth: 1.5,
    borderColor: colors.violet,
    borderRadius: 8,
    padding: 14,
    minWidth: 150,
  },
  statLabelEn: {
    fontSize: 8,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statLabelZh: { fontSize: 9, fontFamily: FONT, fontWeight: 400, color: colors.muted, marginTop: 1 },
  statValue: { fontSize: 22, fontFamily: FONT, fontWeight: 400, color: colors.violet, marginTop: 6 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6, marginBottom: 8 },
  sectionTitleEn: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  sectionTitleZh: { fontSize: 10, fontFamily: FONT, fontWeight: 400, color: colors.gold },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.violetDark,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderCell: { fontSize: 8, fontFamily: FONT, fontWeight: 400, color: colors.white, lineHeight: 1.25 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: { backgroundColor: colors.light },
  tableCell: { fontSize: 10, fontFamily: FONT, fontWeight: 400, color: colors.text },
  colRef: { width: '34%' },
  colMethod: { width: '26%' },
  colDate: { width: '20%' },
  colAmount: { width: '20%', textAlign: 'right' },

  totalRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 8,
    backgroundColor: colors.violetLight,
    borderWidth: 1,
    borderColor: colors.violet,
    borderRadius: 4,
    marginTop: 6,
    alignItems: 'center',
  },
  totalLabel: { fontSize: 10, fontFamily: FONT, fontWeight: 400, color: colors.violet, flex: 1 },
  totalValue: { fontSize: 12, fontFamily: FONT, fontWeight: 400, color: colors.violet },
});

interface BatchPaymentsPDFProps {
  payments: BatchPaymentEntry[];
  generatedAt?: Date;
}

export function BatchPaymentsPDF({ payments, generatedAt }: BatchPaymentsPDFProps) {
  const totalRMB = payments.reduce((sum, p) => sum + (p.amount_rmb || 0), 0);
  const generatedAtStr = formatDateIso(generatedAt ?? new Date());

  return (
    <Document>
      {/* ═══════════════ Page de synthèse ═══════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitleEn}>PENDING PAYMENTS</Text>
          <Text style={styles.summaryTitleZh}>待处理付款</Text>
          <Text style={styles.summarySubtitle}>
            Generated on {generatedAtStr} · 生成日期 {generatedAtStr}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabelEn}>Count</Text>
            <Text style={styles.statLabelZh}>数量</Text>
            <Text style={styles.statValue}>{payments.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabelEn}>Total (RMB)</Text>
            <Text style={styles.statLabelZh}>总额</Text>
            <Text style={styles.statValue}>¥{formatRMB(totalRMB)}</Text>
          </View>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitleEn}>PAYMENT DETAILS</Text>
          <Text style={styles.sectionTitleZh}>· 付款明细</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colRef]}>Reference{'\n'}参考号</Text>
          <Text style={[styles.tableHeaderCell, styles.colMethod]}>Method{'\n'}方式</Text>
          <Text style={[styles.tableHeaderCell, styles.colDate]}>Date{'\n'}日期</Text>
          <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount (¥){'\n'}金额</Text>
        </View>

        {payments.map((payment, index) => (
          <View key={payment.id} style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}>
            <Text style={[styles.tableCell, styles.colRef]}>{payment.reference}</Text>
            <Text style={[styles.tableCell, styles.colMethod]}>{methodLabel(payment.method)}</Text>
            <Text style={[styles.tableCell, styles.colDate]}>{formatDateIso(payment.created_at)}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>{formatRMB(payment.amount_rmb)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL · 合计</Text>
          <Text style={styles.totalValue}>¥{formatRMB(totalRMB)}</Text>
        </View>

        <BilingualFooter />
      </Page>

      {/* ═══════ Une page par paiement — la MÊME que l'unitaire ═══════ */}
      {payments.map((payment, index) => (
        <PaymentInstructionPage
          key={payment.id}
          entry={payment}
          position={{ index: index + 1, total: payments.length }}
        />
      ))}
    </Document>
  );
}
