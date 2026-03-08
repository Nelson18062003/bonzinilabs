import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader } from '../components/PDFHeader';
import { PDFFooter } from '../components/PDFFooter';
import { PDFInfoRow } from '../components/PDFInfoRow';
import { PDFAmountBox } from '../components/PDFAmountBox';
import { baseStyles, colors } from '../styles';
import {
  formatXAF,
  formatDate,
  formatRateDisplay,
  getPaymentMethodLabel,
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
  signatureContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  signatureSubtitle: {
    fontSize: 10,
    fontFamily: 'DM Sans',
    fontWeight: 400,
    color: colors.muted,
    marginBottom: 10,
  },
  signatureImage: {
    width: 220,
    height: 100,
    objectFit: 'contain',
    marginBottom: 8,
  },
  signatureFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  signatureBy: {
    fontSize: 9,
    fontFamily: 'DM Sans',
    color: colors.muted,
  },
  signatureByName: {
    fontSize: 10,
    fontFamily: 'DM Sans',
    fontWeight: 700,
    color: colors.text,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 24,
  },
  qrTitle: {
    fontSize: 10,
    fontFamily: 'DM Sans',
    fontWeight: 800,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  qrBeneficiaryName: {
    fontSize: 14,
    fontFamily: 'DM Sans',
    fontWeight: 700,
    color: colors.text,
    marginBottom: 12,
  },
  qrImage: {
    width: 300,
    height: 300,
    objectFit: 'contain',
  },
  qrCaption: {
    fontSize: 10,
    fontFamily: 'DM Sans',
    fontWeight: 400,
    color: colors.muted,
    marginTop: 8,
  },
  proofContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  proofLabel: {
    fontSize: 10,
    fontFamily: 'DM Sans',
    color: colors.muted,
    marginBottom: 12,
    textAlign: 'center',
  },
  proofImage: {
    maxWidth: '100%',
    maxHeight: 600,
    objectFit: 'contain',
  },
  pdfProofsContainer: {
    padding: 24,
  },
  pdfProofItem: {
    fontSize: 11,
    fontFamily: 'DM Sans',
    color: colors.text,
    marginBottom: 8,
  },
});

export interface AdminProofItem {
  file_url: string;
  file_type: string | null;
  file_name: string;
  created_at: string;
}

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
  cashPaymentQrDataUrl?: string | null;
  cash_signature_url?: string | null;
  cash_signed_by_name?: string | null;
  cash_signature_timestamp?: string | null;
  adminProofs?: AdminProofItem[];
}

const isImageProof = (proof: AdminProofItem): boolean => {
  const type = proof.file_type ?? '';
  const name = proof.file_name.toLowerCase();
  return type.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/.test(name);
};

// Couleur associée au mode de paiement
const getMethodColor = (method: string): string => {
  const map: Record<string, string> = {
    alipay: colors.alipay,
    wechat: colors.wechat,
    bank_transfer: colors.violet,
    cash: colors.orange,
  };
  return map[method] || colors.text;
};

