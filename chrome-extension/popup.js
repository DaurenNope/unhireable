// Unhireable Auto-Apply Extension - Popup Script

const ATS_CONFIG = {
  ashby: {
    name: "Ashby ATS",
    pattern: /jobs\.ashbyhq\.com|\.ashbyhq\.com/i,
  },
  greenhouse: {
    name: "Greenhouse",
    pattern: /boards\.greenhouse\.io/i,
  },
  lever: {
    name: "Lever",
    pattern: /jobs\.lever\.co|\.lever\.co/i,
  },
  linkedin: {
    name: "LinkedIn Easy Apply",
    pattern: /linkedin\.com\/jobs/i,
  },
  workday: {
    name: "Workday",
    pattern: /\.myworkdayjobs\.com|\.workday\.com\/.*\/job\//i,
  },
  icims: {
    name: "iCIMS",
    pattern: /\.icims\.com/i,
  },
  smartrecruiters: {
    name: "SmartRecruiters",
    pattern: /\.smartrecruiters\.com/i,
  },
  bamboohr: {
    name: "BambooHR",
    pattern: /\.bamboohr\.com/i,
  },
  jazz: {
    name: "JazzHR",
    pattern: /\.jazz\.co/i,
  },
  jobvite: {
    name: "Jobvite",
    pattern: /\.jobvite\.com/i,
  },
  breezy: {
    name: "Breezy HR",
    pattern: /\.breezy\.hr/i,
  },
  applytojob: {
    name: "ApplyToJob",
    pattern: /\.applytojob\.com/i,
  },
  recruitee: {
    name: "Recruitee",
    pattern: /\.recruitee\.com/i,
  },
};

function isConnectionError(err) {
  const msg = err?.message || "";
  return (
    msg.includes("Receiving end does not exist") ||
    msg.includes("Could not establish connection")
  );
}

function connectionErrorHint() {
  return "Refresh the LinkedIn page and try again.";
}

function setupSettingsExpand() {
  const toggle = document.getElementById("settingsToggle");
  const panel = document.getElementById("settingsPanel");
  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      panel.classList.toggle("open");
      toggle.querySelector("span").textContent = panel.classList.contains("open") ? "▼" : "▶";
    });
  }
}

/** Cache key used by smart-answers (must match smart-answers.js) */
function getAnswerCacheKey() {
  return "answerCache_default"; // persona-scoped; popup uses default
}

/** One-time migration: copy legacy answerCache → answerCache_default */
async function migrateAnswerCacheIfNeeded() {
  const cacheKey = getAnswerCacheKey();
  const { answerCache, [cacheKey]: currentCache } =
    await chrome.storage.local.get(["answerCache", cacheKey]);
  if (
    answerCache &&
    Object.keys(answerCache).length > 0 &&
    (!currentCache || Object.keys(currentCache).length === 0)
  ) {
    await chrome.storage.local.set({ [cacheKey]: answerCache });
    await chrome.storage.local.remove(["answerCache"]);
  }
}

/** Try to inject content scripts when they're missing (e.g. after SPA navigation). */
async function injectContentScripts(tabId, isLinkedIn) {
  const files = [
    "content-scripts/logger.js",
    "content-scripts/smart-answers.js",
    "content-scripts/universal-filler.js",
  ];
  if (isLinkedIn) {
    files.push("content-scripts/linkedin.js");
  }
  await chrome.scripting.executeScript({ target: { tabId }, files });
}

// DOM Elements (some may be null in simplified UI)
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const profileSummary = document.getElementById("profileSummary");
const fillBtn = document.getElementById("fillBtn");
const scoutBtn = document.getElementById("scoutBtn");
const autoSubmitToggle = document.getElementById("autoSubmitToggle");
const settingsBtn = document.getElementById("settingsBtn");
const successMessage = document.getElementById("toast") || document.getElementById("successMessage");

let currentAts = null;
let userProfile = null;
let currentPageContext = {
  ats: null,
  isKnownATS: false,
  isLikelyJobPage: false,
  isLikelyApplicationPage: false,
  title: null,
  company: null,
  location: null,
  url: null,
  source: null,
  confidence: "low",
  signals: {},
  mode: "unknown",
};

// Initialize popup
async function init() {
  await migrateAnswerCacheIfNeeded();
  await loadProfile();
  await checkCurrentPage();
  await loadSettings();
  if (typeof updateMaturityUI === "function") updateMaturityUI();
  setupSettingsExpand();
  setupEventListeners();
}

async function updateMaturityUI() {
  try {
    const maturity = await chrome.runtime.sendMessage({
      action: "getMaturity",
    });
    if (!maturity) return;
    const badge = document.getElementById("maturityBadge");
    if (!badge) return;
    const dailyLimit = document.getElementById("shieldDailyLimit");
    const accountAge = document.getElementById("shieldAccountAge");
    const fillBtn = document.getElementById("fillBtn");

    if (badge) badge.textContent = `${maturity.status} (Lvl ${maturity.level})`;
    if (dailyLimit)
      dailyLimit.textContent = `${maturity.count}/${maturity.limit}`;
    if (accountAge) accountAge.textContent = `${maturity.ageDays}d`;

    // Safety enforcement: disable fill button if limit reached
    if (maturity.count >= maturity.limit && fillBtn) {
      fillBtn.disabled = true;
      fillBtn.textContent = "❌ Daily Limit Reached";
      fillBtn.title =
        "Safety first! You have reached your human-mimicry limit for today.";
    }
  } catch (err) {
    console.warn("Maturity engine offline");
  }
}

