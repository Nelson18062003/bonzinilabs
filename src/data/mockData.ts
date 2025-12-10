import { 
  User, 
  Wallet, 
  WalletOperation, 
  Deposit, 
  DepositTimeline,
  Payment,
  PaymentTimeline,
  Beneficiary,
  ExchangeRate,
  TimelineEvent,
  DepositMethodInfo,
  PaymentMethodInfo
} from '@/types';

// Current User
export const mockUser: User = {
  id: 'user-001',
  email: 'jean.dupont@email.com',
  phone: '+237 691 234 567',
  firstName: 'Jean',
  lastName: 'Dupont',
  avatar: undefined,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-12-01'),
};

// Wallet
export const mockWallet: Wallet = {
  id: 'wallet-001',
  userId: 'user-001',
  balanceXAF: 2_450_000,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-12-10'),
};

// Exchange Rates
export const mockExchangeRates: ExchangeRate[] = [
  { id: 'rate-001', date: new Date('2024-12-10'), xafToRmb: 0.0118, rmbToXaf: 84.75, createdAt: new Date() },
  { id: 'rate-002', date: new Date('2024-12-09'), xafToRmb: 0.0117, rmbToXaf: 85.47, createdAt: new Date() },
  { id: 'rate-003', date: new Date('2024-12-08'), xafToRmb: 0.0119, rmbToXaf: 84.03, createdAt: new Date() },
  { id: 'rate-004', date: new Date('2024-12-07'), xafToRmb: 0.0118, rmbToXaf: 84.75, createdAt: new Date() },
  { id: 'rate-005', date: new Date('2024-12-06'), xafToRmb: 0.0116, rmbToXaf: 86.21, createdAt: new Date() },
];

export const currentRate = mockExchangeRates[0];

// Wallet Operations
export const mockWalletOperations: WalletOperation[] = [
  {
    id: 'op-001',
    walletId: 'wallet-001',
    type: 'CREDIT',
    amountXAF: 500_000,
    description: 'Dépôt Orange Money',
    referenceType: 'DEPOSIT',
    referenceId: 'dep-001',
    balanceAfter: 2_450_000,
    createdAt: new Date('2024-12-08'),
  },
  {
    id: 'op-002',
    walletId: 'wallet-001',
    type: 'DEBIT',
    amountXAF: 350_000,
    description: 'Paiement Alipay - Wang Wei',
    referenceType: 'PAYMENT',
    referenceId: 'pay-001',
    balanceAfter: 1_950_000,
    createdAt: new Date('2024-12-07'),
  },
  {
    id: 'op-003',
    walletId: 'wallet-001',
    type: 'CREDIT',
    amountXAF: 1_000_000,
    description: 'Virement bancaire',
    referenceType: 'DEPOSIT',
    referenceId: 'dep-002',
    balanceAfter: 2_300_000,
    createdAt: new Date('2024-12-05'),
  },
  {
    id: 'op-004',
    walletId: 'wallet-001',
    type: 'DEBIT',
    amountXAF: 850_000,
    description: 'Paiement WeChat - Li Ming',
    referenceType: 'PAYMENT',
    referenceId: 'pay-002',
    balanceAfter: 1_300_000,
    createdAt: new Date('2024-12-03'),
  },
];

// Deposits
export const mockDeposits: Deposit[] = [
  {
    id: 'dep-001',
    userId: 'user-001',
    walletId: 'wallet-001',
    method: 'ORANGE_MONEY_TRANSFER',
    amountXAF: 500_000,
    status: 'VALIDATED',
    reference: 'OM-78945612',
    createdAt: new Date('2024-12-08'),
    updatedAt: new Date('2024-12-08'),
  },
  {
    id: 'dep-002',
    userId: 'user-001',
    walletId: 'wallet-001',
    method: 'BANK_TRANSFER',
    amountXAF: 1_000_000,
    status: 'VALIDATED',
    reference: 'VIR-20241205-001',
    createdAt: new Date('2024-12-05'),
    updatedAt: new Date('2024-12-05'),
  },
  {
    id: 'dep-003',
    userId: 'user-001',
    walletId: 'wallet-001',
    method: 'MTN_MONEY_TRANSFER',
    amountXAF: 250_000,
    status: 'UNDER_VERIFICATION',
    reference: 'MTN-45678912',
    createdAt: new Date('2024-12-10'),
    updatedAt: new Date('2024-12-10'),
  },
];

export const mockDepositTimelines: DepositTimeline[] = [
  { id: 'dt-001', depositId: 'dep-003', status: 'SUBMITTED', description: 'Dépôt soumis', createdAt: new Date('2024-12-10T10:00:00') },
  { id: 'dt-002', depositId: 'dep-003', status: 'PROOF_UPLOADED', description: 'Preuve téléchargée', createdAt: new Date('2024-12-10T10:15:00') },
  { id: 'dt-003', depositId: 'dep-003', status: 'UNDER_VERIFICATION', description: 'En cours de vérification', createdAt: new Date('2024-12-10T11:00:00') },
];

