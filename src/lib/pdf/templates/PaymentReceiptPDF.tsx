import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader } from '../components/PDFHeader';
import { PDFFooter } from '../components/PDFFooter';
import { PDFInfoRow } from '../components/PDFInfoRow';
import { PDFAmountBox } from '../components/PDFAmountBox';
import { baseStyles, colors } from '../styles';
import {
  formatXAF,
  formatRMB,
  formatDate,
  getPaymentMethodLabel,
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
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: colors.white,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: colors.text,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  section: {
    marginBottom: 14,
  },
  qrCodeContainer: {
    alignItems: 'center',
    padding: 20,
  },
  qrCodeImage: {
    width: 300,
    height: 300,
    objectFit: 'contain',
  },
  qrCodeLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 8,
    textAlign: 'center',
  },
});

export interface PaymentReceiptData {
  id: string;
  reference: string;
  created_at: string;
  processed_at?: string | null;
  amount_xaf: number;
  amount_rmb: number;
  exchange_rate: number;
  method: string;
  status: string;
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_country?: string | null;
  beneficiary_name?: string | null;
  beneficiary_phone?: string | null;
  beneficiary_email?: string | null;
  beneficiary_bank_name?: string | null;
  beneficiary_bank_account?: string | null;
  beneficiary_qr_code_url?: string | null;
}

export function PaymentReceiptPDF({ data }: { data: PaymentReceiptData }) {
  const statusColor = getStatusColor(data.status);
  const rateDisplay = data.exchange_rate
    ? `1 RMB = ${formatXAF(Math.round(1 / data.exchange_rate))} XAF`
    : 'Non défini';

  const hasQrCode = !!data.beneficiary_qr_code_url;

  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader title="FICHE DE PAIEMENT" reference={data.reference} />

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{getStatusLabel(data.status)}</Text>
        </View>

        {/* Amounts */}
        <PDFAmountBox
          label="MONTANTS"
          amount={`${formatXAF(data.amount_xaf)} XAF`}
          secondaryItems={[
            { label: 'Montant envoyé', value: `${formatRMB(data.amount_rmb)} RMB` },
            { label: 'Taux de change', value: rateDisplay },
          ]}
        />

        {/* Summary section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>
          <PDFInfoRow label="Référence" value={data.reference} />
          <PDFInfoRow label="Statut" value={getStatusLabel(data.status)} />
          <PDFInfoRow label="Date de création" value={formatDate(data.created_at)} />
          {data.processed_at && (
            <PDFInfoRow label="Date traitement" value={formatDate(data.processed_at)} />
          )}
          <PDFInfoRow label="Mode de paiement" value={getPaymentMethodLabel(data.method)} />
          <PDFInfoRow label="Taux de change" value={rateDisplay} />
        </View>

        {/* Client section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <PDFInfoRow label="Nom" value={data.client_name} />
          {data.client_phone && <PDFInfoRow label="Téléphone" value={data.client_phone} />}
          {data.client_email && <PDFInfoRow label="E-mail" value={data.client_email} />}
          {data.client_country && <PDFInfoRow label="Pays" value={data.client_country} />}
        </View>

        {/* Beneficiary section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bénéficiaire</Text>
          {data.beneficiary_name && <PDFInfoRow label="Nom" value={data.beneficiary_name} />}
          {data.beneficiary_phone && <PDFInfoRow label="Téléphone" value={data.beneficiary_phone} />}
          {data.beneficiary_email && <PDFInfoRow label="Email" value={data.beneficiary_email} />}
          {data.beneficiary_bank_name && <PDFInfoRow label="Banque" value={data.beneficiary_bank_name} />}
          {data.beneficiary_bank_account && <PDFInfoRow label="N° de compte" value={data.beneficiary_bank_account} />}
          {!data.beneficiary_name && !data.beneficiary_phone && !data.beneficiary_email && !data.beneficiary_bank_name && (
            <PDFInfoRow label="Info" value="Non renseigné" />
          )}
        </View>

        <PDFFooter />
      </Page>

      {/* Page 2: QR Code if present */}
      {hasQrCode && (
        <Page size="A4" style={baseStyles.page}>
          <PDFHeader title="QR CODE BÉNÉFICIAIRE" reference={data.reference} />
          <View style={styles.qrCodeContainer}>
            {data.beneficiary_name && (
              <Text style={{ fontSize: 14, fontFamily: 'NotoSansSC', fontWeight: 700, color: colors.text, marginBottom: 12 }}>
                {data.beneficiary_name}
              </Text>
            )}
            <Image src={data.beneficiary_qr_code_url!} style={styles.qrCodeImage} />
            <Text style={styles.qrCodeLabel}>
              {getPaymentMethodLabel(data.method)} — {formatRMB(data.amount_rmb)} RMB
            </Text>
          </View>
          <PDFFooter />
        </Page>
      )}
    </Document>
  );
}
