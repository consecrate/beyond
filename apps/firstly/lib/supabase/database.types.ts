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
    PostgrestVersion: "14.4"
  }
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
      lesson_edges: {
        Row: {
          created_at: string
          edge_status: string
          from_node_id: string
          graph_id: string
          id: string
          lesson_id: string
          to_node_id: string
        }
        Insert: {
          created_at?: string
          edge_status?: string
          from_node_id: string
          graph_id: string
          id?: string
          lesson_id: string
          to_node_id: string
        }
        Update: {
          created_at?: string
          edge_status?: string
          from_node_id?: string
          graph_id?: string
          id?: string
          lesson_id?: string
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_edges_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "lesson_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_edges_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_graphs: {
        Row: {
          created_at: string
          generation_reason: string
          graph_metadata: Json
          id: string
          lesson_id: string
          source_summary: Json
          status: string
        }
        Insert: {
          created_at?: string
          generation_reason: string
          graph_metadata?: Json
          id?: string
          lesson_id: string
          source_summary?: Json
          status?: string
        }
        Update: {
          created_at?: string
          generation_reason?: string
          graph_metadata?: Json
          id?: string
          lesson_id?: string
          source_summary?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_graphs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_inputs: {
        Row: {
          created_at: string
          id: string
          input_type: string
          lesson_id: string
          raw_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_type: string
          lesson_id: string
          raw_text: string
        }
        Update: {
          created_at?: string
          id?: string
          input_type?: string
          lesson_id?: string
          raw_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_inputs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_nodes: {
        Row: {
          canonical_skill_candidate_key: string | null
          created_at: string
          display_order_hint: number | null
          domain_tags: string[]
          future_transfer_metadata: Json
          graph_id: string
          id: string
          lesson_id: string
          node_kind: string
          node_status: string
          slug: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canonical_skill_candidate_key?: string | null
          created_at?: string
          display_order_hint?: number | null
          domain_tags?: string[]
          future_transfer_metadata?: Json
          graph_id: string
          id?: string
          lesson_id: string
          node_kind?: string
          node_status?: string
          slug?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canonical_skill_candidate_key?: string | null
          created_at?: string
          display_order_hint?: number | null
          domain_tags?: string[]
          future_transfer_metadata?: Json
          graph_id?: string
          id?: string
          lesson_id?: string
          node_kind?: string
          node_status?: string
          slug?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_nodes_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "lesson_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_nodes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          entry_mode: string
          future_graph_mode: string
          goal_text: string | null
          id: string
          lesson_markdown: string | null
          session_id: string
          status: string
          structured_lesson_json: Json | null
          subject_domain: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_mode: string
          future_graph_mode?: string
          goal_text?: string | null
          id?: string
          lesson_markdown?: string | null
          session_id: string
          status?: string
          structured_lesson_json?: Json | null
          subject_domain?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_mode?: string
          future_graph_mode?: string
          goal_text?: string | null
          id?: string
          lesson_markdown?: string | null
          session_id?: string
          status?: string
          structured_lesson_json?: Json | null
          subject_domain?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      node_lessons: {
        Row: {
          content_status: string
          created_at: string
          generator_metadata: Json
          id: string
          intro_markdown: string
          lesson_id: string
          node_id: string
          progression_markdown: string | null
          updated_at: string
          worked_example_markdown: string
        }
        Insert: {
          content_status?: string
          created_at?: string
          generator_metadata?: Json
          id?: string
          intro_markdown: string
          lesson_id: string
          node_id: string
          progression_markdown?: string | null
          updated_at?: string
          worked_example_markdown: string
        }
        Update: {
          content_status?: string
          created_at?: string
          generator_metadata?: Json
          id?: string
          intro_markdown?: string
          lesson_id?: string
          node_id?: string
          progression_markdown?: string | null
          updated_at?: string
          worked_example_markdown?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_lessons_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      node_progress: {
        Row: {
          correct_attempts: number
          first_completed_at: string | null
          lesson_id: string
          lesson_opened_at: string | null
          mastery_state: string
          node_id: string
          total_attempts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_attempts?: number
          first_completed_at?: string | null
          lesson_id: string
          lesson_opened_at?: string | null
          mastery_state?: string
          node_id: string
          total_attempts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_attempts?: number
          first_completed_at?: string | null
          lesson_id?: string
          lesson_opened_at?: string | null
          mastery_state?: string
          node_id?: string
          total_attempts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_progress_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          id: string
          is_correct: boolean
          lesson_id: string
          node_id: string
          practice_problem_id: string
          submitted_answer: Json
          submitted_at: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          id?: string
          is_correct: boolean
          lesson_id: string
          node_id: string
          practice_problem_id: string
          submitted_answer: Json
          submitted_at?: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          lesson_id?: string
          node_id?: string
          practice_problem_id?: string
          submitted_answer?: Json
          submitted_at?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_attempts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_attempts_practice_problem_id_fkey"
            columns: ["practice_problem_id"]
            isOneToOne: false
            referencedRelation: "practice_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_problems: {
        Row: {
          canonical_answer: Json | null
          correct_option_index: number | null
          created_at: string
          difficulty: string | null
          family_key: string | null
          generation_round: number
          id: string
          lesson_id: string
          metadata: Json
          node_id: string
          options: Json | null
          problem_format: string
          prompt_markdown: string
          solver_code: string | null
          solver_inputs: Json
          solver_language: string
          solver_outputs: Json
          worked_solution_markdown: string
        }
        Insert: {
          canonical_answer?: Json | null
          correct_option_index?: number | null
          created_at?: string
          difficulty?: string | null
          family_key?: string | null
          generation_round?: number
          id?: string
          lesson_id: string
          metadata?: Json
          node_id: string
          options?: Json | null
          problem_format: string
          prompt_markdown: string
          solver_code?: string | null
          solver_inputs?: Json
          solver_language?: string
          solver_outputs?: Json
          worked_solution_markdown: string
        }
        Update: {
          canonical_answer?: Json | null
          correct_option_index?: number | null
          created_at?: string
          difficulty?: string | null
          family_key?: string | null
          generation_round?: number
          id?: string
          lesson_id?: string
          metadata?: Json
          node_id?: string
          options?: Json | null
          problem_format?: string
          prompt_markdown?: string
          solver_code?: string | null
          solver_inputs?: Json
          solver_language?: string
          solver_outputs?: Json
          worked_solution_markdown?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_problems_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_problems_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_node_links: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          lesson_id: string
          link_role: string
          node_id: string
          rationale: string | null
          source_problem_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          lesson_id: string
          link_role?: string
          node_id: string
          rationale?: string | null
          source_problem_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          lesson_id?: string
          link_role?: string
          node_id?: string
          rationale?: string | null
          source_problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_node_links_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_node_links_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_node_links_source_problem_id_fkey"
            columns: ["source_problem_id"]
            isOneToOne: false
            referencedRelation: "source_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      session_graph_edges: {
        Row: {
          created_at: string
          from_lesson_id: string
          graph_id: string
          id: string
          to_lesson_id: string
        }
        Insert: {
          created_at?: string
          from_lesson_id: string
          graph_id: string
          id?: string
          to_lesson_id: string
        }
        Update: {
          created_at?: string
          from_lesson_id?: string
          graph_id?: string
          id?: string
          to_lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_graph_edges_from_lesson_id_fkey"
            columns: ["from_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_graph_edges_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "session_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_graph_edges_to_lesson_id_fkey"
            columns: ["to_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      session_graphs: {
        Row: {
          created_at: string
          graph_metadata: Json
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          graph_metadata?: Json
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          graph_metadata?: Json
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_graphs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      source_documents: {
        Row: {
          created_at: string
          extracted_text: string | null
          extraction_metadata: Json
          extraction_status: string
          file_name: string | null
          id: string
          lesson_id: string
          mime_type: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          extraction_metadata?: Json
          extraction_status?: string
          file_name?: string | null
          id?: string
          lesson_id: string
          mime_type?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          extraction_metadata?: Json
          extraction_status?: string
          file_name?: string | null
          id?: string
          lesson_id?: string
          mime_type?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      source_problems: {
        Row: {
          bbox: Json | null
          created_at: string
          crop_storage_path: string | null
          decomposition_status: string
          id: string
          learner_status: string
          lesson_id: string
          normalized_text: string | null
          original_text: string | null
          page_number: number | null
          problem_index: number
          problem_label: string | null
          source_document_id: string
          updated_at: string
        }
        Insert: {
          bbox?: Json | null
          created_at?: string
          crop_storage_path?: string | null
          decomposition_status?: string
          id?: string
          learner_status?: string
          lesson_id: string
          normalized_text?: string | null
          original_text?: string | null
          page_number?: number | null
          problem_index: number
          problem_label?: string | null
          source_document_id: string
          updated_at?: string
        }
        Update: {
          bbox?: Json | null
          created_at?: string
          crop_storage_path?: string | null
          decomposition_status?: string
          id?: string
          learner_status?: string
          lesson_id?: string
          normalized_text?: string | null
          original_text?: string | null
          page_number?: number | null
          problem_index?: number
          problem_label?: string | null
          source_document_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_problems_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_problems_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
