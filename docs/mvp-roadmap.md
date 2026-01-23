# 🚀 MVP Roadmap: Making It Actually Useful

## Current State ✅
- **Scraping**: Remotive, RemoteOK, Wellfound, Greenhouse boards
- **Matching**: Basic skill-based scoring (50% skills, 25% experience, 15% location, 10% title)
- **UI**: Beautiful redesigned Explorer + Details pages
- **Market Insights**: Trending skills, roles, companies, historical snapshots
- **Document Generation**: Resume/cover letter generation working
- **Application Tracking**: Basic CRUD for applications

---

## 🎯 Priority 1: Core Value Drivers (Week 1-2)

### 1. **Saved Searches + Alerts** 🔔
**Why**: Users need passive discovery, not manual scraping every day.

**Implementation**:
- Database table: `saved_searches` (query, filters, sources, min_match_score, alert_frequency)
- Background job checker (runs every 6-12 hours)
- Desktop notifications for new high-match jobs
- Email digest option (daily/weekly summary)
- UI: "Save this search" button in Jobs Explorer

**Impact**: 🔥 **HIGH** - Transforms from manual tool to passive intelligence system

---

### 2. **More Scraping Sources** 📡
**Why**: Current 4 sources = limited coverage. Need 10-15+ for real market visibility.

**Quick Wins** (API-friendly):
- ✅ **Stack Overflow Jobs** - Has public API
- ✅ **GitHub Jobs** - RSS feed + API
- ✅ **Indeed** - RSS feeds (limited but free)
- ✅ **AngelList/Wellfound** - Already have, expand coverage
- ✅ **Remote.co** - Simple HTML scraping
- ✅ **FlexJobs** - If API available
- ✅ **Dice** - Tech-focused, has API
- ✅ **Hired.com** - If accessible

**Medium Effort** (Browser automation):
- ⚠️ **LinkedIn** - Already scaffolded, but high-risk (needs careful rate limiting)
- ⚠️ **Glassdoor** - Requires careful handling
- ⚠️ **Monster** - HTML scraping

**Impact**: 🔥 **HIGH** - 3x-5x more job coverage = better matches

---

### 3. **Background Scheduler** ⏰
**Why**: Manual scraping is friction. Auto-updates make it "set and forget."

**Implementation**:
- Tauri background task (or system cron)
- Configurable schedule (daily at 9am, every 6 hours, etc.)
- Respects saved searches
- Quiet mode (no notifications during sleep hours)
- Status indicator in UI

**Impact**: 🔥 **HIGH** - Removes daily manual work

---

### 4. **Better Matching Algorithm** 🎯
**Why**: Current 50/25/15/10 weights are too simplistic. Need smarter scoring.

**Improvements**:
- **Skill relevance weighting**: "React" in title = 2x weight vs description
- **Must-have vs nice-to-have**: Detect required vs optional skills
- **Company reputation**: Factor in company size, funding, Glassdoor ratings (if available)
- **Salary fit**: Match user's salary expectations
- **Remote preference**: Boost remote jobs if user prefers remote
- **Application history**: Learn from what user actually applies to
- **Time-based decay**: Newer jobs get slight boost

**Impact**: 🟡 **MEDIUM-HIGH** - Better matches = less noise, more action

---

## 🎯 Priority 2: User Engagement (Week 3-4)

### 5. **Desktop Notifications** 🔔
**Why**: Users need to know when new perfect matches arrive.

**Implementation**:
- Tauri notification API
- Only for jobs above match threshold (configurable, default 70%)
- Click notification → opens job in app
- Notification settings (quiet hours, frequency limits)

**Impact**: 🟡 **MEDIUM** - Keeps users engaged without being annoying

---

### 6. **Email Digest** 📧
**Why**: Some users prefer email summaries over in-app notifications.

**Implementation**:
- Weekly digest: "15 new matches this week"
- Daily digest option for power users
- Beautiful HTML email template
- Unsubscribe/configure in Settings
- Uses existing email notification infrastructure (partially built)

**Impact**: 🟡 **MEDIUM** - Caters to different user preferences

---

### 7. **Application Success Analytics** 📊
**Why**: Users want to know what's working.

**Metrics to Track**:
- Application → Interview conversion rate
- Interview → Offer rate
- Average time to response
- Which sources lead to most interviews
- Which skills correlate with success
- Company response rates

**UI**: New "Analytics" page with charts and insights

**Impact**: 🟡 **MEDIUM** - Helps users optimize their strategy

---

## 🎯 Priority 3: Automation & Intelligence (Week 5-6)

### 8. **Smart Application Automation** 🤖
**Why**: Current automation is buggy. Need reliable form filling.

