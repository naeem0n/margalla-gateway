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
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      apartments: {
        Row: {
          area_sqft: number | null
          bedrooms: number | null
          created_at: string | null
          description: string | null
          floor: number | null
          id: string
          media_urls: Json
          notes: string | null
          number: string
          rent: number
          status: string
          tenant_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          area_sqft?: number | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          media_urls?: Json
          notes?: string | null
          number: string
          rent?: number
          status?: string
          tenant_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          area_sqft?: number | null
          bedrooms?: number | null
          created_at?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          media_urls?: Json
          notes?: string | null
          number?: string
          rent?: number
          status?: string
          tenant_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments_public: {
        Row: {
          area_sqft: number | null
          bedrooms: number | null
          description: string | null
          floor: number | null
          id: string
          media_urls: Json
          number: string
          rent: number
          status: string
          type: string | null
        }
        Insert: {
          area_sqft?: number | null
          bedrooms?: number | null
          description?: string | null
          floor?: number | null
          id: string
          media_urls?: Json
          number: string
          rent?: number
          status: string
          type?: string | null
        }
        Update: {
          area_sqft?: number | null
          bedrooms?: number | null
          description?: string | null
          floor?: number | null
          id?: string
          media_urls?: Json
          number?: string
          rent?: number
          status?: string
          type?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          normal_balance: string
          parent_code: string | null
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normal_balance: string
          parent_code?: string | null
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normal_balance?: string
          parent_code?: string | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          apartment_no: string | null
          assigned_to: string | null
          category: string
          created_at: string | null
          description: string | null
          expense_entry_id: string | null
          id: string
          maintenance_cost: number | null
          priority: string
          resident_id: string | null
          resolution: string | null
          resolved_at: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          apartment_no?: string | null
          assigned_to?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          expense_entry_id?: string | null
          id?: string
          maintenance_cost?: number | null
          priority?: string
          resident_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          apartment_no?: string | null
          assigned_to?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          expense_entry_id?: string | null
          id?: string
          maintenance_cost?: number | null
          priority?: string
          resident_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_bookings: {
        Row: {
          apartment_no: string
          check_in_date: string
          check_in_time: string
          check_out_date: string
          check_out_time: string
          created_at: string
          created_by: string | null
          extra_parking_spots: number
          guest_name: string
          guest_phone: string | null
          id: string
          nights: number
          notes: string | null
          parking_charge_per_day: number
          rate_per_night: number
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          apartment_no: string
          check_in_date: string
          check_in_time?: string
          check_out_date: string
          check_out_time?: string
          created_at?: string
          created_by?: string | null
          extra_parking_spots?: number
          guest_name: string
          guest_phone?: string | null
          id?: string
          nights?: number
          notes?: string | null
          parking_charge_per_day?: number
          rate_per_night?: number
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          apartment_no?: string
          check_in_date?: string
          check_in_time?: string
          check_out_date?: string
          check_out_time?: string
          created_at?: string
          created_by?: string | null
          extra_parking_spots?: number
          guest_name?: string
          guest_phone?: string | null
          id?: string
          nights?: number
          notes?: string | null
          parking_charge_per_day?: number
          rate_per_night?: number
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string | null
          doc_type: string | null
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          owner_id: string | null
          owner_type: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          owner_id?: string | null
          owner_type: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          owner_id?: string | null
          owner_type?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount: number
          balance_after: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          receipt_url: string | null
          resident_id: string | null
          type: Database["public"]["Enums"]["finance_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          balance_after?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          receipt_url?: string | null
          resident_id?: string | null
          type: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          receipt_url?: string | null
          resident_id?: string | null
          type?: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          reference: string | null
          source_id: string | null
          source_table: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          reference?: string | null
          source_id?: string | null
          source_table?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          reference?: string | null
          source_id?: string | null
          source_table?: string | null
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_code: string
          created_at: string
          credit: number
          debit: number
          id: string
          journal_id: string
          memo: string | null
        }
        Insert: {
          account_code: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_id: string
          memo?: string | null
        }
        Update: {
          account_code?: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          journal_id?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          account_label: string | null
          account_type: string
          category: string | null
          created_at: string | null
          created_by: string | null
          credit: number
          debit: number
          description: string
          entry_date: string
          id: string
          reference: string | null
        }
        Insert: {
          account_id: string
          account_label?: string | null
          account_type: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          credit?: number
          debit?: number
          description: string
          entry_date?: string
          id?: string
          reference?: string | null
        }
        Update: {
          account_id?: string
          account_label?: string | null
          account_type?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          credit?: number
          debit?: number
          description?: string
          entry_date?: string
          id?: string
          reference?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          body: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          recipient_phone: string
          recipient_user_id: string | null
          reference_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_key: string | null
          trigger_type: string | null
          triggered_by: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_phone: string
          recipient_user_id?: string | null
          reference_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
          trigger_type?: string | null
          triggered_by?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_phone?: string
          recipient_user_id?: string | null
          reference_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
          trigger_type?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          subject: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          subject?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          subject?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      parking_slots: {
        Row: {
          apartment_id: string | null
          created_at: string | null
          id: string
          monthly_fee: number | null
          owner_name: string | null
          slot_no: string
          status: string
          vehicle_no: string | null
          vehicle_type: string | null
        }
        Insert: {
          apartment_id?: string | null
          created_at?: string | null
          id?: string
          monthly_fee?: number | null
          owner_name?: string | null
          slot_no: string
          status?: string
          vehicle_no?: string | null
          vehicle_type?: string | null
        }
        Update: {
          apartment_id?: string | null
          created_at?: string | null
          id?: string
          monthly_fee?: number | null
          owner_name?: string | null
          slot_no?: string
          status?: string
          vehicle_no?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_slots_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          amount: number
          apartment_no: string | null
          bill_type: string | null
          category: string | null
          type: string | null
          created_by: string | null
          created_at: string
          due_date: string | null
          finance_entry_id: string | null
          id: string
          method: string
          note: string | null
          receipt_path: string | null
          reference: string | null
          resident_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          apartment_no?: string | null
          bill_type?: string | null
          category?: string | null
          type?: string | null
          created_by?: string | null
          created_at?: string
          due_date?: string | null
          finance_entry_id?: string | null
          id?: string
          method?: string
          note?: string | null
          receipt_path?: string | null
          reference?: string | null
          resident_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          apartment_no?: string | null
          bill_type?: string | null
          category?: string | null
          type?: string | null
          created_by?: string | null
          created_at?: string
          due_date?: string | null
          finance_entry_id?: string | null
          id?: string
          method?: string
          note?: string | null
          receipt_path?: string | null
          reference?: string | null
          resident_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agreement_url: string | null
          apartment_no: string | null
          client_id: string | null
          cnic: string | null
          created_at: string
          email: string | null
          extra_parking_spots: number
          full_name: string | null
          id: string
          is_approved: boolean
          phone: string | null
          rent_amount: number
          reward_points: number
          security_deposit: number
          warning_count: number
          gas_units: number | null
          water_units: number | null
          electricity_units: number | null
          fixed_maintenance: number | null
          outstanding_balance: number | null
          last_billing_date: string | null
        }
        Insert: {
          agreement_url?: string | null
          apartment_no?: string | null
          client_id?: string | null
          cnic?: string | null
          created_at?: string
          email?: string | null
          extra_parking_spots?: number
          full_name?: string | null
          id: string
          is_approved?: boolean
          phone?: string | null
          rent_amount?: number
          reward_points?: number
          security_deposit?: number
          warning_count?: number
          gas_units?: number | null
          water_units?: number | null
          electricity_units?: number | null
          fixed_maintenance?: number | null
          outstanding_balance?: number | null
          last_billing_date?: string | null
        }
        Update: {
          agreement_url?: string | null
          apartment_no?: string | null
          client_id?: string | null
          cnic?: string | null
          created_at?: string
          email?: string | null
          extra_parking_spots?: number
          full_name?: string | null
          id?: string
          is_approved?: boolean
          phone?: string | null
          rent_amount?: number
          reward_points?: number
          security_deposit?: number
          warning_count?: number
          gas_units?: number | null
          water_units?: number | null
          electricity_units?: number | null
          fixed_maintenance?: number | null
          outstanding_balance?: number | null
          last_billing_date?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          advance_balance: number
          cnic: string | null
          created_at: string | null
          duty_end: string | null
          duty_start: string | null
          full_name: string
          id: string
          join_date: string | null
          notes: string | null
          phone: string | null
          role: string
          salary: number
          status: string
          updated_at: string | null
        }
        Insert: {
          advance_balance?: number
          cnic?: string | null
          created_at?: string | null
          duty_end?: string | null
          duty_start?: string | null
          full_name: string
          id?: string
          join_date?: string | null
          notes?: string | null
          phone?: string | null
          role: string
          salary?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          advance_balance?: number
          cnic?: string | null
          created_at?: string | null
          duty_end?: string | null
          duty_start?: string | null
          full_name?: string
          id?: string
          join_date?: string | null
          notes?: string | null
          phone?: string | null
          role?: string
          salary?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      staff_advances: {
        Row: {
          amount: number
          created_at: string
          finance_entry_id: string | null
          given_at: string
          given_by: string | null
          id: string
          notes: string | null
          staff_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          finance_entry_id?: string | null
          given_at?: string
          given_by?: string | null
          id?: string
          notes?: string | null
          staff_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          finance_entry_id?: string | null
          given_at?: string
          given_by?: string | null
          id?: string
          notes?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_advances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salary_payments: {
        Row: {
          advance_deducted: number
          created_at: string
          finance_entry_id: string | null
          gross_salary: number
          id: string
          net_paid: number
          notes: string | null
          paid_at: string
          paid_by: string | null
          period_month: string
          staff_id: string
        }
        Insert: {
          advance_deducted?: number
          created_at?: string
          finance_entry_id?: string | null
          gross_salary?: number
          id?: string
          net_paid?: number
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          period_month: string
          staff_id: string
        }
        Update: {
          advance_deducted?: number
          created_at?: string
          finance_entry_id?: string | null
          gross_salary?: number
          id?: string
          net_paid?: number
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          period_month?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salary_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          apartment_no: string | null
          cnic: string | null
          created_at: string | null
          host_name: string | null
          id: string
          in_time: string | null
          out_time: string | null
          phone: string | null
          purpose: string | null
          vehicle_no: string | null
          visitor_name: string
        }
        Insert: {
          apartment_no?: string | null
          cnic?: string | null
          created_at?: string | null
          host_name?: string | null
          id?: string
          in_time?: string | null
          out_time?: string | null
          phone?: string | null
          purpose?: string | null
          vehicle_no?: string | null
          visitor_name: string
        }
        Update: {
          apartment_no?: string | null
          cnic?: string | null
          created_at?: string | null
          host_name?: string | null
          id?: string
          in_time?: string | null
          out_time?: string | null
          phone?: string | null
          purpose?: string | null
          vehicle_no?: string | null
          visitor_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_payment_request: { Args: { _id: string }; Returns: string }
      fn_balance_sheet: {
        Args: { _as_of: string }
        Returns: {
          account_type: string
          amount: number
          code: string
          name: string
        }[]
      }
      fn_map_category_to_account: {
        Args: { _category: string; _type: string }
        Returns: string
      }
      fn_profit_loss: {
        Args: { _from: string; _to: string }
        Returns: {
          account_type: string
          amount: number
          code: string
          name: string
        }[]
      }
      fn_trial_balance: {
        Args: { _from: string; _to: string }
        Returns: {
          account_type: string
          balance: number
          code: string
          name: string
          normal_balance: string
          total_credit: number
          total_debit: number
        }[]
      }
      generate_client_id: { Args: { _prefix: string }; Returns: string }
      give_staff_advance: {
        Args: { _amount: number; _notes?: string; _staff_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pay_staff_salary: {
        Args: { _gross?: number; _period?: string; _staff_id: string }
        Returns: string
      }
      update_resident_stats: {
        Args: { p_change: number; uid: string; w_change: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "resident" | "partner"
      booking_status: "booked" | "checked_in" | "checked_out" | "cancelled"
      finance_type: "credit" | "debit"
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
      app_role: ["admin", "staff", "resident", "partner"],
      booking_status: ["booked", "checked_in", "checked_out", "cancelled"],
      finance_type: ["credit", "debit"],
    },
  },
} as const
