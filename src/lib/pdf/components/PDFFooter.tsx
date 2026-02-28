import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors } from '../styles';
import { formatDateShort } from '../helpers';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  text: {
    fontSize: 7,
    color: colors.muted,
  },
});

interface PDFFooterProps {
  confidential?: boolean;
}

export function PDFFooter({ confidential }: PDFFooterProps) {
  return (
    <View style={styles.container} fixed>
      <Text style={styles.text}>
        {confidential
          ? 'Confidential — Internal Use Only'
          : `Bonzini — Document généré le ${formatDateShort(new Date())}`}
      </Text>
      <Text
        style={styles.text}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}
