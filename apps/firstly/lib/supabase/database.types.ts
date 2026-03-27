export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          id: string
          graph_id: string
          lesson_id: string
          from_node_id: string
          to_node_id: string
          edge_status: string
          created_at: string
        }
        Insert: {
          id?: string
          graph_id: string
          lesson_id: string
          from_node_id: string
          to_node_id: string
          edge_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          graph_id?: string
          lesson_id?: string
          from_node_id?: string
          to_node_id?: string
          edge_status?: string
          created_at?: string
        }
        Relationships: [
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
            foreignKeyName: "lesson_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "lesson_nodes"
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
          id: string
          lesson_id: string
          status: string
          generation_reason: string
          source_summary: Json
          graph_metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          status?: string
          generation_reason: string
          source_summary?: Json
          graph_metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          status?: string
          generation_reason?: string
          source_summary?: Json
          graph_metadata?: Json
          created_at?: string
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
          id: string
          lesson_id: string
          input_type: string
          raw_text: string
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          input_type: string
          raw_text: string
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          input_type?: string
          raw_text?: string
          created_at?: string
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
          id: string
          graph_id: string
          lesson_id: string
          title: string
          slug: string | null
          summary: string | null
          node_status: string
          node_kind: string
          canonical_skill_candidate_key: string | null
          domain_tags: string[]
          future_transfer_metadata: Json
          display_order_hint: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          graph_id: string
          lesson_id: string
          title: string
          slug?: string | null
          summary?: string | null
          node_status?: string
          node_kind?: string
          canonical_skill_candidate_key?: string | null
          domain_tags?: string[]
          future_transfer_metadata?: Json
          display_order_hint?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          graph_id?: string
          lesson_id?: string
          title?: string
          slug?: string | null
          summary?: string | null
          node_status?: string
          node_kind?: string
          canonical_skill_candidate_key?: string | null
          domain_tags?: string[]
          future_transfer_metadata?: Json
          display_order_hint?: number | null
          created_at?: string
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
          id: string
          user_id: string
          title: string | null
          status: string
          entry_mode: string
          goal_text: string | null
          subject_domain: string
          future_graph_mode: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          status?: string
          entry_mode: string
          goal_text?: string | null
          subject_domain?: string
          future_graph_mode?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          status?: string
          entry_mode?: string
          goal_text?: string | null
          subject_domain?: string
          future_graph_mode?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      node_lessons: {
        Row: {
          id: string
          node_id: string
          lesson_id: string
          intro_markdown: string
          worked_example_markdown: string
          progression_markdown: string | null
          content_status: string
          generator_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          node_id: string
          lesson_id: string
          intro_markdown: string
          worked_example_markdown: string
          progression_markdown?: string | null
          content_status?: string
          generator_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          node_id?: string
          lesson_id?: string
          intro_markdown?: string
          worked_example_markdown?: string
          progression_markdown?: string | null
          content_status?: string
          generator_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_lessons_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      node_progress: {
        Row: {
          node_id: string
          lesson_id: string
          user_id: string
          lesson_opened_at: string | null
          first_completed_at: string | null
          total_attempts: number
          correct_attempts: number
          mastery_state: string
          updated_at: string
        }
        Insert: {
          node_id: string
          lesson_id: string
          user_id: string
          lesson_opened_at?: string | null
          first_completed_at?: string | null
          total_attempts?: number
          correct_attempts?: number
          mastery_state?: string
          updated_at?: string
        }
        Update: {
          node_id?: string
          lesson_id?: string
          user_id?: string
          lesson_opened_at?: string | null
          first_completed_at?: string | null
          total_attempts?: number
          correct_attempts?: number
          mastery_state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_progress_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          id: string
          practice_problem_id: string
          lesson_id: string
          node_id: string
          user_id: string
          submitted_answer: Json
          is_correct: boolean
          time_spent_seconds: number | null
          submitted_at: string
        }
        Insert: {
          id?: string
          practice_problem_id: string
          lesson_id: string
          node_id: string
          user_id: string
          submitted_answer: Json
          is_correct: boolean
          time_spent_seconds?: number | null
          submitted_at?: string
        }
        Update: {
          id?: string
          practice_problem_id?: string
          lesson_id?: string
          node_id?: string
          user_id?: string
          submitted_answer?: Json
          is_correct?: boolean
          time_spent_seconds?: number | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_practice_problem_id_fkey"
            columns: ["practice_problem_id"]
            isOneToOne: false
            referencedRelation: "practice_problems"
            referencedColumns: ["id"]
          },
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
        ]
      }
      practice_problems: {
        Row: {
          id: string
          lesson_id: string
          node_id: string
          family_key: string | null
          generation_round: number
          prompt_markdown: string
          problem_format: string
          options: Json | null
          correct_option_index: number | null
          worked_solution_markdown: string
          solver_language: string
          solver_code: string | null
          solver_inputs: Json
          solver_outputs: Json
          canonical_answer: Json | null
          difficulty: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          node_id: string
          family_key?: string | null
          generation_round?: number
          prompt_markdown: string
          problem_format: string
          options?: Json | null
          correct_option_index?: number | null
          worked_solution_markdown: string
          solver_language?: string
          solver_code?: string | null
          solver_inputs?: Json
          solver_outputs?: Json
          canonical_answer?: Json | null
          difficulty?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          node_id?: string
          family_key?: string | null
          generation_round?: number
          prompt_markdown?: string
          problem_format?: string
          options?: Json | null
          correct_option_index?: number | null
          worked_solution_markdown?: string
          solver_language?: string
          solver_code?: string | null
          solver_inputs?: Json
          solver_outputs?: Json
          canonical_answer?: Json | null
          difficulty?: string | null
          metadata?: Json
          created_at?: string
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
          id: string
          lesson_id: string
          source_problem_id: string
          node_id: string
          link_role: string
          rationale: string | null
          confidence: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          source_problem_id: string
          node_id: string
          link_role?: string
          rationale?: string | null
          confidence?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          source_problem_id?: string
          node_id?: string
          link_role?: string
          rationale?: string | null
          confidence?: string | null
          created_at?: string
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
            foreignKeyName: "problem_node_links_source_problem_id_fkey"
            columns: ["source_problem_id"]
            isOneToOne: false
            referencedRelation: "source_problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_node_links_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "lesson_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          id: string
          lesson_id: string
          storage_path: string | null
          mime_type: string | null
          file_name: string | null
          extraction_status: string
          extracted_text: string | null
          extraction_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          storage_path?: string | null
          mime_type?: string | null
          file_name?: string | null
          extraction_status?: string
          extracted_text?: string | null
          extraction_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          storage_path?: string | null
          mime_type?: string | null
          file_name?: string | null
          extraction_status?: string
          extracted_text?: string | null
          extraction_metadata?: Json
          created_at?: string
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
          id: string
          source_document_id: string
          lesson_id: string
          problem_index: number
          problem_label: string | null
          original_text: string | null
          normalized_text: string | null
          page_number: number | null
          bbox: Json | null
          crop_storage_path: string | null
          decomposition_status: string
          learner_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_document_id: string
          lesson_id: string
          problem_index: number
          problem_label?: string | null
          original_text?: string | null
          normalized_text?: string | null
          page_number?: number | null
          bbox?: Json | null
          crop_storage_path?: string | null
          decomposition_status?: string
          learner_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_document_id?: string
          lesson_id?: string
          problem_index?: number
          problem_label?: string | null
          original_text?: string | null
          normalized_text?: string | null
          page_number?: number | null
          bbox?: Json | null
          crop_storage_path?: string | null
          decomposition_status?: string
          learner_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_problems_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_problems_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
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
