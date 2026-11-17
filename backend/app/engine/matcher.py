import math
import re
from typing import List, Dict, Set, Any

def tokenize_text(text: str) -> Set[str]:
    """Extract clean lowercase tokens from text."""
    if not text:
        return set()
    cleaned = re.sub(r"[^a-zA-Z0-9\s\+\#\.]", " ", text.lower())
    return {w.strip() for w in cleaned.split() if len(w.strip()) > 1}

def jaccard_similarity(set_a: Set[str], set_b: Set[str]) -> float:
    """Computes Jaccard similarity between two sets of terms."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return round(intersection / union, 4) if union > 0 else 0.0

def calculate_skills_cosine_similarity(user_skills: List[Dict[str, Any]], target_skills: List[str]) -> float:
    """
    Computes weighted cosine similarity between user skills (with proficiencies)
    and target skills.
    """
    if not user_skills or not target_skills:
        return 0.0
        
    user_skill_weights = {s["skill_name"].lower(): float(s.get("proficiency", 80)) / 100.0 for s in user_skills}
    target_skill_set = {s.lower() for s in target_skills}
    
    dot_product = 0.0
    sum_sq_user = sum(w * w for w in user_skill_weights.values())
    sum_sq_target = float(len(target_skill_set))
    
    if sum_sq_user == 0 or sum_sq_target == 0:
        return 0.0
        
    for skill_name, weight in user_skill_weights.items():
        if skill_name in target_skill_set:
            dot_product += weight * 1.0
            
    similarity = dot_product / (math.sqrt(sum_sq_user) * math.sqrt(sum_sq_target))
    return round(min(1.0, max(0.0, similarity)), 4)

def compute_node_strategic_value(
    company: str,
    role: str,
    skills: List[str],
    target_companies: List[str],
    target_roles: List[str],
    user_skills: List[Dict[str, Any]]
) -> int:
    """
    Calculates strategic value score (0-100) for a node based on target vectors.
    """
    score = 30  # Baseline
    
    company_lower = (company or "").lower().strip()
    role_lower = (role or "").lower().strip()
    
    # 1. Company Match (up to +35 pts)
    for tc in target_companies:
        tc_clean = tc.lower().strip()
        if tc_clean and (tc_clean in company_lower or company_lower in tc_clean):
            score += 35
            break
            
    # 2. Role Seniority & Function Match (up to +25 pts)
    role_tokens = tokenize_text(role_lower)
    seniority_keywords = {"vp", "vice president", "director", "head", "lead", "staff", "principal", "founder", "cto", "fellow"}
    if any(k in role_lower for k in seniority_keywords):
        score += 15
        
    for tr in target_roles:
        tr_tokens = tokenize_text(tr)
        overlap = role_tokens.intersection(tr_tokens)
        if overlap:
            score += min(15, len(overlap) * 8)
            break
            
    # 3. Technical Skill Synergy Match (up to +15 pts)
    if skills and user_skills:
        cos_sim = calculate_skills_cosine_similarity(user_skills, skills)
        score += int(cos_sim * 15)
        
    return min(100, max(10, score))
