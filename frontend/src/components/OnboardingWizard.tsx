import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  FileText, 
  UploadCloud, 
  Building2, 
  Target, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { UserProfile } from '../types/graph';
import { apiClient } from '../api/client';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  userProfile,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState(userProfile.full_name);
  const [headline, setHeadline] = useState(userProfile.headline);
  const [resumeText, setResumeText] = useState(
    'Staff Infrastructure & ML Systems Architect with deep hands-on expertise in Distributed Systems, PyTorch, ONNX/MLX Split-Graph Execution, Kafka, GPU Cluster Orchestration, and Humanoid Robotics Data Operations.'
  );

  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([
    'Figure', 'OpenAI', 'NVIDIA', 'Tesla', 'Apple', 'Anthropic'
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  if (!isOpen) return null;

  const toggleCompany = (comp: string) => {
    if (selectedCompanies.includes(comp)) {
      setSelectedCompanies(selectedCompanies.filter(c => c !== comp));
    } else {
      setSelectedCompanies([...selectedCompanies, comp]);
    }
  };

  const handleFinishWizard = async () => {
    setIsProcessing(true);
    setProgressMsg('Extracting technical competencies & career history...');

    try {
      // 1. Ingest Resume & Profile
      await apiClient.uploadResume(resumeText, undefined, userProfile.id);

      setProgressMsg('Calibrating target vector & recomputing warm Dijkstra routes...');
      // 2. Update target companies
      await apiClient.updateUserProfile(userProfile.id, {
        full_name: fullName,
        headline: headline,
        target_companies: selectedCompanies
      });

      setProgressMsg('Onboarding complete!');
      setTimeout(() => {
        setIsProcessing(false);
        onComplete();
        onClose();
      }, 800);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      onComplete();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Onboarding &amp; Network Calibration Wizard</h3>
            <p className="text-xs text-slate-400">Step {step} of 3 • Automated ingestion and 2nd-degree target graph setup</p>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step
                  ? 'bg-indigo-500'
                  : s < step
                  ? 'bg-emerald-500'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Identity & Technical Stack */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <h4 className="font-semibold text-white text-sm">Step 1: Identity &amp; Technical Stack</h4>
              <p className="text-slate-400">Define your root profile identity and career thesis.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 flex items-center justify-between">
                <span>Resume Summary or Technical Portfolio</span>
                <span className="text-[11px] text-indigo-400">Extracts skills &amp; experience automatically</span>
              </label>
              <textarea
                rows={5}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume, bio, or technical stack..."
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* Step 2: 1st-Degree Network (LinkedIn Dropzone / Quick Seed) */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <h4 className="font-semibold text-white text-sm">Step 2: 1st-Degree Network Ingestion</h4>
              <p className="text-slate-400">Automated relationship trust scoring via message frequency and coworker overlaps.</p>
            </div>

            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center space-y-3 bg-slate-950/40">
              <div className="h-12 w-12 rounded-xl bg-indigo-950 text-indigo-400 mx-auto flex items-center justify-center">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Drag &amp; drop your LinkedIn Archive ZIP or Connections.csv</p>
                <p className="text-slate-400 text-xs mt-1">
                  Includes messages.csv to auto-calculate edge weights between 0.15 and 0.98.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-mono">
                <ShieldCheck className="h-4 w-4" />
                <span>Zero cloud transmission — runs 100% locally in SQLite</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              (You can also click Next to proceed with the pre-seeded network and import real archives anytime from the header).
            </p>
          </div>
        )}

        {/* Step 3: Target Vector Selection */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <h4 className="font-semibold text-white text-sm">Step 3: Target Vector Selection</h4>
              <p className="text-slate-400">Choose your priority target companies to construct 2nd-degree executive bridges.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                'Figure', 'OpenAI', 'NVIDIA', 'Tesla', 'Apple', 'Anthropic',
                'Google DeepMind', 'Meta FAIR', 'Physical Intelligence', 'Boston Dynamics'
              ].map((comp) => {
                const isSelected = selectedCompanies.includes(comp);
                return (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => toggleCompany(comp)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-semibold text-xs">{comp}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                  </button>
                );
              })}
            </div>

            {isProcessing && (
              <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-300 text-center font-mono text-xs">
                {progressMsg}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-800">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as any)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <span>Continue</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={isProcessing}
              onClick={handleFinishWizard}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Launch Optimizer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
