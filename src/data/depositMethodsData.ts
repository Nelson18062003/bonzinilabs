import { 
  MethodFamilyInfo, 
  SubMethodInfo, 
  BankInfo, 
  AgencyInfo,
  MobileMoneyInfo,
  DepositMethodFamily,
  DepositSubMethod 
} from '@/types/deposit';

// ============================================
// LEVEL 1 - METHOD FAMILIES
// ============================================
export const methodFamilies: MethodFamilyInfo[] = [
  {
    family: 'BANK',
    label: 'Banque / Microfinance',
    icon: 'Building2',
    description: 'Virement ou dépôt cash en agence bancaire',
  },
  {
    family: 'AGENCY_BONZINI',
    label: 'Agence Bonzini',
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

// ============================================
// LEVEL 2 - SUB-METHODS
// ============================================
export const subMethods: SubMethodInfo[] = [
  // Bank sub-methods
  {
    subMethod: 'BANK_TRANSFER',
    family: 'BANK',
    label: 'Virement bancaire',
    description: 'Effectuez un virement depuis votre compte',
  },
  {
    subMethod: 'BANK_CASH_DEPOSIT',
    family: 'BANK',
    label: 'Dépôt cash au guichet',
    description: 'Déposez du cash en agence bancaire',
  },
  // Orange Money sub-methods
  {
    subMethod: 'OM_TRANSFER',
    family: 'ORANGE_MONEY',
    label: 'Transfert OM',
    description: 'Envoyez vers le compte Bonzini',
  },
  {
    subMethod: 'OM_WITHDRAWAL',
    family: 'ORANGE_MONEY',
    label: 'Retrait OM',
    description: 'Nous initierons le retrait depuis votre numéro',
  },
  // MTN sub-methods
  {
    subMethod: 'MTN_TRANSFER',
    family: 'MTN_MONEY',
    label: 'Transfert MOMO',
    description: 'Envoyez vers le compte Bonzini',
  },
  {
    subMethod: 'MTN_WITHDRAWAL',
    family: 'MTN_MONEY',
    label: 'Retrait MOMO',
    description: 'Nous initierons le retrait depuis votre numéro',
  },
  // Agency - direct
  {
    subMethod: 'AGENCY_CASH',
    family: 'AGENCY_BONZINI',
    label: 'Dépôt en espèces',
    description: 'Apportez le cash directement',
  },
  // Wave - direct
  {
    subMethod: 'WAVE_TRANSFER',
    family: 'WAVE',
    label: 'Transfert Wave',
    description: 'Envoyez via l\'application Wave',
  },
];

// ============================================
// BANKS LIST
// ============================================
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

// ============================================
// BONZINI AGENCIES
// ============================================
export const agencies: AgencyInfo[] = [
  {
    agency: 'DOUALA_BONAPRISO',
    label: 'Douala - Bonapriso',
    address: 'Rue de la Joie, Bonapriso, Douala',
    hours: 'Lun-Ven: 8h-18h, Sam: 9h-14h',
  },
  {
    agency: 'DOUALA_BONAMOUSSADI',
    label: 'Douala - Bonamoussadi',
    address: 'Carrefour Maetur, Bonamoussadi, Douala',
    hours: 'Lun-Ven: 8h-18h, Sam: 9h-14h',
  },
  {
    agency: 'YAOUNDE_CENTRE',
    label: 'Yaoundé - Centre',
    address: 'Avenue Kennedy, Centre-ville, Yaoundé',
    hours: 'Lun-Ven: 8h-18h, Sam: 9h-13h',
  },
];

// ============================================
// MOBILE MONEY ACCOUNTS
// ============================================
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

// ============================================
// HELPERS
// ============================================
export const getSubMethodsForFamily = (family: DepositMethodFamily): SubMethodInfo[] => {
  return subMethods.filter(sm => sm.family === family);
};

export const getFamilyInfo = (family: DepositMethodFamily): MethodFamilyInfo | undefined => {
  return methodFamilies.find(mf => mf.family === family);
};

export const getBankInfo = (bank: string): BankInfo | undefined => {
  return banks.find(b => b.bank === bank);
};

export const getAgencyInfo = (agency: string): AgencyInfo | undefined => {
  return agencies.find(a => a.agency === agency);
};

// Check if family requires sub-method selection
export const familyRequiresSubMethod = (family: DepositMethodFamily): boolean => {
  const familiesWithSubMethods: DepositMethodFamily[] = ['BANK', 'ORANGE_MONEY', 'MTN_MONEY'];
  return familiesWithSubMethods.includes(family);
};

// Check if sub-method requires bank selection
export const subMethodRequiresBankSelection = (subMethod: DepositSubMethod): boolean => {
  return subMethod === 'BANK_TRANSFER' || subMethod === 'BANK_CASH_DEPOSIT';
};

// Check if sub-method requires agency selection
export const subMethodRequiresAgencySelection = (subMethod: DepositSubMethod): boolean => {
  return subMethod === 'AGENCY_CASH';
};

// Check if sub-method requires client phone (for withdrawal)
export const subMethodRequiresClientPhone = (subMethod: DepositSubMethod): boolean => {
  return subMethod === 'OM_WITHDRAWAL' || subMethod === 'MTN_WITHDRAWAL';
};

// Generate unique reference code
export const generateDepositReference = (clientName: string): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const cleanName = clientName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  return `BONZINI-${cleanName}-${dateStr}-${randomNum}`;
};
