export interface UserProfile {
  id: string;
  full_name: string;
  headline: string;
  current_company: string;
  target_roles: string[];
  target_companies: string[];
  skills?: UserSkill[];
}

export interface UserSkill {
  id?: number;
  user_id?: string;
  skill_name: string;
  category: 'Core' | 'Systems' | 'Domain' | 'Leadership';
  proficiency: number;
}

export interface NetworkNode {
  id: string;
  user_id?: string;
  full_name: string;
  role: string;
  company: string;
  location?: string;
  degree: 0 | 1 | 2 | 3;
  trust_score: number;
  strategic_value: number;
  skills: string[];
  linkedin_url?: string;
  connected_on?: string;
  message_count?: number;
  notes?: string;
  betweenness_centrality?: number;
  degree_centrality?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface NetworkEdge {
  id?: number;
  source: string;
  target: string;
  weight: number;
  friction_cost?: number;
  relationship_type?: string;
  context?: string;
}

export interface CalculatedPath {
  target_id: string;
  target_name: string;
  target_role: string;
  target_company: string;
  target_degree: number;
  strategic_value: number;
  bridge_id: string;
  bridge_name: string;
  bridge_role: string;
  bridge_company: string;
  bridge_trust: number;
  route_ids: string[];
  route_nodes: NetworkNode[];
  route_edges: NetworkEdge[];
  conversion_prob: number;
  friction_cost: number;
  shared_skills: string[];
}

export interface NetworkKpi {
  total_nodes: number;
  first_degree_count: number;
  second_degree_count: number;
  third_degree_count: number;
  avg_first_degree_trust: number;
  high_probability_paths: number;
}

export interface NetworkGraphState {
  user_id: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  calculated_paths: CalculatedPath[];
  kpi: NetworkKpi;
  top_bridges: NetworkNode[];
}

export interface OutreachPackage {
  bridge_intro_request: string;
  forwardable_blurb: string;
  email_subject: string;
}
