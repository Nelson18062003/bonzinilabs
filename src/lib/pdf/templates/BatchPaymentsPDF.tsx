// ============================================================
// BatchPaymentsPDF — Export bilingue EN / 中文
// Police Noto Sans SC (couvre latin + CJK) → pas de glyphes
// manquants même si beneficiary_name/bank_name sont en chinois.
// Libellés bilingues (anglais + chinois) sur tout le document.
// Aucun libellé français.
// ============================================================
import { Document, Page, View, Text, Image, StyleSheet, Svg, Path } from '@react-pdf/renderer';
import { colors } from '../styles';
import { formatRMB } from '../helpers';
import '../fonts';

// Police unique : Noto Sans SC couvre latin + hiragana + katakana + CJK.
// Un seul poids (400) est enregistré dans fonts.ts → on s'y tient partout
// (hiérarchie visuelle gérée via fontSize et couleur).
const FONT = 'Noto Sans SC';

// ── Style tokens ────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: FONT,
    fontWeight: 400,
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },

  // Summary header
  summaryHeader: {
    backgroundColor: colors.violetDark,
    padding: 18,
    paddingBottom: 14,
    marginHorizontal: -30,
    marginTop: -30,
    marginBottom: 18,
    alignItems: 'center',
  },
  summaryTitleEn: {
    fontSize: 18,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.white,
    letterSpacing: 1,
  },
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

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 18,
  },
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
  statLabelZh: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    marginTop: 1,
  },
  statValue: {
    fontSize: 22,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.violet,
    marginTop: 6,
  },

  // Section title
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  sectionTitleEn: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  sectionTitleZh: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.gold,
  },

  // Table: Ref | Method | Date | ¥
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.violetDark,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.white,
    lineHeight: 1.25,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.light,
  },
  tableCell: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.text,
  },
  // 4 columns: Ref | Mode | Date | ¥
  colRef:    { width: '34%' },
  colMethod: { width: '26%' },
  colDate:   { width: '20%' },
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
  totalLabel: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.violet,
    flex: 1,
  },
  totalValue: {
    fontSize: 12,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.violet,
  },

  // Detail page
  detailHeader: {
    backgroundColor: colors.violetDark,
    padding: 14,
    marginHorizontal: -30,
    marginTop: -30,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailHeaderTitle: {
    fontSize: 13,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.white,
  },
  detailHeaderRef: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.white,
    opacity: 0.7,
  },

  amountBigBox: {
    backgroundColor: colors.violetLight,
    borderWidth: 1.5,
    borderColor: colors.violet,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountBigLabelEn: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountBigLabelZh: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    marginTop: 2,
  },
  amountBig: {
    fontSize: 42,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.violet,
    marginTop: 8,
  },
  amountBigUnit: {
    fontSize: 12,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    marginTop: 4,
  },

  // Info blocks (detail)
  infoSection: {
    marginBottom: 12,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
  },
  infoTitleEn: {
    fontSize: 11,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.text,
  },
  infoTitleZh: {
    fontSize: 11,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
  },

  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 14,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.text,
  },
  fieldValueMono: {
    fontSize: 16,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.text,
    letterSpacing: 0.5,
  },

  qrContainer: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  qrImage: {
    width: 260,
    height: 260,
    objectFit: 'contain',
  },
  qrCaption: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    marginTop: 6,
  },

  // Inline footer (avoids touching shared PDFFooter)
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
  footerText: {
    fontSize: 8,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
  },
  footerBrandText: {
    fontSize: 8,
    fontFamily: FONT,
    fontWeight: 400,
    color: colors.muted,
    marginLeft: 4,
  },
});

// ── Helpers ─────────────────────────────────────────────────

/** Bilingual method label. Alipay & WeChat are brand names (same in EN/ZH). */
function methodLabel(method: string): string {
  switch (method) {
    case 'alipay':
      return 'Alipay';
    case 'wechat':
      return 'WeChat Pay';
    case 'bank_transfer':
      return 'Bank Transfer / 银行转账';
    case 'cash':
      return 'Cash / 现金';
    default:
      return method;
  }
}

/** ISO-style date YYYY-MM-DD — universal across locales. */
function formatDateIso(input: Date | string | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Mini footer logo (same SVG as PDFFooter — inlined to avoid importing FR footer). */
function FooterLogo() {
  return (
    <Svg width={12} height={12} viewBox="0 0 100 100">
      <Path d="M50 20 L70 50 L50 80 L30 50 Z" fill="#F3A745" />
      <Path d="M50 30 L62 50 L50 70 L38 50 Z" fill="#A947FE" />
    </Svg>
  );
}

function BilingualFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Generated automatically by Bonzini · Bonzini 自动生成
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FooterLogo />
        <Text style={styles.footerBrandText}>bonzinilabs.com</Text>
      </View>
    </View>
  );
}

// ── Types ───────────────────────────────────────────────────
export interface BatchPaymentEntry {
  id: string;
  reference: string;
  amount_rmb: number;
  method: string;
  created_at?: string | null;
  beneficiary_name?: string | null;
  beneficiary_phone?: string | null;
  beneficiary_email?: string | null;
  beneficiary_bank_name?: string | null;
  beneficiary_bank_account?: string | null;
  beneficiary_qr_code_url?: string | null;
  beneficiary_notes?: string | null;
}

