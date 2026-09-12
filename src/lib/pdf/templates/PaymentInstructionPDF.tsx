// ============================================================
// L'INSTRUCTION DE PAIEMENT — la page que le partenaire chinois reçoit.
//
// Elle existait déjà, mais enfermée dans `BatchPaymentsPDF` : on ne pouvait
// l'obtenir qu'en exportant TOUS les paiements en cours, ce qui prend du temps
// et oblige le partenaire à chercher la bonne page dans un document de
// vingt-cinq. Retour utilisateur : « quand je clique sur Export, ça prend trop
// de temps — je veux un bouton sur chaque paiement ».
//
// La page vit donc ICI, et les deux documents la rendent :
//   · `PaymentInstructionPDF` — un paiement, une page (le bouton de la fiche) ;
//   · `BatchPaymentsPDF`      — la page de synthèse, puis cette même page pour
//                               chaque paiement.
// Une seule définition : ce que le partenaire reçoit ne peut plus différer
// selon le chemin emprunté.
//
// Bilingue EN / 中文, police Noto Sans SC (latin + CJK) pour qu'un nom ou une
// banque en chinois ne tombe jamais en glyphes manquants. Aucun libellé
// français : ce document sort de la maison.
// ============================================================
import { Document, Page, View, Text, Image, StyleSheet, Svg, Path } from '@react-pdf/renderer';
import { colors } from '../styles';
import { formatRMB } from '../helpers';
import '../fonts';
import {
  formatDateIso,
  methodLabel,
  usesQrCode,
  type PaymentInstructionEntry,
} from '@/lib/paymentInstruction';

export { methodLabel, formatDateIso, paymentInstructionFilename } from '@/lib/paymentInstruction';
export type { PaymentInstructionEntry } from '@/lib/paymentInstruction';

/** Un seul poids (400) est enregistré dans `fonts.ts` : la hiérarchie se fait
 *  à la taille et à la couleur, jamais à la graisse. */
export const FONT = 'Noto Sans SC';

export const instructionStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },

  header: {
    backgroundColor: colors.violetDark,
    padding: 14,
    marginHorizontal: -30,
    marginTop: -30,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 13, fontFamily: FONT, fontWeight: 400, color: colors.white },
  headerRef: { fontSize: 9, fontFamily: FONT, fontWeight: 400, color: colors.white, opacity: 0.7 },

  amountBox: {
    backgroundColor: colors.violetLight,
    borderWidth: 1.5,
    borderColor: colors.violet,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabelEn: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountLabelZh: { fontSize: 10, fontFamily: FONT, fontWeight: 400, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 42, fontFamily: FONT, fontWeight: 400, color: colors.violet, marginTop: 8 },
  amountUnit: { fontSize: 12, fontFamily: FONT, fontWeight: 400, color: colors.muted, marginTop: 4 },

  infoSection: { marginBottom: 12 },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
  },
  infoTitleEn: { fontSize: 11, fontFamily: FONT, fontWeight: 400, color: colors.text },
  infoTitleZh: { fontSize: 11, fontFamily: FONT, fontWeight: 400, color: colors.muted },

  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 9, fontFamily: FONT, fontWeight: 400, color: colors.muted, marginBottom: 3 },
  fieldValue: { fontSize: 14, fontFamily: FONT, fontWeight: 400, color: colors.text },
  fieldValueMono: {
    fontSize: 16,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.text,
    letterSpacing: 0.5,
  },

  qrContainer: { alignItems: 'center', marginTop: 6, marginBottom: 10 },
  qrImage: { width: 260, height: 260, objectFit: 'contain' },
  qrCaption: { fontSize: 9, fontFamily: FONT, fontWeight: 400, color: colors.muted, marginTop: 6 },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: 8, fontFamily: FONT, fontWeight: 400, color: colors.muted },
  footerBrandText: { fontSize: 8, fontFamily: FONT, fontWeight: 400, color: colors.muted, marginLeft: 4 },
});

function FooterLogo() {
  return (
    <Svg width={12} height={12} viewBox="0 0 100 100">
      <Path d="M50 20 L70 50 L50 80 L30 50 Z" fill="#F3A745" />
      <Path d="M50 30 L62 50 L50 70 L38 50 Z" fill="#A947FE" />
    </Svg>
  );
}

