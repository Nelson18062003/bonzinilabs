import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors } from '../styles';

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

const hasChinese = (str: string | null | undefined): boolean =>
  !!str && CJK_REGEX.test(str);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 11,
    fontFamily: 'DM Sans',
    fontWeight: 500,
    color: colors.muted,
    flex: 1,
  },
  value: {
    fontSize: 12,
    fontFamily: 'DM Sans',
    fontWeight: 600,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
  },
  valueCjk: {
    fontSize: 12,
    fontFamily: 'Noto Sans SC',
    fontWeight: 400,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
  },
  valueBold: {
    fontWeight: 700,
  },
});

interface PDFInfoRowProps {
  label: string;
  value: string | null | undefined;
  bold?: boolean;
  color?: string;
}

export function PDFInfoRow({ label, value, bold, color }: PDFInfoRowProps) {
  const isCjk = hasChinese(value);
  const valueStyle = isCjk ? styles.valueCjk : styles.value;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          valueStyle,
          !isCjk && bold ? styles.valueBold : undefined,
          color ? { color } : undefined,
        ]}
      >
        {value || '—'}
      </Text>
    </View>
  );
}
