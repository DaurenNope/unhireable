#!/usr/bin/env python3
"""
Unified Crawl4AI Scraper Service
FastAPI service for job scraping with configurable sources
"""
import asyncio
import json
import re
import sqlite3
import tomllib
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

# Configuration
CONFIG_PATH = Path(__file__).parent / "config" / "sources.toml"
DB_PATH = Path.home() / "Library/Application Support/com.unhireable.app/jobhunter.db"
PROFILE_PATH = Path(__file__).parent.parent / "src-tauri/personas/atlas_profile.json"

@dataclass
class Job:
    id: str
    title: str
    company: str
    url: str
    source: str
    location: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    match_score: float = 0.0
    matched_skills: List[str] = None
    scraped_at: str = None
    
    def __post_init__(self):
        if self.matched_skills is None:
            self.matched_skills = []
        if self.scraped_at is None:
            self.scraped_at = datetime.utcnow().isoformat()

class ScrapeRequest(BaseModel):
    sources: Optional[List[str]] = None  # None = all enabled
    query: Optional[str] = None
    limit: int = 50

class ScrapeResponse(BaseModel):
    success: bool
    jobs_scraped: int
    jobs_matched: int
    sources_scraped: List[str]
    errors: List[str]

class MatchRequest(BaseModel):
    job_ids: Optional[List[str]] = None  # None = all unmatched

# Load configuration
def load_config() -> Dict[str, Any]:
    with open(CONFIG_PATH, "rb") as f:
        return tomllib.load(f)

# Load user profile for matching
def load_profile() -> Dict[str, Any]:
    if PROFILE_PATH.exists():
        with open(PROFILE_PATH) as f:
            return json.load(f)
    return {"skills": {"technical_skills": [], "soft_skills": []}}

# Skill matching - Weighted scoring algorithm
class SkillMatcher:
    # Skill aliases for broader matching
    ALIASES = {
        "python": ["python", "python3", "py", "django", "flask", "fastapi"],
        "javascript": ["javascript", "js", "node.js", "nodejs", "node"],
        "typescript": ["typescript", "ts"],
        "react": ["react", "reactjs", "react.js", "next.js", "nextjs"],
        "blockchain": ["blockchain", "web3", "crypto", "defi", "ethereum", "solana", "nft", "dapp"],
        "ai": ["ai", "artificial intelligence", "machine learning", "ml", "llm", "gpt", "openai", "nlp", "deep learning"],
        "automation": ["automation", "automated", "n8n", "zapier", "workflow", "scripting"],
        "solidity": ["solidity", "smart contracts", "ethereum", "evm"],
        "product": ["product management", "product manager", "pm", "product owner"],
        "backend": ["backend", "back-end", "server-side", "api", "fastapi", "django", "flask"],
        "fullstack": ["fullstack", "full-stack", "full stack"],
    }
    
    # Key skills get 3x weight
    KEY_SKILLS = {"python", "ai", "automation", "blockchain", "web3", "llm", "fastapi", "solidity", "n8n"}
    
    # High-value job title keywords
    TITLE_KEYWORDS = {
        "ai": 20, "ml": 20, "machine learning": 20, "llm": 20,
        "blockchain": 20, "web3": 20, "crypto": 20, "solidity": 20,
        "automation": 15, "python": 15, "backend": 10,
        "product manager": 15, "product": 10,
        "fullstack": 10, "full-stack": 10, "full stack": 10,
    }
    
    def __init__(self, profile: Dict[str, Any]):
        self.skills = set()
        for skill in profile.get("skills", {}).get("technical_skills", []):
            self.skills.add(skill.lower())
        for skill in profile.get("skills", {}).get("soft_skills", []):
            self.skills.add(skill.lower())
    
    def match(self, text: str, title: str = "") -> tuple[float, List[str]]:
        text_lower = text.lower()
        title_lower = title.lower()
        matched = set()
        
        # 1. Direct skill matching
        for skill in self.skills:
            skill_lower = skill.lower()
            if skill_lower in text_lower:
                matched.add(skill_lower)
        
        # 2. Alias matching (broader)
        for key, aliases in self.ALIASES.items():
            for alias in aliases:
                if alias in text_lower:
                    matched.add(key)
                    break
        
        # 3. Calculate weighted score
        base_score = 0
        for skill in matched:
            if skill in self.KEY_SKILLS or any(k in skill for k in self.KEY_SKILLS):
                base_score += 15  # Key skills = 15 points
            else:
                base_score += 5   # Regular skills = 5 points
        
        # 4. Title keyword bonus (job title match = high relevance)
        title_bonus = 0
        for keyword, bonus in self.TITLE_KEYWORDS.items():
            if keyword in title_lower:
                title_bonus += bonus
        
        # 5. Calculate final score
        # Base: up to 60 points from skills (4 key skills)
        # Title: up to 40 points from title match
        # This makes a job with 3 key skills + good title = ~70-80%
        score = min(base_score, 60) + min(title_bonus, 40)
        
        # Normalize to 0-100
        score = min(score, 100)
        
        return score, list(matched)

# Parsers
class JobParser:
    @staticmethod
    def parse_json_api(content: str, config: Dict) -> List[Dict]:
        jobs = []
        try:
            # Find JSON in content
            if config.get("root") == "[]":
                match = re.search(r'\[.*\]', content, re.DOTALL)
                if match:
                    data = json.loads(match.group())
                    if config.get("skip_first"):
                        data = data[1:]
            else:
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    full_data = json.loads(match.group())
                    data = full_data.get(config.get("root", "jobs"), [])
            
            fields = config.get("fields", {})
            for item in data[:50]:  # Limit per source
                job = {}
                for our_field, their_field in fields.items():
                    if "." in their_field:
                        # Nested field
                        parts = their_field.split(".")
                        val = item
                        for p in parts:
                            if "[" in p:
                                key, idx = p.replace("]", "").split("[")
                                val = val.get(key, [])[int(idx)] if val else None
                            else:
                                val = val.get(p) if val else None
                        job[our_field] = val
                    else:
                        job[our_field] = item.get(their_field)
                jobs.append(job)
        except Exception as e:
            print(f"Parse error: {e}")
        return jobs