// Load user profile from storage
async function loadProfile() {
  try {
    const result = await chrome.storage.local.get(["userProfile"]);
    if (result.userProfile) {
      userProfile = result.userProfile;
      displayProfile();
      if (currentPageContext) {
        applyPageState(currentPageContext);
      }
  } else {
    if (profileSummary) profileSummary.textContent = "No profile — click Edit";
  }
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

// Display profile in popup
function displayProfile() {
  if (!userProfile?.personal_info) return;
  if (profileSummary) {
    profileSummary.textContent =
      userProfile.personal_info.name ||
      userProfile.personal_info.email ||
      "Profile set";
  }
  if (currentPageContext) applyPageState(currentPageContext);
}

function getCurrentTabUrlHost(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return "";
  }
}

function findKnownAts(url) {
  for (const [ats, config] of Object.entries(ATS_CONFIG)) {
    if (config.pattern.test(url)) {
      return {
        ats,
        name: config.name,
      };
    }
  }
  return null;
}

async function scanCurrentPageUniversally(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const safeText = (value) =>
        typeof value === "string" ? value.trim() : "";
      const clamp = (value, max = 500) => safeText(value).slice(0, max);

      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      );
      let jobPosting = null;

      for (const script of scripts) {
        try {
          const parsed = JSON.parse(script.textContent || "null");
          const items = Array.isArray(parsed) ? parsed : [parsed];
          const found = items.find(
            (item) =>
              item &&
              (item["@type"] === "JobPosting" ||
                (Array.isArray(item["@type"]) &&
                  item["@type"].includes("JobPosting")) ||
                (typeof item["@type"] === "string" &&
                  item["@type"].includes("JobPosting"))),
          );
          if (found) {
            jobPosting = found;
            break;
          }
        } catch (_) {}
      }

      const ogTitle =
        document.querySelector('meta[property="og:title"]')?.content || "";
      const ogDescription =
        document.querySelector('meta[property="og:description"]')?.content ||
        "";
      const titleEl =
        document.querySelector("h1") ||
        document.querySelector('[data-testid*="job"] h1') ||
        document.querySelector("main h1");
      const bodyText = document.body?.innerText?.slice(0, 12000) || "";
      const lowerBody = bodyText.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      const forms = Array.from(document.querySelectorAll("form"));
      const applyButtons = Array.from(
        document.querySelectorAll('button, a, input[type="submit"]'),
      )
        .map((el) => (el.innerText || el.value || "").trim())
        .filter(Boolean);

      const hasApplyButton = applyButtons.some((text) =>
        /apply|submit application|easy apply|continue application|start application/i.test(
          text,
        ),
      );

      const hasJobPathSignal =
        /\/jobs?\//i.test(path) ||
        /\/careers?\//i.test(path) ||
        /\/positions?\//i.test(path) ||
        /\/job\//i.test(path) ||
        /\/apply/i.test(path);

      const hasJobTextSignal =
        /job description|responsibilities|requirements|qualifications|about the role|about the job/i.test(
          lowerBody,
        );

      const hasApplicationTextSignal =
        /submit application|application form|equal opportunity employer|upload resume|attach resume|cv|cover letter/i.test(
          lowerBody,
        );

      const companyFromLd =
        jobPosting?.hiringOrganization?.name ||
        jobPosting?.organization?.name ||
        "";

      const locationFromLd =
        jobPosting?.jobLocation?.address?.addressLocality ||
        jobPosting?.applicantLocationRequirements?.name ||
        "";

      const title =
        clamp(jobPosting?.title, 200) ||
        clamp(titleEl?.textContent, 200) ||
        clamp(ogTitle || document.title, 200);

      const company =
        clamp(companyFromLd, 200) ||
        clamp(document.querySelector('[class*="company"]')?.textContent, 200) ||
        "";

      const location =
        clamp(locationFromLd, 200) ||
        clamp(
          document.querySelector('[class*="location"]')?.textContent,
          200,
        ) ||
        "";

      let confidence = "low";
      let signalCount = 0;
      if (jobPosting) signalCount += 3;
      if (forms.length > 0) signalCount += 1;
      if (hasApplyButton) signalCount += 1;
      if (hasJobPathSignal) signalCount += 1;
      if (hasJobTextSignal) signalCount += 1;
      if (hasApplicationTextSignal) signalCount += 1;
      if (ogTitle || ogDescription) signalCount += 1;

      if (signalCount >= 5) confidence = "high";
      else if (signalCount >= 3) confidence = "medium";

      const isLikelyJobPage =
        !!jobPosting ||
        hasJobPathSignal ||
        hasJobTextSignal ||
        /job|career|position|opening|role/i.test((title || "").toLowerCase());

      const isLikelyApplicationPage =
        forms.length > 0 &&
        (hasApplyButton || hasApplicationTextSignal || !!jobPosting);

      return {
        isKnownATS: false,
        atsType: null,
        isLikelyJobPage,
        isLikelyApplicationPage,
        title: title || null,
        company: company || null,
        location: location || null,
        url: window.location.href,
        source: window.location.hostname,
        confidence,
        signals: {
          jsonLdJobPosting: !!jobPosting,
          openGraph: !!(ogTitle || ogDescription),
          formPresent: forms.length > 0,
          applyButtonPresent: hasApplyButton,
          jobPathSignal: hasJobPathSignal,
          jobTextSignal: hasJobTextSignal,
          applicationTextSignal: hasApplicationTextSignal,
        },
      };
    },
  });

  return result;
}

function setFillButtonLabel(text) {
  const fillLabel = fillBtn?.querySelector("span:last-child");
  if (fillLabel) fillLabel.textContent = text;
}

function setScoutButtonLabel(text) {
  const scoutLabel = scoutBtn?.querySelector("span:last-child");
  if (scoutLabel) scoutLabel.textContent = text;
}

function applyPageState(context) {
  currentPageContext = context;

  const hasProfile = !!userProfile;
  const justApplyBtn = document.getElementById("justApplyBtn");

  if (context.isKnownATS) {
    currentAts = context.ats;
    updateStatus(true, "Ready", ATS_CONFIG[context.ats]?.name || "Supported ATS");
    if (fillBtn) {
      fillBtn.disabled = !hasProfile;
      fillBtn.title = hasProfile ? "" : "Complete your profile first";
    }
    if (justApplyBtn) {
      justApplyBtn.style.display = context.ats === "linkedin" ? "flex" : "none";
      justApplyBtn.disabled = !hasProfile;
    }
    setFillButtonLabel(context.ats === "linkedin" ? "Apply to this job" : "Fill form");
    setScoutButtonLabel(context.ats === "linkedin" ? "Scout jobs" : "Scan page");
    return;
  }

  currentAts = null;
  if (justApplyBtn) {
    justApplyBtn.style.display = "none";
    justApplyBtn.disabled = true;
  }

  if (context.isLikelyApplicationPage) {
    updateStatus(true, "Universal mode", "Likely application page");
    if (fillBtn) {
      fillBtn.disabled = !hasProfile;
      fillBtn.title = hasProfile ? "" : "Complete your profile first";
    }
    setFillButtonLabel("Try fill");
    setScoutButtonLabel("Scan page");
    return;
  }

  if (context.isLikelyJobPage) {
    updateStatus(true, "Job page", "Universal mode");
    if (fillBtn) {
      fillBtn.disabled = true;
      fillBtn.title = "Open the application form first";
    }
    setFillButtonLabel("Apply to this job");
    setScoutButtonLabel("Scout jobs");
    return;
  }

  updateStatus(false, "No job page", "Open a job application");
  if (fillBtn) {
    fillBtn.disabled = true;
    fillBtn.title = "Open a job application page first";
  }
  setFillButtonLabel("Apply to this job");
  setScoutButtonLabel("Scout jobs");
}

