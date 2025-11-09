from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.assessment import Assessment, UserSkill
from app.models.job import Job

router = APIRouter()

# Mock job database for now
MOCK_JOBS = [
    {
        "id": 1,
        "title": "Senior Frontend Developer",
        "company": "TechCorp",
        "description": "We're looking for a senior frontend developer to join our team...",
        "location": "San Francisco, CA / Remote",
        "salary": "$120k - $180k",
        "job_type": "Full-time",
        "remote_status": "Remote",
        "experience_level": "Senior Level",
        "required_skills": ["React", "TypeScript", "JavaScript", "CSS"],
        "preferred_skills": ["Next.js", "GraphQL", "AWS"],
        "benefits": ["Health insurance", "401k", "Remote work", "Learning budget"],
        "posted_at": "2024-01-15",
        "source": "LinkedIn"
    },
    {
        "id": 2,
        "title": "Full Stack Engineer",
        "company": "StartupXYZ",
        "description": "Join our fast-growing startup as a full stack engineer...",
        "location": "New York, NY",
        "salary": "$90k - $140k",
        "job_type": "Full-time",
        "remote_status": "Hybrid",
        "experience_level": "Mid Level",
        "required_skills": ["JavaScript", "Node.js", "React", "SQL"],
        "preferred_skills": ["Docker", "AWS", "MongoDB"],
        "benefits": ["Equity", "Health insurance", "Flexible hours"],
        "posted_at": "2024-01-10",
        "source": "Indeed"
    },
    {
        "id": 3,
        "title": "Junior Web Developer",
        "company": "Digital Agency",
        "description": "Looking for junior developers to work on exciting client projects...",
        "location": "Austin, TX",
        "salary": "$60k - $80k",
        "job_type": "Full-time",
        "remote_status": "On-site",
        "experience_level": "Entry Level",
        "required_skills": ["HTML", "CSS", "JavaScript"],
        "preferred_skills": ["React", "WordPress", "SEO"],
        "benefits": ["Training program", "Health insurance"],
        "posted_at": "2024-01-12",
        "source": "Company website"
    }
]

def calculate_skill_match(user_skills: Dict[str, str], job_required: List[str], job_preferred: List[str]) -> Dict[str, Any]:
    """Calculate skill match score and analysis"""
    user_skill_names = set(user_skills.keys())
    
    # Required skills match (most important)
    required_matches = len([skill for skill in job_required if skill in user_skill_names])
    required_score = (required_matches / len(job_required)) if job_required else 0
    
    # Preferred skills match (bonus)
    preferred_matches = len([skill for skill in job_preferred if skill in user_skill_names])
    preferred_score = (preferred_matches / len(job_preferred)) if job_preferred else 0
    
    # Overall skill score (70% required, 30% preferred)
    skill_score = (required_score * 0.7) + (preferred_score * 0.3)
    
    # Identify skill gaps
    skill_gaps = [skill for skill in job_required if skill not in user_skill_names]
    
    # Identify matching reasons
    match_reasons = []
    if required_matches >= len(job_required) * 0.8:
        match_reasons.append(f"Strong skill match ({required_matches}/{len(job_required)} required skills)")
    
    if preferred_matches >= len(job_preferred) * 0.5:
        match_reasons.append(f"Bonus skills ({preferred_matches} preferred skills)")
    
    return {
        "score": skill_score * 100,
        "required_matches": required_matches,
        "preferred_matches": preferred_matches,
        "skill_gaps": skill_gaps,
        "match_reasons": match_reasons
    }

def calculate_experience_match(user_experience: str, job_experience: str) -> float:
    """Calculate experience level match"""
    experience_map = {
        "Entry Level (0-2 years)": 1,
        "Mid Level (2-5 years)": 3.5,
        "Senior Level (5+ years)": 7,
        "Lead/Principal Level": 10
    }
    
    user_level = experience_map.get(user_experience, 0)
    job_level = experience_map.get(job_experience, 0)
    
    # Perfect match = 1.0
    if abs(user_level - job_level) <= 1:
        return 1.0
    # Close match = 0.7
    elif abs(user_level - job_level) <= 2:
        return 0.7
    # Overqualified = 0.5
    elif user_level > job_level:
        return 0.5
    # Underqualified = 0.3
    else:
        return 0.3

