import React, { useState } from 'react';
import { 
  Cpu, 
  Plus, 
  Trash2, 
  Building2, 
  Target, 
  Briefcase, 
  Save, 
  Sliders, 
  Check, 
  Sparkles,
  Layers
} from 'lucide-react';
import { UserProfile, UserSkill } from '../types/graph';

interface CareerStackViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

export const CareerStackView: React.FC<CareerStackViewProps> = ({
  userProfile,
  onUpdateProfile
}) => {
  const [fullName, setFullName] = useState(userProfile.full_name);
  const [headline, setHeadline] = useState(userProfile.headline);
  const [currentCompany, setCurrentCompany] = useState(userProfile.current_company);
  
  const [targetCompanies, setTargetCompanies] = useState<string[]>(userProfile.target_companies || []);
  const [newCompanyInput, setNewCompanyInput] = useState('');
  
  const [targetRoles, setTargetRoles] = useState<string[]>(userProfile.target_roles || []);
  const [newRoleInput, setNewRoleInput] = useState('');

  const [skills, setSkills] = useState<UserSkill[]>(userProfile.skills || []);
  const [isSaved, setIsSaved] = useState(false);

  // Add skill state
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'Core' | 'Systems' | 'Domain' | 'Leadership'>('Core');
  const [newSkillProficiency, setNewSkillProficiency] = useState(85);

  const handleSaveProfile = () => {
    onUpdateProfile({
      full_name: fullName,
      headline: headline,
      current_company: currentCompany,
      target_companies: targetCompanies,
      target_roles: targetRoles,
      skills: skills
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleAddCompany = () => {
    if (newCompanyInput.trim() && !targetCompanies.includes(newCompanyInput.trim())) {
      const updated = [...targetCompanies, newCompanyInput.trim()];
      setTargetCompanies(updated);
      setNewCompanyInput('');
    }
  };

  const handleRemoveCompany = (comp: string) => {
    setTargetCompanies(targetCompanies.filter(c => c !== comp));
  };

  const handleAddRole = () => {
    if (newRoleInput.trim() && !targetRoles.includes(newRoleInput.trim())) {
      const updated = [...targetRoles, newRoleInput.trim()];
      setTargetRoles(updated);
      setNewRoleInput('');
    }
  };

  const handleRemoveRole = (role: string) => {
    setTargetRoles(targetRoles.filter(r => r !== role));
  };

  const handleUpdateProficiency = (skillName: string, prof: number) => {
    setSkills(skills.map(s => s.skill_name === skillName ? { ...s, proficiency: prof } : s));
  };

  const handleDeleteSkill = (skillName: string) => {
    setSkills(skills.filter(s => s.skill_name !== skillName));
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;

    const existing = skills.find(s => s.skill_name.toLowerCase() === newSkillName.trim().toLowerCase());
    if (existing) {
      handleUpdateProficiency(existing.skill_name, newSkillProficiency);
    } else {
      setSkills([...skills, {
        skill_name: newSkillName.trim(),
        category: newSkillCategory,
        proficiency: newSkillProficiency
      }]);
    }

    setNewSkillName('');
  };

  const categories: Array<'Core' | 'Systems' | 'Domain' | 'Leadership'> = ['Core', 'Systems', 'Domain', 'Leadership'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Career Vector &amp; Technical Stack Database</h2>
            <p className="text-xs text-slate-400">User competencies, target company vectors, and cosine skill matching parameters</p>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
        >
          {isSaved ? (
            <>
              <Check className="h-4 w-4 text-emerald-300" />
              <span>Saved Successfully</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Save Career Vector</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Identity & Target Vectors (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Identity Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
              <span>User Identity &amp; Root Profile</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Professional Headline</label>
                <textarea
                  rows={2}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Current / Past Anchor Organization</label>
                <input
                  type="text"
                  value={currentCompany}
                  onChange={(e) => setCurrentCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Target Companies Vector Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Target Companies (Method A Bridge Vector)</span>
            </h3>

            <div className="flex flex-wrap gap-2">
              {targetCompanies.map((comp) => (
                <span
                  key={comp}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium flex items-center gap-1.5"
                >
                  <span>{comp}</span>
                  <button
                    onClick={() => handleRemoveCompany(comp)}
                    className="text-slate-500 hover:text-red-400 ml-1"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Add target company (e.g. Figure)..."
                value={newCompanyInput}
                onChange={(e) => setNewCompanyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompany())}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleAddCompany}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                Add
              </button>
            </div>
          </div>

          {/* Target Roles Vector Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-purple-400" />
              <span>Target Strategic Roles</span>
            </h3>

            <div className="flex flex-wrap gap-2">
              {targetRoles.map((role) => (
                <span
                  key={role}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-purple-500/30 text-purple-300 text-xs font-medium flex items-center gap-1.5"
                >
                  <span>{role}</span>
                  <button
                    onClick={() => handleRemoveRole(role)}
                    className="text-slate-500 hover:text-red-400 ml-1"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Add target role (e.g. Robotics Architect)..."
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRole())}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleAddRole}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Categorized Technical Skills Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Add Skill Form */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-indigo-400" />
              <span>Add Technical Competency</span>
            </h3>

            <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row items-center gap-3 text-xs">
              <input
                type="text"
                required
                placeholder="Skill name (e.g. Triton, ROS2)..."
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 w-full"
              />

              <select
                value={newSkillCategory}
                onChange={(e) => setNewSkillCategory(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Core">Core</option>
                <option value="Systems">Systems</option>
                <option value="Domain">Domain</option>
                <option value="Leadership">Leadership</option>
              </select>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-400 font-mono">{newSkillProficiency}%</span>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={newSkillProficiency}
                  onChange={(e) => setNewSkillProficiency(Number(e.target.value))}
                  className="w-16 accent-indigo-500 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shrink-0 shadow-md shadow-indigo-600/30"
              >
                Add Skill
              </button>
            </form>
          </div>

          {/* Categorized Skills Grids */}
          {categories.map((cat) => {
            const catSkills = skills.filter(s => s.category === cat);
            return (
              <div key={cat} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${
                      cat === 'Core' ? 'bg-indigo-400' :
                      cat === 'Systems' ? 'bg-cyan-400' :
                      cat === 'Domain' ? 'bg-emerald-400' : 'bg-purple-400'
                    }`} />
                    <span>{cat} Architecture ({catSkills.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">Proficiency Weight</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {catSkills.map((s) => (
                    <div
                      key={s.skill_name}
                      className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 group hover:border-slate-700 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate">{s.skill_name}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="range"
                            min="50"
                            max="100"
                            step="2"
                            value={s.proficiency}
                            onChange={(e) => handleUpdateProficiency(s.skill_name, Number(e.target.value))}
                            className="w-full accent-indigo-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-indigo-300 w-8 text-right">
                          {s.proficiency}%
                        </span>
                        <button
                          onClick={() => handleDeleteSkill(s.skill_name)}
                          className="text-slate-600 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
