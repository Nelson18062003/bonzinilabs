/**
 * Sources des clients — fixtures du harnais de capture (SCREENSHOT_MOCK=1).
 * Sur-ensemble du vrai module : on réexporte tout, puis on remplace les hooks
 * de données par des valeurs fixes.
 */
export * from '../hooks/useClientSources';
import type { SourceClientRow, SourceReportRow } from '../hooks/useClientSources';

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: async () => undefined });
const noop = () => ({ mutate: (_a?: unknown, o?: { onSuccess?: (r: unknown) => void }) => o?.onSuccess?.({ success: true, id: 'src-new', existing: false }), mutateAsync: async () => ({ success: true }), isPending: false });

const SOURCES = [
  { id: 'src-unknown', kind: 'unknown', label: 'Je ne sais pas', phone: null, notes: null, is_active: true, is_system: true, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-jean', kind: 'commercial', label: 'Jean Mbarga', phone: '+237 677 41 22 90', notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-aicha', kind: 'commercial', label: 'Aïcha Ndiaye', phone: '+237 699 08 15 33', notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-paul', kind: 'commercial', label: 'Paul Etoga', phone: '+237 655 70 31 18', notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-ref', kind: 'referral', label: 'Ets Kamga (client)', phone: null, notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-fb', kind: 'social', label: 'Facebook', phone: null, notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-tt', kind: 'social', label: 'TikTok', phone: null, notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-wa', kind: 'social', label: 'WhatsApp', phone: null, notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-gpt', kind: 'online', label: 'ChatGPT', phone: null, notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-site', kind: 'online', label: 'Site Bonzini', phone: null, notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'src-salon', kind: 'event', label: 'Salon PROMOTE 2026', phone: null, notes: null, is_active: true, is_system: false, created_by: null, created_at: '', updated_at: '' },
];

const row = (id: string | null, kind: SourceReportRow['kind'], label: string, phone: string | null, c: number, n: number, dep: number, pay: number, parcels: number, kg: number, cbm: number): SourceReportRow => ({
  source_id: id, kind, label, phone, is_active: true, is_system: kind === 'unknown' || kind === 'none',
  clients: c, new_clients: n, active_clients: Math.min(c, n + 2), deposits_xaf: dep, deposits_count: Math.round(dep / 900_000), payments_xaf: pay, payments_count: Math.round(pay / 750_000), parcels, parcels_kg: kg, parcels_cbm: cbm,
});

const REPORT: SourceReportRow[] = [
  row('src-jean', 'commercial', 'Jean Mbarga', '+237 677 41 22 90', 14, 5, 48_350_000, 45_910_000, 37, 912, 4.82),
  row('src-aicha', 'commercial', 'Aïcha Ndiaye', '+237 699 08 15 33', 9, 3, 21_600_000, 20_150_000, 18, 455, 2.1),
  row('src-paul', 'commercial', 'Paul Etoga', '+237 655 70 31 18', 2, 2, 1_200_000, 0, 4, 61, 0.35),
  row('src-ref', 'referral', 'Ets Kamga (client)', null, 3, 1, 6_400_000, 6_100_000, 6, 140, 0.9),
  row('src-fb', 'social', 'Facebook', null, 6, 2, 3_900_000, 3_250_000, 2, 30, 0.12),
  row('src-tt', 'social', 'TikTok', null, 3, 3, 850_000, 0, 0, 0, 0),
  row('src-gpt', 'online', 'ChatGPT', null, 6, 0, 0, 0, 0, 0, 0),
  row('src-salon', 'event', 'Salon PROMOTE 2026', null, 1, 1, 0, 0, 0, 0, 0),
  row('src-unknown', 'unknown', 'Je ne sais pas', null, 4, 1, 2_100_000, 1_800_000, 1, 12, 0.05),
  row(null, 'none', 'Non renseigné', null, 211, 0, 310_500_000, 298_400_000, 64, 3850, 5.4),
];

const CLIENTS: SourceClientRow[] = [
  ['Fabrice Bienvenue', 'Jako Cargo SARL', 'BZ-104233', 18_200_000, 17_900_000, 14, 380, 1.9],
  ['Mireille Atangana', null, 'BZ-118204', 11_400_000, 10_300_000, 9, 210, 1.1],
  ['Hervé Nkoulou', 'Nkoulou & Fils', 'BZ-120077', 8_750_000, 8_100_000, 6, 150, 0.8],
  ['Christelle Fouda', null, 'BZ-121530', 5_300_000, 5_110_000, 5, 120, 0.6],
  ['Samuel Ekwalla', 'Douala Import', 'BZ-122918', 4_700_000, 4_500_000, 3, 52, 0.42],
  ['Brice Tchouanga', null, 'BZ-123401', 0, 0, 0, 0, 0],
].map(([name, company, code, dep, pay, n, kg, cbm], i) => ({
  user_id: `u-${i}`, name: name as string, company: company as string | null, customer_code: code as string, phone: null,
  created_at: new Date(Date.now() - (i + 1) * 9 * 86_400_000).toISOString(), source_set_at: null,
  deposits_xaf: dep as number, deposits_count: 3, payments_xaf: pay as number, payments_count: 3, parcels: n as number, parcels_kg: kg as number, parcels_cbm: cbm as number,
}));

export const useClientSources = () => ok(SOURCES as never[]);
export const useClientSourceReport = () => ok(REPORT);
export const useClientSourceClients = () => ok(CLIENTS);
export const useClientOrigin = () => ok({ source_id: 'src-jean', source_set_at: null, source: { id: 'src-jean', kind: 'commercial', label: 'Jean Mbarga', phone: '+237 677 41 22 90' } });
export const useCreateClientSource = noop;
export const useUpdateClientSource = noop;
export const useSetClientSource = noop;
