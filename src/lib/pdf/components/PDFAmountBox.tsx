import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors } from '../styles';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgBlue,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: colors.muted,
    marginBottom: 6,
  },
  amount: {
    fontSize: 28,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: colors.primary,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  secondaryItem: {
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 8,
    color: colors.muted,
  },
  secondaryValue: {
    fontSize: 12,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: colors.text,
    marginTop: 2,
  },
});

interface PDFAmountBoxProps {
  label: string;
  amount: string;
  secondaryItems?: Array<{ label: string; value: string }>;
}

export function PDFAmountBox({ label, amount, secondaryItems }: PDFAmountBoxProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>{amount}</Text>
      {secondaryItems && secondaryItems.length > 0 && (
        <View style={styles.secondaryRow}>
          {secondaryItems.map((item, i) => (
            <View key={i} style={styles.secondaryItem}>
              <Text style={styles.secondaryLabel}>{item.label}</Text>
              <Text style={styles.secondaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
