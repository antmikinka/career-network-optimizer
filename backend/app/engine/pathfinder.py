import math
import sqlite3
import json
from typing import Dict, List, Any, Optional, Tuple
import networkx as nx

def build_nx_graph(conn: sqlite3.Connection, user_id: str) -> nx.Graph:
    """Builds a NetworkX graph from SQLite nodes and edges for the given user_id."""
    G = nx.Graph()
    
    # Query nodes
    nodes = conn.execute("SELECT * FROM nodes WHERE user_id = ?", (user_id,)).fetchall()
    for n in nodes:
        node_dict = dict(n)
        try:
            node_dict["skills"] = json.loads(node_dict.get("skills_json") or "[]")
        except Exception:
            node_dict["skills"] = []
        G.add_node(node_dict["id"], **node_dict)
        
    # Query edges
    edges = conn.execute("SELECT * FROM edges WHERE user_id = ?", (user_id,)).fetchall()
    for e in edges:
        w = max(0.05, min(0.99, float(e["weight"])))
        # Friction cost is negative natural log of edge weight: low weight = high friction
        cost = -math.log(w)
        G.add_edge(
            e["source_id"], 
            e["target_id"], 
            weight=w, 
            cost=cost, 
            relationship_type=e["relationship_type"],
            context=e["context"]
        )
        
    return G

def compute_centrality_metrics(G: nx.Graph) -> Dict[str, Dict[str, float]]:
    """Calculates Betweenness Centrality and Degree Centrality for all nodes."""
    if len(G) <= 2:
        return {n: {"betweenness": 0.0, "degree": 0.0} for n in G.nodes}
        
    try:
        betweenness = nx.betweenness_centrality(G, weight="cost", normalized=True)
    except Exception:
        betweenness = {n: 0.0 for n in G.nodes}
        
    degree_cent = nx.degree_centrality(G)
    
    metrics = {}
    for n in G.nodes:
        metrics[n] = {
            "betweenness": round(betweenness.get(n, 0.0), 4),
            "degree": round(degree_cent.get(n, 0.0), 4),
        }
    return metrics

def calculate_warm_paths(G: nx.Graph, user_id: str) -> List[Dict[str, Any]]:
    """
    Computes optimal warm introduction routes from the root node to all 2nd & 3rd degree targets
    using weighted Dijkstra on friction costs.
    """
    root_id = f"{user_id}_root"
    if root_id not in G:
        return []
        
    try:
        lengths, routes = nx.single_source_dijkstra(G, root_id, weight="cost")
    except Exception:
        return []
        
    paths = []
    for target_id, cost in lengths.items():
        if target_id == root_id:
            continue
            
        target_node = G.nodes[target_id]
        degree = target_node.get("degree", 1)
        if degree < 2:
            # 1st-degree connections are already direct; focus paths on 2nd and 3rd degree
            continue
            
        route_ids = routes[target_id]
        if len(route_ids) < 3:
            # At least root -> bridge -> target
            continue
            
        bridge_id = route_ids[1]
        bridge_node = G.nodes.get(bridge_id, {})
        
        # Total conversion probability: P = exp(-sum(costs))
        prob = round(math.exp(-cost) * 100, 1)
        
        # Collect edge information along the route
        route_edges = []
        for i in range(len(route_ids) - 1):
            u, v = route_ids[i], route_ids[i+1]
            edge_data = G.get_edge_data(u, v, {})
            route_edges.append({
                "source": u,
                "target": v,
                "weight": round(edge_data.get("weight", 0.5), 2),
                "relationship_type": edge_data.get("relationship_type", "direct"),
                "context": edge_data.get("context", "")
            })
            
        # Target skills vs user skills overlap
        target_skills = set(target_node.get("skills", []))
        root_skills = set(G.nodes[root_id].get("skills", []))
        shared_skills = list(target_skills.intersection(root_skills))
        
        paths.append({
            "target_id": target_id,
            "target_name": target_node.get("full_name", ""),
            "target_role": target_node.get("role", ""),
            "target_company": target_node.get("company", ""),
            "target_degree": degree,
            "strategic_value": target_node.get("strategic_value", 50),
            "bridge_id": bridge_id,
            "bridge_name": bridge_node.get("full_name", ""),
            "bridge_role": bridge_node.get("role", ""),
            "bridge_company": bridge_node.get("company", ""),
            "bridge_trust": round(bridge_node.get("trust_score", 0.5), 2),
            "route_ids": route_ids,
            "route_nodes": [dict(G.nodes[nid]) for nid in route_ids],
            "route_edges": route_edges,
            "conversion_prob": prob,
            "friction_cost": round(cost, 2),
            "shared_skills": shared_skills,
        })
        
    # Sort paths by strategic value * conversion probability
    paths.sort(key=lambda p: (p["strategic_value"] * (p["conversion_prob"] / 100.0)), reverse=True)
    return paths

def generate_outreach_blurbs(
    user_name: str,
    user_headline: str,
    user_skills: List[str],
    bridge_name: str,
    bridge_company: str,
    target_name: str,
    target_role: str,
    target_company: str,
    shared_skills: List[str],
    context: str = ""
) -> Dict[str, str]:
    """
    Generates a personalized warm intro request for the bridge connector
    and a forwardable blurb for the target decision maker.
    """
    skills_mention = ", ".join(shared_skills[:3]) if shared_skills else "distributed systems and data architecture"
    
    # 1. Warm Request to the Bridge Connector
    bridge_first_name = bridge_name.split()[0] if bridge_name else "there"
    target_first_name = target_name.split()[0] if target_name else "them"
    
    bridge_intro_request = (
        f"Hi {bridge_first_name},\n\n"
        f"Hope things are going well at {bridge_company}! "
        f"I've been closely following what {target_company} is building in {skills_mention}, "
        f"and noticed you're connected with {target_name} ({target_role}).\n\n"
        f"I'm currently exploring strategic engineering roles aligned with my background in {user_headline}. "
        f"Would you be open to introducing us if you feel comfortable? "
        f"I've written a brief forwardable blurb below to make it zero-lift for you.\n\n"
        f"Either way, appreciate you and let's catch up soon!\n\n"
        f"Best,\n{user_name}"
    )
    
    # 2. Forwardable Blurb (One-click forward for the bridge)
    skills_list = " • ".join(user_skills[:4]) if user_skills else "Full-stack ML • Data Systems • Infrastructure"
    forwardable_blurb = (
        f"Hey {target_first_name} — Quick warm intro to {user_name} ({user_headline}).\n\n"
        f"{user_name} has deep hands-on expertise across {skills_list}. "
        f"Given your focus at {target_company} on scaling systems, thought you two would really benefit from connecting. "
        f"I've worked with/known {user_name} and can personally vouch for their technical caliber.\n\n"
        f"Dropping {user_name}'s info here in case you'd like to chat!"
    )
    
    return {
        "bridge_intro_request": bridge_intro_request,
        "forwardable_blurb": forwardable_blurb,
        "email_subject": f"Introduction: {user_name} <> {target_name} ({target_company})"
    }
