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
      active_watches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notify_sms: boolean
          park_id: string
          permit_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_sms?: boolean
          park_id?: string
          permit_name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_sms?: boolean
          park_id?: string
          permit_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_health_log: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          status: string
        }
        Insert: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          status?: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          status?: string
        }
        Relationships: []
      }
      park_alerts: {
        Row: {
          category: string
          description: string | null
          fetched_at: string
          id: string
          last_updated: string
          nps_alert_id: string
          park_id: string
          title: string
          url: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          fetched_at?: string
          id?: string
          last_updated?: string
          nps_alert_id: string
          park_id: string
          title: string
          url?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          fetched_at?: string
          id?: string
          last_updated?: string
          nps_alert_id?: string
          park_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "park_alerts_park_id_fkey"
            columns: ["park_id"]
            isOneToOne: false
            referencedRelation: "parks"
            referencedColumns: ["id"]
          },
        ]
      }
      park_permits: {
        Row: {
          api_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          park_id: string
          recgov_permit_id: string | null
          season_end: string | null
          season_start: string | null
          total_finds: number
        }
        Insert: {
          api_type?: string
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          park_id: string
          recgov_permit_id?: string | null
          season_end?: string | null
          season_start?: string | null
          total_finds?: number
        }
        Update: {
          api_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          park_id?: string
          recgov_permit_id?: string | null
          season_end?: string | null
          season_start?: string | null
          total_finds?: number
        }
        Relationships: [
          {
            foreignKeyName: "park_permits_park_id_fkey"
            columns: ["park_id"]
            isOneToOne: false
            referencedRelation: "parks"
            referencedColumns: ["id"]
          },
        ]
      }
      parks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          nps_code: string | null
          region: string
          timezone: string
          weather_lat: number | null
          weather_lon: number | null
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          nps_code?: string | null
          region: string
          timezone?: string
          weather_lat?: number | null
          weather_lon?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          nps_code?: string | null
          region?: string
          timezone?: string
          weather_lat?: number | null
          weather_lon?: number | null
        }
        Relationships: []
      }
      permit_cache: {
        Row: {
          api_type: string
          available: boolean
          available_dates: string[]
          cache_key: string
          error_count: number
          expires_at: string
          fetched_at: string
          id: string
          last_error: string | null
          last_status_code: number | null
          recgov_id: string
          stale_at: string
        }
        Insert: {
          api_type?: string
          available?: boolean
          available_dates?: string[]
          cache_key: string
          error_count?: number
          expires_at?: string
          fetched_at?: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          recgov_id: string
          stale_at?: string
        }
        Update: {
          api_type?: string
          available?: boolean
          available_dates?: string[]
          cache_key?: string
          error_count?: number
          expires_at?: string
          fetched_at?: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          recgov_id?: string
          stale_at?: string
        }
        Relationships: []
      }
      pro_waitlist: {
        Row: {
          email: string
          id: string
          signup_date: string
          user_id: string
        }
        Insert: {
          email: string
          id?: string
          signup_date?: string
          user_id: string
        }
        Update: {
          email?: string
          id?: string
          signup_date?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_pro: boolean
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro?: boolean
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro?: boolean
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recent_finds: {
        Row: {
          available_dates: string[] | null
          found_at: string
          id: string
          park_id: string
          permit_name: string
        }
        Insert: {
          available_dates?: string[] | null
          found_at?: string
          id?: string
          park_id: string
          permit_name: string
        }
        Update: {
          available_dates?: string[] | null
          found_at?: string
          id?: string
          park_id?: string
          permit_name?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_permit_finds: {
        Args: { p_park_id: string; p_permit_name: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
