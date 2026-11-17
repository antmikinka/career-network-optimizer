import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  NetworkNode, 
  NetworkEdge, 
  CalculatedPath, 
  NetworkGraphState 
} from '../types/graph';
import { 
  Search, 
  Filter, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  Sparkles, 
  Shield, 
  Building2, 
  ArrowRight, 
  Sliders, 
  ExternalLink,
  ChevronRight,
  Eye
} from 'lucide-react';

interface NetworkGraphProps {
  graphState: NetworkGraphState;
  onUpdateNodeTrust: (nodeId: string, newTrust: number) => void;
  onSelectTargetForOutreach: (targetId: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  graphState,
  onUpdateNodeTrust,
  onSelectTargetForOutreach,
  selectedNodeId,
  setSelectedNodeId
}) => {
  const [renderMode, setRenderMode] = useState<'concentric' | 'canvas'>('concentric');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDegree, setSelectedDegree] = useState<'all' | '0' | '1' | '2' | '3'>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [minTrust, setMinTrust] = useState<number>(0.1);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Extract unique companies for filtering
  const uniqueCompanies = useMemo(() => {
    const comps = new Set<string>();
    graphState.nodes.forEach(n => {
      if (n.company && n.degree > 0) comps.add(n.company);
    });
    return Array.from(comps).sort();
  }, [graphState.nodes]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return graphState.nodes.filter(n => {
      if (n.degree === 0) return true; // Always include root
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = n.full_name.toLowerCase().includes(query);
        const matchesCompany = (n.company || '').toLowerCase().includes(query);
        const matchesRole = (n.role || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCompany && !matchesRole) return false;
      }
      if (selectedDegree !== 'all' && n.degree.toString() !== selectedDegree) {
        return false;
      }
      if (companyFilter !== 'all' && n.company !== companyFilter) {
        return false;
      }
      if (n.trust_score < minTrust) {
        return false;
      }
      return true;
    });
  }, [graphState.nodes, searchQuery, selectedDegree, companyFilter, minTrust]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  // Filter edges based on visible nodes
  const filteredEdges = useMemo(() => {
    return graphState.edges.filter(e => {
      return filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target);
    });
  }, [graphState.edges, filteredNodeIds]);

  // Selected node object
  const selectedNode = useMemo(() => {
    return graphState.nodes.find(n => n.id === selectedNodeId) || null;
  }, [graphState.nodes, selectedNodeId]);

  // Path highlighting for selected node
  const activePath = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphState.calculated_paths.find(p => p.target_id === selectedNodeId) || null;
  }, [graphState.calculated_paths, selectedNodeId]);

  const highlightedNodeIds = useMemo(() => {
    if (activePath) {
      return new Set(activePath.route_ids);
    }
    if (selectedNodeId) {
      const set = new Set<string>([selectedNodeId]);
      // Also highlight root and directly connected nodes
      graphState.edges.forEach(e => {
        if (e.source === selectedNodeId) set.add(e.target);
        if (e.target === selectedNodeId) set.add(e.source);
      });
      return set;
    }
    return new Set<string>();
  }, [activePath, selectedNodeId, graphState.edges]);

  // SVG Concentric Orbital Node Positions Calculator
  const orbitalPositions = useMemo(() => {
    const center = { x: 500, y: 420 };
    const radiusMap: Record<number, number> = {
      0: 0,
      1: 170,
      2: 310,
      3: 420,
    };

    const grouped: Record<number, NetworkNode[]> = { 0: [], 1: [], 2: [], 3: [] };
    filteredNodes.forEach(n => {
      if (grouped[n.degree]) grouped[n.degree].push(n);
    });

    const positions: Record<string, { x: number; y: number }> = {};

    // Center root
    if (grouped[0].length > 0) {
      positions[grouped[0][0].id] = center;
    }

    // Distribute nodes evenly on each concentric ring
    [1, 2, 3].forEach(deg => {
      const nodesInRing = grouped[deg];
      const r = radiusMap[deg];
      const count = nodesInRing.length;
      if (count === 0) return;

      const angleStep = (2 * Math.PI) / count;
      const startAngle = deg * 0.4; // offset rings slightly

      nodesInRing.forEach((n, idx) => {
        const angle = startAngle + idx * angleStep;
        positions[n.id] = {
          x: center.x + r * Math.cos(angle),
          y: center.y + r * Math.sin(angle),
        };
      });
    });

    return positions;
  }, [filteredNodes]);

  // Canvas Force Simulation Renderer
  useEffect(() => {
    if (renderMode !== 'canvas') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = canvas.width;
    const height = canvas.height;

    // Initialize simple physics coordinates
    const simNodes = filteredNodes.map((n, i) => {
      const pos = orbitalPositions[n.id] || { x: width / 2 + (Math.random() - 0.5) * 300, y: height / 2 + (Math.random() - 0.5) * 300 };
      return {
        ...n,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
      };
    });

    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

      // Draw edges
      filteredEdges.forEach(e => {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) return;

        const isHighlighted = highlightedNodeIds.has(e.source) && highlightedNodeIds.has(e.target);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isHighlighted) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 10;
        } else {
          ctx.strokeStyle = e.relationship_type === 'bridge' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = Math.max(1, e.weight * 2.5);
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
      });

      // Draw nodes
      simNodes.forEach(n => {
        const isSelected = n.id === selectedNodeId;
        const isHighlighted = highlightedNodeIds.has(n.id);

        ctx.beginPath();
        const radius = n.degree === 0 ? 14 : n.degree === 1 ? 9 : 8;
        ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);

        if (n.degree === 0) {
          ctx.fillStyle = '#6366f1';
        } else if (n.degree === 1) {
          ctx.fillStyle = '#818cf8';
        } else if (n.degree === 2) {
          ctx.fillStyle = '#34d399';
        } else {
          ctx.fillStyle = '#fbbf24';
        }

        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (isHighlighted) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw node text label
        ctx.font = n.degree === 0 ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
        ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1';
        ctx.fillText(n.full_name, n.x + radius + 4, n.y + 3);
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [renderMode, filteredNodes, filteredEdges, orbitalPositions, selectedNodeId, highlightedNodeIds, zoomLevel, panOffset]);

  const getNodeColor = (degree: number) => {
    switch (degree) {
      case 0: return 'fill-indigo-500 stroke-indigo-300';
      case 1: return 'fill-indigo-400 stroke-indigo-200';
      case 2: return 'fill-emerald-400 stroke-emerald-200';
      case 3: return 'fill-amber-400 stroke-amber-200';
      default: return 'fill-slate-400 stroke-slate-200';
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Filter and Renderer Controls Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search people, roles, companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Degree Filter Tabs */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
            {(['all', '1', '2', '3'] as const).map(deg => (
              <button
                key={deg}
                onClick={() => setSelectedDegree(deg)}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  selectedDegree === deg
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {deg === 'all' ? 'All Degrees' : `${deg}°`}
              </button>
            ))}
          </div>

          {/* Company Filter Dropdown */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Companies</option>
            {uniqueCompanies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Min Trust Slider & Renderer Toggle */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Min Trust: {Math.round(minTrust * 100)}%</span>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={minTrust}
              onChange={(e) => setMinTrust(parseFloat(e.target.value))}
              className="w-20 accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setRenderMode('concentric')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                renderMode === 'concentric'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Concentric (Focused)</span>
            </button>
            <button
              onClick={() => setRenderMode('canvas')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                renderMode === 'canvas'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Canvas (Full)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Visualization Canvas / SVG + Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Graph Display Area (8 or 9 cols) */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden relative min-h-[640px] flex items-center justify-center">
          {/* Zoom controls */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.15))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.15))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Mode 1: Concentric SVG Orbital Topology */}
          {renderMode === 'concentric' ? (
            <svg
              className="w-full h-[640px] select-none"
              viewBox="0 0 1000 840"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              {/* Concentric Guide Rings */}
              <circle cx="500" cy="420" r="170" fill="none" stroke="rgba(99, 102, 241, 0.12)" strokeDasharray="4 4" strokeWidth="1.5" />
              <circle cx="500" cy="420" r="310" fill="none" stroke="rgba(52, 211, 153, 0.12)" strokeDasharray="4 4" strokeWidth="1.5" />
              <circle cx="500" cy="420" r="420" fill="none" stroke="rgba(251, 191, 36, 0.10)" strokeDasharray="4 4" strokeWidth="1.5" />

              {/* Ring Degree Labels */}
              <text x="500" y="240" fill="rgba(129, 140, 248, 0.4)" fontSize="10" fontFamily="monospace" textAnchor="middle">1ST DEGREE (DIRECT NETWORK)</text>
              <text x="500" y="100" fill="rgba(52, 211, 153, 0.4)" fontSize="10" fontFamily="monospace" textAnchor="middle">2ND DEGREE (TARGET DECISION MAKERS)</text>
              <text x="500" y="-10" fill="rgba(251, 191, 36, 0.3)" fontSize="10" fontFamily="monospace" textAnchor="middle">3RD DEGREE (VENTURE &amp; ECOSYSTEM)</text>

              {/* Edges */}
              {filteredEdges.map((e, idx) => {
                const sPos = orbitalPositions[e.source];
                const tPos = orbitalPositions[e.target];
                if (!sPos || !tPos) return null;

                const isPathEdge = activePath && activePath.route_ids.includes(e.source) && activePath.route_ids.includes(e.target);
                const isConnectedToSelected = selectedNodeId === e.source || selectedNodeId === e.target;

                return (
                  <line
                    key={`edge-${idx}`}
                    x1={sPos.x}
                    y1={sPos.y}
                    x2={tPos.x}
                    y2={tPos.y}
                    stroke={
                      isPathEdge
                        ? '#10b981'
                        : isConnectedToSelected
                        ? '#818cf8'
                        : e.relationship_type === 'bridge'
                        ? 'rgba(99, 102, 241, 0.35)'
                        : 'rgba(148, 163, 184, 0.15)'
                    }
                    strokeWidth={isPathEdge ? 3.5 : isConnectedToSelected ? 2.5 : Math.max(1, e.weight * 2.2)}
                    strokeDasharray={e.relationship_type === 'bridge' && !isPathEdge ? '3 3' : undefined}
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Nodes */}
              {filteredNodes.map((n) => {
                const pos = orbitalPositions[n.id];
                if (!pos) return null;

                const isSelected = n.id === selectedNodeId;
                const isHighlighted = highlightedNodeIds.has(n.id);
                const isRoot = n.degree === 0;

                return (
                  <g
                    key={n.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => setSelectedNodeId(n.id)}
                    className="cursor-pointer group"
                  >
                    {/* Glowing halo for selected or active route */}
                    {(isSelected || isHighlighted) && (
                      <circle
                        r={isRoot ? 26 : 20}
                        className={isHighlighted && !isSelected ? 'fill-emerald-500/20 animate-pulse' : 'fill-indigo-500/30 animate-pulse-subtle'}
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      r={isRoot ? 16 : n.degree === 1 ? 10 : 9}
                      className={`${getNodeColor(n.degree)} transition-all duration-200 group-hover:scale-125 ${
                        isSelected ? 'ring-4 ring-white stroke-white' : ''
                      }`}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />

                    {/* Node Text Label */}
                    <text
                      y={isRoot ? 28 : 20}
                      fill={isSelected ? '#ffffff' : '#cbd5e1'}
                      fontSize={isRoot ? '12' : '10'}
                      fontWeight={isRoot ? 'bold' : 'normal'}
                      fontFamily="Inter, sans-serif"
                      textAnchor="middle"
                      className="pointer-events-none drop-shadow-md select-none group-hover:font-semibold group-hover:fill-white"
                    >
                      {n.full_name}
                    </text>

                    {/* Mini Company subtitle */}
                    {n.degree > 0 && (
                      <text
                        y={31}
                        fill="#64748b"
                        fontSize="8.5"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {n.company}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            /* Mode 2: Canvas Force Topology */
            <canvas
              ref={canvasRef}
              width={1000}
              height={640}
              className="w-full h-[640px] cursor-grab active:cursor-grabbing"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
                const clickY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

                let clickedNode: NetworkNode | null = null;
                for (const n of filteredNodes) {
                  const pos = orbitalPositions[n.id];
                  if (!pos) continue;
                  const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
                  if (dist < 18) {
                    clickedNode = n;
                    break;
                  }
                }
                if (clickedNode) {
                  setSelectedNodeId(clickedNode.id);
                }
              }}
            />
          )}

          {/* Bottom Graph Legend */}
          <div className="absolute bottom-3 left-4 z-20 flex items-center gap-4 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> You (Root)
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> 1st Degree
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> 2nd Degree Target
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> 3rd Degree
            </span>
          </div>
        </div>

        {/* Selected Node Inspector Drawer (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between backdrop-blur-md">
          {selectedNode ? (
            <div className="space-y-5">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                    selectedNode.degree === 0 
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' 
                      : selectedNode.degree === 1 
                      ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700/60'
                      : selectedNode.degree === 2
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {selectedNode.degree === 0 ? 'Your Profile' : `${selectedNode.degree}nd Degree Contact`}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">ID: {selectedNode.id}</span>
                </div>

                <h3 className="text-lg font-bold text-white mt-2">{selectedNode.full_name}</h3>
                <p className="text-xs text-slate-300">{selectedNode.role}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>{selectedNode.company}</span>
                  {selectedNode.location && (
                    <>
                      <span>•</span>
                      <span>{selectedNode.location}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Trust Score & Strategic Value Adjusters */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                    <Shield className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Relationship Trust Strength</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {Math.round(selectedNode.trust_score * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.98"
                  step="0.02"
                  value={selectedNode.trust_score}
                  onChange={(e) => onUpdateNodeTrust(selectedNode.id, parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400">Strategic Target Value</span>
                  <span className="text-xs font-mono font-semibold text-indigo-300">
                    {selectedNode.strategic_value} / 100
                  </span>
                </div>
              </div>

              {/* Context / Notes */}
              {selectedNode.notes && (
                <div className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 leading-relaxed">
                  <span className="text-slate-500 font-semibold block mb-1">Interaction Context:</span>
                  {selectedNode.notes}
                </div>
              )}

              {/* Skills Tags */}
              {selectedNode.skills && selectedNode.skills.length > 0 && (
                <div>
                  <span className="text-xs text-slate-400 font-medium block mb-2">Technical Competencies</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.skills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded bg-slate-800/90 text-[11px] text-slate-300 border border-slate-700/60"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Warm Introduction Route Breakdown */}
              {activePath && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400">Optimal Warm Path Found</span>
                    <span className="font-mono font-bold text-emerald-300">{activePath.conversion_prob}% Prob</span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-mono">Route:</span>
                    <span>You</span>
                    <ArrowRight className="h-3 w-3 text-slate-600" />
                    <span className="font-medium text-indigo-300">{activePath.bridge_name}</span>
                    <ArrowRight className="h-3 w-3 text-slate-600" />
                    <span className="font-medium text-emerald-300">{activePath.target_name}</span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {selectedNode.degree >= 2 && (
                <button
                  onClick={() => onSelectTargetForOutreach(selectedNode.id)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all mt-4"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Draft Warm Outreach &amp; Blurb</span>
                </button>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-800/50 flex items-center justify-center text-slate-500">
                <Sliders className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-300">Select any node in the graph</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click contacts to inspect trust weights, shared skills, and Dijkstra warm intro routes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
