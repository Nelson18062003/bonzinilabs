// Design constants extracted verbatim from
// ethy-keeper-claude-bank-dashboard-pdf-fqc20/scripts/generate-dashboard-pdf.mjs
// The PDF is A4 portrait in points; we render the preview 1pt = 1px.

export const PAGE = { width: 595.28, height: 841.89 };

export const COLORS = {
  bg: '#0F1117',
  cardBg: '#1A1D27',
  cardBgZero: '#13151E',
  cardBorder: '#2A2D37',
  textWhite: '#FFFFFF',
  textMuted: '#8892A8',
  textDimmed: '#4A5068',
  textVeryDim: '#3A3F50',
  gradientStart: '#7C3AED',
  gradientEnd: '#3B82F6',
  greenAccent: '#10B981',
  totalCardBg: '#111827',
  totalCardBorder: '#1F2937',
  badgeMobileBg: '#1E3A2F',
  badgeMobileText: '#4ADE80',
  badgeBankBg: '#1E2A3A',
  badgeBankText: '#60A5FA',
} as const;

export const LAYOUT = {
  margin: 40,
  contentWidth: PAGE.width - 40 * 2, // 515.28
  cardGap: 16,
  cardWidth: (PAGE.width - 40 * 2 - 16) / 2, // 249.64
  cardHeight: 140,
  cardRadius: 12,
  gridStartY: 116,
} as const;

export type AccountType = 'Mobile Money' | 'Bank';

export interface DashboardAccount {
  key: string;
  name: string;
  type: AccountType;
  color: string;
  logo: string; // public path
}

// The 6 fixed accounts, in the exact order of the prototype.
export const DASHBOARD_ACCOUNTS: DashboardAccount[] = [
  { key: 'mtn', name: 'MTN MoMo', type: 'Mobile Money', color: '#FFCC00', logo: '/treasury-dashboard/logos/mtn.png' },
  { key: 'orange', name: 'Orange Money', type: 'Mobile Money', color: '#FF6600', logo: '/treasury-dashboard/logos/orange-money.png' },
  { key: 'uba', name: 'UBA Cameroon', type: 'Bank', color: '#E31837', logo: '/treasury-dashboard/logos/uba.png' },
  { key: 'afriland', name: 'Afriland First Bank', type: 'Bank', color: '#8B0000', logo: '/treasury-dashboard/logos/afriland-icon.png' },
  { key: 'ecobank', name: 'Ecobank Cameroon', type: 'Bank', color: '#0066B3', logo: '/treasury-dashboard/logos/ecobank.png' },
  { key: 'cca', name: 'CCA-Bank', type: 'Bank', color: '#6A0DAD', logo: '/treasury-dashboard/logos/cca-bank.jpg' },
];

/** Thousands separated by spaces; 0 stays "0" (matches formatXAF in the script). */
export function formatXAF(n: number): string {
  if (!n || n === 0) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Darken a hex color toward black by ratio t (mirrors lerpColor(color, '#000', 0.5)). */
export function darken(hex: string, t: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (v: number) => Math.round(v * (1 - t));
  return '#' + [d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** "As of May 19, 2026" — English long date. */
export function formatHeaderDate(d: Date): string {
  return `As of ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

/** "19/05/2026 14:30" — footer timestamp with time. */
export function formatFooterTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
