import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { colors } from '../styles';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    padding: 16,
    paddingBottom: 12,
    marginBottom: 16,
    marginHorizontal: -30,
    marginTop: -30,
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: colors.white,
  },
  subtitle: {
    fontSize: 13,
    color: colors.white,
    marginTop: 4,
    opacity: 0.9,
  },
  reference: {
    fontSize: 10,
    color: colors.white,
    marginTop: 4,
    opacity: 0.8,
  },
});

interface PDFHeaderProps {
  title: string;
  reference?: string;
}

export function PDFHeader({ title, reference }: PDFHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Image src="/assets/bonzini-logo.jpg" style={styles.logo} />
        <Text style={styles.title}>BONZINI TRADING</Text>
      </View>
      <Text style={styles.subtitle}>{title}</Text>
      {reference && <Text style={styles.reference}>{reference}</Text>}
    </View>
  );
}