export function PaymentReceiptPDF({ data }: { data: PaymentReceiptData }) {
  const statusLabel = getStatusLabel(data.status);
  const statusColor = getStatusColor(data.status);
  const statusBg = getStatusBgColor(data.status);
  const dateDisplay = data.processed_at || data.created_at;

  const rateDisplay = data.exchange_rate ? formatRateDisplay(data.exchange_rate) : 'Non défini';
  const cnyDisplay = data.amount_rmb ? `\u00a5${formatXAF(Math.round(data.amount_rmb))}` : '';
  const methodColor = getMethodColor(data.method);

  const hasQrCode = !!data.beneficiary_qr_code_url;
  const imageProofs = (data.adminProofs ?? []).filter(isImageProof);
  const pdfProofs = (data.adminProofs ?? []).filter(p => !isImageProof(p));

  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader type="paiement" reference={data.reference} />

        {/* Statut + date */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.statusDate}>{formatDate(dateDisplay)}</Text>
        </View>

        {/* Bloc montant avec sous-infos CNY + taux */}
        <PDFAmountBox
          amount={formatXAF(data.amount_xaf)}
          secondaryItems={
            cnyDisplay
              ? [
                  { label: 'Montant envoyé', value: cnyDisplay },
                  { label: 'Taux appliqué', value: rateDisplay },
                ]
              : undefined
          }
        />

        {/* Section TRANSACTION */}
        <Text style={styles.sectionTitle}>Transaction</Text>
        <PDFInfoRow
          label="Mode de paiement"
          value={getPaymentMethodLabel(data.method)}
          bold
          color={methodColor}
        />
        <PDFInfoRow label="Date de création" value={formatDate(data.created_at)} />
        {data.processed_at && (
          <PDFInfoRow label="Date de traitement" value={formatDate(data.processed_at)} />
        )}

        {/* Section CLIENT */}
        <Text style={styles.sectionTitle}>Client</Text>
        <PDFInfoRow label="Nom" value={data.client_name} bold />
        {data.client_phone && <PDFInfoRow label="Téléphone" value={data.client_phone} />}
        {data.client_email && <PDFInfoRow label="Email" value={data.client_email} />}
        {data.client_country && <PDFInfoRow label="Pays" value={data.client_country} />}

        {/* Section BÉNÉFICIAIRE — adaptatif selon le mode */}
        {(data.beneficiary_name || data.beneficiary_phone || data.beneficiary_email ||
          data.beneficiary_bank_name) && (
          <>
            <Text style={styles.sectionTitle}>Bénéficiaire</Text>
            {data.beneficiary_name && (
              <PDFInfoRow label="Nom" value={data.beneficiary_name} bold />
            )}

            {/* Alipay */}
            {data.method === 'alipay' && data.beneficiary_email && (
              <PDFInfoRow
                label="Identifiant Alipay"
                value={data.beneficiary_email}
                color={colors.alipay}
              />
            )}

            {/* WeChat */}
            {data.method === 'wechat' && data.beneficiary_phone && (
              <PDFInfoRow
                label="Identifiant WeChat"
                value={data.beneficiary_phone}
                color={colors.wechat}
              />
            )}

            {/* Virement bancaire */}
            {data.method === 'bank_transfer' && (
              <>
                {data.beneficiary_bank_name && (
                  <PDFInfoRow label="Banque" value={data.beneficiary_bank_name} />
                )}
                {data.beneficiary_bank_account && (
                  <PDFInfoRow label="N° de compte" value={data.beneficiary_bank_account} />
                )}
                {data.beneficiary_email && (
                  <PDFInfoRow label="Email" value={data.beneficiary_email} />
                )}
              </>
            )}

            {/* Cash */}
            {data.method === 'cash' && data.beneficiary_phone && (
              <PDFInfoRow label="Téléphone" value={data.beneficiary_phone} />
            )}
          </>
        )}

        {/* Signature (Cash uniquement) */}
        {data.cash_signature_url && (
          <View style={styles.signatureContainer}>
            <Text style={styles.sectionTitle}>Signature du bénéficiaire</Text>
            <Text style={styles.signatureSubtitle}>
              Confirme la réception du paiement en espèces
            </Text>
            <Image src={data.cash_signature_url} style={styles.signatureImage} />
            <View style={styles.signatureFooterRow}>
              <Text style={styles.signatureBy}>
                Signé par{' '}
                <Text style={styles.signatureByName}>
                  {data.cash_signed_by_name || data.beneficiary_name || '—'}
                </Text>
              </Text>
              {data.cash_signature_timestamp && (
                <Text style={styles.statusDate}>
                  {formatDate(data.cash_signature_timestamp)}
                </Text>
              )}
            </View>
          </View>
        )}

        <PDFFooter />
      </Page>

      {/* Page QR code bénéficiaire (Alipay / WeChat) */}
      {hasQrCode && (
        <Page size="A4" style={baseStyles.page}>
          <PDFHeader type="paiement" reference={data.reference} />
          <View style={styles.qrContainer}>
            <Text style={styles.qrTitle}>QR Code Bénéficiaire</Text>
            {data.beneficiary_name && (
              <Text style={styles.qrBeneficiaryName}>{data.beneficiary_name}</Text>
            )}
            <Image src={data.beneficiary_qr_code_url!} style={styles.qrImage} />
            <Text style={styles.qrCaption}>
              {getPaymentMethodLabel(data.method)} — {cnyDisplay}
            </Text>
          </View>
          <PDFFooter />
        </Page>
      )}

      {/* Pages preuves images (1 page par preuve) */}
      {imageProofs.map((proof, index) => (
        <Page key={proof.file_url} size="A4" style={baseStyles.page}>
          <PDFHeader type="paiement" reference={data.reference} />
          <View style={styles.proofContainer}>
            <Text style={styles.proofLabel}>
              Preuve {index + 1} / {imageProofs.length} — {formatDate(proof.created_at)}
            </Text>
            <Image src={proof.file_url} style={styles.proofImage} />
          </View>
          <PDFFooter />
        </Page>
      ))}

      {/* Page listant les preuves PDF si présentes */}
      {pdfProofs.length > 0 && (
        <Page size="A4" style={baseStyles.page}>
          <PDFHeader type="paiement" reference={data.reference} />
          <View style={styles.pdfProofsContainer}>
            <Text style={[styles.proofLabel, { fontSize: 12, marginBottom: 16 }]}>
              Documents joints ({pdfProofs.length} fichier{pdfProofs.length > 1 ? 's' : ''}) :
            </Text>
            {pdfProofs.map((proof, index) => (
              <Text key={proof.file_url} style={styles.pdfProofItem}>
                {index + 1}. {proof.file_name} — {formatDate(proof.created_at)}
              </Text>
            ))}
          </View>
          <PDFFooter />
        </Page>
      )}
    </Document>
  );
}