interface BatchPaymentsPDFProps {
  payments: BatchPaymentEntry[];
  generatedAt?: Date;
}

// ── Main component ─────────────────────────────────────────
export function BatchPaymentsPDF({ payments, generatedAt }: BatchPaymentsPDFProps) {
  const totalRMB = payments.reduce((sum, p) => sum + (p.amount_rmb || 0), 0);
  const generatedAtStr = formatDateIso(generatedAt ?? new Date());

  return (
    <Document>
      {/* ═══════════════ Summary page ═══════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitleEn}>PENDING PAYMENTS</Text>
          <Text style={styles.summaryTitleZh}>待处理付款</Text>
          <Text style={styles.summarySubtitle}>
            Generated on {generatedAtStr} · 生成日期 {generatedAtStr}
          </Text>
        </View>

        {/* Stats */}
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

        {/* Table section title */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitleEn}>PAYMENT DETAILS</Text>
          <Text style={styles.sectionTitleZh}>· 付款明细</Text>
        </View>

        {/* Table header — 4 cols: Ref | Method | Date | ¥ */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colRef]}>
            Reference{'\n'}参考号
          </Text>
          <Text style={[styles.tableHeaderCell, styles.colMethod]}>
            Method{'\n'}方式
          </Text>
          <Text style={[styles.tableHeaderCell, styles.colDate]}>
            Date{'\n'}日期
          </Text>
          <Text style={[styles.tableHeaderCell, styles.colAmount]}>
            Amount (¥){'\n'}金额
          </Text>
        </View>

        {/* Table rows */}
        {payments.map((payment, index) => (
          <View
            key={payment.id}
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : undefined]}
          >
            <Text style={[styles.tableCell, styles.colRef]}>{payment.reference}</Text>
            <Text style={[styles.tableCell, styles.colMethod]}>{methodLabel(payment.method)}</Text>
            <Text style={[styles.tableCell, styles.colDate]}>{formatDateIso(payment.created_at)}</Text>
            <Text style={[styles.tableCell, styles.colAmount]}>
              {formatRMB(payment.amount_rmb)}
            </Text>
          </View>
        ))}

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL · 合计</Text>
          <Text style={styles.totalValue}>¥{formatRMB(totalRMB)}</Text>
        </View>

        <BilingualFooter />
      </Page>

      {/* ═══════════════ Detail pages ═══════════════ */}
      {payments.map((payment, index) => (
        <Page key={payment.id} size="A4" style={styles.page}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailHeaderTitle}>
              PAYMENT {index + 1} / {payments.length} · 付款
            </Text>
            <Text style={styles.detailHeaderRef}>{payment.reference}</Text>
          </View>

          {/* Big amount */}
          <View style={styles.amountBigBox}>
            <Text style={styles.amountBigLabelEn}>Amount to send</Text>
            <Text style={styles.amountBigLabelZh}>付款金额</Text>
            <Text style={styles.amountBig}>¥{formatRMB(payment.amount_rmb)}</Text>
            <Text style={styles.amountBigUnit}>RMB · 人民币</Text>
          </View>

          {/* Method + fields */}
          <View style={styles.infoSection}>
            <View style={styles.infoTitleRow}>
              <Text style={styles.infoTitleEn}>{methodLabel(payment.method)}</Text>
              <Text style={styles.infoTitleZh}>
                · {formatDateIso(payment.created_at)}
              </Text>
            </View>

            {/* ── Bank transfer ── */}
            {payment.method === 'bank_transfer' && (
              <>
                {payment.beneficiary_name && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Beneficiary · 收款人</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_name}</Text>
                  </View>
                )}
                {payment.beneficiary_bank_name && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Bank · 银行</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_bank_name}</Text>
                  </View>
                )}
                {payment.beneficiary_bank_account && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Account · 账号</Text>
                    <Text style={styles.fieldValueMono}>{payment.beneficiary_bank_account}</Text>
                  </View>
                )}
                {payment.beneficiary_phone && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Phone · 电话</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_phone}</Text>
                  </View>
                )}
                {payment.beneficiary_email && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Email · 邮箱</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_email}</Text>
                  </View>
                )}
                {payment.beneficiary_notes && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Notes · 备注</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_notes}</Text>
                  </View>
                )}
              </>
            )}

            {/* ── Alipay / WeChat ── */}
            {(payment.method === 'alipay' || payment.method === 'wechat') && (
              <>
                {payment.beneficiary_qr_code_url && (
                  <View style={styles.qrContainer}>
                    <Image src={payment.beneficiary_qr_code_url} style={styles.qrImage} />
                    <Text style={styles.qrCaption}>
                      QR Code · 二维码 — {methodLabel(payment.method)}
                    </Text>
                  </View>
                )}

                {/* All text fields shown even when QR is present (previous behavior hid them) */}
                {payment.beneficiary_name && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Name · 姓名</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_name}</Text>
                  </View>
                )}
                {payment.beneficiary_phone && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Phone · 电话</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_phone}</Text>
                  </View>
                )}
                {payment.beneficiary_email && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Email · 邮箱</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_email}</Text>
                  </View>
                )}
                {payment.beneficiary_notes && (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Notes · 备注</Text>
                    <Text style={styles.fieldValue}>{payment.beneficiary_notes}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          <BilingualFooter />
        </Page>
      ))}
    </Document>
  );
}
