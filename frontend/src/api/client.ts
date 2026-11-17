import { NetworkGraphState, UserProfile, UserSkill, NetworkNode, NetworkEdge, CalculatedPath, OutreachPackage } from '../types/graph';
import { DEFAULT_GRAPH_STATE, DEFAULT_USER_PROFILE } from '../data/defaultData';

const API_BASE = '/api';

// Storage keys for offline persistence
const STORAGE_GRAPH_KEY = 'cno_network_graph_v1';
const STORAGE_USER_KEY = 'cno_user_profile_v1';

function loadStoredState(): NetworkGraphState {
  try {
    const raw = localStorage.getItem(STORAGE_GRAPH_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached graph', e);
  }
  return DEFAULT_GRAPH_STATE;
}

function saveStoredState(state: NetworkGraphState) {
  try {
    localStorage.setItem(STORAGE_GRAPH_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to cache graph state', e);
  }
}

function loadStoredUser(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached profile', e);
  }
  return DEFAULT_USER_PROFILE;
}

function saveStoredUser(profile: UserProfile) {
  try {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to cache user profile', e);
  }
}

export const apiClient = {
  async isBackendHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getUserProfile(userId: string = 'default_user'): Promise<UserProfile> {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        saveStoredUser(data);
        return data;
      }
    } catch (e) {
      console.warn('Backend unavailable, using cached profile', e);
    }
    return loadStoredUser();
  },

  async updateUserProfile(userId: string, update: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        return this.getUserProfile(userId);
      }
    } catch (e) {
      console.warn('Backend unavailable, updating local cache', e);
    }
    const current = loadStoredUser();
    const updated = { ...current, ...update };
    saveStoredUser(updated);
    return updated;
  },

  async getNetworkGraph(userId: string = 'default_user'): Promise<NetworkGraphState> {
    try {
      const res = await fetch(`${API_BASE}/graph/${userId}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        saveStoredState(data);
        return data;
      }
    } catch (e) {
      console.warn('Backend unavailable, using local graph cache', e);
    }
    return loadStoredState();
  },

  async patchNode(nodeId: string, patch: Partial<NetworkNode>): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn('Backend unavailable, applying local node patch', e);
    }
    
    // Local fallback update
    const current = loadStoredState();
    const updatedNodes = current.nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n);
    const updatedEdges = current.edges.map(e => {
      if (patch.trust_score !== undefined && (e.source === nodeId || e.target === nodeId) && e.relationship_type === 'linkedin_1st') {
        return { ...e, weight: patch.trust_score };
      }
      return e;
    });
    saveStoredState({ ...current, nodes: updatedNodes, edges: updatedEdges });
    return true;
  },

  async createNode(node: Partial<NetworkNode> & { user_id: string; full_name: string }): Promise<NetworkNode> {
    try {
      const res = await fetch(`${API_BASE}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(node),
      });
      if (res.ok) {
        const result = await res.json();
        return { ...node, id: result.node_id } as NetworkNode;
      }
    } catch (e) {
      console.warn('Backend unavailable, creating local node', e);
    }
    
    const newNode: NetworkNode = {
      id: node.id || `${node.user_id}_n_${Date.now()}`,
      full_name: node.full_name,
      role: node.role || 'Professional',
      company: node.company || 'Tech Corp',
      degree: node.degree ?? 1,
      trust_score: node.trust_score ?? 0.5,
      strategic_value: node.strategic_value ?? 60,
      skills: node.skills || ['Distributed Systems'],
      notes: node.notes || 'Added manually'
    };
    
    const current = loadStoredState();
    current.nodes.push(newNode);
    if (newNode.degree === 1) {
      current.edges.push({
        source: `${node.user_id}_root`,
        target: newNode.id,
        weight: newNode.trust_score,
        relationship_type: 'direct',
        context: 'Direct connection'
      });
    }
    saveStoredState(current);
    return newNode;
  },

  async deleteNode(nodeId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/nodes/${nodeId}`, { method: 'DELETE' });
      if (res.ok) return true;
    } catch (e) {
      console.warn('Backend unavailable, deleting local node', e);
    }
    
    const current = loadStoredState();
    const filteredNodes = current.nodes.filter(n => n.id !== nodeId);
    const filteredEdges = current.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    saveStoredState({ ...current, nodes: filteredNodes, edges: filteredEdges });
    return true;
  },

  async getOutreach(userId: string, targetId: string): Promise<{ outreach: OutreachPackage; bridge_name: string; bridge_company: string; conversion_prob: number }> {
    try {
      const res = await fetch(`${API_BASE}/outreach/${userId}/${targetId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend unavailable, generating local outreach template', e);
    }

    const state = loadStoredState();
    const user = loadStoredUser();
    const target = state.nodes.find(n => n.id === targetId);
    const matchedPath = state.calculated_paths.find(p => p.target_id === targetId);

    const bridgeName = matchedPath ? matchedPath.bridge_name : 'Colleague';
    const bridgeCompany = matchedPath ? matchedPath.bridge_company : 'Tech';
    const targetName = target ? target.full_name : 'Target Lead';
    const targetCompany = target ? target.company : 'Company';
    const targetRole = target ? target.role : 'Leader';

    return {
      bridge_name: bridgeName,
      bridge_company: bridgeCompany,
      conversion_prob: matchedPath ? matchedPath.conversion_prob : 65.0,
      outreach: {
        email_subject: `Introduction: ${user.full_name} <> ${targetName} (${targetCompany})`,
        bridge_intro_request: `Hi ${bridgeName.split(' ')[0]},\n\nHope things are going well at ${bridgeCompany}! I've been closely following what ${targetCompany} is building in robotics data platforms and distributed systems, and noticed you're connected with ${targetName} (${targetRole}).\n\nI'm exploring strategic engineering roles aligned with my background in ${user.headline}. Would you be open to introducing us if you feel comfortable? I've prepared a brief forwardable blurb below to keep it zero-lift for you.\n\nBest,\n${user.full_name}`,
        forwardable_blurb: `Hey ${targetName.split(' ')[0]} — Quick warm intro to ${user.full_name} (${user.headline}).\n\n${user.full_name} has deep hands-on expertise in distributed infrastructure and data operations. Given your focus at ${targetCompany} on scaling systems, thought you two would benefit from connecting. I've known ${user.full_name} and can vouch for their technical execution.\n\nDropping ${user.full_name}'s info here in case you'd like to chat!`
      }
    };
  },

  async uploadLinkedInArchive(file: File, userId: string = 'default_user'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);

    const res = await fetch(`${API_BASE}/ingest/linkedin`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Archive upload failed');
    }
    return await res.json();
  },

  async uploadResume(resumeText: string, file?: File, userId: string = 'default_user'): Promise<any> {
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('resume_text', resumeText);
    if (file) {
      formData.append('file', file);
    }

    const res = await fetch(`${API_BASE}/ingest/resume`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error('Resume processing failed');
    }
    return await res.json();
  },

  async resetDemo(userId: string = 'default_user'): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/demo-seed/${userId}`, { method: 'POST' });
      if (res.ok) {
        saveStoredState(DEFAULT_GRAPH_STATE);
        saveStoredUser(DEFAULT_USER_PROFILE);
        return true;
      }
    } catch {
      // offline reset
    }
    saveStoredState(DEFAULT_GRAPH_STATE);
    saveStoredUser(DEFAULT_USER_PROFILE);
    return true;
  }
};
