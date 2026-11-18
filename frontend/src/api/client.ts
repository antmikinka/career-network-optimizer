import {
  ContactNode,
  GitHubCandidate,
  GraphEdge,
  PipelineExecutionSummary,
  UnifiedAppState,
  UserProfile,
} from '../types/graph';
import { DEFAULT_PROFILE, STORAGE_KEY } from '../engine/graphEngine';

const API_BASE = '/api';

export function loadLocalCache(): UnifiedAppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.profile && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse local cache:', err);
  }
  return {
    profile: DEFAULT_PROFILE,
    nodes: [],
    edges: [],
    lastSavedAt: new Date().toISOString(),
  };
}

export function saveLocalCache(state: UnifiedAppState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        lastSavedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn('Failed to write local cache:', err);
  }
}

export const syncClient = {
  async fetchUnifiedState(
    userId = 'default_user'
  ): Promise<{ state: UnifiedAppState; backendOnline: boolean }> {
    try {
      const res = await fetch(`${API_BASE}/state/${userId}`, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        const state: UnifiedAppState = {
          profile: data.profile,
          nodes: data.nodes || [],
          edges: data.edges || [],
          lastSavedAt: data.synced_at || new Date().toISOString(),
        };
        saveLocalCache(state);
        return { state, backendOnline: true };
      }
    } catch {
      // Fall back to local cache seamlessly
    }
    return { state: loadLocalCache(), backendOnline: false };
  },

  async pushFullSnapshot(
    snapshot: UnifiedAppState,
    userId = 'default_user'
  ): Promise<UnifiedAppState> {
    saveLocalCache(snapshot);
    const res = await fetch(`${API_BASE}/state/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (!res.ok) throw new Error('Backend snapshot sync failed');
    const data = await res.json();
    const synced: UnifiedAppState = {
      profile: data.profile,
      nodes: data.nodes,
      edges: data.edges,
      lastSavedAt: data.synced_at,
    };
    saveLocalCache(synced);
    return synced;
  },

  async updateProfile(
    profile: UserProfile,
    userId = 'default_user'
  ): Promise<UnifiedAppState | null> {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        const data = await res.json();
        return { profile: data.profile, nodes: data.nodes, edges: data.edges };
      }
    } catch {
      // Offline mode handled by caller
    }
    return null;
  },

  async createNode(
    payload: Partial<ContactNode> & {
      name: string;
      bridgeId?: string;
      bridgeWeight?: number;
      pastRole3YrsAgo?: string;
      similarityScore?: number;
    },
    userId = 'default_user'
  ): Promise<UnifiedAppState | null> {
    try {
      const res = await fetch(`${API_BASE}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payload.id,
          user_id: userId,
          full_name: payload.name,
          role: payload.role,
          company: payload.company,
          location: payload.location,
          degree: payload.degree,
          trust_score: payload.trustScore,
          strategic_value: payload.strategicValue,
          authority_level: payload.authorityLevel,
          cluster: payload.cluster,
          skills: payload.skills || [],
          past_role_3yrs_ago: payload.pastRole3YrsAgo || payload.pastState3YrsAgo?.role || '',
          knn_similarity: payload.similarityScore || payload.pastState3YrsAgo?.similarityScore || 0,
          vector_cluster: payload.pastState3YrsAgo?.vectorCluster || '',
          github_overlap: payload.githubOverlap || '',
          linkedin_url: payload.linkedinUrl || '',
          message_count: payload.messageCount || 0,
          bridge_id: payload.bridgeId,
          bridge_weight: payload.bridgeWeight,
          notes: payload.notes || payload.context || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          saveLocalCache(data.state);
          return data.state;
        }
      }
    } catch {
      // Offline fallback handled by caller
    }
    return null;
  },

  async patchNode(
    nodeId: string,
    patch: Partial<ContactNode> & { pastRole3YrsAgo?: string; similarityScore?: number }
  ): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/nodes/${encodeURIComponent(nodeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: patch.name,
          role: patch.role,
          company: patch.company,
          location: patch.location,
          degree: patch.degree,
          trust_score: patch.trustScore,
          strategic_value: patch.strategicValue,
          authority_level: patch.authorityLevel,
          cluster: patch.cluster,
          skills: patch.skills,
          past_role_3yrs_ago: patch.pastRole3YrsAgo,
          knn_similarity: patch.similarityScore,
          github_overlap: patch.githubOverlap,
          notes: patch.notes ?? patch.context,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteNode(nodeId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/nodes/${encodeURIComponent(nodeId)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async createEdge(
    edge: { source: string; target: string; weight: number; context: string },
    userId = 'default_user'
  ): Promise<UnifiedAppState | null> {
    try {
      const res = await fetch(`${API_BASE}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          source: edge.source,
          target: edge.target,
          weight: edge.weight,
          relationship_type: 'custom_bridge',
          context: edge.context,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          saveLocalCache(data.state);
          return data.state;
        }
      }
    } catch {
      // Offline fallback handled by caller
    }
    return null;
  },

  async deleteEdge(edge: GraphEdge, userId = 'default_user'): Promise<boolean> {
    try {
      const qs = new URLSearchParams({
        user_id: userId,
        source: edge.source,
        target: edge.target,
      });
      const res = await fetch(
        `${API_BASE}/edges/${encodeURIComponent(edge.id)}?${qs.toString()}`,
        { method: 'DELETE' }
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  async uploadLinkedInFile(
    file: File,
    userId = 'default_user'
  ): Promise<{
    results: {
      first_degree_count: number;
      second_degree_count: number;
      bridges_synthesized: number;
      edges_count: number;
    };
    state: UnifiedAppState;
  }> {
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/ingest/linkedin`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Archive import failed' }));
      throw new Error(err.detail || 'Archive import failed');
    }
    const data = await res.json();
    saveLocalCache(data.state);
    return data;
  },

  async uploadResume(
    resumeText: string,
    file?: File,
    userId = 'default_user'
  ): Promise<{ skills_saved: number; state: UnifiedAppState }> {
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('resume_text', resumeText);
    if (file) formData.append('file', file);

    const res = await fetch(`${API_BASE}/ingest/resume`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Resume parse failed' }));
      throw new Error(err.detail || 'Resume parse failed');
    }
    const data = await res.json();
    saveLocalCache(data.state);
    return { skills_saved: data.result.skills_saved, state: data.state };
  },

  async discoverGitHubCandidates(
    userId = 'default_user'
  ): Promise<{ candidates: GitHubCandidate[]; notes: string[] }> {
    const res = await fetch(`${API_BASE}/discover/github/${userId}`);
    if (!res.ok) {
      throw new Error('GitHub discovery endpoint unreachable');
    }
    const data = await res.json();
    return { candidates: data.candidates || [], notes: data.notes || [] };
  },

  async runRecalculationPipeline(
    processors: string[],
    paramsMap: Record<string, Record<string, unknown>>,
    userId = 'default_user'
  ): Promise<{ pipeline: PipelineExecutionSummary; state: UnifiedAppState }> {
    const res = await fetch(`${API_BASE}/process/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        processors,
        params_map: paramsMap,
      }),
    });
    if (!res.ok) {
      throw new Error('Backend pipeline execution failed');
    }
    const data = await res.json();
    saveLocalCache(data.state);
    return { pipeline: data.pipeline, state: data.state };
  },

  async resetDatabase(userId = 'default_user'): Promise<UnifiedAppState | null> {
    try {
      const res = await fetch(`${API_BASE}/reset/${userId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        saveLocalCache(data.state);
        return data.state;
      }
    } catch {
      // Offline fallback
    }
    return null;
  },

  async fetchSeedSQL(userId = 'default_user'): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}/export/sql/${userId}`);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // Offline fallback
    }
    return null;
  },
};
