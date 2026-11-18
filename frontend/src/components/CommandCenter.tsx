import React from 'react';
import {
  ArrowRight,
  ChevronRight,
  GitBranch,
  Layers,
  Plus,
  Radar,
  Shield,
  Sparkles,
  Terminal,
  Upload,
  Users,
} from 'lucide-react';
import { ContactNode, GoalModeId, NetworkIntelligence, UserProfile } from '../types/graph';
import { CLUSTER_COLORS, GOAL_MODES } from '../engine/graphEngine';
import { GoalModeSelectorBar } from './GoalModeSelectorBar';

export type TabId = 'command' | 'discovery' | 'graph' | 'calculator' | 'database';

interface CommandCenterProps {
  profile: UserProfile;
  nodes: ContactNode[];
  intelligence: NetworkIntelligence;
  onSelectGoalMode: (mode: GoalModeId) => void;
  onInspectTarget: (targetId: string, destinationTab?: TabId) => void;
  onOpenTab: (tab: TabId) => void;
  onUpdateNodeTrust: (nodeId: string, newTrust: number) => void;
  onOpenAddNode: () => void;
  onNotify: (msg: string) => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  profile,
  nodes,
  intelligence,
  onSelectGoalMode,
  onInspectTarget,
  onOpenTab,
  onUpdateNodeTrust,
  onOpenAddNode,
  onNotify,
}) => {
  const {
    rankedOpportunities,
    bridgeConditioning,
    clusterStats,
    avgEVScore,
    avgConversion,
  } = intelligence;

  const firstDegCount = nodes.filter((n) => n.degree === 1).length;
  const secondDegCount = nodes.filter((n) => n.degree === 2).length;
  const thirdDegCount = nodes.filter((n) => n.degree === 3).length;
  const topLeverageBridge = bridgeConditioning[0];
  const topHoleCluster = [...clusterStats].sort((a, b) => b.holeScore - a.holeScore)[0];

  return (
    <div className="space-y-6">
      <GoalModeSelectorBar
        activeGoalMode={profile.activeGoalMode}
        onSelectGoalMode={onSelectGoalMode}
      />

      {/* Executive Career Vector Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 p-6 overflow-hidden">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>ACTIVE VECTOR // {profile.activeCareerVector?.toUpperCase()}</span>
              </span>
              {profile.repositories?.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                  <span>REPOS: {profile.repositories.join(' • ')}</span>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {profile.name} — <span className="text-cyan-400">{profile.headline}</span>
            </h2>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {profile.skills.map((sk) => (
                <span
                  key={sk.name}
                  className="px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-950/90 text-slate-200 border border-slate-800 flex items-center gap-1.5"
                >
                  <span className="text-cyan-400 font-bold">{sk.proficiency}</span>
                  <span>{sk.name}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => onOpenTab('discovery')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-cyan-500/20"
            >
              <Radar className="w-4 h-4 stroke-[2.5]" />
              <span>Open Goal & GitHub Discovery</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={onOpenAddNode}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Add Contact</span>
              </button>
              <button
                onClick={() => onOpenTab('database')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium transition"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Import CSV / ZIP</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Telemetry KPI Cards (Honest Zero-State Reporting) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Multi-Degree Graph
            </span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2.5 text-3xl font-bold text-white font-mono">
            {nodes.length}{' '}
            <span className="text-sm font-normal text-slate-400">Contacts</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300">
              1°: {firstDegCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
              2°: {secondDegCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
              3°: {thirdDegCount}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Mean Expected Value (EV)
            </span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2.5 text-3xl font-bold text-emerald-400 font-mono">
            {rankedOpportunities.length > 0 ? avgEVScore : '—'}{' '}
            <span className="text-sm font-normal text-slate-400">/ 100 EV</span>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Avg Warm Conversion:{' '}
            <span className="text-cyan-300 font-bold">
              {rankedOpportunities.length > 0 ? `${avgConversion}%` : '—'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Top ΔEV Conditioning Bridge
            </span>
            <GitBranch className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2.5 text-xl font-bold text-white truncate">
            {topLeverageBridge ? topLeverageBridge.node.name : 'No 1° Bridges Yet'}
          </div>
          <div className="text-xs text-amber-300 font-mono">
            {topLeverageBridge
              ? `+${topLeverageBridge.deltaEV} Network EV if strengthened (+0.25)`
              : 'Import LinkedIn CSV to rank bridges'}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Top Structural Hole Cluster
            </span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2.5 text-lg font-bold text-white truncate">
            {topHoleCluster?.cluster || 'Robotics & Embodied AI'}
          </div>
          <div className="text-xs text-purple-300 font-mono">
            Burt Opportunity Index: {topHoleCluster?.holeScore ?? 0}/100
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Ranked Expected-Value Targets */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>
                  Highest Expected-Value (EV) Targets (
                  {GOAL_MODES.find((m) => m.id === profile.activeGoalMode)?.shortLabel})
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ranked via Min-Heap Logarithmic Dijkstra:{' '}
                <code className="text-cyan-300">
                  P(Reach) × Authority × Synergy × ModeBoost
                </code>
              </p>
            </div>
            <button
              onClick={() => onOpenTab('calculator')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>Path & Blurb Synthesizer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {rankedOpportunities.length === 0 ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                <Users className="w-8 h-8 text-cyan-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">
                  {nodes.length === 0
                    ? 'Zero-Placeholder SQLite Workspace Ready'
                    : `${firstDegCount} 1st-Degree Contacts Loaded — Add 2° Targets to Rank Warm Routes`}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {nodes.length === 0
                    ? 'Upload your LinkedIn Connections.csv or data export .zip in the DB tab, scan live GitHub repository stargazers in Discovery, or add contacts directly.'
                    : 'Your 1st-degree network is active. Add 2nd/3rd-degree target decision makers or scan live GitHub contributors to compute multi-hop EV routes.'}
                </p>
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    onClick={() => onOpenTab('database')}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import CSV / ZIP</span>
                  </button>
                  <button
                    onClick={onOpenAddNode}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Add 2° Target</span>
                  </button>
                </div>
              </div>
            ) : (
              rankedOpportunities.slice(0, 25).map(({ target, primaryPath, backupPath }, rankIdx) => {
                const clusterStyle =
                  CLUSTER_COLORS[target.cluster] ||
                  CLUSTER_COLORS['Robotics & Embodied AI'];
                return (
                  <div
                    key={target.id}
                    className="bg-slate-950/85 hover:bg-slate-900/90 border border-slate-800/90 hover:border-cyan-500/40 rounded-xl p-4 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-xs font-bold">
                            #{rankIdx + 1}
                          </span>
                          <span className="font-bold text-white text-sm sm:text-base">
                            {target.name}
                          </span>
                          <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-slate-900 text-slate-300 border border-slate-700">
                            {target.degree}°
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-mono rounded-full border ${clusterStyle.badge}`}
                          >
                            {target.cluster}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          <span className="font-medium text-white">{target.role}</span> @{' '}
                          <span className="text-cyan-400 font-semibold">
                            {target.company}
                          </span>{' '}
                          • {target.location}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono bg-slate-900/90 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                          <span className="text-[10px] text-slate-400 block">
                            EXPECTED VALUE
                          </span>
                          <span className="text-lg font-bold text-emerald-400">
                            {primaryPath.evScore} EV
                          </span>
                        </div>
                        <div className="text-right font-mono hidden sm:block">
                          <span className="text-[10px] text-slate-400 block">P(REACH)</span>
                          <span className="text-sm font-bold text-cyan-300">
                            {primaryPath.conversionProb}%
                          </span>
                        </div>
                        <button
                          onClick={() => onInspectTarget(target.id, 'calculator')}
                          className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1 transition"
                        >
                          <span>Execute</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                        Authority: {primaryPath.authorityLevel} (
                        {primaryPath.authorityMultiplier}x)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                        k-NN 3Yr: {primaryPath.knnMatchScore}%
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-800">
                        Synergy: {primaryPath.skillSynergyFactor}x (
                        {primaryPath.sharedSkills.length} skills)
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500">PRIMARY:</span>
                        {primaryPath.nodes.map((n, idx) => (
                          <React.Fragment key={n.id}>
                            <span
                              className={
                                idx === 0
                                  ? 'text-cyan-400'
                                  : idx === primaryPath.nodes.length - 1
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-white'
                              }
                            >
                              {idx === 0 ? 'You' : `${n.name} (${n.company})`}
                            </span>
                            {idx < primaryPath.nodes.length - 1 && (
                              <span className="text-slate-600">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      {backupPath && (
                        <span className="text-[11px] text-slate-400">
                          Backup via {backupPath.bridgeNode?.name.split(' ')[0]} (
                          {backupPath.evScore} EV)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 5 Cols: O(1) Reverse-Dijkstra Bridge Conditioning */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Highest-Leverage Bridge Conditioning (ΔEV)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulates strengthening each 1st-degree connector by{' '}
                <code className="text-cyan-300">+0.25 trust</code> via O(1) reverse-Dijkstra
                lookups to rank highest marginal network unlock.
              </p>
            </div>

            <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {bridgeConditioning.length === 0 ? (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
                  No 1st-degree bridges recorded yet. Import your LinkedIn CSV/ZIP or add
                  direct contacts to rank ΔEV leverage.
                </div>
              ) : (
                bridgeConditioning
                  .slice(0, 15)
                  .map(
                    ({
                      node,
                      currentTrust,
                      boostedTrust,
                      deltaEV,
                      optimalPathsRouted,
                      unlockedTargets,
                      betweenness,
                    }) => (
                      <div
                        key={node.id}
                        className="bg-slate-950/85 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm truncate">
                                {node.name}
                              </span>
                              <span className="text-xs font-mono text-cyan-400 shrink-0">
                                @ {node.company}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate">{node.role}</p>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs block">
                              +{deltaEV} Total ΔEV
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-mono bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800">
                          <span className="text-slate-300">
                            Trust: <strong className="text-cyan-300">{currentTrust}</strong> →{' '}
                            <strong className="text-emerald-400">{boostedTrust}</strong>
                          </span>
                          <button
                            onClick={() => {
                              onUpdateNodeTrust(node.id, boostedTrust);
                              onNotify(
                                `Updated ${node.name}'s trust to ${boostedTrust} in SQLite (+${deltaEV} ΔEV)!`
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] transition"
                          >
                            Apply +0.25 Boost
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span>Routes {optimalPathsRouted} optimal paths</span>
                          <span>C_B: {betweenness.toFixed(3)}</span>
                        </div>

                        {unlockedTargets.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-900">
                            <span className="text-[10px] font-mono text-slate-500">
                              BRIDGES TO:
                            </span>
                            {unlockedTargets.slice(0, 5).map((t) => (
                              <button
                                key={t.id}
                                onClick={() => onInspectTarget(t.id, 'calculator')}
                                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 text-[10px] font-mono transition"
                              >
                                {t.name} ({t.company})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
