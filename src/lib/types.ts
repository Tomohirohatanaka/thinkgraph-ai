export interface LogicNode {
  id: string;
  label: string;
  node_type: 'problem' | 'cause' | 'factor' | 'solution' | 'concept';
  depth: number;
}

export interface LogicEdge {
  source: string;
  target: string;
  relation: string;
}

export interface LogicGraph {
  nodes: LogicNode[];
  edges: LogicEdge[];
}

export interface Scores {
  knowledge_fidelity: number;
  structural_integrity: number;
  hypothesis_generation: number;
  thinking_depth: number;
  total_score: number;
  matched_concepts: string[];
  missing_concepts: string[];
  unique_insights: string[];
  key_feedback: string;
  strength: string;
  improvement: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