export function BilingualFooter() {
  return (
    <View style={instructionStyles.footer} fixed>
      <Text style={instructionStyles.footerText}>Generated automatically by Bonzini · Bonzini 自动生成</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FooterLogo />
        <Text style={instructionStyles.footerBrandText}>bonzinilabs.com</Text>
      </View>
    </View>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={instructionStyles.field}>
      <Text style={instructionStyles.fieldLabel}>{label}</Text>
      <Text style={mono ? instructionStyles.fieldValueMono : instructionStyles.fieldValue}>{value}</Text>
    </View>
  );
}

/**
 * La page d'instruction d'UN paiement.
 *
 * `position` numérote la page dans un lot (« PAYMENT 3 / 12 ») ; sans elle,
 * l'en-tête reste « PAYMENT · 付款 » — un document d'un seul paiement n'a pas
 * de rang à afficher.
 */
export function PaymentInstructionPage({
  entry,
  position,
}: {
  entry: PaymentInstructionEntry;
  position?: { index: number; total: number };
}) {
  const isQrMethod = usesQrCode(entry.method);
  return (
    <Page size="A4" style={instructionStyles.page}>
      <View style={instructionStyles.header}>
        <Text style={instructionStyles.headerTitle}>
          {position ? `PAYMENT ${position.index} / ${position.total} · 付款` : 'PAYMENT · 付款'}
        </Text>
        <Text style={instructionStyles.headerRef}>{entry.reference}</Text>
      </View>

      <View style={instructionStyles.amountBox}>
        <Text style={instructionStyles.amountLabelEn}>Amount to send</Text>
        <Text style={instructionStyles.amountLabelZh}>付款金额</Text>
        <Text style={instructionStyles.amount}>¥{formatRMB(entry.amount_rmb)}</Text>
        <Text style={instructionStyles.amountUnit}>RMB · 人民币</Text>
      </View>

      <View style={instructionStyles.infoSection}>
        <View style={instructionStyles.infoTitleRow}>
          <Text style={instructionStyles.infoTitleEn}>{methodLabel(entry.method)}</Text>
          <Text style={instructionStyles.infoTitleZh}>· {formatDateIso(entry.created_at)}</Text>
        </View>

        {entry.method === 'bank_transfer' && (
          <>
            {entry.beneficiary_name && <Field label="Beneficiary · 收款人" value={entry.beneficiary_name} />}
            {entry.beneficiary_bank_name && <Field label="Bank · 银行" value={entry.beneficiary_bank_name} />}
            {entry.beneficiary_bank_account && (
              <Field label="Account · 账号" value={entry.beneficiary_bank_account} mono />
            )}
            {entry.beneficiary_bank_extra && (
              <Field label="SWIFT / IBAN · 银行代码" value={entry.beneficiary_bank_extra} />
            )}
            {entry.beneficiary_phone && <Field label="Phone · 电话" value={entry.beneficiary_phone} />}
            {entry.beneficiary_email && <Field label="Email · 邮箱" value={entry.beneficiary_email} />}
            {entry.beneficiary_notes && <Field label="Notes · 备注" value={entry.beneficiary_notes} />}
          </>
        )}

        {isQrMethod && (
          <>
            {entry.beneficiary_qr_code_url && (
              <View style={instructionStyles.qrContainer}>
                <Image src={entry.beneficiary_qr_code_url} style={instructionStyles.qrImage} />
                <Text style={instructionStyles.qrCaption}>QR Code · 二维码 — {methodLabel(entry.method)}</Text>
              </View>
            )}
            {/* Les champs texte restent affichés MÊME avec un QR : un QR illisible
                à l'impression ne doit pas emporter l'information avec lui. */}
            {entry.beneficiary_name && <Field label="Name · 姓名" value={entry.beneficiary_name} />}
            {entry.beneficiary_identifier && (
              <Field
                label={entry.method === 'wechat' ? 'WeChat ID · 微信号' : 'Alipay ID · 支付宝账号'}
                value={entry.beneficiary_identifier}
                mono
              />
            )}
            {entry.beneficiary_phone && <Field label="Phone · 电话" value={entry.beneficiary_phone} />}
            {entry.beneficiary_email && <Field label="Email · 邮箱" value={entry.beneficiary_email} />}
            {entry.beneficiary_notes && <Field label="Notes · 备注" value={entry.beneficiary_notes} />}
          </>
        )}
      </View>

      <BilingualFooter />
    </Page>
  );
}

/** Le document d'UN SEUL paiement — ce que le bouton de la fiche télécharge. */
export function PaymentInstructionPDF({ entry }: { entry: PaymentInstructionEntry }) {
  return (
    <Document>
      <PaymentInstructionPage entry={entry} />
    </Document>
  );
}
