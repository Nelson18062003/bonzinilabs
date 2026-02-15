// ============================================================
// MODULE DEPOTS — Static data & helpers (from scratch)
// ============================================================
import type {
  MethodFamilyInfo,
  SubMethodInfo,
  BankInfo,
  AgencyInfo,
  MobileMoneyInfo,
  MerchantInfo,
  DepositMethodFamily,
  DepositSubMethod,
} from '@/types/deposit';

// ── Level 1: Method families ─────────────────────────────────

export const methodFamilies: MethodFamilyInfo[] = [
  {
    family: 'BANK',
    label: 'Banque / Microfinance',
    icon: 'Building2',
    description: 'Virement ou dépôt cash en agence bancaire',
  },
  {
    family: 'AGENCY_BONZINI',
    label: 'Cash en agence Bonzini',
    icon: 'Store',
    description: 'Dépôt cash dans nos locaux',
  },
  {
    family: 'ORANGE_MONEY',
    label: 'Orange Money',
    icon: 'Smartphone',
    description: 'Transfert ou retrait OM',
  },
  {
    family: 'MTN_MONEY',
    label: 'MTN Mobile Money',
    icon: 'Smartphone',
    description: 'Transfert ou retrait MOMO',
  },
  {
    family: 'WAVE',
    label: 'Wave',
    icon: 'Waves',
    description: 'Transfert via Wave',
  },
];

// ── Level 2: Sub-methods ─────────────────────────────────────

export const subMethods: SubMethodInfo[] = [
  {
    subMethod: 'BANK_TRANSFER',
    family: 'BANK',
    label: 'Virement bancaire / microfinance',
    description: 'Effectuez un virement depuis votre compte',
  },
  {
    subMethod: 'BANK_CASH_DEPOSIT',
    family: 'BANK',
    label: 'Dépôt cash au guichet',
    description: 'Déposez du cash en agence bancaire',
  },
  {
    subMethod: 'OM_TRANSFER',
    family: 'ORANGE_MONEY',
    label: 'Transfert OM vers Bonzini',
    description: 'Envoyez vers le compte Bonzini',
  },
  {
    subMethod: 'OM_WITHDRAWAL',
    family: 'ORANGE_MONEY',
    label: 'Retrait OM (code marchand)',
    description: 'Composez le code marchand pour payer',
  },
  {
    subMethod: 'MTN_TRANSFER',
    family: 'MTN_MONEY',
    label: 'Transfert MOMO vers Bonzini',
    description: 'Envoyez vers le compte Bonzini',
  },
  {
    subMethod: 'MTN_WITHDRAWAL',
    family: 'MTN_MONEY',
    label: 'Retrait MOMO (code marchand)',
    description: 'Composez le code marchand pour payer',
  },
  {
    subMethod: 'AGENCY_CASH',
    family: 'AGENCY_BONZINI',
    label: 'Dépôt en espèces',
    description: 'Apportez le cash dans une agence Bonzini',
  },
  {
    subMethod: 'WAVE_TRANSFER',
    family: 'WAVE',
    label: 'Transfert Wave',
    description: "Envoyez via l'application Wave",
  },
];

// ── Banks (with Bonzini account info) ────────────────────────

export const banks: BankInfo[] = [
  {
    bank: 'AFRILAND',
    label: 'Afriland First Bank',
    bonziniAccount: {
      accountName: 'BONZINI TRADING SARL',
      accountNumber: '10005 00001 12345678901 23',
      bankName: 'Afriland First Bank',
    },
  },
  {
    bank: 'ECOBANK',
    label: 'Ecobank',
    bonziniAccount: {
      accountName: 'BONZINI TRADING SARL',
      accountNumber: '20001 00001 98765432101 45',
      bankName: 'Ecobank Cameroun',
    },
  },
  {
    bank: 'UBA',
    label: 'UBA',
    bonziniAccount: {
      accountName: 'BONZINI TRADING SARL',
      accountNumber: '30002 00001 55544433322 11',
      bankName: 'United Bank for Africa',
    },
  },
  {
    bank: 'CCA',
    label: 'CCA Bank',
    bonziniAccount: {
      accountName: 'BONZINI TRADING SARL',
      accountNumber: '40003 00001 11122233344 55',
      bankName: 'CCA Bank',
    },
  },
  {
    bank: 'ADVANS',
    label: 'Advans Cameroun',
    bonziniAccount: {
      accountName: 'BONZINI TRADING SARL',
      accountNumber: '50004 00001 66677788899 00',
      bankName: 'Advans Cameroun',
    },
  },
];

