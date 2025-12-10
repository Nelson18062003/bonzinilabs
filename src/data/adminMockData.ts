// ============================================
// BONZINI ADMIN - MOCK DATA
// ============================================

import {
  AdminUser,
  Client,
  ClientWithTags,
  Tag,
  AdminDeposit,
  AdminPayment,
  AdminLogEntry,
  DashboardStats,
  NotificationTemplate,
  Wallet,
  WalletOperation,
  DepositProof,
  DepositTimelineEvent,
  DepositStatus,
} from '@/types/admin';

// Current Admin User (logged in)
export const currentAdminUser: AdminUser = {
  id: 'admin-001',
  email: 'admin@bonzini.com',
  firstName: 'Jean',
  lastName: 'Dupont',
  role: 'SUPER_ADMIN',
  isActive: true,
  lastLogin: new Date(),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
};

// Admin Users
export const adminUsers: AdminUser[] = [
  currentAdminUser,
  {
    id: 'admin-002',
    email: 'ops@bonzini.com',
    firstName: 'Marie',
    lastName: 'Nkomo',
    role: 'OPS',
    isActive: true,
    lastLogin: new Date('2024-12-09'),
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date(),
  },
  {
    id: 'admin-003',
    email: 'support@bonzini.com',
    firstName: 'Paul',
    lastName: 'Mbarga',
    role: 'SUPPORT',
    isActive: true,
    lastLogin: new Date('2024-12-08'),
    createdAt: new Date('2024-03-20'),
    updatedAt: new Date(),
  },
  {
    id: 'admin-004',
    email: 'account@bonzini.com',
    firstName: 'Sophie',
    lastName: 'Eto\'o',
    role: 'ACCOUNT_MANAGER',
    isActive: false,
    createdAt: new Date('2024-04-10'),
    updatedAt: new Date(),
  },
];

// Tags Table
export const tags: Tag[] = [
  {
    id: 'tag-001',
    name: 'VIP',
    color: 'bg-primary/10 text-primary',
    description: 'Client premium',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'tag-002',
    name: 'High Volume',
    color: 'bg-blue-500/10 text-blue-600',
    description: 'Gros volumes',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'tag-003',
    name: 'Enterprise',
    color: 'bg-purple-500/10 text-purple-600',
    description: 'Entreprise',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'tag-004',
    name: 'Nouveau',
    color: 'bg-emerald-500/10 text-emerald-600',
    description: 'Nouveau client',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'tag-005',
    name: 'Régulier',
    color: 'bg-gray-500/10 text-gray-600',
    description: 'Client régulier',
    createdAt: new Date('2024-01-01'),
  },
];

