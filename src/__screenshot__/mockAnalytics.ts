/**
 * DEV-ONLY fixtures for the analytics dashboard screenshot harness.
 * Vite aliases `@/hooks/analytics/useAnalytics` → this file ONLY when
 * SCREENSHOT_MOCK=1 (see vite.config.ts). Never bundled in production.
 *
 * Each hook mirrors the react-query shape ({ data, isLoading, error }) the
 * screen consumes, returning static data so every chart/section renders.
 */

const LABELS = ['01/06', '03/06', '05/06', '07/06', '09/06', '11/06', '13/06', '15/06', '17/06', '19/06'];
const ok = <T,>(data: T) => ({ data, isLoading: false, error: null });

const flowSeries = LABELS.map((label, i) => {
  const deposits = 4_000_000 + Math.round(Math.sin(i / 2) * 1_800_000 + i * 250_000);
  const payments = 3_200_000 + Math.round(Math.cos(i / 2) * 1_500_000 + i * 200_000);
  return { bucket: `2026-06-${String(1 + i * 2).padStart(2, '0')}`, label, deposits, payments, net: deposits - payments };
});

const volumeSeries = LABELS.map((label, i) => ({
  bucket: `2026-06-${String(1 + i * 2).padStart(2, '0')}`,
  label,
  amountXAF: 3_500_000 + Math.round(Math.abs(Math.sin(i / 1.7)) * 4_500_000),
  opCount: 6 + (i % 5),
}));

const makeVolumeReport = (mult: number) => {
  const series = volumeSeries.map((p) => ({ ...p, amountXAF: Math.round(p.amountXAF * mult) }));
  const totalXAF = series.reduce((s, p) => s + p.amountXAF, 0);
  const opCount = series.reduce((s, p) => s + p.opCount, 0);
  const peak = series.reduce((a, b) => (b.amountXAF > a.amountXAF ? b : a), series[0]);
  return { series, totalXAF, opCount, avgXAF: Math.round(totalXAF / opCount), peak: { label: peak.label, amountXAF: peak.amountXAF }, trendPct: 0.083 };
};

const rateSeries = LABELS.map((label, i) => ({
  bucket: `2026-06-${String(1 + i * 2).padStart(2, '0')}`,
  label,
  alipay: 92000 + Math.round(Math.sin(i / 2) * 600),
  wechat: 91600 + Math.round(Math.cos(i / 2) * 500),
  virement: 90400 + Math.round(Math.sin(i / 3) * 400),
  cash: 86400 + Math.round(Math.cos(i / 2.5) * 700),
}));

const clientGrowth = LABELS.map((label, i) => ({
  bucket: `2026-06-${String(1 + i * 2).padStart(2, '0')}`,
  label,
  newClients: 3 + ((i * 2) % 7),
  cumulative: 90 + i * 5,
}));

const statusTimeline = LABELS.map((label, i) => ({
  bucket: `2026-06-${String(1 + i * 2).padStart(2, '0')}`,
  label,
  validated: 4 + (i % 5),
  rejected: i % 3,
  pending: 1 + (i % 2),
}));