def analyze_company_culture(job_description: str) -> Dict[str, str]:
    """Analyze company culture from job description"""
    description_lower = job_description.lower()
    
    culture_indicators = {
        "fast_paced": ["fast-paced", "dynamic", "rapidly", "quickly", "startup", "agile"],
        "innovative": ["innovative", "cutting-edge", "forward-thinking", "creative", "disrupt"],
        "collaborative": ["team", "collaborative", "together", "cross-functional", "partnership"],
        "structured": ["established", "process", "methodology", "structured", "formal"],
        "growth_focused": ["growth", "learn", "develop", "mentor", "training", "career"]
    }
    
    culture_scores = {}
    for culture_type, keywords in culture_indicators.items():
        score = sum(1 for keyword in keywords if keyword in description_lower)
        if score > 0:
            culture_scores[culture_type] = "high" if score >= 2 else "medium"
    
    return culture_scores

def calculate_market_intelligence(job: Dict[str, Any], match_score: float) -> Dict[str, Any]:
    """Calculate market intelligence for the job match"""
    # Mock market data (in real app, this would come from market APIs)
    avg_salaries = {
        "Senior Level": 150000,
        "Mid Level": 100000, 
        "Entry Level": 70000
    }
    
    job_exp = job.get("experience_level", "")
    avg_salary = avg_salaries.get(job_exp, 100000)
    job_salary_range = job.get("salary", "")
    
    # Extract max salary for comparison
    import re
    salary_match = re.search(r'\$(\d+)k', job_salary_range)
    job_max_salary = int(salary_match.group(1)) * 1000 if salary_match else avg_salary
    
    salary_position = "average"
    if job_max_salary > avg_salary * 1.2:
        salary_position = "above_average"
    elif job_max_salary < avg_salary * 0.8:
        salary_position = "below_average"
    
    # Competition analysis (mock data)
    competition_level = "high" if match_score > 80 else "medium" if match_score > 60 else "low"
    
    return {
        "salary_comparison": {
            "position": salary_position,
            "industry_average": avg_salary,
            "job_max": job_max_salary
        },
        "competition_level": competition_level,
        "success_probability": min(95, max(20, match_score + 10)),
        "time_to_hire": "2-4 weeks" if competition_level == "low" else "4-6 weeks" if competition_level == "medium" else "6-8 weeks"
    }