// ── Bonzini Agencies ─────────────────────────────────────────

export const agencies: AgencyInfo[] = [
  {
    agency: 'DOUALA_BONAPRISO',
    label: 'Douala – Bonapriso',
    address: 'Rue de la Joie, Bonapriso, Douala',
    hours: 'Lun-Ven: 8h-18h, Sam: 9h-14h',
  },
  {
    agency: 'DOUALA_BONAMOUSSADI',
    label: 'Douala – Bonamoussadi',
    address: 'Carrefour Maetur, Bonamoussadi, Douala',
    hours: 'Lun-Ven: 8h-18h, Sam: 9h-14h',
  },
  {
    agency: 'YAOUNDE_CENTRE',
    label: 'Yaoundé – Centre',
    address: 'Avenue Kennedy, Centre-ville, Yaoundé',
    hours: 'Lun-Ven: 8h-18h, Sam: 9h-13h',
  },
];

// ── Mobile Money accounts ────────────────────────────────────

export const orangeMoneyAccount: MobileMoneyInfo = {
  phone: '+237 691 000 001',
  accountName: 'BONZINI TRADING',
};

export const mtnMoneyAccount: MobileMoneyInfo = {
  phone: '+237 670 000 001',
  accountName: 'BONZINI TRADING',
};

export const waveAccount: MobileMoneyInfo = {
  phone: '+237 691 000 003',
  accountName: 'BONZINI TRADING',
};

// ── Merchant codes (OM/MTN withdrawal) ───────────────────────
// Per PDF: user dials this code themselves.
// MONTANT must NOT be auto-injected.

export const omMerchantInfo: MerchantInfo = {
  accountName: 'PDV TCHAKOUTE',
  merchantCode: '#150*14*424393*693515541*MONTANT#',
};

export const mtnMerchantInfo: MerchantInfo = {
  accountName: 'NGANGON SOH NELSON',
  merchantCode: '*126*14*652236856*MONTANT#',
};

// Max 500 000 XAF per mobile money transaction
export const MOBILE_MONEY_TRANSACTION_LIMIT = 500_000;

// ── Helpers ──────────────────────────────────────────────────

export const getSubMethodsForFamily = (family: DepositMethodFamily): SubMethodInfo[] =>
  subMethods.filter((sm) => sm.family === family);

export const getFamilyInfo = (family: DepositMethodFamily): MethodFamilyInfo | undefined =>
  methodFamilies.find((mf) => mf.family === family);

export const getBankInfo = (bank: string): BankInfo | undefined =>
  banks.find((b) => b.bank === bank);

export const getAgencyInfo = (agency: string): AgencyInfo | undefined =>
  agencies.find((a) => a.agency === agency);

export const familyRequiresSubMethod = (family: DepositMethodFamily): boolean =>
  ['BANK', 'ORANGE_MONEY', 'MTN_MONEY'].includes(family);

export const subMethodRequiresBankSelection = (subMethod: DepositSubMethod): boolean =>
  subMethod === 'BANK_TRANSFER' || subMethod === 'BANK_CASH_DEPOSIT';

export const subMethodRequiresAgencySelection = (subMethod: DepositSubMethod): boolean =>
  subMethod === 'AGENCY_CASH';

/** Generate a temporary client-side reference (server creates the real one via RPC). */
export const generateDepositReference = (prefix: string): string => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DEP-${prefix.substring(0, 8).toUpperCase()}-${ts.slice(-4)}${rand}`;
};
