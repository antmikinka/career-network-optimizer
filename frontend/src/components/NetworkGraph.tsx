import React, { useMemo, useState } from 'react';
import {
  Link2,
  Maximize2,
  Network,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ClusterName,
  ContactNode,
  EvaluatedPath,
  GraphEdge,
  UserProfile,
} from '../types/graph';
import {
  AUTHORITY_MULTIPLIERS,
  CLUSTER_COLORS,
  CLUSTERS,
} from '../engine/graphEngine';

interface NetworkGraphProps {
  profile: UserProfile;
  nodes: ContactNode[];
  edges: GraphEdge[];
  selectedTargetId: string | null;
  onSelectNode: (id: string) => void;
  selectedNodePaths: EvaluatedPath[];
  onUpdateNodeTrust: (nodeId: string, newTrust: number) => void;
  onOpenCalculator: (id: string) => void;
  onOpenAddEdge: () => void;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  profile,
  nodes,
  edges,
  selectedTargetId,
  onSelectNode,
  selectedNodePaths,
  onUpdateNodeTrust,
  onOpenCalculator,
  onOpenAddEdge,
}) => {
  const [colorMode, setColorMode] = useState<'cluster' | 'degree'>('cluster');
  const [clusterFilter, setClusterFilter] = useState<'ALL' | ClusterName>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEdgeWeights, setShowEdgeWeights] = useState(true);
  const [maxVisibleNodes, setMaxVisibleNodes] = useState(180);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const primaryPath = selectedNodePaths[0] || null;
  const activePathNodeIds = useMemo(() => {
    if (!primaryPath) return new Set<string>();
    return new Set(primaryPath.nodes.map((n) => n.id));
  }, [primaryPath]);

  // Adaptive viewport culling for large LinkedIn imports (500-2500 nodes) while always preserving active paths & search matches
  const visibleNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...nodes].sort((a, b) => {
      const aPin = a.id === selectedTargetId || activePathNodeIds.has(a.id) ? 1 : 0;
      const bPin = b.id === selectedTargetId || activePathNodeIds.has(b.id) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      if (a.degree !== b.degree) return b.degree - a.degree; // keep all 2°/3° targets visible first
      return (b.strategicValue || 0) - (a.strategicValue || 0) || b.trustScore - a.trustScore;
    });

    if (!q && sorted.length <= maxVisibleNodes) return sorted;

    return sorted
      .filter((n) => {
        if (n.id === selectedTargetId || activePathNodeIds.has(n.id)) return true;
        if (q) {
          return (
            n.name.toLowerCase().includes(q) ||
            n.company.toLowerCase().includes(q) ||
            n.role.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .slice(0, maxVisibleNodes);
  }, [nodes, maxVisibleNodes, searchQuery, selectedTargetId, activePathNodeIds]);

  const layout = useMemo(() => {
    const cx = 480;
    const cy = 330;
    const pos = new Map<string, { x: number; y: number }>();
    pos.set('user-root', { x: cx, y: cy });

    const placeOrbit = (
      orbitNodes: ContactNode[],
      baseRadius: number,
      phaseOffset = 0
    ) => {
      const count = orbitNodes.length || 1;
      const multiRing = count > 40;
      orbitNodes.forEach((n, idx) => {
        const ringOffset = multiRing ? (idx % 2 === 0 ? -18 : 22) : 0;
        const r = baseRadius + ringOffset;
        const angle = phaseOffset + (idx / count) * 2 * Math.PI - Math.PI / 2;
        pos.set(n.id, {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r * 0.86,
        });
      });
    };

    placeOrbit(
      visibleNodes.filter((n) => n.degree === 1),
      140,
      0.15
    );
    placeOrbit(
      visibleNodes.filter((n) => n.degree === 2),
      248,
      -0.2
    );
    placeOrbit(
      visibleNodes.filter((n) => n.degree === 3),
      335,
      0.35
    );

    return { cx, cy, pos };
  }, [visibleNodes]);

  const isEdgeInPrimaryPath = (u: string, v: string) => {
    if (!primaryPath) return false;
    const pNodes = primaryPath.nodes;
    for (let i = 0; i < pNodes.length - 1; i++) {
      const a = pNodes[i].id;
      const b = pNodes[i + 1].id;
      if ((a === u && b === v) || (a === v && b === u)) return true;
    }
    return false;
  };

  const selectedNode = nodes.find((n) => n.id === selectedTargetId) || nodes[0] || null;
  const denseMode = visibleNodes.length > 45;

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const tag = (e.target as Element).tagName;
    if (tag === 'svg' || tag === 'rect' || tag === 'ellipse' || tag === 'circle') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 8 Cols: Orbital SVG Topology */}
      <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setColorMode('cluster')}
                className={`px-2.5 py-1 rounded ${
                  colorMode === 'cluster'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400'
                }`}
              >
                Cluster
              </button>
              <button
                onClick={() => setColorMode('degree')}
                className={`px-2.5 py-1 rounded ${
                  colorMode === 'degree'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400'
                }`}
              >
                Degree
              </button>
            </div>

            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value as 'ALL' | ClusterName)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="ALL">All Clusters</option>
              {CLUSTERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter nodes..."
                className="bg-transparent text-xs text-white focus:outline-none w-28 sm:w-36"
              />
            </div>

            <button
              onClick={() => setShowEdgeWeights(!showEdgeWeights)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition ${
                showEdgeWeights
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              {showEdgeWeights ? 'Weights: ON' : 'Weights: OFF'}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {nodes.length > 180 && (
              <select
                value={maxVisibleNodes}
                onChange={(e) => setMaxVisibleNodes(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-mono text-cyan-300 mr-1"
              >
                <option value={180}>Top 180</option>
                <option value={400}>Top 400</option>
                <option value={1000}>Top 1000</option>
              </select>
            )}
            <button
              onClick={onOpenAddEdge}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-mono flex items-center gap-1 mr-1"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>+ Edge</span>
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))}
              className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
              className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <svg
            viewBox="0 0 960 660"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`w-full h-[480px] sm:h-[560px] select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <defs>
              <radialGradient id="coreGlowClean" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0" />
              </radialGradient>
            </defs>

            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
              style={{ transformOrigin: '480px 330px' }}
            >
              <circle cx={layout.cx} cy={layout.cy} r="310" fill="url(#coreGlowClean)" />

              {[
                { rx: 140, ry: 140 * 0.86, label: '1ST DEGREE RING (DIRECT PEERS)' },
                { rx: 248, ry: 248 * 0.86, label: '2ND DEGREE RING (WARM BRIDGES)' },
                { rx: 335, ry: 335 * 0.86, label: '3RD DEGREE RING (EXEC / VENTURE)' },
              ].map((ring, i) => (
                <g key={i}>
                  <ellipse
                    cx={layout.cx}
                    cy={layout.cy}
                    rx={ring.rx}
                    ry={ring.ry}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1.2"
                    strokeDasharray="5 5"
                  />
                  <text
                    x={layout.cx}
                    y={layout.cy - ring.ry - 6}
                    textAnchor="middle"
                    className="fill-slate-600 text-[9px] font-mono tracking-widest pointer-events-none"
                  >
                    {ring.label}
                  </text>
                </g>
              ))}

              {/* Graph Edges */}
              {edges.map((edge) => {
                const p1 = layout.pos.get(edge.source);
                const p2 = layout.pos.get(edge.target);
                if (!p1 || !p2) return null;

                const isActive = isEdgeInPrimaryPath(edge.source, edge.target);
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                return (
                  <g key={edge.id}>
                    {isActive && (
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#22d3ee"
                        strokeWidth="6"
                        strokeOpacity="0.25"
                      />
                    )}
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={isActive ? '#22d3ee' : '#334155'}
                      strokeWidth={isActive ? '2.8' : denseMode ? '0.8' : '1.2'}
                      strokeOpacity={isActive ? '0.98' : denseMode ? '0.28' : '0.5'}
                    />
                    {showEdgeWeights && (isActive || edges.length < 30) && (
                      <text
                        x={midX}
                        y={midY - 3}
                        textAnchor="middle"
                        className={`text-[8px] font-mono pointer-events-none ${
                          isActive ? 'fill-cyan-300 font-bold' : 'fill-slate-500'
                        }`}
                      >
                        {Number(edge.weight).toFixed(2)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Root User Node */}
              <g transform={`translate(${layout.cx}, ${layout.cy})`}>
                <circle r="26" fill="#083344" stroke="#22d3ee" strokeWidth="2.5" />
                <text
                  textAnchor="middle"
                  dy="4"
                  className="fill-white font-mono text-xs font-bold"
                >
                  YOU
                </text>
                <text
                  textAnchor="middle"
                  dy="40"
                  className="fill-cyan-300 text-[10px] font-semibold"
                >
                  {profile.name}
                </text>
              </g>

              {/* Contact Nodes */}
              {visibleNodes.map((node) => {
                const pt = layout.pos.get(node.id);
                if (!pt) return null;

                const dimmed =
                  clusterFilter !== 'ALL' && node.cluster !== clusterFilter;
                const isSelected = node.id === selectedTargetId;
                const inPath = activePathNodeIds.has(node.id);
                const r = denseMode
                  ? isSelected || inPath
                    ? 15
                    : 8
                  : node.degree === 1
                  ? 18
                  : node.degree === 2
                  ? 16
                  : 14;

                const clusterPalette =
                  CLUSTER_COLORS[node.cluster] ||
                  CLUSTER_COLORS['Robotics & Embodied AI'];
                const stroke = isSelected
                  ? '#10b981'
                  : inPath
                  ? '#22d3ee'
                  : colorMode === 'cluster'
                  ? clusterPalette.stroke
                  : node.degree === 1
                  ? '#38bdf8'
                  : node.degree === 2
                  ? '#818cf8'
                  : '#fbbf24';

                const fill = isSelected
                  ? '#064e3b'
                  : inPath
                  ? '#083344'
                  : colorMode === 'cluster'
                  ? clusterPalette.fill
                  : '#0f172a';

                const showLabel = !denseMode || isSelected || inPath || zoom >= 1.5;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pt.x}, ${pt.y})`}
                    onClick={() => onSelectNode(node.id)}
                    className="cursor-pointer"
                    style={{ opacity: dimmed ? 0.2 : 1 }}
                  >
                    <title>{`${node.name} — ${node.role} @ ${node.company} (Trust: ${node.trustScore})`}</title>
                    {(isSelected || inPath) && (
                      <circle
                        r={r + 5}
                        fill="none"
                        stroke={stroke}
                        strokeWidth="1.6"
                        strokeOpacity="0.6"
                      />
                    )}
                    <circle
                      r={r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isSelected || inPath ? '2.5' : '1.5'}
                    />
                    {(!denseMode || isSelected || inPath) && (
                      <text
                        textAnchor="middle"
                        dy="3.5"
                        className="fill-white font-mono text-[9.5px] font-bold pointer-events-none"
                      >
                        {node.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)}
                      </text>
                    )}

                    {showLabel && (
                      <g transform={`translate(0, ${r + 12})`}>
                        <rect
                          x="-56"
                          y="-9"
                          width="112"
                          height="21"
                          rx="4"
                          fill="#020617"
                          fillOpacity="0.9"
                          stroke={isSelected || inPath ? stroke : '#1e293b'}
                          strokeWidth="0.8"
                        />
                        <text
                          textAnchor="middle"
                          dy="0"
                          className="fill-white text-[9px] font-semibold"
                        >
                          {node.name.slice(0, 18)}
                        </text>
                        <text
                          textAnchor="middle"
                          dy="8.5"
                          className="fill-cyan-400 text-[8px] font-mono"
                        >
                          {node.company.slice(0, 16)} ({node.degree}°)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              {CLUSTERS.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1.5 text-slate-300 text-[11px]"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: CLUSTER_COLORS[c].stroke }}
                  />
                  {c}
                </span>
              ))}
            </div>
            <span className="text-slate-400 font-mono text-[11px]">
              Showing {visibleNodes.length}/{nodes.length} • Zoom: {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Right 4 Cols: Node EV & Trajectory Inspector */}
      <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        {selectedNode ? (
          <>
            <div className="pb-3 border-b border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {selectedNode.degree}° Degree
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {selectedNode.authorityLevel} (
                  {AUTHORITY_MULTIPLIERS[selectedNode.authorityLevel] || 0.8}x)
                </span>
              </div>
              <h3 className="text-xl font-bold text-white pt-1">{selectedNode.name}</h3>
              <p className="text-sm text-cyan-400 font-medium">
                {selectedNode.role} @ {selectedNode.company}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {selectedNode.cluster} • {selectedNode.location}
              </p>
            </div>

            {selectedNode.pastState3YrsAgo && (
              <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-3.5 space-y-1 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-indigo-300 uppercase text-[10px]">
                    S_&#123;t-3&#125; TRAJECTORY SNAPSHOT
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {selectedNode.pastState3YrsAgo.similarityScore}% k-NN Match
                  </span>
                </div>
                <p className="text-white font-medium">
                  {selectedNode.pastState3YrsAgo.role}
                </p>
                <p className="text-[11px] text-slate-400">
                  Vector: {selectedNode.pastState3YrsAgo.vectorCluster}
                </p>
              </div>
            )}

            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">LIVE TRUST / EDGE WEIGHT:</span>
                <span className="text-emerald-400 font-bold">
                  {selectedNode.trustScore}
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.98"
                step="0.01"
                value={selectedNode.trustScore}
                onChange={(e) =>
                  onUpdateNodeTrust(selectedNode.id, Number(e.target.value))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {primaryPath && (
              <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-cyan-400 font-bold">
                    EXPECTED VALUE: {primaryPath.evScore} EV
                  </span>
                  <span className="text-emerald-400 font-bold">
                    P(Reach): {primaryPath.conversionProb}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  {primaryPath.nodes.map((n, idx) => {
                    const edge = primaryPath.edges[idx];
                    return (
                      <div key={n.id}>
                        <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                          <span className="font-semibold text-white">
                            {idx}. {n.name}
                          </span>
                          <span className="font-mono text-cyan-400">{n.company}</span>
                        </div>
                        {edge && (
                          <div className="pl-4 py-1 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                            <span className="truncate">↓ {edge.context}</span>
                            <span className="text-emerald-400 shrink-0 ml-2">
                              w={edge.weight}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => onOpenCalculator(selectedNode.id)}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Open Goal-Aware Outreach Generator</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center space-y-3 text-xs">
            <Network className="w-8 h-8 text-cyan-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Root Origin Centered</h4>
            <p className="text-slate-400">
              You are anchored at the center of the orbital topology. Upload your LinkedIn
              Connections.csv or .zip archive in the DB tab to populate your 1st- and
              2nd-degree rings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
