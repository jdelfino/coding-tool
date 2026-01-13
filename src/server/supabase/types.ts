export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      classes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          namespace_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          namespace_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          namespace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      namespaces: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      problems: {
        Row: {
          author_id: string
          class_id: string | null
          created_at: string
          description: string | null
          execution_settings: Json | null
          id: string
          namespace_id: string
          starter_code: string | null
          test_cases: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          class_id?: string | null
          created_at?: string
          description?: string | null
          execution_settings?: Json | null
          id?: string
          namespace_id: string
          starter_code?: string | null
          test_cases?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          class_id?: string | null
          created_at?: string
          description?: string | null
          execution_settings?: Json | null
          id?: string
          namespace_id?: string
          starter_code?: string | null
          test_cases?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problems_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      revisions: {
        Row: {
          base_revision_id: string | null
          diff: string | null
          execution_result: Json | null
          full_code: string | null
          id: string
          is_diff: boolean
          namespace_id: string
          session_id: string
          student_id: string
          timestamp: string
        }
        Insert: {
          base_revision_id?: string | null
          diff?: string | null
          execution_result?: Json | null
          full_code?: string | null
          id?: string
          is_diff?: boolean
          namespace_id: string
          session_id: string
          student_id: string
          timestamp?: string
        }
        Update: {
          base_revision_id?: string | null
          diff?: string | null
          execution_result?: Json | null
          full_code?: string | null
          id?: string
          is_diff?: boolean
          namespace_id?: string
          session_id?: string
          student_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisions_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisions_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "namespaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      section_memberships: {
        Row: {
          id: string
          joined_at: string
          role: string
          section_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role: string
          section_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          section_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_memberships_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          id: string
          instructor_ids: string[]
          join_code: string
          name: string
          namespace_id: string
          semester: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          id?: string
          instructor_ids?: string[]
          join_code: string
          name: string
          namespace_id: string
          semester?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          id?: string
          instructor_ids?: string[]
          join_code?: string
          name?: string
          namespace_id?: string
          semester?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sandboxes: {
        Row: {
          created_at: string
          sandbox_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          sandbox_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          sandbox_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_sandboxes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_students: {
        Row: {
          code: string
          execution_settings: Json | null
          id: string
          last_update: string
          name: string
          session_id: string
          student_id: string
          user_id: string | null
        }
        Insert: {
          code?: string
          execution_settings?: Json | null
          id?: string
          last_update?: string
          name: string
          session_id: string
          student_id: string
          user_id?: string | null
        }
        Update: {
          code?: string
          execution_settings?: Json | null
          id?: string
          last_update?: string
          name?: string
          session_id?: string
          student_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          creator_id: string
          ended_at: string | null
          featured_code: string | null
          featured_student_id: string | null
          id: string
          last_activity: string
          namespace_id: string
          participants: string[]
          problem: Json
          section_id: string
          section_name: string
          status: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          ended_at?: string | null
          featured_code?: string | null
          featured_student_id?: string | null
          id?: string
          last_activity?: string
          namespace_id: string
          participants?: string[]
          problem: Json
          section_id: string
          section_name: string
          status?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          ended_at?: string | null
          featured_code?: string | null
          featured_student_id?: string | null
          id?: string
          last_activity?: string
          namespace_id?: string
          participants?: string[]
          problem?: Json
          section_id?: string
          section_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "namespaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          last_login_at: string | null
          namespace_id: string | null
          role: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          last_login_at?: string | null
          namespace_id?: string | null
          role: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          namespace_id?: string | null
          role?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_namespace_id: { Args: never; Returns: string }
      has_role: { Args: { r: string }; Returns: boolean }
      is_instructor_or_higher: { Args: never; Returns: boolean }
      is_section_instructor: {
        Args: { section_id_param: string }
        Returns: boolean
      }
      is_section_member: {
        Args: { section_id_param: string }
        Returns: boolean
      }
      is_system_admin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

