from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.models.assessment import Assessment, UserSkill
from pydantic import BaseModel
import json
import re

router = APIRouter()

# Pydantic models for request/response
class AssessmentStartRequest(BaseModel):
    user_id: str

class AssessmentAnswerRequest(BaseModel):
    user_id: str
    question_id: str
    answer: dict

class AssessmentResponse(BaseModel):
    id: int
    user_id: str
    current_question: int
    total_questions: int
    is_completed: bool

class AssessmentCompleteRequest(BaseModel):
    user_id: str
    all_answers: dict

# Question definitions
ASSESSMENT_QUESTIONS = [
    {
        "id": "career_interests",
        "type": "multi_select",
        "question": "Which career paths interest you the most?",
        "options": [
            "Frontend Developer",
            "Backend Developer", 
            "Full Stack Developer",
            "DevOps Engineer",
            "Data Scientist",
            "Machine Learning Engineer",
            "Product Manager",
            "UI/UX Designer",
            "Mobile Developer",
            "Cybersecurity Specialist"
        ],
        "required": True
    },
    {
        "id": "experience_level",
        "type": "single_choice",
        "question": "What is your experience level?",
        "options": [
            "Entry Level (0-2 years)",
            "Mid Level (2-5 years)",
            "Senior Level (5+ years)",
            "Lead/Principal Level"
        ],
        "required": True
    },
    {
        "id": "technical_skills",
        "type": "skill_selector",
        "question": "What are your technical skills? (Select all that apply and rate your proficiency)",
        "skills": [
            "JavaScript", "TypeScript", "Python", "Java", "C#", "Go", "Rust",
            "React", "Vue.js", "Angular", "Node.js", "Django", "Flask",
            "HTML", "CSS", "TailwindCSS", "SASS", "Bootstrap",
            "SQL", "MongoDB", "PostgreSQL", "Redis",
            "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes",
            "Git", "Linux", "Agile/Scrum"
        ],
        "proficiency_levels": ["Beginner", "Intermediate", "Advanced", "Expert"],
        "required": True
    },
    {
        "id": "soft_skills",
        "type": "multi_select",
        "question": "What are your soft skills?",
        "options": [
            "Communication", "Leadership", "Problem Solving", "Teamwork",
            "Time Management", "Critical Thinking", "Creativity", "Adaptability",
            "Project Management", "Mentoring", "Public Speaking", "Negotiation"
        ],
        "required": False
    },
    {
        "id": "time_availability",
        "type": "slider",
        "question": "How many hours per day can you dedicate to learning?",
        "min": 1,
        "max": 10,
        "default": 5,
        "required": True
    },
    {
        "id": "learning_preferences",
        "type": "multi_select",
        "question": "How do you prefer to learn?",
        "options": [
            "Online Courses", "Local Classes", "Bootcamps", "Self-study",
            "Certifications", "Workshops", "Mentorship", "Video Tutorials"
        ],
        "required": True
    },
    {
        "id": "career_goals",
        "type": "text_input",
        "question": "Describe your career goals (optional)",
        "placeholder": "What do you want to achieve in your career?",
        "required": False
    },
    {
        "id": "location_preferences",
        "type": "multi_select",
        "question": "What are your location preferences?",
        "options": [
            "Remote", "On-site", "Hybrid"
        ],
        "required": True
    }
]

@router.post("/start")
async def start_assessment(request: AssessmentStartRequest, db: Session = Depends(get_db)):
    """Start a new assessment or resume existing one"""
    
    # Check if assessment already exists
    existing_assessment = db.query(Assessment).filter(
        Assessment.user_id == request.user_id
    ).first()
    
    if existing_assessment:
        return {
            "message": "Assessment resumed",
            "current_question": get_current_question(existing_assessment),
            "assessment_id": existing_assessment.id
        }
    
    # Create new assessment
    assessment = Assessment(user_id=request.user_id)
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    
    return {
        "message": "Assessment started",
        "current_question": 0,
        "assessment_id": assessment.id,
        "total_questions": len(ASSESSMENT_QUESTIONS)
    }

