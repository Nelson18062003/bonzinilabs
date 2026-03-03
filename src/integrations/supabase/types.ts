export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          activity_sector: string | null
          avatar_url: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          kyc_verified: boolean | null
          last_name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_sector?: string | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          kyc_verified?: boolean | null
          last_name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_sector?: string | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          kyc_verified?: boolean | null
          last_name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deposit_proofs: {
        Row: {
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_id: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          is_visible_to_client: boolean | null
          uploaded_at: string
          uploaded_by: string | null
          uploaded_by_type: string | null
        }
        Insert: {
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          is_visible_to_client?: boolean | null
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_by_type?: string | null
        }
        Update: {
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          is_visible_to_client?: boolean | null
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_by_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_proofs_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_timeline_events: {
        Row: {
          created_at: string
          deposit_id: string
          description: string
          event_type: string
          id: string
          performed_by: string | null
        }
        Insert: {
          created_at?: string
          deposit_id: string
          description: string
          event_type: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          created_at?: string
          deposit_id?: string
          description?: string
          event_type?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_timeline_events_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          admin_comment: string | null
          admin_internal_note: string | null
          agency_name: string | null
          amount_xaf: number
          bank_name: string | null
          client_phone: string | null
          confirmed_amount_xaf: number | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          reference: string
          rejection_category: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          admin_comment?: string | null
          admin_internal_note?: string | null
          agency_name?: string | null
          amount_xaf: number
          bank_name?: string | null
          client_phone?: string | null
          confirmed_amount_xaf?: number | null
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["deposit_method"]
          reference: string
          rejection_category?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          admin_comment?: string | null
          admin_internal_note?: string | null
          agency_name?: string | null
          amount_xaf?: number
          bank_name?: string | null
          client_phone?: string | null
          confirmed_amount_xaf?: number | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["deposit_method"]
          reference?: string
          rejection_category?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      daily_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_at: string
          id: string
          is_active: boolean
          rate_alipay: number
          rate_cash: number
          rate_virement: number
          rate_wechat: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          rate_alipay: number
          rate_cash: number
          rate_virement: number
          rate_wechat: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          rate_alipay?: number
          rate_cash?: number
          rate_virement?: number
          rate_wechat?: number
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_at: string | null
          effective_date: string
          id: string
          rate_xaf_to_rmb: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_at?: string | null
          effective_date: string
          id?: string
          rate_xaf_to_rmb: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_at?: string | null
          effective_date?: string
          id?: string
          rate_xaf_to_rmb?: number
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount_xaf: number
          balance_after: number
          balance_before: number
          created_at: string | null
          created_by_admin_id: string | null
          description: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_xaf: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          created_by_admin_id?: string | null
          description: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_xaf?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          created_by_admin_id?: string | null
          description?: string
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          payment_id: string
          uploaded_by: string
          uploaded_by_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          payment_id: string
          uploaded_by: string
          uploaded_by_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          payment_id?: string
          uploaded_by?: string
          uploaded_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_timeline_events: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          payment_id: string
          performed_by: string | null
        }
        Insert: {
          created_at?: string
          description: string
          event_type: string
          id?: string
          payment_id: string
          performed_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          payment_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_timeline_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_adjustments: {
        Row: {
          id: string
          is_reference: boolean
          key: string
          label: string
          percentage: number
          sort_order: number
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_reference?: boolean
          key: string
          label: string
          percentage?: number
          sort_order?: number
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_reference?: boolean
          key?: string
          label?: string
          percentage?: number
          sort_order?: number
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_comment: string | null
          amount_rmb: number
          amount_xaf: number
          balance_after: number
          balance_before: number
          beneficiary_bank_account: string | null
          beneficiary_bank_name: string | null
          beneficiary_email: string | null
          beneficiary_name: string | null
          beneficiary_notes: string | null
          beneficiary_phone: string | null
          beneficiary_qr_code_url: string | null
          cash_beneficiary_first_name: string | null
          cash_beneficiary_last_name: string | null
          cash_beneficiary_phone: string | null
          cash_beneficiary_type: string | null
          cash_paid_at: string | null
          cash_paid_by: string | null
          cash_qr_code: string | null
          cash_scanned_at: string | null
          cash_scanned_by: string | null
          cash_signature_timestamp: string | null
          cash_signature_url: string | null
          cash_signed_by_name: string | null
          client_visible_comment: string | null
          created_at: string
          exchange_rate: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          processed_at: string | null
          processed_by: string | null
          reference: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          amount_rmb: number
          amount_xaf: number
          balance_after: number
          balance_before: number
          beneficiary_bank_account?: string | null
          beneficiary_bank_name?: string | null
          beneficiary_email?: string | null
          beneficiary_name?: string | null
          beneficiary_notes?: string | null
          beneficiary_phone?: string | null
          beneficiary_qr_code_url?: string | null
          cash_beneficiary_first_name?: string | null
          cash_beneficiary_last_name?: string | null
          cash_beneficiary_phone?: string | null
          cash_beneficiary_type?: string | null
          cash_paid_at?: string | null
          cash_paid_by?: string | null
          cash_qr_code?: string | null
          cash_scanned_at?: string | null
          cash_scanned_by?: string | null
          cash_signature_timestamp?: string | null
          cash_signature_url?: string | null
          cash_signed_by_name?: string | null
          client_visible_comment?: string | null
          created_at?: string
          exchange_rate: number
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          processed_at?: string | null
          processed_by?: string | null
          reference: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          amount_rmb?: number
          amount_xaf?: number
          balance_after?: number
          balance_before?: number
          beneficiary_bank_account?: string | null
          beneficiary_bank_name?: string | null
          beneficiary_email?: string | null
          beneficiary_name?: string | null
          beneficiary_notes?: string | null
          beneficiary_phone?: string | null
          beneficiary_qr_code_url?: string | null
          cash_beneficiary_first_name?: string | null
          cash_beneficiary_last_name?: string | null
          cash_beneficiary_phone?: string | null
          cash_beneficiary_type?: string | null
          cash_paid_at?: string | null
          cash_paid_by?: string | null
          cash_qr_code?: string | null
          cash_scanned_at?: string | null
          cash_scanned_by?: string | null
          cash_signature_timestamp?: string | null
          cash_signature_url?: string | null
          cash_signed_by_name?: string | null
          client_visible_comment?: string | null
          created_at?: string
          exchange_rate?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          processed_at?: string | null
          processed_by?: string | null
          reference?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_disabled: boolean
          last_login_at: string | null
          last_name: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_disabled?: boolean
          last_login_at?: string | null
          last_name?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_disabled?: boolean
          last_login_at?: string | null
          last_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_adjustments: {
        Row: {
          adjustment_type: string
          amount_xaf: number
          created_at: string | null
          created_by_admin_id: string
          id: string
          ledger_entry_id: string | null
          proof_urls: string[] | null
          reason: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          adjustment_type: string
          amount_xaf: number
          created_at?: string | null
          created_by_admin_id: string
          id?: string
          ledger_entry_id?: string | null
          proof_urls?: string[] | null
          reason: string
          user_id: string
          wallet_id: string
        }
        Update: {
          adjustment_type?: string
          amount_xaf?: number
          created_at?: string | null
          created_by_admin_id?: string
          id?: string
          ledger_entry_id?: string | null
          proof_urls?: string[] | null
          reason?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_adjustments_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_adjustments_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_xaf: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_xaf?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_xaf?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_final_rate: {
        Args: {
          p_payment_method: string
          p_country_key: string
          p_amount_xaf: number
        }
        Returns: Json
      }
      create_daily_rates: {
        Args: {
          p_rate_cash: number
          p_rate_alipay: number
          p_rate_wechat: number
          p_rate_virement: number
          p_effective_at?: string
        }
        Returns: Json
      }
      update_rate_adjustment: {
        Args: {
          p_adjustment_id: string
          p_percentage: number
        }
        Returns: Json
      }
      add_exchange_rate: {
        Args: { p_effective_at?: string; p_rate_xaf_to_rmb: number }
        Returns: Json
      }
      admin_adjust_wallet:
        | {
            Args: {
              p_adjustment_type: string
              p_amount: number
              p_reason: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_adjustment_type: string
              p_amount: number
              p_reason: string
              p_user_id: string
            }
            Returns: Json
          }
      admin_create_admin: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_role: string
        }
        Returns: Json
      }
      admin_create_client: {
        Args: {
          p_city?: string
          p_company?: string
          p_country?: string
          p_email?: string
          p_first_name: string
          p_gender?: string
          p_last_name: string
          p_password?: string
          p_phone: string
        }
        Returns: Json
      }
      admin_delete_client: { Args: { p_user_id: string }; Returns: Json }
      admin_reset_client_password: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_reset_password: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_setup_client: {
        Args: {
          p_city?: string
          p_company?: string
          p_country?: string
          p_first_name: string
          p_gender?: string
          p_last_name: string
          p_phone: string
          p_user_id: string
        }
        Returns: Json
      }
      cancel_client_deposit: { Args: { p_deposit_id: string }; Returns: Json }
      confirm_cash_payment: {
        Args: {
          p_payment_id: string
          p_signature_url: string
          p_signed_by_name: string
        }
        Returns: Json
      }
      create_admin_payment: {
        Args: {
          p_amount_rmb: number
          p_amount_xaf: number
          p_beneficiary_bank_account?: string
          p_beneficiary_bank_name?: string
          p_beneficiary_email?: string
          p_beneficiary_name?: string
          p_beneficiary_notes?: string
          p_beneficiary_phone?: string
          p_beneficiary_qr_code_url?: string
          p_client_visible_comment?: string
          p_desired_date?: string
          p_exchange_rate: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_user_id: string
        }
        Returns: Json
      }
      create_client_deposit: {
        Args: {
          p_agency_name?: string
          p_amount_xaf: number
          p_bank_name?: string
          p_client_phone?: string
          p_method: Database["public"]["Enums"]["deposit_method"]
          p_user_id: string
        }
        Returns: Json
      }
      create_payment: {
        Args: {
          p_amount_rmb: number
          p_amount_xaf: number
          p_beneficiary_bank_account?: string
          p_beneficiary_bank_name?: string
          p_beneficiary_email?: string
          p_beneficiary_name?: string
          p_beneficiary_notes?: string
          p_beneficiary_phone?: string
          p_beneficiary_qr_code_url?: string
          p_cash_beneficiary_first_name?: string
          p_cash_beneficiary_last_name?: string
          p_cash_beneficiary_phone?: string
          p_cash_beneficiary_type?: string
          p_exchange_rate: number
          p_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
      create_wallet_adjustment: {
        Args: {
          p_adjustment_type: string
          p_amount_xaf: number
          p_proof_urls?: string[]
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      delete_exchange_rate: { Args: { p_rate_id: string }; Returns: Json }
      delete_payment: { Args: { p_payment_id: string }; Returns: Json }
      delete_payment_proof: { Args: { p_proof_id: string }; Returns: Json }
      generate_deposit_reference: { Args: never; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
      get_client_ledger: {
        Args: {
          p_entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          p_limit?: number
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          amount_xaf: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by_admin_id: string
          created_by_admin_name: string
          description: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          metadata: Json
          reference_id: string
          reference_type: string
          user_id: string
          wallet_id: string
        }[]
      }
      get_deposit_stats: { Args: never; Returns: Json }
      get_rate_usage_count: { Args: { p_rate_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_cash_agent: { Args: { _user_id: string }; Returns: boolean }
      is_rate_used: { Args: { p_rate_id: string }; Returns: boolean }
      process_payment: {
        Args: { p_action: string; p_comment?: string; p_payment_id: string }
        Returns: Json
      }
      reject_deposit: {
        Args: {
          p_admin_note?: string
          p_deposit_id: string
          p_reason: string
          p_rejection_category?: string
        }
        Returns: Json
      }
      request_deposit_correction: {
        Args: { p_deposit_id: string; p_reason: string }
        Returns: Json
      }
      resubmit_deposit: { Args: { p_deposit_id: string }; Returns: Json }
      scan_cash_payment: { Args: { p_payment_id: string }; Returns: Json }
      start_deposit_review: { Args: { p_deposit_id: string }; Returns: Json }
      toggle_admin_status: {
        Args: { p_disabled: boolean; p_target_user_id: string }
        Returns: Json
      }
      update_admin_last_login: { Args: never; Returns: Json }
      update_admin_profile: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_target_user_id: string
        }
        Returns: Json
      }
      update_admin_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      update_exchange_rate: {
        Args: {
          p_effective_at?: string
          p_rate_id: string
          p_rate_xaf_to_rmb: number
        }
        Returns: Json
      }
      validate_deposit: {
        Args: {
          p_admin_comment?: string
          p_confirmed_amount?: number
          p_deposit_id: string
          p_send_notification?: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "ops"
        | "support"
        | "customer_success"
        | "cash_agent"
      deposit_method:
        | "bank_transfer"
        | "bank_cash"
        | "agency_cash"
        | "om_transfer"
        | "om_withdrawal"
        | "mtn_transfer"
        | "mtn_withdrawal"
        | "wave"
      deposit_status:
        | "created"
        | "awaiting_proof"
        | "proof_submitted"
        | "admin_review"
        | "validated"
        | "rejected"
        | "pending_correction"
        | "cancelled"
      ledger_entry_type:
        | "DEPOSIT_VALIDATED"
        | "DEPOSIT_REFUSED"
        | "PAYMENT_RESERVED"
        | "PAYMENT_EXECUTED"
        | "PAYMENT_CANCELLED_REFUNDED"
        | "ADMIN_CREDIT"
        | "ADMIN_DEBIT"
      payment_method: "alipay" | "wechat" | "bank_transfer" | "cash"
      payment_status:
        | "created"
        | "waiting_beneficiary_info"
        | "ready_for_payment"
        | "processing"
        | "completed"
        | "rejected"
        | "cash_pending"
        | "cash_scanned"
      wallet_operation_type: "deposit" | "payment" | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "ops",
        "support",
        "customer_success",
        "cash_agent",
      ],
      deposit_method: [
        "bank_transfer",
        "bank_cash",
        "agency_cash",
        "om_transfer",
        "om_withdrawal",
        "mtn_transfer",
        "mtn_withdrawal",
        "wave",
      ],
      deposit_status: [
        "created",
        "awaiting_proof",
        "proof_submitted",
        "admin_review",
        "validated",
        "rejected",
        "pending_correction",
        "cancelled",
      ],
      ledger_entry_type: [
        "DEPOSIT_VALIDATED",
        "DEPOSIT_REFUSED",
        "PAYMENT_RESERVED",
        "PAYMENT_EXECUTED",
        "PAYMENT_CANCELLED_REFUNDED",
        "ADMIN_CREDIT",
        "ADMIN_DEBIT",
      ],
      payment_method: ["alipay", "wechat", "bank_transfer", "cash"],
      payment_status: [
        "created",
        "waiting_beneficiary_info",
        "ready_for_payment",
        "processing",
        "completed",
        "rejected",
        "cash_pending",
        "cash_scanned",
      ],
      wallet_operation_type: ["deposit", "payment", "adjustment"],
    },
  },
} as const
