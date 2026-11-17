import React from 'react';
import { 
  Network, 
  Compass, 
  GitFork, 
  Send, 
  Users, 
  Cpu, 
  UploadCloud, 
  Sparkles, 
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UserProfile } from '../types/graph';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userProfile: UserProfile;
  isBackendConnected: boolean;
  onOpenImport: () => void;
  onOpenWizard: () => void;
  onResetDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  userProfile,
  isBackendConnected,
  onOpenImport,
  onOpenWizard,
  onResetDemo
}) => {
  const navTabs = [
    { id: 'command-center', label: 'Command Center', icon: Compass },
    { id: 'network-graph', label: 'Network Graph', icon: Network },
    { id: 'path-calc', label: 'Path Calculator', icon: GitFork },
    { id: 'contacts-db', label: 'Contacts DB', icon: Users },
    { id: 'career-stack', label: 'Career & Stack DB', icon: Cpu },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <Network className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">
                Career Network <span className="text-indigo-400">Optimizer</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 uppercase">
                v1.0 Hybrid
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-slate-300 font-medium">{userProfile.full_name}</span>
              <span className="text-slate-600">•</span>
              <span className="truncate max-w-[200px] text-slate-400">{userProfile.current_company}</span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                {isBackendConnected ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400">SQLite + FastAPI Active</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-amber-300">Local-First Storage</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-medium transition-all"
            title="Import LinkedIn archive zip or CSVs"
          >
            <UploadCloud className="h-3.5 w-3.5 text-indigo-400" />
            <span>Ingest Archive</span>
          </button>

          <button
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 text-xs font-medium transition-all"
            title="Run interactive onboarding wizard"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Setup Wizard</span>
          </button>

          <button
            onClick={onResetDemo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all border border-slate-800"
            title="Reset to high-fidelity demo network"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
