#!/usr/bin/env python3
"""
Auto-Apply Agent with LLM Integration
Uses Playwright to navigate job pages and LLM to generate smart answers.
"""
import asyncio
import json
import os
import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from playwright.async_api import async_playwright, Page, Locator

# Try to import google.generativeai for Gemini
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("⚠️ google-generativeai not installed. Run: pip install google-generativeai")

# Load user profile
PROFILE_PATH = "/Users/mac/Documents/Development/jobez/src-tauri/personas/atlas_profile.json"

with open(PROFILE_PATH) as f:
    PROFILE = json.load(f)


@dataclass
class FormField:
    """Detected form field"""
    name: str
    field_type: str  # text, email, tel, textarea, select, file, checkbox
    label: str
    required: bool
    locator: str
    suggested_value: Optional[str] = None
    is_custom_question: bool = False


@dataclass
class JobContext:
    """Context about the job for LLM prompts"""
    title: str = ""
    company: str = ""
    description: str = ""
    requirements: str = ""
    url: str = ""


@dataclass
class ApplyResult:
    """Result of apply attempt"""
    success: bool
    job_url: str
    form_type: str  # easy_apply, ats_form, email, external
    fields_found: int
    fields_filled: int
    message: str
    screenshot_path: Optional[str] = None


class LLMAnswerGenerator:
    """Generate contextual answers using Gemini"""
    
    SYSTEM_PROMPT = """You are helping fill out a job application. 
Generate professional, concise answers based on the candidate's profile and the job context.
Keep answers natural and authentic - don't be overly formal or salesy.
Match the tone to the question type:
- Short answer questions: 1-2 sentences
- Why interested/cover letter: 3-4 sentences max
- Specific questions: Direct, honest answers

Candidate Profile:
{profile_summary}

Job Context:
- Company: {company}
- Role: {title}
- Description: {description}
"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            print("✅ Gemini LLM initialized")
        else:
            print("⚠️ LLM not available - will use template answers")
    
    def _get_profile_summary(self) -> str:
        """Create a concise profile summary for the LLM"""
        name = PROFILE.get("personal_info", {}).get("name", "Unknown")
        summary = PROFILE.get("summary", "")
        skills = ", ".join(PROFILE.get("skills", {}).get("technical_skills", [])[:10])
        
        experience_summary = ""
        if PROFILE.get("experience"):
            exp = PROFILE["experience"][0]
            experience_summary = f"Currently/Recently: {exp.get('position', '')} at {exp.get('company', '')}"
        
        return f"""Name: {name}
Summary: {summary[:300] if summary else 'N/A'}
Top Skills: {skills}
{experience_summary}
"""

    def generate_answer(self, question: str, job_context: JobContext) -> str:
        """Generate an answer for a custom question"""
        
        # Common question patterns with template answers
        TEMPLATE_ANSWERS = {
            r"why.*interested|why.*apply|why.*want.*work|why.*company": self._why_interested,
            r"salary|compensation|pay.*expect": self._salary_expectations,
            r"start.*date|when.*start|available.*start|earliest.*start": lambda q, j: "I can start within 2 weeks of an offer.",
            r"relocat|willing.*move": lambda q, j: "I am open to relocation for the right opportunity, though I prefer remote work.",
            r"visa|sponsor|work.*authorization|legally.*work": lambda q, j: "I am authorized to work and do not require visa sponsorship.",
            r"years.*experience|how.*long|experience.*years": self._years_experience,
            r"tell.*about.*yourself|introduce|describe.*yourself": self._about_yourself,
            r"strength|what.*good.*at": self._strengths,
            r"weakness|improve|development.*area": lambda q, j: "I'm continuously working on delegation - as someone who takes ownership, I sometimes take on too much myself.",
            r"remote|work.*from.*home|hybrid": lambda q, j: "I have extensive experience working remotely and am highly effective in distributed team environments.",
        }
        
        # Try template first
        question_lower = question.lower()
        for pattern, answer_fn in TEMPLATE_ANSWERS.items():
            if re.search(pattern, question_lower):
                return answer_fn(question, job_context)
        
        # Use LLM for unknown questions
        if self.model:
            try:
                prompt = self.SYSTEM_PROMPT.format(
                    profile_summary=self._get_profile_summary(),
                    company=job_context.company or "the company",
                    title=job_context.title or "this role",
                    description=job_context.description[:500] if job_context.description else "N/A"
                )
                
                full_prompt = f"{prompt}\n\nQuestion: {question}\n\nProvide a concise, professional answer:"
                
                response = self.model.generate_content(full_prompt)
                return response.text.strip()
            except Exception as e:
                print(f"⚠️ LLM error: {e}")
        
        # Fallback
        return f"I would be happy to discuss this further in an interview."
    
    def _why_interested(self, question: str, job_context: JobContext) -> str:
        """Generate 'why interested' answer"""
        company = job_context.company or "your company"
        title = job_context.title or "this role"
        
        skills = PROFILE.get("skills", {}).get("technical_skills", [])[:3]
        skills_text = ", ".join(skills) if skills else "my technical skills"
        
        return f"""I'm excited about {title} at {company} because it aligns perfectly with my expertise in {skills_text}. 
