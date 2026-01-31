/**
 * BONZINI Brand Color System
 * Based on the official BONZINI logo colors
 *
 * Logo Analysis:
 * - Top rays: Orange/Yellow (energy, optimism)
 * - Side rays: Purple (innovation, trust)
 * - Bottom rays: Red/Orange (passion, action)
 */

export const bonziniColors = {
  // Primary Brand Colors (from logo)
  brand: {
    orange: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',  // Logo orange - Primary for Client
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    purple: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',  // Logo purple - Primary for Admin
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    red: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',  // Logo red - Primary for Agent
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
  },

  // Semantic Colors (for status, feedback)
  semantic: {
    success: '#10b981',  // Green - completed, approved, validated
    warning: '#f59e0b',  // Amber - pending, waiting, in progress
    error: '#ef4444',    // Red - failed, rejected, error
    info: '#3b82f6',     // Blue - created, informational
  },

  // Neutral Colors (UI backgrounds, text, borders)
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

/**
 * Color Usage Map
 * Defines which colors to use in which context
 */
export const colorUsage = {
  // Admin Interface
  admin: {
    primary: bonziniColors.brand.purple[600],      // #9333ea - Admin buttons, highlights
    primaryHover: bonziniColors.brand.purple[700],
    secondary: bonziniColors.brand.orange[500],    // #f97316 - Secondary actions
    accent: bonziniColors.brand.red[500],          // #ef4444 - Alerts, important
    background: bonziniColors.neutral[50],
    surface: '#ffffff',
    text: bonziniColors.neutral[900],
    textMuted: bonziniColors.neutral[600],
  },

  // Client Interface
  client: {
    primary: bonziniColors.brand.orange[500],      // #f97316 - CTA buttons
    primaryHover: bonziniColors.brand.orange[600],
    secondary: bonziniColors.brand.purple[500],    // #a855f7 - Balance cards, highlights
    accent: bonziniColors.brand.red[500],          // #ef4444 - Urgent actions
    background: bonziniColors.neutral[50],
    surface: '#ffffff',
    text: bonziniColors.neutral[900],
    textMuted: bonziniColors.neutral[600],
  },

  // Agent Interface
  agent: {
    primary: bonziniColors.brand.red[500],         // #ef4444 - Scan button, primary actions
    primaryHover: bonziniColors.brand.red[600],
    secondary: bonziniColors.brand.orange[500],    // #f97316 - Secondary actions
    accent: bonziniColors.brand.purple[500],       // #a855f7 - Highlights
    background: bonziniColors.neutral[50],
    surface: '#ffffff',
    text: bonziniColors.neutral[900],
    textMuted: bonziniColors.neutral[600],
  },

  // Status colors (used across all interfaces)
  status: {
    // Deposit statuses
    created: bonziniColors.semantic.info,
    waiting_validation: bonziniColors.semantic.warning,
    validated: bonziniColors.semantic.success,
    rejected: bonziniColors.semantic.error,

    // Payment statuses
    waiting_beneficiary_info: bonziniColors.brand.purple[500],
    ready_for_payment: bonziniColors.brand.purple[600],
    waiting_cash_proof: bonziniColors.semantic.warning,
    agent_delivered: bonziniColors.brand.orange[500],
    completed: bonziniColors.semantic.success,
    cancelled: bonziniColors.neutral[500],

    // General
    pending: bonziniColors.semantic.warning,
    active: bonziniColors.semantic.success,
    inactive: bonziniColors.neutral[400],
    error: bonziniColors.semantic.error,
  },
};

/**
 * Helper function to get color by status
 */
export function getStatusColor(status: string): string {
  return colorUsage.status[status as keyof typeof colorUsage.status] || bonziniColors.neutral[500];
}

/**
 * Helper function to get interface colors
 */
export function getInterfaceColors(interfaceType: 'admin' | 'client' | 'agent') {
  return colorUsage[interfaceType];
}

export default bonziniColors;
