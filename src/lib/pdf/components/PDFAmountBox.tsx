import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors } from '../styles';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 32,
    fontFamily: 'DM Sans',
    fontWeight: 900,
    color: colors.text,
    letterSpacing: -1,
  },
  currency: {
    fontSize: 14,
    fontFamily: 'DM Sans',
    fontWeight: 600,
    color: colors.muted,
    marginLeft: 6,
    marginBottom: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryItem: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  secondaryLabel: {
    fontSize: 9,
    fontFamily: 'DM Sans',
    fontWeight: 600,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  secondaryValue: {
    fontSize: 14,
    fontFamily: 'DM Sans',
    fontWeight: 800,
    color: colors.violet,
  },
});

interface PDFAmountBoxProps {
  amount: string;
  secondaryItems?: Array<{ label: string; value: string }>;
}

export function PDFAmountBox({ amount, secondaryItems }: PDFAmountBoxProps) {
  return (
    <View style={styles.container}>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>{amount}</Text>
        <Text style={styles.currency}>XAF</Text>
      </View>
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
