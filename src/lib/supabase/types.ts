export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: 'user' | 'admin' | 'tenant_admin';
          tenant_id: string | null;
          department: string | null;
          preferred_language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin' | 'tenant_admin';
          tenant_id?: string | null;
          department?: string | null;
          preferred_language?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'user' | 'admin' | 'tenant_admin';
          department?: string | null;
          preferred_language?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string | null;
          topic: string;
          mode: 'whynot' | 'vocabulary' | 'concept' | 'procedure';
          persona_name: string | null;
          status: 'active' | 'completed' | 'abandoned';
          score_knowledge_fidelity: number | null;
          score_structural_integrity: number | null;
          score_hypothesis_generation: number | null;
          score_thinking_depth: number | null;
          score_total: number | null;
          message_count: number;
          duration_seconds: number | null;
          key_concepts: string[] | null;
          missing_concepts: string[] | null;
          unique_insights: string[] | null;
          ai_feedback: string | null;
          grade: 'S' | 'A' | 'B' | 'C' | 'D' | null;
          messages: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          tenant_id?: string | null;
          topic: string;
          mode?: 'whynot' | 'vocabulary' | 'concept' | 'procedure';
          persona_name?: string | null;
          status?: 'active' | 'completed' | 'abandoned';
          score_knowledge_fidelity?: number | null;
          score_structural_integrity?: number | null;
          score_hypothesis_generation?: number | null;
          score_thinking_depth?: number | null;
          score_total?: number | null;
          message_count?: number;
          duration_seconds?: number | null;
          key_concepts?: string[] | null;
          missing_concepts?: string[] | null;
          unique_insights?: string[] | null;
          ai_feedback?: string | null;
          grade?: 'S' | 'A' | 'B' | 'C' | 'D' | null;
          messages?: Json;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
      };
      knowledge_nodes: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string | null;
          label: string;
          node_type: string;
          description: string | null;
          confidence: number;
          mention_count: number;
          depth: number;
          source_sessions: string[] | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          tenant_id?: string | null;
          label: string;
          node_type?: string;
          description?: string | null;
          confidence?: number;
          mention_count?: number;
          depth?: number;
          source_sessions?: string[] | null;
          metadata?: Json;
        };
        Update: Partial<Database['public']['Tables']['knowledge_nodes']['Insert']>;
      };
      knowledge_edges: {
        Row: {
          id: string;
          user_id: string;
          source_id: string;
          target_id: string;
          relationship: string;
          weight: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          source_id: string;
          target_id: string;
          relationship?: string;
          weight?: number;
        };
        Update: Partial<Database['public']['Tables']['knowledge_edges']['Insert']>;
      };
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          plan: 'poc' | 'standard' | 'professional' | 'enterprise';
          status: 'trialing' | 'active' | 'past_due' | 'cancelled';
          max_users: number;
          billing_email: string | null;
          billing_cycle: 'monthly' | 'annual';
          mrr_jpy: number;
          poc_start_date: string | null;
          poc_end_date: string | null;
          poc_contract_value_jpy: number | null;
          subsidy_applied: boolean;
          industry: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          plan?: 'poc' | 'standard' | 'professional' | 'enterprise';
          max_users?: number;
          billing_email?: string | null;
          industry?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
    };
    Views: {
      user_stats: {
        Row: {
          user_id: string;
          total_sessions: number;
          avg_score: number;
          total_seconds: number;
          last_session_at: string;
          unique_topics: number;
        };
      };
    };
  };
}