// Clients
export const clients: Client[] = [
  {
    id: 'client-001',
    firstName: 'John',
    lastName: 'Doe',
    gender: 'MALE',
    whatsappNumber: '+237 6 90 12 34 56',
    email: 'john.doe@example.com',
    company: 'Import Express SARL',
    country: 'Cameroun',
    city: 'Douala',
    tagIds: ['tag-001', 'tag-002'],
    status: 'ACTIVE',
    kycVerified: true,
    totalDeposits: 15000000,
    totalPayments: 12500000,
    walletBalance: 2500000,
    lastDepositAt: new Date('2024-12-07'),
    lastPaymentAt: new Date('2024-12-06'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(),
  },
  {
    id: 'client-002',
    firstName: 'Marie',
    lastName: 'Chen',
    gender: 'FEMALE',
    whatsappNumber: '+237 6 77 88 99 00',
    email: 'marie.chen@example.com',
    country: 'Cameroun',
    city: 'Yaoundé',
    tagIds: ['tag-005'],
    status: 'ACTIVE',
    kycVerified: true,
    totalDeposits: 3500000,
    totalPayments: 3200000,
    walletBalance: 300000,
    lastDepositAt: new Date('2024-12-09'),
    lastPaymentAt: new Date('2024-12-08'),
    createdAt: new Date('2024-03-22'),
    updatedAt: new Date(),
  },
  {
    id: 'client-003',
    firstName: 'Pierre',
    lastName: 'Nkeng',
    gender: 'MALE',
    whatsappNumber: '+237 6 55 44 33 22',
    email: 'pierre.nkeng@example.com',
    company: 'Tech Solutions',
    country: 'Cameroun',
    tagIds: ['tag-004'],
    status: 'PENDING_KYC',
    kycVerified: false,
    totalDeposits: 0,
    totalPayments: 0,
    walletBalance: 0,
    createdAt: new Date('2024-12-05'),
    updatedAt: new Date(),
  },
  {
    id: 'client-004',
    firstName: 'Alice',
    lastName: 'Mbeki',
    gender: 'FEMALE',
    whatsappNumber: '+237 6 11 22 33 44',
    email: 'alice.mbeki@example.com',
    company: 'Global Trading Co.',
    country: 'Cameroun',
    city: 'Douala',
    tagIds: ['tag-001', 'tag-003'],
    status: 'ACTIVE',
    kycVerified: true,
    totalDeposits: 45000000,
    totalPayments: 42000000,
    walletBalance: 3000000,
    lastDepositAt: new Date('2024-12-08'),
    lastPaymentAt: new Date('2024-12-09'),
    createdAt: new Date('2023-11-10'),
    updatedAt: new Date(),
  },
  {
    id: 'client-005',
    firstName: 'Bob',
    lastName: 'Fang',
    gender: 'MALE',
    whatsappNumber: '+237 6 99 88 77 66',
    country: 'Cameroun',
    city: 'Bafoussam',
    tagIds: ['tag-005'],
    status: 'SUSPENDED',
    kycVerified: true,
    notes: 'Compte suspendu pour vérification',
    totalDeposits: 500000,
    totalPayments: 500000,
    walletBalance: 0,
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date(),
  },
];

// Helper to get client with resolved tags
export const getClientWithTags = (client: Client): ClientWithTags => {
  const clientTags = client.tagIds
    .map(tagId => tags.find(t => t.id === tagId))
    .filter((t): t is Tag => t !== undefined);
  
  const { tagIds, ...rest } = client;
  return { ...rest, tags: clientTags };
};

export const getTagById = (tagId: string): Tag | undefined => {
  return tags.find(t => t.id === tagId);
};

// Admin Deposits
export const adminDeposits: AdminDeposit[] = [
  {
    id: 'dep-admin-001',
    clientId: 'client-001',
    clientName: 'John Doe',
    clientEmail: 'john.doe@example.com',
    walletId: 'wallet-001',
    method: 'BANK_TRANSFER',
    amountXAF: 500000,
    status: 'SUBMITTED',
    reference: 'VIR-2024-001',
    createdAt: new Date('2024-12-10T09:00:00'),
    updatedAt: new Date(),
  },
  {
    id: 'dep-admin-002',
    clientId: 'client-002',
    clientName: 'Marie Chen',
    clientEmail: 'marie.chen@example.com',
    walletId: 'wallet-002',
    method: 'ORANGE_MONEY',
    amountXAF: 150000,
    status: 'PROOF_UPLOADED',
    proofUrl: '/proofs/dep-002.jpg',
    proofFileName: 'screenshot_om.jpg',
    createdAt: new Date('2024-12-09T14:30:00'),
    updatedAt: new Date(),
  },
  {
    id: 'dep-admin-003',
    clientId: 'client-004',
    clientName: 'Alice Mbeki',
    clientEmail: 'alice.mbeki@example.com',
    walletId: 'wallet-004',
    method: 'CASH_BANK',
    amountXAF: 2000000,
    status: 'UNDER_VERIFICATION',
    proofUrl: '/proofs/dep-003.pdf',
    proofFileName: 'bordereau_bank.pdf',
    assignedTo: 'admin-002',
    createdAt: new Date('2024-12-08T11:00:00'),
    updatedAt: new Date(),
  },
  {
    id: 'dep-admin-004',
    clientId: 'client-001',
    clientName: 'John Doe',
    clientEmail: 'john.doe@example.com',
    walletId: 'wallet-001',
    method: 'WAVE',
    amountXAF: 300000,
    status: 'VALIDATED',
    proofUrl: '/proofs/dep-004.jpg',
    proofFileName: 'wave_receipt.jpg',
    validatedBy: 'admin-001',
    validatedAt: new Date('2024-12-07T16:00:00'),
    adminComment: 'Preuve valide, montant confirmé',
    createdAt: new Date('2024-12-07T10:00:00'),
    updatedAt: new Date(),
  },
  {
    id: 'dep-admin-005',
    clientId: 'client-005',
    clientName: 'Bob Fang',
    clientEmail: 'bob.fang@example.com',
    walletId: 'wallet-005',
    method: 'MTN_MONEY',
    amountXAF: 100000,
    status: 'REJECTED',
    proofUrl: '/proofs/dep-005.jpg',
    proofFileName: 'mtn_screenshot.jpg',
    rejectedBy: 'admin-002',
    rejectedAt: new Date('2024-12-06T14:00:00'),
    rejectionReason: 'Preuve illisible - veuillez soumettre une capture plus claire',
    createdAt: new Date('2024-12-06T09:00:00'),
    updatedAt: new Date(),
  },
];

// ============================================
// DEPOSIT_PROOFS TABLE
// ============================================
export const depositProofs: DepositProof[] = [
  {
    id: 'proof-001',
    depositId: 'dep-admin-002',
    fileUrl: '/proofs/dep-002.jpg',
    fileName: 'screenshot_om.jpg',
    fileType: 'image',
    fileSize: 245000,
    uploadedAt: new Date('2024-12-09T14:35:00'),
  },
  {
    id: 'proof-002',
    depositId: 'dep-admin-003',
    fileUrl: '/proofs/dep-003.pdf',
    fileName: 'bordereau_bank.pdf',
    fileType: 'pdf',
    fileSize: 1250000,
    uploadedAt: new Date('2024-12-08T11:15:00'),
  },
  {
    id: 'proof-003',
    depositId: 'dep-admin-004',
    fileUrl: '/proofs/dep-004.jpg',
    fileName: 'wave_receipt.jpg',
    fileType: 'image',
    fileSize: 320000,
    uploadedAt: new Date('2024-12-07T10:30:00'),
  },
  {
    id: 'proof-004',
    depositId: 'dep-admin-005',
    fileUrl: '/proofs/dep-005.jpg',
    fileName: 'mtn_screenshot.jpg',
    fileType: 'image',
    fileSize: 180000,
    uploadedAt: new Date('2024-12-06T09:30:00'),
  },
];

// ============================================
// DEPOSIT_TIMELINE TABLE
// ============================================
export const depositTimelines: DepositTimelineEvent[] = [
  // dep-admin-001 timeline (SUBMITTED)
  {
    id: 'timeline-001',
    depositId: 'dep-admin-001',
    step: 'SUBMITTED',
    description: 'Demande de dépôt soumise',
    performedBy: 'CLIENT',
    performedByName: 'John Doe',
    timestamp: new Date('2024-12-10T09:00:00'),
  },
  // dep-admin-002 timeline (PROOF_UPLOADED)
  {
    id: 'timeline-002',
    depositId: 'dep-admin-002',
    step: 'SUBMITTED',
    description: 'Demande de dépôt soumise',
    performedBy: 'CLIENT',
    performedByName: 'Marie Chen',
    timestamp: new Date('2024-12-09T14:30:00'),
  },
  {
    id: 'timeline-003',
    depositId: 'dep-admin-002',
    step: 'PROOF_UPLOADED',
    description: 'Preuve de paiement uploadée',
    performedBy: 'CLIENT',
    performedByName: 'Marie Chen',
    timestamp: new Date('2024-12-09T14:35:00'),
  },
  // dep-admin-003 timeline (UNDER_VERIFICATION)
  {
    id: 'timeline-004',
    depositId: 'dep-admin-003',
    step: 'SUBMITTED',
    description: 'Demande de dépôt soumise',
    performedBy: 'CLIENT',
    performedByName: 'Alice Mbeki',
    timestamp: new Date('2024-12-08T11:00:00'),
  },
  {
    id: 'timeline-005',
    depositId: 'dep-admin-003',
    step: 'PROOF_UPLOADED',
    description: 'Bordereau bancaire uploadé',
    performedBy: 'CLIENT',
    performedByName: 'Alice Mbeki',
    timestamp: new Date('2024-12-08T11:15:00'),
  },
  {
    id: 'timeline-006',
    depositId: 'dep-admin-003',
    step: 'UNDER_VERIFICATION',
    description: 'Dépôt assigné pour vérification',
    performedBy: 'ADMIN',
    performedByName: 'Marie Nkomo',
    performedByAdminId: 'admin-002',
    timestamp: new Date('2024-12-08T14:00:00'),
  },
  // dep-admin-004 timeline (VALIDATED)
  {
    id: 'timeline-007',
    depositId: 'dep-admin-004',
    step: 'SUBMITTED',
    description: 'Demande de dépôt soumise',
    performedBy: 'CLIENT',
    performedByName: 'John Doe',
    timestamp: new Date('2024-12-07T10:00:00'),
  },
  {
    id: 'timeline-008',
    depositId: 'dep-admin-004',
    step: 'PROOF_UPLOADED',
    description: 'Reçu Wave uploadé',
    performedBy: 'CLIENT',
    performedByName: 'John Doe',
    timestamp: new Date('2024-12-07T10:30:00'),
  },
  {
    id: 'timeline-009',
    depositId: 'dep-admin-004',
    step: 'UNDER_VERIFICATION',
    description: 'Dépôt pris en charge',
    performedBy: 'ADMIN',
    performedByName: 'Jean Dupont',
    performedByAdminId: 'admin-001',
    timestamp: new Date('2024-12-07T15:00:00'),
  },
  {
    id: 'timeline-010',
    depositId: 'dep-admin-004',
    step: 'VALIDATED',
    description: 'Dépôt validé - preuve conforme',
    performedBy: 'ADMIN',
    performedByName: 'Jean Dupont',
    performedByAdminId: 'admin-001',
    timestamp: new Date('2024-12-07T16:00:00'),
  },
  {
    id: 'timeline-011',
    depositId: 'dep-admin-004',
    step: 'WALLET_CREDITED',
    description: 'Wallet crédité de 300,000 XAF',
    performedBy: 'SYSTEM',
    timestamp: new Date('2024-12-07T16:00:01'),
  },
  // dep-admin-005 timeline (REJECTED)
  {
    id: 'timeline-012',
    depositId: 'dep-admin-005',
    step: 'SUBMITTED',
    description: 'Demande de dépôt soumise',
    performedBy: 'CLIENT',
    performedByName: 'Bob Fang',
    timestamp: new Date('2024-12-06T09:00:00'),
  },
  {
    id: 'timeline-013',
    depositId: 'dep-admin-005',
    step: 'PROOF_UPLOADED',
    description: 'Capture MTN Money uploadée',
    performedBy: 'CLIENT',
    performedByName: 'Bob Fang',
    timestamp: new Date('2024-12-06T09:30:00'),
  },
  {
    id: 'timeline-014',
    depositId: 'dep-admin-005',
    step: 'UNDER_VERIFICATION',
    description: 'Dépôt assigné pour vérification',
    performedBy: 'ADMIN',
    performedByName: 'Marie Nkomo',
    performedByAdminId: 'admin-002',
    timestamp: new Date('2024-12-06T12:00:00'),
  },
  {
    id: 'timeline-015',
    depositId: 'dep-admin-005',
    step: 'REJECTED',
    description: 'Dépôt rejeté - preuve illisible',
    performedBy: 'ADMIN',
    performedByName: 'Marie Nkomo',
    performedByAdminId: 'admin-002',
    timestamp: new Date('2024-12-06T14:00:00'),
  },
];

// Helper to get deposit proofs
export const getDepositProofs = (depositId: string): DepositProof[] => {
  return depositProofs.filter(p => p.depositId === depositId);
};

// Helper to get deposit timeline
export const getDepositTimeline = (depositId: string): DepositTimelineEvent[] => {
  return depositTimelines
    .filter(t => t.depositId === depositId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

// Helper to get deposit by ID
export const getDepositById = (depositId: string): AdminDeposit | undefined => {
  return adminDeposits.find(d => d.id === depositId);
};

// Admin Payments
export const adminPayments: AdminPayment[] = [
  {
    id: 'pay-admin-001',
    clientId: 'client-001',
    clientName: 'John Doe',
    clientEmail: 'john.doe@example.com',
    walletId: 'wallet-001',
    beneficiaryId: 'ben-001',
    beneficiaryName: 'Wang Wei',
    method: 'ALIPAY',
    amountXAF: 750000,
    amountRMB: 8625,
    exchangeRate: 87,
    fees: 7500,
    status: 'SUBMITTED',
    createdAt: new Date('2024-12-10T10:30:00'),
    updatedAt: new Date(),
  },
  {
    id: 'pay-admin-002',
    clientId: 'client-004',
    clientName: 'Alice Mbeki',
    clientEmail: 'alice.mbeki@example.com',
    walletId: 'wallet-004',
    beneficiaryId: 'ben-002',
    beneficiaryName: 'Li Ming',
    method: 'BANK_TRANSFER',
    amountXAF: 1500000,
    amountRMB: 17250,
    exchangeRate: 87,
    fees: 15000,
    status: 'PROCESSING',
    processedBy: 'admin-002',
    createdAt: new Date('2024-12-09T08:00:00'),
    updatedAt: new Date(),
  },
  {
    id: 'pay-admin-003',
    clientId: 'client-002',
    clientName: 'Marie Chen',
    clientEmail: 'marie.chen@example.com',
    walletId: 'wallet-002',
    beneficiaryId: 'ben-003',
    beneficiaryName: 'Zhang Xiaoming',
    method: 'WECHAT',
    amountXAF: 200000,
    amountRMB: 2300,
    exchangeRate: 87,
    fees: 2000,
    status: 'COMPLETED',
    proofUrl: '/proofs/pay-003.jpg',
    proofFileName: 'wechat_receipt.jpg',
    processedBy: 'admin-001',
    completedAt: new Date('2024-12-08T15:00:00'),
    createdAt: new Date('2024-12-08T09:00:00'),
    updatedAt: new Date(),
  },
  {
    id: 'pay-admin-004',
    clientId: 'client-001',
    clientName: 'John Doe',
    clientEmail: 'john.doe@example.com',
    walletId: 'wallet-001',
    beneficiaryId: 'ben-001',
    beneficiaryName: 'Wang Wei',
    method: 'ALIPAY',
    amountXAF: 500000,
    amountRMB: 5750,
    exchangeRate: 87,
    fees: 5000,
    status: 'PROOF_AVAILABLE',
    proofUrl: '/proofs/pay-004.pdf',
    proofFileName: 'alipay_proof.pdf',
    processedBy: 'admin-002',
    completedAt: new Date('2024-12-07T12:00:00'),
    createdAt: new Date('2024-12-06T14:00:00'),
    updatedAt: new Date(),
  },
];

// Admin Logs
export const adminLogs: AdminLogEntry[] = [
  {
    id: 'log-001',
    adminUserId: 'admin-001',
    adminUserName: 'Jean Dupont',
    actionType: 'LOGIN',
    targetType: 'AUTH',
    description: 'Connexion au tableau de bord',
    ipAddress: '192.168.1.100',
    createdAt: new Date('2024-12-10T08:00:00'),
  },
  {
    id: 'log-002',
    adminUserId: 'admin-002',
    adminUserName: 'Marie Nkomo',
    actionType: 'DEPOSIT_VALIDATED',
    targetType: 'DEPOSIT',
    targetId: 'dep-admin-004',
    description: 'Dépôt validé pour John Doe - 300,000 XAF',
    createdAt: new Date('2024-12-07T16:00:00'),
  },
  {
    id: 'log-003',
    adminUserId: 'admin-001',
    adminUserName: 'Jean Dupont',
    actionType: 'PAYMENT_COMPLETED',
    targetType: 'PAYMENT',
    targetId: 'pay-admin-003',
    description: 'Paiement effectué pour Marie Chen - 200,000 XAF → 2,300 RMB',
    createdAt: new Date('2024-12-08T15:00:00'),
  },
  {
    id: 'log-004',
    adminUserId: 'admin-001',
    adminUserName: 'Jean Dupont',
    actionType: 'RATE_UPDATED',
    targetType: 'RATE',
    description: 'Taux mis à jour: 1 RMB = 87 XAF',
    metadata: { oldRate: 86.5, newRate: 87 },
    createdAt: new Date('2024-12-09T09:00:00'),
  },
  {
    id: 'log-005',
    adminUserId: 'admin-003',
    adminUserName: 'Paul Mbarga',
    actionType: 'CLIENT_SUSPENDED',
    targetType: 'CLIENT',
    targetId: 'client-005',
    description: 'Compte client suspendu: Bob Fang - Vérification requise',
    createdAt: new Date('2024-12-06T11:00:00'),
  },
];

// ============================================
// WALLETS TABLE
// ============================================
export const wallets: Wallet[] = [
  {
    id: 'wallet-001',
    clientId: 'client-001',
    currentBalanceXAF: 2500000,
    updatedAt: new Date('2024-12-10T09:00:00'),
  },
  {
    id: 'wallet-002',
    clientId: 'client-002',
    currentBalanceXAF: 300000,
    updatedAt: new Date('2024-12-09T14:30:00'),
  },
  {
    id: 'wallet-003',
    clientId: 'client-003',
    currentBalanceXAF: 0,
    updatedAt: new Date('2024-12-05T10:00:00'),
  },
  {
    id: 'wallet-004',
    clientId: 'client-004',
    currentBalanceXAF: 3000000,
    updatedAt: new Date('2024-12-09T08:00:00'),
  },
  {
    id: 'wallet-005',
    clientId: 'client-005',
    currentBalanceXAF: 0,
    updatedAt: new Date('2024-12-06T11:00:00'),
  },
];

// ============================================
// WALLET_OPERATIONS TABLE
// ============================================
export const walletOperations: WalletOperation[] = [
  // Client 001 - John Doe operations
  {
    id: 'wop-001',
    walletId: 'wallet-001',
    type: 'CREDIT',
    sourceType: 'DEPOSIT',
    sourceId: 'dep-admin-004',
    amountXAF: 300000,
    description: 'Dépôt Wave validé',
    createdAt: new Date('2024-12-07T16:00:00'),
  },
  {
    id: 'wop-002',
    walletId: 'wallet-001',
    type: 'DEBIT',
    sourceType: 'PAYMENT',
    sourceId: 'pay-admin-004',
    amountXAF: 500000,
    description: 'Paiement Alipay - Wang Wei',
    createdAt: new Date('2024-12-07T12:00:00'),
  },
  {
    id: 'wop-003',
    walletId: 'wallet-001',
    type: 'CREDIT',
    sourceType: 'DEPOSIT',
    sourceId: 'dep-001',
    amountXAF: 1500000,
    description: 'Dépôt virement bancaire',
    createdAt: new Date('2024-12-05T10:00:00'),
  },
  {
    id: 'wop-004',
    walletId: 'wallet-001',
    type: 'ADJUSTMENT',
    sourceType: 'MANUAL',
    amountXAF: 50000,
    description: 'Correction erreur de conversion',
    createdAt: new Date('2024-12-04T14:30:00'),
    createdByAdminUserId: 'admin-001',
  },
  // Client 002 - Marie Chen operations
  {
    id: 'wop-005',
    walletId: 'wallet-002',
    type: 'CREDIT',
    sourceType: 'DEPOSIT',
    sourceId: 'dep-002',
    amountXAF: 500000,
    description: 'Dépôt Orange Money',
    createdAt: new Date('2024-12-08T11:00:00'),
  },
  {
    id: 'wop-006',
    walletId: 'wallet-002',
    type: 'DEBIT',
    sourceType: 'PAYMENT',
    sourceId: 'pay-admin-003',
    amountXAF: 200000,
    description: 'Paiement WeChat - Zhang Xiaoming',
    createdAt: new Date('2024-12-08T15:00:00'),
  },
  // Client 004 - Alice Mbeki operations
  {
    id: 'wop-007',
    walletId: 'wallet-004',
    type: 'CREDIT',
    sourceType: 'DEPOSIT',
    sourceId: 'dep-003',
    amountXAF: 2000000,
    description: 'Dépôt cash en agence',
    createdAt: new Date('2024-12-08T11:00:00'),
  },
  {
    id: 'wop-008',
    walletId: 'wallet-004',
    type: 'DEBIT',
    sourceType: 'PAYMENT',
    sourceId: 'pay-admin-002',
    amountXAF: 1500000,
    description: 'Paiement virement bancaire - Li Ming',
    createdAt: new Date('2024-12-09T08:00:00'),
  },
  {
    id: 'wop-009',
    walletId: 'wallet-004',
    type: 'ADJUSTMENT',
    sourceType: 'MANUAL',
    amountXAF: -25000,
    description: 'Frais de service exceptionnels',
    createdAt: new Date('2024-12-03T09:00:00'),
    createdByAdminUserId: 'admin-002',
  },
  // Client 005 - Bob Fang operations (suspended)
  {
    id: 'wop-010',
    walletId: 'wallet-005',
    type: 'CREDIT',
    sourceType: 'DEPOSIT',
    sourceId: 'dep-005',
    amountXAF: 500000,
    description: 'Dépôt MTN Money',
    createdAt: new Date('2024-05-01T10:00:00'),
  },
  {
    id: 'wop-011',
    walletId: 'wallet-005',
    type: 'DEBIT',
    sourceType: 'PAYMENT',
    sourceId: 'pay-005',
    amountXAF: 500000,
    description: 'Paiement Alipay',
    createdAt: new Date('2024-05-15T14:00:00'),
  },
];

// Helper to get wallet by client ID
export const getWalletByClientId = (clientId: string): Wallet | undefined => {
  return wallets.find(w => w.clientId === clientId);
};

// Helper to get wallet operations by wallet ID
export const getWalletOperations = (walletId: string): WalletOperation[] => {
  return walletOperations
    .filter(op => op.walletId === walletId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// Helper to get wallet operations by client ID
export const getWalletOperationsByClientId = (clientId: string): WalletOperation[] => {
  const wallet = getWalletByClientId(clientId);
  if (!wallet) return [];
  return getWalletOperations(wallet.id);
};

// Calculate today's credits and debits
export const getTodayWalletStats = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayOps = walletOperations.filter(op => {
    const opDate = new Date(op.createdAt);
    opDate.setHours(0, 0, 0, 0);
    return opDate.getTime() === today.getTime();
  });
  
  const credits = todayOps
    .filter(op => op.type === 'CREDIT' || (op.type === 'ADJUSTMENT' && op.amountXAF > 0))
    .reduce((sum, op) => sum + Math.abs(op.amountXAF), 0);
    
  const debits = todayOps
    .filter(op => op.type === 'DEBIT' || (op.type === 'ADJUSTMENT' && op.amountXAF < 0))
    .reduce((sum, op) => sum + Math.abs(op.amountXAF), 0);
  
  return { credits, debits };
};

// Exchange Rates History
export const exchangeRatesHistory = [
  { id: 'rate-001', date: new Date('2024-12-01'), xafToRmb: 0.0114, rmbToXaf: 87.5 },
  { id: 'rate-002', date: new Date('2024-12-02'), xafToRmb: 0.0115, rmbToXaf: 87.0 },
  { id: 'rate-003', date: new Date('2024-12-03'), xafToRmb: 0.0114, rmbToXaf: 87.2 },
  { id: 'rate-004', date: new Date('2024-12-04'), xafToRmb: 0.0116, rmbToXaf: 86.5 },
  { id: 'rate-005', date: new Date('2024-12-05'), xafToRmb: 0.0115, rmbToXaf: 87.0 },
  { id: 'rate-006', date: new Date('2024-12-06'), xafToRmb: 0.0114, rmbToXaf: 87.5 },
  { id: 'rate-007', date: new Date('2024-12-07'), xafToRmb: 0.0115, rmbToXaf: 87.0 },
  { id: 'rate-008', date: new Date('2024-12-08'), xafToRmb: 0.0115, rmbToXaf: 87.0 },
  { id: 'rate-009', date: new Date('2024-12-09'), xafToRmb: 0.0115, rmbToXaf: 87.0 },
  { id: 'rate-010', date: new Date('2024-12-10'), xafToRmb: 0.0115, rmbToXaf: 87.0 },
];

// Dashboard Stats
export const dashboardStats: DashboardStats = {
  totalClients: 156,
  activeClients: 142,
  totalWalletBalance: 45750000,
  pendingDeposits: 3,
  pendingPayments: 2,
  todayDeposits: 2,
  todayPayments: 1,
  todayVolume: 1250000,
  currentRate: 87,
};

// Notification Templates
export const notificationTemplates: NotificationTemplate[] = [
  {
    id: 'notif-001',
    name: 'Dépôt validé',
    type: 'WHATSAPP',
    trigger: 'DEPOSIT_VALIDATED',
    content: 'Bonjour {{client_name}}, votre dépôt de {{amount}} XAF a été validé. Nouveau solde: {{balance}} XAF.',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
  {
    id: 'notif-002',
    name: 'Paiement effectué',
    type: 'WHATSAPP',
    trigger: 'PAYMENT_COMPLETED',
    content: 'Bonjour {{client_name}}, votre paiement de {{amount_rmb}} RMB à {{beneficiary_name}} a été effectué.',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
  {
    id: 'notif-003',
    name: 'Preuve disponible',
    type: 'EMAIL',
    trigger: 'PROOF_AVAILABLE',
    subject: 'Preuve de paiement disponible - Bonzini',
    content: 'Bonjour {{client_name}},\n\nLa preuve de votre paiement est maintenant disponible dans votre espace client.\n\nCordialement,\nL\'équipe Bonzini',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
];

// Helper functions
export const getDepositStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    SUBMITTED: 'Soumis',
    PROOF_UPLOADED: 'Preuve reçue',
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

export const getClientStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    ACTIVE: 'Actif',
    INACTIVE: 'Inactif',
    SUSPENDED: 'Suspendu',
    PENDING_KYC: 'KYC en attente',
  };
  return labels[status] || status;
};

export const getMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    BANK_TRANSFER: 'Virement bancaire',
    CASH_BANK: 'Dépôt cash banque',
    CASH_DEPOSIT: 'Dépôt cash',
    AGENCY: 'Dépôt agence',
    AGENCY_DEPOSIT: 'Dépôt agence',
    ORANGE_MONEY: 'Orange Money',
    ORANGE_MONEY_WITHDRAWAL: 'OM Retrait',
    ORANGE_MONEY_TRANSFER: 'OM Transfert',
    MTN_MONEY: 'MTN Money',
    MTN_MONEY_WITHDRAWAL: 'MTN Retrait',
    MTN_MONEY_TRANSFER: 'MTN Transfert',
    WAVE: 'Wave',
    ALIPAY: 'Alipay',
    WECHAT: 'WeChat',
  };
  return labels[method] || method;
};
