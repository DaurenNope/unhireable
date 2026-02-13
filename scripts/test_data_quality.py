#!/usr/bin/env python3
"""
Test Crawl4AI job extraction with JSON output to verify data quality
"""
import asyncio
import json
from dataclasses import dataclass, asdict
from typing import List, Optional
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
import re

@dataclass
class Job:
    id: str
    title: str
    company: str
    url: str
    location: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    source: str = ""
    remote: bool = True

def parse_remoteok(content: str) -> List[Job]:
    """Parse RemoteOK JSON"""
    jobs = []
    try:
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data[1:11]:  # Skip legal, take 10
                if 'position' in item:
                    jobs.append(Job(
                        id=f"remoteok_{item.get('id', '')}",
                        title=item.get('position', ''),
                        company=item.get('company', ''),
                        url=item.get('url', f"https://remoteok.com/{item.get('slug', '')}"),
                        location=item.get('location', 'Remote'),
                        salary=f"${item.get('salary_min', '')}-${item.get('salary_max', '')}" if item.get('salary_min') else None,
                        description=item.get('description', '')[:500] if item.get('description') else None,
                        source="remoteok",
                        remote=True
                    ))
    except Exception as e:
        print(f"Parse error: {e}")
    return jobs

def parse_remotive(content: str) -> List[Job]:
    """Parse Remotive JSON"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('jobs', [])[:10]:
                jobs.append(Job(
                    id=f"remotive_{item.get('id', '')}",
                    title=item.get('title', ''),
                    company=item.get('company_name', ''),
                    url=item.get('url', ''),
                    location=item.get('candidate_required_location', 'Remote'),
                    salary=item.get('salary', ''),
                    description=item.get('description', '')[:500] if item.get('description') else None,
                    source="remotive",
                    remote=True
                ))
    except Exception as e:
        print(f"Parse error: {e}")
    return jobs

def parse_jobicy(content: str) -> List[Job]:
    """Parse Jobicy JSON"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('jobs', [])[:10]:
                jobs.append(Job(
                    id=f"jobicy_{item.get('id', '')}",
                    title=item.get('jobTitle', ''),
                    company=item.get('companyName', ''),
                    url=item.get('url', ''),
                    location=item.get('jobGeo', 'Remote'),
                    salary=f"${item.get('annualSalaryMin', '')}-${item.get('annualSalaryMax', '')}" if item.get('annualSalaryMin') else None,
                    description=item.get('jobDescription', '')[:500] if item.get('jobDescription') else None,
                    source="jobicy",
                    remote=True
                ))
    except Exception as e:
        print(f"Parse error: {e}")
    return jobs

async def main():
    print("=" * 70)
    print("       CRAWL4AI DATA QUALITY CHECK")  
    print("=" * 70)
    
    all_jobs = []
    
    sources = [
        ("RemoteOK", "https://remoteok.com/api", parse_remoteok),
        ("Remotive", "https://remotive.com/api/remote-jobs", parse_remotive),
        ("Jobicy", "https://jobicy.com/api/v2/remote-jobs", parse_jobicy),
    ]
    
    async with AsyncWebCrawler() as crawler:
        for name, url, parser in sources:
            print(f"\n🌐 Fetching {name}...")
            result = await crawler.arun(
                url=url,
                config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS)
            )
            
            if result.success:
                jobs = parser(result.markdown)
                all_jobs.extend(jobs)
                print(f"   ✅ Extracted {len(jobs)} jobs")
            else:
                print(f"   ❌ Failed: {result.error_message}")
    
    # Output detailed job data
    print("\n" + "=" * 70)
    print("       SAMPLE JOBS (Detailed)")
    print("=" * 70)
    
    for job in all_jobs[:5]:
        print(f"\n📋 {job.title}")
        print(f"   Company:     {job.company}")
        print(f"   URL:         {job.url[:60]}...")
        print(f"   Location:    {job.location}")
        print(f"   Salary:      {job.salary or 'Not specified'}")
        print(f"   Source:      {job.source}")
        print(f"   Description: {job.description[:100] if job.description else 'N/A'}...")
    
    # Save to JSON for inspection
    output_file = "scripts/extracted_jobs.json"
    with open(output_file, 'w') as f:
        json.dump([asdict(j) for j in all_jobs], f, indent=2)
    
    print(f"\n\n✅ Saved {len(all_jobs)} jobs to {output_file}")
    
    # Data quality stats
    print("\n" + "=" * 70)
    print("       DATA QUALITY STATS")
    print("=" * 70)
    
    has_title = sum(1 for j in all_jobs if j.title)
    has_company = sum(1 for j in all_jobs if j.company)
    has_url = sum(1 for j in all_jobs if j.url)
    has_salary = sum(1 for j in all_jobs if j.salary and j.salary != "$-$")
    has_description = sum(1 for j in all_jobs if j.description)
    
    print(f"\n   Total jobs:     {len(all_jobs)}")
    print(f"   Has title:      {has_title}/{len(all_jobs)} ({100*has_title//len(all_jobs)}%)")
    print(f"   Has company:    {has_company}/{len(all_jobs)} ({100*has_company//len(all_jobs)}%)")
    print(f"   Has URL:        {has_url}/{len(all_jobs)} ({100*has_url//len(all_jobs)}%)")
    print(f"   Has salary:     {has_salary}/{len(all_jobs)} ({100*has_salary//len(all_jobs)}%)")
    print(f"   Has description:{has_description}/{len(all_jobs)} ({100*has_description//len(all_jobs)}%)")

if __name__ == "__main__":
    asyncio.run(main())
