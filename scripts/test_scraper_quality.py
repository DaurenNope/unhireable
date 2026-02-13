#!/usr/bin/env python3
"""
COMPREHENSIVE Scraper Quality Evaluation
Tests ALL scrapers and evaluates data quality
"""
import requests
import json
import time
from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime

API_URL = "http://127.0.0.1:3030"

# All 11 working scrapers
ALL_SOURCES = [
    "arbeitnow",
    "dice",
    "hackernews",
    "hhkz",
    "jobicy",
    "remoteok",
    "remotive",
    "themuse",
    "web3career",
    "workatastartup",
    "wwr",
]

@dataclass
class SourceResult:
    name: str
    jobs_found: int
    jobs_saved: int
    duration: float
    error: Optional[str] = None
    
def test_source(source: str, query: str = "") -> SourceResult:
    """Test a single source"""
    start = time.time()
    try:
        resp = requests.post(
            f"{API_URL}/api/jobs/scrape",
            json={"sources": [source], "query": query},
            timeout=120
        )
        duration = time.time() - start
        data = resp.json()
        
        if "error" in data:
            return SourceResult(source, 0, 0, duration, data["error"][:80])
        
        result = data.get("data", {})
        return SourceResult(
            source,
            result.get("jobs_found", 0),
            result.get("jobs_saved", 0),
            duration
        )
    except requests.Timeout:
        return SourceResult(source, 0, 0, 120.0, "TIMEOUT")
    except Exception as e:
        duration = time.time() - start
        return SourceResult(source, 0, 0, duration, str(e)[:80])

def get_jobs(limit: int = 50) -> List[dict]:
    """Get recent jobs from database"""
    try:
        resp = requests.get(f"{API_URL}/api/jobs?page_size={limit}")
        data = resp.json()
        return data.get("data", data) if isinstance(data, dict) else data
    except:
        return []

def analyze_quality(jobs: List[dict]) -> Dict:
    """Analyze data quality of jobs"""
    if not jobs:
        return {"total": 0}
    
    total = len(jobs)
    
    def has_field(job, field, min_len=1):
        val = job.get(field, "")
        return bool(val and len(str(val).strip()) >= min_len)
    
    # Source breakdown
    sources = {}
    for j in jobs:
        s = j.get("source", "unknown")
        sources[s] = sources.get(s, 0) + 1
    
    return {
        "total": total,
        "title": sum(1 for j in jobs if has_field(j, "title")),
        "company": sum(1 for j in jobs if has_field(j, "company")),
        "url": sum(1 for j in jobs if has_field(j, "url", 10)),
        "description": sum(1 for j in jobs if has_field(j, "description", 20)),
        "location": sum(1 for j in jobs if has_field(j, "location")),
        "source": sum(1 for j in jobs if has_field(j, "source")),
        "sources": sources,
    }