@router.get("/matches/{user_id}")
async def get_job_matches(user_id: str, db: Session = Depends(get_db)):
    """Get intelligent job matches for a user"""
    
    # Get user's assessment data
    assessment = db.query(Assessment).filter(Assessment.user_id == user_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Get user skills
    user_skills_data = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
    user_skills = {skill.skill_name: skill.proficiency_level for skill in user_skills_data}
    
    # Get assessment answers
    answers = assessment.career_interests or {}
    user_experience = answers.get("experience_level", "")
    career_interests = answers.get("career_interests", [])
    
    matches = []
    
    for job in MOCK_JOBS:
        # Calculate multi-dimensional match
        skill_analysis = calculate_skill_match(
            user_skills, 
            job["required_skills"], 
            job["preferred_skills"]
        )
        
        experience_match = calculate_experience_match(user_experience, job["experience_level"])
        
        # Location preference matching
        location_bonus = 0
        location_preferences = answers.get("location_preferences", [])
        if job["remote_status"].lower() in [pref.lower() for pref in location_preferences]:
            location_bonus = 10
        
        # Career interest matching
        interest_bonus = 0
        if "Frontend Developer" in career_interests and "Frontend" in job["title"]:
            interest_bonus = 15
        elif "Backend Developer" in career_interests and "Backend" in job["title"]:
            interest_bonus = 15
        elif "Full Stack" in career_interests and "Full Stack" in job["title"]:
            interest_bonus = 15
        
        # Calculate overall match score
        overall_score = (
            skill_analysis["score"] * 0.6 +  # 60% skills
            experience_match * 100 * 0.25 +  # 25% experience
            location_bonus +  # 10% location
            interest_bonus  # 5% interest
        )
        
        # Generate match reasons
        all_match_reasons = skill_analysis["match_reasons"].copy()
        if experience_match >= 0.7:
            all_match_reasons.append("Experience level aligns well")
        if location_bonus > 0:
            all_match_reasons.append("Matches your location preferences")
        if interest_bonus > 0:
            all_match_reasons.append("Aligns with your career interests")
        
        # Market intelligence
        market_intel = calculate_market_intelligence(job, overall_score)
        
        # Company culture analysis
        culture_analysis = analyze_company_culture(job["description"])
        
        matches.append({
            "id": job["id"],
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "salary": job["salary"],
            "match_score": round(overall_score, 1),
            "skill_gaps": skill_analysis["skill_gaps"],
            "match_reasons": all_match_reasons,
            "posted_date": job["posted_at"],
            "type": job["remote_status"].lower(),
            "difficulty": job["experience_level"].lower().replace(" level", ""),
            "market_intelligence": market_intel,
            "culture_analysis": culture_analysis,
            "required_skills_matched": skill_analysis["required_matches"],
            "total_required_skills": len(job["required_skills"]),
            "preferred_skills_matched": skill_analysis["preferred_matches"],
            "total_preferred_skills": len(job["preferred_skills"])
        })
    
    # Sort by match score
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    
    return {
        "matches": matches,
        "total": len(matches),
        "user_profile": {
            "skills_count": len(user_skills),
            "experience_level": user_experience,
            "career_interests": career_interests
        }
    }

@router.get("/{job_id}")
async def get_job_details(job_id: int, db: Session = Depends(get_db)):
    """Get detailed job information with analysis"""
    
    # Find job
    job = next((j for j in MOCK_JOBS if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Enhanced job analysis
    culture_analysis = analyze_company_culture(job["description"])
    market_intel = calculate_market_intelligence(job, 75)  # Default match score for details view
    
    return {
        "job": job,
        "culture_analysis": culture_analysis,
        "market_intelligence": market_intel,
        "similar_jobs": [j for j in MOCK_JOBS if j["id"] != job_id][:3]
    }

@router.get("/insights/{user_id}")
async def get_job_market_insights(user_id: str, db: Session = Depends(get_db)):
    """Get personalized job market insights"""
    
    # Get user data
    assessment = db.query(Assessment).filter(Assessment.user_id == user_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    answers = assessment.career_interests or {}
    user_skills_data = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
    user_skills = [skill.skill_name for skill in user_skills_data]
    
    # Generate insights based on user profile
    insights = {
        "top_skills_in_demand": ["React", "TypeScript", "Python", "AWS", "Docker"],
        "salary_expectations": {
            "entry_level": "$60k - $80k",
            "mid_level": "$80k - $120k", 
            "senior_level": "$120k - $180k"
        },
        "market_trends": [
            "Remote work opportunities increased 25% this year",
            "Full stack developers saw 15% salary growth",
            "Cloud skills add $15k average salary premium"
        ],
        "skill_gaps_to_close": [
            skill for skill in ["AWS", "Docker", "GraphQL", "TypeScript"] 
            if skill not in user_skills
        ],
        "recommended_certifications": [
            "AWS Cloud Practitioner",
            "React Advanced Certification", 
            "Full Stack Web Development"
        ],
        "growth_opportunities": [
            "Machine Learning integration in web development",
            "Cloud architecture expertise",
            "Mobile development cross-training"
        ]
    }
    
    return insights
