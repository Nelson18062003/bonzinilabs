/** Carnet d'un client figé pour le harnais de capture (SCREENSHOT_MOCK=1). */
export * from '../hooks/useBeneficiaries';
import type { Beneficiary } from '../hooks/useBeneficiaries';

const base = { client_id: 'u5', identifier_type: null, phone: null, email: null, bank_name: null, bank_account: null, bank_extra: null, qr_code_url: null, relation_type: 'supplier', notes: null, created_by: null, created_by_role: null, is_active: true, created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z' } as const;
const LIST: Beneficiary[] = [
  { ...base, id: 'b1', payment_method: 'alipay', alias: 'Yite', name: 'Guangzhou Yite Electronics', identifier: 'yite_gz', identifier_type: 'id', phone: '+86 138 0013 8000' },
  { ...base, id: 'b2', payment_method: 'bank_transfer', alias: 'Hongfa', name: 'Shenzhen Hongfa Trading Co.', identifier: null, bank_name: 'Bank of China', bank_account: '6214 8888 1234 5678', bank_extra: 'SWIFT BKCHCNBJ' },
  { ...base, id: 'b3', payment_method: 'wechat', alias: 'Mme Li', name: 'Li Wei', identifier: null, phone: '+86 139 2200 1100' },
] as Beneficiary[];
const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null, refetch: async () => undefined });
export const useAdminClientBeneficiaries = (clientId: string | undefined) => ok(clientId === 'u5' ? LIST : []);