// Check current tab for ATS
async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab?.url) {
      applyPageState({
        ats: null,
        isKnownATS: false,
        isLikelyJobPage: false,
        isLikelyApplicationPage: false,
        title: null,
        company: null,
        location: null,
        url: null,
        source: null,
        confidence: "low",
        signals: {},
        mode: "unknown",
      });
      return;
    }

    const knownAts = findKnownAts(tab.url);
    if (knownAts) {
      applyPageState({
        ats: knownAts.ats,
        isKnownATS: true,
        isLikelyJobPage: true,
        isLikelyApplicationPage: true,
        title: null,
        company: null,
        location: null,
        url: tab.url,
        source: getCurrentTabUrlHost(tab.url),
        confidence: "high",
        signals: {
          knownATS: true,
        },
        mode: "known_ats",
      });
      return;
    }

    const scanned = await scanCurrentPageUniversally(tab.id);

    applyPageState({
      ats: null,
      isKnownATS: false,
      isLikelyJobPage: !!scanned?.isLikelyJobPage,
      isLikelyApplicationPage: !!scanned?.isLikelyApplicationPage,
      title: scanned?.title || null,
      company: scanned?.company || null,
      location: scanned?.location || null,
      url: scanned?.url || tab.url,
      source: scanned?.source || getCurrentTabUrlHost(tab.url),
      confidence: scanned?.confidence || "low",
      signals: scanned?.signals || {},
      mode: scanned?.isLikelyApplicationPage
        ? "universal_application"
        : scanned?.isLikelyJobPage
          ? "universal_job"
          : "unknown",
    });
  } catch (err) {
    console.error("Failed to check page:", err);
    updateStatus(false, "Error checking page", "Try refreshing the page");
    if (fillBtn) fillBtn.disabled = true;
  }
}

// Update status display
function updateStatus(active, text, atsLabel = null) {
  if (statusDot) statusDot.classList.toggle("inactive", !active);
  if (statusText) statusText.textContent = atsLabel ? `${text} · ${atsLabel}` : text;
}

// Load settings
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(["autoSubmit", "humanMode"]);
    if (autoSubmitToggle) autoSubmitToggle.checked = result.autoSubmit || false;
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

// Set user's profile (Dauren - comprehensive for tailored resume generation)
async function setTestProfile() {
  const masterProfile = {
    personal_info: {
      name: "Dauren Nox",
      email: "dauren@rahmetlabs.com",
      phone: "+1 (818) 555-0100",
      location: "Los Angeles, California",
      linkedin_url: "https://www.linkedin.com/in/dauren-nox",
      github_url: "https://github.com/daurenm",
      portfolio_url: "https://dauren-nox.netlify.app",
      requires_sponsorship: false,
      willing_to_relocate: true,
      years_experience: "5",
      salary_expectation: "5000",
    },
    title: "Founder @ Rahmet Labs | AI Automation | Full-Stack Engineer",
    titles: [
      "Full Stack Engineer",
      "Software Engineer",
      "AI/ML Engineer",
      "Blockchain Developer",
      "Automation Engineer",
    ],
    summary:
      "Founder and Full-Stack Engineer with 5+ years experience building AI automation systems, blockchain solutions, and full-stack applications. Delivered 30+ automation systems and 20+ websites/apps for enterprises. Strong background in Web3, smart contracts, and product management. Advised leading bank on $500K crypto portfolio. Launched NFT diploma project for major Central Asian university.",
    skills: [
      "Python",
      "TypeScript",
      "JavaScript",
      "React",
      "Node.js",
      "Solidity",
      "Smart Contracts",
      "Web3",
      "AI/ML",
      "Automation",
      "PostgreSQL",
      "Redis",
      "Docker",
      "AWS",
      "FastAPI",
      "Django",
      "Next.js",
    ],
    experience: [
      {
        company: "Rahmet Labs",
        role: "Founder",
        duration: "Feb 2024 - Present",
        highlights: [
          "Built Leadiya - AI-powered sales automation platform",
          "Built Unhireable - AI job matching and auto-apply system",
          "Delivered 30+ automation systems and 20+ websites/apps for enterprises",
        ],
      },
      {
        company: "Zorox Labs",
        role: "Founder & Product Manager",
        duration: "Jul 2021 - Feb 2024",
        highlights: [
          "Led 6-person team in blockchain consultancy",
          "Managed early-stage crypto project investments",
          "Developed automation scripts for blockchain research",
        ],
      },
      {
        company: "EYEQ DAO",
        role: "Full Stack Engineer",
        duration: "Nov 2022 - Mar 2023",
        highlights: [
          "Developed secure Solidity smart contracts",
          "Led front-end development",
          "Provided strategic technical insights",
        ],
      },
    ],
    education: {
      school: "California State University, Northridge",
      degree: "Bachelor's in Computational Science",
      graduation_year: 2020,
    },
    certifications: [
      "Solidity Development - freeCodeCamp",
      "ConsenSys Academy Blockchain Developer Program",
      "Google Project Management Certificate",
      "PMI Risk Management Professional (PMI-RMP)",
    ],
    languages: [
      { language: "English", proficiency: "Native" },
      { language: "Russian", proficiency: "Native" },
      { language: "Mandarin", proficiency: "Limited working" },
    ],
  };

  await chrome.storage.local.set({ userProfile: masterProfile });
  userProfile = masterProfile;
  displayProfile();

  if (currentAts) {
    fillBtn.disabled = false;
  }

  successMessage.textContent = "✅ Your profile loaded!";
  successMessage.classList.add("show");
  setTimeout(() => successMessage.classList.remove("show"), 2000);
}

// Load real profile from Unhireable backend API
async function loadRealProfile() {
  try {
    // Try to fetch from backend API
    const response = await fetch("http://localhost:3030/api/profile");

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.data) {
      const profile = result.data;
      const stored = await chrome.storage.local.get(["userProfile"]);
      const storedMessaging = stored.userProfile?.personal_info?.messaging;

      // Normalize the profile structure for the extension (preserve messaging from popup if backend lacks it)
      const normalizedProfile = {
        personal_info: {
          ...(profile.personal_info || {}),
          ...(storedMessaging && { messaging: storedMessaging }),
        },
        summary: profile.summary || "",
        skills: Array.isArray(profile.skills)
          ? profile.skills
          : profile.skills?.technical_skills || [],
        experience: profile.experience || [],
        resume_text: profile.resume_text || profile.resume_content || null,
      };

      await chrome.storage.local.set({ userProfile: normalizedProfile });
      userProfile = normalizedProfile;
      displayProfile();

      if (currentAts) {
        fillBtn.disabled = false;
      }

      successMessage.textContent = `✅ Loaded: ${normalizedProfile.personal_info?.name || "Profile"}`;
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2000);
    } else {
      successMessage.textContent = "⚠️ No profile found in backend";
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2000);
    }
  } catch (err) {
    console.error("Failed to load profile from API:", err);
    successMessage.textContent = "❌ Backend API not running";
    successMessage.classList.add("show");
    setTimeout(() => successMessage.classList.remove("show"), 2000);
  }
}

