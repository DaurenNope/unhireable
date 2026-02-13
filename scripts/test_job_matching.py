#!/usr/bin/env python3
"""
Job Matching Test - Match scraped jobs against user profile
"""
import asyncio
import json
import re
from dataclasses import dataclass
from typing import List, Set
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

# Load user profile
PROFILE_PATH = "/Users/mac/Documents/Development/jobez/src-tauri/personas/atlas_profile.json"

with open(PROFILE_PATH) as f:
    PROFILE = json.load(f)

# Extract skills from profile
USER_SKILLS: Set[str] = set()
for skill in PROFILE["skills"]["technical_skills"]:
    USER_SKILLS.add(skill.lower())
for skill in PROFILE["skills"]["soft_skills"]:
    USER_SKILLS.add(skill.lower())

# Add common variations
SKILL_ALIASES = {
    "python": ["python", "python3", "py"],
    "javascript": ["javascript", "js", "node.js", "nodejs"],
    "typescript": ["typescript", "ts"],
    "react": ["react", "reactjs", "react.js"],
    "fastapi": ["fastapi", "fast api"],
    "n8n": ["n8n", "workflow automation"],
    "blockchain": ["blockchain", "web3", "crypto", "defi"],
    "solidity": ["solidity", "smart contracts", "ethereum"],
    "ai": ["ai", "artificial intelligence", "machine learning", "ml", "llm"],
    "automation": ["automation", "automated", "scripting"],
    "rag": ["rag", "retrieval augmented", "embeddings"],
}

@dataclass
class MatchedJob:
    title: str
    company: str
    url: str
    score: float
    matched_skills: List[str]
    source: str

def calculate_match_score(job_text: str, job_title: str) -> tuple[float, List[str]]:
    """Calculate match score based on skills"""
    text = (job_text + " " + job_title).lower()
    matched = []
    
    # Check each user skill
    for skill in USER_SKILLS:
        if skill in text:
            matched.append(skill)
        # Check aliases
        for alias_key, aliases in SKILL_ALIASES.items():
            if alias_key in skill:
                for alias in aliases:
                    if alias in text and alias_key not in matched:
                        matched.append(alias_key)
                        break
    
    # Calculate score (0-100)
    if len(USER_SKILLS) > 0:
        score = (len(matched) / len(USER_SKILLS)) * 100
    else:
        score = 0
    
    # Boost for key skills
    key_skills = ["python", "ai", "automation", "blockchain", "fastapi", "n8n"]
    for skill in key_skills:
        if skill in matched:
            score += 5
    
    return min(score, 100), list(set(matched))

def parse_remoteok(content: str) -> List[dict]:
    """Parse RemoteOK JSON"""
    jobs = []
    try:
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data[1:31]:  # Skip legal, take 30
                if 'position' in item:
                    jobs.append({
                        "title": item.get('position', ''),
                        "company": item.get('company', ''),
                        "url": item.get('url', ''),
                        "description": item.get('description', '')[:1000],
                        "source": "remoteok"
                    })
    except:
        pass
    return jobs

def parse_remotive(content: str) -> List[dict]:
    """Parse Remotive JSON"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('jobs', [])[:30]:
                jobs.append({
                    "title": item.get('title', ''),
                    "company": item.get('company_name', ''),
                    "url": item.get('url', ''),
                    "description": item.get('description', '')[:1000],
                    "source": "remotive"
                })
    except:
        pass
    return jobs

def parse_jobicy(content: str) -> List[dict]:
    """Parse Jobicy JSON"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('jobs', [])[:30]:
                jobs.append({
                    "title": item.get('jobTitle', ''),
                    "company": item.get('companyName', ''),
                    "url": item.get('url', ''),
                    "description": item.get('jobDescription', '')[:1000] if item.get('jobDescription') else '',
                    "source": "jobicy"
                })
    except:
        pass
    return jobs

async def main():
    print("=" * 70)
    print(f"       JOB MATCHING FOR: {PROFILE['personal_info']['name']}")
    print("=" * 70)
    print(f"\n📋 Your Skills: {', '.join(list(USER_SKILLS)[:10])}...")
    print(f"   Total skills: {len(USER_SKILLS)}")
    
    # Scrape jobs
    all_jobs = []
    sources = [
        ("RemoteOK", "https://remoteok.com/api", parse_remoteok),
        ("Remotive", "https://remotive.com/api/remote-jobs", parse_remotive),
        ("Jobicy", "https://jobicy.com/api/v2/remote-jobs", parse_jobicy),
    ]
    
    print("\n🌐 Fetching fresh jobs...")
    async with AsyncWebCrawler() as crawler:
        for name, url, parser in sources:
            result = await crawler.arun(
                url=url,
                config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS)
            )
            if result.success:
                jobs = parser(result.markdown)
                all_jobs.extend(jobs)
                print(f"   ✅ {name}: {len(jobs)} jobs")
    
    print(f"\n📊 Matching {len(all_jobs)} jobs against your profile...")
    
    # Match jobs
    matched_jobs = []
    for job in all_jobs:
        text = f"{job['title']} {job['description']}"
        score, skills = calculate_match_score(text, job['title'])
        if score > 0:
            matched_jobs.append(MatchedJob(
                title=job['title'],
                company=job['company'],
                url=job['url'],
                score=score,
                matched_skills=skills,
                source=job['source']
            ))
    
    # Sort by score
    matched_jobs.sort(key=lambda x: x.score, reverse=True)
    
    # Results
    print("\n" + "=" * 70)
    print("       TOP MATCHING JOBS")
    print("=" * 70)
    
    for i, job in enumerate(matched_jobs[:15], 1):
        print(f"\n{i}. [{job.score:.0f}%] {job.title}")
        print(f"   🏢 {job.company} ({job.source})")
        print(f"   🔗 {job.url[:60]}...")
        print(f"   ✅ Matched: {', '.join(job.matched_skills[:5])}")
    
    # Summary
    print("\n" + "=" * 70)
    print("       SUMMARY")
    print("=" * 70)
    
    excellent = len([j for j in matched_jobs if j.score >= 50])
    good = len([j for j in matched_jobs if 30 <= j.score < 50])
    fair = len([j for j in matched_jobs if 10 <= j.score < 30])
    
    print(f"\n   Total jobs scraped: {len(all_jobs)}")
    print(f"   Jobs with matches:  {len(matched_jobs)}")
    print(f"   🌟 Excellent (50%+): {excellent}")
    print(f"   ✅ Good (30-50%):    {good}")
    print(f"   📌 Fair (10-30%):    {fair}")
    
    # Save results
    output = {
        "profile": PROFILE['personal_info']['name'],
        "total_jobs": len(all_jobs),
        "matched_jobs": len(matched_jobs),
        "top_matches": [
            {
                "title": j.title,
                "company": j.company,
                "url": j.url,
                "score": j.score,
                "matched_skills": j.matched_skills,
                "source": j.source
            }
            for j in matched_jobs[:20]
        ]
    }
    
    with open("scripts/matched_jobs.json", "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"\n💾 Saved results to scripts/matched_jobs.json")

if __name__ == "__main__":
    asyncio.run(main())