# Database
class JobDatabase:
    def __init__(self, db_path: Path):
        self.db_path = db_path
    
    def save_jobs(self, jobs: List[Job]) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        saved = 0
        for job in jobs:
            try:
                # Check if exists
                cursor.execute("SELECT id FROM jobs WHERE url = ?", (job.url,))
                if cursor.fetchone():
                    continue
                
                cursor.execute("""
                    INSERT INTO jobs (title, company, url, location, description, source, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'new', datetime('now'))
                """, (job.title, job.company, job.url, job.location, job.description, job.source))
                saved += 1
            except Exception as e:
                print(f"Save error: {e}")
        
        conn.commit()
        conn.close()
        return saved

# Scraper
class UnifiedScraper:
    def __init__(self):
        self.config = load_config()
        self.profile = load_profile()
        self.matcher = SkillMatcher(self.profile)
        self.db = JobDatabase(DB_PATH)
    
    def get_enabled_sources(self) -> List[Dict]:
        return [s for s in self.config.get("sources", []) if s.get("enabled", True)]
    
    async def scrape_source(self, source: Dict, crawler: AsyncWebCrawler) -> List[Job]:
        jobs = []
        try:
            result = await crawler.arun(
                url=source["url"],
                config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS)
            )
            
            if not result.success:
                return jobs
            
            if source.get("type") == "json":
                raw_jobs = JobParser.parse_json_api(result.markdown, source.get("parser", {}))
                for raw in raw_jobs:
                    if not raw.get("title"):
                        continue
                    
                    # Calculate match
                    text = f"{raw.get('title', '')} {raw.get('description', '')}"
                    score, skills = self.matcher.match(text, raw.get('title', ''))
                    
                    # Build salary string
                    salary = None
                    if raw.get("salary"):
                        salary = raw["salary"]
                    elif raw.get("salary_min") and raw.get("salary_max"):
                        salary = f"${raw['salary_min']}-${raw['salary_max']}"
                    
                    job = Job(
                        id=f"{source['name']}_{hash(raw.get('url', ''))}",
                        title=raw.get("title", ""),
                        company=raw.get("company", "Unknown"),
                        url=raw.get("url", ""),
                        source=source["name"],
                        location=raw.get("location"),
                        salary=salary,
                        description=raw.get("description", "")[:2000] if raw.get("description") else None,
                        match_score=score,
                        matched_skills=skills
                    )
                    jobs.append(job)
        except Exception as e:
            print(f"Scrape error for {source['name']}: {e}")
        
        return jobs
    
    async def scrape_all(self, source_names: Optional[List[str]] = None) -> tuple[List[Job], List[str]]:
        sources = self.get_enabled_sources()
        if source_names:
            sources = [s for s in sources if s["name"] in source_names]
        
        all_jobs = []
        errors = []
        
        async with AsyncWebCrawler() as crawler:
            for source in sources:
                try:
                    jobs = await self.scrape_source(source, crawler)
                    all_jobs.extend(jobs)
                    print(f"✅ {source['display_name']}: {len(jobs)} jobs")
                    
                    # Rate limit
                    await asyncio.sleep(source.get("rate_limit_ms", 1000) / 1000)
                except Exception as e:
                    errors.append(f"{source['name']}: {str(e)}")
                    print(f"❌ {source['display_name']}: {e}")
        
        return all_jobs, errors

# FastAPI App
scraper = UnifiedScraper()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Scraper Service starting...")
    yield
    print("🛑 Scraper Service shutting down...")

app = FastAPI(
    title="Job Scraper Service",
    description="Unified Crawl4AI-based job scraper",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/sources")
async def list_sources():
    sources = scraper.get_enabled_sources()
    return {
        "sources": [{"name": s["name"], "display_name": s["display_name"], "enabled": s.get("enabled", True)} for s in sources]
    }

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_jobs(request: ScrapeRequest, background_tasks: BackgroundTasks):
    jobs, errors = await scraper.scrape_all(request.sources)
    
    # Sort by match score
    jobs.sort(key=lambda x: x.match_score, reverse=True)
    
    # Limit
    jobs = jobs[:request.limit]
    
    # Save to DB
    saved = scraper.db.save_jobs(jobs)
    
    matched = len([j for j in jobs if j.match_score > 0])
    
    return ScrapeResponse(
        success=True,
        jobs_scraped=len(jobs),
        jobs_matched=matched,
        sources_scraped=[s["name"] for s in scraper.get_enabled_sources()],
        errors=errors
    )

@app.get("/jobs")
async def get_jobs(min_score: float = 0, limit: int = 50):
    jobs, _ = await scraper.scrape_all()
    jobs = [j for j in jobs if j.match_score >= min_score]
    jobs.sort(key=lambda x: x.match_score, reverse=True)
    return {"jobs": [asdict(j) for j in jobs[:limit]]}

@app.get("/jobs/matched")
async def get_matched_jobs(min_score: float = 20, limit: int = 20):
    jobs, _ = await scraper.scrape_all()
    matched = [j for j in jobs if j.match_score >= min_score]
    matched.sort(key=lambda x: x.match_score, reverse=True)
    return {
        "total": len(matched),
        "jobs": [asdict(j) for j in matched[:limit]]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
