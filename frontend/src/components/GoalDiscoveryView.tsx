import React, { useMemo, useState } from 'react';
import {
  Check,
  ExternalLink,
  GitPullRequest,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  ContactNode,
  GitHubCandidate,
  GoalModeId,
  NetworkIntelligence,
  UserProfile,
} from '../types/graph';
import { CLUSTER_COLORS } from '../engine/graphEngine';
import { syncClient } from '../api/client';
import { GoalModeSelectorBar } from './GoalModeSelectorBar';
import { TabId } from './CommandCenter';

interface GoalDiscoveryViewProps {
  profile: UserProfile;
  nodes: ContactNode[];
  intelligence: NetworkIntelligence;
  onSelectGoalMode: (mode: GoalModeId) => void;
  onSelectCareerVector: (vecTitle: string) => void;
  onInjectCandidate: (cand: GitHubCandidate) => void;
  onInspectTarget: (targetId: string, destinationTab?: TabId) => void;
  onOpenAddEdge: () => void;
  onNotify: (msg: string) => void;
}

export const GoalDiscoveryView: React.FC<GoalDiscoveryViewProps> = ({
  profile,
  nodes,
  intelligence,
  onSelectGoalMode,
  onSelectCareerVector,
  onInjectCandidate,
  onInspectTarget,
  onOpenAddEdge,
  onNotify,
}) => {
  const { trajectoryVectors, clusterStats } = intelligence;
  const [selectedRepoFilter, setSelectedRepoFilter] = useState('ALL');
  const [githubCandidates, setGithubCandidates] = useState<GitHubCandidate[]>([]);
  const [isScanningGitHub, setIsScanningGitHub] = useState(false);
  const [scanNotes, setScanNotes] = useState<string[]>([]);

  const handleScanLiveGitHub = async () => {
    setIsScanningGitHub(true);
    try {
      const res = await syncClient.discoverGitHubCandidates(profile.user_id || 'default_user');
      setGithubCandidates(res.candidates);
      setScanNotes(res.notes || []);
      if (res.candidates.length > 0) {
        onNotify(
          `Discovered ${res.candidates.length} real GitHub contributors/stargazers across your repositories!`
        );
      } else {
        onNotify(
          res.notes.length > 0
            ? `GitHub scan completed (${res.notes[0]}). Check repo names in Setup Wizard.`
            : 'GitHub scan completed — 0 external stargazers/contributors found on configured public repos.'
        );
      }
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Unable to reach backend GitHub discovery.'
      );
    } finally {
      setIsScanningGitHub(false);
    }
  };

  const filteredCandidates = useMemo(() => {
    if (selectedRepoFilter === 'ALL') return githubCandidates;
    return githubCandidates.filter((c) => c.repoSource === selectedRepoFilter);
  }, [githubCandidates, selectedRepoFilter]);

  return (
    <div className="space-y-6">
      <GoalModeSelectorBar
        activeGoalMode={profile.activeGoalMode}
        onSelectGoalMode={onSelectGoalMode}
      />

      {/* SUB-PANEL A: k-NN CAREER TRAJECTORY LOOKAHEAD */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Sub-Engine A: k-NN Career Trajectory Lookahead (S_0 vs. S_&#123;t-3&#125;)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Compares your current state against 3-year historical career progressions across
              real contacts in your graph.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs shrink-0">
            Active Vector: {profile.activeCareerVector}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {trajectoryVectors.map((vec) => {
            const isCurrent = profile.activeCareerVector === vec.title;
            return (
              <div
                key={vec.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between space-y-4 transition ${
                  isCurrent
                    ? 'bg-gradient-to-b from-cyan-950/40 to-slate-950 border-cyan-400/60 shadow-lg shadow-cyan-950/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 font-mono text-xs">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      Horizon: {vec.horizon}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {vec.exemplarNodes.length > 0
                        ? `k-NN Match: ${vec.avgSimilarity}%`
                        : 'Awaiting Contacts'}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">{vec.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{vec.rationale}</p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {vec.targetOrgs.map((org) => (
                      <span
                        key={org}
                        className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800 font-mono text-[10px]"
                      >
                        {org}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      MATCHED CONTACTS IN YOUR GRAPH ({vec.exemplarNodes.length}):
                    </span>
                    {vec.exemplarNodes.length === 0 ? (
                      <div className="text-[11px] text-slate-500 font-mono italic py-1">
                        Import real contacts and run the k-NN Trajectory Processor to populate
                        exemplars.
                      </div>
                    ) : (
                      vec.exemplarNodes.map((ex) => (
                        <div
                          key={ex.id}
                          onClick={() => onInspectTarget(ex.id, 'calculator')}
                          className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg p-2 cursor-pointer transition flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-white truncate">
                              {ex.name}{' '}
                              <span className="text-cyan-400 font-mono">({ex.company})</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {ex.role}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                            {ex.pastState3YrsAgo?.similarityScore || 85}%
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onSelectCareerVector(vec.title)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition ${
                    isCurrent
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  {isCurrent ? '✓ Active Career Vector' : 'Set as Active Career Vector'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* SUB-PANEL B & C SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sub-Panel B: LIVE GitHub Public API Contributor/Stargazer Scanner */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-purple-400" />
                <span>Sub-Engine B: Live GitHub Repo + LinkedIn Bridge Scanner</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Queries the live GitHub REST API for real contributors & stargazers on your
                repositories and pairs them with 1st-degree LinkedIn company bridges.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedRepoFilter}
                onChange={(e) => setSelectedRepoFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-cyan-300"
              >
                <option value="ALL">
                  All Repos ({profile.repositories?.length || 0})
                </option>
                {(profile.repositories || []).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <button
                onClick={handleScanLiveGitHub}
                disabled={isScanningGitHub}
                className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanningGitHub ? 'animate-spin' : ''}`}
                />
                <span>{isScanningGitHub ? 'Scanning GitHub...' : 'Scan Live GitHub API'}</span>
              </button>
            </div>
          </div>

          {scanNotes.length > 0 && (
            <div className="text-[11px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
              API Notes: {scanNotes.join(' • ')}
            </div>
          )}

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredCandidates.length === 0 ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                <GitPullRequest className="w-7 h-7 text-purple-400 mx-auto" />
                <p className="text-xs text-slate-200 font-semibold">
                  Zero Synthetic Candidates — Click "Scan Live GitHub API" Above
                </p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Fetches real contributors and stargazers from{' '}
                  <code className="text-cyan-300">
                    {(profile.repositories || []).join(', ') || 'your configured GitHub repos'}
                  </code>{' '}
                  and matches their company fields against your real 1st-degree SQLite contacts.
                </p>
              </div>
            ) : (
              filteredCandidates.map((cand) => {
                const alreadyAdded = nodes.some(
                  (n) =>
                    n.id === cand.id || n.name.toLowerCase() === cand.name.toLowerCase()
                );
                return (
                  <div
                    key={cand.id}
                    className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{cand.name}</span>
                          <a
                            href={cand.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-mono text-cyan-400 hover:underline inline-flex items-center gap-1"
                          >
                            @{cand.login}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono text-[10px]">
                            {cand.repoSource}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          {cand.role} •{' '}
                          <span className="text-cyan-300">{cand.company}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => onInjectCandidate(cand)}
                        disabled={alreadyAdded}
                        className={`px-3.5 py-2 rounded-xl font-mono text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                          alreadyAdded
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950'
                        }`}
                      >
                        {alreadyAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>In Graph</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Inject 2° Target</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-xs bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                      <div className="text-purple-300 font-mono text-[11px]">
                        <strong>GitHub Signal:</strong> {cand.githubSignal}
                      </div>
                      <div className="text-emerald-300 font-mono text-[11px]">
                        <strong>Bridge Route:</strong> {cand.bridgeContext}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sub-Panel C: Ronald Burt Structural Holes Matrix */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Sub-Engine C: Structural Holes & Modularity Matrix</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Identifies network clusters with high target density relative to 1st-degree
                insider coverage (Ronald Burt's Structural Holes).
              </p>
            </div>

            <div className="space-y-3">
              {clusterStats.map((stat) => {
                const style =
                  CLUSTER_COLORS[stat.cluster] || CLUSTER_COLORS['Robotics & Embodied AI'];
                return (
                  <div
                    key={stat.cluster}
                    className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono border ${style.badge}`}
                      >
                        {stat.cluster}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        Hole Index: {stat.holeScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs pt-1">
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">1° BRIDGES</span>
                        <span className="text-sky-300 font-bold">{stat.firstDegCount}</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">2°/3° TARGETS</span>
                        <span className="text-indigo-300 font-bold">{stat.targetCount}</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">CROSS-BRIDGES</span>
                        <span className="text-emerald-300 font-bold">
                          {stat.externalBridges}
                        </span>
                      </div>
                    </div>

                    {stat.firstDegCount === 0 && (
                      <div className="text-[11px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
                        Structural Hole: 0 direct 1st-degree bridges in {stat.cluster}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={onOpenAddEdge}
            className="w-full py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/35 font-mono text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            <Link2 className="w-4 h-4" />
            <span>+ Wire Cross-Cluster Bridge Edge</span>
          </button>
        </div>
      </div>
    </div>
  );
};
