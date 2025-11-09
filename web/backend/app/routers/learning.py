from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.models.assessment import Assessment, UserSkill
from app.models.job import Job

router = APIRouter()

# Mock learning resources database
LEARNING_RESOURCES = {
    "React": [
        {
            "id": 1,
            "title": "React - The Complete Guide (incl. Hooks, React Router, Redux)",
            "provider": "Udemy",
            "type": "course",
            "url": "https://www.udemy.com/course/react-the-complete-guide-incl-redux/",
            "duration_hours": 40,
            "difficulty": "intermediate",
            "cost": 89.99,
            "rating": 4.7,
            "completion_time_weeks": 8,
            "prerequisites": ["JavaScript", "HTML", "CSS"],
            "description": "Dive deep into React with hooks, state management, and modern patterns"
        },
        {
            "id": 2,
            "title": "React Official Documentation",
            "provider": "React",
            "type": "documentation",
            "url": "https://react.dev/",
            "duration_hours": 20,
            "difficulty": "beginner",
            "cost": 0,
            "rating": 4.8,
            "completion_time_weeks": 4,
            "prerequisites": ["JavaScript"],
            "description": "Official React documentation with interactive examples"
        }
    ],
    "TypeScript": [
        {
            "id": 3,
            "title": "Understanding TypeScript - 2023 Edition",
            "provider": "Udemy",
            "type": "course",
            "url": "https://www.udemy.com/course/understanding-typescript/",
            "duration_hours": 35,
            "difficulty": "intermediate",
            "cost": 84.99,
            "rating": 4.6,
            "completion_time_weeks": 7,
            "prerequisites": ["JavaScript"],
            "description": "Master TypeScript with practical examples and advanced patterns"
        },
        {
            "id": 4,
            "title": "TypeScript Handbook",
            "provider": "TypeScript",
            "type": "documentation",
            "url": "https://www.typescriptlang.org/docs/",
            "duration_hours": 15,
            "difficulty": "beginner",
            "cost": 0,
            "rating": 4.7,
            "completion_time_weeks": 3,
            "prerequisites": ["JavaScript"],
            "description": "Official TypeScript documentation with comprehensive examples"
        }
    ],
    "Python": [
        {
            "id": 5,
            "title": "Python for Data Science and Machine Learning Bootcamp",
            "provider": "Udemy",
            "type": "course",
            "url": "https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/",
            "duration_hours": 25,
            "difficulty": "intermediate",
            "cost": 89.99,
            "rating": 4.6,
            "completion_time_weeks": 5,
            "prerequisites": ["Basic programming"],
            "description": "Learn Python for data science, ML, and statistical analysis"
        },
        {
            "id": 6,
            "title": "Automate the Boring Stuff with Python",
            "provider": "No Starch Press",
            "type": "book",
            "url": "https://automatetheboringstuff.com/",
            "duration_hours": 30,
            "difficulty": "beginner",
            "cost": 29.99,
            "rating": 4.5,
            "completion_time_weeks": 6,
            "prerequisites": ["Basic computer skills"],
            "description": "Practical Python programming for everyday tasks"
        }
    ],
    "AWS": [
        {
            "id": 7,
            "title": "AWS Certified Solutions Architect - Associate",
            "provider": "Udemy",
            "type": "certification",
            "url": "https://www.udemy.com/course/aws-certified-solutions-architect-associate/",
            "duration_hours": 30,
            "difficulty": "intermediate",
            "cost": 89.99,
            "rating": 4.7,
            "completion_time_weeks": 6,
            "prerequisites": ["Basic cloud knowledge"],
            "description": "Prepare for AWS Solutions Architect certification"
        },
        {
            "id": 8,
            "title": "AWS Cloud Practitioner Essentials",
            "provider": "AWS Training",
            "type": "certification",
            "url": "https://aws.amazon.com/training/cloud-practitioner/",
            "duration_hours": 20,
            "difficulty": "beginner",
            "cost": 100,
            "rating": 4.8,
            "completion_time_weeks": 4,
            "prerequisites": [],
            "description": "Foundational AWS cloud knowledge and certification prep"
        }
    ],
    "GraphQL": [
        {
            "id": 9,
            "title": "GraphQL with React: The Complete Developers Guide",
            "provider": "Udemy",
            "type": "course",
            "url": "https://www.udemy.com/course/graphql-with-react-course/",
            "duration_hours": 20,
            "difficulty": "intermediate",
            "cost": 84.99,
            "rating": 4.5,
            "completion_time_weeks": 4,
            "prerequisites": ["React", "JavaScript"],
            "description": "Master GraphQL with React, Apollo, and real-world projects"
        }
    ],
    "Docker": [
        {
            "id": 10,
            "title": "Docker & Kubernetes: The Practical Guide",
            "provider": "Udemy",
            "type": "course",
            "url": "https://www.udemy.com/course/docker-kubernetes-the-practical-guide/",
            "duration_hours": 25,
            "difficulty": "intermediate",
            "cost": 89.99,
            "rating": 4.7,
            "completion_time_weeks": 5,
            "prerequisites": ["Basic command line", "Linux basics"],
            "description": "Container orchestration and deployment strategies"
        }
    ]
}