def main():
    print("=" * 70)
    print("      COMPREHENSIVE SCRAPER EVALUATION - ALL {} SOURCES".format(len(ALL_SOURCES)))
    print("=" * 70)
    print(f"      Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print()
    
    # Get baseline
    print("📊 Step 1: Baseline")
    jobs_before = len(get_jobs(2000))
    print(f"   Jobs in database: {jobs_before}")
    print()
    
    # Test each source
    print("📊 Step 2: Testing all {} scrapers".format(len(ALL_SOURCES)))
    print("-" * 70)
    
    results: List[SourceResult] = []
    working = 0
    blocked = 0
    errors = 0
    
    for i, source in enumerate(ALL_SOURCES, 1):
        print(f"   [{i:2}/{len(ALL_SOURCES)}] {source:18}", end=" ", flush=True)
        result = test_source(source)
        results.append(result)
        
        if result.error:
            if "403" in str(result.error) or "blocked" in str(result.error).lower():
                print(f"🚫 BLOCKED ({result.duration:.1f}s)")
                blocked += 1
            elif "TIMEOUT" in str(result.error):
                print(f"⏱️  TIMEOUT")
                errors += 1
            else:
                print(f"❌ ERROR ({result.duration:.1f}s)")
                errors += 1
        elif result.jobs_found == 0:
            print(f"⚠️  0 jobs ({result.duration:.1f}s)")
        else:
            print(f"✅ {result.jobs_found:3} found, {result.jobs_saved:3} saved ({result.duration:.1f}s)")
            working += 1
        
        time.sleep(0.5)  # Small delay between sources
    
    print("-" * 70)
    print()
    
    # Get final count
    print("📊 Step 3: Database verification")
    jobs_after = len(get_jobs(2000))
    new_jobs = jobs_after - jobs_before
    print(f"   Before: {jobs_before}")
    print(f"   After:  {jobs_after}")
    print(f"   New:    +{new_jobs}")
    print()
    
    # Quality analysis
    print("📊 Step 4: Data quality analysis")
    recent_jobs = get_jobs(200)
    quality = analyze_quality(recent_jobs)
    
    if quality["total"] > 0:
        t = quality["total"]
        print(f"   Sample: {t} recent jobs")
        print(f"   ├─ Title:       {quality['title']:3}/{t} ({100*quality['title']//t:3}%)")
        print(f"   ├─ Company:     {quality['company']:3}/{t} ({100*quality['company']//t:3}%)")
        print(f"   ├─ URL:         {quality['url']:3}/{t} ({100*quality['url']//t:3}%)")
        print(f"   ├─ Description: {quality['description']:3}/{t} ({100*quality['description']//t:3}%)")
        print(f"   ├─ Location:    {quality['location']:3}/{t} ({100*quality['location']//t:3}%)")
        print(f"   └─ Source:      {quality['source']:3}/{t} ({100*quality['source']//t:3}%)")
        
        print()
        print("   Sources in sample:")
        for s, c in sorted(quality["sources"].items(), key=lambda x: -x[1])[:10]:
            print(f"   ├─ {s}: {c}")
    
    print()
    print("=" * 70)
    print("                           SUMMARY")
    print("=" * 70)
    print()
    
    # Categorize results
    working_sources = [r for r in results if r.jobs_found > 0]
    zero_sources = [r for r in results if r.jobs_found == 0 and not r.error]
    blocked_sources = [r for r in results if r.error and ("403" in str(r.error) or "blocked" in str(r.error).lower())]
    error_sources = [r for r in results if r.error and r not in blocked_sources]
    
    # Working
    print("✅ WORKING ({})".format(len(working_sources)))
    for r in sorted(working_sources, key=lambda x: -x.jobs_found):
        print(f"   {r.name:18} {r.jobs_found:4} jobs")
    print()
    
    # Zero jobs (not necessarily broken)
    if zero_sources:
        print("⚠️  ZERO JOBS ({})".format(len(zero_sources)))
        for r in zero_sources:
            print(f"   {r.name:18}")
        print()
    
    # Blocked (need browser/proxy)
    if blocked_sources:
        print("🚫 BLOCKED ({} - need browser/proxy)".format(len(blocked_sources)))
        for r in blocked_sources:
            print(f"   {r.name:18}")
        print()
    
    # Errors
    if error_sources:
        print("❌ ERRORS ({})".format(len(error_sources)))
        for r in error_sources:
            print(f"   {r.name:18} {r.error[:50] if r.error else ''}")
        print()
    
    # Final stats
    total_found = sum(r.jobs_found for r in results)
    total_saved = sum(r.jobs_saved for r in results)
    
    print("-" * 70)
    print(f"   Sources tested:    {len(ALL_SOURCES)}")
    print(f"   Working:           {len(working_sources)}")
    print(f"   Zero jobs:         {len(zero_sources)}")
    print(f"   Blocked:           {len(blocked_sources)}")
    print(f"   Errors:            {len(error_sources)}")
    print()
    print(f"   Total scraped:     {total_found} jobs")
    print(f"   New jobs saved:    {total_saved}")
    print(f"   Database growth:   {jobs_before} → {jobs_after} (+{new_jobs})")
    print("-" * 70)
    print()
    
    # Grade
    working_pct = len(working_sources) / len(ALL_SOURCES) * 100
    if working_pct >= 50:
        print(f"   🎉 GRADE: A ({working_pct:.0f}% working)")
    elif working_pct >= 30:
        print(f"   ✅ GRADE: B ({working_pct:.0f}% working)")
    elif working_pct >= 15:
        print(f"   ⚠️  GRADE: C ({working_pct:.0f}% working)")
    else:
        print(f"   ❌ GRADE: D ({working_pct:.0f}% working)")
    
    print()
    print(f"      Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

if __name__ == "__main__":
    main()