// Save schedule config to storage (triggers background.js alarm re-registration)
async function saveScheduleConfig() {
  const config = {
    enabled: document.getElementById("scheduleEnabledToggle")?.checked || false,
    intervalHours: parseInt(
      document.getElementById("scanFrequency")?.value || "4",
    ),
    dailyLimit: parseInt(
      document.getElementById("dailyLimitSelect")?.value || "25",
    ),
    activeHoursStart: parseInt(
      document.getElementById("activeHoursStart")?.value || "9",
    ),
    activeHoursEnd: parseInt(
      document.getElementById("activeHoursEnd")?.value || "17",
    ),
  };
  await chrome.storage.local.set({ scheduleConfig: config });
  console.log("[Popup] Schedule config saved:", config);
}

/** Scout Mode: Trigger autonomous discovery on LinkedIn */
async function handleScout() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab?.url) {
    successMessage.textContent = "❌ No active tab found";
    successMessage.classList.add("show");
    setTimeout(() => successMessage.classList.remove("show"), 3000);
    return;
  }

  const isLinkedIn = /linkedin\.com\/jobs/i.test(tab.url);

  scoutBtn.disabled = true;
  scoutBtn.innerHTML = "<span>⏳ Scouting...</span>";

  try {
    if (isLinkedIn) {
      await injectContentScripts(tab.id, true);
      chrome.tabs.sendMessage(tab.id, { action: "startScout" }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          console.warn("LinkedIn scout failed or connection lost");
        }

        scoutBtn.disabled = false;
        scoutBtn.innerHTML =
          '<span>🔍</span><span>Scout jobs</span>';

        successMessage.textContent = "✅ Discovery batch sent!";
        successMessage.classList.add("show");
        setTimeout(() => successMessage.classList.remove("show"), 3000);
      });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-scripts/universal-scouter.js"],
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "startUniversalScout" },
      (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          console.warn("Universal scout failed or connection lost");
          successMessage.textContent = "⚠️ Could not scan this page";
        } else {
          successMessage.textContent = "✅ Page scanned successfully";
        }

        successMessage.classList.add("show");
        setTimeout(() => successMessage.classList.remove("show"), 3000);

        scoutBtn.disabled = false;
        scoutBtn.innerHTML =
          '<span>🔍</span><span>Scout jobs</span>';
      },
    );
  } catch (err) {
    console.error("Scout injection failed:", err);
    scoutBtn.disabled = false;
    scoutBtn.innerHTML = '<span>🔍</span><span>Scout jobs</span>';
  }
}

