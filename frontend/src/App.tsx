import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Cpu,
  Database,
  Network,
  Radar,
  RefreshCw,
  Share2,
  Sliders,
  Zap,
} from 'lucide-react';
import {
  ContactNode,
  GitHubCandidate,
  GoalModeId,
  GraphEdge,
  UnifiedAppState,
  UserProfile,
} from './types/graph';
import {
  calculateAutoTrustScore,
  computeNetworkIntelligence,
  computePathsAndEV,
  DEFAULT_PROFILE,
  GOAL_MODES,
  parseLinkedInCSV,
} from './engine/graphEngine';
import { loadLocalCache, saveLocalCache, syncClient } from './api/client';
import { CommandCenter, TabId } from './components/CommandCenter';
import { GoalDiscoveryView } from './components/GoalDiscoveryView';
import { NetworkGraph } from './components/NetworkGraph';
import { PathCalculator } from './components/PathCalculator';
import { DatabaseIngestView } from './components/DatabaseIngestView';
import {
  EdgeCreatorModal,
  NodeEditorFormData,
  NodeEditorModal,
  OnboardingWizardModal,
  RecalculationConsoleModal,
} from './components/Modals';

export const App: React.FC = () => {
  const [dbState, setDbState] = useState<UnifiedAppState>(() => loadLocalCache());
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<TabId>('command');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showAddEdgeModal, setShowAddEdgeModal] = useState(false);
  const [editingNode, setEditingNode] = useState<ContactNode | null>(null);
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const trustPatchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { profile, nodes, edges } = dbState;

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  // Hydrate canonical SQLite state from FastAPI on mount
  useEffect(() => {
    let cancelled = false;
    syncClient.fetchUnifiedState('default_user').then(({ state, backendOnline: online }) => {
      if (cancelled) return;
      setDbState(state);
      setBackendOnline(online);
      setIsHydrating(false);
      const firstTarget = state.nodes.find((n) => n.degree >= 2) || state.nodes[0];
      if (firstTarget) setSelectedTargetId(firstTarget.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep localStorage cache synchronized with live state
  useEffect(() => {
    if (!isHydrating) {
      saveLocalCache(dbState);
    }
  }, [dbState, isHydrating]);

  // Full Graph Intelligence + O(1) Reverse-Dijkstra Delta-EV Engine
  const intelligence = useMemo(
    () => computeNetworkIntelligence(profile, nodes, edges),
    [profile, nodes, edges]
  );

  const selectedNodePaths = useMemo(() => {
    const clusterMap = new Map(intelligence.clusterStats.map((c) => [c.cluster, c]));
    return computePathsAndEV(profile, nodes, edges, selectedTargetId, clusterMap);
  }, [profile, nodes, edges, selectedTargetId, intelligence.clusterStats]);

  const handleSetGoalMode = async (modeId: GoalModeId) => {
    const updatedProfile: UserProfile = { ...profile, activeGoalMode: modeId };
    setDbState((prev) => ({ ...prev, profile: updatedProfile }));
    const modeObj = GOAL_MODES.find((m) => m.id === modeId);
    if (modeObj) notify(`Switched EV Engine to "${modeObj.name}"`);
    await syncClient.updateProfile(updatedProfile);
  };

  const handleSaveProfile = async (updatedProfile: UserProfile) => {
    setDbState((prev) => ({ ...prev, profile: updatedProfile }));
    const synced = await syncClient.updateProfile(updatedProfile);
    if (synced) {
      setDbState(synced);
      setBackendOnline(true);
    }
    notify('Saved profile, GitHub repos & technical stack to SQLite!');
  };

  // Optimistic UI slider update + debounced SQLite PATCH
  const handleUpdateNodeTrust = (nodeId: string, newTrust: number) => {
    const clamped = Number(Math.max(0.05, Math.min(0.99, Number(newTrust))).toFixed(2));
    setDbState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, trustScore: clamped } : n
      ),
      edges: prev.edges.map((e) =>
        (e.source === 'user-root' && e.target === nodeId) ||
        (e.target === 'user-root' && e.source === nodeId)
          ? { ...e, weight: clamped }
          : e
      ),
    }));

    const prevTimer = trustPatchTimers.current.get(nodeId);
    if (prevTimer) clearTimeout(prevTimer);
    trustPatchTimers.current.set(
      nodeId,
      setTimeout(() => {
        syncClient.patchNode(nodeId, { trustScore: clamped });
      }, 220)
    );
  };

  const handleInspectTarget = (targetId: string, destinationTab: TabId = 'calculator') => {
    setSelectedTargetId(targetId);
    setActiveTab(destinationTab);
  };

  const handleSaveNodeModal = async (formData: NodeEditorFormData) => {
    if (editingNode) {
      setDbState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === editingNode.id
            ? {
                ...n,
                name: formData.name,
                role: formData.role,
                company: formData.company,
                degree: formData.degree,
                trustScore: Number(formData.trustScore),
                authorityLevel: formData.authorityLevel,
                cluster: formData.cluster,
                strategicValue: Number(formData.strategicValue),
                location: formData.location,
                skills: formData.skills,
                pastState3YrsAgo: formData.pastRole3YrsAgo
                  ? {
                      role: formData.pastRole3YrsAgo,
                      similarityScore: Number(formData.similarityScore || 88),
                      vectorCluster: profile.activeCareerVector,
                    }
                  : null,
                githubOverlap: formData.githubOverlap,
                notes: formData.context,
              }
            : n
        ),
      }));
      await syncClient.patchNode(editingNode.id, {
        name: formData.name,
        role: formData.role,
        company: formData.company,
        degree: formData.degree,
        trustScore: Number(formData.trustScore),
        authorityLevel: formData.authorityLevel,
        cluster: formData.cluster,
        strategicValue: Number(formData.strategicValue),
        location: formData.location,
        skills: formData.skills,
        pastRole3YrsAgo: formData.pastRole3YrsAgo,
        similarityScore: Number(formData.similarityScore || 88),
        githubOverlap: formData.githubOverlap,
        notes: formData.context,
      });
      notify(`Updated ${formData.name} in SQLite.`);
    } else {
      const serverState = await syncClient.createNode({
        name: formData.name,
        role: formData.role,
        company: formData.company,
        degree: formData.degree,
        trustScore: Number(formData.trustScore),
        authorityLevel: formData.authorityLevel,
        cluster: formData.cluster,
        strategicValue: Number(formData.strategicValue),
        location: formData.location,
        skills: formData.skills,
        pastRole3YrsAgo: formData.pastRole3YrsAgo,
        similarityScore: Number(formData.similarityScore || 88),
        githubOverlap: formData.githubOverlap,
        bridgeId: formData.degree > 1 ? formData.bridgeId : undefined,
        notes: formData.context,
      });

      if (serverState) {
        setDbState(serverState);
        setBackendOnline(true);
        const created = serverState.nodes.find(
          (n) => n.name.toLowerCase() === formData.name.toLowerCase()
        );
        if (created) setSelectedTargetId(created.id);
      } else {
        const newId = `n_${Date.now()}`;
        const newNode: ContactNode = {
          id: newId,
          name: formData.name,
          role: formData.role,
          company: formData.company,
          location: formData.location,
          degree: formData.degree,
          trustScore: Number(formData.trustScore),
          authorityLevel: formData.authorityLevel,
          cluster: formData.cluster,
          strategicValue: Number(formData.strategicValue),
          skills: formData.skills,
          pastState3YrsAgo: formData.pastRole3YrsAgo
            ? {
                role: formData.pastRole3YrsAgo,
                similarityScore: Number(formData.similarityScore || 88),
                vectorCluster: profile.activeCareerVector,
              }
            : null,
          githubOverlap: formData.githubOverlap,
          notes: formData.context,
        };
        const bridgeSrc = formData.degree === 1 ? 'user-root' : formData.bridgeId;
        setDbState((prev) => ({
          ...prev,
          nodes: [...prev.nodes, newNode],
          edges: bridgeSrc
            ? [
                ...prev.edges,
                {
                  id: `e_${Date.now()}`,
                  source: bridgeSrc,
                  target: newId,
                  weight: Number(formData.trustScore),
                  context: formData.context || 'Direct Network Edge',
                },
              ]
            : prev.edges,
        }));
        setSelectedTargetId(newId);
      }
      notify(`Added ${formData.name} (${formData.company}) & computed EV!`);
    }
    setShowAddNodeModal(false);
    setEditingNode(null);
  };

  const handleInjectCandidate = async (cand: GitHubCandidate) => {
    const serverState = await syncClient.createNode({
      id: cand.id,
      name: cand.name,
      role: cand.role,
      company: cand.company,
      location: cand.location,
      degree: 2,
      trustScore: cand.trustScore,
      authorityLevel: cand.authorityLevel,
      cluster: cand.cluster,
      strategicValue: cand.strategicValue,
      skills: cand.skills,
      githubOverlap: cand.githubSignal,
      bridgeId: cand.bridgeNodeId,
      bridgeWeight: cand.bridgeEdgeWeight,
      notes: cand.bridgeContext,
    });

    if (serverState) {
      setDbState(serverState);
      setSelectedTargetId(cand.id);
      notify(`Injected ${cand.name} (@${cand.login}) into SQLite & computed EV!`);
    }
  };

  const handleFileIngest = async (file: File) => {
    try {
      const { results, state } = await syncClient.uploadLinkedInFile(file);
      setDbState(state);
      setBackendOnline(true);
      notify(
        `SQLite Ingest Complete: ${results.first_degree_count} 1st-deg contacts synced, ${results.bridges_synthesized} company bridges wired!`
      );
      return;
    } catch (err) {
      // Offline CSV fallback if FastAPI is unreachable and file is .csv
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const rows = parseLinkedInCSV(text);
        if (rows.length === 0) {
          notify('No valid contact rows detected in CSV.');
          return;
        }
        const newNodes = [...nodes];
        const newEdges = [...edges];
        const targetSet = new Set(profile.targetCompanies.map((c) => c.toLowerCase()));
        let added = 0;

        rows.forEach((row, idx) => {
          const fullName =
            row['name'] || `${row['first name'] || ''} ${row['last name'] || ''}`.trim();
          if (!fullName) return;
          const company = row['company'] || row['organization'] || 'Independent';
          const role = row['position'] || row['role'] || 'Engineer';
          if (
            newNodes.some(
              (n) =>
                n.name.toLowerCase() === fullName.toLowerCase() &&
                n.company.toLowerCase() === company.toLowerCase()
            )
          ) {
            return;
          }
          const msgCount = Number(row['messages'] || 0) || 0;
          const isCoworker =
            company.toLowerCase() === profile.currentCompany.toLowerCase() ||
            targetSet.has(company.toLowerCase());
          const trust = calculateAutoTrustScore(msgCount, 60, isCoworker);
          const nid = `n_csv_${Date.now()}_${idx}`;
          newNodes.push({
            id: nid,
            name: fullName,
            role,
            company,
            location: 'Bay Area, CA',
            degree: 1,
            trustScore: trust,
            authorityLevel: 'Staff/Principal',
            cluster: 'Robotics & Embodied AI',
            strategicValue: isCoworker ? 88 : 72,
            skills: ['Distributed Data Platform Architecture'],
            messageCount: msgCount,
            notes: `Imported from ${file.name}`,
          });
          newEdges.push({
            id: `e_csv_${Date.now()}_${idx}`,
            source: 'user-root',
            target: nid,
            weight: trust,
            context: `LinkedIn 1st-degree (${file.name})`,
          });
          added++;
        });
        setDbState((prev) => ({ ...prev, nodes: newNodes, edges: newEdges }));
        notify(`Imported ${added} contacts into local cache.`);
      } else {
        notify(err instanceof Error ? err.message : 'Upload failed.');
      }
    }
  };

  const handleResumeIngest = async (text: string) => {
    try {
      const { skills_saved, state } = await syncClient.uploadResume(text);
      setDbState(state);
      setBackendOnline(true);
      notify(`Extracted & saved ${skills_saved} technical skills into SQLite!`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Resume parsing failed.');
    }
  };

  const handleResetClean = async () => {
    const serverState = await syncClient.resetDatabase('default_user');
    if (serverState) {
      setDbState(serverState);
      setBackendOnline(true);
    } else {
      setDbState({
        profile: DEFAULT_PROFILE,
        nodes: [],
        edges: [],
        lastSavedAt: new Date().toISOString(),
      });
    }
    setSelectedTargetId(null);
    notify(
      'Database reset cleanly: Anthony Mikinka root profile • 0 placeholder contacts.'
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-cyan-200 flex flex-col">
      {/* TOP TELEMETRY & NAVIGATION BAR */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-[1640px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-emerald-500 p-[1px] shadow-lg shadow-cyan-500/15 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                  <Network className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    NEXUS
                    <span className="text-cyan-400 font-mono text-xs sm:text-sm ml-1.5">
                      // CAREER & NETWORK OPTIMIZER
                    </span>
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                      backendOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    {backendOnline ? 'SQLite WAL Live' : 'Local Cache'} • {nodes.length}{' '}
                    Contacts • {edges.length} Edges
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="font-semibold text-slate-200">{profile.name}</span>
                  <span>•</span>
                  <span className="text-cyan-400 font-mono">{profile.currentCompany}</span>
                  <span className="hidden md:inline">•</span>
                  <span className="hidden md:inline text-slate-400 truncate max-w-lg">
                    {profile.headline}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 xl:hidden">
              <button
                onClick={() => setShowRecalcModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-medium shrink-0"
              >
                Recalc
              </button>
              <button
                onClick={() => setShowOnboarding(true)}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-mono font-medium shrink-0"
              >
                Wizard
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 xl:pb-0">
            <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'command' as const, label: 'Command Center', icon: Compass },
                {
                  id: 'discovery' as const,
                  label: 'Goal & GitHub Discovery',
                  icon: Radar,
                },
                { id: 'graph' as const, label: 'Network Graph', icon: Share2 },
                { id: 'calculator' as const, label: 'Path & Outreach', icon: Zap },
                { id: 'database' as const, label: 'DB, CSV & SQLite', icon: Database },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500/25 to-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isActive ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="hidden xl:flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowRecalcModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 text-xs font-mono transition shadow-sm"
                title="Run 8-Module SQLite + NetworkX Recalculation Pipeline"
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Recalculate & Process</span>
              </button>
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/35 text-xs font-mono transition"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Setup Wizard</span>
              </button>
              <button
                onClick={async () => {
                  const { state, backendOnline: online } =
                    await syncClient.fetchUnifiedState('default_user');
                  setDbState(state);
                  setBackendOnline(online);
                  notify(
                    online
                      ? 'Re-synced live state from SQLite!'
                      : 'Loaded from local cache.'
                  );
                }}
                title="Refresh state from SQLite database"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 border border-cyan-500/50 text-cyan-200 px-4 py-3 rounded-xl shadow-2xl shadow-cyan-950/60 text-xs sm:text-sm max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <main className="flex-1 max-w-[1640px] w-full mx-auto px-4 lg:px-8 py-6">
        {activeTab === 'command' && (
          <CommandCenter
            profile={profile}
            nodes={nodes}
            intelligence={intelligence}
            onSelectGoalMode={handleSetGoalMode}
            onInspectTarget={handleInspectTarget}
            onOpenTab={setActiveTab}
            onUpdateNodeTrust={handleUpdateNodeTrust}
            onOpenAddNode={() => {
              setEditingNode(null);
              setShowAddNodeModal(true);
            }}
            onNotify={notify}
          />
        )}

        {activeTab === 'discovery' && (
          <GoalDiscoveryView
            profile={profile}
            nodes={nodes}
            intelligence={intelligence}
            onSelectGoalMode={handleSetGoalMode}
            onSelectCareerVector={async (vecTitle) => {
              const updated = { ...profile, activeCareerVector: vecTitle };
              setDbState((prev) => ({ ...prev, profile: updated }));
              await syncClient.updateProfile(updated);
              notify(`Activated Career Vector: ${vecTitle}`);
            }}
            onInjectCandidate={handleInjectCandidate}
            onInspectTarget={handleInspectTarget}
            onOpenAddEdge={() => setShowAddEdgeModal(true)}
            onNotify={notify}
          />
        )}

        {activeTab === 'graph' && (
          <NetworkGraph
            profile={profile}
            nodes={nodes}
            edges={edges}
            selectedTargetId={selectedTargetId}
            onSelectNode={setSelectedTargetId}
            selectedNodePaths={selectedNodePaths}
            onUpdateNodeTrust={handleUpdateNodeTrust}
            onOpenCalculator={(id) => handleInspectTarget(id, 'calculator')}
            onOpenAddEdge={() => setShowAddEdgeModal(true)}
          />
        )}

        {activeTab === 'calculator' && (
          <PathCalculator
            profile={profile}
            nodes={nodes}
            edges={edges}
            intelligence={intelligence}
            selectedTargetId={selectedTargetId}
            setSelectedTargetId={setSelectedTargetId}
            compareTargetId={compareTargetId}
            setCompareTargetId={setCompareTargetId}
            selectedNodePaths={selectedNodePaths}
            onSelectGoalMode={handleSetGoalMode}
            onNotify={notify}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseIngestView
            profile={profile}
            nodes={nodes}
            edges={edges}
            backendOnline={backendOnline}
            onUpdateNodeTrust={handleUpdateNodeTrust}
            onInspectTarget={(id) => handleInspectTarget(id, 'calculator')}
            onAddNode={() => {
              setEditingNode(null);
              setShowAddNodeModal(true);
            }}
            onEditNode={(node) => {
              setEditingNode(node);
              setShowAddNodeModal(true);
            }}
            onDeleteNode={async (id) => {
              setDbState((prev) => ({
                ...prev,
                nodes: prev.nodes.filter((n) => n.id !== id),
                edges: prev.edges.filter((e) => e.source !== id && e.target !== id),
              }));
              await syncClient.deleteNode(id);
              notify('Deleted contact node and associated edges from SQLite.');
            }}
            onAddEdge={() => setShowAddEdgeModal(true)}
            onDeleteEdge={async (edge: GraphEdge) => {
              setDbState((prev) => ({
                ...prev,
                edges: prev.edges.filter((e) => e.id !== edge.id),
              }));
              await syncClient.deleteEdge(edge);
              notify('Removed relationship edge from SQLite.');
            }}
            onFileIngest={handleFileIngest}
            onResumeIngest={handleResumeIngest}
            onRestoreSnapshot={async (snap) => {
              try {
                const synced = await syncClient.pushFullSnapshot(snap);
                setDbState(synced);
                setBackendOnline(true);
                notify('Restored JSON snapshot directly into SQLite!');
              } catch {
                setDbState(snap);
                notify('Restored JSON snapshot into local cache.');
              }
            }}
            onResetClean={handleResetClean}
            onNotify={notify}
          />
        )}
      </main>

      {showRecalcModal && (
        <RecalculationConsoleModal
          profile={profile}
          nodes={nodes}
          edges={edges}
          onHydrateState={(newState) => {
            setDbState(newState);
            setBackendOnline(true);
          }}
          onNotify={notify}
          onClose={() => setShowRecalcModal(false)}
        />
      )}

      {showOnboarding && (
        <OnboardingWizardModal
          profile={profile}
          onSaveProfile={handleSaveProfile}
          onClearGraph={handleResetClean}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {showAddNodeModal && (
        <NodeEditorModal
          node={editingNode}
          nodes={nodes}
          profile={profile}
          onClose={() => {
            setShowAddNodeModal(false);
            setEditingNode(null);
          }}
          onSave={handleSaveNodeModal}
        />
      )}

      {showAddEdgeModal && (
        <EdgeCreatorModal
          profile={profile}
          nodes={nodes}
          onClose={() => setShowAddEdgeModal(false)}
          onSave={async (edgeData) => {
            const serverState = await syncClient.createEdge(edgeData);
            if (serverState) {
              setDbState(serverState);
              setBackendOnline(true);
            } else {
              setDbState((prev) => ({
                ...prev,
                edges: [
                  ...prev.edges,
                  {
                    id: `e_${Date.now()}`,
                    source: edgeData.source,
                    target: edgeData.target,
                    weight: Number(edgeData.weight),
                    context: edgeData.context,
                  },
                ],
              }));
            }
            setShowAddEdgeModal(false);
            notify('Wired custom edge in SQLite & recomputed EV!');
          }}
        />
      )}
    </div>
  );
};

export default App;
