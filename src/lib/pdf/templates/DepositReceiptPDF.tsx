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
} from '../helpers';
import '../fonts';

const styles = StyleSheet.create({
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  section: {
    marginBottom: 14,
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
  const statusColor = getStatusColor(data.status);

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
        <PDFHeader title="FICHE DE DÉPÔT" reference={data.reference} />

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{getStatusLabel(data.status)}</Text>
        </View>

        {/* Amount */}
        <PDFAmountBox
          label="MONTANT DU DÉPÔT"
          amount={`${formatXAF(data.amount_xaf)} XAF`}
          secondaryItems={secondaryItems}
        />

        {/* Summary section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>
          <PDFInfoRow label="Référence" value={data.reference} />
          <PDFInfoRow label="Statut" value={getStatusLabel(data.status)} />
          <PDFInfoRow label="Date de création" value={formatDate(data.created_at)} />
          {data.validated_at && (
            <PDFInfoRow label="Date validation" value={formatDate(data.validated_at)} />
          )}
          <PDFInfoRow label="Mode de dépôt" value={getDepositMethodLabel(data.method)} />
          {data.bank_name && <PDFInfoRow label="Banque" value={data.bank_name} />}
          {data.agency_name && <PDFInfoRow label="Agence" value={data.agency_name} />}
        </View>

        {/* Client section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <PDFInfoRow label="Nom" value={data.client_name} />
          {data.client_phone && <PDFInfoRow label="Téléphone" value={data.client_phone} />}
          {data.client_email && <PDFInfoRow label="E-mail" value={data.client_email} />}
          {data.client_country && <PDFInfoRow label="Pays" value={data.client_country} />}
          {data.company_name && <PDFInfoRow label="Entreprise" value={data.company_name} />}
        </View>

        <PDFFooter />
      </Page>
    </Document>
  );
}