/** Universal Scout Mode: Trigger discovery on any job site */
async function handleUniversalScout() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const universalScoutBtn = document.getElementById("universalScoutBtn");
  if (!universalScoutBtn) return;
  universalScoutBtn.disabled = true;
  universalScoutBtn.innerHTML = "<span>⏳ Universal Scouting...</span>";

  try {
    // Inject universal-scouter.js dynamically
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-scripts/universal-scouter.js"],
    });

    // Trigger scouting
    chrome.tabs.sendMessage(
      tab.id,
      { action: "startUniversalScout" },
      (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          console.warn("Universal Scout failed or connection lost");
        }
        universalScoutBtn.disabled = false;
        universalScoutBtn.innerHTML =
          '<div style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span style="font-size: 16px;">🌐</span><span>Universal Scout (Any Site)</span></div>';

        successMessage.textContent = "✅ Discovery scan complete!";
        successMessage.classList.add("show");
        setTimeout(() => successMessage.classList.remove("show"), 3000);
      },
    );
  } catch (err) {
    console.error("Universal Scout injection failed:", err);
    universalScoutBtn.disabled = false;
    universalScoutBtn.innerHTML =
      '<div style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span style="font-size: 16px;">🌐</span><span>Universal Scout (Any Site)</span></div>';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Auto-fill button
  if (fillBtn) {
    fillBtn.addEventListener("click", handleFillClick);
  }
  if (scoutBtn) {
    scoutBtn.addEventListener("click", handleScout);
  }

  // Edit profile link - toggle inline editor
  const editProfileLink = document.getElementById("editProfileLink");
  const profileEditor = document.getElementById("profileEditor");
  if (editProfileLink && profileEditor) {
    editProfileLink.addEventListener("click", () => {
      const visible = profileEditor.style.display !== "none";
      profileEditor.style.display = visible ? "none" : "block";
      if (!visible && userProfile) {
        document.getElementById("inputName").value =
          userProfile.personal_info?.name || "";
        document.getElementById("inputEmail").value =
          userProfile.personal_info?.email || "";
        document.getElementById("inputPhone").value =
          userProfile.personal_info?.phone || "";
        document.getElementById("inputLocation").value =
          userProfile.personal_info?.location || "";
        document.getElementById("inputSkills").value = (
          userProfile.skills || []
        ).join(", ");
      }
    });
  }

  // Load profile from desktop app
  const loadProfileLink = document.getElementById("loadProfileLink");
  if (loadProfileLink) {
    loadProfileLink.addEventListener("click", loadRealProfile);
  }

  // Autopilot button (if present in future)
  const autopilotBtn = document.getElementById("autopilotBtn");
  const stopBtn = document.getElementById("stopAutopilotBtn");
  const autopilotStatus = document.getElementById("autopilotStatus");

  if (autopilotBtn) {
    autopilotBtn.addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.url?.includes("linkedin.com/jobs")) {
          alert("Please navigate to LinkedIn Jobs first");
          return;
        }
        if (!tab?.id) {
          alert("No active tab");
          return;
        }

        autopilotBtn.style.display = "none";
        stopBtn.style.display = "flex";
        autopilotStatus.style.display = "block";

        try {
          await chrome.tabs.sendMessage(tab.id, { action: "startAutopilot" });
        } catch (msgErr) {
          if (isConnectionError(msgErr)) {
            try {
              await injectContentScripts(tab.id, true);
              await new Promise((r) => setTimeout(r, 500));
              await chrome.tabs.sendMessage(tab.id, {
                action: "startAutopilot",
              });
            } catch (retryErr) {
              autopilotBtn.style.display = "flex";
              stopBtn.style.display = "none";
              alert(connectionErrorHint());
            }
          } else {
            throw msgErr;
          }
        }
      } catch (err) {
        console.error("Autopilot error:", err);
        autopilotBtn.style.display = "flex";
        stopBtn.style.display = "none";
        if (isConnectionError(err)) {
          alert(connectionErrorHint());
        }
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.id) return;
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "stopAutopilot" });
        } catch (msgErr) {
          if (isConnectionError(msgErr)) {
            await injectContentScripts(tab.id, true);
            await new Promise((r) => setTimeout(r, 400));
            await chrome.tabs.sendMessage(tab.id, { action: "stopAutopilot" });
          } else throw msgErr;
        }
        autopilotBtn.style.display = "flex";
        stopBtn.style.display = "none";
      } catch (err) {
        console.error("Stop error:", err);
        autopilotBtn.style.display = "flex";
        stopBtn.style.display = "none";
      }
    });
  }

  const applyMatchesBtn = document.getElementById("applyMatchesBtn");
  const scanOnlyBtn = document.getElementById("scanOnlyBtn");

  if (scanOnlyBtn) {
    scanOnlyBtn.addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.url?.includes("linkedin.com/jobs")) {
          alert("Please navigate to LinkedIn Jobs first");
          return;
        }

        scanOnlyBtn.innerHTML = "<span>🔍</span><span>Scanning...</span>";
        scanOnlyBtn.disabled = true;
        stopBtn.style.display = "flex"; // Show stop button
        autopilotStatus.style.display = "block";

        let response;
        try {
          response = await chrome.tabs.sendMessage(tab.id, {
            action: "scanOnly",
          });
        } catch (msgErr) {
          if (isConnectionError(msgErr)) {
            scanOnlyBtn.innerHTML =
              "<span>⚠️</span><span>Refresh page first</span>";
            setTimeout(() => {
              scanOnlyBtn.innerHTML =
                "<span>🔍</span><span>Scan Only (No Apply)</span>";
              scanOnlyBtn.disabled = false;
            }, 3000);
            stopBtn.style.display = "none";
            return;
          }
          throw msgErr;
        }

        if (response?.success && response.matched > 0) {
          scanOnlyBtn.innerHTML = `<span>✅</span><span>Found ${response.matched} matches</span>`;
          // Show Apply button with match count
          if (applyMatchesBtn) {
            applyMatchesBtn.style.display = "flex";
            applyMatchesBtn.innerHTML = `<span>✅</span><span>Apply to ${response.matched} Matches</span>`;
          }
        } else if (response?.success) {
          scanOnlyBtn.innerHTML =
            "<span>⚠️</span><span>No matches found</span>";
        } else {
          scanOnlyBtn.innerHTML = "<span>❌</span><span>Scan failed</span>";
        }

        stopBtn.style.display = "none"; // Hide stop button
        setTimeout(() => {
          scanOnlyBtn.innerHTML =
            "<span>🔍</span><span>Scan Only (No Apply)</span>";
          scanOnlyBtn.disabled = false;
        }, 3000);
      } catch (err) {
        console.error("Scan error:", err);
        scanOnlyBtn.innerHTML = "<span>❌</span><span>Error</span>";
        scanOnlyBtn.disabled = false;
        stopBtn.style.display = "none";
      }
    });
  }

  // Apply to previously scanned matches
  if (applyMatchesBtn) {
    applyMatchesBtn.addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        applyMatchesBtn.innerHTML = "<span>⏳</span><span>Applying...</span>";
        applyMatchesBtn.disabled = true;
        stopBtn.style.display = "flex";
        autopilotStatus.style.display = "block";

        try {
          await chrome.tabs.sendMessage(tab.id, { action: "applyToMatches" });
        } catch (msgErr) {
          if (isConnectionError(msgErr)) {
            applyMatchesBtn.innerHTML =
              "<span>⚠️</span><span>Refresh page first</span>";
            applyMatchesBtn.disabled = false;
            stopBtn.style.display = "none";
            return;
          }
          throw msgErr;
        }
      } catch (err) {
        console.error("Apply error:", err);
        applyMatchesBtn.innerHTML = "<span>❌</span><span>Error</span>";
        applyMatchesBtn.disabled = false;
        stopBtn.style.display = "none";
      }
    });
  }

  // Auto-submit toggle
  if (autoSubmitToggle) {
    autoSubmitToggle.addEventListener("change", async () => {
      await chrome.storage.local.set({ autoSubmit: autoSubmitToggle.checked });
    });
  }

  // Human mode toggle
  const humanModeToggle = document.getElementById("humanModeToggle");
  if (humanModeToggle) {
    humanModeToggle.addEventListener("change", async () => {
      await chrome.storage.local.set({ humanMode: humanModeToggle.checked });
    });
  }

  // Settings button - open Unhireable desktop app settings via API check
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      // Check if the Unhireable desktop app is running (REST API on 3030)
      // If yes, focus/notify it. If no, show a hint to the user.
      fetch("http://localhost:3030/api/health")
        .then((r) =>
          r.ok
            ? alert(
                "Unhireable is running. Open the Unhireable desktop app to access Settings.",
              )
            : alert(
                "Unhireable desktop app is not running. Please launch Unhireable first.",
              ),
        )
        .catch(() =>
          alert(
            "Unhireable desktop app is not running. Please launch Unhireable first.",
          ),
        );
    });
  }

  // Test profile button
  const testProfileBtn = document.getElementById("testProfileBtn");
  if (testProfileBtn) {
    testProfileBtn.addEventListener("click", setTestProfile);
  }

  // Test Apply This Job button - test on the currently open job
  const testApplyBtn = document.getElementById("testApplyBtn");
  if (testApplyBtn) {
    testApplyBtn.addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.url?.includes("linkedin.com/jobs")) {
          alert("Open a LinkedIn job page first!");
          return;
        }

        testApplyBtn.innerHTML = "<span>⏳</span><span>Testing...</span>";
        testApplyBtn.disabled = true;

        let response;
        try {
          response = await chrome.tabs.sendMessage(tab.id, {
            action: "testApplySingle",
          });
        } catch (msgErr) {
          if (isConnectionError(msgErr)) {
            testApplyBtn.innerHTML =
              "<span>⚠️</span><span>Refresh page first</span>";
            setTimeout(() => {
              testApplyBtn.innerHTML =
                "<span>🎯</span><span>Test Apply This Job</span>";
              testApplyBtn.disabled = false;
            }, 3000);
            return;
          }
          throw msgErr;
        }

        if (response?.success) {
          testApplyBtn.innerHTML = "<span>✅</span><span>Applied!</span>";
        } else {
          testApplyBtn.innerHTML = `<span>⚠️</span><span>${response?.error || "Manual needed"}</span>`;
        }

        setTimeout(() => {
          testApplyBtn.innerHTML =
            "<span>🎯</span><span>Test Apply This Job</span>";
          testApplyBtn.disabled = false;
        }, 3000);
      } catch (err) {
        console.error("Test apply error:", err);
        testApplyBtn.innerHTML =
          "<span>❌</span><span>Error - check console</span>";
        testApplyBtn.disabled = false;
      }
    });
  }

  // Just Apply button - triggers applyToJob on the currently open job details
  const justApplyBtn = document.getElementById("justApplyBtn");
  if (justApplyBtn) {
    justApplyBtn.addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.url?.includes("linkedin.com/jobs")) {
          alert("Open a LinkedIn job page first!");
          return;
        }

        justApplyBtn.innerHTML = "<span>⏳</span><span>Applying...</span>";
        justApplyBtn.disabled = true;

        let response;
        try {
          response = await chrome.tabs.sendMessage(tab.id, {
            action: "testApplySingle",
          });
        } catch (msgErr) {
          if (isConnectionError(msgErr)) {
            justApplyBtn.innerHTML =
              "<span>⚠️</span><span>Refresh page first</span>";
            setTimeout(() => {
              justApplyBtn.innerHTML =
                "<span>🎯</span><span>Apply to Current Job</span>";
              justApplyBtn.disabled = false;
            }, 3000);
            return;
          }
          throw msgErr;
        }

        if (response?.success) {
          justApplyBtn.innerHTML = "<span>✅</span><span>Applied!</span>";
          successMessage.textContent = "✅ Applied successfully!";
          successMessage.classList.add("show");
        } else {
          justApplyBtn.innerHTML = `<span>⚠️</span><span>${response?.error || "Manual needed"}</span>`;
        }

        setTimeout(() => {
          justApplyBtn.innerHTML =
            "<span>🎯</span><span>Apply to Current Job</span>";
          justApplyBtn.disabled = userProfile ? false : true;
          successMessage.classList.remove("show");
        }, 3000);
      } catch (err) {
        console.error("Just Apply error:", err);
        justApplyBtn.innerHTML = "<span>❌</span><span>Error</span>";
        justApplyBtn.disabled = false;
      }
    });
  }

  // Load real profile button
  const loadProfileBtn = document.getElementById("loadProfileBtn");
  if (loadProfileBtn) {
    loadProfileBtn.addEventListener("click", loadRealProfile);
  }

  // View Unknown Fields button - for debugging form fields we couldn't fill
  const viewUnknownFieldsBtn = document.getElementById("viewUnknownFieldsBtn");
  if (viewUnknownFieldsBtn) {
    // Load count on init
    chrome.storage.local.get(["unknownFieldsBacklog"], (result) => {
      const count = result.unknownFieldsBacklog?.length || 0;
      viewUnknownFieldsBtn.querySelector("span:last-child").textContent =
        `View Unknown Fields (${count})`;
    });

    viewUnknownFieldsBtn.addEventListener("click", async () => {
      const result = await chrome.storage.local.get(["unknownFieldsBacklog"]);
      const fields = result.unknownFieldsBacklog || [];

      if (fields.length === 0) {
        alert(
          'No unknown fields logged yet!\n\nRun "Test Apply This Job" on various jobs to collect field patterns.',
        );
        return;
      }

      // Format for display
      let report = `📋 Unknown Fields Backlog (${fields.length})\n\n`;
      fields.forEach((f, i) => {
        report += `${i + 1}. ${f.field.label}\n`;
        report += `   Type: ${f.field.tagName} (${f.field.type || "n/a"})\n`;
        report += `   Job: ${f.job?.company || "Unknown"}\n`;
        if (f.field.options) {
          report += `   Options: ${f.field.options.slice(0, 3).join(", ")}${f.field.options.length > 3 ? "..." : ""}\n`;
        }
        report += "\n";
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(JSON.stringify(fields, null, 2));
      alert(report + "\n✅ Full JSON copied to clipboard!");
    });
  }

  // Profile editor save
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const profileEditorEl = document.getElementById("profileEditor");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
      const newProfile = {
        personal_info: {
          name: document.getElementById("inputName")?.value?.trim() || "",
          email: document.getElementById("inputEmail")?.value?.trim() || "",
          phone: document.getElementById("inputPhone")?.value?.trim() || "",
          location: document.getElementById("inputLocation")?.value?.trim() || "",
          requires_sponsorship: false,
          willing_to_relocate: true,
        },
        summary: userProfile?.summary || "",
        skills: (document.getElementById("inputSkills")?.value || "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s),
      };

      await chrome.storage.local.set({ userProfile: newProfile });
      userProfile = newProfile;
      displayProfile();
      if (profileEditorEl) profileEditorEl.style.display = "none";

      if (currentAts || currentPageContext?.isLikelyApplicationPage) {
        if (fillBtn) fillBtn.disabled = false;
      }

      if (successMessage) {
        successMessage.textContent = "✅ Profile saved!";
        successMessage.classList.add("show");
        setTimeout(() => successMessage.classList.remove("show"), 2000);
      }
    });
  }

  // ========== LLM SETTINGS HANDLERS ==========

  const llmProviderSelect = document.getElementById("llmProviderSelect");
  const llmApiKeyInput = document.getElementById("llmApiKeyInput");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const cacheCount = document.getElementById("cacheCount");
  const viewCacheBtn = document.getElementById("viewCacheBtn");
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  const cacheViewer = document.getElementById("cacheViewer");
  const cacheList = document.getElementById("cacheList");
  const closeCacheBtn = document.getElementById("closeCacheBtn");
  // Cache elements may be null in simplified UI

  const LLM_KEYS = {
    gemini: "geminiApiKey",
    mistral: "mistralApiKey",
    groq: "groqApiKey",
  };
  const llmLocalSection = document.getElementById("llmLocalSection");
  const llmApiKeySection = document.getElementById("llmApiKeySection");
  const llmLocalUrlInput = document.getElementById("llmLocalUrlInput");
  const llmLocalModelSelect = document.getElementById("llmLocalModelSelect");
  const saveLocalLlmBtn = document.getElementById("saveLocalLlmBtn");

  function resolveProvider(result) {
    if (result.llmProvider) return result.llmProvider;
    if (result.groqApiKey) return "groq";
    if (result.geminiApiKey) return "gemini";
    if (result.unhireableProxyUrl) return "unhireable_proxy";
    return "chrome_ai"; // Default: no credentials needed
  }

  function toggleLlmSections(provider) {
    const isLocal = provider === "local";
    const isChromeAi = provider === "chrome_ai";
    const isUnhireableProxy = provider === "unhireable_proxy";
    if (llmLocalSection)
      llmLocalSection.style.display = isLocal ? "block" : "none";
    const llmProxySection = document.getElementById("llmProxySection");
    if (llmProxySection)
      llmProxySection.style.display = isUnhireableProxy ? "block" : "none";
    if (llmApiKeySection)
      llmApiKeySection.style.display =
        isLocal || isChromeAi || isUnhireableProxy ? "none" : "block";
  }

  function updateApiKeyDisplay() {
    const provider = llmProviderSelect?.value || "groq";
    const keyName = LLM_KEYS[provider];
    chrome.storage.local.get(
      [
        "llmProvider",
        "llmLocalUrl",
        "llmLocalModel",
        "unhireableProxyUrl",
        keyName,
        ...Object.values(LLM_KEYS),
      ],
      (result) => {
        const providerStored = resolveProvider(result);
        if (llmProviderSelect) llmProviderSelect.value = providerStored;
        toggleLlmSections(providerStored);
        if (providerStored === "local") {
          if (llmLocalUrlInput)
            llmLocalUrlInput.value =
              result.llmLocalUrl || "http://localhost:11434";
          if (llmLocalModelSelect)
            llmLocalModelSelect.value = result.llmLocalModel || "qwen3.5:0.8b";
        } else if (providerStored === "unhireable_proxy") {
          const proxyInput = document.getElementById("unhireableProxyUrlInput");
          if (proxyInput) proxyInput.value = result.unhireableProxyUrl || "";
        } else {
          const key = result[LLM_KEYS[providerStored]];
          if (llmApiKeyInput && key) {
            llmApiKeyInput.value = "••••••••••••••••";
            llmApiKeyInput.dataset.saved = key;
          } else if (llmApiKeyInput) {
            llmApiKeyInput.value = "";
            llmApiKeyInput.dataset.saved = "";
          }
        }
      },
    );
  }

  // Load saved provider + API key on popup open
  if (llmApiKeyInput) {
    const cacheKey = getAnswerCacheKey();
    chrome.storage.local.get(
      [
        "llmProvider",
        "llmLocalUrl",
        "llmLocalModel",
        "unhireableProxyUrl",
        "geminiApiKey",
        "mistralApiKey",
        "groqApiKey",
        cacheKey,
      ],
      (result) => {
        const cache = result[cacheKey] || {};
        const provider = resolveProvider(result);
        if (llmProviderSelect) llmProviderSelect.value = provider;
        toggleLlmSections(provider);
        if (provider === "local") {
          if (llmLocalUrlInput)
            llmLocalUrlInput.value =
              result.llmLocalUrl || "http://localhost:11434";
          if (llmLocalModelSelect)
            llmLocalModelSelect.value = result.llmLocalModel || "qwen3.5:0.8b";
        } else if (provider === "unhireable_proxy") {
          const proxyInput = document.getElementById("unhireableProxyUrlInput");
          if (proxyInput) proxyInput.value = result.unhireableProxyUrl || "";
        } else {
          const key = result[LLM_KEYS[provider]];
          if (key) {
            llmApiKeyInput.value = "••••••••••••••••";
            llmApiKeyInput.dataset.saved = key;
          }
        }
        if (cacheCount) cacheCount.textContent = Object.keys(cache).length;
      },
    );
  }

  // Provider change: toggle sections and load config when switching
  if (llmProviderSelect) {
    llmProviderSelect.addEventListener("change", async () => {
      const p = llmProviderSelect.value;
      toggleLlmSections(p);
      await chrome.storage.local.set({ llmProvider: p });
      if (p === "local" && llmLocalUrlInput && llmLocalModelSelect) {
        const r = await chrome.storage.local.get([
          "llmLocalUrl",
          "llmLocalModel",
        ]);
        llmLocalUrlInput.value = r.llmLocalUrl || "http://localhost:11434";
        llmLocalModelSelect.value = r.llmLocalModel || "qwen3.5:0.8b";
      } else if (p === "unhireable_proxy") {
        const r = await chrome.storage.local.get(["unhireableProxyUrl"]);
        const proxyInput = document.getElementById("unhireableProxyUrlInput");
        if (proxyInput) proxyInput.value = r.unhireableProxyUrl || "";
      }
    });
  }

  // Save Unhireable proxy URL
  const saveProxyUrlBtn = document.getElementById("saveProxyUrlBtn");
  const unhireableProxyUrlInput = document.getElementById("unhireableProxyUrlInput");
  if (saveProxyUrlBtn && unhireableProxyUrlInput) {
    saveProxyUrlBtn.addEventListener("click", async () => {
      const url = unhireableProxyUrlInput.value.trim();
      await chrome.storage.local.set({
        unhireableProxyUrl: url || null,
        llmProvider: "unhireable_proxy",
      });
      if (llmProviderSelect) llmProviderSelect.value = "unhireable_proxy";
      toggleLlmSections("unhireable_proxy");
      successMessage.textContent = url
        ? "✅ Proxy URL saved!"
        : "✅ Using default proxy URL";
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2000);
    });
  }

  // Save Local LLM URL + Model
  if (saveLocalLlmBtn && llmLocalUrlInput && llmLocalModelSelect) {
    saveLocalLlmBtn.addEventListener("click", async () => {
      const url = llmLocalUrlInput.value.trim() || "http://localhost:11434";
      const model = llmLocalModelSelect.value || "qwen3.5:0.8b";
      await chrome.storage.local.set({
        llmLocalUrl: url,
        llmLocalModel: model,
        llmProvider: "local",
      });
      if (llmProviderSelect) llmProviderSelect.value = "local";
      toggleLlmSections("local");
      successMessage.textContent = "✅ Local LLM saved!";
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2000);
    });
  }

  // Save API key (to provider-specific storage key)
  if (saveApiKeyBtn && llmApiKeyInput) {
    saveApiKeyBtn.addEventListener("click", async () => {
      const key = llmApiKeyInput.value.trim();
      if (!key || key.includes("•")) return;
      const provider = llmProviderSelect?.value || "groq";
      const updates = { [LLM_KEYS[provider]]: key, llmProvider: provider };
      await chrome.storage.local.set(updates);
      llmApiKeyInput.value = "••••••••••••••••";
      llmApiKeyInput.dataset.saved = key;
      successMessage.textContent = "✅ API key saved!";
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2000);
    });
  }

  // Clear masked value when user starts typing
  if (llmApiKeyInput) {
    llmApiKeyInput.addEventListener("focus", () => {
      if (llmApiKeyInput.value.includes("•")) llmApiKeyInput.value = "";
    });
  }

  // View cache
  if (viewCacheBtn && cacheList && cacheViewer) {
    viewCacheBtn.addEventListener("click", async () => {
      const cacheKey = getAnswerCacheKey();
      const store = await chrome.storage.local.get([cacheKey]);
      const answerCache = store[cacheKey] || {};
      const entries = Object.entries(answerCache);

      if (entries.length === 0) {
        cacheList.innerHTML =
          '<div style="color: #888; text-align: center; padding: 20px;">No cached answers yet</div>';
      } else {
        cacheList.innerHTML = entries
          .map(
            ([key, data]) => `
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; margin-bottom: 6px; border-radius: 6px;">
                        <div style="color: #888; margin-bottom: 4px;">${data.question || key}</div>
                        <div style="color: #22c55e; font-weight: 500;">${data.answer}</div>
                        <div style="color: #666; font-size: 10px; margin-top: 4px;">
                            Source: ${data.source} · Used: ${data.usedCount}x
                        </div>
                    </div>
                `,
          )
          .join("");
      }

      cacheViewer.style.display = "block";
    });
  }

  // Close cache viewer
  if (closeCacheBtn) {
    closeCacheBtn.addEventListener("click", () => {
      cacheViewer.style.display = "none";
    });
  }

  // Clear cache
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", async () => {
      if (confirm("Clear all cached answers? This cannot be undone.")) {
        await chrome.storage.local.set({ [getAnswerCacheKey()]: {} });
        if (cacheCount) cacheCount.textContent = "0";

        successMessage.textContent = "🗑️ Cache cleared!";
        successMessage.classList.add("show");
        setTimeout(() => successMessage.classList.remove("show"), 2000);
      }
    });
  }

  // Export cache as JSON file
  const exportCacheBtn = document.getElementById("exportCacheBtn");
  if (exportCacheBtn) {
    exportCacheBtn.addEventListener("click", async () => {
      const cacheKey = getAnswerCacheKey();
      const store = await chrome.storage.local.get([cacheKey]);
      const answerCache = store[cacheKey] || {};
      const entries = Object.entries(answerCache);

      if (entries.length === 0) {
        alert("No cached answers to export!");
        return;
      }

      // Add stats to export
      const exportData = {
        _meta: {
          exportedAt: new Date().toISOString(),
          totalEntries: entries.length,
          sources: entries.reduce((acc, [_, v]) => {
            acc[v.source || "unknown"] = (acc[v.source || "unknown"] || 0) + 1;
            return acc;
          }, {}),
        },
        answers: answerCache,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unhireable-answers-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      successMessage.textContent = `📤 Exported ${entries.length} answers!`;
      successMessage.classList.add("show");
      setTimeout(() => successMessage.classList.remove("show"), 2000);
    });
  }

  // Import cache from JSON file
  const importCacheBtn = document.getElementById("importCacheBtn");
  const importCacheFile = document.getElementById("importCacheFile");
  if (importCacheBtn && importCacheFile) {
    importCacheBtn.addEventListener("click", () => importCacheFile.click());
    importCacheFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Support both raw cache and wrapped export format
        const importedAnswers = data.answers || data;

        if (
          typeof importedAnswers !== "object" ||
          Array.isArray(importedAnswers)
        ) {
          alert("Invalid cache file format!");
          return;
        }

        // Merge with existing cache (don't overwrite)
        const cacheKey = getAnswerCacheKey();
        const store = await chrome.storage.local.get([cacheKey]);
        const answerCache = store[cacheKey] || {};
        let newCount = 0;
        for (const [key, value] of Object.entries(importedAnswers)) {
          if (key === "_meta") continue; // Skip metadata
          if (!answerCache[key]) {
            answerCache[key] = value;
            newCount++;
          }
        }

        await chrome.storage.local.set({ [cacheKey]: answerCache });
        const totalCount = Object.keys(answerCache).length;
        if (cacheCount) cacheCount.textContent = totalCount;

        successMessage.textContent = `📥 Imported ${newCount} new answers (${totalCount} total)`;
        successMessage.classList.add("show");
        setTimeout(() => successMessage.classList.remove("show"), 3000);
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to import: " + err.message);
      }
      importCacheFile.value = ""; // Reset
    });
  }
}

