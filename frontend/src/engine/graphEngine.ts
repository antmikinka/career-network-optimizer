import {
  AuthorityTier,
  BridgeConditioningItem,
  ClusterName,
  ClusterStat,
  ContactNode,
  EvaluatedPath,
  GoalModeId,
  GraphEdge,
  NetworkIntelligence,
  PathEdgeStep,
  RankedOpportunity,
  TrajectoryVector,
  UserProfile,
} from '../types/graph';

export const STORAGE_KEY = 'cno_db_v6';

export const CLUSTERS: ClusterName[] = [
  'Robotics & Embodied AI',
  'Edge ML & Runtimes',
  'Data Platform & Infra',
  'Frontier Execs & Venture',
];

export const CLUSTER_COLORS: Record<
  ClusterName,
  { stroke: string; fill: string; badge: string }
> = {
  'Robotics & Embodied AI': {
    stroke: '#22d3ee',
    fill: '#083344',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  'Edge ML & Runtimes': {
    stroke: '#a855f7',
    fill: '#3b0764',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  'Data Platform & Infra': {
    stroke: '#10b981',
    fill: '#064e3b',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  'Frontier Execs & Venture': {
    stroke: '#f59e0b',
    fill: '#451a03',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
};

export const AUTHORITY_MULTIPLIERS: Record<AuthorityTier, number> = {
  IC: 0.5,
  'Staff/Principal': 0.8,
  'Director/VP/Founder': 1.0,
};

export interface GoalModeDescriptor {
  id: GoalModeId;
  name: string;
  shortLabel: string;
  description: string;
  formulaNote: string;
}

export const GOAL_MODES: GoalModeDescriptor[] = [
  {
    id: 'trajectory',
    name: 'Trajectory Lookahead (k-NN)',
    shortLabel: 'k-NN Lookahead',
    description:
      'Prioritizes targets whose historical career snapshot 3–4 years ago aligns with your Tesla Optimus / Lingo & ONNX/MLX stack and who are now 1–2 levels ahead.',
    formulaNote: 'Boosts k-NN Historical State Similarity (S_0 vs S_{t-3})',
  },
  {
    id: 'infiltration',
    name: 'Company / Lab Infiltration',
    shortLabel: 'Lab Infiltration',
    description:
      'Prioritizes Hiring Managers, Directors, and VPs inside target frontier labs (Tesla, Figure, OpenAI, Apple, Anthropic, NVIDIA) via high-trust 1st-degree insiders.',
    formulaNote: 'Boosts Decision Authority (1.0x) + Target Org Membership',
  },
  {
    id: 'gravity',
    name: 'Technical Stack Gravity',
    shortLabel: 'Stack & Repo Gravity',
    description:
      'Prioritizes Principal/Staff architects and maintainers with direct overlap in ONNX split-graph chunking, Apple MLX, C++/Tauri, and robotics telemetry.',
    formulaNote: 'Boosts Cosine Skill Synergy + GitHub Repo Overlap',
  },
  {
    id: 'structural',
    name: 'Structural Hole Bridging',
    shortLabel: 'Structural Holes',
    description:
      'Optimizes for Ronald Burt’s Structural Holes—surfacing nodes that bridge underrepresented network clusters to maximize non-redundant information flow.',
    formulaNote: 'Boosts Cross-Cluster Modularity & Betweenness Centrality',
  },
];

export const DEFAULT_PROFILE: UserProfile = {
  id: 'user-root',
  user_id: 'default_user',
  name: 'Anthony Mikinka',
  headline:
    'Humanoid Robotics Data Operations & Data Platform Architecture (Tesla Optimus / Lingo)',
  currentCompany: 'Tesla',
  location: 'San Jose, CA',
  activeGoalMode: 'trajectory',
  activeCareerVector: 'Principal Embodied AI & Humanoid Data Architect',
  repositories: [
    'antmikinka/onnx-model-chunking',
    'antmikinka/lemon-mlx-engine',
    'antmikinka/loom',
    'antmikinka/lemonade',
  ],
  targetCompanies: ['Tesla', 'Apple', 'Figure', 'OpenAI', 'Anthropic', 'NVIDIA'],
  skills: [
    { name: 'ONNX Runtime & Graph Chunking', proficiency: 95, category: 'Systems' },
    { name: 'MLX Inference Acceleration', proficiency: 92, category: 'Systems' },
    { name: 'C++ & Tauri GUI Systems', proficiency: 90, category: 'Core' },
    { name: 'Humanoid Robotics Telemetry & Data Ops', proficiency: 94, category: 'Domain' },
    { name: 'Distributed Data Platform Architecture', proficiency: 89, category: 'Leadership' },
    { name: 'Automated Test Execution / Loom', proficiency: 86, category: 'Core' },
  ],
};

// ============================================================================
// BINARY MIN-HEAP FOR O((V + E) log V) DIJKSTRA
// ============================================================================

interface HeapItem {
  id: string;
  dist: number;
}

class MinHeap {
  private data: HeapItem[] = [];

  get size(): number {
    return this.data.length;
  }

  push(item: HeapItem): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapItem | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.data[idx].dist >= this.data[parent].dist) break;
      [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = idx;
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      if (left < n && this.data[left].dist < this.data[smallest].dist) smallest = left;
      if (right < n && this.data[right].dist < this.data[smallest].dist) smallest = right;
      if (smallest === idx) break;
      [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
      idx = smallest;
    }
  }
}

interface AdjLink {
  to: string;
  weight: number;
  cost: number;
  context: string;
  id: string;
}

function buildAdjacencyMap(
  edges: GraphEdge[],
  excludeRoot = false
): Map<string, AdjLink[]> {
  const adj = new Map<string, AdjLink[]>();
  const addLink = (u: string, v: string, weight: number, context: string, id: string) => {
    if (!adj.has(u)) adj.set(u, []);
    const clampedW = Math.max(0.05, Math.min(0.99, Number(weight) || 0.5));
    const cost = -Math.log(clampedW);
    adj.get(u)!.push({ to: v, weight: clampedW, cost, context, id });
  };

  for (const e of edges) {
    if (excludeRoot && (e.source === 'user-root' || e.target === 'user-root')) continue;
    addLink(e.source, e.target, e.weight, e.context, e.id);
    addLink(e.target, e.source, e.weight, e.context, e.id);
  }
  return adj;
}

function runDijkstra(
  adj: Map<string, AdjLink[]>,
  startId: string,
  blockedEdgeKey?: string
): { dist: Map<string, number>; prev: Map<string, { from: string; edge: AdjLink }> } {
  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; edge: AdjLink }>();
  const heap = new MinHeap();

  dist.set(startId, 0);
  heap.push({ id: startId, dist: 0 });

  while (heap.size > 0) {
    const curr = heap.pop()!;
    const known = dist.get(curr.id);
    if (known !== undefined && curr.dist > known + 1e-9) continue;

    const neighbors = adj.get(curr.id);
    if (!neighbors) continue;

    for (const edge of neighbors) {
      if (
        blockedEdgeKey &&
        (`${curr.id}->${edge.to}` === blockedEdgeKey || `${edge.to}->${curr.id}` === blockedEdgeKey)
      ) {
        continue;
      }
      const nextDist = curr.dist + edge.cost;
      const oldDist = dist.get(edge.to);
      if (oldDist === undefined || nextDist < oldDist - 1e-9) {
        dist.set(edge.to, nextDist);
        prev.set(edge.to, { from: curr.id, edge });
        heap.push({ id: edge.to, dist: nextDist });
      }
    }
  }

  return { dist, prev };
}

function reconstructRoute(
  startId: string,
  targetId: string,
  nodeMap: Map<string, ContactNode>,
  dist: Map<string, number>,
  prev: Map<string, { from: string; edge: AdjLink }>
): { nodes: ContactNode[]; edges: PathEdgeStep[]; totalCost: number } | null {
  const totalCost = dist.get(targetId);
  if (totalCost === undefined || !Number.isFinite(totalCost)) return null;

  const nodeChain: ContactNode[] = [];
  const edgeChain: PathEdgeStep[] = [];
  let cursor = targetId;
  let guard = 0;

  while (cursor !== startId && guard < 12) {
    guard++;
    const node = nodeMap.get(cursor);
    const step = prev.get(cursor);
    if (!node || !step) return null;
    nodeChain.push(node);
    edgeChain.push({
      id: step.edge.id,
      to: cursor,
      weight: step.edge.weight,
      cost: step.edge.cost,
      context: step.edge.context,
    });
    cursor = step.from;
  }

  const rootNode = nodeMap.get(startId);
  if (!rootNode) return null;
  nodeChain.push(rootNode);
  nodeChain.reverse();
  edgeChain.reverse();

  return { nodes: nodeChain, edges: edgeChain, totalCost };
}

export function calculateAutoTrustScore(
  msgCount = 0,
  daysSinceConnected = 90,
  isCoworkerOrTarget = false
): number {
  const msgTerm = 0.35 * (Math.log(1 + Math.max(0, msgCount)) / Math.log(50));
  const recencyTerm = 0.25 * Math.exp(-(Math.LN2 / 180) * Math.max(0, daysSinceConnected));
  const companyBonus = isCoworkerOrTarget ? 0.15 : 0;
  const raw = 0.25 + msgTerm + recencyTerm + companyBonus;
  return Number(Math.min(0.98, Math.max(0.15, raw)).toFixed(2));
}

function scoreTargetFactors(
  profile: UserProfile,
  targetNode: ContactNode,
  clusterStatsMap?: Map<ClusterName, ClusterStat> | null
) {
  const userSkillMap = new Map(profile.skills.map((s) => [s.name.toLowerCase(), s]));
  const sharedSkills = (targetNode.skills || []).filter((sk) =>
    userSkillMap.has(sk.toLowerCase())
  );
  const avgProf =
    sharedSkills.length > 0
      ? sharedSkills.reduce(
          (sum, sk) => sum + (userSkillMap.get(sk.toLowerCase())?.proficiency || 88),
          0
        ) / sharedSkills.length
      : 75;

  const skillSynergyFactor = Number(
    (0.68 + Math.min(0.55, sharedSkills.length * 0.16 * (avgProf / 92))).toFixed(2)
  );
  const synergyBonusPct = Math.min(14, Math.round(sharedSkills.length * 4));

  const authorityLevel: AuthorityTier = targetNode.authorityLevel || 'Staff/Principal';
  const authorityMultiplier = AUTHORITY_MULTIPLIERS[authorityLevel] || 0.8;
  const knnMatchScore = targetNode.pastState3YrsAgo?.similarityScore || 84;

  const goalMode = profile.activeGoalMode || 'trajectory';
  const isTargetCompany = profile.targetCompanies.some(
    (tc) => tc.toLowerCase() === (targetNode.company || '').toLowerCase()
  );

  let goalModeMultiplier = 1.0;
  let goalModeBadge = 'Balanced EV';

  if (goalMode === 'trajectory') {
    goalModeMultiplier = 0.85 + (knnMatchScore / 100) * 0.45;
    goalModeBadge = `k-NN Match: ${knnMatchScore}%`;
  } else if (goalMode === 'infiltration') {
    const authBoost =
      authorityMultiplier === 1.0 ? 1.28 : authorityMultiplier === 0.8 ? 1.08 : 0.78;
    const orgBoost = isTargetCompany ? 1.15 : 0.9;
    goalModeMultiplier = authBoost * orgBoost;
    goalModeBadge = `${authorityLevel} (${authorityMultiplier}x)`;
  } else if (goalMode === 'gravity') {
    const hasRepoSignal = Boolean(
      targetNode.githubOverlap &&
        targetNode.githubOverlap.length > 5 &&
        !targetNode.githubOverlap.toLowerCase().includes('imported via')
    );
    goalModeMultiplier = skillSynergyFactor * (hasRepoSignal ? 1.18 : 0.95);
    goalModeBadge = `${sharedSkills.length} Shared Stack Pillars`;
  } else if (goalMode === 'structural') {
    const cStat = clusterStatsMap?.get(targetNode.cluster);
    const scarcityBoost = cStat
      ? cStat.firstDegCount === 0
        ? 1.42
        : cStat.firstDegCount === 1
        ? 1.24
        : 0.96
      : 1.15;
    goalModeMultiplier = scarcityBoost;
    goalModeBadge = `Hole Bridge: ${targetNode.cluster}`;
  }

  return {
    sharedSkills,
    skillSynergyFactor,
    synergyBonusPct,
    authorityLevel,
    authorityMultiplier,
    knnMatchScore,
    goalMode,
    goalModeMultiplier,
    goalModeBadge,
  };
}

function buildRootContactNode(profile: UserProfile): ContactNode {
  return {
    id: 'user-root',
    name: profile.name,
    role: profile.headline,
    company: profile.currentCompany,
    location: profile.location,
    degree: 0,
    trustScore: 1.0,
    authorityLevel: 'Staff/Principal',
    cluster: 'Robotics & Embodied AI',
    strategicValue: 100,
    skills: profile.skills.map((s) => s.name),
  };
}

/**
 * Computes Primary (#1) and Backup (#2) shortest logarithmic-friction routes in O((V + E) log V)
 * using Min-Heap Dijkstra + bridge-edgespur exclusion. Scales effortlessly to 2,500+ contacts.
 */
export function computePathsAndEV(
  profile: UserProfile,
  nodes: ContactNode[],
  edges: GraphEdge[],
  targetId: string | null,
  clusterStatsMap: Map<ClusterName, ClusterStat> | null = null,
  precomputedAdj?: Map<string, AdjLink[]>,
  precomputedBaseDijkstra?: {
    dist: Map<string, number>;
    prev: Map<string, { from: string; edge: AdjLink }>;
  }
): EvaluatedPath[] {
  if (!targetId || targetId === 'user-root') return [];

  const nodeMap = new Map<string, ContactNode>();
  nodeMap.set('user-root', buildRootContactNode(profile));
  for (const n of nodes) nodeMap.set(n.id, n);

  const targetNode = nodeMap.get(targetId);
  if (!targetNode) return [];

  const adj = precomputedAdj || buildAdjacencyMap(edges, false);
  const primaryDijk = precomputedBaseDijkstra || runDijkstra(adj, 'user-root');
  const primaryRaw = reconstructRoute(
    'user-root',
    targetId,
    nodeMap,
    primaryDijk.dist,
    primaryDijk.prev
  );
  if (!primaryRaw) return [];

  const rawRoutes = [primaryRaw];

  // Find distinct-bridge Backup Route #2 by blocking the first hop edge (or penultimate bridge edge)
  if (primaryRaw.nodes.length >= 3) {
    const firstBridgeId = primaryRaw.nodes[1].id;
    const secondDijk = runDijkstra(adj, 'user-root', `user-root->${firstBridgeId}`);
    const backupRaw = reconstructRoute(
      'user-root',
      targetId,
      nodeMap,
      secondDijk.dist,
      secondDijk.prev
    );
    if (backupRaw) {
      rawRoutes.push(backupRaw);
    }
  }

  const factors = scoreTargetFactors(profile, targetNode, clusterStatsMap);

  return rawRoutes
    .map((route, idx): EvaluatedPath => {
      const rawProb = Math.exp(-route.totalCost) * 100;
      const conversionProb = Math.min(
        98,
        Math.max(8, Math.round(rawProb + factors.synergyBonusPct * 0.4))
      );
      const bridgeNode = route.nodes.length > 2 ? route.nodes[1] : null;
      const crossClusterJump = Boolean(
        bridgeNode && bridgeNode.cluster !== targetNode.cluster
      );
      const effectiveModeMultiplier =
        factors.goalMode === 'structural' && crossClusterJump
          ? Number((factors.goalModeMultiplier * 1.12).toFixed(2))
          : Number(factors.goalModeMultiplier.toFixed(2));

      const rawEV =
        (conversionProb / 100) *
        (0.55 + factors.authorityMultiplier * 0.45) *
        factors.skillSynergyFactor *
        effectiveModeMultiplier *
        100;
      const evScore = Math.min(99, Math.max(15, Math.round(rawEV)));

      return {
        id: `route-${targetId}-${idx}`,
        nodes: route.nodes,
        edges: route.edges,
        hops: route.edges.length,
        totalCost: Number(route.totalCost.toFixed(3)),
        rawProb: Math.round(rawProb),
        conversionProb,
        synergyBonusPct: factors.synergyBonusPct,
        skillSynergyFactor: factors.skillSynergyFactor,
        authorityLevel: factors.authorityLevel,
        authorityMultiplier: factors.authorityMultiplier,
        knnMatchScore: factors.knnMatchScore,
        goalModeMultiplier: effectiveModeMultiplier,
        goalModeBadge: factors.goalModeBadge,
        crossClusterJump,
        evScore,
        sharedSkills: factors.sharedSkills,
        bridgeNode,
        secondBridgeNode: route.nodes.length > 3 ? route.nodes[2] : null,
        targetNode,
      };
    })
    .sort((a, b) => b.evScore - a.evScore || a.totalCost - b.totalCost);
}

/**
 * Full Network Intelligence + Cluster Modularity + O(1) Reverse-Dijkstra Delta-EV Bridge Conditioning
 */
export function computeNetworkIntelligence(
  profile: UserProfile,
  nodes: ContactNode[],
  edges: GraphEdge[]
): NetworkIntelligence {
  // 1. Cluster Modularity & Ronald Burt Structural Hole Metrics
  const clusterStatsMap = new Map<ClusterName, ClusterStat>();
  for (const cName of CLUSTERS) {
    const cNodes = nodes.filter((n) => n.cluster === cName);
    const firstDeg = cNodes.filter((n) => n.degree === 1);
    const targets = cNodes.filter((n) => n.degree >= 2);
    const nodeIdsInCluster = new Set(cNodes.map((n) => n.id));

    let internalEdges = 0;
    let externalBridges = 0;
    for (const e of edges) {
      if (e.source === 'user-root' || e.target === 'user-root') continue;
      const sIn = nodeIdsInCluster.has(e.source);
      const tIn = nodeIdsInCluster.has(e.target);
      if (sIn && tIn) internalEdges++;
      else if (sIn || tIn) externalBridges++;
    }

    const holeScore =
      targets.length > 0 || externalBridges > 0
        ? Math.min(
            98,
            Math.round(
              (targets.length * 22) / Math.max(0.7, firstDeg.length) + externalBridges * 4
            )
          )
        : firstDeg.length === 0
        ? 15
        : 0;

    clusterStatsMap.set(cName, {
      cluster: cName,
      totalNodes: cNodes.length,
      firstDegCount: firstDeg.length,
      targetCount: targets.length,
      internalEdges,
      externalBridges,
      holeScore,
    });
  }

  // 2. Single-Source Min-Heap Dijkstra from 'user-root' once for ALL targets
  const fullAdj = buildAdjacencyMap(edges, false);
  const baseDijkstra = runDijkstra(fullAdj, 'user-root');

  const allTargets = nodes.filter((n) => n.degree >= 2);
  const firstDegNodes = nodes.filter((n) => n.degree === 1);
  const targetPathsMap = new Map<string, EvaluatedPath[]>();
  const bridgeUsageCount = new Map<string, number>();
  const bridgeUnlockedTargets = new Map<string, ContactNode[]>();

  for (const n of firstDegNodes) {
    bridgeUsageCount.set(n.id, 0);
    bridgeUnlockedTargets.set(n.id, []);
  }

  const rankedOpportunities: RankedOpportunity[] = [];

  for (const target of allTargets) {
    const paths = computePathsAndEV(
      profile,
      nodes,
      edges,
      target.id,
      clusterStatsMap,
      fullAdj,
      baseDijkstra
    );
    targetPathsMap.set(target.id, paths);

    if (paths.length > 0) {
      const primary = paths[0];
      const backup = paths[1] || null;
      const bNode = primary.bridgeNode;

      if (bNode && bridgeUsageCount.has(bNode.id)) {
        bridgeUsageCount.set(bNode.id, (bridgeUsageCount.get(bNode.id) || 0) + 1);
        bridgeUnlockedTargets.get(bNode.id)!.push(target);
      }

      const isTargetCompany = profile.targetCompanies.some(
        (tc) => tc.toLowerCase() === (target.company || '').toLowerCase()
      );

      rankedOpportunities.push({
        target,
        primaryPath: primary,
        backupPath: backup,
        isTargetCompany,
        evScore: primary.evScore,
      });
    }
  }

  rankedOpportunities.sort((a, b) => b.evScore - a.evScore);
  const baselineTotalEV = rankedOpportunities.reduce((sum, r) => sum + r.evScore, 0);

  // 3. O(1)-per-target Reverse-Dijkstra Delta-EV Bridge Conditioning
  // Precompute shortest distance in G \ {user-root} from each target to all 1st-degree bridges!
  const noRootAdj = buildAdjacencyMap(edges, true);
  const targetToBridgeDist = new Map<string, Map<string, number>>();
  const targetFactorsCache = new Map<
    string,
    ReturnType<typeof scoreTargetFactors> & { baselineEV: number; baselineCost: number }
  >();

  for (const t of allTargets) {
    const rev = runDijkstra(noRootAdj, t.id);
    targetToBridgeDist.set(t.id, rev.dist);
    const factors = scoreTargetFactors(profile, t, clusterStatsMap);
    const basePrimary = targetPathsMap.get(t.id)?.[0];
    targetFactorsCache.set(t.id, {
      ...factors,
      baselineEV: basePrimary ? basePrimary.evScore : 0,
      baselineCost: basePrimary ? basePrimary.totalCost : Infinity,
    });
  }

  const bridgeConditioning: BridgeConditioningItem[] = firstDegNodes
    .map((bNode) => {
      const currentTrust = Number(bNode.trustScore);
      const boostedTrust = Math.min(0.98, Number((currentTrust + 0.25).toFixed(2)));
      const boostedRootCost = -Math.log(Math.max(0.05, boostedTrust));

      let simulatedTotalEV = 0;
      for (const t of allTargets) {
        const tf = targetFactorsCache.get(t.id)!;
        const distBridgeToTarget = targetToBridgeDist.get(t.id)?.get(bNode.id);
        const viaBridgeCost =
          distBridgeToTarget !== undefined ? boostedRootCost + distBridgeToTarget : Infinity;
        const bestCost = Math.min(tf.baselineCost, viaBridgeCost);

        if (Number.isFinite(bestCost)) {
          if (Math.abs(bestCost - tf.baselineCost) < 1e-9) {
            simulatedTotalEV += tf.baselineEV;
          } else {
            const rawProb = Math.exp(-bestCost) * 100;
            const convProb = Math.min(
              98,
              Math.max(8, Math.round(rawProb + tf.synergyBonusPct * 0.4))
            );
            const crossJump = bNode.cluster !== t.cluster;
            const effMult =
              tf.goalMode === 'structural' && crossJump
                ? Number((tf.goalModeMultiplier * 1.12).toFixed(2))
                : Number(tf.goalModeMultiplier.toFixed(2));
            const rawEV =
              (convProb / 100) *
              (0.55 + tf.authorityMultiplier * 0.45) *
              tf.skillSynergyFactor *
              effMult *
              100;
            simulatedTotalEV += Math.min(99, Math.max(15, Math.round(rawEV)));
          }
        }
      }

      const deltaEV = Math.max(0, simulatedTotalEV - baselineTotalEV);
      const optimalPathsRouted = bridgeUsageCount.get(bNode.id) || 0;
      const unlockedList = bridgeUnlockedTargets.get(bNode.id) || [];
      const betweenness = bNode.betweennessCentrality || 0;
      const centralityScore = Math.min(
        99,
        Math.round(currentTrust * 45 + optimalPathsRouted * 15 + deltaEV * 2.2 + betweenness * 35)
      );

      return {
        node: bNode,
        currentTrust,
        boostedTrust,
        deltaEV,
        optimalPathsRouted,
        unlockedTargets: unlockedList,
        centralityScore,
        betweenness,
      };
    })
    .sort((a, b) => b.deltaEV - a.deltaEV || b.centralityScore - a.centralityScore);

  // 4. k-NN Career Trajectory Lookahead Vectors
  const vectorDefinitions = [
    {
      id: 'vec-1',
      title: 'Principal Embodied AI & Humanoid Data Architect',
      horizon: '18–36 Months',
      targetOrgs: ['Tesla Optimus', 'Figure', 'NVIDIA GR00T', 'OpenAI Robotics'],
      rationale:
        'Aligns your Humanoid Robotics Telemetry & Data Ops (94) with Distributed Data Platform Architecture (89).',
    },
    {
      id: 'vec-2',
      title: 'Staff Edge ML & Split-Graph Runtime Systems Lead',
      horizon: '12–24 Months',
      targetOrgs: ['Apple CoreML / MLX', 'OpenAI Inference', 'NVIDIA TensorRT', 'Anthropic Systems'],
      rationale:
        'Leverages your C++/Tauri systems engineering (90), ONNX Runtime graph chunking (95), and Apple MLX acceleration (92).',
    },
    {
      id: 'vec-3',
      title: 'Robotics Data & Eval Platform Founder / VP',
      horizon: '24–48 Months',
      targetOrgs: ['Embodied AI Ventures', 'Frontier Seed / Series A', 'Autonomous Eval Labs'],
      rationale:
        'Follows autonomy & robotics data architects who productized teleop QA harnesses (Loom) and evaluation engines.',
    },
  ];

  const trajectoryVectors: TrajectoryVector[] = vectorDefinitions.map((vec) => {
    const matchingNodes = nodes.filter(
      (n) => n.degree >= 1 && n.pastState3YrsAgo?.vectorCluster === vec.title
    );
    const avgSimilarity =
      matchingNodes.length > 0
        ? Math.round(
            matchingNodes.reduce(
              (s, n) => s + (n.pastState3YrsAgo?.similarityScore || 85),
              0
            ) / matchingNodes.length
          )
        : 0;

    const avgEV =
      matchingNodes.length > 0
        ? Math.round(
            matchingNodes.reduce((s, n) => {
              const p = targetPathsMap.get(n.id)?.[0];
              return s + (p ? p.evScore : n.strategicValue || 75);
            }, 0) / matchingNodes.length
          )
        : 0;

    return {
      ...vec,
      exemplarNodes: matchingNodes.slice(0, 5),
      avgSimilarity,
      avgEV,
    };
  });

  // Honest zero-state KPIs (0 when no targets exist!)
  const avgEVScore =
    rankedOpportunities.length > 0
      ? Math.round(baselineTotalEV / rankedOpportunities.length)
      : 0;

  const avgConversion =
    rankedOpportunities.length > 0
      ? Math.round(
          rankedOpportunities.reduce(
            (sum, item) => sum + item.primaryPath.conversionProb,
            0
          ) / rankedOpportunities.length
        )
      : 0;

  return {
    targetPathsMap,
    rankedOpportunities,
    bridgeConditioning,
    clusterStats: Array.from(clusterStatsMap.values()),
    trajectoryVectors,
    avgEVScore,
    avgConversion,
    baselineTotalEV,
  };
}

/**
 * Goal-Mode Adaptive Double-Opt-In Blurb & Warm Outreach Synthesizer
 */
export function buildGoalAwareOutreach(
  profile: UserProfile,
  pathObj: EvaluatedPath | null,
  templateType: 'forwardable' | 'ask_bridge' | 'direct_dm' = 'forwardable'
): string {
  if (!pathObj || !pathObj.targetNode) return '';
  const { targetNode, bridgeNode, secondBridgeNode, sharedSkills, hops, knnMatchScore } =
    pathObj;
  const mode = profile.activeGoalMode || 'trajectory';

  const skillText =
    sharedSkills.length > 0
      ? sharedSkills.slice(0, 2).join(' and ')
      : profile.skills
          .slice(0, 2)
          .map((s) => s.name)
          .join(' and ');

  const pastRoleRef = targetNode.pastState3YrsAgo?.role
    ? `given your progression from ${targetNode.pastState3YrsAgo.role}`
    : `given your engineering leadership at ${targetNode.company}`;

  let modeAngleSentence = '';
  if (mode === 'trajectory') {
    modeAngleSentence = `Your trajectory (${pastRoleRef} to ${targetNode.role} at ${targetNode.company}, a ${knnMatchScore}% k-NN match to my current stack) maps closely to the architectural path I'm building toward.`;
  } else if (mode === 'infiltration') {
    modeAngleSentence = `As I scale ${profile.headline} at ${profile.currentCompany}, ${targetNode.company}'s technical roadmap under your leadership is right at the top of my radar.`;
  } else if (mode === 'gravity') {
    const repoNote =
      targetNode.githubOverlap && !targetNode.githubOverlap.includes('Imported')
        ? ` (${targetNode.githubOverlap})`
        : '';
    modeAngleSentence = `I've been building C++/Tauri and split-graph ONNX/MLX inference systems${repoNote} with direct overlap around ${skillText}.`;
  } else {
    modeAngleSentence = `Connecting our ${profile.currentCompany} robotics data infrastructure work with your ${targetNode.cluster} focus at ${targetNode.company} looks like a high-value technical bridge.`;
  }

  const targetFirst = targetNode.name.split(' ')[0];

  if (hops === 1 || !bridgeNode || templateType === 'direct_dm') {
    const bridgePrefix =
      bridgeNode && hops > 1
        ? `We share a mutual connection through ${bridgeNode.name} (${bridgeNode.company}), and `
        : '';
    return `Hi ${targetFirst},\n\n${bridgePrefix}I've been following your work as ${targetNode.role} at ${targetNode.company}.\n\n${modeAngleSentence}\n\nI'm based in ${profile.location} focusing on ${skillText}. Would you be open to a focused 15-minute architecture & career chat next week?\n\nBest,\n${profile.name}\n${profile.currentCompany} • ${profile.location}`;
  }

  const bridgeFirst = bridgeNode.name.split(' ')[0];

  if (templateType === 'ask_bridge') {
    const secondHop = secondBridgeNode
      ? ` (via ${secondBridgeNode.name} at ${secondBridgeNode.company})`
      : '';
    return `Hey ${bridgeFirst},\n\nHope things are going well at ${bridgeNode.company}! Quick question — I noticed you're connected with ${targetNode.name} (${targetNode.role} at ${targetNode.company})${secondHop}.\n\n${modeAngleSentence}\n\nIf you feel comfortable making an intro, would you be open to forwarding a short double-opt-in blurb to ${targetFirst}? I included it below so it's zero lift on your end.\n\nAppreciate it!\n${profile.name}`;
  }

  return `Subject: Intro: ${profile.name} (${profile.currentCompany}) <> ${targetFirst} (${targetNode.company})\n\nHi ${bridgeFirst} — thanks again for offering to connect us! Here is a brief forwardable blurb:\n\n---\nHi ${targetFirst},\n\nWanted to introduce ${profile.name} (${profile.location}), who leads work in ${profile.headline} at ${profile.currentCompany}.\n\n• Core Stack: ${profile.skills
    .slice(0, 4)
    .map((s) => `${s.name} (${s.proficiency})`)
    .join(', ')}\n• Context (${
    GOAL_MODES.find((m) => m.id === mode)?.shortLabel
  }): ${modeAngleSentence}\n• Overlap: Hands-on systems work across ${skillText}.\n\nLeaving you two to connect directly!\n\nBest,\n${profile.name}`;
}

/**
 * RFC-4180 CSV parser supporting quoted fields and skipping LinkedIn's top disclaimer rows
 */
export function parseLinkedInCSV(csvText: string): Record<string, string>[] {
  const rawLines = csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return [];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(12, rawLines.length); i++) {
    const lower = rawLines[i].toLowerCase();
    if (
      (lower.includes('first name') && lower.includes('last name')) ||
      (lower.includes('name') && lower.includes('company'))
    ) {
      headerIdx = i;
      break;
    }
  }

  const splitCSVRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = splitCSVRow(rawLines[headerIdx]).map((h) => h.toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = headerIdx + 1; i < rawLines.length; i++) {
    const vals = splitCSVRow(rawLines[i]);
    if (vals.length < 2) continue;
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = vals[idx] || '';
    });
    rows.push(rowObj);
  }

  return rows;
}
