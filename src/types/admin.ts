// ============================================
// BONZINI ADMIN - TYPE DEFINITIONS
// ============================================

// Admin Roles
export type AdminRole = 'SUPER_ADMIN' | 'OPS' | 'SUPPORT' | 'ACCOUNT_MANAGER' | 'VIEW_ONLY';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  avatar?: string;
  isActive: boolean;
  passwordHash?: string; // For mock auth
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Client (Contact) for Admin view
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_KYC';
export type ClientGender = 'MALE' | 'FEMALE' | 'OTHER';

// Tags table (many-to-many with clients)
export interface Tag {
  id: string;
  name: string;
  color: string; // Tailwind color class
  description?: string;
  createdAt: Date;
}

export interface ClientTag {
  clientId: string;
  tagId: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  gender: ClientGender;
  whatsappNumber: string;
  email?: string;
  country: string;
  city?: string;
  tagIds: string[]; // References to Tag table
  status: ClientStatus;
  kycVerified: boolean;
  avatar?: string;
  notes?: string;
  totalDeposits: number;
  totalPayments: number;
  walletBalance: number;
  lastDepositAt?: Date;
  lastPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Client with resolved tags
export interface ClientWithTags extends Omit<Client, 'tagIds'> {
  tags: Tag[];
}

// Admin Log Entry
export type AdminActionType = 
  | 'DEPOSIT_VALIDATED'
  | 'DEPOSIT_REJECTED'
  | 'PAYMENT_PROCESSED'
  | 'PAYMENT_COMPLETED'
  | 'PROOF_UPLOADED'
  | 'RATE_UPDATED'
  | 'RATE_CREATED'
  | 'RATE_DELETED'
  | 'CLIENT_UPDATED'
  | 'CLIENT_SUSPENDED'
  | 'WALLET_CREDITED'
  | 'WALLET_DEBITED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_ACTIVATED'
  | 'LOGIN'
  | 'LOGOUT';

export interface AdminLogEntry {
  id: string;
  adminUserId: string;
  adminUserName: string;
  actionType: AdminActionType;
  targetType: 'DEPOSIT' | 'PAYMENT' | 'CLIENT' | 'RATE' | 'WALLET' | 'AUTH' | 'USER';
  targetId?: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

// Enhanced Deposit for Admin
export interface AdminDeposit {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  walletId: string;
  method: string;
  amountXAF: number;
  status: string;
  reference?: string;
  notes?: string;
  proofUrl?: string;
  proofFileName?: string;
  assignedTo?: string;
  validatedBy?: string;
  validatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced Payment for Admin
export interface AdminPayment {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  walletId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  method: string;
  amountXAF: number;
  amountRMB: number;
  exchangeRate: number;
  fees: number;
  status: string;
  notes?: string;
  proofUrl?: string;
  proofFileName?: string;
  processedBy?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Dashboard Stats
export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalWalletBalance: number;
  pendingDeposits: number;
  pendingPayments: number;
  todayDeposits: number;
  todayPayments: number;
  todayVolume: number;
  currentRate: number;
}

// Notification Template
export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'WHATSAPP' | 'EMAIL' | 'SMS';
  trigger: string;
  subject?: string;
  content: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Role Permissions
export interface RolePermission {
  role: AdminRole;
  canViewClients: boolean;
  canEditClients: boolean;
  canViewDeposits: boolean;
  canProcessDeposits: boolean;
  canViewPayments: boolean;
  canProcessPayments: boolean;
  canManageRates: boolean;
  canViewLogs: boolean;
  canManageUsers: boolean;
  canViewOnly: boolean;
}

export const ROLE_PERMISSIONS: Record<AdminRole, RolePermission> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    canViewClients: true,
    canEditClients: true,
    canViewDeposits: true,
    canProcessDeposits: true,
    canViewPayments: true,
    canProcessPayments: true,
    canManageRates: true,
    canViewLogs: true,
    canManageUsers: true,
    canViewOnly: false,
  },
  OPS: {
    role: 'OPS',
    canViewClients: true,
    canEditClients: false,
    canViewDeposits: true,
    canProcessDeposits: true,
    canViewPayments: true,
    canProcessPayments: true,
    canManageRates: true,
    canViewLogs: true,
    canManageUsers: false,
    canViewOnly: false,
  },
  SUPPORT: {
    role: 'SUPPORT',
    canViewClients: true,
    canEditClients: true,
    canViewDeposits: true,
    canProcessDeposits: false,
    canViewPayments: true,
    canProcessPayments: false,
    canManageRates: false,
    canViewLogs: true,
    canManageUsers: false,
    canViewOnly: false,
  },
  ACCOUNT_MANAGER: {
    role: 'ACCOUNT_MANAGER',
    canViewClients: true,
    canEditClients: true,
    canViewDeposits: true,
    canProcessDeposits: true,
    canViewPayments: true,
    canProcessPayments: false,
    canManageRates: false,
    canViewLogs: false,
    canManageUsers: false,
    canViewOnly: false,
  },
  VIEW_ONLY: {
    role: 'VIEW_ONLY',
    canViewClients: true,
    canEditClients: false,
    canViewDeposits: true,
    canProcessDeposits: false,
    canViewPayments: true,
    canProcessPayments: false,
    canManageRates: false,
    canViewLogs: true,
    canManageUsers: false,
    canViewOnly: true,
  },
};

// Admin Role Labels
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPS: 'Opérations',
  SUPPORT: 'Support',
  ACCOUNT_MANAGER: 'Chargé de clientèle',
  VIEW_ONLY: 'Lecture seule',
};
