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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          created_at: string
          field_type: string
          form_id: string
          id: string
          label: string
          options: Json
          position: number
          required: boolean
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          field_type?: string
          form_id: string
          id?: string
          label: string
          options?: Json
          position?: number
          required?: boolean
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          field_type?: string
          form_id?: string
          id?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          converted_process_id: string | null
          converted_task_id: string | null
          created_at: string
          data: Json
          form_id: string
          id: string
          owner_id: string
          status: string
          submitter_name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          converted_process_id?: string | null
          converted_task_id?: string | null
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          owner_id: string
          status?: string
          submitter_name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          converted_process_id?: string | null
          converted_task_id?: string | null
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          owner_id?: string
          status?: string
          submitter_name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          is_published: boolean
          public_slug: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          public_slug?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          public_slug?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      process_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          dismissed_at: string | null
          due_date: string | null
          id: string
          notes: string
          position: number
          process_id: string
          started_at: string | null
          status: string
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          position?: number
          process_id: string
          started_at?: string | null
          status?: string
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          position?: number
          process_id?: string
          started_at?: string | null
          status?: string
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_steps: {
        Row: {
          created_at: string
          due_offset_days: number
          id: string
          position: number
          template_id: string
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          due_offset_days?: number
          id?: string
          position?: number
          template_id: string
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          due_offset_days?: number
          id?: string
          position?: number
          template_id?: string
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          name: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      processes: {
        Row: {
          client_name: string
          created_at: string
          due_date: string | null
          id: string
          name: string
          notes: string
          status: string
          template_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          client_name?: string
          created_at?: string
          due_date?: string | null
          id?: string
          name: string
          notes?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          due_date?: string | null
          id?: string
          name?: string
          notes?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          position: number
          start_time: string
          status: string
          task_date: string
          task_id: string | null
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          position?: number
          start_time: string
          status?: string
          task_date?: string
          task_id?: string | null
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          position?: number
          start_time?: string
          status?: string
          task_date?: string
          task_id?: string | null
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          notes: string
          position: number
          status: string
          task_id: string
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          notes?: string
          position?: number
          status?: string
          task_id: string
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          notes?: string
          position?: number
          status?: string
          task_id?: string
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          is_recurring: boolean
          notes: string
          parent_recurring_task_id: string | null
          position: number
          priority: string
          recurrence_end_date: string | null
          recurrence_interval: number
          recurrence_type: string | null
          source_id: string | null
          source_type: string
          status: string
          task_date: string
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string
          parent_recurring_task_id?: string | null
          position?: number
          priority?: string
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          task_date?: string
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string
          parent_recurring_task_id?: string | null
          position?: number
          priority?: string
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          task_date?: string
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          permissions: Json
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          permissions?: Json
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          permissions?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_permissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      form_fields_public: {
        Row: {
          field_type: string | null
          form_id: string | null
          id: string | null
          label: string | null
          options: Json | null
          position: number | null
          required: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms_public"
            referencedColumns: ["id"]
          },
        ]
      }
      forms_public: {
        Row: {
          description: string | null
          id: string | null
          is_published: boolean | null
          public_slug: string | null
          title: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          is_published?: boolean | null
          public_slug?: string | null
          title?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          is_published?: boolean | null
          public_slug?: string | null
          title?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      default_workspace_for: { Args: { _uid: string }; Returns: string }
      has_workspace_permission: {
        Args: { _action: string; _module: string; _uid: string; _ws: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _uid: string; _ws: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _uid: string; _ws: string }
        Returns: boolean
      }
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
  public: {
    Enums: {},
  },
} as const