def analyze_learning_style(assessment_data: Dict) -> Dict[str, Any]:
    """Analyze user's learning style from assessment"""
    answers = assessment_data.get("career_interests", {})
    learning_preferences = answers.get("learning_preferences", [])
    time_availability = answers.get("time_availability", 5)
    
    learning_style = {
        "preferences": learning_preferences,
        "hours_per_day": time_availability,
        "preferred_pace": "intensive" if time_availability >= 7 else "moderate" if time_availability >= 3 else "relaxed",
        "format_preference": "hands_on" if "Online Courses" in learning_preferences else "self_paced",
        "budget_conscious": "Free resources" in learning_preferences
    }
    
    return learning_style

def prioritize_skill_gaps(skill_gaps: List[str], user_skills: Dict, career_goals: str) -> List[Dict[str, Any]]:
    """Prioritize skill gaps based on importance and dependencies"""
    # Define skill dependencies and market value
    skill_metadata = {
        "React": {"priority": 9, "dependencies": ["JavaScript"], "market_value": 10},
        "TypeScript": {"priority": 8, "dependencies": ["JavaScript"], "market_value": 9},
        "Python": {"priority": 7, "dependencies": [], "market_value": 8},
        "AWS": {"priority": 8, "dependencies": [], "market_value": 9},
        "GraphQL": {"priority": 6, "dependencies": ["JavaScript"], "market_value": 7},
        "Docker": {"priority": 7, "dependencies": ["Basic command line"], "market_value": 8},
        "Node.js": {"priority": 7, "dependencies": ["JavaScript"], "market_value": 8},
        "MongoDB": {"priority": 5, "dependencies": [], "market_value": 6},
        "PostgreSQL": {"priority": 6, "dependencies": [], "market_value": 7}
    }
    
    prioritized_gaps = []
    
    for skill in skill_gaps:
        metadata = skill_metadata.get(skill, {"priority": 5, "dependencies": [], "market_value": 5})
        
        # Check if prerequisites are met
        prerequisites_met = all(dep in user_skills for dep in metadata["dependencies"])
        
        # Calculate urgency score
        urgency_score = metadata["priority"] + metadata["market_value"]
        if prerequisites_met:
            urgency_score += 2  # Bonus for being ready to learn
        
        prioritized_gaps.append({
            "skill": skill,
            "urgency_score": urgency_score,
            "priority": metadata["priority"],
            "market_value": metadata["market_value"],
            "dependencies": metadata["dependencies"],
            "prerequisites_met": prerequisites_met,
            "estimated_impact": metadata["market_value"]
        })
    
    # Sort by urgency score
    prioritized_gaps.sort(key=lambda x: x["urgency_score"], reverse=True)
    return prioritized_gaps

def select_best_resources(skill: str, learning_style: Dict, budget: float = 1000) -> List[Dict[str, Any]]:
    """Select best learning resources based on learning style and budget"""
    resources = LEARNING_RESOURCES.get(skill, [])
    
    if not resources:
        return []
    
    scored_resources = []
    
    for resource in resources:
        score = 0
        
        # Preference matching
        if learning_style["format_preference"] == "hands_on" and resource["type"] == "course":
            score += 3
        elif learning_style["format_preference"] == "self_paced" and resource["type"] in ["documentation", "book"]:
            score += 3
        
        # Budget consideration
        if learning_style["budget_conscious"] and resource["cost"] == 0:
            score += 2
        elif resource["cost"] <= budget / len(resources):
            score += 1
        
        # Pace matching
        if learning_style["preferred_pace"] == "intensive" and resource["completion_time_weeks"] <= 4:
            score += 2
        elif learning_style["preferred_pace"] == "relaxed" and resource["completion_time_weeks"] >= 6:
            score += 2
        
        # Quality indicators
        score += resource["rating"]  # Rating bonus
        difficulty_bonus = 5 if resource["difficulty"] == "advanced" else 3 if resource["difficulty"] == "intermediate" else 0
        score += (10 - difficulty_bonus)  # Difficulty bonus
        
        scored_resources.append({
            **resource,
            "score": score
        })
    
    # Sort by score and return top 3
    scored_resources.sort(key=lambda x: x["score"], reverse=True)
    return scored_resources[:3]

