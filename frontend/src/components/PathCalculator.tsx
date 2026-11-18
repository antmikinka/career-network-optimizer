import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Sparkles, Zap } from 'lucide-react';
import {
  ContactNode,
  EvaluatedPath,
  GoalModeId,
  GraphEdge,
  NetworkIntelligence,
  UserProfile,
} from '../types/graph';
import {
  buildGoalAwareOutreach,
  computePathsAndEV,
  GOAL_MODES,
} from '../engine/graphEngine';
import { GoalModeSelectorBar } from './GoalModeSelectorBar';

interface PathCalculatorProps {
  profile: UserProfile;
  nodes: ContactNode[];
  edges: GraphEdge[];
  intelligence: NetworkIntelligence;
  selectedTargetId: string | null;
  setSelectedTargetId: (id: string | null) => void;
  compareTargetId: string | null;
  setCompareTargetId: (id: string | null) => void;
  selectedNodePaths: EvaluatedPath[];
  onSelectGoalMode: (mode: GoalModeId) => void;
  onNotify: (msg: string) => void;
}

export const PathCalculator: React.FC<PathCalculatorProps> = ({
  profile,
  nodes,
  edges,
  intelligence,
  selectedTargetId,
  setSelectedTargetId,
  compareTargetId,
  setCompareTargetId,
  selectedNodePaths,
  onSelectGoalMode,
  onNotify,
}) => {
  const [templateType, setTemplateType] = useState<
    'forwardable' | 'ask_bridge' | 'direct_dm'
  >('forwardable');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const primaryPath = selectedNodePaths[0] || null;
  const backupPath = selectedNodePaths[1] || null;

  const comparePaths = useMemo(() => {
    const clusterMap = new Map(intelligence.clusterStats.map((c) => [c.cluster, c]));
    return computePathsAndEV(profile, nodes, edges, compareTargetId, clusterMap);
  }, [profile, nodes, edges, compareTargetId, intelligence.clusterStats]);
  const comparePrimary = comparePaths[0] || null;

  useEffect(() => {
    if (primaryPath) {
      setCustomMessage(buildGoalAwareOutreach(profile, primaryPath, templateType));
    } else {
      setCustomMessage('');
    }
  }, [profile, primaryPath, templateType]);

  const handleCopy = () => {
    if (!customMessage) return;
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    onNotify('Copied goal-tailored warm intro blurb to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <GoalModeSelectorBar
        activeGoalMode={profile.activeGoalMode}
        onSelectGoalMode={onSelectGoalMode}
      />

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span>Dijkstra EV Path Calculator & Double-Opt-In Blurb Synthesizer</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Outreach angle automatically adapts to your active Goal Mode (
            <strong className="text-cyan-300">
              {GOAL_MODES.find((m) => m.id === profile.activeGoalMode)?.name}
            </strong>
            )
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] font-mono uppercase text-cyan-400 block mb-1">
              PRIMARY TARGET NODE
            </label>
            <select
              value={selectedTargetId || ''}
              onChange={(e) => setSelectedTargetId(e.target.value || null)}
              className="bg-slate-950 border border-cyan-500/50 rounded-xl px-3 py-2 text-xs text-white font-medium min-w-[220px]"
            >
              <option value="">— Select Contact —</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.degree}°] {n.name} — {n.role} ({n.company})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-indigo-400 block mb-1">
              COMPARE TARGET
            </label>
            <select
              value={compareTargetId || ''}
              onChange={(e) => setCompareTargetId(e.target.value || null)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 min-w-[200px]"
            >
              <option value="">— Optional Comparison —</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.degree}°] {n.name} — {n.company}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!primaryPath ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Zap className="w-8 h-8 text-cyan-400 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {selectedTargetId
              ? 'No Connected Bridge Path Found to This Node'
              : 'Select a Target Contact Above'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {nodes.length === 0
              ? 'Upload your LinkedIn Connections.csv or .zip archive in the DB tab to populate your real network and compute multi-hop Dijkstra paths.'
              : selectedTargetId
              ? 'Wire a bridge edge from one of your 1st-degree contacts to this node (or run the Company Bridge Synthesizer in Recalculate & Process).'
              : 'Choose any 1st-, 2nd-, or 3rd-degree contact from the dropdown above to evaluate logarithmic friction costs and generate double-opt-in blurbs.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: EV Breakdown & Hop Chain */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block">
                    EXPECTED VALUE
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {primaryPath.evScore} EV
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block">
                    P(REACH)
                  </span>
                  <span className="text-xl font-bold font-mono text-cyan-300">
                    {primaryPath.conversionProb}%
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block">
                    AUTHORITY TIER
                  </span>
                  <span className="text-base font-bold font-mono text-indigo-300">
                    {primaryPath.authorityMultiplier}x (
                    {primaryPath.authorityLevel.split('/')[0]})
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 block">
                    k-NN 3YR SIMILARITY
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-300">
                    {primaryPath.knnMatchScore}%
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Primary Route #1 Hop-by-Hop Log Friction Chain
                </h3>
                {primaryPath.nodes.map((node, i) => {
                  const edge = primaryPath.edges[i];
                  return (
                    <div key={node.id}>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center">
                            H{i}
                          </span>
                          <div>
                            <div className="font-bold text-white text-sm">
                              {node.name}{' '}
                              <span className="text-xs font-mono text-cyan-400">
                                @ {node.company}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">{node.role}</div>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          {i === 0 ? 'Origin (0°)' : node.cluster}
                        </span>
                      </div>

                      {edge && (
                        <div className="my-1.5 ml-6 pl-4 border-l-2 border-dashed border-cyan-500/40 py-1 flex flex-wrap items-center justify-between text-xs font-mono">
                          <span className="text-slate-300">{edge.context}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400">w = {edge.weight}</span>
                            <span className="text-cyan-300">
                              -ln(w) = {edge.cost.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-400 font-bold">PRIMARY ROUTE #1</span>
                    <span className="text-emerald-400 font-bold">
                      {primaryPath.evScore} EV ({primaryPath.conversionProb}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono">
                    {primaryPath.nodes.map((n) => n.name.split(' ')[0]).join(' → ')}
                  </p>
                </div>

                {backupPath ? (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-indigo-300 font-bold">BACKUP ROUTE #2</span>
                      <span className="text-indigo-300 font-bold">
                        {backupPath.evScore} EV ({backupPath.conversionProb}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono">
                      {backupPath.nodes.map((n) => n.name.split(' ')[0]).join(' → ')}
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3.5 flex items-center justify-center text-xs text-slate-500 font-mono">
                    Single optimal bridge route
                  </div>
                )}
              </div>
            </div>

            {comparePrimary && compareTargetId !== selectedTargetId && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-mono uppercase text-indigo-400">
                  Expected Value Comparison: {primaryPath.targetNode.name} vs.{' '}
                  {comparePrimary.targetNode.name}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="font-bold text-white">
                      {primaryPath.targetNode.name} ({primaryPath.targetNode.company})
                    </div>
                    <div className="text-emerald-400 font-mono mt-1">
                      EV: {primaryPath.evScore} • P(Reach): {primaryPath.conversionProb}% •
                      Authority: {primaryPath.authorityMultiplier}x
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="font-bold text-white">
                      {comparePrimary.targetNode.name} (
                      {comparePrimary.targetNode.company})
                    </div>
                    <div className="text-cyan-400 font-mono mt-1">
                      EV: {comparePrimary.evScore} • P(Reach):{' '}
                      {comparePrimary.conversionProb}% • Authority:{' '}
                      {comparePrimary.authorityMultiplier}x
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Goal-Mode Adaptive Outreach Synthesizer */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Goal-Mode Adaptive Outreach Synthesizer</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically frames your intro around{' '}
                  <strong className="text-cyan-300">
                    {GOAL_MODES.find((m) => m.id === profile.activeGoalMode)?.shortLabel}
                  </strong>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {[
                  { id: 'forwardable' as const, label: 'Forwardable Blurb' },
                  {
                    id: 'ask_bridge' as const,
                    label: `Ask ${primaryPath.bridgeNode?.name.split(' ')[0] || 'Bridge'}`,
                  },
                  { id: 'direct_dm' as const, label: 'Direct Warm DM' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateType(t.id)}
                    className={`py-2 px-2 rounded-lg font-medium transition ${
                      templateType === t.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={15}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/20"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Copied Outreach to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Goal-Tailored Outreach</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
