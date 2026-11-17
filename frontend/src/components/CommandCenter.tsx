import React from 'react';
import { 
  Compass, 
  TrendingUp, 
  GitFork, 
  Users, 
  ShieldCheck, 
  Target, 
  ArrowRight, 
  Sparkles, 
  Building2, 
  ChevronRight, 
  MessageSquareCode, 
  Layers
} from 'lucide-react';
import { NetworkGraphState, UserProfile } from '../types/graph';

interface CommandCenterProps {
  graphState: NetworkGraphState;
  userProfile: UserProfile;
  onSelectTarget: (targetId: string) => void;
  onOpenWizard: () => void;
  onOpenImport: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  graphState,
  userProfile,
  onSelectTarget,
  onOpenWizard,
  onOpenImport
}) => {
  const { kpi, top_bridges, calculated_paths } = graphState;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Strategic Career Vector Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Active Career Vector & System Focus</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-snug">
              Humanoid Robotics Data Operations &amp; High-Throughput ML Runtime
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Targeting Tier-1 Autonomous Hardware &amp; Frontier AI architectures through verified 2nd-degree executive bridges.
            </p>
            {/* Target Companies & Roles Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-400 font-medium">Target Ecosystem:</span>
              {(userProfile.target_companies || []).map((comp) => (
                <span 
                  key={comp}
                  className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-800/90 text-slate-200 border border-slate-700/60"
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              onClick={onOpenImport}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Ingest New Archive</span>
            </button>
            <button
              onClick={onOpenWizard}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center gap-2 transition-all"
            >
              <Target className="h-4 w-4 text-purple-400" />
              <span>Calibrate Career Target</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Graph Nodes</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{kpi.total_nodes}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-indigo-400 font-semibold">{kpi.first_degree_count}</span> 1st-deg •{' '}
            <span className="text-emerald-400 font-semibold">{kpi.second_degree_count}</span> 2nd-deg •{' '}
            <span className="text-amber-400 font-semibold">{kpi.third_degree_count}</span> 3rd-deg
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Avg 1st-Degree Trust</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {Math.round(kpi.avg_first_degree_trust * 100)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Computed from DMs &amp; coworker overlap
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">High-Conversion Paths</span>
            <GitFork className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 tracking-tight">
            {kpi.high_probability_paths}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Paths with &ge; 60% conversion probability
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Graph Engine</span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-300 tracking-tight font-mono">
            Dijkstra (-ln w)
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Betweenness Centrality ranked
          </div>
        </div>
      </div>

      {/* Main Grid: Bridge Connectors & Target Paths */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 1st-Degree Bridge Connectors (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">Top 1st-Degree Bridge Connectors</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Ranked by Centrality</span>
          </div>

          <div className="space-y-3">
            {top_bridges.map((bridge, idx) => (
              <div
                key={bridge.id}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-mono text-xs flex items-center justify-center font-bold">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white group-hover:text-indigo-300 transition-colors">
                        {bridge.full_name}
                      </div>
                      <div className="text-xs text-slate-400">{bridge.role}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {bridge.company}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-400 font-medium">
                          {Math.round(bridge.trust_score * 100)}% Trust
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/60 text-indigo-300">
                      C_B: {bridge.betweenness_centrality?.toFixed(2) || '0.30'}
                    </span>
                  </div>
                </div>

                {bridge.notes && (
                  <div className="mt-3 text-[11px] text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800/60">
                    {bridge.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Calculated Networks to Make (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold text-white text-sm">Calculated Target Networks to Make</h3>
            </div>
            <span className="text-[11px] text-slate-400">Weighted Dijkstra shortest routes</span>
          </div>

          <div className="space-y-3">
            {calculated_paths.map((path) => (
              <div
                key={path.target_id}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white truncate">{path.target_name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                      {path.target_company}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {path.target_degree}nd Degree
                    </span>
                  </div>

                  <div className="text-xs text-slate-300">{path.target_role}</div>

                  {/* Bridge Route Path Indicator */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
                    <span className="text-slate-500 font-mono text-[11px]">Via:</span>
                    <span className="font-medium text-indigo-300">{path.bridge_name}</span>
                    <span className="text-[11px] text-slate-500">({path.bridge_company})</span>
                    <ArrowRight className="h-3 w-3 text-slate-600" />
                    <span className="text-[11px] font-mono text-slate-400">Cost: {path.friction_cost}</span>
                  </div>
                </div>

                {/* Conversion Probability & Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Warm Probability</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {path.conversion_prob}%
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectTarget(path.target_id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    <span>Inspect Route</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
