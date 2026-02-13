#!/usr/bin/env python3
"""
Comprehensive Crawl4AI job extraction test
Tests actual data extraction from multiple job boards
"""
import asyncio
import json
import re
from dataclasses import dataclass, asdict
from typing import List, Optional
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

@dataclass
class Job:
    title: str
    company: str
    url: str
    location: Optional[str] = None
    salary: Optional[str] = None
    source: str = ""

# All job sources to test
SOURCES = [
    {
        "name": "RemoteOK",
        "url": "https://remoteok.com/api",
        "type": "json_api",
    },
    {
        "name": "Remotive", 
        "url": "https://remotive.com/api/remote-jobs",
        "type": "json_api",
    },
    {
        "name": "Arbeitnow",
        "url": "https://www.arbeitnow.com/api/job-board-api",
        "type": "json_api",
    },
    {
        "name": "HackerNews",
        "url": "https://news.ycombinator.com/item?id=42575537",
        "type": "html",
    },
    {
        "name": "Web3Career",
        "url": "https://web3.career/remote-jobs",
        "type": "html",
    },
    {
        "name": "WeWorkRemotely",
        "url": "https://weworkremotely.com/remote-jobs",
        "type": "html",
    },
    {
        "name": "Jobicy",
        "url": "https://jobicy.com/api/v2/remote-jobs",
        "type": "json_api",
    },
    {
        "name": "TheMuse",
        "url": "https://www.themuse.com/api/public/jobs?page=1",
        "type": "json_api",
    },
]

def parse_remoteok_jobs(content: str) -> List[Job]:
    """Parse RemoteOK JSON API response"""
    jobs = []
    try:
        # Find JSON array in markdown
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data[1:21]:  # Skip first (legal notice), take 20
                if 'position' in item:
                    jobs.append(Job(
                        title=item.get('position', ''),
                        company=item.get('company', ''),
                        url=item.get('url', f"https://remoteok.com/{item.get('slug', '')}"),
                        location=item.get('location', 'Remote'),
                        salary=item.get('salary_min', ''),
                        source="remoteok"
                    ))
    except Exception as e:
        print(f"  Parse error: {e}")
    return jobs

def parse_remotive_jobs(content: str) -> List[Job]:
    """Parse Remotive JSON API response"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('jobs', [])[:20]:
                jobs.append(Job(
                    title=item.get('title', ''),
                    company=item.get('company_name', ''),
                    url=item.get('url', ''),
                    location=item.get('candidate_required_location', 'Remote'),
                    salary=item.get('salary', ''),
                    source="remotive"
                ))
    except Exception as e:
        print(f"  Parse error: {e}")
    return jobs

def parse_arbeitnow_jobs(content: str) -> List[Job]:
    """Parse Arbeitnow JSON API response"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('data', [])[:20]:
                jobs.append(Job(
                    title=item.get('title', ''),
                    company=item.get('company_name', ''),
                    url=item.get('url', ''),
                    location=item.get('location', 'Remote'),
                    source="arbeitnow"
                ))
    except Exception as e:
        print(f"  Parse error: {e}")
    return jobs

def parse_jobicy_jobs(content: str) -> List[Job]:
    """Parse Jobicy JSON API response"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('jobs', [])[:20]:
                jobs.append(Job(
                    title=item.get('jobTitle', ''),
                    company=item.get('companyName', ''),
                    url=item.get('url', ''),
                    location=item.get('jobGeo', 'Remote'),
                    source="jobicy"
                ))
    except Exception as e:
        print(f"  Parse error: {e}")
    return jobs

def parse_themuse_jobs(content: str) -> List[Job]:
    """Parse TheMuse JSON API response"""
    jobs = []
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            for item in data.get('results', [])[:20]:
                loc = item.get('locations', [{}])
                location = loc[0].get('name', 'Unknown') if loc else 'Unknown'
                jobs.append(Job(
                    title=item.get('name', ''),
                    company=item.get('company', {}).get('name', ''),
                    url=f"https://www.themuse.com/jobs/{item.get('id', '')}",
                    location=location,
                    source="themuse"
                ))
    except Exception as e:
        print(f"  Parse error: {e}")
    return jobs

def parse_html_generic(content: str, source: str) -> List[Job]:
    """Generic HTML parser - extract job-like patterns from markdown"""
    jobs = []
    lines = content.split('\n')
    
    # Look for job patterns in markdown
    for i, line in enumerate(lines[:200]):  # First 200 lines
        # Pattern: text with company and position indicators
        if any(kw in line.lower() for kw in ['hiring', 'engineer', 'developer', 'manager', 'remote']):
            # Try to extract title from headers or links
            title_match = re.search(r'\[([^\]]+)\]', line)
            if title_match:
                title = title_match.group(1)[:80]
                url_match = re.search(r'\(([^)]+)\)', line)
                url = url_match.group(1) if url_match else ""
                if title and len(title) > 5:
                    jobs.append(Job(
                        title=title,
                        company="Unknown",
                        url=url,
                        source=source
                    ))
    
    return jobs[:20]  # Limit to 20

async def test_source(crawler, source: dict) -> dict:
    """Test a single source and extract jobs"""
    result = {
        "name": source["name"],
        "success": False,
        "jobs": [],
        "time": 0,
        "error": None
    }
    
    try:
        res = await crawler.arun(
            url=source["url"],
            config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS)
        )
        
        if res.success:
            result["success"] = True
            result["content_len"] = len(res.markdown)
            
            # Parse based on type
            if source["type"] == "json_api":
                if source["name"] == "RemoteOK":
                    result["jobs"] = parse_remoteok_jobs(res.markdown)
                elif source["name"] == "Remotive":
                    result["jobs"] = parse_remotive_jobs(res.markdown)
                elif source["name"] == "Arbeitnow":
                    result["jobs"] = parse_arbeitnow_jobs(res.markdown)
                elif source["name"] == "Jobicy":
                    result["jobs"] = parse_jobicy_jobs(res.markdown)
                elif source["name"] == "TheMuse":
                    result["jobs"] = parse_themuse_jobs(res.markdown)
            else:
                result["jobs"] = parse_html_generic(res.markdown, source["name"].lower())
        else:
            result["error"] = res.error_message
            
    except Exception as e:
        result["error"] = str(e)
    
    return result

async def main():
    print("=" * 70)
    print("       CRAWL4AI JOB EXTRACTION TEST - ALL SOURCES")
    print("=" * 70)
    
    all_results = []
    total_jobs = 0
    
    async with AsyncWebCrawler() as crawler:
        for source in SOURCES:
            print(f"\n🌐 Testing {source['name']}...")
            result = await test_source(crawler, source)
            all_results.append(result)
            
            if result["success"]:
                job_count = len(result["jobs"])
                total_jobs += job_count
                print(f"   ✅ {job_count} jobs extracted")
                
                # Show sample jobs
                for job in result["jobs"][:3]:
                    print(f"      • {job.title[:50]} @ {job.company[:30]}")
            else:
                print(f"   ❌ Failed: {result['error']}")
    
    # Summary
    print("\n" + "=" * 70)
    print("                         SUMMARY")
    print("=" * 70)
    
    success_count = sum(1 for r in all_results if r["success"])
    print(f"\n   Sources tested: {len(SOURCES)}")
    print(f"   Successful:     {success_count}/{len(SOURCES)}")
    print(f"   Total jobs:     {total_jobs}")
    
    print("\n   Results by source:")
    for r in all_results:
        status = "✅" if r["success"] else "❌"
        jobs = len(r["jobs"])
        print(f"   {status} {r['name']:20} {jobs:3} jobs")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