I'm particularly drawn to the opportunity to contribute to innovative products while working with a distributed team. 
My background in building and shipping products from 0 to 1 makes me confident I can add value quickly."""
    
    def _salary_expectations(self, question: str, job_context: JobContext) -> str:
        return "I'm open to discussing compensation based on the full scope of the role and the team. I'm looking for a competitive package aligned with market rates for similar positions."
    
    def _years_experience(self, question: str, job_context: JobContext) -> str:
        total_years = sum(PROFILE.get("skills", {}).get("experience_years", {}).values())
        return f"I have approximately {total_years} years of relevant professional experience."
    
    def _about_yourself(self, question: str, job_context: JobContext) -> str:
        summary = PROFILE.get("summary", "")
        if summary:
            return summary[:400]
        return "I'm a product-focused professional with experience building and scaling technology products."
    
    def _strengths(self, question: str, job_context: JobContext) -> str:
        skills = PROFILE.get("skills", {}).get("technical_skills", [])[:5]
        soft_skills = PROFILE.get("skills", {}).get("soft_skills", [])[:3]
        
        return f"My key strengths include {', '.join(skills[:3])} on the technical side, combined with strong {', '.join(soft_skills[:2]).lower()} abilities."

    def generate_cover_letter(self, job_context: JobContext) -> str:
        """Generate a tailored cover letter"""
        name = PROFILE.get("personal_info", {}).get("name", "")
        company = job_context.company or "your company"
        title = job_context.title or "this position"
        
        skills = ", ".join(PROFILE.get("skills", {}).get("technical_skills", [])[:5])
        
        exp = PROFILE.get("experience", [{}])[0]
        recent_role = f"{exp.get('position', '')} at {exp.get('company', '')}" if exp else "my recent experience"
        
        return f"""Dear Hiring Team,

I am writing to express my interest in the {title} position at {company}. With my background in {skills}, I am confident I would be a valuable addition to your team.

In my role as {recent_role}, I have consistently delivered results by combining technical expertise with strong product thinking. I thrive in fast-paced, remote-first environments and am passionate about building products that make a real impact.

I would welcome the opportunity to discuss how my experience aligns with {company}'s goals.

