import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  ArrowRight, 
  Copy, 
  Check, 
  Sparkles, 
  Mail, 
  Send, 
  Building2, 
  ShieldCheck, 
  Layers, 
  Cpu
} from 'lucide-react';
import { NetworkGraphState, UserProfile, OutreachPackage } from '../types/graph';
import { apiClient } from '../api/client';

interface PathCalculatorProps {
  graphState: NetworkGraphState;
  userProfile: UserProfile;
  selectedTargetId: string | null;
  onSelectTarget: (targetId: string) => void;
}

export const PathCalculator: React.FC<PathCalculatorProps> = ({
  graphState,
  userProfile,
  selectedTargetId,
  onSelectTarget
}) => {
  const [activeTab, setActiveTab] = useState<'request' | 'blurb' | 'email'>('request');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [outreachData, setOutreachData] = useState<OutreachPackage | null>(null);
  const [isLoadingOutreach, setIsLoadingOutreach] = useState(false);

  // Available 2nd & 3rd degree targets
  const targetNodes = graphState.nodes.filter(n => n.degree >= 2);
  const currentTargetId = selectedTargetId || (targetNodes.length > 0 ? targetNodes[0].id : null);
  const currentTarget = graphState.nodes.find(n => n.id === currentTargetId);
  const matchedPath = graphState.calculated_paths.find(p => p.target_id === currentTargetId);

  useEffect(() => {
    if (!currentTargetId) return;

    let isMounted = true;
    setIsLoadingOutreach(true);

    apiClient.getOutreach(userProfile.id, currentTargetId)
      .then(res => {
        if (isMounted) {
          setOutreachData(res.outreach);
          setIsLoadingOutreach(false);
        }
      })
      .catch(err => {
        console.error('Failed to fetch outreach blurbs', err);
        if (isMounted) setIsLoadingOutreach(false);
      });

    return () => { isMounted = false; };
  }, [currentTargetId, userProfile.id]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Target Decision Maker Selector Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <GitFork className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Weighted Path &amp; Outreach Engine</h2>
            <p className="text-xs text-slate-400">Dijkstra friction-minimized warm introduction routes with forwardable blurbs</p>
          </div>
        </div>

        {/* Target Selector Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-400 shrink-0 font-medium">Select Target Node:</span>
          <select
            value={currentTargetId || ''}
            onChange={(e) => onSelectTarget(e.target.value)}
            className="w-full md:w-80 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
          >
            {targetNodes.map(t => (
              <option key={t.id} value={t.id}>
                {t.full_name} — {t.role} ({t.company})
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentTarget && matchedPath ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Route Topology & Metrics Breakdown (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Conversion Probability & Friction Score Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/20 border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-purple-300">Target Telemetry</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300">
                  {matchedPath.target_degree}nd Degree Path
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">Conversion Probability</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {matchedPath.conversion_prob}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">P = exp(-friction_cost)</div>
                </div>

                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">Total Path Friction</div>
                  <div className="text-2xl font-bold font-mono text-indigo-300 mt-1">
                    {matchedPath.friction_cost}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">&Sigma; -ln(w_i) cost</div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Strategic Target Alignment</span>
                  <span className="font-mono text-white font-semibold">{matchedPath.strategic_value} / 100</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${matchedPath.strategic_value}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Visual Step-by-Step Flowchart */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                <span>Multi-Hop Traversal Sequence</span>
              </h3>

              <div className="space-y-3 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-800">
                {/* Step 1: Root */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className="h-8 w-8 rounded-full bg-indigo-600 border-2 border-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow">
                    0
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex-1">
                    <div className="text-xs font-semibold text-white">{userProfile.full_name} (You)</div>
                    <div className="text-[11px] text-slate-400">{userProfile.headline}</div>
                  </div>
                </div>

                {/* Step 2: Bridge Connector */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className="h-8 w-8 rounded-full bg-indigo-500 border-2 border-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow">
                    1
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-indigo-500/30 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-indigo-300">{matchedPath.bridge_name}</div>
                      <span className="text-[10px] font-mono text-emerald-400 font-medium">
                        {Math.round(matchedPath.bridge_trust * 100)}% Trust
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">{matchedPath.bridge_role}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1">Company: {matchedPath.bridge_company}</div>
                  </div>
                </div>

                {/* Step 3: Target Decision Maker */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 border-2 border-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow">
                    2
                  </div>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-emerald-500/40 flex-1">
                    <div className="text-xs font-semibold text-emerald-300">{matchedPath.target_name}</div>
                    <div className="text-[11px] text-slate-300">{matchedPath.target_role}</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-1">Company: {matchedPath.target_company}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shared Skills Overlap */}
            {matchedPath.shared_skills && matchedPath.shared_skills.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400 font-medium block mb-2 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-purple-400" />
                  <span>Shared Technical Competencies with Target Vector</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {matchedPath.shared_skills.map((skill) => (
                    <span 
                      key={skill}
                      className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-purple-950/60 text-purple-300 border border-purple-800/60"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Tailored Outreach Generator (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <h3 className="font-semibold text-white text-sm">Automated Outreach &amp; Forwardable Blurb</h3>
                </div>

                {/* Sub tabs */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setActiveTab('request')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      activeTab === 'request'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1. Bridge Intro Request
                  </button>
                  <button
                    onClick={() => setActiveTab('blurb')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      activeTab === 'blurb'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    2. Forwardable Blurb
                  </button>
                  <button
                    onClick={() => setActiveTab('email')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      activeTab === 'email'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    3. Subject Line
                  </button>
                </div>
              </div>

              {isLoadingOutreach ? (
                <div className="h-72 flex items-center justify-center text-slate-400 text-xs">
                  Generating tailored outreach vectors...
                </div>
              ) : outreachData ? (
                <div className="space-y-3">
                  {/* Active Text Box */}
                  <div className="relative">
                    <textarea
                      rows={12}
                      readOnly
                      value={
                        activeTab === 'request'
                          ? outreachData.bridge_intro_request
                          : activeTab === 'blurb'
                          ? outreachData.forwardable_blurb
                          : outreachData.email_subject
                      }
                      className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-200 font-sans leading-relaxed focus:outline-none select-all"
                    />

                    {/* Copy Button Overlay */}
                    <button
                      onClick={() => handleCopy(
                        activeTab === 'request'
                          ? outreachData.bridge_intro_request
                          : activeTab === 'blurb'
                          ? outreachData.forwardable_blurb
                          : outreachData.email_subject,
                        activeTab
                      )}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-md transition-all"
                    >
                      {copiedKey === activeTab ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Text</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Context Advice Banner */}
                  <div className="text-[11px] text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800 leading-normal">
                    {activeTab === 'request' && (
                      <p>
                        💡 <strong className="text-slate-300">How to use:</strong> Send this message directly to <span className="text-indigo-400">{matchedPath.bridge_name}</span>. It politely requests the intro and includes the ready-made blurb below so they do not have to write anything themselves.
                      </p>
                    )}
                    {activeTab === 'blurb' && (
                      <p>
                        💡 <strong className="text-slate-300">Why this converts:</strong> This blurb is crafted from the perspective of <span className="text-indigo-400">{matchedPath.bridge_name}</span> forwarding it directly to <span className="text-emerald-400">{matchedPath.target_name}</span> at {matchedPath.target_company}.
                      </p>
                    )}
                    {activeTab === 'email' && (
                      <p>
                        💡 <strong className="text-slate-300">Subject line:</strong> High-conversion mutual connection format recommended for email or LinkedIn InMail introduction headers.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Bridge Contact: <strong className="text-slate-200">{matchedPath.bridge_name}</strong></span>
              <span>Target: <strong className="text-emerald-400">{matchedPath.target_name}</strong> ({matchedPath.target_company})</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          No target selected. Choose a 2nd-degree executive node above to compute the shortest warm path.
        </div>
      )}
    </div>
  );
};
