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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_actions: {
        Row: {
          action_type: string
          confidence: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          payload: Json
          reasoning: string
          reservation_id: string | null
          status: Database["public"]["Enums"]["ai_action_status"]
          summary: string
        }
        Insert: {
          action_type: string
          confidence?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          reasoning?: string
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["ai_action_status"]
          summary: string
        }
        Update: {
          action_type?: string
          confidence?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          payload?: Json
          reasoning?: string
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["ai_action_status"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          actor_label: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_label?: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_label?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      guest_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_chat_sessions: {
        Row: {
          created_at: string
          guest_label: string
          id: string
          last_message_at: string
          reference: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_label?: string
          id?: string
          last_message_at?: string
          reference?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_label?: string
          id?: string
          last_message_at?: string
          reference?: string
          updated_at?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_vip: boolean
          loyalty_tier: string
          nationality: string | null
          notes: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_vip?: boolean
          loyalty_tier?: string
          nationality?: string | null
          notes?: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_vip?: boolean
          loyalty_tier?: string
          nationality?: string | null
          notes?: string
          phone?: string | null
        }
        Relationships: []
      }
      housekeeping_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          notes: string
          priority: number
          room_id: string
          status: Database["public"]["Enums"]["task_status"]
          task_type: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string
          priority?: number
          room_id: string
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string
          priority?: number
          room_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          job_title: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          job_title?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          job_title?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          adults: number
          balance_due: number
          channel: string
          check_in: string
          check_out: string
          children: number
          created_at: string
          created_by: string | null
          guest_id: string
          id: string
          nightly_rate: number
          reference: string
          room_id: string | null
          room_type_id: string
          special_requests: string
          status: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          adults?: number
          balance_due?: number
          channel?: string
          check_in: string
          check_out: string
          children?: number
          created_at?: string
          created_by?: string | null
          guest_id: string
          id?: string
          nightly_rate?: number
          reference?: string
          room_id?: string | null
          room_type_id: string
          special_requests?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          adults?: number
          balance_due?: number
          channel?: string
          check_in?: string
          check_out?: string
          children?: number
          created_at?: string
          created_by?: string | null
          guest_id?: string
          id?: string
          nightly_rate?: number
          reference?: string
          room_id?: string | null
          room_type_id?: string
          special_requests?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          amenities: string[]
          base_rate: number
          code: string
          created_at: string
          description: string
          id: string
          max_occupancy: number
          name: string
        }
        Insert: {
          amenities?: string[]
          base_rate?: number
          code: string
          created_at?: string
          description?: string
          id?: string
          max_occupancy?: number
          name: string
        }
        Update: {
          amenities?: string[]
          base_rate?: number
          code?: string
          created_at?: string
          description?: string
          id?: string
          max_occupancy?: number
          name?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          condition: Database["public"]["Enums"]["room_condition"]
          created_at: string
          floor: number
          id: string
          is_active: boolean
          notes: string
          room_number: string
          room_type_id: string
        }
        Insert: {
          condition?: Database["public"]["Enums"]["room_condition"]
          created_at?: string
          floor?: number
          id?: string
          is_active?: boolean
          notes?: string
          room_number: string
          room_type_id: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["room_condition"]
          created_at?: string
          floor?: number
          id?: string
          is_active?: boolean
          notes?: string
          room_number?: string
          room_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_action_status: "proposed" | "approved" | "rejected" | "executed"
      app_role:
        | "admin"
        | "front_desk_manager"
        | "receptionist"
        | "housekeeping"
        | "maintenance"
        | "finance"
      reservation_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      room_condition: "clean" | "dirty" | "inspected" | "out_of_order"
      task_status: "pending" | "in_progress" | "completed" | "blocked"
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
      ai_action_status: ["proposed", "approved", "rejected", "executed"],
      app_role: [
        "admin",
        "front_desk_manager",
        "receptionist",
        "housekeeping",
        "maintenance",
        "finance",
      ],
      reservation_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      room_condition: ["clean", "dirty", "inspected", "out_of_order"],
      task_status: ["pending", "in_progress", "completed", "blocked"],
    },
  },
} as const