export const useFlowSeries = () => ok({ current: flowSeries, previous: flowSeries.map((p) => ({ ...p, deposits: Math.round(p.deposits * 0.9) })) });
export const usePaymentSummary = () => ok({ current: { totalXAF: 86_200_000, opCount: 142, totalRMB: 645_000, avgTicketXAF: 607_042 }, previous: { totalXAF: 79_500_000, avgTicketXAF: 588_000 } });
export const useDepositSummary = () => ok({ current: { totalXAF: 94_300_000, opCount: 168 }, previous: { totalXAF: 88_100_000 } });
export const useDepositMethodBreakdown = () => ok([
  { key: 'mobile_money', label: 'Mobile Money', count: 88, amount: 41_200_000 },
  { key: 'bank_transfer', label: 'Virement', count: 42, amount: 33_800_000 },
  { key: 'cash_agency', label: 'Cash agence', count: 26, amount: 14_100_000 },
  { key: 'cash_agent', label: 'Cash agent', count: 12, amount: 5_200_000 },
]);
export const usePaymentMethodBreakdown = () => ok([
  { key: 'alipay', label: 'Alipay', count: 74, amount: 44_900_000 },
  { key: 'wechat', label: 'WeChat', count: 41, amount: 26_300_000 },
  { key: 'bank_transfer', label: 'Virement', count: 19, amount: 11_000_000 },
  { key: 'cash', label: 'Cash', count: 8, amount: 4_000_000 },
]);
export const useDepositStatusSummary = () => ok({
  validationRate: 0.91,
  validated: { count: 153, amountXAF: 94_300_000 },
  rejected: { count: 15, amountXAF: 6_800_000 },
  pendingProof: { count: 7, amountXAF: 0 },
  pendingReview: { count: 4, amountXAF: 0 },
});
export const useTopClients = () => ok([
  { userId: 'u1', firstName: 'Awa', lastName: 'Diop', opCount: 22, totalXAF: 18_400_000, totalRMB: 138_000 },
  { userId: 'u2', firstName: 'Jean', lastName: 'Kamga', opCount: 17, totalXAF: 14_900_000, totalRMB: 112_000 },
  { userId: 'u3', firstName: 'Marie', lastName: 'Nkolo', opCount: 14, totalXAF: 11_200_000, totalRMB: 84_000 },
  { userId: 'u4', firstName: 'Paul', lastName: 'Mballa', opCount: 11, totalXAF: 8_700_000, totalRMB: 65_000 },
  { userId: 'u5', firstName: 'Fatou', lastName: 'Sow', opCount: 9, totalXAF: 6_300_000, totalRMB: 47_000 },
  { userId: 'u6', firstName: 'Eric', lastName: 'Tchami', opCount: 7, totalXAF: 4_100_000, totalRMB: 31_000 },
]);
export const useFunnel = () => ok({ clientsWithPayment: 78, clientsTotal: 128, clientsWithDeposit: 96, depositToPaymentRate: 0.81 });
export const useDepositProcessingTime = () => ok({ medianMinutes: 18, p90Minutes: 64, sampleSize: 153 });
export const useDashboardAlerts = () => ok([
  { id: 'a1', severity: 'warning', title: 'Dépôts en attente de revue', description: '4 dépôts attendent une validation admin depuis plus de 2 h.', count: 4, actionHref: '/m/deposits' },
  { id: 'a2', severity: 'info', title: 'Taux non mis à jour', description: 'Le taux du jour n’a pas changé depuis 36 h.', count: 1, actionHref: '/m/more/rates' },
]);
export const useRateHistory = () => ok(rateSeries);
export const useAdminProductivity = () => ok([
  { adminId: 'ad1', name: 'Demo Admin', totalActions: 142, depositsValidated: 96, depositsRejected: 12, paymentsProcessed: 34 },
  { adminId: 'ad2', name: 'Sandra O.', totalActions: 88, depositsValidated: 54, depositsRejected: 6, paymentsProcessed: 28 },
  { adminId: 'ad3', name: 'Yannick B.', totalActions: 41, depositsValidated: 22, depositsRejected: 3, paymentsProcessed: 16 },
]);
export const useDepositVolumeReport = () => ok(makeVolumeReport(1));
export const usePaymentVolumeReport = () => ok(makeVolumeReport(0.86));
export const useClientGrowth = () => ok(clientGrowth);
export const useRegistrationSource = () => ok({ adminCreated: 38, selfRegistered: 19, totalNew: 57, adminCreatedPct: 0.667 });
export const useUtmSources = () => ok([
  { source: 'facebook', medium: 'cpc', campaign: 'juin_promo', count: 12 },
  { source: 'google', medium: 'organic', campaign: '(none)', count: 9 },
  { source: 'whatsapp', medium: 'referral', campaign: '(none)', count: 6 },
]);
export const useWalletExposure = () => ok({ totalXAF: 48_750_000, clientsWithBalance: 96, avgBalancePerClient: 507_812, top10ShareXAF: 21_900_000 });
export const useDepositStatusTimeline = () => ok(statusTimeline);
export const useClientCountryDistribution = () => ok([
  { key: 'cm', country: 'Cameroun', count: 62, share: 0.512 },
  { key: 'ci', country: "Côte d'Ivoire", count: 18, share: 0.149 },
  { key: 'sn', country: 'Sénégal', count: 12, share: 0.099 },
  { key: 'ga', country: 'Gabon', count: 8, share: 0.066 },
  { key: 'bj', country: 'Bénin', count: 5, share: 0.041 },
  { key: 'tg', country: 'Togo', count: 4, share: 0.033 },
  { key: 'ne', country: 'Niger', count: 3, share: 0.025 },
  { key: 'unknown', country: 'Non renseigné', count: 9, share: 0.074 },
]);