Best regards,
{name}"""


class ApplyAgent:
    """Browser agent for automated job applications with LLM support"""
    
    # Common apply button patterns
    APPLY_PATTERNS = [
        "apply now",
        "apply for this job",
        "apply",
        "submit application",
        "easy apply",
        "quick apply",
        "apply on company site",
        "apply for position",
    ]
    
    # ATS detection patterns
    ATS_PATTERNS = {
        "greenhouse": ["greenhouse.io", "boards.greenhouse"],
        "lever": ["lever.co", "jobs.lever"],
        "workday": ["myworkdayjobs.com", "workday.com"],
        "ashby": ["ashbyhq.com"],
        "bamboohr": ["bamboohr.com"],
    }
    
    # Field mapping: label patterns → profile paths
    FIELD_MAP = {
        # Personal info
        r"(full\s*name|your\s*name|^name$)": lambda p: p["personal_info"]["name"],
        r"(first\s*name)": lambda p: p["personal_info"]["name"].split()[0] if p["personal_info"]["name"] else "",
        r"(last\s*name|surname)": lambda p: p["personal_info"]["name"].split()[-1] if p["personal_info"]["name"] else "",
        r"(email|e-mail)": lambda p: p["personal_info"]["email"],
        r"(phone|mobile|telephone)": lambda p: p["personal_info"].get("phone", ""),
        r"(linkedin|profile\s*url)": lambda p: p["personal_info"].get("linkedin", ""),
        r"(github|portfolio|website)": lambda p: p["personal_info"].get("github") or p["personal_info"].get("portfolio", ""),
        r"(location|city|address)": lambda p: p["personal_info"].get("location", "Remote"),
        
        # Experience
        r"(years?\s*of\s*experience|experience\s*years?)": lambda p: str(sum(p["skills"].get("experience_years", {}).values())),
        r"(current\s*(company|employer)|where\s*do\s*you\s*work)": lambda p: p["experience"][0]["company"] if p.get("experience") else "",
        r"(current\s*(title|position|role))": lambda p: p["experience"][0]["position"] if p.get("experience") else "",
        
        # Skills
        r"(skills|technologies|tech\s*stack)": lambda p: ", ".join(p["skills"]["technical_skills"][:10]),
    }
    
    # Custom question patterns (will use LLM)
    CUSTOM_QUESTION_PATTERNS = [
        r"why.*interested",
        r"why.*apply",
        r"why.*want.*work",
        r"tell.*about.*yourself",
        r"cover\s*letter",
        r"what.*attract",
        r"describe.*experience",
        r"salary|compensation",
        r"additional\s*information",
        r"anything.*else",
    ]
    
    def __init__(self, gemini_api_key: Optional[str] = None):
        self.browser = None
        self.context = None
        self.page = None
        self.llm = LLMAnswerGenerator(gemini_api_key)
        self.job_context = JobContext()
    
    async def start(self, headless: bool = False):
        """Start browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"]
        )
        self.context = await self.browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        self.page = await self.context.new_page()
        print("🌐 Browser started")
    
    async def stop(self):
        """Stop browser"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        print("🛑 Browser stopped")
    
    async def navigate_to_job(self, url: str) -> bool:
        """Navigate to job posting"""
        try:
            await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await self.page.wait_for_timeout(2000)
            self.job_context.url = url
            print(f"📄 Loaded: {url[:60]}...")
            
            # Extract job context from page
            await self._extract_job_context()
            
            return True
        except Exception as e:
            print(f"❌ Failed to load: {e}")
            return False
    
    async def _extract_job_context(self):
        """Extract job details from the page for LLM context"""
        try:
            # Try to get title
            title_selectors = ["h1", "[data-qa='job-title']", ".job-title", ".posting-title"]
            for sel in title_selectors:
                elem = self.page.locator(sel).first
                if await elem.is_visible(timeout=500):
                    self.job_context.title = await elem.text_content() or ""
                    break
            
            # Try to get company
            company_selectors = [".company-name", "[data-qa='company-name']", ".posting-company"]
            for sel in company_selectors:
                elem = self.page.locator(sel).first
                if await elem.is_visible(timeout=500):
                    self.job_context.company = await elem.text_content() or ""
                    break
            
            # Get main content as description
            content = await self.page.locator("main, article, .job-description, .posting-content").first.text_content()
            if content:
                self.job_context.description = content[:2000]
            
            print(f"📋 Job: {self.job_context.title[:40]}... @ {self.job_context.company[:30]}...")
        except:
            pass
    
    async def detect_ats(self) -> Optional[str]:
        """Detect which ATS system is being used"""
        url = self.page.url.lower()
        for ats_name, patterns in self.ATS_PATTERNS.items():
            for pattern in patterns:
                if pattern in url:
                    print(f"🔍 Detected ATS: {ats_name}")
                    return ats_name
        return None
    
    async def find_apply_button(self) -> Optional[Locator]:
        """Find the apply button on the page"""
        # Try common selectors
        selectors = [
            "a:has-text('Apply')",
            "button:has-text('Apply')",
            "[data-testid*='apply']",
            ".apply-button",
            "#apply-button",
            "a[href*='apply']",
        ]
        
        for sel in selectors:
            try:
                locator = self.page.locator(sel).first
                if await locator.is_visible(timeout=1000):
                    text = await locator.text_content()
                    print(f"✅ Found apply button: '{text.strip()[:30] if text else 'Apply'}'")
                    return locator
            except:
                continue
        
        # Fallback: search by text content
        for pattern in self.APPLY_PATTERNS:
            try:
                locator = self.page.get_by_role("link", name=re.compile(pattern, re.I)).first
                if await locator.is_visible(timeout=500):
                    print(f"✅ Found apply link: '{pattern}'")
                    return locator
            except:
                continue
            
            try:
                locator = self.page.get_by_role("button", name=re.compile(pattern, re.I)).first
                if await locator.is_visible(timeout=500):
                    print(f"✅ Found apply button: '{pattern}'")
                    return locator
            except:
                continue
        
        print("❌ No apply button found")
        return None
    
    async def click_apply(self) -> bool:
        """Click the apply button"""
        button = await self.find_apply_button()
        if not button:
            return False
        
        try:
            await button.click()
            await self.page.wait_for_timeout(2000)
            print("🖱️ Clicked apply button")
            return True
        except Exception as e:
            print(f"❌ Failed to click: {e}")
            return False
    
    def _is_custom_question(self, label: str) -> bool:
        """Check if a field is a custom question requiring LLM"""
        label_lower = label.lower()
        for pattern in self.CUSTOM_QUESTION_PATTERNS:
            if re.search(pattern, label_lower):
                return True
        return False
    
    async def detect_form_fields(self) -> List[FormField]:
        """Detect all form fields on the page"""
        fields = []
        
        # Find all input fields
        inputs = await self.page.locator("input, textarea, select").all()
        
        for inp in inputs:
            try:
                # Get field properties
                field_type = await inp.get_attribute("type") or "text"
                name = await inp.get_attribute("name") or await inp.get_attribute("id") or ""
                placeholder = await inp.get_attribute("placeholder") or ""
                required = await inp.get_attribute("required") is not None
                aria_label = await inp.get_attribute("aria-label") or ""
                
                # Try to find associated label
                label = ""
                field_id = await inp.get_attribute("id")
                if field_id:
                    label_elem = self.page.locator(f"label[for='{field_id}']")
                    if await label_elem.count() > 0:
                        label = await label_elem.first.text_content() or ""
                
                if not label:
                    label = aria_label or placeholder or name
                
                # Skip hidden/submit fields
                if field_type in ["hidden", "submit", "button"]:
                    continue
                
                # Check if custom question
                is_custom = self._is_custom_question(label)
                
                # Map to profile data or generate with LLM
                if is_custom:
                    suggested = self.llm.generate_answer(label, self.job_context)
                else:
                    suggested = self.map_field_to_profile(label.lower())
                
                fields.append(FormField(
                    name=name,
                    field_type=field_type,
                    label=label.strip()[:100],
                    required=required,
                    locator=f"[name='{name}']" if name else f"[id='{field_id}']",
                    suggested_value=suggested,
                    is_custom_question=is_custom
                ))
            except:
                continue
        
        print(f"📋 Found {len(fields)} form fields ({sum(1 for f in fields if f.is_custom_question)} custom questions)")
        return fields
    
    def map_field_to_profile(self, label: str) -> Optional[str]:
        """Map a field label to profile data"""
        for pattern, getter in self.FIELD_MAP.items():
            if re.search(pattern, label, re.I):
                try:
                    value = getter(PROFILE)
                    if value:
                        return str(value)[:500]
                except:
                    pass
        return None
    
    async def fill_form(self, fields: List[FormField], dry_run: bool = True) -> Dict[str, Any]:
        """Fill the form fields"""
        filled = 0
        results = []
        
        for field in fields:
            if not field.suggested_value:
                results.append({
                    "field": field.label,
                    "status": "skipped",
                    "reason": "no mapping",
                    "is_custom": field.is_custom_question
                })
                continue
            
            try:
                locator = self.page.locator(field.locator).first
                
                value_preview = field.suggested_value[:60] + "..." if len(field.suggested_value) > 60 else field.suggested_value
                
                if dry_run:
                    results.append({
                        "field": field.label,
                        "status": "would_fill",
                        "value": value_preview,
                        "is_custom": field.is_custom_question
                    })
                    filled += 1
                else:
                    if field.field_type == "file":
                        results.append({"field": field.label, "status": "skipped", "reason": "file upload"})
                    elif field.field_type in ["text", "email", "tel", "url"] or field.field_type == "textarea":
                        await locator.fill(field.suggested_value)
                        filled += 1
                        results.append({
                            "field": field.label, 
                            "status": "filled", 
                            "value": value_preview,
                            "is_custom": field.is_custom_question
                        })
            except Exception as e:
                results.append({"field": field.label, "status": "error", "reason": str(e)[:50]})
        
        return {"filled": filled, "total": len(fields), "details": results}
    
    async def screenshot(self, path: str):
        """Take screenshot"""
        await self.page.screenshot(path=path, full_page=True)
        print(f"📸 Screenshot saved: {path}")


async def test_apply_flow(job_url: str, dry_run: bool = True, gemini_api_key: Optional[str] = None):
    """Test the apply flow on a real job posting"""
    agent = ApplyAgent(gemini_api_key)
    
    print("=" * 60)
    print(f"🎯 Testing Apply Flow with LLM")
    print(f"   URL: {job_url[:60]}...")
    print(f"   Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"   LLM: {'✅ Available' if agent.llm.model else '⚠️ Template Mode'}")
    print("=" * 60)
    
    try:
        await agent.start(headless=False)
        
        # Step 1: Navigate
        if not await agent.navigate_to_job(job_url):
            return {"success": False, "error": "Failed to load page"}
        
        # Step 2: Detect ATS
        ats = await agent.detect_ats()
        
        # Step 3: Find and click apply
        clicked = await agent.click_apply()
        if not clicked:
            print("ℹ️ Checking if already on apply form...")
        
        await agent.page.wait_for_timeout(2000)
        
        # Step 4: Detect form fields
        fields = await agent.detect_form_fields()
        
        # Step 5: Fill form (dry run)
        result = await agent.fill_form(fields, dry_run=dry_run)
        
        # Step 6: Screenshot
        screenshot_path = "/tmp/apply_test_llm.png"
        await agent.screenshot(screenshot_path)
        
        # Report
        print("\n" + "=" * 60)
        print("📊 APPLY REPORT")
        print("=" * 60)
        print(f"Job: {agent.job_context.title[:50]}...")
        print(f"Company: {agent.job_context.company}")
        print(f"ATS: {ats or 'Unknown'}")
        print(f"Fields Found: {len(fields)}")
        print(f"Fields Mappable: {result['filled']}")
        print(f"\nField Details:")
        for detail in result["details"]:
            status_icon = {"would_fill": "✅", "filled": "✅", "skipped": "⏭️", "error": "❌"}.get(detail["status"], "❓")
            custom_tag = "🤖" if detail.get("is_custom") else ""
            print(f"  {status_icon}{custom_tag} {detail['field'][:30]}: {detail.get('value', detail.get('reason', ''))[:50]}")
        
        # Show generated cover letter sample
        print("\n📝 Sample Cover Letter:")
        print("-" * 40)
        cover_letter = agent.llm.generate_cover_letter(agent.job_context)
        print(cover_letter[:500] + "...")
        
        return {
            "success": True,
            "ats": ats,
            "fields": len(fields),
            "mappable": result["filled"],
            "screenshot": screenshot_path,
            "job_context": agent.job_context
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    
    finally:
        await agent.stop()


if __name__ == "__main__":
    import sys
    
    # Get API key from environment or command line
    api_key = os.getenv("GEMINI_API_KEY")
    if len(sys.argv) > 1 and sys.argv[1].startswith("AIza"):
        api_key = sys.argv[1]
    
    # Test with a Web3 job
    test_url = "https://web3.career/backend-integrations-engineer-yield-xyz/144241"
    
    asyncio.run(test_apply_flow(test_url, dry_run=True, gemini_api_key=api_key))
