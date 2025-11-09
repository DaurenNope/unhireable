from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), unique=True, nullable=False, index=True)
    career_interests = Column(JSON)  # Text array stored as JSON
    experience_level = Column(String(50))
    learning_preferences = Column(JSON)
    career_goals = Column(Text)
    location_preferences = Column(JSON)  # Text array stored as JSON
    assessment_completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserSkill(Base):
    __tablename__ = "user_skills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    skill_name = Column(String(255), nullable=False)
    skill_category = Column(String(100))
    proficiency_level = Column(String(50))
    years_of_experience = Column(Integer)
    self_assessed = Column(Boolean, default=True)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JobMatch(Base):
    __tablename__ = "job_matches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    job_id = Column(Integer, nullable=False)
    match_score = Column(Integer)  # DECIMAL(5,2) stored as Integer (score 0-100)
    skill_gaps = Column(JSON)
    match_reasons = Column(JSON)  # Text array stored as JSON
    recommended = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LearningResource(Base):
    __tablename__ = "learning_resources"

    id = Column(Integer, primary_key=True, index=True)
    skill_name = Column(String(255), nullable=False, index=True)
    resource_type = Column(String(100))
    title = Column(String(500), nullable=False)
    provider = Column(String(255))
    url = Column(Text)
    location = Column(String(255))
    cost = Column(Integer)  # Decimal stored as integer (cents)
    duration_hours = Column(Integer)
    difficulty_level = Column(String(50))
    rating = Column(Integer)  # Decimal stored as integer (0-50 for 0-5.0 rating)
    completion_time_weeks = Column(Integer)
    prerequisites = Column(JSON)  # Text array stored as JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    target_job_id = Column(Integer)
    skill_gaps = Column(JSON)  # Text array stored as JSON
    resources = Column(JSON)
    estimated_completion_weeks = Column(Integer)
    hours_per_day = Column(Integer, default=5)
    status = Column(String(50), default='not_started')
    progress_percentage = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    id = Column(Integer, primary_key=True, index=True)
    learning_path_id = Column(Integer, nullable=False, index=True)
    resource_id = Column(Integer, nullable=False, index=True)
    status = Column(String(50), default='not_started')
    completion_percentage = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
