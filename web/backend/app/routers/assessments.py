from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.assessment import Assessment, UserSkill
from pydantic import BaseModel

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
