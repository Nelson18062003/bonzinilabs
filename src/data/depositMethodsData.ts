// ============================================================
// MODULE DEPOTS — Static data & helpers
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
    description: 'Transfert UV ou retrait code marchand',
  },
  {
    family: 'MTN_MONEY',
    label: 'MTN Mobile Money',
    icon: 'Smartphone',
    description: 'Transfert Float ou retrait code marchand',
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
    label: 'Transfert Orange UV vers Bonzini',
    description: 'Envoyez vers le compte Orange UV Bonzini',
  },
  {
    subMethod: 'OM_WITHDRAWAL',
    family: 'ORANGE_MONEY',
    label: 'Retrait Orange Money (code marchand)',
    description: 'Composez le code marchand depuis votre téléphone',
  },
  {
    subMethod: 'MTN_TRANSFER',
    family: 'MTN_MONEY',
    label: 'Transfert MTN Float vers Bonzini',
    description: 'Pour comptes MTN entreprise (Float)',
  },
  {
    subMethod: 'MTN_WITHDRAWAL',
    family: 'MTN_MONEY',
    label: 'Retrait MoMo (code marchand)',
    description: 'Composez le code marchand depuis votre téléphone',
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

// ── Banks (with Bonzini RIB details) ─────────────────────────

export const banks: BankInfo[] = [
  {
    bank: 'ECOBANK',
    label: 'Ecobank Cameroun',
    bonziniAccount: {
      accountName: 'NORTON GAUSS BONZINI SARL',
      accountNumber: '30245039710',
      bankName: 'Ecobank Cameroun SA',
      iban: 'CM21 10029 00002 30245039710 53',
      swift: 'ECOCCMCX',
      codeBanque: '10029',
      codeAgence: '00002',
      cleRib: '53',
    },
  },
  {
    bank: 'CCA',
    label: 'CCA-BANK Cameroun',
    bonziniAccount: {
      accountName: 'NORTON GAUSS BONZINI SARL',
      accountNumber: '00280298901',
      bankName: 'CCA-BANK Cameroun',
      iban: 'CM21 10039 10444 00280298901 57',
      swift: 'CCAMCMCY',
      codeBanque: '10039',
      codeAgence: '10444',
      cleRib: '57',
    },
  },
  {
    bank: 'UBA',
    label: 'UBA Cameroun',
    bonziniAccount: {
      accountName: 'NORTON GAUSS BONZINI SARL',
      accountNumber: '14011000141',
      bankName: 'UBA Cameroun',
      iban: 'CM21 10033 05214 140110001411 88',
      swift: 'UNAFMCX',
      codeBanque: '10033',
      codeAgence: '05214',
      cleRib: '88',
    },
  },
  {
    bank: 'AFRILAND',
    label: 'Afriland First Bank',
    bonziniAccount: {
      accountName: 'NORTON GAUSS BONZINI SARL',
      accountNumber: '00000020611',
      bankName: 'AFRILAND FIRST BANK Cameroun',
      iban: 'CM21 10005 00002 00000020611 38',
      swift: 'CCEICMCX',
      codeBanque: '10005',
      codeAgence: '00002',
      cleRib: '38',
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
  phone: '6 96 10 38 64',
  accountName: 'WONDER PHONE',
};

export const mtnMoneyAccount: MobileMoneyInfo = {
  phone: '6 52 23 68 56',
  accountName: 'NGANGON SOH NELSON',
};

export const waveAccount: MobileMoneyInfo = {
  phone: '+237 691 000 003',
  accountName: 'BONZINI TRADING',
};

// ── Merchant codes (OM/MTN withdrawal) ───────────────────────

export const omMerchantInfo: MerchantInfo = {
  accountName: 'WONDER PHONE',
  merchantCode: '#150*14*424393*696103864*MONTANT#',
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
