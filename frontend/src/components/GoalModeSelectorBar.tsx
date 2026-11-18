import React from 'react';
import { Cpu, Layers, Sparkles, Target, TrendingUp } from 'lucide-react';
import { GoalModeId } from '../types/graph';
import { GOAL_MODES } from '../engine/graphEngine';

const MODE_ICONS: Record<GoalModeId, React.ComponentType<{ className?: string }>> = {
  trajectory: TrendingUp,
  infiltration: Target,
  gravity: Cpu,
  structural: Layers,
};

interface GoalModeSelectorBarProps {
  activeGoalMode: GoalModeId;
  onSelectGoalMode: (mode: GoalModeId) => void;
}

export const GoalModeSelectorBar: React.FC<GoalModeSelectorBarProps> = ({
  activeGoalMode,
  onSelectGoalMode,
}) => {
  const activeObj = GOAL_MODES.find((m) => m.id === activeGoalMode) || GOAL_MODES[0];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[11px]">
              EXPECTED CAREER VALUE (EV) ENGINE
            </span>
            <span className="text-xs font-mono text-slate-400">
              EV(v) = P(Reach v) × Authority(v) × SkillSynergy(You, v) × GoalModeBoost(v)
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1.5">
            <strong className="text-cyan-400">{activeObj.name}:</strong> {activeObj.description}
          </p>
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{activeObj.formulaNote}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {GOAL_MODES.map((mode) => {
          const Icon = MODE_ICONS[mode.id];
          const isSelected = mode.id === activeGoalMode;
          return (
            <button
              key={mode.id}
              onClick={() => onSelectGoalMode(mode.id)}
              className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-br from-cyan-500/20 via-indigo-500/15 to-slate-900 border-cyan-400/60 shadow-lg shadow-cyan-950/50'
                  : 'bg-slate-950/70 hover:bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span
                  className={`text-xs font-bold ${
                    isSelected ? 'text-white' : 'text-slate-200'
                  }`}
                >
                  {mode.name}
                </span>
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5">
                {mode.formulaNote}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
