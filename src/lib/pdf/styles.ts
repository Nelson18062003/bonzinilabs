import { StyleSheet } from '@react-pdf/renderer';
import './fonts';

export const colors = {
  primary: '#8B5CF6',
  primaryDark: '#7C3AED',
  text: '#1F2937',
  muted: '#6B7280',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  bgLight: '#F9FAFB',
  bgBlue: '#EFF6FF',
  white: '#FFFFFF',
  border: '#E5E7EB',
};

export const baseStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'NotoSansSC',
    fontSize: 10,
    color: colors.text,
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
