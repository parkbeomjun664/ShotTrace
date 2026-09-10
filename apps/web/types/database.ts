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
      equipment: {
        Row: {
          equip_cd: string
          equip_name: string
          tonnage: number | null
        }
        Insert: {
          equip_cd: string
          equip_name: string
          tonnage?: number | null
        }
        Update: {
          equip_cd?: string
          equip_name?: string
          tonnage?: number | null
        }
        Relationships: []
      }
      product: {
        Row: {
          car_model: string | null
          part_name: string
          product_id: number
          side: string | null
        }
        Insert: {
          car_model?: string | null
          part_name: string
          product_id?: never
          side?: string | null
        }
        Update: {
          car_model?: string | null
          part_name?: string
          product_id?: never
          side?: string | null
        }
        Relationships: []
      }
      production_lot: {
        Row: {
          ended_at: string
          equip_cd: string
          fail_qty: number
          lot_id: string
          pass_qty: number
          plan_date: string
          product_id: number
          started_at: string
          total_qty: number
        }
        Insert: {
          ended_at: string
          equip_cd: string
          fail_qty: number
          lot_id: string
          pass_qty: number
          plan_date: string
          product_id: number
          started_at: string
          total_qty: number
        }
        Update: {
          ended_at?: string
          equip_cd?: string
          fail_qty?: number
          lot_id?: string
          pass_qty?: number
          plan_date?: string
          product_id?: number
          started_at?: string
          total_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_lot_equip_cd_fkey"
            columns: ["equip_cd"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["equip_cd"]
          },
          {
            foreignKeyName: "production_lot_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      shot: {
        Row: {
          average_back_pressure: number | null
          average_screw_rpm: number | null
          barrel_temperature_1: number | null
          barrel_temperature_2: number | null
          barrel_temperature_3: number | null
          barrel_temperature_4: number | null
          barrel_temperature_5: number | null
          barrel_temperature_6: number | null
          clamp_close_time: number | null
          clamp_open_position: number | null
          cushion_position: number | null
          cycle_time: number | null
          equipment_id: string
          filling_time: number | null
          hopper_temperature: number | null
          injection_time: number | null
          max_back_pressure: number | null
          max_injection_pressure: number | null
          max_injection_speed: number | null
          max_screw_rpm: number | null
          max_switch_over_pressure: number | null
          measured_at: string
          mold_temperature_3: number | null
          mold_temperature_4: number | null
          plasticizing_position: number | null
          plasticizing_time: number | null
        }
        Insert: {
          average_back_pressure?: number | null
          average_screw_rpm?: number | null
          barrel_temperature_1?: number | null
          barrel_temperature_2?: number | null
          barrel_temperature_3?: number | null
          barrel_temperature_4?: number | null
          barrel_temperature_5?: number | null
          barrel_temperature_6?: number | null
          clamp_close_time?: number | null
          clamp_open_position?: number | null
          cushion_position?: number | null
          cycle_time?: number | null
          equipment_id: string
          filling_time?: number | null
          hopper_temperature?: number | null
          injection_time?: number | null
          max_back_pressure?: number | null
          max_injection_pressure?: number | null
          max_injection_speed?: number | null
          max_screw_rpm?: number | null
          max_switch_over_pressure?: number | null
          measured_at: string
          mold_temperature_3?: number | null
          mold_temperature_4?: number | null
          plasticizing_position?: number | null
          plasticizing_time?: number | null
        }
        Update: {
          average_back_pressure?: number | null
          average_screw_rpm?: number | null
          barrel_temperature_1?: number | null
          barrel_temperature_2?: number | null
          barrel_temperature_3?: number | null
          barrel_temperature_4?: number | null
          barrel_temperature_5?: number | null
          barrel_temperature_6?: number | null
          clamp_close_time?: number | null
          clamp_open_position?: number | null
          cushion_position?: number | null
          cycle_time?: number | null
          equipment_id?: string
          filling_time?: number | null
          hopper_temperature?: number | null
          injection_time?: number | null
          max_back_pressure?: number | null
          max_injection_pressure?: number | null
          max_injection_speed?: number | null
          max_screw_rpm?: number | null
          max_switch_over_pressure?: number | null
          measured_at?: string
          mold_temperature_3?: number | null
          mold_temperature_4?: number | null
          plasticizing_position?: number | null
          plasticizing_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shot_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["equip_cd"]
          },
        ]
      }
      shot_part: {
        Row: {
          equipment_id: string
          fail_reason: string | null
          measured_at: string
          part_id: string
          part_serial: number | null
          pass_or_fail: string
          product_id: number
        }
        Insert: {
          equipment_id: string
          fail_reason?: string | null
          measured_at: string
          part_id: string
          part_serial?: number | null
          pass_or_fail: string
          product_id: number
        }
        Update: {
          equipment_id?: string
          fail_reason?: string | null
          measured_at?: string
          part_id?: string
          part_serial?: number | null
          pass_or_fail?: string
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "shot_part_equipment_id_measured_at_fkey"
            columns: ["equipment_id", "measured_at"]
            isOneToOne: false
            referencedRelation: "shot"
            referencedColumns: ["equipment_id", "measured_at"]
          },
          {
            foreignKeyName: "shot_part_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["product_id"]
          },
        ]
      }
    }
    Views: {
      daily_yield: {
        Row: {
          fail_qty: number | null
          pass_qty: number | null
          plan_date: string | null
          total_qty: number | null
          yield_pct: number | null
        }
        Relationships: []
      }
      defect_pareto: {
        Row: {
          fail_qty: number | null
          fail_reason: string | null
          share_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