// Handle fill button click
async function handleFillClick() {
  if (!userProfile) return;
  const canFill =
    currentAts || currentPageContext?.isLikelyApplicationPage;
  if (!canFill) return;

  fillBtn.disabled = true;
  fillBtn.innerHTML = "<span>⏳</span><span>Applying...</span>";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      throw new Error("No active tab");
    }

    // LinkedIn: inject scripts on demand (no auto-load), then testApplySingle.
    if (currentAts === "linkedin") {
      await injectContentScripts(tab.id, true);
      await new Promise((r) => setTimeout(r, 400));

      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: "testApplySingle",
        });
      } catch (msgErr) {
        if (isConnectionError(msgErr)) {
          throw new Error(connectionErrorHint());
        }
        throw msgErr;
      }

      if (response?.success) {
        successMessage.textContent = "✅ Applied successfully!";
        successMessage.classList.add("show");
        fillBtn.innerHTML = "<span>✅</span><span>Applied!</span>";
      } else {
        const reason = response?.error || "Needs manual input";
        successMessage.textContent = `⚠️ ${reason}`;
        successMessage.classList.add("show");
        fillBtn.innerHTML = `<span>⚠️</span><span>${reason}</span>`;
      }

      setTimeout(() => {
        setFillButtonLabel("Apply to this job");
        fillBtn.innerHTML = "<span>⚡</span><span>Apply to this job</span>";
        fillBtn.disabled = false;
        successMessage.classList.remove("show");
      }, 3000);
      return;
    }

    // Other ATS or universal mode: form is visible, use fillForm.
    const settings = await chrome.storage.local.get(["humanMode"]);
    const humanMode = settings.humanMode !== false;

    const job = {
      title: currentPageContext?.title || "Position",
      company: currentPageContext?.company || null,
      location: currentPageContext?.location || null,
      url: currentPageContext?.url || tab.url,
    };

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: "fillForm",
        profile: userProfile,
        job,
        autoSubmit: autoSubmitToggle.checked,
        humanMode: humanMode,
      });
    } catch (msgErr) {
      if (isConnectionError(msgErr)) {
        try {
          await injectContentScripts(tab.id, false);
          await new Promise((r) => setTimeout(r, 400));
          response = await chrome.tabs.sendMessage(tab.id, {
            action: "fillForm",
            profile: userProfile,
            job,
            autoSubmit: autoSubmitToggle.checked,
            humanMode: humanMode,
          });
        } catch (retryErr) {
          throw new Error(connectionErrorHint());
        }
      } else {
        throw msgErr;
      }
    }

    if (response?.success || response?.received) {
      successMessage.classList.add("show");

      if (response.manual && response.manual.length > 0) {
        successMessage.innerHTML = `✅ Filled! <br><span style="font-size:11px;opacity:0.8">Manual: ${response.manual.join(", ")}</span>`;
      } else if (autoSubmitToggle.checked && response.submitted) {
        successMessage.textContent = "✅ Applied successfully!";
      } else {
        successMessage.textContent = "✅ Form filled!";
      }

      fillBtn.innerHTML = "<span>✅</span><span>Done!</span>";
      setTimeout(() => {
        const label =
          currentAts === "linkedin" ? "Apply to this job" : "Fill form";
        fillBtn.innerHTML = `<span>⚡</span><span>${label}</span>`;
        fillBtn.disabled = false;
      }, 2000);
    } else {
      fillBtn.innerHTML = "<span>❌</span><span>Failed - Try Again</span>";
      fillBtn.disabled = false;
    }
  } catch (err) {
    console.error("Fill error:", err);
    const msg = isConnectionError(err)
      ? connectionErrorHint()
      : err?.message || "Error — refresh the page and retry";
    successMessage.textContent = msg;
    successMessage.classList.add("show");
    fillBtn.innerHTML = "<span>❌</span><span>Retry</span>";
    fillBtn.disabled = false;
    setTimeout(() => successMessage.classList.remove("show"), 4000);
  }
}

// Listen for profile updates from the app
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "profileUpdated") {
    userProfile = message.profile;
    displayProfile();
    if (currentAts) {
      fillBtn.disabled = false;
    }
    sendResponse({ success: true });
  }
});

// Initialize
init();
