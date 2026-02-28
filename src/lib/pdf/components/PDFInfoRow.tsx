import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors } from '../styles';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    fontSize: 8,
    color: colors.muted,
    width: 80,
  },
  value: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    flex: 1,
  },
});

interface PDFInfoRowProps {
  label: string;
  value: string | null | undefined;
  labelWidth?: number;
}

export function PDFInfoRow({ label, value, labelWidth }: PDFInfoRowProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, labelWidth ? { width: labelWidth } : undefined]}>{label}</Text>
      <Text style={styles.value}>{value || 'Non renseigné'}</Text>
    </View>
  );
}
