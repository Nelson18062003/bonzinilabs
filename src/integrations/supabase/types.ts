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
    PostgrestVersion: "13.0.5"
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
      deposit_proofs: {
        Row: {
          deposit_id: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          uploaded_at: string
        }
        Insert: {
          deposit_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          deposit_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_at?: string
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
          agency_name: string | null
          amount_xaf: number
          bank_name: string | null
          client_phone: string | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["deposit_method"]
          reference: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          admin_comment?: string | null
          agency_name?: string | null
          amount_xaf: number
          bank_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["deposit_method"]
          reference: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          admin_comment?: string | null
          agency_name?: string | null
          amount_xaf?: number
          bank_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["deposit_method"]
          reference?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
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
      profiles: {
        Row: {
          activity_sector: string | null
          avatar_url: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          id: string
          last_name: string
          neighborhood: string | null
          phone: string | null
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
          first_name: string
          id?: string
          last_name: string
          neighborhood?: string | null
          phone?: string | null
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
          first_name?: string
          id?: string
          last_name?: string
          neighborhood?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_operations: {
        Row: {
          amount_xaf: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          operation_type: Database["public"]["Enums"]["wallet_operation_type"]
          performed_by: string | null
          reference_id: string | null
          reference_type: string | null
          wallet_id: string
        }
        Insert: {
          amount_xaf: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          operation_type: Database["public"]["Enums"]["wallet_operation_type"]
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          wallet_id: string
        }
        Update: {
          amount_xaf?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          operation_type?: Database["public"]["Enums"]["wallet_operation_type"]
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_operations_wallet_id_fkey"
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
      add_exchange_rate: {
        Args: { p_effective_at?: string; p_rate_xaf_to_rmb: number }
        Returns: Json
      }
      admin_adjust_wallet: {
        Args: {
          p_adjustment_type: string
          p_amount: number
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
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
          p_exchange_rate: number
          p_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: Json
      }
      delete_exchange_rate: { Args: { p_rate_id: string }; Returns: Json }
      delete_payment: { Args: { p_payment_id: string }; Returns: Json }
      delete_payment_proof: { Args: { p_proof_id: string }; Returns: Json }
      generate_deposit_reference: { Args: never; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
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
        Args: { p_deposit_id: string; p_reason: string }
        Returns: Json
      }
      scan_cash_payment: { Args: { p_payment_id: string }; Returns: Json }
      update_exchange_rate: {
        Args: {
          p_effective_at?: string
          p_rate_id: string
          p_rate_xaf_to_rmb: number
        }
        Returns: Json
      }
      validate_deposit: {
        Args: { p_admin_comment?: string; p_deposit_id: string }
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
