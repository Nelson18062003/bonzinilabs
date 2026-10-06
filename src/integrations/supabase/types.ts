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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _trigger_debug_log: {
        Row: {
          created_at: string | null
          id: number
          msg: string | null
          op: string | null
          tbl: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          msg?: string | null
          op?: string | null
          tbl?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          msg?: string | null
          op?: string | null
          tbl?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action_type: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      air_shipments: {
        Row: {
          airline: string | null
          arrived_at: string | null
          awb_number: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          departed_at: string | null
          destination: string
          eta: string | null
          etd: string | null
          flight_no: string | null
          freight_usd: number | null
          id: string
          notes: string | null
          origin: string
          status: string
          updated_at: string
        }
        Insert: {
          airline?: string | null
          arrived_at?: string | null
          awb_number: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          departed_at?: string | null
          destination?: string
          eta?: string | null
          etd?: string | null
          flight_no?: string | null
          freight_usd?: number | null
          id?: string
          notes?: string | null
          origin?: string
          status?: string
          updated_at?: string
        }
        Update: {
          airline?: string | null
          arrived_at?: string | null
          awb_number?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          departed_at?: string | null
          destination?: string
          eta?: string | null
          etd?: string | null
          flight_no?: string | null
          freight_usd?: number | null
          id?: string
          notes?: string | null
          origin?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          rolling_summary: string | null
          summary_through: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          rolling_summary?: string | null
          summary_through?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          rolling_summary?: string | null
          summary_through?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: Json
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content?: Json
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_pending_actions: {
        Row: {
          admin_user_id: string
          args: Json
          conversation_id: string | null
          created_at: string
          id: string
          resolved_at: string | null
          result: Json | null
          status: string
          summary: Json
          tool: string
        }
        Insert: {
          admin_user_id: string
          args?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          result?: Json | null
          status?: string
          summary?: Json
          tool: string
        }
        Update: {
          admin_user_id?: string
          args?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          resolved_at?: string | null
          result?: Json | null
          status?: string
          summary?: Json
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_pending_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          alias: string
          bank_account: string | null
          bank_extra: string | null
          bank_name: string | null
          client_id: string
          created_at: string
          created_by: string | null
          created_by_role: string | null
          email: string | null
          id: string
          identifier: string | null
          identifier_type: string | null
          is_active: boolean
          name: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          phone: string | null
          qr_code_url: string | null
          relation_type: string | null
          updated_at: string
        }
        Insert: {
          alias: string
          bank_account?: string | null
          bank_extra?: string | null
          bank_name?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string | null
          email?: string | null
          id?: string
          identifier?: string | null
          identifier_type?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          phone?: string | null
          qr_code_url?: string | null
          relation_type?: string | null
          updated_at?: string
        }
        Update: {
          alias?: string
          bank_account?: string | null
          bank_extra?: string | null
          bank_name?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string | null
          email?: string | null
          id?: string
          identifier?: string | null
          identifier_type?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          phone?: string | null
          qr_code_url?: string | null
          relation_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bot_config: {
        Row: {
          key: string
          updated_at: string | null
          value: number
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: number
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      briefs_log: {
        Row: {
          brief_type: string
          id: string
          message_text: string
          payload: Json
          sent_at: string
          telegram_error: string | null
          telegram_sent: boolean
        }
        Insert: {
          brief_type: string
          id?: string
          message_text: string
          payload: Json
          sent_at?: string
          telegram_error?: string | null
          telegram_sent?: boolean
        }
        Update: {
          brief_type?: string
          id?: string
          message_text?: string
          payload?: Json
          sent_at?: string
          telegram_error?: string | null
          telegram_sent?: boolean
        }
        Relationships: []
      }
      cargo_accounts: {
        Row: {
          code: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cargo_costs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          incurred_on: string | null
          invoice_ref: string | null
          kind: string
          label: string | null
          note: string | null
          paid: boolean
          paid_on: string | null
          payee: string | null
          shipment_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          incurred_on?: string | null
          invoice_ref?: string | null
          kind: string
          label?: string | null
          note?: string | null
          paid?: boolean
          paid_on?: string | null
          payee?: string | null
          shipment_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          incurred_on?: string | null
          invoice_ref?: string | null
          kind?: string
          label?: string | null
          note?: string | null
          paid?: boolean
          paid_on?: string | null
          payee?: string | null
          shipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_costs_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_doc_folders: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          expected_count: number | null
          id: string
          note: string | null
          position: number
          shipment_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          expected_count?: number | null
          id?: string
          note?: string | null
          position?: number
          shipment_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          expected_count?: number | null
          id?: string
          note?: string | null
          position?: number
          shipment_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_doc_folders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_documents: {
        Row: {
          cost_id: string | null
          created_at: string
          file_name: string
          folder_id: string | null
          id: string
          kind: string
          mime_type: string | null
          note: string | null
          shipment_id: string
          size_bytes: number | null
          storage_path: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          cost_id?: string | null
          created_at?: string
          file_name: string
          folder_id?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          note?: string | null
          shipment_id: string
          size_bytes?: number | null
          storage_path: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          cost_id?: string | null
          created_at?: string
          file_name?: string
          folder_id?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          note?: string | null
          shipment_id?: string
          size_bytes?: number | null
          storage_path?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_documents_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "cargo_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "cargo_doc_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_events: {
        Row: {
          carrier_event_id: string
          classifier: string
          created_at: string
          event_code: string
          event_time: string
          event_type: string
          id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          raw: Json | null
          shipment_id: string
          unlocode: string | null
          vessel_imo: string | null
          vessel_name: string | null
          voyage: string | null
        }
        Insert: {
          carrier_event_id: string
          classifier?: string
          created_at?: string
          event_code: string
          event_time: string
          event_type: string
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          raw?: Json | null
          shipment_id: string
          unlocode?: string | null
          vessel_imo?: string | null
          vessel_name?: string | null
          voyage?: string | null
        }
        Update: {
          carrier_event_id?: string
          classifier?: string
          created_at?: string
          event_code?: string
          event_time?: string
          event_type?: string
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          raw?: Json | null
          shipment_id?: string
          unlocode?: string | null
          vessel_imo?: string | null
          vessel_name?: string | null
          voyage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_lookups: {
        Row: {
          carrier: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          reference: string
          reference_type: string
          requested_by: string | null
          result: Json | null
          status: string
        }
        Insert: {
          carrier: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          reference: string
          reference_type: string
          requested_by?: string | null
          result?: Json | null
          status?: string
        }
        Update: {
          carrier?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          reference?: string
          reference_type?: string
          requested_by?: string | null
          result?: Json | null
          status?: string
        }
        Relationships: []
      }
      cargo_packages: {
        Row: {
          cbm: number | null
          client_id: string | null
          created_at: string
          created_by: string | null
          height_cm: number | null
          hs_code: string | null
          id: string
          kind: string
          label: string
          length_cm: number | null
          note: string | null
          owner_label: string | null
          position: number
          qty: number
          shipment_id: string
          stackable: boolean
          supplier: string | null
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          cbm?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          kind?: string
          label: string
          length_cm?: number | null
          note?: string | null
          owner_label?: string | null
          position?: number
          qty?: number
          shipment_id: string
          stackable?: boolean
          supplier?: string | null
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          cbm?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          kind?: string
          label?: string
          length_cm?: number | null
          note?: string | null
          owner_label?: string | null
          position?: number
          qty?: number
          shipment_id?: string
          stackable?: boolean
          supplier?: string | null
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_packages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_parties: {
        Row: {
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          note: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      cargo_shipment_parties: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          party_id: string
          position: number
          role: string
          shipment_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          party_id: string
          position?: number
          role: string
          shipment_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          party_id?: string
          position?: number
          role?: string
          shipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_shipment_parties_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "cargo_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_shipment_parties_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_shipments: {
        Row: {
          arrival_notice_at: string | null
          besc_number: string | null
          bl_number: string
          carrier: string
          client_id: string | null
          client_label: string
          container_iso: string | null
          container_number: string
          created_at: string
          customs_cleared_at: string | null
          customs_declaration_ref: string | null
          delivery_order_at: string | null
          empty_returned_at: string | null
          eta_carrier: string | null
          eta_manual: string | null
          eta_manual_at: string | null
          eta_manual_note: string | null
          eta_promised: string | null
          etd_actual: string | null
          etd_promised: string | null
          free_time_ends_on: string | null
          freight_note: string | null
          freight_paid: boolean
          freight_usd: number | null
          gate_out_at: string | null
          goods_description: string | null
          gross_weight_kg: number | null
          id: string
          last_event_at: string | null
          last_event_label: string | null
          last_synced_at: string | null
          notes: string | null
          packages_count: number | null
          pod_name: string
          pod_unlocode: string | null
          pol_name: string | null
          pol_unlocode: string | null
          route_calls: Json
          status: string
          sync_error: string | null
          telex_released: boolean
          updated_at: string
          vessel_imo: string | null
          vessel_mmsi: string | null
          vessel_name: string | null
          voyage: string | null
        }
        Insert: {
          arrival_notice_at?: string | null
          besc_number?: string | null
          bl_number: string
          carrier: string
          client_id?: string | null
          client_label: string
          container_iso?: string | null
          container_number: string
          created_at?: string
          customs_cleared_at?: string | null
          customs_declaration_ref?: string | null
          delivery_order_at?: string | null
          empty_returned_at?: string | null
          eta_carrier?: string | null
          eta_manual?: string | null
          eta_manual_at?: string | null
          eta_manual_note?: string | null
          eta_promised?: string | null
          etd_actual?: string | null
          etd_promised?: string | null
          free_time_ends_on?: string | null
          freight_note?: string | null
          freight_paid?: boolean
          freight_usd?: number | null
          gate_out_at?: string | null
          goods_description?: string | null
          gross_weight_kg?: number | null
          id?: string
          last_event_at?: string | null
          last_event_label?: string | null
          last_synced_at?: string | null
          notes?: string | null
          packages_count?: number | null
          pod_name: string
          pod_unlocode?: string | null
          pol_name?: string | null
          pol_unlocode?: string | null
          route_calls?: Json
          status?: string
          sync_error?: string | null
          telex_released?: boolean
          updated_at?: string
          vessel_imo?: string | null
          vessel_mmsi?: string | null
          vessel_name?: string | null
          voyage?: string | null
        }
        Update: {
          arrival_notice_at?: string | null
          besc_number?: string | null
          bl_number?: string
          carrier?: string
          client_id?: string | null
          client_label?: string
          container_iso?: string | null
          container_number?: string
          created_at?: string
          customs_cleared_at?: string | null
          customs_declaration_ref?: string | null
          delivery_order_at?: string | null
          empty_returned_at?: string | null
          eta_carrier?: string | null
          eta_manual?: string | null
          eta_manual_at?: string | null
          eta_manual_note?: string | null
          eta_promised?: string | null
          etd_actual?: string | null
          etd_promised?: string | null
          free_time_ends_on?: string | null
          freight_note?: string | null
          freight_paid?: boolean
          freight_usd?: number | null
          gate_out_at?: string | null
          goods_description?: string | null
          gross_weight_kg?: number | null
          id?: string
          last_event_at?: string | null
          last_event_label?: string | null
          last_synced_at?: string | null
          notes?: string | null
          packages_count?: number | null
          pod_name?: string
          pod_unlocode?: string | null
          pol_name?: string | null
          pol_unlocode?: string | null
          route_calls?: Json
          status?: string
          sync_error?: string | null
          telex_released?: boolean
          updated_at?: string
          vessel_imo?: string | null
          vessel_mmsi?: string | null
          vessel_name?: string | null
          voyage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_steps: {
        Row: {
          created_at: string
          created_by: string | null
          done_on: string | null
          due_on: string | null
          folder_id: string | null
          id: string
          key: string | null
          note: string | null
          phase: string
          position: number
          reference: string | null
          shipment_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_on?: string | null
          due_on?: string | null
          folder_id?: string | null
          id?: string
          key?: string | null
          note?: string | null
          phase?: string
          position?: number
          reference?: string | null
          shipment_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_on?: string | null
          due_on?: string | null
          folder_id?: string | null
          id?: string
          key?: string | null
          note?: string | null
          phase?: string
          position?: number
          reference?: string | null
          shipment_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_steps_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "cargo_doc_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_steps_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_vessel_positions: {
        Row: {
          course_deg: number | null
          destination: string | null
          eta: string | null
          latitude: number
          longitude: number
          note: string | null
          reported_at: string
          source: string
          speed_kn: number | null
          updated_at: string
          vessel_imo: string
          vessel_mmsi: string | null
          vessel_name: string | null
        }
        Insert: {
          course_deg?: number | null
          destination?: string | null
          eta?: string | null
          latitude: number
          longitude: number
          note?: string | null
          reported_at: string
          source?: string
          speed_kn?: number | null
          updated_at?: string
          vessel_imo: string
          vessel_mmsi?: string | null
          vessel_name?: string | null
        }
        Update: {
          course_deg?: number | null
          destination?: string | null
          eta?: string | null
          latitude?: number
          longitude?: number
          note?: string | null
          reported_at?: string
          source?: string
          speed_kn?: number | null
          updated_at?: string
          vessel_imo?: string
          vessel_mmsi?: string | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      chat_assignment_events: {
        Row: {
          changed_by_admin_id: string | null
          conversation_id: string
          created_at: string
          event_type: string
          id: string
          new_admin_id: string | null
          previous_admin_id: string | null
        }
        Insert: {
          changed_by_admin_id?: string | null
          conversation_id: string
          created_at?: string
          event_type: string
          id?: string
          new_admin_id?: string | null
          previous_admin_id?: string | null
        }
        Update: {
          changed_by_admin_id?: string | null
          conversation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_admin_id?: string | null
          previous_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_assignment_events_changed_by_admin_id_fkey"
            columns: ["changed_by_admin_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_assignment_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_assignment_events_new_admin_id_fkey"
            columns: ["new_admin_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_assignment_events_previous_admin_id_fkey"
            columns: ["previous_admin_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_canned_responses: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_canned_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_client_quick_replies: {
        Row: {
          active: boolean
          content: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          assigned_admin_id: string | null
          client_id: string
          created_at: string
          id: string
          last_admin_message_at: string | null
          last_client_message_at: string | null
          last_message_at: string | null
          status: string
          subject: string | null
          unread_count_admin: number
          unread_count_client: number
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          last_admin_message_at?: string | null
          last_client_message_at?: string | null
          last_message_at?: string | null
          status?: string
          subject?: string | null
          unread_count_admin?: number
          unread_count_client?: number
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          last_admin_message_at?: string | null
          last_client_message_at?: string | null
          last_message_at?: string | null
          status?: string
          subject?: string | null
          unread_count_admin?: number
          unread_count_client?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          sender_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          sender_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          sender_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          media_duration_seconds: number | null
          media_filename: string | null
          media_size_bytes: number | null
          media_type: string | null
          media_url: string | null
          media_waveform_peaks: number[] | null
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          media_duration_seconds?: number | null
          media_filename?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          media_url?: string | null
          media_waveform_peaks?: number[] | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id: string
          sender_type: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          media_duration_seconds?: number | null
          media_filename?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          media_url?: string | null
          media_waveform_peaks?: number[] | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_phones: {
        Row: {
          client_id: string
          country_iso: string | null
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          phone_e164: string
          updated_at: string
        }
        Insert: {
          client_id: string
          country_iso?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone_e164: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          country_iso?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone_e164?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_phones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_system: boolean
          kind: string
          label: string
          notes: string | null
          phone: string | null
          staff_user_id: string | null
          system_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind: string
          label: string
          notes?: string | null
          phone?: string | null
          staff_user_id?: string | null
          system_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind?: string
          label?: string
          notes?: string | null
          phone?: string | null
          staff_user_id?: string | null
          system_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          activity_sector: string | null
          avatar_url: string | null
          cargo_account_id: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          customer_code: string
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
          phone_country: string | null
          phone_e164: string | null
          phone_verified_at: string | null
          preferred_locale: string | null
          registered_at: string | null
          registered_by: string | null
          registered_by_name: string | null
          registered_role: string | null
          registered_site: string | null
          sms_marketing_opt_in: boolean
          source_id: string | null
          source_set_at: string | null
          source_set_by: string | null
          status: string | null
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          activity_sector?: string | null
          avatar_url?: string | null
          cargo_account_id?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          customer_code: string
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
          phone_country?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          preferred_locale?: string | null
          registered_at?: string | null
          registered_by?: string | null
          registered_by_name?: string | null
          registered_role?: string | null
          registered_site?: string | null
          sms_marketing_opt_in?: boolean
          source_id?: string | null
          source_set_at?: string | null
          source_set_by?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          activity_sector?: string | null
          avatar_url?: string | null
          cargo_account_id?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          customer_code?: string
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
          phone_country?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          preferred_locale?: string | null
          registered_at?: string | null
          registered_by?: string | null
          registered_by_name?: string | null
          registered_role?: string | null
          registered_site?: string | null
          sms_marketing_opt_in?: boolean
          source_id?: string | null
          source_set_at?: string | null
          source_set_by?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_cargo_account_id_fkey"
            columns: ["cargo_account_id"]
            isOneToOne: false
            referencedRelation: "cargo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "client_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_objectives: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric: string
          month: string
          source_id: string
          target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric: string
          month: string
          source_id: string
          target: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric?: string
          month?: string
          source_id?: string
          target?: number
          updated_at?: string
        }
        Relationships: []
      }
      customs_audits: {
        Row: {
          ai_model: string | null
          broker_company: string | null
          broker_license_no: string | null
          broker_note: string | null
          claim_deadline: string | null
          claimed_by: string | null
          client_user_id: string
          created_at: string
          created_by: string | null
          customs_office: string | null
          dau_number: string | null
          error: string | null
          extraction: Json | null
          file_paths: string[]
          findings: Json
          id: string
          overpaid_xaf: number | null
          paid_on: string | null
          recoverable_xaf: number | null
          ref: string
          registered_on: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          total_paid_xaf: number | null
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          broker_company?: string | null
          broker_license_no?: string | null
          broker_note?: string | null
          claim_deadline?: string | null
          claimed_by?: string | null
          client_user_id: string
          created_at?: string
          created_by?: string | null
          customs_office?: string | null
          dau_number?: string | null
          error?: string | null
          extraction?: Json | null
          file_paths?: string[]
          findings?: Json
          id?: string
          overpaid_xaf?: number | null
          paid_on?: string | null
          recoverable_xaf?: number | null
          ref?: string
          registered_on?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          total_paid_xaf?: number | null
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          broker_company?: string | null
          broker_license_no?: string | null
          broker_note?: string | null
          claim_deadline?: string | null
          claimed_by?: string | null
          client_user_id?: string
          created_at?: string
          created_by?: string | null
          customs_office?: string | null
          dau_number?: string | null
          error?: string | null
          extraction?: Json | null
          file_paths?: string[]
          findings?: Json
          id?: string
          overpaid_xaf?: number | null
          paid_on?: string | null
          recoverable_xaf?: number | null
          ref?: string
          registered_on?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          total_paid_xaf?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      customs_brokers: {
        Row: {
          active: boolean
          company: string
          created_at: string
          created_by: string | null
          license_no: string
          representative_no: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company: string
          created_at?: string
          created_by?: string | null
          license_no: string
          representative_no?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company?: string
          created_at?: string
          created_by?: string | null
          license_no?: string
          representative_no?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customs_classification_messages: {
        Row: {
          author: string
          author_user_id: string | null
          body: string
          classification_id: string
          created_at: string
          id: string
          payload: Json | null
        }
        Insert: {
          author: string
          author_user_id?: string | null
          body: string
          classification_id: string
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Update: {
          author?: string
          author_user_id?: string | null
          body?: string
          classification_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "customs_classification_messages_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "customs_classifications"
            referencedColumns: ["id"]
          },
        ]
      }
      customs_classifications: {
        Row: {
          ai_model: string | null
          broker_company: string | null
          broker_license_no: string | null
          broker_note: string | null
          candidates: Json
          claimed_by: string | null
          client_user_id: string
          created_at: string
          created_by: string | null
          description: string | null
          facts: Json
          final_code: string | null
          id: string
          photo_paths: string[]
          product_name: string
          proposed_code: string | null
          ref: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          broker_company?: string | null
          broker_license_no?: string | null
          broker_note?: string | null
          candidates?: Json
          claimed_by?: string | null
          client_user_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          facts?: Json
          final_code?: string | null
          id?: string
          photo_paths?: string[]
          product_name: string
          proposed_code?: string | null
          ref?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          broker_company?: string | null
          broker_license_no?: string | null
          broker_note?: string | null
          candidates?: Json
          claimed_by?: string | null
          client_user_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          facts?: Json
          final_code?: string | null
          id?: string
          photo_paths?: string[]
          product_name?: string
          proposed_code?: string | null
          ref?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customs_notices: {
        Row: {
          advice: string | null
          confidence: string
          created_at: string
          created_by: string | null
          delay_days: number | null
          ends_on: string | null
          hs_specs: string[]
          id: string
          kind: string
          places: string[]
          published: boolean
          published_at: string | null
          severity: string
          slug: string
          source_label: string | null
          source_url: string | null
          starts_on: string | null
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          advice?: string | null
          confidence?: string
          created_at?: string
          created_by?: string | null
          delay_days?: number | null
          ends_on?: string | null
          hs_specs?: string[]
          id?: string
          kind: string
          places?: string[]
          published?: boolean
          published_at?: string | null
          severity?: string
          slug: string
          source_label?: string | null
          source_url?: string | null
          starts_on?: string | null
          status?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          advice?: string | null
          confidence?: string
          created_at?: string
          created_by?: string | null
          delay_days?: number | null
          ends_on?: string | null
          hs_specs?: string[]
          id?: string
          kind?: string
          places?: string[]
          published?: boolean
          published_at?: string | null
          severity?: string
          slug?: string
          source_label?: string | null
          source_url?: string | null
          starts_on?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      customs_supplier_documents: {
        Row: {
          client_user_id: string
          created_at: string
          file_name: string | null
          file_path: string
          id: string
          invite_id: string
          kind: string
          mime: string
          note: string | null
          size_bytes: number
        }
        Insert: {
          client_user_id: string
          created_at?: string
          file_name?: string | null
          file_path: string
          id?: string
          invite_id: string
          kind: string
          mime: string
          note?: string | null
          size_bytes: number
        }
        Update: {
          client_user_id?: string
          created_at?: string
          file_name?: string | null
          file_path?: string
          id?: string
          invite_id?: string
          kind?: string
          mime?: string
          note?: string | null
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "customs_supplier_documents_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "customs_supplier_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      customs_supplier_invites: {
        Row: {
          classification_id: string | null
          client_user_id: string
          created_at: string
          due_on: string | null
          expires_at: string
          id: string
          language: string
          last_upload_at: string | null
          message: string | null
          requested: string[]
          status: string
          supplier_contact: string | null
          supplier_name: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          classification_id?: string | null
          client_user_id: string
          created_at?: string
          due_on?: string | null
          expires_at?: string
          id?: string
          language?: string
          last_upload_at?: string | null
          message?: string | null
          requested: string[]
          status?: string
          supplier_contact?: string | null
          supplier_name: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          classification_id?: string | null
          client_user_id?: string
          created_at?: string
          due_on?: string | null
          expires_at?: string
          id?: string
          language?: string
          last_upload_at?: string | null
          message?: string | null
          requested?: string[]
          status?: string
          supplier_contact?: string | null
          supplier_name?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customs_supplier_invites_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "customs_classifications"
            referencedColumns: ["id"]
          },
        ]
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
          verified_at: string | null
          verified_by: string | null
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
          verified_at?: string | null
          verified_by?: string | null
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
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          delivery_status: string | null
          entity_id: string | null
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          recipient_email: string | null
          recipient_user_id: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivery_status?: string | null
          entity_id?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivery_status?: string | null
          entity_id?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient_email?: string | null
          recipient_user_id?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      email_template_map: {
        Row: {
          created_at: string
          enabled: boolean
          notification_type: string
          template: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          notification_type: string
          template: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          notification_type?: string
          template?: string
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
      macro_snapshots: {
        Row: {
          btc_usd: number | null
          captured_at: string
          cny_usd: number | null
          dxy: number | null
          errors: Json | null
          eth_usd: number | null
          eur_usd: number | null
          expert_mentions: Json | null
          id: number
          news_by_source: Json | null
          news_headlines: Json | null
          oil_brent: number | null
          oil_wti: number | null
          trump_posts_recent: Json | null
          xaf_per_eur: number | null
        }
        Insert: {
          btc_usd?: number | null
          captured_at?: string
          cny_usd?: number | null
          dxy?: number | null
          errors?: Json | null
          eth_usd?: number | null
          eur_usd?: number | null
          expert_mentions?: Json | null
          id?: never
          news_by_source?: Json | null
          news_headlines?: Json | null
          oil_brent?: number | null
          oil_wti?: number | null
          trump_posts_recent?: Json | null
          xaf_per_eur?: number | null
        }
        Update: {
          btc_usd?: number | null
          captured_at?: string
          cny_usd?: number | null
          dxy?: number | null
          errors?: Json | null
          eth_usd?: number | null
          eur_usd?: number | null
          expert_mentions?: Json | null
          id?: never
          news_by_source?: Json | null
          news_headlines?: Json | null
          oil_brent?: number | null
          oil_wti?: number | null
          trump_posts_recent?: Json | null
          xaf_per_eur?: number | null
        }
        Relationships: []
      }
      mola_memory: {
        Row: {
          admin_user_id: string | null
          content: string
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          kind: string
          scope: string | null
          source: string | null
        }
        Insert: {
          admin_user_id?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          scope?: string | null
          source?: string | null
        }
        Update: {
          admin_user_id?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          scope?: string | null
          source?: string | null
        }
        Relationships: []
      }
      mola_user_memory: {
        Row: {
          admin_user_id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          admin_user_id: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          admin_user_id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
      parcel_deposits: {
        Row: {
          brought_by: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_user_id: string | null
          closed_at: string | null
          created_at: string
          deposit_no: string
          id: string
          last_seq: number
          location: string
          notes: string | null
          opened_at: string
          parcel_count: number
          received_by: string
          representative_name: string | null
          representative_phone: string | null
          status: string
          supplier_address: string | null
          supplier_contact: string | null
          supplier_email: string | null
          supplier_kind: string | null
          supplier_name: string | null
          supplier_phone: string | null
          supplier_wechat: string | null
          total_cbm: number
          total_weight_kg: number
          updated_at: string
        }
        Insert: {
          brought_by?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_user_id?: string | null
          closed_at?: string | null
          created_at?: string
          deposit_no?: string
          id?: string
          last_seq?: number
          location: string
          notes?: string | null
          opened_at?: string
          parcel_count?: number
          received_by: string
          representative_name?: string | null
          representative_phone?: string | null
          status?: string
          supplier_address?: string | null
          supplier_contact?: string | null
          supplier_email?: string | null
          supplier_kind?: string | null
          supplier_name?: string | null
          supplier_phone?: string | null
          supplier_wechat?: string | null
          total_cbm?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Update: {
          brought_by?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_user_id?: string | null
          closed_at?: string | null
          created_at?: string
          deposit_no?: string
          id?: string
          last_seq?: number
          location?: string
          notes?: string | null
          opened_at?: string
          parcel_count?: number
          received_by?: string
          representative_name?: string | null
          representative_phone?: string | null
          status?: string
          supplier_address?: string | null
          supplier_contact?: string | null
          supplier_email?: string | null
          supplier_kind?: string | null
          supplier_name?: string | null
          supplier_phone?: string | null
          supplier_wechat?: string | null
          total_cbm?: number
          total_weight_kg?: number
          updated_at?: string
        }
        Relationships: []
      }
      parcel_photos: {
        Row: {
          created_at: string
          id: string
          parcel_id: string
          path: string
          position: number
          taken_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          parcel_id: string
          path: string
          position?: number
          taken_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          parcel_id?: string
          path?: string
          position?: number
          taken_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_photos_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_quote_lines: {
        Row: {
          amount_xaf: number
          basis: string
          created_at: string
          id: string
          kind: string
          label: string
          parcel_id: string | null
          quantity: number | null
          quote_id: string
          seq: number
          unit_price_xaf: number | null
          updated_at: string
        }
        Insert: {
          amount_xaf?: number
          basis?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          parcel_id?: string | null
          quantity?: number | null
          quote_id: string
          seq: number
          unit_price_xaf?: number | null
          updated_at?: string
        }
        Update: {
          amount_xaf?: number
          basis?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          parcel_id?: string | null
          quantity?: number | null
          quote_id?: string
          seq?: number
          unit_price_xaf?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcel_quote_lines_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "parcel_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_quote_payments: {
        Row: {
          amount_xaf: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: string
          method: string
          note: string | null
          paid_at: string
          place: string
          proof_path: string | null
          quote_id: string
          receipt_no: string
          received_by: string | null
          reference: string | null
        }
        Insert: {
          amount_xaf: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          place?: string
          proof_path?: string | null
          quote_id: string
          receipt_no?: string
          received_by?: string | null
          reference?: string | null
        }
        Update: {
          amount_xaf?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          place?: string
          proof_path?: string | null
          quote_id?: string
          receipt_no?: string
          received_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_quote_payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "parcel_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_quotes: {
        Row: {
          amount_paid_xaf: number
          created_at: string
          created_by: string | null
          currency: string
          deposit_id: string
          id: string
          invoice_no: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          notes: string | null
          paid_at: string | null
          quote_no: string
          sent_at: string | null
          sent_by: string | null
          status: string
          total_xaf: number
          updated_at: string
        }
        Insert: {
          amount_paid_xaf?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_id: string
          id?: string
          invoice_no?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          notes?: string | null
          paid_at?: string | null
          quote_no?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          total_xaf?: number
          updated_at?: string
        }
        Update: {
          amount_paid_xaf?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_id?: string
          id?: string
          invoice_no?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          notes?: string | null
          paid_at?: string | null
          quote_no?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          total_xaf?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcel_quotes_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: true
            referencedRelation: "parcel_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_releases: {
        Row: {
          client_user_id: string | null
          created_at: string
          id: string
          note: string | null
          parcel_count: number
          picked_by_name: string
          picked_by_phone: string | null
          release_no: string
          released_at: string
          released_by: string | null
          signature_path: string | null
        }
        Insert: {
          client_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          parcel_count?: number
          picked_by_name: string
          picked_by_phone?: string | null
          release_no?: string
          released_at?: string
          released_by?: string | null
          signature_path?: string | null
        }
        Update: {
          client_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          parcel_count?: number
          picked_by_name?: string
          picked_by_phone?: string | null
          release_no?: string
          released_at?: string
          released_by?: string | null
          signature_path?: string | null
        }
        Relationships: []
      }
      parcels: {
        Row: {
          air_shipment_id: string | null
          cbm: number | null
          checked_in_at: string | null
          checked_in_by: string | null
          condition: string | null
          condition_note: string | null
          courier_waybill: string | null
          created_at: string
          delivered_at: string | null
          deposit_id: string
          description: string | null
          height_cm: number | null
          id: string
          kind: string
          length_cm: number | null
          parcel_no: string
          photo_path: string | null
          release_id: string | null
          seq: number
          shipment_id: string | null
          status: string
          updated_at: string
          warehouse_location: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          air_shipment_id?: string | null
          cbm?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          condition?: string | null
          condition_note?: string | null
          courier_waybill?: string | null
          created_at?: string
          delivered_at?: string | null
          deposit_id: string
          description?: string | null
          height_cm?: number | null
          id?: string
          kind?: string
          length_cm?: number | null
          parcel_no: string
          photo_path?: string | null
          release_id?: string | null
          seq: number
          shipment_id?: string | null
          status?: string
          updated_at?: string
          warehouse_location?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          air_shipment_id?: string | null
          cbm?: number | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          condition?: string | null
          condition_note?: string | null
          courier_waybill?: string | null
          created_at?: string
          delivered_at?: string | null
          deposit_id?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          kind?: string
          length_cm?: number | null
          parcel_no?: string
          photo_path?: string | null
          release_id?: string | null
          seq?: number
          shipment_id?: string | null
          status?: string
          updated_at?: string
          warehouse_location?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcels_air_shipment_id_fkey"
            columns: ["air_shipment_id"]
            isOneToOne: false
            referencedRelation: "air_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "parcel_deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_release_fk"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "parcel_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "cargo_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          line_count: number
          note: string | null
          reference: string
          total_amount_rmb: number
          total_amount_xaf: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          line_count?: number
          note?: string | null
          reference: string
          total_amount_rmb?: number
          total_amount_xaf?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          line_count?: number
          note?: string | null
          reference?: string
          total_amount_rmb?: number
          total_amount_xaf?: number
          updated_at?: string
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
      payments: {
        Row: {
          admin_comment: string | null
          amount_rmb: number
          amount_xaf: number
          balance_after: number
          balance_before: number
          batch_id: string | null
          beneficiary_bank_account: string | null
          beneficiary_bank_extra: string | null
          beneficiary_bank_name: string | null
          beneficiary_details: Json | null
          beneficiary_email: string | null
          beneficiary_id: string | null
          beneficiary_identifier: string | null
          beneficiary_identifier_type: string | null
          beneficiary_name: string | null
          beneficiary_notes: string | null
          beneficiary_phone: string | null
          beneficiary_qr_code_url: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
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
          rate_is_custom: boolean
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
          batch_id?: string | null
          beneficiary_bank_account?: string | null
          beneficiary_bank_extra?: string | null
          beneficiary_bank_name?: string | null
          beneficiary_details?: Json | null
          beneficiary_email?: string | null
          beneficiary_id?: string | null
          beneficiary_identifier?: string | null
          beneficiary_identifier_type?: string | null
          beneficiary_name?: string | null
          beneficiary_notes?: string | null
          beneficiary_phone?: string | null
          beneficiary_qr_code_url?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
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
          rate_is_custom?: boolean
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
          batch_id?: string | null
          beneficiary_bank_account?: string | null
          beneficiary_bank_extra?: string | null
          beneficiary_bank_name?: string | null
          beneficiary_details?: Json | null
          beneficiary_email?: string | null
          beneficiary_id?: string | null
          beneficiary_identifier?: string | null
          beneficiary_identifier_type?: string | null
          beneficiary_name?: string | null
          beneficiary_notes?: string | null
          beneficiary_phone?: string | null
          beneficiary_qr_code_url?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
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
          rate_is_custom?: boolean
          reference?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          phone_country: string | null
          phone_e164: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          phone_country?: string | null
          phone_e164: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          phone_country?: string | null
          phone_e164?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      prospect_phones: {
        Row: {
          country_iso: string | null
          created_at: string
          id: string
          label: string | null
          phone_e164: string
          position: number
          prospect_id: string
        }
        Insert: {
          country_iso?: string | null
          created_at?: string
          id?: string
          label?: string | null
          phone_e164: string
          position?: number
          prospect_id: string
        }
        Update: {
          country_iso?: string | null
          created_at?: string
          id?: string
          label?: string | null
          phone_e164?: string
          position?: number
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_phones_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          birth_date: string | null
          city: string | null
          company: string | null
          converted_at: string | null
          converted_user_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          gender: string | null
          help_needed: string | null
          id: string
          interests: string[]
          last_name: string | null
          lost_reason: string | null
          next_action_at: string | null
          notes: string | null
          pain_points: string | null
          phone: string
          phone_e164: string
          source_id: string
          status: string
          status_changed_at: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          company?: string | null
          converted_at?: string | null
          converted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          help_needed?: string | null
          id?: string
          interests?: string[]
          last_name?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          notes?: string | null
          pain_points?: string | null
          phone: string
          phone_e164: string
          source_id: string
          status?: string
          status_changed_at?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          company?: string | null
          converted_at?: string | null
          converted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          help_needed?: string | null
          id?: string
          interests?: string[]
          last_name?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          notes?: string | null
          pain_points?: string | null
          phone?: string
          phone_e164?: string
          source_id?: string
          status?: string
          status_changed_at?: string
          updated_at?: string
        }
        Relationships: []
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
      rate_predictions: {
        Row: {
          action_recommended: string | null
          actual_rate: number | null
          based_on_rate_id: string | null
          confidence: number | null
          created_at: string
          current_rate: number
          direction: string | null
          error_abs: number | null
          id: string
          key_drivers: Json | null
          predicted_rate: number
          reasoning: string | null
          scenarios: Json | null
          was_correct_direction: boolean | null
        }
        Insert: {
          action_recommended?: string | null
          actual_rate?: number | null
          based_on_rate_id?: string | null
          confidence?: number | null
          created_at?: string
          current_rate: number
          direction?: string | null
          error_abs?: number | null
          id?: string
          key_drivers?: Json | null
          predicted_rate: number
          reasoning?: string | null
          scenarios?: Json | null
          was_correct_direction?: boolean | null
        }
        Update: {
          action_recommended?: string | null
          actual_rate?: number | null
          based_on_rate_id?: string | null
          confidence?: number | null
          created_at?: string
          current_rate?: number
          direction?: string | null
          error_abs?: number | null
          id?: string
          key_drivers?: Json | null
          predicted_rate?: number
          reasoning?: string | null
          scenarios?: Json | null
          was_correct_direction?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_predictions_based_on_rate_id_fkey"
            columns: ["based_on_rate_id"]
            isOneToOne: false
            referencedRelation: "rate_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_snapshots: {
        Row: {
          bonzini_rate: number
          cny_bid_adjusted: number
          cny_bid_binance: number
          cny_merchants_count: number
          created_at: string | null
          gain_per_million: number
          id: number
          margin_pct: number
          market_rate: number
          otc_spread: number
          usdt_per_1m_xaf: number
          xaf_ask: number
          xaf_merchants_count: number
        }
        Insert: {
          bonzini_rate: number
          cny_bid_adjusted: number
          cny_bid_binance: number
          cny_merchants_count: number
          created_at?: string | null
          gain_per_million: number
          id?: never
          margin_pct: number
          market_rate: number
          otc_spread?: number
          usdt_per_1m_xaf: number
          xaf_ask: number
          xaf_merchants_count: number
        }
        Update: {
          bonzini_rate?: number
          cny_bid_adjusted?: number
          cny_bid_binance?: number
          cny_merchants_count?: number
          created_at?: string | null
          gain_per_million?: number
          id?: never
          margin_pct?: number
          market_rate?: number
          otc_spread?: number
          usdt_per_1m_xaf?: number
          xaf_ask?: number
          xaf_merchants_count?: number
        }
        Relationships: []
      }
      rate_suggestions: {
        Row: {
          applied: boolean
          applied_at: string | null
          applied_by: string | null
          applied_rate_id: string | null
          chn_orders: Json
          chn_rate_avg: number
          cmr_margin_xaf: number
          cmr_orders: Json
          cmr_rate_max: number
          computed_at: string
          id: string
          method: string
          suggested_rate: number
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          applied_by?: string | null
          applied_rate_id?: string | null
          chn_orders: Json
          chn_rate_avg: number
          cmr_margin_xaf: number
          cmr_orders: Json
          cmr_rate_max: number
          computed_at?: string
          id?: string
          method?: string
          suggested_rate: number
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          applied_by?: string | null
          applied_rate_id?: string | null
          chn_orders?: Json
          chn_rate_avg?: number
          cmr_margin_xaf?: number
          cmr_orders?: Json
          cmr_rate_max?: number
          computed_at?: string
          id?: string
          method?: string
          suggested_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_suggestions_applied_rate_id_fkey"
            columns: ["applied_rate_id"]
            isOneToOne: false
            referencedRelation: "daily_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_outbox: {
        Row: {
          attempts: number
          category: string
          channel: string
          created_at: string
          delivery_status: string | null
          entity_id: string | null
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locale: string
          max_attempts: number
          next_attempt_at: string
          payload: Json
          recipient_country: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          recipient_verified: boolean | null
          segments: number | null
          sender_used: string | null
          sent_at: string | null
          status: string
          telnyx_message_id: string | null
          template: string
        }
        Insert: {
          attempts?: number
          category?: string
          channel?: string
          created_at?: string
          delivery_status?: string | null
          entity_id?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locale?: string
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient_country?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          recipient_verified?: boolean | null
          segments?: number | null
          sender_used?: string | null
          sent_at?: string | null
          status?: string
          telnyx_message_id?: string | null
          template: string
        }
        Update: {
          attempts?: number
          category?: string
          channel?: string
          created_at?: string
          delivery_status?: string | null
          entity_id?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locale?: string
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient_country?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          recipient_verified?: boolean | null
          segments?: number | null
          sender_used?: string | null
          sent_at?: string | null
          status?: string
          telnyx_message_id?: string | null
          template?: string
        }
        Relationships: []
      }
      sms_sender_routes: {
        Row: {
          country_iso: string
          note: string | null
          registered: boolean
          sender_id: string | null
          sender_type: string
          updated_at: string
        }
        Insert: {
          country_iso: string
          note?: string | null
          registered?: boolean
          sender_id?: string | null
          sender_type?: string
          updated_at?: string
        }
        Update: {
          country_iso?: string
          note?: string | null
          registered?: boolean
          sender_id?: string | null
          sender_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_suppressions: {
        Row: {
          created_at: string
          phone_e164: string
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          phone_e164: string
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          phone_e164?: string
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      sms_template_map: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          notification_type: string
          requires_verified_phone: boolean
          template: string
        }
        Insert: {
          category?: string
          created_at?: string
          enabled?: boolean
          notification_type: string
          requires_verified_phone?: boolean
          template: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          notification_type?: string
          requires_verified_phone?: boolean
          template?: string
        }
        Relationships: []
      }
      staff_phones: {
        Row: {
          country_iso: string | null
          created_at: string
          id: string
          label: string | null
          phone_e164: string
          position: number
          user_id: string
        }
        Insert: {
          country_iso?: string | null
          created_at?: string
          id?: string
          label?: string | null
          phone_e164: string
          position?: number
          user_id: string
        }
        Update: {
          country_iso?: string | null
          created_at?: string
          id?: string
          label?: string | null
          phone_e164?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      staff_push_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_name: string | null
          expo_token: string
          id: string
          last_seen_at: string
          platform: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          expo_token: string
          id?: string
          last_seen_at?: string
          platform: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          expo_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_sites: {
        Row: {
          code: string | null
          country_iso: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          position: number
        }
        Insert: {
          code?: string | null
          country_iso?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          position?: number
        }
        Update: {
          code?: string | null
          country_iso?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          position?: number
        }
        Relationships: []
      }
      treasury_accounts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["treasury_currency"]
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["treasury_account_kind"]
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          currency: Database["public"]["Enums"]["treasury_currency"]
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["treasury_account_kind"]
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["treasury_currency"]
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["treasury_account_kind"]
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      treasury_counterparties: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          is_active: boolean
          legal_name: string | null
          notes: string | null
          phone: string | null
          settlement_rate: number | null
          settlement_rate_updated_at: string | null
          short_id: string
          type: Database["public"]["Enums"]["treasury_counterparty_type"]
          updated_at: string
          wechat_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          notes?: string | null
          phone?: string | null
          settlement_rate?: number | null
          settlement_rate_updated_at?: string | null
          short_id: string
          type: Database["public"]["Enums"]["treasury_counterparty_type"]
          updated_at?: string
          wechat_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          notes?: string | null
          phone?: string | null
          settlement_rate?: number | null
          settlement_rate_updated_at?: string | null
          short_id?: string
          type?: Database["public"]["Enums"]["treasury_counterparty_type"]
          updated_at?: string
          wechat_id?: string | null
        }
        Relationships: []
      }
      treasury_inventory_snapshots: {
        Row: {
          account_id: string
          actual_balance: number
          adjustment_entry_id: string | null
          created_at: string
          created_by: string
          id: string
          snapshot_at: string
          theoretical_balance: number
          variance: number | null
          variance_reason: string | null
        }
        Insert: {
          account_id: string
          actual_balance: number
          adjustment_entry_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          snapshot_at: string
          theoretical_balance: number
          variance?: number | null
          variance_reason?: string | null
        }
        Update: {
          account_id?: string
          actual_balance?: number
          adjustment_entry_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          snapshot_at?: string
          theoretical_balance?: number
          variance?: number | null
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_entry_fk"
            columns: ["adjustment_entry_id"]
            isOneToOne: false
            referencedRelation: "treasury_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_inventory_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_inventory_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_ledger_entries: {
        Row: {
          account_id: string
          amount: number
          contra_entry_id: string | null
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["treasury_currency"]
          entry_kind: Database["public"]["Enums"]["treasury_ledger_entry_kind"]
          id: string
          metadata: Json
          occurred_at: string
          source_id: string
          source_table: Database["public"]["Enums"]["treasury_ledger_source_table"]
        }
        Insert: {
          account_id: string
          amount: number
          contra_entry_id?: string | null
          created_at?: string
          created_by: string
          currency: Database["public"]["Enums"]["treasury_currency"]
          entry_kind: Database["public"]["Enums"]["treasury_ledger_entry_kind"]
          id?: string
          metadata?: Json
          occurred_at: string
          source_id: string
          source_table: Database["public"]["Enums"]["treasury_ledger_source_table"]
        }
        Update: {
          account_id?: string
          amount?: number
          contra_entry_id?: string | null
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["treasury_currency"]
          entry_kind?: Database["public"]["Enums"]["treasury_ledger_entry_kind"]
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id?: string
          source_table?: Database["public"]["Enums"]["treasury_ledger_source_table"]
        }
        Relationships: [
          {
            foreignKeyName: "treasury_ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_ledger_entries_contra_entry_id_fkey"
            columns: ["contra_entry_id"]
            isOneToOne: false
            referencedRelation: "treasury_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      trump_posts: {
        Row: {
          content: string
          external_id: string | null
          fetched_at: string
          id: number
          is_iran_related: boolean
          posted_at: string
          raw_link: string | null
        }
        Insert: {
          content: string
          external_id?: string | null
          fetched_at?: string
          id?: never
          is_iran_related?: boolean
          posted_at: string
          raw_link?: string | null
        }
        Update: {
          content?: string
          external_id?: string | null
          fetched_at?: string
          id?: never
          is_iran_related?: boolean
          posted_at?: string
          raw_link?: string | null
        }
        Relationships: []
      }
      usdt_purchases: {
        Row: {
          channel: Database["public"]["Enums"]["treasury_channel_xaf"] | null
          created_at: string
          created_by: string
          external_ref: string | null
          id: string
          implicit_rate: number | null
          notes: string | null
          occurred_at: string
          supplier_id: string
          usdt_amount: number
          void_contra_entry_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          xaf_account_id: string | null
          xaf_amount: number
        }
        Insert: {
          channel?: Database["public"]["Enums"]["treasury_channel_xaf"] | null
          created_at?: string
          created_by: string
          external_ref?: string | null
          id?: string
          implicit_rate?: number | null
          notes?: string | null
          occurred_at: string
          supplier_id: string
          usdt_amount: number
          void_contra_entry_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          xaf_account_id?: string | null
          xaf_amount: number
        }
        Update: {
          channel?: Database["public"]["Enums"]["treasury_channel_xaf"] | null
          created_at?: string
          created_by?: string
          external_ref?: string | null
          id?: string
          implicit_rate?: number | null
          notes?: string | null
          occurred_at?: string
          supplier_id?: string
          usdt_amount?: number
          void_contra_entry_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          xaf_account_id?: string | null
          xaf_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "usdt_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "treasury_counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usdt_purchases_void_contra_entry_fk"
            columns: ["void_contra_entry_id"]
            isOneToOne: false
            referencedRelation: "treasury_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usdt_purchases_xaf_account_id_fkey"
            columns: ["xaf_account_id"]
            isOneToOne: false
            referencedRelation: "treasury_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usdt_purchases_xaf_account_id_fkey"
            columns: ["xaf_account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      usdt_sales: {
        Row: {
          buyer_id: string
          cny_account_id: string | null
          cny_amount: number
          created_at: string
          created_by: string
          external_ref: string | null
          id: string
          implicit_rate: number | null
          notes: string | null
          occurred_at: string
          payment_id: string | null
          usdt_amount: number
          void_contra_entry_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          wac_at_sale: number
        }
        Insert: {
          buyer_id: string
          cny_account_id?: string | null
          cny_amount: number
          created_at?: string
          created_by: string
          external_ref?: string | null
          id?: string
          implicit_rate?: number | null
          notes?: string | null
          occurred_at: string
          payment_id?: string | null
          usdt_amount: number
          void_contra_entry_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wac_at_sale: number
        }
        Update: {
          buyer_id?: string
          cny_account_id?: string | null
          cny_amount?: number
          created_at?: string
          created_by?: string
          external_ref?: string | null
          id?: string
          implicit_rate?: number | null
          notes?: string | null
          occurred_at?: string
          payment_id?: string | null
          usdt_amount?: number
          void_contra_entry_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wac_at_sale?: number
        }
        Relationships: [
          {
            foreignKeyName: "usdt_sales_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "treasury_counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usdt_sales_cny_account_id_fkey"
            columns: ["cny_account_id"]
            isOneToOne: false
            referencedRelation: "treasury_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usdt_sales_cny_account_id_fkey"
            columns: ["cny_account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usdt_sales_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usdt_sales_void_contra_entry_fk"
            columns: ["void_contra_entry_id"]
            isOneToOne: false
            referencedRelation: "treasury_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_disabled: boolean
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          site_id: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_disabled?: boolean
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          site_id?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_disabled?: boolean
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          site_id?: string | null
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
          overdraft_limit_xaf: number
          overdraft_note: string | null
          overdraft_set_at: string | null
          overdraft_set_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_xaf?: number
          created_at?: string
          id?: string
          overdraft_limit_xaf?: number
          overdraft_note?: string | null
          overdraft_set_at?: string | null
          overdraft_set_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_xaf?: number
          created_at?: string
          id?: string
          overdraft_limit_xaf?: number
          overdraft_note?: string | null
          overdraft_set_at?: string | null
          overdraft_set_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          client_ip_hash: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          client_ip_hash?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          client_ip_hash?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          backed_up: boolean
          counter: number
          created_at: string
          credential_id: string
          device_label: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      treasury_account_balances: {
        Row: {
          balance: number | null
          code: string | null
          currency: Database["public"]["Enums"]["treasury_currency"] | null
          entry_count: number | null
          id: string | null
          is_active: boolean | null
          kind: Database["public"]["Enums"]["treasury_account_kind"] | null
          label: string | null
          last_entry_at: string | null
          sort_order: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _create_client_and_wallet: {
        Args: { p_email: string; p_id: string; p_meta: Json }
        Returns: undefined
      }
      _enqueue_welcome: {
        Args: { p_first: string; p_user_id: string }
        Returns: undefined
      }
      add_cargo_shipment: {
        Args: {
          p_client_label: string
          p_container_number: string
          p_eta_promised?: string
          p_etd_promised?: string
          p_freight_usd?: number
          p_lookup_id: string
        }
        Returns: Json
      }
      adjust_treasury_account: {
        Args: {
          p_account_id: string
          p_delta_amount: number
          p_occurred_at?: string
          p_reason: string
        }
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
      admin_correct_payment: {
        Args: {
          p_amount_rmb?: number
          p_amount_xaf?: number
          p_exchange_rate?: number
          p_payment_id: string
          p_rate_is_custom?: boolean
          p_reason: string
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
      admin_create_canned_response: {
        Args: { p_content: string; p_label: string; p_sort_order?: number }
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
      admin_create_quick_reply: {
        Args: {
          p_active?: boolean
          p_content: string
          p_label: string
          p_sort_order?: number
        }
        Returns: Json
      }
      admin_delete_canned_response: { Args: { p_id: string }; Returns: Json }
      admin_delete_client: { Args: { p_user_id: string }; Returns: Json }
      admin_delete_quick_reply: { Args: { p_id: string }; Returns: Json }
      admin_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      admin_resend_sms: { Args: { p_outbox_id: string }; Returns: Json }
      admin_reset_client_password: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_reset_password: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_revoke_passkey: { Args: { p_credential: string }; Returns: Json }
      admin_set_client_identity: {
        Args: {
          p_clear_birth_date?: boolean
          p_date_of_birth?: string
          p_gender?: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_set_client_locale: {
        Args: { p_locale: string; p_user_id: string }
        Returns: Json
      }
      admin_set_client_phones: {
        Args: { p_phones: Json; p_user_id: string }
        Returns: Json
      }
      admin_set_wallet_overdraft: {
        Args: { p_limit_xaf: number; p_reason?: string; p_user_id: string }
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
      admin_sms_delivery_stats: {
        Args: { p_days?: number }
        Returns: {
          country: string
          delivered: number
          failed: number
          multi_segment: number
          sent: number
          skipped: number
          total: number
        }[]
      }
      admin_suppress_phone: {
        Args: { p_phone: string; p_reason?: string }
        Returns: Json
      }
      admin_update_canned_response: {
        Args: {
          p_content?: string
          p_id: string
          p_label?: string
          p_sort_order?: number
        }
        Returns: Json
      }
      admin_update_payment_beneficiary: {
        Args: {
          p_beneficiary_bank_account?: string
          p_beneficiary_bank_extra?: string
          p_beneficiary_bank_name?: string
          p_beneficiary_email?: string
          p_beneficiary_identifier?: string
          p_beneficiary_identifier_type?: string
          p_beneficiary_name?: string
          p_beneficiary_notes?: string
          p_beneficiary_phone?: string
          p_beneficiary_qr_code_url?: string
          p_payment_id: string
        }
        Returns: Json
      }
      admin_update_quick_reply: {
        Args: {
          p_active?: boolean
          p_content?: string
          p_id: string
          p_label?: string
          p_sort_order?: number
        }
        Returns: Json
      }
      assign_chat_conversation: {
        Args: { p_admin_user_role_id: string; p_conversation_id: string }
        Returns: undefined
      }
      assistant_readonly_query: {
        Args: { p_allowed_tables?: string[]; p_sql: string }
        Returns: Json
      }
      calculate_final_rate: {
        Args: {
          p_amount_xaf: number
          p_country_key: string
          p_payment_method: string
        }
        Returns: Json
      }
      can_access_treasury: { Args: { _user_id: string }; Returns: boolean }
      can_manage_rates: { Args: { p_user_id: string }; Returns: boolean }
      cancel_client_deposit: { Args: { p_deposit_id: string }; Returns: Json }
      cancel_deposit: { Args: { p_deposit_id: string }; Returns: Json }
      cancel_payment: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: Json
      }
      cargo_account_assign: {
        Args: { p_account_id?: string; p_client_user_id: string }
        Returns: Json
      }
      cargo_account_clients: { Args: { p_account_id: string }; Returns: Json }
      cargo_account_list: {
        Args: { p_include_inactive?: boolean }
        Returns: Json
      }
      cargo_account_upsert: {
        Args: {
          p_code?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_id?: string
          p_is_active?: boolean
          p_name?: string
          p_notes?: string
        }
        Returns: Json
      }
      cargo_air_create: {
        Args: {
          p_airline?: string
          p_awb_number: string
          p_destination?: string
          p_eta?: string
          p_etd?: string
          p_flight_no?: string
          p_freight_usd?: number
          p_notes?: string
          p_origin?: string
        }
        Returns: Json
      }
      cargo_air_get: { Args: { p_air_id: string }; Returns: Json }
      cargo_air_json: {
        Args: { p_air_id: string; p_with_parcels?: boolean }
        Returns: Json
      }
      cargo_air_list: { Args: never; Returns: Json }
      cargo_air_load_parcels: {
        Args: { p_air_id: string; p_parcel_ids: string[] }
        Returns: Json
      }
      cargo_air_loadable_parcels: { Args: { p_air_id: string }; Returns: Json }
      cargo_air_set_status: {
        Args: { p_air_id: string; p_at?: string; p_status: string }
        Returns: Json
      }
      cargo_air_unload_parcel: { Args: { p_parcel_id: string }; Returns: Json }
      cargo_air_update: {
        Args: {
          p_air_id: string
          p_airline?: string
          p_awb_number?: string
          p_destination?: string
          p_eta?: string
          p_etd?: string
          p_flight_no?: string
          p_freight_usd?: number
          p_notes?: string
          p_origin?: string
        }
        Returns: Json
      }
      cargo_detect_carrier: {
        Args: { p_ref: string }
        Returns: {
          carrier: string
          reference_type: string
        }[]
      }
      cargo_fleet_status: { Args: { p_client?: string }; Returns: Json }
      cargo_fmt_xaf: { Args: { p: number }; Returns: string }
      cargo_load_parcels: {
        Args: { p_parcel_ids: string[]; p_shipment_id: string }
        Returns: Json
      }
      cargo_notify_client: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      cargo_parts_summary: { Args: never; Returns: Json }
      cargo_pricing_get: { Args: never; Returns: Json }
      cargo_pricing_set: {
        Args: { p_air_per_kg_xaf: number; p_sea_per_cbm_xaf: number }
        Returns: Json
      }
      cargo_quote_add_line: {
        Args: {
          p_amount_xaf: number
          p_kind: string
          p_label: string
          p_quote_id: string
        }
        Returns: Json
      }
      cargo_quote_add_payment: {
        Args: {
          p_amount_xaf: number
          p_method?: string
          p_note?: string
          p_paid_at?: string
          p_place?: string
          p_proof_path?: string
          p_quote_id: string
          p_reference?: string
        }
        Returns: Json
      }
      cargo_quote_cancel_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
      cargo_quote_ensure: { Args: { p_deposit_id: string }; Returns: Json }
      cargo_quote_get: { Args: { p_deposit_id: string }; Returns: Json }
      cargo_quote_invoice: { Args: { p_quote_id: string }; Returns: Json }
      cargo_quote_json: { Args: { p_quote_id: string }; Returns: Json }
      cargo_quote_pay_from_wallet: {
        Args: { p_amount_xaf: number; p_note?: string; p_quote_id: string }
        Returns: Json
      }
      cargo_quote_recompute: {
        Args: { p_quote_id: string }
        Returns: undefined
      }
      cargo_quote_remove_line: { Args: { p_line_id: string }; Returns: Json }
      cargo_quote_send: { Args: { p_quote_id: string }; Returns: Json }
      cargo_quote_set_line: {
        Args: {
          p_amount_xaf?: number
          p_basis?: string
          p_label?: string
          p_line_id: string
          p_unit_price_xaf?: number
        }
        Returns: Json
      }
      cargo_secret: { Args: { p_name: string }; Returns: string }
      cargo_set_freight_paid: {
        Args: { p_paid?: boolean; p_shipment_id: string }
        Returns: Json
      }
      cargo_set_telex: {
        Args: { p_received?: boolean; p_shipment_id: string }
        Returns: Json
      }
      cargo_set_vessel_position: {
        Args: {
          p_course_deg?: number
          p_imo: string
          p_latitude: number
          p_longitude: number
          p_note?: string
          p_reported_at?: string
          p_speed_kn?: number
        }
        Returns: Json
      }
      cargo_shipment_parcels: { Args: { p_shipment_id: string }; Returns: Json }
      cargo_unload_parcel: { Args: { p_parcel_id: string }; Returns: Json }
      chat_avg_response_seconds_today: { Args: never; Returns: number }
      check_wallet_reconciliation: {
        Args: { p_user_id: string }
        Returns: Json
      }
      claim_chat_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      claim_email_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          delivery_status: string | null
          entity_id: string | null
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          recipient_email: string | null
          recipient_user_id: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: string
          template: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_sms_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          category: string
          channel: string
          created_at: string
          delivery_status: string | null
          entity_id: string | null
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          locale: string
          max_attempts: number
          next_attempt_at: string
          payload: Json
          recipient_country: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          recipient_verified: boolean | null
          segments: number | null
          sender_used: string | null
          sent_at: string | null
          status: string
          telnyx_message_id: string | null
          template: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sms_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_chat_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      complete_client_onboarding: {
        Args: {
          p_company?: string
          p_country: string
          p_phone: string
          p_sector?: string
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
      confirm_phone_verification: { Args: { p_code: string }; Returns: Json }
      create_admin_payment: {
        Args: {
          p_amount_rmb: number
          p_amount_xaf: number
          p_beneficiary_bank_account?: string
          p_beneficiary_bank_name?: string
          p_beneficiary_details?: Json
          p_beneficiary_email?: string
          p_beneficiary_id?: string
          p_beneficiary_name?: string
          p_beneficiary_notes?: string
          p_beneficiary_phone?: string
          p_beneficiary_qr_code_url?: string
          p_client_visible_comment?: string
          p_desired_date?: string
          p_exchange_rate: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_rate_is_custom?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      create_cargo_shipment_manual: {
        Args: {
          p_bl_number: string
          p_carrier: string
          p_client_label: string
          p_container_number: string
          p_eta_promised?: string
          p_etd_promised?: string
          p_freight_usd?: number
          p_pod_name: string
          p_pod_unlocode?: string
          p_pol_name?: string
          p_pol_unlocode?: string
          p_vessel_imo?: string
          p_vessel_mmsi?: string
          p_vessel_name?: string
          p_voyage?: string
        }
        Returns: Json
      }
      create_client_deposit: {
        Args: {
          p_agency_name?: string
          p_amount_xaf: number
          p_bank_name?: string
          p_client_phone?: string
          p_desired_date?: string
          p_method: Database["public"]["Enums"]["deposit_method"]
          p_user_id: string
        }
        Returns: Json
      }
      create_client_source: {
        Args: {
          p_kind: string
          p_label: string
          p_notes?: string
          p_phone?: string
        }
        Returns: Json
      }
      create_daily_rates: {
        Args: {
          p_effective_at?: string
          p_rate_alipay: number
          p_rate_cash: number
          p_rate_virement: number
          p_rate_wechat: number
        }
        Returns: Json
      }
      create_payment: {
        Args: {
          p_amount_rmb: number
          p_amount_xaf: number
          p_beneficiary_bank_account?: string
          p_beneficiary_bank_name?: string
          p_beneficiary_details?: Json
          p_beneficiary_email?: string
          p_beneficiary_id?: string
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
          p_rate_is_custom?: boolean
        }
        Returns: Json
      }
      create_payment_batch: {
        Args: { p_lines: Json; p_note?: string; p_user_id: string }
        Returns: Json
      }
      create_treasury_counterparty: {
        Args: {
          p_display_name: string
          p_legal_name?: string
          p_notes?: string
          p_phone?: string
          p_type: Database["public"]["Enums"]["treasury_counterparty_type"]
          p_wechat_id?: string
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
      customs_active_broker: {
        Args: { p_user_id: string }
        Returns: {
          active: boolean
          company: string
          created_at: string
          created_by: string | null
          license_no: string
          representative_no: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "customs_brokers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      customs_audit_cancel: { Args: { p_id: string }; Returns: Json }
      customs_audit_claim: { Args: { p_id: string }; Returns: Json }
      customs_audit_create: {
        Args: {
          p_client_user_id?: string
          p_dau_number?: string
          p_file_paths: string[]
          p_paid_on?: string
        }
        Returns: Json
      }
      customs_audit_get: { Args: { p_id: string }; Returns: Json }
      customs_audit_review: {
        Args: { p_id: string; p_note: string; p_recoverable_xaf?: number }
        Returns: Json
      }
      customs_audit_save_findings: {
        Args: {
          p_findings: Json
          p_id: string
          p_overpaid_xaf?: number
          p_paid_on?: string
          p_total_paid_xaf?: number
        }
        Returns: Json
      }
      customs_audit_submit: { Args: { p_id: string }; Returns: Json }
      customs_broker_register: {
        Args: {
          p_active?: boolean
          p_company: string
          p_license_no: string
          p_representative_no?: string
          p_user_id: string
        }
        Returns: Json
      }
      customs_classification_cancel: { Args: { p_id: string }; Returns: Json }
      customs_classification_claim: { Args: { p_id: string }; Returns: Json }
      customs_classification_create: {
        Args: {
          p_client_user_id?: string
          p_description?: string
          p_facts?: Json
          p_photo_paths?: string[]
          p_product_name: string
        }
        Returns: Json
      }
      customs_classification_decide: {
        Args: {
          p_decision: string
          p_final_code?: string
          p_id: string
          p_note?: string
        }
        Returns: Json
      }
      customs_classification_get: { Args: { p_id: string }; Returns: Json }
      customs_classification_json: { Args: { p_id: string }; Returns: Json }
      customs_classification_post: {
        Args: { p_body: string; p_facts?: Json; p_id: string }
        Returns: Json
      }
      customs_classification_submit: { Args: { p_id: string }; Returns: Json }
      customs_client_supplier_documents: {
        Args: { p_client_user_id: string }
        Returns: Json
      }
      customs_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          classification_id: string | null
          client_user_id: string
          created_at: string
          due_on: string | null
          expires_at: string
          id: string
          language: string
          last_upload_at: string | null
          message: string | null
          requested: string[]
          status: string
          supplier_contact: string | null
          supplier_name: string
          token_hash: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customs_supplier_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      customs_invite_create: {
        Args: {
          p_classification_id?: string
          p_due_on?: string
          p_language?: string
          p_message?: string
          p_requested: string[]
          p_supplier_contact?: string
          p_supplier_name: string
        }
        Returns: Json
      }
      customs_invite_hash: { Args: { p_token: string }; Returns: string }
      customs_invite_public: { Args: { p_token: string }; Returns: Json }
      customs_invite_record_document: {
        Args: {
          p_kind: string
          p_mime: string
          p_name: string
          p_note?: string
          p_path: string
          p_size: number
          p_token: string
        }
        Returns: Json
      }
      customs_invite_revoke: { Args: { p_id: string }; Returns: Json }
      customs_invite_rotate: { Args: { p_id: string }; Returns: Json }
      customs_invite_upload_target: {
        Args: {
          p_kind: string
          p_mime: string
          p_size: number
          p_token: string
        }
        Returns: Json
      }
      customs_my_files: { Args: never; Returns: Json }
      customs_my_invites: { Args: never; Returns: Json }
      customs_notice_archive: { Args: { p_id: string }; Returns: Json }
      customs_notice_upsert: { Args: { p_notice: Json }; Returns: Json }
      customs_notify_brokers: {
        Args: { p_body: string; p_path: string; p_title: string }
        Returns: undefined
      }
      customs_notify_client: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      customs_review_queue: { Args: never; Returns: Json }
      delete_daily_rate: { Args: { p_rate_id: string }; Returns: Json }
      delete_payment_proof: { Args: { p_proof_id: string }; Returns: Json }
      delete_treasury_counterparty: { Args: { p_id: string }; Returns: Json }
      enqueue_password_changed_email: { Args: never; Returns: undefined }
      enqueue_welcome_email: { Args: never; Returns: undefined }
      find_client_by_customer_code: { Args: { p_code: string }; Returns: Json }
      generate_customer_code: { Args: never; Returns: string }
      generate_deposit_reference: { Args: never; Returns: string }
      generate_payment_batch_reference: { Args: never; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
      get_chat_admin_stats: { Args: { p_period_days?: number }; Returns: Json }
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
      get_client_source_clients: {
        Args: { p_from: string; p_source_id: string; p_to: string }
        Returns: Json
      }
      get_client_source_report: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_deposit_stats: { Args: never; Returns: Json }
      get_top_counterparties: {
        Args: {
          p_from_date: string
          p_limit?: number
          p_to_date: string
          p_type: Database["public"]["Enums"]["treasury_counterparty_type"]
        }
        Returns: Json
      }
      get_treasury_dashboard: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: Json
      }
      get_unsettled_payments: {
        Args: { p_from_date?: string; p_to_date?: string }
        Returns: Json
      }
      get_usdt_sales_monthly: { Args: { p_months?: number }; Returns: Json }
      get_usdt_stock: { Args: { p_at?: string }; Returns: number }
      get_wac_usdt: { Args: { p_at?: string }; Returns: number }
      get_xaf_per_cny_at: {
        Args: {
          p_at: string
          p_kind: Database["public"]["Enums"]["treasury_account_kind"]
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_cash_agent: { Args: { _user_id: string }; Returns: boolean }
      is_support_admin: { Args: { _user_id: string }; Returns: boolean }
      is_treasurer: { Args: { _user_id: string }; Returns: boolean }
      logistics_observed_transit: { Args: never; Returns: Json }
      mark_conversation_read_admin: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_conversation_read_client: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_message_read: { Args: { p_message_id: string }; Returns: undefined }
      mark_suggestion_applied: {
        Args: { p_rate_id: string; p_suggestion_id: string }
        Returns: Json
      }
      mola_discover_capabilities: { Args: { p_search?: string }; Returns: Json }
      mola_operations_radar: {
        Args: {
          p_custom_rate_days?: number
          p_deposit_age_hours?: number
          p_dormant_min_xaf?: number
          p_payment_age_hours?: number
        }
        Returns: Json
      }
      mola_purge_old_conversations: { Args: { p_days?: number }; Returns: Json }
      mola_search_memory: {
        Args: {
          p_admin: string
          p_embedding: string
          p_kinds?: string[]
          p_limit?: number
        }
        Returns: {
          content: string
          distance: number
          kind: string
          scope: string
        }[]
      }
      parcel_status_for_air: { Args: { p_status: string }; Returns: string }
      parcel_status_for_shipment: {
        Args: { p_shipment_status: string }
        Returns: string
      }
      phone_country_from_e164: { Args: { p_phone: string }; Returns: string }
      process_payment: {
        Args: { p_action: string; p_comment?: string; p_payment_id: string }
        Returns: Json
      }
      purge_webauthn_challenges: { Args: never; Returns: undefined }
      reception_add_parcel: {
        Args: {
          p_copies?: number
          p_courier_waybill?: string
          p_deposit_id: string
          p_description?: string
          p_height_cm?: number
          p_kind?: string
          p_length_cm?: number
          p_photo_path?: string
          p_photo_paths?: string[]
          p_weight_kg?: number
          p_width_cm?: number
        }
        Returns: Json
      }
      reception_add_parcel_photos: {
        Args: { p_parcel_id: string; p_paths: string[] }
        Returns: Json
      }
      reception_assign_client: {
        Args: { p_client_user_id: string; p_deposit_id: string }
        Returns: Json
      }
      reception_attach_photos: {
        Args: {
          p_cover?: boolean
          p_parcel_id: string
          p_paths: string[]
          p_uid: string
        }
        Returns: string
      }
      reception_board: {
        Args: {
          p_from?: string
          p_limit?: number
          p_location?: string
          p_scope?: string
          p_to?: string
        }
        Returns: Json
      }
      reception_can_edit: {
        Args: {
          p_deposit: Database["public"]["Tables"]["parcel_deposits"]["Row"]
          p_uid: string
        }
        Returns: boolean
      }
      reception_cancel_deposit: {
        Args: { p_deposit_id: string; p_reason?: string }
        Returns: Json
      }
      reception_client: { Args: { p_user_id: string }; Returns: Json }
      reception_client_by_code: { Args: { p_code: string }; Returns: Json }
      reception_client_card: { Args: { p_user_id: string }; Returns: Json }
      reception_client_deposits: { Args: { p_user_id: string }; Returns: Json }
      reception_client_suppliers: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: Json
      }
      reception_close_deposit: {
        Args: { p_deposit_id: string; p_notes?: string }
        Returns: Json
      }
      reception_deposit_json: { Args: { p_deposit_id: string }; Returns: Json }
      reception_get_deposit: { Args: { p_deposit_id: string }; Returns: Json }
      reception_loadable_parcels: {
        Args: { p_shipment_id: string }
        Returns: Json
      }
      reception_my_day: { Args: { p_day?: string }; Returns: Json }
      reception_open_deposit: {
        Args: {
          p_brought_by?: string
          p_client_user_id?: string
          p_location: string
          p_representative_name?: string
          p_representative_phone?: string
          p_supplier_address?: string
          p_supplier_contact?: string
          p_supplier_email?: string
          p_supplier_kind?: string
          p_supplier_name?: string
          p_supplier_phone?: string
          p_supplier_wechat?: string
        }
        Returns: Json
      }
      reception_overview: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      reception_parcel_locked: {
        Args: { p: Database["public"]["Tables"]["parcels"]["Row"] }
        Returns: string
      }
      reception_pending_deposits: { Args: never; Returns: Json }
      reception_quote_engaged: {
        Args: { p_deposit_id: string }
        Returns: string
      }
      reception_recent_clients: { Args: { p_limit?: number }; Returns: Json }
      reception_recount_deposit: {
        Args: { p_deposit_id: string }
        Returns: undefined
      }
      reception_remove_parcel: {
        Args: { p_parcel_id: string; p_reason?: string }
        Returns: Json
      }
      reception_remove_parcel_photo: {
        Args: { p_photo_id: string }
        Returns: Json
      }
      reception_restore_deposit: {
        Args: { p_deposit_id: string }
        Returns: Json
      }
      reception_search_clients: { Args: { p_query: string }; Returns: Json }
      reception_set_client_origin: {
        Args: {
          p_location: string
          p_user_id: string
        }
        Returns: Json
      }
      reception_set_parcel_cover: {
        Args: { p_photo_id: string }
        Returns: Json
      }
      reception_set_supplier: {
        Args: {
          p_deposit_id: string
          p_supplier_address?: string
          p_supplier_contact?: string
          p_supplier_email?: string
          p_supplier_kind?: string
          p_supplier_name?: string
          p_supplier_phone?: string
          p_supplier_wechat?: string
        }
        Returns: Json
      }
      reception_stock: { Args: { p_location?: string }; Returns: Json }
      reception_update_deposit: {
        Args: {
          p_brought_by?: string
          p_deposit_id: string
          p_location?: string
          p_notes?: string
          p_representative_name?: string
          p_representative_phone?: string
        }
        Returns: Json
      }
      reception_update_parcel: {
        Args: {
          p_courier_waybill?: string
          p_description?: string
          p_height_cm?: number
          p_kind?: string
          p_length_cm?: number
          p_parcel_id: string
          p_photo_path?: string
          p_photo_paths?: string[]
          p_weight_kg?: number
          p_width_cm?: number
        }
        Returns: Json
      }
      record_inventory_snapshot: {
        Args: {
          p_account_id: string
          p_actual_balance: number
          p_snapshot_at?: string
          p_variance_reason?: string
        }
        Returns: Json
      }
      record_usdt_purchase: {
        Args: {
          p_account_splits: Json
          p_external_ref?: string
          p_notes?: string
          p_occurred_at?: string
          p_supplier_id: string
          p_usdt_amount: number
        }
        Returns: Json
      }
      record_usdt_sale: {
        Args: {
          p_buyer_id: string
          p_cny_account_id?: string
          p_cny_amount: number
          p_external_ref?: string
          p_notes?: string
          p_occurred_at?: string
          p_usdt_amount: number
        }
        Returns: Json
      }
      register_staff_push_device: {
        Args: {
          p_app_version?: string
          p_device_name?: string
          p_platform: string
          p_token: string
        }
        Returns: Json
      }
      reject_deposit: {
        Args: { p_deposit_id: string; p_reason: string }
        Returns: Json
      }
      remove_cargo_shipment: { Args: { p_id: string }; Returns: Json }
      reopen_chat_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      reorder_canned_responses: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      reorder_quick_replies: { Args: { p_ids: string[] }; Returns: undefined }
      request_cargo_lookup: { Args: { p_reference: string }; Returns: Json }
      request_cargo_sync: { Args: never; Returns: Json }
      request_phone_verification: {
        Args: { p_country?: string; p_phone_e164: string }
        Returns: Json
      }
      resolve_sms_sender: {
        Args: { p_country: string }
        Returns: {
          sender_id: string
          sender_type: string
        }[]
      }
      revert_deposit_to_created: {
        Args: { p_deposit_id: string }
        Returns: Json
      }
      run_cargo_sync: { Args: never; Returns: undefined }
      run_deposit_reminders: { Args: never; Returns: undefined }
      run_email_drainer: { Args: never; Returns: undefined }
      run_mola_daily_digest: { Args: never; Returns: undefined }
      run_profile_reminders: { Args: never; Returns: undefined }
      run_sms_deposit_reminders: { Args: never; Returns: undefined }
      run_sms_drainer: { Args: never; Returns: undefined }
      scan_cash_payment: { Args: { p_payment_id: string }; Returns: Json }
      search_chat_conversations: {
        Args: { p_query: string }
        Returns: {
          client_first_name: string
          client_id: string
          client_last_name: string
          conversation_id: string
          last_match_at: string
          match_count: number
          snippet: string
        }[]
      }
      send_staff_push: {
        Args: {
          p_body: string
          p_exclude?: string
          p_path: string
          p_permission: string
          p_roles?: string[]
          p_title: string
        }
        Returns: number
      }
      set_client_source: {
        Args: { p_source_id: string; p_user_id: string }
        Returns: Json
      }
      set_counterparty_settlement_rate: {
        Args: { p_counterparty_id: string; p_rate: number }
        Returns: Json
      }
      set_deposit_verified: {
        Args: { p_deposit_id: string; p_verified: boolean }
        Returns: Json
      }
      set_my_preferred_locale: { Args: { p_locale: string }; Returns: Json }
      settle_payments_usdt: {
        Args: {
          p_buyer_id: string
          p_occurred_at?: string
          p_payment_ids: string[]
          p_rate?: number
        }
        Returns: Json
      }
      sms_locale_for_country: { Args: { p_country: string }; Returns: string }
      sms_recipient: {
        Args: { p_notification_type: string; p_user_id: string }
        Returns: {
          country: string
          first_name: string
          locale: string
          phone: string
          status: string
          verified: boolean
        }[]
      }
      staff_push_amount: { Args: { p: number }; Returns: string }
      staff_push_client_name: { Args: { p_user_id: string }; Returns: string }
      start_deposit_review: { Args: { p_deposit_id: string }; Returns: Json }
      submit_deposit_proof: { Args: { p_deposit_id: string }; Returns: Json }
      team_create_site: {
        Args: {
          p_country_iso?: string
          p_label: string
        }
        Returns: Json
      }
      team_set_member_profile: {
        Args: {
          p_clear_site?: boolean
          p_phones?: Json
          p_site_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      team_sites: { Args: never; Returns: Json }
      toggle_admin_status: {
        Args: { p_disabled: boolean; p_target_user_id: string }
        Returns: Json
      }
      unregister_staff_push_device: { Args: { p_token: string }; Returns: Json }
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
      update_client_source: {
        Args: {
          p_id: string
          p_is_active?: boolean
          p_label?: string
          p_notes?: string
          p_phone?: string
        }
        Returns: Json
      }
      update_daily_rate: {
        Args: {
          p_effective_at?: string
          p_rate_alipay: number
          p_rate_cash: number
          p_rate_id: string
          p_rate_virement: number
          p_rate_wechat: number
        }
        Returns: Json
      }
      update_my_admin_profile: {
        Args: {
          p_avatar_url?: string
          p_first_name: string
          p_last_name: string
        }
        Returns: Json
      }
      update_payment_beneficiary: {
        Args: {
          p_beneficiary_bank_account?: string
          p_beneficiary_bank_name?: string
          p_beneficiary_email?: string
          p_beneficiary_name?: string
          p_beneficiary_notes?: string
          p_beneficiary_phone?: string
          p_beneficiary_qr_code_url?: string
          p_payment_id: string
        }
        Returns: Json
      }
      update_platform_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      update_rate_adjustment: {
        Args: { p_adjustment_id: string; p_percentage: number }
        Returns: Json
      }
      update_treasury_counterparty: {
        Args: {
          p_display_name?: string
          p_id: string
          p_is_active?: boolean
          p_legal_name?: string
          p_notes?: string
          p_phone?: string
          p_wechat_id?: string
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
      void_treasury_operation: {
        Args: {
          p_source_id: string
          p_source_table: Database["public"]["Enums"]["treasury_ledger_source_table"]
          p_void_reason: string
        }
        Returns: Json
      }
      warehouse_arrival_parcels: {
        Args: { p_id: string; p_kind: string }
        Returns: Json
      }
      warehouse_checkin_many: {
        Args: { p_location?: string; p_parcel_ids: string[] }
        Returns: Json
      }
      warehouse_checkin_parcel: {
        Args: {
          p_condition?: string
          p_location?: string
          p_note?: string
          p_parcel_id: string
        }
        Returns: Json
      }
      warehouse_client_parcels: { Args: { p_code: string }; Returns: Json }
      warehouse_day: { Args: never; Returns: Json }
      warehouse_find_parcel: { Args: { p_query: string }; Returns: Json }
      warehouse_flag_missing: {
        Args: { p_missing?: boolean; p_note?: string; p_parcel_id: string }
        Returns: Json
      }
      warehouse_flag_missing_many: {
        Args: { p_note?: string; p_parcel_ids: string[] }
        Returns: Json
      }
      warehouse_parcel_json: { Args: { p_parcel_id: string }; Returns: Json }
      warehouse_release_get: { Args: { p_release_id: string }; Returns: Json }
      warehouse_release_json: { Args: { p_release_id: string }; Returns: Json }
      warehouse_release_parcels: {
        Args: {
          p_note?: string
          p_parcel_ids: string[]
          p_picked_by_name: string
          p_picked_by_phone?: string
          p_signature_path?: string
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
        | "treasurer"
        | "receptionist"
        | "warehouse_agent"
        | "customs_broker"
        | "commercial"
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
        | "cancelled_by_admin"
      ledger_entry_type:
        | "DEPOSIT_VALIDATED"
        | "DEPOSIT_REFUSED"
        | "PAYMENT_RESERVED"
        | "PAYMENT_EXECUTED"
        | "PAYMENT_CANCELLED_REFUNDED"
        | "ADMIN_CREDIT"
        | "ADMIN_DEBIT"
        | "CARGO_FEES"
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
        | "cancelled_by_admin"
      treasury_account_kind:
        | "bank"
        | "mobile_money"
        | "crypto_pool"
        | "cash"
        | "alipay"
        | "wechat"
        | "other"
      treasury_channel_xaf: "bank_transfer" | "mobile_money" | "cash" | "other"
      treasury_counterparty_type: "usdt_supplier" | "cny_buyer"
      treasury_currency: "XAF" | "USDT" | "CNY"
      treasury_ledger_entry_kind:
        | "usdt_purchase_debit_xaf"
        | "usdt_purchase_credit_usdt"
        | "usdt_sale_debit_usdt"
        | "usdt_sale_credit_cny"
        | "inventory_adjustment"
        | "void"
      treasury_ledger_source_table:
        | "usdt_purchase"
        | "usdt_sale"
        | "inventory_snapshot"
        | "manual_adjustment"
        | "void"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "treasurer",
        "receptionist",
        "warehouse_agent",
        "customs_broker",
        "commercial",
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
        "cancelled_by_admin",
      ],
      ledger_entry_type: [
        "DEPOSIT_VALIDATED",
        "DEPOSIT_REFUSED",
        "PAYMENT_RESERVED",
        "PAYMENT_EXECUTED",
        "PAYMENT_CANCELLED_REFUNDED",
        "ADMIN_CREDIT",
        "ADMIN_DEBIT",
        "CARGO_FEES",
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
        "cancelled_by_admin",
      ],
      treasury_account_kind: [
        "bank",
        "mobile_money",
        "crypto_pool",
        "cash",
        "alipay",
        "wechat",
        "other",
      ],
      treasury_channel_xaf: ["bank_transfer", "mobile_money", "cash", "other"],
      treasury_counterparty_type: ["usdt_supplier", "cny_buyer"],
      treasury_currency: ["XAF", "USDT", "CNY"],
      treasury_ledger_entry_kind: [
        "usdt_purchase_debit_xaf",
        "usdt_purchase_credit_usdt",
        "usdt_sale_debit_usdt",
        "usdt_sale_credit_cny",
        "inventory_adjustment",
        "void",
      ],
      treasury_ledger_source_table: [
        "usdt_purchase",
        "usdt_sale",
        "inventory_snapshot",
        "manual_adjustment",
        "void",
      ],
      wallet_operation_type: ["deposit", "payment", "adjustment"],
    },
  },
} as const