@router.get("/questions")
async def get_assessment_questions():
    """Get all assessment questions"""
    return {
        "questions": ASSESSMENT_QUESTIONS,
        "total_questions": len(ASSESSMENT_QUESTIONS)
    }

@router.get("/questions/{question_id}")
async def get_question(question_id: str):
    """Get a specific question by ID"""
    for i, question in enumerate(ASSESSMENT_QUESTIONS):
        if question["id"] == question_id:
            return {
                "question": question,
                "question_number": i + 1,
                "total_questions": len(ASSESSMENT_QUESTIONS)
            }
    
    raise HTTPException(status_code=404, detail="Question not found")

@router.post("/answer")
async def save_answer(request: AssessmentAnswerRequest, db: Session = Depends(get_db)):
    """Save an answer to a specific question"""
    
    assessment = db.query(Assessment).filter(
        Assessment.user_id == request.user_id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Update assessment with answer (stored as JSON)
    if not assessment.career_interests:
        assessment.career_interests = {}
    
    assessment.career_interests[request.question_id] = request.answer
    db.commit()
    
    # Find next question
    current_index = get_current_question_index(assessment)
    next_index = current_index + 1
    
    if next_index >= len(ASSESSMENT_QUESTIONS):
        return {"next_question": None, "assessment_complete": True}
    
    return {
        "next_question": ASSESSMENT_QUESTIONS[next_index],
        "question_number": next_index + 1,
        "total_questions": len(ASSESSMENT_QUESTIONS)
    }

@router.post("/complete")
async def complete_assessment(request: AssessmentCompleteRequest, db: Session = Depends(get_db)):
    """Complete the assessment and save all answers"""
    
    assessment = db.query(Assessment).filter(
        Assessment.user_id == request.user_id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Save all answers
    assessment.career_interests = request.all_answers
    
    # Process and save skills separately
    if "technical_skills" in request.all_answers:
        await save_user_skills(request.user_id, request.all_answers["technical_skills"], db)
    
    # Mark as completed
    from datetime import datetime, timezone
    assessment.assessment_completed_at = datetime.now(timezone.utc)
    assessment.experience_level = request.all_answers.get("experience_level")
    assessment.career_goals = request.all_answers.get("career_goals")
    assessment.location_preferences = request.all_answers.get("location_preferences", [])
    assessment.learning_preferences = {"preferences": request.all_answers.get("learning_preferences", [])}
    
    db.commit()
    
    return {
        "message": "Assessment completed successfully",
        "assessment_id": assessment.id,
        "next_steps": ["job_matching", "resume_generation", "learning_path"]
    }

@router.get("/{user_id}")
async def get_assessment(user_id: str, db: Session = Depends(get_db)):
    """Get assessment status and progress"""
    
    assessment = db.query(Assessment).filter(
        Assessment.user_id == user_id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    current_question = get_current_question_index(assessment)
    total_questions = len(ASSESSMENT_QUESTIONS)
    
    return {
        "assessment_id": assessment.id,
        "user_id": assessment.user_id,
        "current_question": current_question,
        "total_questions": total_questions,
        "progress_percentage": (current_question / total_questions) * 100,
        "is_completed": assessment.assessment_completed_at is not None,
        "completed_at": assessment.assessment_completed_at
    }

# Intelligent Assessment Engine

def get_intelligent_followup_question(current_question_id: str, answer: Any, assessment_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Generate dynamic follow-up questions based on user answers"""
    
    if current_question_id == "career_interests" and isinstance(answer, list):
        # Follow up based on career interests
        if "Frontend Developer" in answer:
            return {
                "id": "frontend_deep_dive",
                "type": "multi_select",
                "question": "Nice! Frontend is hot right now. Which frameworks are you into?",
                "options": ["React", "Vue.js", "Angular", "Svelte", "Next.js", "Gatsby"],
                "required": True,
                "followup_to": "career_interests"
            }
        elif "Backend Developer" in answer:
            return {
                "id": "backend_deep_dive", 
                "type": "multi_select",
                "question": "Backend wizard! What's your stack?",
                "options": ["Node.js", "Python/Django", "Java/Spring", "C#/.NET", "Go", "Ruby/Rails"],
                "required": True,
                "followup_to": "career_interests"
            }
        elif "Data Scientist" in answer:
            return {
                "id": "data_science_deep_dive",
                "type": "multi_select", 
                "question": "Data science! ML or more traditional analytics?",
                "options": ["Machine Learning", "Deep Learning", "Statistical Analysis", "Data Visualization", "Big Data"],
                "required": True,
                "followup_to": "career_interests"
            }
    
    elif current_question_id == "technical_skills" and isinstance(answer, dict):
        # Validate skill combinations and ask follow-ups
        skills_with_proficiency = {k: v for k, v in answer.items() if v and v != "None"}
        
        if "React" in skills_with_proficiency and skills_with_proficiency["React"] in ["Advanced", "Expert"]:
            if "Redux" not in skills_with_proficiency:
                return {
                    "id": "react_state_management",
                    "type": "single_choice",
                    "question": "You're solid with React! What about state management?",
                    "options": [
                        "Redux (classic choice)",
                        "Context API", 
                        "Zustand/Jotai (modern stuff)",
                        "State management is overrated"
                    ],
                    "required": True,
                    "followup_to": "technical_skills"
                }
        
        if "Python" in skills_with_proficiency and "Django" not in skills_with_proficiency and "Flask" not in skills_with_proficiency:
            return {
                "id": "python_web_frameworks",
                "type": "single_choice", 
                "question": "Python skills noted! Any web framework experience?",
                "options": [
                    "Django (batteries included)",
                    "Flask (minimalist)",
                    "FastAPI (modern async)",
                    "Just pure Python scripts"
                ],
                "required": True,
                "followup_to": "technical_skills"
            }
    
    elif current_question_id == "experience_level" and answer in ["Senior Level (5+ years)", "Lead/Principal Level"]:
        return {
            "id": "leadership_experience",
            "type": "multi_select",
            "question": "Experience like that deserves some leadership questions. What's your vibe?",
            "options": [
                "I've led teams directly",
                "I mentor junior devs",
                "I architect systems", 
                "I make the big decisions",
                "I just want to code in peace"
            ],
            "required": True,
            "followup_to": "experience_level"
        }
    
    return None

def validate_skill_combination(skills: Dict[str, str]) -> List[str]:
    """Validate skill combinations and provide insights"""
    insights = []
    skills_with_proficiency = {k: v for k, v in skills.items() if v and v != "None"}
    
    # Frontend stack analysis
    frontend_skills = ["React", "Vue.js", "Angular", "JavaScript", "TypeScript", "HTML", "CSS"]
    has_frontend = any(skill in skills_with_proficiency for skill in frontend_skills)
    
    if has_frontend:
        frontend_count = len([s for s in frontend_skills if s in skills_with_proficiency])
        if frontend_count >= 4:
            insights.append("Solid frontend foundation! You're basically a UI wizard.")
        elif "JavaScript" in skills_with_proficiency and "TypeScript" not in skills_with_proficiency:
            insights.append("JavaScript skills are solid! Have you considered TypeScript? Most companies expect it now.")
    
    # Backend stack analysis  
    backend_skills = ["Node.js", "Python", "Java", "C#", "Go", "Django", "Flask"]
    has_backend = any(skill in skills_with_proficiency for skill in backend_skills)
    
    if has_backend and has_frontend:
        insights.append("Full stack potential! Companies love developers who can do both.")
    
    # Cloud/DevOps analysis
    cloud_skills = ["AWS", "Azure", "Google Cloud", "Docker", "Kubernetes"]
    cloud_count = len([s for s in cloud_skills if s in skills_with_proficiency])
    
    if cloud_count >= 2:
        insights.append("Cloud skills are in high demand! You're positioning yourself well.")
    elif cloud_count == 0:
        insights.append("Consider learning some cloud basics. Even basic AWS knowledge opens doors.")
    
    # Database analysis
    db_skills = ["SQL", "MongoDB", "PostgreSQL", "Redis"]
    if not any(skill in skills_with_proficiency for skill in db_skills):
        insights.append("Database skills are essential. Even basic SQL knowledge helps a lot.")
    
    return insights

def analyze_career_trajectory(assessment_data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze user's career trajectory and provide insights"""
    analysis = {
        "trajectory_score": 0,
        "insights": [],
        "recommendations": [],
        "missing_skills": [],
        "growth_potential": "medium"
    }
    
    career_interests = assessment_data.get("career_interests", [])
    experience_level = assessment_data.get("experience_level", "")
    technical_skills = assessment_data.get("technical_skills", {})
    career_goals = assessment_data.get("career_goals", "").lower()
    
    # Calculate trajectory score based on alignment
    score = 0
    
    # Interest-Skill Alignment (30 points)
    if isinstance(career_interests, list) and isinstance(technical_skills, dict):
        skills_with_proficiency = {k: v for k, v in technical_skills.items() if v and v != "None"}
        
        if "Frontend Developer" in career_interests:
            frontend_skills = ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Vue.js", "Angular"]
            frontend_match = len([s for s in frontend_skills if s in skills_with_proficiency])
            score += min(30, frontend_match * 6)
        
        elif "Backend Developer" in career_interests:
            backend_skills = ["Node.js", "Python", "Django", "Flask", "Java", "C#", "Go"]
            backend_match = len([s for s in backend_skills if s in skills_with_proficiency])
            score += min(30, backend_match * 6)
        
        elif "Data Scientist" in career_interests:
            data_skills = ["Python", "SQL", "Machine Learning", "Deep Learning"]
            data_match = len([s for s in data_skills if s in skills_with_proficiency])
            score += min(30, data_match * 7.5)
    
    # Experience Level Alignment (20 points)
    experience_years = 0
    if "Entry Level" in experience_level:
        experience_years = 1
    elif "Mid Level" in experience_level:
        experience_years = 3.5
    elif "Senior Level" in experience_level:
        experience_years = 7
    elif "Lead" in experience_level:
        experience_years = 10
    
    # Count advanced/expert skills
    if isinstance(technical_skills, dict):
        advanced_skills = len([s for s, v in technical_skills.items() if v in ["Advanced", "Expert"] and v != "None"])
        score += min(20, advanced_skills * 5)
        
        # Bonus points for skill diversity
        skill_categories = set()
        for skill in skills_with_proficiency.keys():
            if skill in ["React", "Vue.js", "Angular"]:
                skill_categories.add("frontend")
            elif skill in ["Node.js", "Python", "Django", "Flask", "Java", "C#", "Go"]:
                skill_categories.add("backend")
            elif skill in ["AWS", "Azure", "Google Cloud", "Docker", "Kubernetes"]:
                skill_categories.add("cloud")
            elif skill in ["SQL", "MongoDB", "PostgreSQL", "Redis"]:
                skill_categories.add("database")
        
        score += min(20, len(skill_categories) * 5)
    
    # Career Goals Alignment (10 points)
    if career_goals:
        if "senior" in career_goals or "lead" in career_goals or "principal" in career_goals:
            if experience_years >= 3:
                score += 10
            else:
                analysis["recommendations"].append("Your goals show ambition! Focus on building more experience to reach senior roles faster.")
        
        if "remote" in career_goals or "flexible" in career_goals:
            analysis["recommendations"].append("Remote work opportunities are abundant - especially with your skill set!")
        
        if "startup" in career_goals:
            analysis["recommendations"].append("Startup experience can accelerate your career. Consider early-stage companies for rapid growth.")
    
    analysis["trajectory_score"] = min(100, score)
    
    # Determine growth potential
    if analysis["trajectory_score"] >= 80:
        analysis["growth_potential"] = "high"
        analysis["insights"].append("Excellent trajectory! You're positioning yourself for senior roles and high growth.")
    elif analysis["trajectory_score"] >= 60:
        analysis["growth_potential"] = "medium-high"
        analysis["insights"].append("Good foundation! With focused skill development, you could reach senior levels quickly.")
    elif analysis["trajectory_score"] >= 40:
        analysis["growth_potential"] = "medium"
        analysis["insights"].append("Solid start! Focus on building depth in your core skills and expanding your toolkit.")
    else:
        analysis["growth_potential"] = "developing"
        analysis["insights"].append("Every expert was once a beginner! Focus on fundamentals and consistent learning.")
    
    # Identify missing skills based on career interests
    if isinstance(career_interests, list) and isinstance(technical_skills, dict):
        skills_with_proficiency = {k: v for k, v in technical_skills.items() if v and v != "None"}
        
        if "Frontend Developer" in career_interests:
            missing_frontend = ["TypeScript", "React", "Next.js", "TailwindCSS"]
            analysis["missing_skills"].extend([s for s in missing_frontend if s not in skills_with_proficiency])
        
        if "Backend Developer" in career_interests:
            missing_backend = ["Docker", "AWS", "PostgreSQL", "Redis"]
            analysis["missing_skills"].extend([s for s in missing_backend if s not in skills_with_proficiency])
        
        if "Data Scientist" in career_interests:
            missing_data = ["Machine Learning", "Deep Learning", "SQL", "AWS"]
            analysis["missing_skills"].extend([s for s in missing_data if s not in skills_with_proficiency])
    
    return analysis

@router.post("/intelligent-answer")
async def save_intelligent_answer(request: AssessmentAnswerRequest, db: Session = Depends(get_db)):
    """Save answer and generate intelligent follow-ups"""
    
    assessment = db.query(Assessment).filter(
        Assessment.user_id == request.user_id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Get current assessment context
    if not assessment.career_interests:
        assessment.career_interests = {}
    
    assessment.career_interests[request.question_id] = request.answer
    db.commit()
    
    # Generate intelligent follow-up
    followup_question = get_intelligent_followup_question(
        request.question_id, 
        request.answer, 
        assessment.career_interests
    )
    
    # Generate skill insights for technical skills
    skill_insights = []
    if request.question_id == "technical_skills" and isinstance(request.answer, dict):
        skill_insights = validate_skill_combination(request.answer)
    
    # Generate career trajectory insights
    trajectory_analysis = None
    all_answers = assessment.career_interests
    if len(all_answers) >= 3:  # Have enough data for analysis
        trajectory_analysis = analyze_career_trajectory(all_answers)
    
    response = {
        "answer_saved": True,
        "followup_question": followup_question,
        "skill_insights": skill_insights,
        "trajectory_analysis": trajectory_analysis
    }
    
    # If no follow-up, get next standard question
    if not followup_question:
        current_index = get_current_question_index(assessment)
        next_index = current_index + 1
        
        if next_index < len(ASSESSMENT_QUESTIONS):
            response["next_standard_question"] = ASSESSMENT_QUESTIONS[next_index]
            response["question_number"] = next_index + 1
            response["total_questions"] = len(ASSESSMENT_QUESTIONS)
        else:
            response["assessment_complete"] = True
    
    return response

# Helper functions
def get_current_question(assessment: Assessment) -> int:
    """Get the current question number for an assessment"""
    if not assessment.career_interests:
        return 0
    return len(assessment.career_interests)

def get_current_question_index(assessment: Assessment) -> int:
    """Get the current question index"""
    if not assessment.career_interests:
        return 0
    return len(assessment.career_interests)

async def save_user_skills(user_id: str, skills_data: dict, db: Session):
    """Save user skills from assessment"""
    # Delete existing skills for this user
    db.query(UserSkill).filter(UserSkill.user_id == user_id).delete()
    
    # Save new skills
    for skill_name, proficiency in skills_data.items():
        if proficiency and proficiency != "None":  # Only save if skill is selected
            user_skill = UserSkill(
                user_id=user_id,
                skill_name=skill_name,
                proficiency_level=proficiency,
                skill_category="technical"
            )
            db.add(user_skill)
    
    db.commit()
