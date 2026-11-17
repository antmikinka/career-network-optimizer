import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  ShieldCheck, 
  Building2, 
  Download, 
  X, 
  Save 
} from 'lucide-react';
import { NetworkNode, NetworkGraphState } from '../types/graph';

interface ContactsTableProps {
  graphState: NetworkGraphState;
  onUpdateNodeTrust: (nodeId: string, newTrust: number) => void;
  onCreateNode: (node: Partial<NetworkNode> & { user_id: string; full_name: string }) => void;
  onDeleteNode: (nodeId: string) => void;
  onSelectTargetForOutreach: (targetId: string) => void;
}

export const ContactsTable: React.FC<ContactsTableProps> = ({
  graphState,
  onUpdateNodeTrust,
  onCreateNode,
  onDeleteNode,
  onSelectTargetForOutreach,
}) => {
  const [search, setSearch] = useState('');
  const [degreeFilter, setDegreeFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Add modal state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newDegree, setNewDegree] = useState<1 | 2 | 3>(1);
  const [newTrust, setNewTrust] = useState(0.7);
  const [newStrategic, setNewStrategic] = useState(75);
  const [newSkills, setNewSkills] = useState('Distributed Systems, PyTorch');
  const [newNotes, setNewNotes] = useState('Added via contacts database');

  const filteredContacts = useMemo(() => {
    return graphState.nodes.filter(n => {
      if (n.degree === 0) return false; // don't list root node in contacts table
      if (degreeFilter !== 'all' && n.degree.toString() !== degreeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const mName = n.full_name.toLowerCase().includes(q);
        const mComp = (n.company || '').toLowerCase().includes(q);
        const mRole = (n.role || '').toLowerCase().includes(q);
        if (!mName && !mComp && !mRole) return false;
      }
      return true;
    });
  }, [graphState.nodes, search, degreeFilter]);

  const handleExportCSV = () => {
    const headers = ['Full Name', 'Role', 'Company', 'Degree', 'Trust Score', 'Strategic Value', 'Notes'];
    const rows = filteredContacts.map(n => [
      `"${n.full_name}"`,
      `"${n.role}"`,
      `"${n.company}"`,
      n.degree,
      n.trust_score,
      n.strategic_value,
      `"${(n.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `network_contacts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onCreateNode({
      user_id: graphState.user_id,
      full_name: newName.trim(),
      role: newRole.trim() || 'Software Engineer',
      company: newCompany.trim() || 'Tech',
      degree: newDegree,
      trust_score: newTrust,
      strategic_value: newStrategic,
      skills: newSkills.split(',').map(s => s.trim()).filter(Boolean),
      notes: newNotes
    });

    setIsAddModalOpen(false);
    setNewName('');
    setNewRole('');
    setNewCompany('');
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header & Controls Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Connections &amp; Relational Database</h2>
            <p className="text-xs text-slate-400">Searchable repository of 1st, 2nd, and 3rd degree topology nodes</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Degree Filter */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
            {(['all', '1', '2', '3'] as const).map(deg => (
              <button
                key={deg}
                onClick={() => setDegreeFilter(deg)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  degreeFilter === deg
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {deg === 'all' ? 'All' : `${deg}°`}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Add Contact */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Connection</span>
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Role &amp; Company</th>
                <th className="py-3 px-4">Degree</th>
                <th className="py-3 px-4">Trust Score</th>
                <th className="py-3 px-4">Strategic Value</th>
                <th className="py-3 px-4">Context &amp; Skills</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{contact.full_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{contact.id}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-200">{contact.role}</div>
                    <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3 text-slate-500" />
                      <span>{contact.company}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      contact.degree === 1
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : contact.degree === 2
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {contact.degree}° Degree
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.1"
                        max="0.98"
                        step="0.02"
                        value={contact.trust_score}
                        onChange={(e) => onUpdateNodeTrust(contact.id, parseFloat(e.target.value))}
                        className="w-16 accent-indigo-500 cursor-pointer"
                      />
                      <span className="font-mono text-emerald-400 font-semibold w-8">
                        {Math.round(contact.trust_score * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                    {contact.strategic_value} / 100
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="text-[11px] text-slate-400 truncate mb-1">
                      {contact.notes || 'Direct connection'}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(contact.skills || []).slice(0, 2).map(s => (
                        <span key={s} className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
                          {s}
                        </span>
                      ))}
                      {(contact.skills || []).length > 2 && (
                        <span className="text-[10px] text-slate-500">+{contact.skills.length - 2} more</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {contact.degree >= 2 && (
                        <button
                          onClick={() => onSelectTargetForOutreach(contact.id)}
                          className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-[11px] font-medium"
                          title="Compute warm intro path"
                        >
                          Path
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteNode(contact.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        title="Delete contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">Add Connection to Network</h3>

            <form onSubmit={handleAddContactSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Samantha Wu"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Company</label>
                  <input
                    type="text"
                    required
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="e.g. Figure"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Role / Title</label>
                  <input
                    type="text"
                    required
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="e.g. Staff Robotics Architect"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Degree</label>
                  <select
                    value={newDegree}
                    onChange={(e) => setNewDegree(Number(e.target.value) as 1 | 2 | 3)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={1}>1st Degree (Direct)</option>
                    <option value={2}>2nd Degree (Target)</option>
                    <option value={3}>3rd Degree (Partner)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Trust Score ({Math.round(newTrust * 100)}%)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.98"
                    step="0.05"
                    value={newTrust}
                    onChange={(e) => setNewTrust(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 mt-2 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={newSkills}
                  onChange={(e) => setNewSkills(e.target.value)}
                  placeholder="e.g. PyTorch, Distributed Systems, ROS2"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Context / Interaction Notes</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30"
                >
                  Save Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