def calculate_learning_timeline(skills: List[Dict], hours_per_day: int) -> Dict[str, Any]:
    """Calculate optimal learning timeline"""
    total_hours = 0
    skill_timelines = []
    
    for skill_data in skills:
        skill = skill_data["skill"]
        resources = skill_data.get("resources", [])
        
        if resources:
            # Use the primary resource's duration
            primary_resource = resources[0]
            skill_hours = primary_resource["duration_hours"]
            total_hours += skill_hours
            
            # Calculate weeks based on daily availability
            weeks_needed = skill_hours / (hours_per_day * 7) if hours_per_day > 0 else 12
            
            skill_timelines.append({
                "skill": skill,
                "estimated_hours": skill_hours,
                "estimated_weeks": max(2, round(weeks_needed)),
                "difficulty": primary_resource.get("difficulty", "intermediate")
            })
    
    # Parallel vs sequential learning
    max_concurrent_skills = min(3, max(1, hours_per_day // 3))  # Can learn multiple skills if enough time
    
    if max_concurrent_skills > 1:
        # Parallel learning
        total_weeks = sum(timeline["estimated_weeks"] for timeline in skill_timelines[:max_concurrent_skills])
    else:
        # Sequential learning
        total_weeks = sum(timeline["estimated_weeks"] for timeline in skill_timelines)
    
    return {
        "total_hours": total_hours,
        "total_weeks": total_weeks,
        "skill_timelines": skill_timelines,
        "max_concurrent_skills": max_concurrent_skills,
        "learning_strategy": "parallel" if max_concurrent_skills > 1 else "sequential",
        "completion_date": f"{total_weeks} weeks from today"
    }

def generate_milestones(skill_timelines: List[Dict]) -> List[Dict[str, Any]]:
    """Generate learning milestones and checkpoints"""
    milestones = []
    week_counter = 1
    
    for timeline in skill_timelines:
        skill = timeline["skill"]
        weeks_needed = timeline["estimated_weeks"]
        
        # Start milestone
        milestones.append({
            "week": week_counter,
            "type": "start",
            "skill": skill,
            "title": f"Start Learning {skill}",
            "description": f"Begin your {skill} journey with recommended resources",
            "priority": "high"
        })
        
        # Progress checkpoints
        if weeks_needed > 4:
            checkpoint_week = week_counter + weeks_needed // 2
            milestones.append({
                "week": checkpoint_week,
                "type": "checkpoint",
                "skill": skill,
                "title": f"{skill} Progress Check",
                "description": f"Review your {skill} progress and adjust learning strategy",
                "priority": "medium"
            })
        
        # Completion milestone
        completion_week = week_counter + weeks_needed - 1
        milestones.append({
            "week": completion_week,
            "type": "completion",
            "skill": skill,
            "title": f"Complete {skill} Foundation",
            "description": f"Congratulations! You've completed the {skill} learning path",
            "priority": "high"
        })
        
        week_counter += weeks_needed
    
    # Sort by week
    milestones.sort(key=lambda x: x["week"])
    return milestones

@router.get("/resources")
async def get_learning_resources(
    skill: Optional[str] = None,
    resource_type: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get learning resources with optional filters"""
    all_resources = []
    
    for skill_name, resources in LEARNING_RESOURCES.items():
        for resource in resources:
            if skill and skill.lower() not in skill_name.lower():
                continue
            if resource_type and resource["type"] != resource_type:
                continue
            if difficulty and resource["difficulty"] != difficulty:
                continue
            
            resource_dict = {
                "skill": skill_name,
                **resource
            }
            all_resources.append(resource_dict)
    
    return {"resources": all_resources, "total": len(all_resources)}

@router.get("/paths/{user_id}")
async def get_learning_paths(user_id: str, db: Session = Depends(get_db)):
    """Get learning paths for a user"""
    # TODO: Implement actual database retrieval
    return {
        "paths": [
            {
                "id": 1,
                "title": "Full Stack Developer Path",
                "target_job": "Full Stack Developer",
                "status": "in_progress",
                "progress_percentage": 35,
                "estimated_completion_weeks": 8,
                "skills": ["React", "Node.js", "MongoDB"],
                "created_at": "2024-01-15"
            }
        ]
    }

@router.post("/paths/{user_id}/generate")
async def generate_learning_path(
    user_id: str,
    target_job_id: Optional[int] = None,
    skill_gaps: Optional[List[str]] = None,
    db: Session = Depends(get_db)
):
    """Generate a personalized learning path"""
    
    # Get user assessment
    assessment = db.query(Assessment).filter(Assessment.user_id == user_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Get user skills
    user_skills_data = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
    user_skills = {skill.skill_name: skill.proficiency_level for skill in user_skills_data}
    
    # Analyze learning style
    learning_style = analyze_learning_style(assessment.career_interests or {})
    
    # Use provided skill gaps or determine from job
    if not skill_gaps:
        # Mock skill gaps for demo
        skill_gaps = ["TypeScript", "GraphQL", "AWS"]
    
    # Prioritize skill gaps
    prioritized_gaps = prioritize_skill_gaps(skill_gaps, user_skills, "")
    
    # Select resources for each skill gap
    skills_with_resources = []
    for gap in prioritized_gaps:
        skill = gap["skill"]
        best_resources = select_best_resources(skill, learning_style)
        
        if best_resources:
            skills_with_resources.append({
                "skill": skill,
                "priority": gap["priority"],
                "urgency_score": gap["urgency_score"],
                "resources": best_resources,
                "estimated_impact": gap["estimated_impact"],
                "dependencies_met": gap["prerequisites_met"]
            })
    
    # Calculate learning timeline
    timeline = calculate_learning_timeline(skills_with_resources, learning_style["hours_per_day"])
    
    # Generate milestones
    milestones = generate_milestones(timeline["skill_timelines"])
    
    # Create learning path
    learning_path = {
        "id": 1,  # Mock ID
        "title": f"Learning Path for {target_job_id or 'Skill Development'}",
        "skill_gaps": skill_gaps,
        "skills_with_resources": skills_with_resources,
        "timeline": timeline,
        "milestones": milestones,
        "learning_style": learning_style,
        "estimated_completion_weeks": timeline["total_weeks"],
        "total_hours": timeline["total_hours"],
        "learning_strategy": timeline["learning_strategy"],
        "status": "not_started",
        "progress_percentage": 0,
        "created_at": "2024-01-15T10:00:00Z"
    }
    
    return {
        "path": learning_path,
        "success": True,
        "message": f"Generated learning path with {len(skills_with_resources)} skills"
    }

@router.get("/paths/{path_id}/progress")
async def get_learning_progress(path_id: int, db: Session = Depends(get_db)):
    """Get progress for a learning path"""
    # TODO: Implement actual progress tracking
    return {
        "path_id": path_id,
        "progress_percentage": 35,
        "skills_completed": 1,
        "total_skills": 3,
        "current_skill": "TypeScript",
        "next_milestone": "Complete TypeScript Foundation",
        "estimated_completion": "5 weeks remaining"
    }

@router.post("/paths/{path_id}/progress")
async def update_learning_progress(
    path_id: int,
    resource_id: int,
    progress: int,
    db: Session = Depends(get_db)
):
    """Update progress for a learning resource"""
    # TODO: Implement actual progress updates
    return {
        "success": True,
        "message": "Progress updated successfully",
        "new_progress": progress
    }

@router.get("/insights/{user_id}")
async def get_learning_insights(user_id: str, db: Session = Depends(get_db)):
    """Get personalized learning insights and recommendations"""
    
    # Get user assessment
    assessment = db.query(Assessment).filter(Assessment.user_id == user_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Get user skills
    user_skills_data = db.query(UserSkill).filter(UserSkill.user_id == user_id).all()
    user_skills = [skill.skill_name for skill in user_skills_data]
    
    # Generate insights
    insights = {
        "learning_style_analysis": analyze_learning_style(assessment.career_interests or {}),
        "skill_growth_opportunities": [
            {
                "skill": "TypeScript",
                "reason": "Adds 15% salary premium and high demand",
                "time_to_master": "6-8 weeks",
                "impact": "High"
            },
            {
                "skill": "AWS",
                "reason": "Cloud skills are in high demand across all industries",
                "time_to_master": "8-10 weeks", 
                "impact": "Very High"
            },
            {
                "skill": "GraphQL",
                "reason": "Modern API technology gaining rapid adoption",
                "time_to_master": "4-6 weeks",
                "impact": "Medium"
            }
        ],
        "market_trends": {
            "in_demand_skills": ["TypeScript", "AWS", "Docker", "GraphQL"],
            "emerging_technologies": ["WebAssembly", "Edge Computing", "AI/ML"],
            "certification_value": {
                "AWS Certified": 85,
                "React Certification": 70,
                "TypeScript Expert": 75
            }
        },
        "learning_recommendations": {
            "focus_areas": [
                "Type your current JavaScript skills into TypeScript",
                "Get AWS certified to validate cloud knowledge",
                "Learn GraphQL for modern API development"
            ],
            "learning_strategies": [
                "Mix hands-on projects with structured courses",
                "Join coding communities for peer learning",
                "Build portfolio projects while learning"
            ],
            "time_management": [
                "Dedicate consistent daily time blocks",
                "Focus on one skill at a time initially",
                "Use weekends for project practice"
            ]
        }
    }
    
    return insights
