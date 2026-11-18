import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  Download,
  Edit3,
  FileText,
  Link2,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  ContactNode,
  GraphEdge,
  UnifiedAppState,
  UserProfile,
} from '../types/graph';
import { syncClient } from '../api/client';

interface DatabaseIngestViewProps {
  profile: UserProfile;
  nodes: ContactNode[];
  edges: GraphEdge[];
  backendOnline: boolean;
  onUpdateNodeTrust: (nodeId: string, newTrust: number) => void;
  onInspectTarget: (id: string) => void;
  onAddNode: () => void;
  onEditNode: (node: ContactNode) => void;
  onDeleteNode: (id: string) => void;
  onAddEdge: () => void;
  onDeleteEdge: (edge: GraphEdge) => void;
  onFileIngest: (file: File) => Promise<void>;
  onResumeIngest: (text: string) => Promise<void>;
  onRestoreSnapshot: (snap: UnifiedAppState) => void;
  onResetClean: () => void;
  onNotify: (msg: string) => void;
}

export const DatabaseIngestView: React.FC<DatabaseIngestViewProps> = ({
  profile,
  nodes,
  edges,
  backendOnline,
  onUpdateNodeTrust,
  onInspectTarget,
  onAddNode,
  onEditNode,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
  onFileIngest,
  onResumeIngest,
  onRestoreSnapshot,
  onResetClean,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<'nodes' | 'edges' | 'ingest'>('nodes');
  const [search, setSearch] = useState('');
  const [degFilter, setDegFilter] = useState('ALL');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [liveSeedSQL, setLiveSeedSQL] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const filteredNodes = useMemo(() => {
    const q = search.toLowerCase();
    return nodes.filter((n) => {
      const matchText =
        n.name.toLowerCase().includes(q) ||
        n.company.toLowerCase().includes(q) ||
        n.role.toLowerCase().includes(q) ||
        (n.cluster || '').toLowerCase().includes(q);
      const matchDeg = degFilter === 'ALL' || String(n.degree) === degFilter;
      return matchText && matchDeg;
    });
  }, [nodes, search, degFilter]);

  const getNodeLabel = (id: string) => {
    if (id === 'user-root') return `${profile.name} (You)`;
    const found = nodes.find((n) => n.id === id);
    return found ? `${found.name} (${found.company})` : id;
  };

  useEffect(() => {
    if (subTab === 'ingest' && backendOnline) {
      syncClient.fetchSeedSQL(profile.user_id || 'default_user').then((sql) => {
        if (sql) setLiveSeedSQL(sql);
      });
    }
  }, [subTab, backendOnline, nodes.length, edges.length, profile.user_id]);

  const fallbackSqliteDump = useMemo(() => {
    const esc = (str: unknown) => String(str ?? '').replace(/'/g, "''");
    const uid = profile.user_id || 'default_user';
    const rootId = `${uid}_root`;
    const lines = [
      '-- Career Network Optimizer — Canonical SQLite WAL Seed Snapshot',
      `-- Generated: ${new Date().toISOString()}`,
      'PRAGMA foreign_keys = ON;',
      'BEGIN TRANSACTION;',
      `INSERT OR REPLACE INTO users (id, full_name, headline, current_company, location, active_goal_mode, active_career_vector, repositories_json, target_companies_json) VALUES ('${esc(uid)}', '${esc(profile.name)}', '${esc(profile.headline)}', '${esc(profile.currentCompany)}', '${esc(profile.location)}', '${esc(profile.activeGoalMode)}', '${esc(profile.activeCareerVector)}', '${esc(JSON.stringify(profile.repositories || []))}', '${esc(JSON.stringify(profile.targetCompanies || []))}');`,
      `INSERT OR REPLACE INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, authority_level, cluster) VALUES ('${esc(rootId)}', '${esc(uid)}', '${esc(profile.name)}', '${esc(profile.headline)}', '${esc(profile.currentCompany)}', '${esc(profile.location)}', 0, 1.0, 100, 'Staff/Principal', 'Robotics & Embodied AI');`,
    ];
    nodes.forEach((n) => {
      lines.push(
        `INSERT OR REPLACE INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, authority_level, cluster, past_role_3yrs_ago, notes) VALUES ('${esc(
          n.id
        )}', '${esc(uid)}', '${esc(n.name)}', '${esc(n.role)}', '${esc(
          n.company
        )}', '${esc(n.location)}', ${Number(n.degree)}, ${Number(
          n.trustScore
        )}, ${Number(n.strategicValue || 70)}, '${esc(n.authorityLevel)}', '${esc(
          n.cluster
        )}', '${esc(n.pastState3YrsAgo?.role || '')}', '${esc(n.notes || '')}');`
      );
    });
    edges.forEach((e) => {
      const src = e.source === 'user-root' ? rootId : e.source;
      const tgt = e.target === 'user-root' ? rootId : e.target;
      lines.push(
        `INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context) VALUES ('${esc(
          uid
        )}', '${esc(src)}', '${esc(tgt)}', ${Number(e.weight)}, '${esc(
          e.relationshipType || 'direct'
        )}', '${esc(e.context)}');`
      );
    });
    lines.push('COMMIT;');
    return lines.join('\n');
  }, [profile, nodes, edges]);

  const displayedSQL = liveSeedSQL || fallbackSqliteDump;

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await onFileIngest(file);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'nodes' as const, label: `People Nodes (${nodes.length})` },
              { id: 'edges' as const, label: `Graph Edges (${edges.length})` },
              { id: 'ingest' as const, label: 'CSV / ZIP Ingest & SQLite Export' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                  subTab === t.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {subTab !== 'ingest' && (
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, company, cluster..."
                className="bg-transparent text-xs text-white focus:outline-none w-full"
              />
            </div>
          )}

          {subTab === 'nodes' && (
            <select
              value={degFilter}
              onChange={(e) => setDegFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
            >
              <option value="ALL">All Degrees</option>
              <option value="1">1st Degree</option>
              <option value="2">2nd Degree</option>
              <option value="3">3rd Degree</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onAddEdge}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-medium flex items-center gap-1.5 transition"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>+ Wire Edge</span>
          </button>
          <button
            onClick={onAddNode}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Person Node</span>
          </button>
        </div>
      </div>

      {subTab === 'nodes' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
          {filteredNodes.length === 0 ? (
            <div className="p-10 text-center space-y-2 text-xs text-slate-400">
              <Database className="w-7 h-7 text-cyan-400 mx-auto" />
              <p className="font-semibold text-white">No Contact Nodes Matching Filter</p>
              <p>
                Switch to the "CSV / ZIP Ingest & SQLite Export" tab to drop your LinkedIn
                Connections.csv or archive .zip.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-mono uppercase text-slate-400">
                    <th className="py-3.5 px-4">Name & Role</th>
                    <th className="py-3.5 px-4">Company & Cluster</th>
                    <th className="py-3.5 px-4">Authority & Degree</th>
                    <th className="py-3.5 px-4">Live Trust Slider</th>
                    <th className="py-3.5 px-4">Context & Messages</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {filteredNodes.slice(0, 250).map((node) => (
                    <tr key={node.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{node.name}</div>
                        <div className="text-slate-400">{node.role}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-cyan-400">{node.company}</span>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {node.cluster}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300">
                          {node.degree}° • {node.authorityLevel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5 max-w-[170px]">
                          <input
                            type="range"
                            min="0.10"
                            max="0.98"
                            step="0.01"
                            value={node.trustScore}
                            onChange={(e) =>
                              onUpdateNodeTrust(node.id, Number(e.target.value))
                            }
                            className="w-24 accent-cyan-400 cursor-pointer"
                          />
                          <span className="font-mono font-bold text-emerald-400">
                            {node.trustScore}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-mono text-[11px] truncate max-w-xs">
                          {node.notes || node.context || 'Direct contact'}
                        </div>
                        {node.githubOverlap && (
                          <div className="text-[11px] text-purple-300 font-mono truncate max-w-xs">
                            {node.githubOverlap}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onInspectTarget(node.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-mono transition"
                          >
                            EV Path
                          </button>
                          <button
                            onClick={() => onEditNode(node)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteNode(node.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'edges' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
          {edges.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No edges recorded yet. Import contacts or click "+ Wire Edge" above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-mono uppercase text-slate-400">
                    <th className="py-3.5 px-4">Source Node</th>
                    <th className="py-3.5 px-4">Target Node</th>
                    <th className="py-3.5 px-4">Edge Weight (w)</th>
                    <th className="py-3.5 px-4">Log Cost (-ln w)</th>
                    <th className="py-3.5 px-4">Relationship Context</th>
                    <th className="py-3.5 px-4 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {edges.slice(0, 300).map((edge) => (
                    <tr key={edge.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-white">
                        {getNodeLabel(edge.source)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-cyan-400">
                        {getNodeLabel(edge.target)}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                        {edge.weight}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {(-Math.log(Math.max(0.05, Math.min(0.99, edge.weight)))).toFixed(
                          3
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{edge.context}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onDeleteEdge(edge)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'ingest' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            {/* Drag-and-Drop LinkedIn CSV or ZIP Importer */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>LinkedIn Archive (.zip) or Connections.csv Importer</span>
              </h3>
              <p className="text-xs text-slate-400">
                Supports full LinkedIn Data Export <code className="text-cyan-300">.zip</code>{' '}
                (parses <code className="text-slate-200">Connections.csv</code> +{' '}
                <code className="text-slate-200">messages.csv</code> +{' '}
                <code className="text-slate-200">Positions.csv</code> directly into SQLite)
                or standalone <code className="text-cyan-300">Connections.csv</code>.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                  isDraggingOver
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-700 hover:border-cyan-500/50 bg-slate-950/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.zip"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && handleUpload(e.target.files[0])
                  }
                />
                <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">
                  {isUploading
                    ? 'Ingesting & Running Topology Pipeline...'
                    : 'Drop LinkedIn .zip or Connections.csv here, or click to browse'}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Deterministic deduplication • Zero synthetic contacts
                </p>
              </div>
            </div>

            {/* Resume Text Extractor */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Resume / Bio Skill Extractor</span>
              </h3>
              <textarea
                rows={4}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste resume bullets or technical stack notes to extract weighted competencies into SQLite..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => {
                  if (resumeText.trim()) {
                    onResumeIngest(resumeText);
                    setResumeText('');
                  }
                }}
                disabled={!resumeText.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 text-indigo-200 border border-indigo-500/40 text-xs font-mono font-semibold transition"
              >
                Extract & Update Profile Stack
              </button>
            </div>

            {/* Snapshot, Binary SQLite Download & Clean Reset */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-base font-bold text-white">
                SQLite Binary, JSON Backup & Clean Reset
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {backendOnline && (
                  <a
                    href="/api/export/db"
                    download="optimizer.db"
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-mono text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download optimizer.db</span>
                  </a>
                )}
                <button
                  onClick={() => {
                    const blob = new Blob(
                      [JSON.stringify({ profile, nodes, edges }, null, 2)],
                      { type: 'application/json' }
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'network_snapshot.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    onNotify('Downloaded network_snapshot.json!');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-slate-700"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => jsonInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-indigo-300 border border-slate-700"
                >
                  Restore JSON
                </button>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const parsed = JSON.parse(String(ev.target?.result || ''));
                        if (parsed.profile && parsed.nodes && parsed.edges) {
                          onRestoreSnapshot(parsed);
                        } else {
                          onNotify('JSON missing profile/nodes/edges keys.');
                        }
                      } catch {
                        onNotify('Invalid JSON snapshot file.');
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
                <button
                  onClick={onResetClean}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/50 text-xs font-mono text-rose-300 border border-rose-500/30"
                >
                  Reset Clean DB (0 Contacts)
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-mono">
                Canonical SQLite WAL seed.sql
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(displayedSQL);
                  setCopiedSQL(true);
                  onNotify('Copied canonical SQLite seed.sql!');
                  setTimeout(() => setCopiedSQL(false), 2500);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono"
              >
                {copiedSQL ? 'Copied!' : 'Copy seed.sql'}
              </button>
            </div>
            <textarea
              readOnly
              rows={24}
              value={displayedSQL}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-emerald-300/90 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