**Fixes Needed**:
- Better ATS detection (Workable, Greenhouse, Lever, etc.)
- Handle dynamic forms (conditional questions)
- Resume upload + "import from resume" detection
- Multi-step flow handling (already partially done)
- Success verification (check for confirmation page/email)

**Impact**: 🔥 **HIGH** - Saves hours per week if reliable

---

### 9. **Skill Gap Analysis + Learning Paths** 📚
**Why**: Users want to know what to learn next.

**Implementation**:
- Analyze missing skills from top matches
- Suggest learning resources (free courses, docs, tutorials)
- Track skill progress over time
- "Skill roadmap" page showing path to better matches

**Impact**: 🟡 **MEDIUM** - Adds educational value

---

### 10. **Job Deduplication & Updates** 🔄
**Why**: Same job appears on multiple boards. Need to merge and track updates.

**Implementation**:
- Fuzzy matching on title + company
- Merge duplicates (keep best description, all sources)
- Track job updates (salary changed, description updated, closed)
- Mark stale jobs (older than 30 days, no updates)

**Impact**: 🟡 **MEDIUM** - Cleaner data, less confusion

---

## 🎯 Priority 4: Polish & Scale (Week 7-8)

### 11. **Onboarding Flow** 🎓
**Why**: New users don't know where to start.

**Implementation**:
- Welcome wizard: "Add your skills", "Set salary range", "Choose remote preference"
- Sample data option for testing
- Quick tour of key features
- "First scrape" guided experience

**Impact**: 🟢 **LOW-MEDIUM** - Better first impression

---

### 12. **Export/Import Data** 💾
**Why**: Users want backup and portability.

**Implementation**:
- Export all data to JSON/CSV
- Import from other job trackers
- Backup/restore functionality
- Cloud sync option (future: Supabase)

**Impact**: 🟢 **LOW** - Nice to have for power users

---

### 13. **Performance Optimization** ⚡
**Why**: With 1000s of jobs, UI needs to stay snappy.

**Optimizations**:
- Virtual scrolling for job lists
- Pagination (50 jobs per page)
- Lazy loading of descriptions
- Indexed database queries
- Debounced search/filters

**Impact**: 🟡 **MEDIUM** - Critical as data grows

---

## 📊 Impact vs Effort Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Saved Searches + Alerts | 🔥 HIGH | Medium | **1** |
| More Scraping Sources | 🔥 HIGH | Low-Medium | **2** |
| Background Scheduler | 🔥 HIGH | Medium | **3** |
| Better Matching | 🟡 MEDIUM-HIGH | High | **4** |
| Desktop Notifications | 🟡 MEDIUM | Low | **5** |
| Email Digest | 🟡 MEDIUM | Medium | **6** |
| Application Analytics | 🟡 MEDIUM | Medium | **7** |
| Smart Automation | 🔥 HIGH | High | **8** |
| Skill Gap Analysis | 🟡 MEDIUM | Medium | **9** |
| Deduplication | 🟡 MEDIUM | Medium | **10** |

---

## 🎯 Recommended MVP Sprint Plan

### Sprint 1 (Week 1): Discovery Automation
- ✅ Saved searches + alerts
- ✅ Background scheduler
- ✅ Desktop notifications

**Result**: App becomes "set and forget" - users get passive job discovery

---

### Sprint 2 (Week 2): Coverage Expansion
- ✅ Add 5-7 new scraping sources (prioritize API-friendly)
- ✅ Improve deduplication
- ✅ Better error handling for failed scrapes

**Result**: 3x-5x more job coverage

---

### Sprint 3 (Week 3): Intelligence
- ✅ Better matching algorithm
- ✅ Application analytics dashboard
- ✅ Skill gap analysis

**Result**: Smarter recommendations, actionable insights

---

### Sprint 4 (Week 4): Polish
- ✅ Onboarding flow
- ✅ Performance optimization
- ✅ Bug fixes and UX improvements

**Result**: Production-ready MVP

---

## 💡 Quick Wins (Can Do Today)

1. **Add Stack Overflow Jobs** (30 min) - Has public API
2. **Add GitHub Jobs RSS** (30 min) - Simple RSS parsing
3. **Desktop notifications** (1 hour) - Tauri has built-in API
4. **Save search button** (2 hours) - UI + basic storage
5. **Better empty states** (1 hour) - More helpful messaging

---

## 🚀 What Makes It "Actually Useful"?

**The app becomes useful when:**
1. ✅ **Passive discovery** - Users don't have to manually scrape daily
2. ✅ **Broad coverage** - 10+ sources = comprehensive market view
3. ✅ **Smart filtering** - Only see relevant matches, not noise
4. ✅ **Actionable insights** - Know what to learn, what's working
5. ✅ **Time savings** - Automation handles repetitive tasks

**Current gap**: Too much manual work, too few sources, basic matching.

**After Priority 1-2**: App becomes genuinely useful for daily job hunting.

