import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader } from '../components/PDFHeader';
import { PDFFooter } from '../components/PDFFooter';
import { PDFInfoRow } from '../components/PDFInfoRow';
import { PDFAmountBox } from '../components/PDFAmountBox';
import { baseStyles, colors } from '../styles';
import {
  formatXAF,
  formatDate,
  getDepositMethodLabel,
  getStatusLabel,
  getStatusColor,
  getStatusBgColor,
} from '../helpers';
import '../fonts';

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'DM Sans',
    fontWeight: 800,
  },
  statusDate: {
    fontSize: 11,
    fontFamily: 'DM Sans',
    fontWeight: 400,
    color: colors.muted,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'DM Sans',
    fontWeight: 800,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 18,
    marginBottom: 8,
  },
});

export interface DepositReceiptData {
  id: string;
  reference: string;
  created_at: string;
  validated_at?: string | null;
  amount_xaf: number;
  confirmed_amount_xaf?: number | null;
  method: string;
  status: string;
  bank_name?: string | null;
  agency_name?: string | null;
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_country?: string | null;
  company_name?: string | null;
}

export function DepositReceiptPDF({ data }: { data: DepositReceiptData }) {
  const statusLabel = getStatusLabel(data.status);
  const statusColor = getStatusColor(data.status);
  const statusBg = getStatusBgColor(data.status);
  const dateDisplay = data.validated_at || data.created_at;

  const secondaryItems: Array<{ label: string; value: string }> = [];
  if (data.confirmed_amount_xaf && data.confirmed_amount_xaf !== data.amount_xaf) {
    secondaryItems.push({
      label: 'Montant confirmé',
      value: `${formatXAF(data.confirmed_amount_xaf)} XAF`,
    });
  }

  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader type="depot" reference={data.reference} />

        {/* Statut + date */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.statusDate}>{formatDate(dateDisplay)}</Text>
        </View>

        {/* Bloc montant */}
        <PDFAmountBox
          amount={formatXAF(data.amount_xaf)}
          secondaryItems={secondaryItems}
        />

        {/* Section TRANSACTION */}
        <Text style={styles.sectionTitle}>Transaction</Text>
        <PDFInfoRow label="Mode de dépôt" value={getDepositMethodLabel(data.method)} />
        {data.agency_name && <PDFInfoRow label="Agence" value={data.agency_name} />}
        {data.bank_name && <PDFInfoRow label="Banque" value={data.bank_name} />}
        <PDFInfoRow label="Date de création" value={formatDate(data.created_at)} />
        {data.validated_at && (
          <PDFInfoRow label="Date de validation" value={formatDate(data.validated_at)} />
        )}

        {/* Section CLIENT */}
        <Text style={styles.sectionTitle}>Client</Text>
        <PDFInfoRow label="Nom" value={data.client_name} bold />
        {data.client_phone && <PDFInfoRow label="Téléphone" value={data.client_phone} />}
        {data.client_email && <PDFInfoRow label="Email" value={data.client_email} />}
        {data.client_country && <PDFInfoRow label="Pays" value={data.client_country} />}
        {data.company_name && <PDFInfoRow label="Entreprise" value={data.company_name} />}

        <PDFFooter />
      </Page>
    </Document>
  );
}
