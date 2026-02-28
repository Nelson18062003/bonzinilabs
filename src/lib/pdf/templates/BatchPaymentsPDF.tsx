import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { PDFFooter } from '../components/PDFFooter';
import { colors } from '../styles';
import { formatRMB, getPaymentMethodLabel } from '../helpers';
import '../fonts';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'NotoSansSC',
    fontSize: 10,
    color: colors.text,
  },
  // Summary page
  summaryHeader: {
    backgroundColor: colors.primary,
    padding: 16,
    paddingBottom: 12,
    marginHorizontal: -30,
    marginTop: -30,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 20,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.white,
  },
  summarySubtitle: {
    fontSize: 12,
    color: colors.white,
    marginTop: 6,
    opacity: 0.9,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: colors.bgBlue,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    minWidth: 140,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.muted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.primary,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.white,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.bgLight,
  },
  tableCell: {
    fontSize: 9,
    color: colors.text,
  },
  colIndex: { width: 30 },
  colRef: { width: 120 },
  colMethod: { width: 110 },
  colAmount: { flex: 1, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.bgBlue,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 4,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.primary,
    flex: 1,
  },
  totalValue: {
    fontSize: 10,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.primary,
  },
  // Detail page
  detailHeader: {
    backgroundColor: colors.primary,
    padding: 14,
    marginHorizontal: -30,
    marginTop: -30,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.white,
  },
  detailHeaderRef: {
    fontSize: 10,
    color: colors.white,
    opacity: 0.8,
  },
  amountBigBox: {
    backgroundColor: colors.bgBlue,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountBigLabel: {
    fontSize: 10,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.muted,
    marginBottom: 6,
  },
  amountBig: {
    fontSize: 48,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.primary,
  },
  amountBigUnit: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  infoSection: {
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 11,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.text,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 9,
    color: colors.muted,
    width: 100,
  },
  infoValue: {
    fontSize: 11,
    fontFamily: 'NotoSansSC', fontWeight: 700,
    color: colors.text,
    flex: 1,
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  qrImage: {
    width: 280,
    height: 280,
    objectFit: 'contain',
  },
  qrLabel: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 6,
  },
  // Bank transfer detail - stacked layout with large font
  bankField: {
    marginBottom: 12,
  },
  bankLabel: {
    fontSize: 30,
    fontFamily: 'NotoSansSC',
    color: colors.muted,
    marginBottom: 4,
  },
  bankValue: {
    fontSize: 35,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: colors.text,
  },
});

export interface BatchPaymentEntry {
  id: string;
  reference: string;
  amount_rmb: number;
  method: string;
  beneficiary_name?: string | null;
  beneficiary_phone?: string | null;
  beneficiary_email?: string | null;
  beneficiary_bank_name?: string | null;
  beneficiary_bank_account?: string | null;
  beneficiary_qr_code_url?: string | null;
}

interface BatchPaymentsPDFProps {
  payments: BatchPaymentEntry[];
  generatedAt?: Date;
}

export function BatchPaymentsPDF({ payments, generatedAt }: BatchPaymentsPDFProps) {
  const totalRMB = payments.reduce((sum, p) => sum + p.amount_rmb, 0);

  return (
    <Document>
      {/* Page 1: Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>PAIEMENTS EN COURS</Text>
          <Text style={styles.summarySubtitle}>
            Export du {generatedAt ? generatedAt.toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>NOMBRE DE PAIEMENTS</Text>
            <Text style={styles.statValue}>{payments.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL RMB</Text>
            <Text style={styles.statValue}>{formatRMB(totalRMB)}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colIndex]}>#</Text>
          <Text style={[styles.tableHeaderText, styles.colRef]}>Référence</Text>
          <Text style={[styles.tableHeaderText, styles.colMethod]}>Méthode</Text>
          <Text style={[styles.tableHeaderText, styles.colAmount]}>Montant RMB</Text>
        </View>

        {payments.map((payment, index) => (
          <View
            key={payment.id}
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : undefined]}
          >
            <Text style={[styles.tableCell, styles.colIndex]}>{index + 1}</Text>
            <Text style={[styles.tableCell, styles.colRef]}>{payment.reference}</Text>
            <Text style={[styles.tableCell, styles.colMethod]}>{getPaymentMethodLabel(payment.method)}</Text>
            <Text style={[styles.tableCell, styles.colAmount, { fontFamily: 'NotoSansSC', fontWeight: 700 }]}>
              {formatRMB(payment.amount_rmb)}
            </Text>
          </View>
        ))}

        {/* Total row */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>{formatRMB(totalRMB)} RMB</Text>
        </View>

        <PDFFooter confidential />
      </Page>

      {/* Detail pages: 1 per payment */}
      {payments.map((payment, index) => (
        <Page key={payment.id} size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <Text style={styles.detailHeaderTitle}>
              PAIEMENT {index + 1} / {payments.length}
            </Text>
            <Text style={styles.detailHeaderRef}>{payment.reference}</Text>
          </View>

          {/* Big amount */}
          <View style={styles.amountBigBox}>
            <Text style={styles.amountBigLabel}>MONTANT À ENVOYER</Text>
            <Text style={styles.amountBig}>{formatRMB(payment.amount_rmb)}</Text>
            <Text style={styles.amountBigUnit}>RMB</Text>
          </View>

          {/* Method */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>{getPaymentMethodLabel(payment.method)}</Text>

            {/* Bank transfer details - large stacked layout */}
            {payment.method === 'bank_transfer' && (
              <>
                {payment.beneficiary_name && (
                  <View style={styles.bankField}>
                    <Text style={styles.bankLabel}>Nom</Text>
                    <Text style={styles.bankValue}>{payment.beneficiary_name}</Text>
                  </View>
                )}
                {payment.beneficiary_bank_name && (
                  <View style={styles.bankField}>
                    <Text style={styles.bankLabel}>Banque</Text>
                    <Text style={styles.bankValue}>{payment.beneficiary_bank_name}</Text>
                  </View>
                )}
                {payment.beneficiary_bank_account && (
                  <View style={styles.bankField}>
                    <Text style={styles.bankLabel}>N° de compte</Text>
                    <Text style={styles.bankValue}>{payment.beneficiary_bank_account}</Text>
                  </View>
                )}
                {payment.beneficiary_phone && (
                  <View style={styles.bankField}>
                    <Text style={styles.bankLabel}>Téléphone</Text>
                    <Text style={styles.bankValue}>{payment.beneficiary_phone}</Text>
                  </View>
                )}
              </>
            )}

            {/* Alipay/WeChat details */}
            {(payment.method === 'alipay' || payment.method === 'wechat') && (
              <>
                {payment.beneficiary_qr_code_url ? (
                  <View style={styles.qrContainer}>
                    <Image src={payment.beneficiary_qr_code_url} style={styles.qrImage} />
                    <Text style={styles.qrLabel}>
                      QR Code {getPaymentMethodLabel(payment.method)}
                    </Text>
                  </View>
                ) : (
                  <>
                    {payment.beneficiary_name && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Nom</Text>
                        <Text style={styles.infoValue}>{payment.beneficiary_name}</Text>
                      </View>
                    )}
                    {payment.beneficiary_phone && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Téléphone</Text>
                        <Text style={styles.infoValue}>{payment.beneficiary_phone}</Text>
                      </View>
                    )}
                    {payment.beneficiary_email && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{payment.beneficiary_email}</Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>

          <PDFFooter confidential />
        </Page>
      ))}
    </Document>
  );
}
