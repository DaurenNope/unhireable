from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False, index=True)
    company = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    requirements = Column(Text)
    location = Column(String(255))
    salary = Column(String(100))
    job_type = Column(String(100))  # Full-time, Part-time, Contract, etc.
    remote_status = Column(String(50))  # Remote, On-site, Hybrid
    experience_level = Column(String(100))  # Entry Level, Mid Level, Senior Level
    source = Column(String(100))  # LinkedIn, Indeed, etc.
    source_url = Column(String(1000))
    required_skills = Column(JSON)  # Array of required skills
    preferred_skills = Column(JSON)  # Array of preferred skills
    benefits = Column(JSON)  # Array of benefits
    is_active = Column(Boolean, default=True)
    posted_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class JobCategory(Base):
    __tablename__ = "job_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    parent_id = Column(Integer, nullable=True)  # For nested categories
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JobCategoryMapping(Base):
    __tablename__ = "job_category_mappings"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, nullable=False, index=True)
    category_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