// Beneficiaries
export const mockBeneficiaries: Beneficiary[] = [
  {
    id: 'ben-001',
    userId: 'user-001',
    name: 'Wang Wei',
    chineseName: '王伟',
    paymentMethod: 'ALIPAY',
    accountNumber: '138****5678',
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'ben-002',
    userId: 'user-001',
    name: 'Li Ming',
    chineseName: '李明',
    paymentMethod: 'WECHAT',
    accountNumber: 'liming_wx',
    createdAt: new Date('2024-07-15'),
    updatedAt: new Date('2024-07-15'),
  },
  {
    id: 'ben-003',
    userId: 'user-001',
    name: 'Zhang Hua',
    chineseName: '张华',
    paymentMethod: 'BANK_TRANSFER',
    bankName: 'Bank of China',
    bankAccountNumber: '6222 **** **** 1234',
    bankAccountName: 'Zhang Hua',
    createdAt: new Date('2024-08-20'),
    updatedAt: new Date('2024-08-20'),
  },
];

// Payments
export const mockPayments: Payment[] = [
  {
    id: 'pay-001',
    userId: 'user-001',
    walletId: 'wallet-001',
    beneficiaryId: 'ben-001',
    method: 'ALIPAY',
    amountXAF: 350_000,
    amountRMB: 4130,
    exchangeRate: 0.0118,
    fees: 5000,
    status: 'PROOF_AVAILABLE',
    createdAt: new Date('2024-12-07'),
    updatedAt: new Date('2024-12-07'),
  },
  {
    id: 'pay-002',
    userId: 'user-001',
    walletId: 'wallet-001',
    beneficiaryId: 'ben-002',
    method: 'WECHAT',
    amountXAF: 850_000,
    amountRMB: 10030,
    exchangeRate: 0.0118,
    fees: 8000,
    status: 'COMPLETED',
    createdAt: new Date('2024-12-03'),
    updatedAt: new Date('2024-12-04'),
  },
  {
    id: 'pay-003',
    userId: 'user-001',
    walletId: 'wallet-001',
    beneficiaryId: 'ben-003',
    method: 'BANK_TRANSFER',
    amountXAF: 1_200_000,
    amountRMB: 14160,
    exchangeRate: 0.0118,
    fees: 12000,
    status: 'PROCESSING',
    createdAt: new Date('2024-12-10'),
    updatedAt: new Date('2024-12-10'),
  },
];

export const mockPaymentTimelines: PaymentTimeline[] = [
  { id: 'pt-001', paymentId: 'pay-003', status: 'SUBMITTED', description: 'Paiement soumis', createdAt: new Date('2024-12-10T09:00:00') },
  { id: 'pt-002', paymentId: 'pay-003', status: 'INFO_RECEIVED', description: 'Informations validées', createdAt: new Date('2024-12-10T09:30:00') },
  { id: 'pt-003', paymentId: 'pay-003', status: 'PROCESSING', description: 'Paiement en cours', createdAt: new Date('2024-12-10T10:00:00') },
];

// Timeline Events
export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: 'te-001',
    userId: 'user-001',
    type: 'DEPOSIT',
    referenceId: 'dep-003',
    title: 'Dépôt MTN Money',
    description: 'En cours de vérification',
    status: 'UNDER_VERIFICATION',
    createdAt: new Date('2024-12-10T11:00:00'),
  },
  {
    id: 'te-002',
    userId: 'user-001',
    type: 'PAYMENT',
    referenceId: 'pay-003',
    title: 'Paiement Bank Transfer',
    description: 'Paiement en cours de traitement',
    status: 'PROCESSING',
    createdAt: new Date('2024-12-10T10:00:00'),
  },
  {
    id: 'te-003',
    userId: 'user-001',
    type: 'DEPOSIT',
    referenceId: 'dep-001',
    title: 'Dépôt Orange Money',
    description: 'Dépôt validé et crédité',
    status: 'VALIDATED',
    createdAt: new Date('2024-12-08T14:00:00'),
  },
];

