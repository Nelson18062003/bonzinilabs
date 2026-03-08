import { StyleSheet } from '@react-pdf/renderer';
import './fonts';

// Palette couleurs Bonzini — charte officielle
export const colors = {
  // Marque
  violet:      '#a64af7',
  violetDark:  '#1a1028',
  violetLight: '#f3ecf8',
  gold:        '#f3a745',
  goldLight:   '#fdf4e3',
  orange:      '#fe560d',
  orangeLight: '#fdeee8',
  // Statuts
  green:       '#10b981',
  greenLight:  '#ecfdf5',
  // Modes de paiement
  alipay:      '#1677ff',
  wechat:      '#07c160',
  // Texte
  text:        '#2d2040',
  muted:       '#7a7290',
  light:       '#f8f6fa',
  border:      '#ebe6f0',
  white:       '#ffffff',
};

export const baseStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'DM Sans',
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },
  section: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: 8,
  },
});
