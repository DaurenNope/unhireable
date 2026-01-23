# 🎯 MVP Gaps: What's Needed to Make It Actually Useful

## 🔥 Critical (Do These First)

### 1. **Saved Searches + Alerts** ⏰
**Status**: Not implemented  
**Why**: Users need passive job discovery, not manual scraping every time.

**What's needed**:
- Database table: `saved_searches` (query, filters, sources, min_match_score, alert_frequency)
- Background scheduler to run saved searches periodically
- Desktop notifications when new high-match jobs appear
- UI to create/edit saved searches in Settings
- Alert frequency options: hourly, daily, weekly

**Impact**: 🔥🔥🔥 **HIGHEST** - This is the difference between "tool I check sometimes" vs "intelligent assistant"

---

### 2. **More Reliable Scraping Sources** 📡
**Status**: Partial - Remotive, RemoteOK, Wellfound, Greenhouse work. Others are flaky.

**Current working**:
- ✅ Remotive (API-friendly)
- ✅ RemoteOK (API-friendly)
- ✅ Wellfound (HTML scraping)
- ✅ Greenhouse public boards (API)

**Needs fixing/adding**:
- ❌ hh.kz (unreliable)
- ❌ WeWorkRemotely (403 errors)
- ❌ Remote.co (403 errors)
- ❌ LinkedIn (disabled by default, high risk)

**New sources to add**:
- **Stack Overflow Jobs** (API available)
- **GitHub Jobs** (RSS feed)
- **Indeed** (if API access possible, or careful scraping)
- **FlexJobs** (if API available)
- **Dice** (if API available)
- **AngelList** (Wellfound, but check for additional endpoints)

**Impact**: 🔥🔥 **HIGH** - More sources = more opportunities = more value

---

### 3. **Background Scheduler** ⏱️
**Status**: Manual scraping only  
**Why**: Users shouldn't have to remember to scrape. It should happen automatically.

**What's needed**:
- Tauri background task scheduler
- Run saved searches on schedule (hourly/daily)
- Auto-scrape new jobs and match them
- Send notifications for new matches
- Quiet hours (no notifications during sleep)

**Impact**: 🔥🔥🔥 **HIGHEST** - Makes the app "set it and forget it"

---

### 4. **Desktop Notifications** 🔔
**Status**: Not implemented  
**Why**: Users need to know when new matches arrive without opening the app.

**What's needed**:
- Tauri notification API integration
- Notify on new high-match jobs
- Click notification → opens job in app
- Notification settings (quiet hours, frequency limits)
- Badge count on app icon (if supported)

**Impact**: 🔥🔥 **HIGH** - Critical for passive discovery

---

## 🟡 Important (Do These Next)

### 5. **Better Skill Extraction** 🧠
**Status**: Basic - still extracts generic terms like "api"  
**Why**: Match scores are only as good as the skill data.

**What's needed**:
- Expand canonical skill list (currently basic)
- Better synonym mapping (e.g., "JS" → "JavaScript", "React.js" → "React")
- Filter out generic terms ("api", "team", "communication")
- Extract frameworks, tools, languages separately
- Industry-specific skills (e.g., "fintech", "healthcare")

**Impact**: 🟡🟡 **MEDIUM-HIGH** - Better matches = better user experience

---

### 6. **Application Status Tracking via Email** 📧
**Status**: Email config exists but not integrated  
**Why**: Many jobs only provide email contacts. Need to track responses.

**What's needed**:
- Email parsing to detect application responses
- Auto-update application status (interview scheduled, rejected, etc.)
- Link email threads to applications
- Extract interview dates/times from emails
- Auto-create interview records

**Impact**: 🟡🟡 **MEDIUM-HIGH** - Saves manual tracking work

---

### 7. **Better Deduplication** 🔄
**Status**: Basic URL-based deduplication  
**Why**: Same job posted on multiple boards = duplicate entries.

**What's needed**:
- Fuzzy matching on title + company
- Normalize company names (e.g., "Acme Inc" vs "Acme, Inc.")
- Merge duplicate jobs (keep best source, combine data)
- Show "Also posted on: [sources]" badge

**Impact**: 🟡 **MEDIUM** - Cleaner data = better UX

---

### 8. **Onboarding Flow** 🚀
**Status**: Basic - no guided setup  
**Why**: First-time users don't know where to start.

**What's needed**:
- Welcome wizard: "Let's set up your profile"
- Guided profile creation (skills, experience, preferences)
- First scrape tutorial
- Sample saved search creation
- "Quick wins" showcase (show 3 high-match jobs immediately)

**Impact**: 🟡 **MEDIUM** - Better first impression = more engaged users

---

## 🟢 Nice to Have (Polish Later)

### 9. **Application Automation Improvements** 🤖
**Status**: Partial - works for simple forms, struggles with dynamic questions  
**Why**: Still requires manual work for complex applications.

**What's needed**:
- Better handling of Workable dynamic questions
- Deal-breaker detection (e.g., "Are you fluent in Polish?")
- Pre-filter jobs with deal-breakers before applying
- Better iframe handling
- Multi-step form navigation improvements

**Impact**: 🟢 **LOW-MEDIUM** - Nice but not critical for MVP

---

### 10. **Export/Import Data** 💾
**Status**: Not implemented  
**Why**: Users want to backup their data or migrate.

**What's needed**:
- Export jobs/applications to CSV/JSON
- Import jobs from CSV
- Backup/restore database
- Export market insights as PDF

**Impact**: 🟢 **LOW** - Nice for power users

---

### 11. **Better Market Insights** 📊
**Status**: Basic - shows trending skills, roles, companies  
**Why**: More actionable insights = more value.

**What's needed**:
- Salary trends over time
- Location heatmaps
- Company hiring velocity (who's hiring fast?)
- Skill demand forecasting
- "Skills to learn" with learning resources

**Impact**: 🟢 **LOW** - Nice but not critical

---

### 12. **Performance Optimizations** ⚡
**Status**: Works but could be faster  
**Why**: Large job databases = slow queries.

**What's needed**:
- Database indexes on common queries (match_score, created_at, source)
- Pagination for job lists
- Virtual scrolling for large lists
- Background job processing
- Cache market insights

**Impact**: 🟢 **LOW** - Only matters at scale

---

## 📋 Recommended Implementation Order

### Phase 1: Core Automation (Week 1-2)
1. ✅ Saved Searches + Alerts
2. ✅ Background Scheduler
3. ✅ Desktop Notifications

**Result**: App becomes "set it and forget it" - users get passive job discovery.

### Phase 2: Data Quality (Week 3)
4. ✅ Better Skill Extraction
5. ✅ Better Deduplication
6. ✅ Add 2-3 more reliable scraping sources

**Result**: Better matches, cleaner data, more opportunities.

### Phase 3: User Experience (Week 4)
7. ✅ Onboarding Flow
8. ✅ Email Integration (if time)
9. ✅ Polish UI/UX based on usage

**Result**: Better first impression, easier to use.

---

## 🎯 Success Metrics

**MVP is "actually useful" when**:
- ✅ Users can set up saved searches and get notified automatically
- ✅ App runs in background without user intervention
- ✅ Users find 5+ high-match jobs per week passively
- ✅ Match scores are accurate (80%+ matches are actually relevant)
- ✅ Data is clean (no duplicates, good parsing)

**Current state**: ~40% there. Need saved searches + scheduler + notifications to hit MVP.

