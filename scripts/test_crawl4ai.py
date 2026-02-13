#!/usr/bin/env python3
"""
Quick test of Crawl4AI for job scraping
"""
import asyncio
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

async def test_remoteok():
    """Test scraping RemoteOK (JSON API)"""
    print("=" * 60)
    print("Testing Crawl4AI on RemoteOK")
    print("=" * 60)
    
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(
            url="https://remoteok.com/api",
            config=CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
            )
        )
        
        if result.success:
            print(f"✅ Success!")
            print(f"   Content length: {len(result.markdown)} chars")
            print(f"   First 500 chars:\n{result.markdown[:500]}")
        else:
            print(f"❌ Failed: {result.error_message}")

async def test_hackernews():
    """Test scraping HackerNews Who's Hiring"""
    print("\n" + "=" * 60)
    print("Testing Crawl4AI on HackerNews Jobs")
    print("=" * 60)
    
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(
            url="https://news.ycombinator.com/item?id=42575537",
            config=CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
            )
        )
        
        if result.success:
            print(f"✅ Success!")
            print(f"   Content length: {len(result.markdown)} chars")
            # Count job posts (lines starting with company hiring pattern)
            lines = result.markdown.split('\n')
            job_lines = [l for l in lines if '|' in l and 'hiring' in l.lower()]
            print(f"   Potential job posts: ~{len(job_lines)}")
        else:
            print(f"❌ Failed: {result.error_message}")

async def test_web3career():
    """Test scraping Web3Career (blocked site)"""
    print("\n" + "=" * 60)
    print("Testing Crawl4AI on Web3Career (potential anti-bot)")
    print("=" * 60)
    
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(
            url="https://web3.career/remote-jobs",
            config=CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
            )
        )
        
        if result.success:
            print(f"✅ Success!")
            print(f"   Content length: {len(result.markdown)} chars")
            # Look for job indicators
            if 'job' in result.markdown.lower():
                print(f"   Contains job-related content: Yes")
        else:
            print(f"❌ Failed: {result.error_message}")

async def main():
    print("🚀 Crawl4AI Job Scraping Test")
    print("=" * 60)
    
    await test_remoteok()
    await test_hackernews()
    await test_web3career()
    
    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
