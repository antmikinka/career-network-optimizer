import React, { useState } from 'react';
import { Cpu, Play, Trash2, X } from 'lucide-react';
import {
  AuthorityTier,
  ClusterName,
  ContactNode,
  GraphEdge,
  PipelineExecutionSummary,
  UnifiedAppState,
  UserProfile,
} from '../types/graph';
import { CLUSTERS } from '../engine/graphEngine';
import { syncClient } from '../api/client';

// ============================================================================
// 1. PROFILE, REPOS & TECHNICAL STACK WIZARD MODAL
// ============================================================================

interface OnboardingWizardModalProps {
  profile: UserProfile;
  onSaveProfile: (updated: UserProfile) => void;
  onClearGraph: () => void;
  onClose: () => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  profile,
  onSaveProfile,
  onClearGraph,
  onClose,
}) => {
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillProf, setNewSkillProf] = useState(92);
  const [reposText, setReposText] = useState((profile.repositories || []).join(', '));
  const [targetsText, setTargetsText] = useState(
    (profile.targetCompanies || []).join(', ')
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-xs max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            Profile, GitHub Repositories & Technical Stack Setup
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-mono text-slate-400 block mb-1">Full Name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="font-mono text-slate-400 block mb-1">Current Company</label>
            <input
              type="text"
              value={draft.currentCompany}
              onChange={(e) => setDraft({ ...draft, currentCompany: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="font-mono text-slate-400 block mb-1">Location</label>
            <input
              type="text"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="font-mono text-slate-400 block mb-1">
            Headline / Current Focus (S_0)
          </label>
          <input
            type="text"
            value={draft.headline}
            onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-slate-400 block mb-1">
              GitHub Repositories (owner/repo, comma-separated)
            </label>
            <input
              type="text"
              value={reposText}
              onChange={(e) => setReposText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-mono"
            />
          </div>
          <div>
            <label className="font-mono text-slate-400 block mb-1">
              Target Companies (comma-separated)
            </label>
            <input
              type="text"
              value={targetsText}
              onChange={(e) => setTargetsText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-mono"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="Add technical skill..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
          />
          <input
            type="number"
            min={50}
            max={100}
            value={newSkillProf}
            onChange={(e) => setNewSkillProf(Number(e.target.value))}
            className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-cyan-300 font-mono"
          />
          <button
            type="button"
            onClick={() => {
              if (newSkillName.trim()) {
                setDraft({
                  ...draft,
                  skills: [
                    ...draft.skills,
                    {
                      name: newSkillName.trim(),
                      proficiency: newSkillProf,
                      category: 'Systems',
                    },
                  ],
                });
                setNewSkillName('');
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold"
          >
            + Add Skill
          </button>
        </div>

        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {draft.skills.map((sk, idx) => (
            <div
              key={sk.name}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
            >
              <span className="text-white font-medium truncate">{sk.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={sk.proficiency}
                  onChange={(e) => {
                    const updated = [...draft.skills];
                    updated[idx] = { ...sk, proficiency: Number(e.target.value) };
                    setDraft({ ...draft, skills: updated });
                  }}
                  className="w-20 accent-cyan-400"
                />
                <span className="font-mono text-emerald-400 font-bold w-6">
                  {sk.proficiency}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      skills: draft.skills.filter((_, i) => i !== idx),
                    })
                  }
                  className="text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClearGraph}
            className="px-3 py-2 rounded-xl bg-rose-950/50 text-rose-300 border border-rose-500/30 font-mono"
          >
            Clear All Contacts
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveProfile({
                  ...draft,
                  repositories: reposText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                  targetCompanies: targetsText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold"
            >
              Save to SQLite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. NODE EDITOR MODAL
// ============================================================================

export interface NodeEditorFormData {
  name: string;
  role: string;
  company: string;
  degree: 1 | 2 | 3;
  trustScore: number;
  authorityLevel: AuthorityTier;
  cluster: ClusterName;
  strategicValue: number;
  location: string;
  pastRole3YrsAgo: string;
  similarityScore: number;
  githubOverlap: string;
  skills: string[];
  bridgeId: string;
  context: string;
}

interface NodeEditorModalProps {
  node: ContactNode | null;
  nodes: ContactNode[];
  profile: UserProfile;
  onClose: () => void;
  onSave: (data: NodeEditorFormData) => void;
}

export const NodeEditorModal: React.FC<NodeEditorModalProps> = ({
  node,
  nodes,
  profile,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: node?.name || '',
    role: node?.role || '',
    company: node?.company || '',
    degree: (node?.degree && node.degree >= 1 ? node.degree : 2) as 1 | 2 | 3,
    trustScore: node?.trustScore ?? 0.82,
    authorityLevel: (node?.authorityLevel || 'Staff/Principal') as AuthorityTier,
    cluster: (node?.cluster || 'Robotics & Embodied AI') as ClusterName,
    strategicValue: node?.strategicValue ?? 88,
    location: node?.location || 'Bay Area, CA',
    pastRole3YrsAgo: node?.pastState3YrsAgo?.role || '',
    similarityScore: node?.pastState3YrsAgo?.similarityScore ?? 88,
    githubOverlap: node?.githubOverlap || '',
    skillsText: node?.skills
      ? node.skills.join(', ')
      : profile.skills
          .slice(0, 2)
          .map((s) => s.name)
          .join(', '),
    bridgeId: nodes.find((n) => n.degree === 1)?.id || '',
    context: node?.notes || node?.context || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave({
      ...formData,
      skills: formData.skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-3.5 shadow-2xl text-xs max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {node ? `Edit Contact: ${node.name}` : 'Add Real Contact / Target Node'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-slate-400 block mb-1">Full Name *</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="font-mono text-slate-400 block mb-1">Company *</label>
              <input
                required
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-slate-400 block mb-1">Current Role *</label>
              <input
                required
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="font-mono text-slate-400 block mb-1">
                Decision Authority
              </label>
              <select
                value={formData.authorityLevel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    authorityLevel: e.target.value as AuthorityTier,
                  })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="IC">IC (0.5x)</option>
                <option value="Staff/Principal">Staff/Principal (0.8x)</option>
                <option value="Director/VP/Founder">Director/VP/Founder (1.0x)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="font-mono text-slate-400 block mb-1">Cluster</label>
              <select
                value={formData.cluster}
                onChange={(e) =>
                  setFormData({ ...formData, cluster: e.target.value as ClusterName })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                {CLUSTERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-slate-400 block mb-1">Degree</label>
              <select
                value={formData.degree}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    degree: Number(e.target.value) as 1 | 2 | 3,
                  })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value={1}>1st Degree</option>
                <option value={2}>2nd Degree</option>
                <option value={3}>3rd Degree</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-slate-400 block mb-1">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              value={formData.skillsText}
              onChange={(e) => setFormData({ ...formData, skillsText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="font-mono text-slate-400 block mb-1">
              Historical Role 3 Years Ago (Optional, for k-NN Lookahead)
            </label>
            <input
              type="text"
              value={formData.pastRole3YrsAgo}
              onChange={(e) =>
                setFormData({ ...formData, pastRole3YrsAgo: e.target.value })
              }
              placeholder="e.g. Senior Robotics Engineer"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          {!node && Number(formData.degree) > 1 && (
            <div>
              <label className="font-mono text-slate-400 block mb-1">
                Wire Bridge via Existing Contact (Optional — auto-synthesized by company if
                blank)
              </label>
              <select
                value={formData.bridgeId}
                onChange={(e) => setFormData({ ...formData, bridgeId: e.target.value })}
                className="w-full bg-slate-950 border border-cyan-500/50 rounded-lg px-3 py-2 text-white"
              >
                <option value="">— Auto-match by company or wire later —</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.degree}°] {n.name} — {n.company}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold"
            >
              Save to SQLite & Compute EV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. CUSTOM EDGE CREATOR MODAL
// ============================================================================

interface EdgeCreatorModalProps {
  profile: UserProfile;
  nodes: ContactNode[];
  onClose: () => void;
  onSave: (edge: {
    source: string;
    target: string;
    weight: number;
    context: string;
  }) => void;
}

export const EdgeCreatorModal: React.FC<EdgeCreatorModalProps> = ({
  profile,
  nodes,
  onClose,
  onSave,
}) => {
  const [source, setSource] = useState(nodes[0]?.id || 'user-root');
  const [target, setTarget] = useState(nodes[1]?.id || nodes[0]?.id || '');
  const [weight, setWeight] = useState(0.84);
  const [context, setContext] = useState('Colleague / Technical Bridge');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !target || source === target) return;
    onSave({ source, target, weight, context });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">Wire Custom Graph Edge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="font-mono text-slate-400 block mb-1">Source Node</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="user-root">[0°] {profile.name} (You)</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.degree}°] {n.name} ({n.company})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-mono text-slate-400 block mb-1">Target Node</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.degree}°] {n.name} ({n.company})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-mono text-slate-400 block mb-1">
              Edge Weight w = {weight} (Cost -ln(w) = {(-Math.log(weight)).toFixed(3)})
            </label>
            <input
              type="range"
              min="0.15"
              max="0.98"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <label className="font-mono text-slate-400 block mb-1">Context</label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold"
            >
              Wire Edge in SQLite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. 8-MODULE RECALCULATION & PROCESSING CONSOLE MODAL (FULL SQLITE HYDRATION)
// ============================================================================

interface RecalculationConsoleModalProps {
  profile: UserProfile;
  nodes: ContactNode[];
  edges: GraphEdge[];
  onHydrateState: (newState: UnifiedAppState) => void;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

export const RecalculationConsoleModal: React.FC<RecalculationConsoleModalProps> = ({
  profile,
  nodes,
  onHydrateState,
  onNotify,
  onClose,
}) => {
  const [selectedProcessors, setSelectedProcessors] = useState<Record<string, boolean>>({
    trust: true,
    bridge_synthesis: true,
    synergy: true,
    knn_trajectory: true,
    centrality: true,
    structural_holes: true,
    ev: true,
    delta_ev: true,
  });

  const [params, setParams] = useState({
    half_life_days: 180,
    coworker_bonus: 0.15,
    same_company_weight: 0.78,
    pagerank_damping: 0.85,
    min_synergy_boost: 0.68,
    max_synergy_boost: 1.25,
    trust_boost_step: 0.25,
    goal_mode: profile.activeGoalMode || 'trajectory',
  });

  const [isRunning, setIsRunning] = useState(false);
  const [runLog, setRunLog] = useState<PipelineExecutionSummary | null>(null);

  const PROCESSOR_CONFIGS = [
    {
      id: 'trust',
      name: '1. Connection Trust & Half-Life Decay',
      category: 'Edge Scoring',
      desc: 'Recalculates 1st-degree trust scores & root edge weights from message volume, recency half-life, and coworker overlap.',
      paramLabel: `Half-Life: ${params.half_life_days}d`,
    },
    {
      id: 'bridge_synthesis',
      name: '2. Insider & Company-Overlap Bridge Synthesizer',
      category: 'Topology Inference',
      desc: 'Automatically wires insider colleague bridge edges between 1st-degree contacts and 2nd/3rd-degree targets at matching companies.',
      paramLabel: `Weight: ${params.same_company_weight}`,
    },
    {
      id: 'synergy',
      name: '3. Cosine Skill Synergy & Stack Gravity',
      category: 'Skill Matching',
      desc: 'Computes weighted cosine & token-overlap technical alignment against your competencies and updates strategic values.',
      paramLabel: `Max: ${params.max_synergy_boost}x`,
    },
    {
      id: 'knn_trajectory',
      name: '4. k-NN Career Trajectory Scorer (S_0 vs S_{t-3})',
      category: 'Trajectory Intelligence',
      desc: 'Scores 3-year career progression similarity and maps contacts into optimal next-step career vectors.',
      paramLabel: '3-Yr Window',
    },
    {
      id: 'centrality',
      name: '5. Log-Friction Betweenness Centrality & PageRank',
      category: 'Graph Topology',
      desc: 'Runs NetworkX Betweenness Centrality on -ln(w) costs and conductance PageRank to surface super-connectors.',
      paramLabel: `α = ${params.pagerank_damping}`,
    },
    {
      id: 'structural_holes',
      name: '6. Ronald Burt Structural Holes & Modularity',
      category: 'Network Modularity',
      desc: 'Evaluates cross-cluster bridging density and surfaces underrepresented cluster opportunities.',
      paramLabel: null,
    },
    {
      id: 'ev',
      name: '7. Expected Career Value (EV) Optimizer',
      category: 'Pathfinding & Value',
      desc: 'Persists multi-hop Dijkstra EV = P(Reach) × Authority × Synergy × GoalBoost across all targets.',
      paramLabel: `Mode: ${params.goal_mode}`,
    },
    {
      id: 'delta_ev',
      name: '8. O(1) Reverse-Dijkstra ΔEV Conditioning',
      category: 'Leverage Analysis',
      desc: 'Simulates strengthening each 1st-degree bridge (+0.25) to rank highest marginal network value gain.',
      paramLabel: `+${params.trust_boost_step}`,
    },
  ];

  const handleToggle = (id: string) => {
    setSelectedProcessors((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunPipeline = async () => {
    const activeIds = Object.keys(selectedProcessors).filter(
      (k) => selectedProcessors[k]
    );
    if (activeIds.length === 0) {
      onNotify('Select at least one recalculation module to execute.');
      return;
    }

    setIsRunning(true);
    setRunLog(null);

    try {
      const { pipeline, state } = await syncClient.runRecalculationPipeline(
        activeIds,
        {
          trust: {
            half_life_days: params.half_life_days,
            coworker_bonus: params.coworker_bonus,
          },
          bridge_synthesis: {
            same_company_weight: params.same_company_weight,
          },
          centrality: { pagerank_damping: params.pagerank_damping },
          synergy: {
            min_synergy_boost: params.min_synergy_boost,
            max_synergy_boost: params.max_synergy_boost,
          },
          ev: { goal_mode: params.goal_mode },
          delta_ev: { trust_boost_step: params.trust_boost_step },
        },
        profile.user_id || 'default_user'
      );

      onHydrateState(state);
      setRunLog(pipeline);
      onNotify(
        `SQLite pipeline executed ${pipeline.pipeline_processors_executed.length} modules in ${pipeline.total_execution_time_ms}ms & hydrated live UI!`
      );
    } catch {
      onNotify(
        'Backend offline — reactive client-side graph engine already keeps local metrics up to date.'
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">
              Modular SQLite + NetworkX Recalculation Pipeline ({nodes.length} Contacts)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          <p className="text-slate-300">
            Executes modular Python/NetworkX recalculations directly on{' '}
            <code className="text-cyan-300">data/optimizer.db</code> and hydrates all
            updated trust weights, synthesized bridges, centrality scores, and EV rankings
            back into the live workspace.
          </p>

          <div className="space-y-2">
            {PROCESSOR_CONFIGS.map((proc) => (
              <div
                key={proc.id}
                onClick={() => handleToggle(proc.id)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                  selectedProcessors[proc.id]
                    ? 'bg-slate-950 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-950/50 border-slate-800 opacity-60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      checked={selectedProcessors[proc.id]}
                      onChange={() => {}}
                      className="accent-cyan-400 cursor-pointer"
                    />
                    <span className="font-bold text-white text-xs">{proc.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-cyan-300 border border-slate-800">
                      {proc.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">{proc.desc}</p>
                </div>

                {proc.paramLabel && (
                  <span className="px-2 py-1 rounded bg-slate-900 text-indigo-300 border border-slate-800 font-mono text-[10px] shrink-0">
                    {proc.paramLabel}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Parameter Sliders */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-cyan-400 font-bold">
              Pipeline Hyperparameters
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-300 block mb-1">
                  Half-Life:{' '}
                  <span className="text-cyan-400 font-bold">
                    {params.half_life_days}d
                  </span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="365"
                  step="5"
                  value={params.half_life_days}
                  onChange={(e) =>
                    setParams({ ...params, half_life_days: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-300 block mb-1">
                  PageRank α:{' '}
                  <span className="text-purple-400 font-bold">
                    {params.pagerank_damping}
                  </span>
                </label>
                <input
                  type="range"
                  min="0.50"
                  max="0.99"
                  step="0.01"
                  value={params.pagerank_damping}
                  onChange={(e) =>
                    setParams({ ...params, pagerank_damping: Number(e.target.value) })
                  }
                  className="w-full accent-purple-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-300 block mb-1">
                  ΔEV Boost:{' '}
                  <span className="text-amber-400 font-bold">
                    +{params.trust_boost_step}
                  </span>
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.45"
                  step="0.05"
                  value={params.trust_boost_step}
                  onChange={(e) =>
                    setParams({ ...params, trust_boost_step: Number(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>

          {runLog && (
            <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-4 space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>STATUS: {runLog.status.toUpperCase()}</span>
                <span>TOTAL TIME: {runLog.total_execution_time_ms}ms</span>
              </div>
              <div className="space-y-1 text-slate-300 border-t border-slate-800 pt-2">
                {runLog.results.map((r) => (
                  <div
                    key={r.processor_id}
                    className="flex items-start justify-between gap-2"
                  >
                    <span className="text-slate-200">
                      <strong className="text-cyan-400">[{r.processor_id}]</strong>{' '}
                      {r.message}
                    </span>
                    <span className="text-slate-500 shrink-0">
                      {r.execution_time_ms}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="font-mono text-[11px] text-slate-400">
            CLI: <code>python backend/recalculate.py --pipeline</code>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={handleRunPipeline}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? 'Executing...' : 'Execute Pipeline'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
