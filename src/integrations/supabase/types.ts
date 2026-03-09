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
          last_notified_at: string | null
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
          last_notified_at?: string | null
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
          last_notified_at?: string | null
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
      crowd_pattern_weekly: {
        Row: {
          area_name: string
          avg_wait_time_minutes: number | null
          busiest_day_parts: string[] | null
          created_at: string
          id: string
          most_common_crowd_level: string | null
          park_slug: string
          peak_crowd_hours_top3: number[] | null
          reports_count: number
          week_start: string
        }
        Insert: {
          area_name: string
          avg_wait_time_minutes?: number | null
          busiest_day_parts?: string[] | null
          created_at?: string
          id?: string
          most_common_crowd_level?: string | null
          park_slug: string
          peak_crowd_hours_top3?: number[] | null
          reports_count?: number
          week_start: string
        }
        Update: {
          area_name?: string
          avg_wait_time_minutes?: number | null
          busiest_day_parts?: string[] | null
          created_at?: string
          id?: string
          most_common_crowd_level?: string | null
          park_slug?: string
          peak_crowd_hours_top3?: number[] | null
          reports_count?: number
          week_start?: string
        }
        Relationships: []
      }
      crowd_report_events: {
        Row: {
          area_name: string
          crowd_level: Database["public"]["Enums"]["crowd_level"]
          id: string
          park_slug: string
          report_fingerprint: string
          reported_at: string
          user_id: string
          wait_time_minutes: number | null
        }
        Insert: {
          area_name: string
          crowd_level: Database["public"]["Enums"]["crowd_level"]
          id?: string
          park_slug: string
          report_fingerprint: string
          reported_at?: string
          user_id: string
          wait_time_minutes?: number | null
        }
        Update: {
          area_name?: string
          crowd_level?: Database["public"]["Enums"]["crowd_level"]
          id?: string
          park_slug?: string
          report_fingerprint?: string
          reported_at?: string
          user_id?: string
          wait_time_minutes?: number | null
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
      email_tracking: {
        Row: {
          created_at: string
          email_log_id: string | null
          event_type: string
          id: string
          ip_address: string | null
          link_url: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_log_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_log_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          available_dates: string[]
          channel: string
          created_at: string
          error_message: string | null
          id: string
          latency_seconds: number | null
          location_name: string | null
          max_retries: number
          next_retry_at: string | null
          park_id: string
          permit_name: string
          retry_count: number
          status: string
          user_id: string
          watch_id: string
        }
        Insert: {
          available_dates?: string[]
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          latency_seconds?: number | null
          location_name?: string | null
          max_retries?: number
          next_retry_at?: string | null
          park_id: string
          permit_name: string
          retry_count?: number
          status?: string
          user_id: string
          watch_id: string
        }
        Update: {
          available_dates?: string[]
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          latency_seconds?: number | null
          location_name?: string | null
          max_retries?: number
          next_retry_at?: string | null
          park_id?: string
          permit_name?: string
          retry_count?: number
          status?: string
          user_id?: string
          watch_id?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number
          available_dates: string[]
          created_at: string
          error_message: string | null
          id: string
          park_id: string
          permit_name: string
          processed_at: string | null
          status: string
          user_id: string
          watch_id: string
        }
        Insert: {
          attempts?: number
          available_dates?: string[]
          created_at?: string
          error_message?: string | null
          id?: string
          park_id: string
          permit_name: string
          processed_at?: string | null
          status?: string
          user_id: string
          watch_id: string
        }
        Update: {
          attempts?: number
          available_dates?: string[]
          created_at?: string
          error_message?: string | null
          id?: string
          park_id?: string
          permit_name?: string
          processed_at?: string | null
          status?: string
          user_id?: string
          watch_id?: string
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
      park_crowd_forecasts: {
        Row: {
          building_time: string
          created_at: string
          day_type: string
          evening_quiet: string
          id: string
          location_name: string
          notes: string | null
          park_id: string
          peak_end: string
          peak_start: string
          quiet_end: string
          quiet_start: string
          season: string
        }
        Insert: {
          building_time: string
          created_at?: string
          day_type?: string
          evening_quiet: string
          id?: string
          location_name: string
          notes?: string | null
          park_id: string
          peak_end: string
          peak_start: string
          quiet_end: string
          quiet_start: string
          season?: string
        }
        Update: {
          building_time?: string
          created_at?: string
          day_type?: string
          evening_quiet?: string
          id?: string
          location_name?: string
          notes?: string | null
          park_id?: string
          peak_end?: string
          peak_start?: string
          quiet_end?: string
          quiet_start?: string
          season?: string
        }
        Relationships: []
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
      permit_availability: {
        Row: {
          available_spots: number
          date: string
          id: string
          last_checked: string
          park_code: string
          permit_type: string
        }
        Insert: {
          available_spots?: number
          date: string
          id?: string
          last_checked?: string
          park_code: string
          permit_type: string
        }
        Update: {
          available_spots?: number
          date?: string
          id?: string
          last_checked?: string
          park_code?: string
          permit_type?: string
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
      permit_pattern_weekly: {
        Row: {
          alert_success_rate: number | null
          avg_alert_latency_seconds: number | null
          created_at: string
          detections_count: number
          id: string
          median_detection_hour_local: number | null
          park_slug: string
          peak_days_top2: number[] | null
          peak_hours_top3: number[] | null
          permit_type: string
          top_locations: string[] | null
          week_start: string
        }
        Insert: {
          alert_success_rate?: number | null
          avg_alert_latency_seconds?: number | null
          created_at?: string
          detections_count?: number
          id?: string
          median_detection_hour_local?: number | null
          park_slug: string
          peak_days_top2?: number[] | null
          peak_hours_top3?: number[] | null
          permit_type: string
          top_locations?: string[] | null
          week_start: string
        }
        Update: {
          alert_success_rate?: number | null
          avg_alert_latency_seconds?: number | null
          created_at?: string
          detections_count?: number
          id?: string
          median_detection_hour_local?: number | null
          park_slug?: string
          peak_days_top2?: number[] | null
          peak_hours_top3?: number[] | null
          permit_type?: string
          top_locations?: string[] | null
          week_start?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          phone_number: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone_number: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone_number?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      pro_nudge_emails: {
        Row: {
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          sent_at?: string
          user_id?: string
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
          notify_email: boolean
          notify_sms: boolean
          onboarded_at: string | null
          onboarding_step_reached: number
          phone_number: string | null
          phone_verified: boolean
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          onboarded_at?: string | null
          onboarding_step_reached?: number
          phone_number?: string | null
          phone_verified?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          onboarded_at?: string | null
          onboarding_step_reached?: number
          phone_number?: string | null
          phone_verified?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recent_finds: {
        Row: {
          available_count: number | null
          available_dates: string[] | null
          event_fingerprint: string | null
          found_at: string
          found_date: string
          id: string
          location_name: string
          park_id: string
          permit_name: string
          source: string
        }
        Insert: {
          available_count?: number | null
          available_dates?: string[] | null
          event_fingerprint?: string | null
          found_at?: string
          found_date?: string
          id?: string
          location_name?: string
          park_id: string
          permit_name: string
          source?: string
        }
        Update: {
          available_count?: number | null
          available_dates?: string[] | null
          event_fingerprint?: string | null
          found_at?: string
          found_date?: string
          id?: string
          location_name?: string
          park_id?: string
          permit_name?: string
          source?: string
        }
        Relationships: []
      }
      scan_targets: {
        Row: {
          created_at: string
          date_window_end: string | null
          date_window_start: string | null
          id: string
          last_checked_at: string | null
          next_check_at: string | null
          orphaned_at: string | null
          park_id: string
          permit_type: string
          scan_priority: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_window_end?: string | null
          date_window_start?: string | null
          id?: string
          last_checked_at?: string | null
          next_check_at?: string | null
          orphaned_at?: string | null
          park_id: string
          permit_type: string
          scan_priority?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_window_end?: string | null
          date_window_start?: string | null
          id?: string
          last_checked_at?: string | null
          next_check_at?: string | null
          orphaned_at?: string | null
          park_id?: string
          permit_type?: string
          scan_priority?: number
          status?: string
          updated_at?: string
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
      user_watchers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_notified_at: string | null
          notify_sms: boolean
          scan_target_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          notify_sms?: boolean
          scan_target_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          notify_sms?: boolean
          scan_target_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_watchers_scan_target_id_fkey"
            columns: ["scan_target_id"]
            isOneToOne: false
            referencedRelation: "scan_targets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crowd_reports_public: {
        Row: {
          area_name: string | null
          crowd_level: Database["public"]["Enums"]["crowd_level"] | null
          id: string | null
          park_slug: string | null
          reported_at: string | null
          wait_time_minutes: number | null
        }
        Insert: {
          area_name?: string | null
          crowd_level?: Database["public"]["Enums"]["crowd_level"] | null
          id?: string | null
          park_slug?: string | null
          reported_at?: string | null
          wait_time_minutes?: number | null
        }
        Update: {
          area_name?: string | null
          crowd_level?: Database["public"]["Enums"]["crowd_level"] | null
          id?: string | null
          park_slug?: string | null
          reported_at?: string | null
          wait_time_minutes?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_or_join_watch: {
        Args: {
          p_date_window_end?: string
          p_date_window_start?: string
          p_park_id: string
          p_permit_name: string
          p_user_id: string
        }
        Returns: string
      }
      get_cron_secret: { Args: never; Returns: string }
      get_crowd_insights: { Args: { p_park_slug: string }; Returns: Json }
      get_is_pro: { Args: { _user_id: string }; Returns: boolean }
      get_landing_stats: { Args: never; Returns: Json }
      get_permit_availability: {
        Args: { p_park_code: string }
        Returns: {
          available_spots: number
          date: string
          id: string
          last_checked: string
          park_code: string
          permit_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "permit_availability"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_permit_insights: {
        Args: { p_park_slug: string; p_permit_type: string }
        Returns: Json
      }
      get_profile_protected_fields: {
        Args: { _user_id: string }
        Returns: {
          onboarded_at: string
          onboarding_step_reached: number
          phone_verified: boolean
          stripe_customer_id: string
        }[]
      }
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
      crowd_level: "Quiet" | "Manageable" | "Busy" | "Packed"
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
      crowd_level: ["Quiet", "Manageable", "Busy", "Packed"],
    },
  },
} as const
