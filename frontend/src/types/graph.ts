export type GoalModeId = 'trajectory' | 'infiltration' | 'gravity' | 'structural';

export type ClusterName =
  | 'Robotics & Embodied AI'
  | 'Edge ML & Runtimes'
  | 'Data Platform & Infra'
  | 'Frontier Execs & Venture';

export type AuthorityTier = 'IC' | 'Staff/Principal' | 'Director/VP/Founder';

export interface SkillItem {
  name: string;
  category: string;
  proficiency: number;
}

export interface UserProfile {
  id: string;
  user_id?: string;
  name: string;
  headline: string;
  currentCompany: string;
  location: string;
  activeGoalMode: GoalModeId;
  activeCareerVector: string;
  repositories: string[];
  targetCompanies: string[];
  target_roles?: string[];
  skills: SkillItem[];
}

export interface PastTrajectorySnapshot {
  role: string;
  similarityScore: number;
  vectorCluster: string;
}

export interface ContactNode {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  degree: 0 | 1 | 2 | 3;
  trustScore: number;
  authorityLevel: AuthorityTier;
  cluster: ClusterName;
  strategicValue: number;
  skills: string[];
  pastState3YrsAgo?: PastTrajectorySnapshot | null;
  githubOverlap?: string;
  linkedinUrl?: string;
  connectedOn?: string;
  lastInteractionAt?: string;
  messageCount?: number;
  betweennessCentrality?: number;
  pagerank?: number;
  evScore?: number;
  conversionProb?: number;
  context?: string;
  notes?: string;
}

export interface GraphEdge {
  id: string;
  dbId?: number;
  source: string;
  target: string;
  weight: number;
  relationshipType?: string;
  context: string;
}

export interface UnifiedAppState {
  profile: UserProfile;
  nodes: ContactNode[];
  edges: GraphEdge[];
  lastSavedAt?: string;
}

export interface PathEdgeStep {
  id: string;
  to: string;
  weight: number;
  cost: number;
  context: string;
}

export interface EvaluatedPath {
  id: string;
  nodes: ContactNode[];
  edges: PathEdgeStep[];
  hops: number;
  totalCost: number;
  rawProb: number;
  conversionProb: number;
  synergyBonusPct: number;
  skillSynergyFactor: number;
  authorityLevel: AuthorityTier;
  authorityMultiplier: number;
  knnMatchScore: number;
  goalModeMultiplier: number;
  goalModeBadge: string;
  crossClusterJump: boolean;
  evScore: number;
  sharedSkills: string[];
  bridgeNode: ContactNode | null;
  secondBridgeNode: ContactNode | null;
  targetNode: ContactNode;
}

export interface RankedOpportunity {
  target: ContactNode;
  primaryPath: EvaluatedPath;
  backupPath: EvaluatedPath | null;
  isTargetCompany: boolean;
  evScore: number;
}

export interface BridgeConditioningItem {
  node: ContactNode;
  currentTrust: number;
  boostedTrust: number;
  deltaEV: number;
  optimalPathsRouted: number;
  unlockedTargets: ContactNode[];
  centralityScore: number;
  betweenness: number;
}

export interface ClusterStat {
  cluster: ClusterName;
  totalNodes: number;
  firstDegCount: number;
  targetCount: number;
  internalEdges: number;
  externalBridges: number;
  holeScore: number;
}

export interface TrajectoryVector {
  id: string;
  title: string;
  horizon: string;
  targetOrgs: string[];
  rationale: string;
  exemplarNodes: ContactNode[];
  avgSimilarity: number;
  avgEV: number;
}

export interface NetworkIntelligence {
  targetPathsMap: Map<string, EvaluatedPath[]>;
  rankedOpportunities: RankedOpportunity[];
  bridgeConditioning: BridgeConditioningItem[];
  clusterStats: ClusterStat[];
  trajectoryVectors: TrajectoryVector[];
  avgEVScore: number;
  avgConversion: number;
  baselineTotalEV: number;
}

export interface GitHubCandidate {
  id: string;
  login: string;
  name: string;
  role: string;
  company: string;
  location: string;
  repoSource: string;
  githubUrl: string;
  githubSignal: string;
  authorityLevel: AuthorityTier;
  cluster: ClusterName;
  skills: string[];
  trustScore: number;
  strategicValue: number;
  bridgeNodeId: string;
  bridgeName: string;
  bridgeCompany: string;
  bridgeEdgeWeight: number;
  bridgeContext: string;
}

export interface ProcessorExecutionItem {
  processor_id: string;
  status: string;
  execution_time_ms: number;
  nodes_updated: number;
  edges_updated: number;
  message: string;
  metrics?: Record<string, unknown>;
}

export interface PipelineExecutionSummary {
  status: string;
  pipeline_processors_executed: string[];
  total_execution_time_ms: number;
  total_nodes_updated: number;
  total_edges_updated: number;
  results: ProcessorExecutionItem[];
}
