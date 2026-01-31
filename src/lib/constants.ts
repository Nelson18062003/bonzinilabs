/**
 * Application Constants
 *
 * Centralized configuration for magic numbers, limits, and timeouts
 * used throughout the application.
 */

// ============================================================================
// REACT QUERY CACHE CONFIGURATION
// ============================================================================

export const CACHE_CONFIG = {
  /** How long data is considered fresh (in milliseconds) */
  STALE_TIME: {
    /** User's own data (wallet, profile) - 10 seconds */
    OWN_DATA: 10 * 1000,
    /** List data (deposits, payments) - 30 seconds */
    LISTS: 30 * 1000,
    /** Exchange rates - 1 minute */
    EXCHANGE_RATES: 60 * 1000,
  },
  /** How long to keep data in cache after it becomes unused (5 minutes) */
  GC_TIME: 5 * 60 * 1000,
} as const;

// ============================================================================
// DATA FETCHING LIMITS
// ============================================================================

export const QUERY_LIMITS = {
  /** Maximum wallet operations to fetch */
  WALLET_OPERATIONS: 100,
  /** Maximum wallets to fetch (admin view) */
  ALL_WALLETS: 200,
  /** Maximum deposits to fetch */
  DEPOSITS: 100,
  /** Maximum payments to fetch */
  PAYMENTS: 100,
  /** Maximum items per page for paginated lists */
  ITEMS_PER_PAGE: 20,
} as const;

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

export const FILE_UPLOAD = {
  /** Maximum file size in bytes (10 MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Allowed image MIME types for proof uploads */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  /** Allowed document MIME types */
  ALLOWED_DOCUMENT_TYPES: ['application/pdf'],
  /** Maximum number of files per upload */
  MAX_FILES_PER_UPLOAD: 5,
} as const;

// ============================================================================
// BUSINESS RULES
// ============================================================================

export const BUSINESS_RULES = {
  /** Minimum deposit amount in XAF */
  MIN_DEPOSIT_AMOUNT: 1000,
  /** Maximum deposit amount in XAF */
  MAX_DEPOSIT_AMOUNT: 10_000_000,
  /** Minimum payment amount in XAF */
  MIN_PAYMENT_AMOUNT: 1000,
  /** Maximum payment amount in XAF */
  MAX_PAYMENT_AMOUNT: 5_000_000,
  /** Default exchange rate (fallback if none set) */
  DEFAULT_EXCHANGE_RATE: 0.01167,
  /** Threshold for requiring multi-admin approval (in XAF) */
  MULTI_ADMIN_APPROVAL_THRESHOLD: 1_000_000,
  /** Deposit proof deadline in hours (visual timer only) */
  DEPOSIT_PROOF_DEADLINE_HOURS: 48,
} as const;

// ============================================================================
// RATE LIMITING
// ============================================================================

export const RATE_LIMITS = {
  /** Maximum deposit creations per hour per user */
  DEPOSITS_PER_HOUR: 10,
  /** Maximum payment creations per hour per user */
  PAYMENTS_PER_HOUR: 20,
  /** Maximum wallet adjustment per day per admin */
  ADMIN_ADJUSTMENTS_PER_DAY: 50,
} as const;

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export const UI_CONFIG = {
  /** Debounce delay for search inputs (milliseconds) */
  SEARCH_DEBOUNCE_MS: 300,
  /** Toast notification duration (milliseconds) */
  TOAST_DURATION: 5000,
  /** Auto-refresh interval for real-time data (milliseconds) */
  AUTO_REFRESH_INTERVAL: 30 * 1000,
} as const;

// ============================================================================
// REFERENCE FORMATS
// ============================================================================

export const REFERENCE_FORMATS = {
  /** Deposit reference format */
  DEPOSIT: 'BZ-DP-{YEAR}-{NUMBER}',
  /** Payment reference format */
  PAYMENT: 'BZ-PY-{YEAR}-{NUMBER}',
} as const;

// ============================================================================
// STATUS ENUMS (for type safety)
// ============================================================================

export const DEPOSIT_STATUS = {
  CREATED: 'created',
  AWAITING_PROOF: 'awaiting_proof',
  PROOF_SUBMITTED: 'proof_submitted',
  ADMIN_REVIEW: 'admin_review',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
} as const;

export const PAYMENT_STATUS = {
  CREATED: 'created',
  WAITING_BENEFICIARY_INFO: 'waiting_beneficiary_info',
  READY_FOR_PAYMENT: 'ready_for_payment',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CASH_PENDING: 'cash_pending',
  CASH_SCANNED: 'cash_scanned',
} as const;

export const WALLET_OPERATION_TYPE = {
  DEPOSIT: 'deposit',
  PAYMENT: 'payment',
  ADJUSTMENT: 'adjustment',
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Erreur de connexion. Veuillez vérifier votre connexion internet.',
  UNAUTHORIZED: 'Accès non autorisé. Veuillez vous reconnecter.',
  INSUFFICIENT_BALANCE: 'Solde insuffisant pour effectuer cette opération.',
  INVALID_AMOUNT: 'Montant invalide. Veuillez vérifier votre saisie.',
  FILE_TOO_LARGE: 'Fichier trop volumineux. Taille maximale: 10 MB.',
  INVALID_FILE_TYPE: 'Type de fichier non supporté.',
  GENERIC_ERROR: 'Une erreur est survenue. Veuillez réessayer.',
} as const;

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  DEPOSIT_CREATED: 'Demande de dépôt créée avec succès',
  DEPOSIT_VALIDATED: 'Dépôt validé avec succès',
  PAYMENT_CREATED: 'Demande de paiement créée avec succès',
  PAYMENT_COMPLETED: 'Paiement effectué avec succès',
  PROFILE_UPDATED: 'Profil mis à jour avec succès',
  PROOF_UPLOADED: 'Preuve téléchargée avec succès',
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DepositStatus = typeof DEPOSIT_STATUS[keyof typeof DEPOSIT_STATUS];
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
export type WalletOperationType = typeof WALLET_OPERATION_TYPE[keyof typeof WALLET_OPERATION_TYPE];