// Deposit Methods Info
export const depositMethodsInfo: DepositMethodInfo[] = [
  {
    method: 'BANK_TRANSFER',
    label: 'Virement bancaire',
    icon: 'Building2',
    description: 'Effectuez un virement vers notre compte',
    instructions: [
      'Connectez-vous à votre application bancaire',
      'Effectuez un virement vers le compte indiqué',
      'Utilisez votre ID client comme référence',
      'Téléchargez le reçu de virement',
    ],
    accountInfo: {
      bankName: 'Afriland First Bank',
      accountNumber: '10005 00001 12345678901 23',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'CASH_DEPOSIT',
    label: 'Dépôt cash en banque',
    icon: 'Banknote',
    description: 'Déposez de l\'argent en agence bancaire',
    instructions: [
      'Rendez-vous dans une agence Afriland First Bank',
      'Effectuez un dépôt sur le compte Bonzini',
      'Mentionnez votre ID client',
      'Conservez et téléchargez le bordereau',
    ],
    accountInfo: {
      bankName: 'Afriland First Bank',
      accountNumber: '10005 00001 12345678901 23',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'AGENCY_DEPOSIT',
    label: 'Dépôt en agence Bonzini',
    icon: 'Store',
    description: 'Déposez directement dans nos locaux',
    instructions: [
      'Rendez-vous à notre agence',
      'Présentez votre pièce d\'identité',
      'Effectuez votre dépôt',
      'Recevez votre reçu',
    ],
    accountInfo: {
      address: 'Rue de la Joie, Douala, Cameroun',
    },
  },
  {
    method: 'ORANGE_MONEY_TRANSFER',
    label: 'Orange Money - Transfert',
    icon: 'Smartphone',
    description: 'Transférez via Orange Money',
    instructions: [
      'Composez #150*1*1#',
      'Entrez le numéro: 691 000 001',
      'Saisissez le montant',
      'Confirmez avec votre code PIN',
      'Téléchargez le SMS de confirmation',
    ],
    accountInfo: {
      phone: '691 000 001',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'ORANGE_MONEY_WITHDRAWAL',
    label: 'Orange Money - Retrait code',
    icon: 'KeyRound',
    description: 'Générez un code de retrait',
    instructions: [
      'Composez #150*1*2#',
      'Générez un code de retrait',
      'Envoyez le code au: 691 000 002',
      'Attendez la confirmation',
    ],
    accountInfo: {
      phone: '691 000 002',
    },
  },
  {
    method: 'MTN_MONEY_TRANSFER',
    label: 'MTN Money - Transfert',
    icon: 'Smartphone',
    description: 'Transférez via MTN Money',
    instructions: [
      'Composez *126#',
      'Sélectionnez "Transfert d\'argent"',
      'Entrez le numéro: 670 000 001',
      'Saisissez le montant',
      'Confirmez avec votre code PIN',
    ],
    accountInfo: {
      phone: '670 000 001',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'MTN_MONEY_WITHDRAWAL',
    label: 'MTN Money - Retrait code',
    icon: 'KeyRound',
    description: 'Générez un code de retrait MTN',
    instructions: [
      'Composez *126#',
      'Sélectionnez "Retrait sans carte"',
      'Générez un code',
      'Envoyez le code au: 670 000 002',
    ],
    accountInfo: {
      phone: '670 000 002',
    },
  },
  {
    method: 'WAVE',
    label: 'Wave',
    icon: 'Waves',
    description: 'Transférez via Wave',
    instructions: [
      'Ouvrez l\'application Wave',
      'Sélectionnez "Envoyer"',
      'Entrez le numéro: 691 000 003',
      'Saisissez le montant',
      'Confirmez le transfert',
    ],
    accountInfo: {
      phone: '691 000 003',
      accountName: 'BONZINI SARL',
    },
  },
];

// Payment Methods Info
export const paymentMethodsInfo: PaymentMethodInfo[] = [
  {
    method: 'ALIPAY',
    label: 'Alipay',
    icon: 'QrCode',
    description: 'Paiement via Alipay',
    requiredFields: ['qrCode', 'accountNumber', 'chineseName'],
  },
  {
    method: 'WECHAT',
    label: 'WeChat Pay',
    icon: 'MessageCircle',
    description: 'Paiement via WeChat',
    requiredFields: ['qrCode', 'accountNumber', 'chineseName'],
  },
  {
    method: 'BANK_TRANSFER',
    label: 'Virement bancaire',
    icon: 'Building2',
    description: 'Virement vers compte chinois',
    requiredFields: ['bankName', 'bankAccountNumber', 'bankAccountName'],
  },
  {
    method: 'CASH_COUNTER',
    label: 'Cash Counter',
    icon: 'Banknote',
    description: 'Retrait au comptoir',
    requiredFields: ['chineseName', 'idNumber', 'phone'],
  },
];

// Helper functions
export const formatXAF = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR').format(amount);
};

export const formatRMB = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN').format(amount);
};

export const convertXAFtoRMB = (amountXAF: number, rate?: number): number => {
  const useRate = rate || currentRate.xafToRmb;
  return Math.round(amountXAF * useRate);
};

export const convertRMBtoXAF = (amountRMB: number, rate?: number): number => {
  const useRate = rate || currentRate.rmbToXaf;
  return Math.round(amountRMB * useRate);
};

export const getDepositStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    SUBMITTED: 'Soumis',
    PROOF_UPLOADED: 'Preuve envoyée',
    UNDER_VERIFICATION: 'En vérification',
    VALIDATED: 'Validé',
    REJECTED: 'Rejeté',
  };
  return labels[status] || status;
};

export const getPaymentStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    SUBMITTED: 'Soumis',
    INFO_RECEIVED: 'Infos reçues',
    PROCESSING: 'En cours',
    COMPLETED: 'Effectué',
    PROOF_AVAILABLE: 'Preuve dispo',
    CANCELLED: 'Annulé',
  };
  return labels[status] || status;
};
