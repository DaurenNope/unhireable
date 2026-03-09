// Unhireable Auto-Apply — Smart Answer System (v2)
// Persona-scoped caching + batched LLM calls.
//
// Usage:
//   const SA = window.UnhireableAnswers;
//   // Single field:
//   const result = await SA.getSmartAnswer(question, 'text', null, profile, job);
//   // Batch (preferred — one LLM call for all unknowns):
//   const answers = await SA.batchGetAnswers(fields, profile, job);

(function () {
  "use strict";

  // ========== CONFIG ==========
  const API_BASE_URL = "http://localhost:3030";
  const BACKEND_COOLDOWN_MS = 60_000; // Skip API calls for 60s after failure

  // Backend availability: check health first to avoid 500 cascade when server is down
  let _lastBackendError = 0;
  let _backendChecked = false;

  async function checkBackendAvailable() {
    if (
      _lastBackendError &&
      Date.now() - _lastBackendError < BACKEND_COOLDOWN_MS
    )
      return false;
    if (!_backendChecked) {
      _backendChecked = true;
      try {
        const r = await bgFetch(`${API_BASE_URL}/api/health`, {}, 1500);
        if (!r.ok) _lastBackendError = Date.now();
      } catch (_) {
        _lastBackendError = Date.now();
      }
    }
    return (
      !_lastBackendError ||
      Date.now() - _lastBackendError >= BACKEND_COOLDOWN_MS
    );
  }

  function recordBackendError() {
    _lastBackendError = Date.now();
  }

  // ========== SESSION STATS ==========
  const sessionStats = {
    started: new Date().toISOString(),
    geminiCalls: 0,
    geminiSuccesses: 0,
    geminiFails: 0,
    gemini429s: 0,
    patternMatches: 0,
    cacheHits: 0,
    batchCalls: 0,
  };

  // ========== GEMINI CIRCUIT BREAKER ==========
  const geminiCircuit = {
    consecutive429s: 0,
    isOpen: false,
    openedAt: 0,
    cooldownMs: 60000,
    maxConsecutive429s: 3,

    recordSuccess() {
      this.consecutive429s = 0;
      this.isOpen = false;
    },
    record429() {
      this.consecutive429s++;
      sessionStats.gemini429s++;
      if (this.consecutive429s >= this.maxConsecutive429s) {
        this.isOpen = true;
        this.openedAt = Date.now();
        console.warn(
          `[Unhireable] 🔴 Gemini circuit OPEN — ${this.consecutive429s} consecutive 429s`,
        );
      }
    },
    shouldSkip() {
      if (!this.isOpen) return false;
      if (Date.now() - this.openedAt > this.cooldownMs) {
        this.isOpen = false;
        this.consecutive429s = 0;
        return false;
      }
      return true;
    },
  };

  // ========== UTILITIES ==========
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function logSessionStats() {
    console.log(
      "[Unhireable] 📊 Session Stats:",
      JSON.stringify(sessionStats, null, 2),
    );
  }

  // Local LLM was removed in favor of unified bgFetch.

  async function bgFetch(url, options = {}, timeoutMs = null) {
    const safeOptions = { ...options };
    delete safeOptions.signal;

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "proxyFetch",
          url: url,
          options: safeOptions,
          timeout: timeoutMs,
        },
        (res) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!res || !res.success) {
            return reject(
              new Error(res?.error || "Unknown error from background fetch"),
            );
          }
          resolve({
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            json: async () => {
              if (typeof res.data === "string") {
                const trimmed = res.data.trim();
                if (!trimmed) return {};
                try {
                  return JSON.parse(trimmed);
                } catch (e) {
                  console.error(
                    `[Unhireable] ❌ bgFetch JSON parse failed. Raw text:`,
                    trimmed.substring(0, 500),
                  );
                  throw new Error(
                    `Invalid JSON body from server: ${trimmed.substring(0, 100)}...`,
                  );
                }
              }
              return res.data || {};
            },
            text: async () =>
              typeof res.data === "string"
                ? res.data
                : JSON.stringify(res.data),
          });
        },
      );
    });
  }

  // ========== PERSONA ==========
  let _activePersonaId = "default";

  async function getActivePersonaId() {
    try {
      const { activePersonaId } = await chrome.storage.local.get([
        "activePersonaId",
      ]);
      _activePersonaId = activePersonaId || "default";
    } catch {}
    return _activePersonaId;
  }

  function cacheStorageKey() {
    return `answerCache_${_activePersonaId}`;
  }

  // ========== CACHE KEY ==========
  function normalizeQuestion(question) {
    return question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 100);
  }

  // ========== TIER 2: PERSONA-SCOPED CACHE ==========
  async function getAnswerFromCache(question) {
    const key = normalizeQuestion(question);
    const storageKey = cacheStorageKey();
    const store = await chrome.storage.local.get([storageKey]);
    const cache = store[storageKey] || {};
    if (cache[key]) {
      console.debug(`[Unhireable] 💾 Cache hit: "${key}"`);
      cache[key].usedCount = (cache[key].usedCount || 0) + 1;
      cache[key].lastUsed = new Date().toISOString();
      await chrome.storage.local.set({ [storageKey]: cache });
      return cache[key];
    }
    // Fuzzy: find cache key that is a substring of question (or vice versa)
    const MIN_KEY_LEN = 8;
    let best = null;
    for (const cacheKey of Object.keys(cache)) {
      if (cacheKey.length < MIN_KEY_LEN) continue;
      const qContains = key.includes(cacheKey);
      const kContains = cacheKey.includes(key);
      if (qContains || kContains) {
        if (!best || cacheKey.length > best.length) best = cacheKey;
      }
    }
    if (best && cache[best]) {
      cache[best].usedCount = (cache[best].usedCount || 0) + 1;
      cache[best].lastUsed = new Date().toISOString();
      await chrome.storage.local.set({ [storageKey]: cache });
      return cache[best];
    }
    return null;
  }

  async function saveAnswerToCache(question, answer, metadata = {}) {
    const key = normalizeQuestion(question);
    const storageKey = cacheStorageKey();
    const store = await chrome.storage.local.get([storageKey]);
    const cache = store[storageKey] || {};
    cache[key] = {
      answer,
      question: question.substring(0, 200),
      fieldType: metadata.fieldType || "text",
      confidence: metadata.confidence || "medium",
      source: metadata.source || "llm",
      usedCount: 1,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [storageKey]: cache });
    console.debug(
      `[Unhireable] 💾 Saved to cache: "${key}" = "${answer.substring(0, 30)}..."`,
    );
  }

  async function saveBatchToCache(answersMap, fieldsMap) {
    const storageKey = cacheStorageKey();
    const store = await chrome.storage.local.get([storageKey]);
    const cache = store[storageKey] || {};
    for (const [fieldId, answer] of Object.entries(answersMap)) {
      const field = fieldsMap[fieldId];
      if (!field || !answer) continue;
      const key = normalizeQuestion(field.label);
      cache[key] = {
        answer,
        question: field.label.substring(0, 200),
        fieldType: field.type || "text",
        confidence: "high",
        source: "llm_batch",
        usedCount: 1,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      };
    }
    await chrome.storage.local.set({ [storageKey]: cache });
    syncToBackend().catch(() => {});
  }

  // ========== TIER 1: PATTERN MATCHING (from config) ==========
  let _patternConfig = null;

  async function loadPatternConfig() {
    if (_patternConfig) return _patternConfig;
    const personaId = await getActivePersonaId();
    if (await checkBackendAvailable()) {
      try {
        const resp = await bgFetch(
          `${API_BASE_URL}/api/answer-patterns?persona_id=${encodeURIComponent(personaId)}`,
          {},
          3000,
        );
        if (resp.ok) {
          const result = await resp.json();
          const data = result?.data;
          if (data?.patterns?.length > 0) {
            _patternConfig = data;
            return _patternConfig;
          }
        } else if (resp.status >= 500) recordBackendError();
      } catch (e) {
        recordBackendError();
      }
    }
    try {
      const url = chrome.runtime.getURL("config/answer-patterns.json");
      if (
        !url ||
        url.includes("invalid") ||
        !url.startsWith("chrome-extension://")
      ) {
        _patternConfig = { patterns: [] };
        return _patternConfig;
      }
      const resp = await bgFetch(url);
      _patternConfig = await resp.json();
    } catch (e) {
      _patternConfig = { patterns: [] };
    }
    return _patternConfig;
  }

  function invalidatePatternConfig() {
    _patternConfig = null;
  }

  function getNested(obj, path) {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((o, k) => o?.[k], obj);
  }

  function applyTransform(val, transform) {
    if (transform === "first_word") return (val || "").split(" ")[0] || "";
    if (transform === "rest_after_first")
      return (val || "").split(" ").slice(1).join(" ") || "";
    if (transform === "sponsorship_yes_no") return val ? "Yes" : "No";
    if (transform === "location_city")
      return (val || "").split(",")[0].trim() || "";
    if (transform === "location_state") {
      const parts = (val || "").split(",").map((p) => p.trim());
      return parts.length >= 2 ? parts[1] : "";
    }
    if (transform === "location_country") {
      const parts = (val || "").split(",").map((p) => p.trim());
      const last = parts[parts.length - 1] || "";
      const usStates =
        /^(CA|NY|TX|FL|WA|OR|CO|IL|MA|GA|NC|VA|AZ|OH|PA|NJ|MI|NV|MN|MO)$/i;
      if (
        usStates.test(last) ||
        /california|new york|texas|florida|washington|oregon/i.test(last)
      )
        return "United States";
      return last || "United States";
    }
    return val;
  }

  function patternMatchesLabel(pattern, label) {
    const l = label.toLowerCase();
    if (pattern.excludePatterns?.some((p) => l.includes(p.toLowerCase())))
      return false;
    const matchType = pattern.matchType || "all";
    const patterns = pattern.labelPatterns || [];
    if (matchType === "all")
      return patterns.every((p) => l.includes(p.toLowerCase()));
    return patterns.some((p) => l.includes(p.toLowerCase()));
  }

  function getFieldValueFromConfig(label, profile, config) {
    for (const p of config.patterns || []) {
      if (!patternMatchesLabel(p, label)) continue;
      if (p.source === "literal") return p.literalValue ?? "";
      if (p.source === "profile") {
        let val = getNested(profile, p.profilePath);
        if (val == null && p.fallbackPath)
          val = getNested(profile, p.fallbackPath);
        if (val == null) val = p.default;
        val = applyTransform(val, p.transform);
        if (val !== undefined && val !== null && val !== "") return String(val);
      }
    }
    return "";
  }

  function getFieldValue(label, profile, job = null) {
    if (!_patternConfig) return "";
    return getFieldValueFromConfig(label, profile, _patternConfig);
  }

  // ========== TIER 3: MULTI-PROVIDER LLM (Gemini, Mistral, Groq, Local) ==========
  // Set unhireableProxyUrl in chrome.storage.local after deploying the Worker (see docs/tech/unhireable-ai-proxy.md)
  const UNHIREABLE_PROXY_DEFAULT_URL = "https://YOUR-WORKER.workers.dev";
  const LLM_PROVIDERS = {
    unhireable_proxy: {
      name: "Unhireable Free",
      key: null,
      needsKey: false,
      url: UNHIREABLE_PROXY_DEFAULT_URL,
    },
    local: { name: "Local (Ollama/VPS)", key: "llmLocalUrl", needsKey: false },
    gemini: { name: "Gemini", key: "geminiApiKey", needsKey: true, url: null },
    mistral: {
      name: "Mistral",
      key: "mistralApiKey",
      needsKey: true,
      url: "https://api.mistral.ai/v1/chat/completions",
      model: "mistral-small-latest",
    },
    groq: {
      name: "Groq",
      key: "groqApiKey",
      needsKey: true,
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.1-8b-instant",
    },
    chrome_ai: { name: "Chrome AI (Gemini Nano)", key: null, needsKey: false },
  };

  async function ensureUserId() {
    const { userId } = await chrome.storage.local.get(["userId"]);
    if (userId && typeof userId === "string" && userId.trim()) {
      return userId;
    }

    const generated =
      globalThis.crypto?.randomUUID?.() ||
      `uh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    await chrome.storage.local.set({ userId: generated });
    return generated;
  }

  async function callLLM(prompt, provider, apiKey, extra = {}) {
    if (provider === "chrome_ai") {
      try {
        if (!window.ai || !window.ai.languageModel) {
          return {
            ok: false,
            status: 0,
            text: "",
            error:
              "Chrome AI not available. Enable in chrome://flags/#optimization-guide-on-device-model",
          };
        }
        const capabilities = await window.ai.languageModel.capabilities();
        if (capabilities.available === "no")
          return {
            ok: false,
            status: 0,
            text: "",
            error: "Chrome AI not supported on this device",
          };

        const session = await window.ai.languageModel.create({
          systemPrompt:
            "You are a professional job application assistant. Respond ONLY with raw JSON.",
        });
        const response = await session.prompt(prompt);
        session.destroy();
        return { ok: true, status: 200, text: response };
      } catch (e) {
        return { ok: false, status: 0, text: "", error: e.message };
      }
    }
    if (provider === "unhireable_proxy") {
      const userId = await ensureUserId();
      const { unhireableProxyUrl } = await chrome.storage.local.get(["unhireableProxyUrl"]);
      const baseUrl = unhireableProxyUrl || LLM_PROVIDERS.unhireable_proxy.url;
      const endpoint = `${baseUrl.replace(/\/$/, "")}/api/ai/answer-batch`;

      const resp = await bgFetch(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            fields: extra.fields || [],
            profile: extra.profile || {},
            job: extra.job || {},
          }),
        },
        15000,
      );

      const data = await resp.json();
      if (!resp.ok) {
        return {
          ok: false,
          status: resp.status,
          text: "",
          error: data?.error || "Unhireable proxy request failed",
        };
      }

      return {
        ok: true,
        status: resp.status,
        text: JSON.stringify(data?.answers || {}),
      };
    }
    if (provider === "gemini") {
      const resp = await bgFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { ok: resp.ok, status: resp.status, text };
    }
    // Local (Ollama/VPS): always via backend proxy to bypass browser CORS/Origin blocks.
    if (provider === "local") {
      const base = (extra.localUrl || "http://localhost:11434").replace(
        /\/$/,
        "",
      );
      const model = extra.localModel || "qwen3.5:2b";
      const ollamaUrl = `${base}/api/chat`;
      const body = {
        model,
        think: false,
        stream: false,
        format: "json",
        options: { num_ctx: 4096, num_predict: 2048, temperature: 0.3 },
        messages: [{ role: "user", content: prompt }],
      };

      const proxyUrl = `${API_BASE_URL}/api/proxy/ollama`;
      try {
        const resp = await bgFetch(
          proxyUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: ollamaUrl, body: body }),
          },
          300000,
        ); // 300s (5 min) timeout for slow local LLM

        if (!resp.ok) {
          const txt = await resp.text();
          return {
            ok: false,
            status: resp.status,
            text: "",
            error: `HTTP ${resp.status}: ${txt.substring(0, 100)}`,
          };
        }

        const result = await resp.json();
        // Backend wraps response in { data: ... }
        const data = result.data || result;
        const text = data?.message?.content || "";
        return { ok: true, status: resp.status, text };
      } catch (e) {
        const msg = e?.message || "Failed to fetch through proxy";
        return { ok: false, status: 0, text: "", error: msg };
      }
    }
    // Mistral, Groq: OpenAI-compatible chat completions (no CORS from content script to these APIs)
    const cfg = LLM_PROVIDERS[provider];
    const url = cfg.url;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    const body = {
      model: cfg.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    };
    const resp = await bgFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    const text =
      data.choices?.[0]?.message?.content || data.error?.message || "";
    return { ok: resp.ok, status: resp.status, text };
  }

  async function askGeminiBatch(unknowns, profile, job) {
    if (geminiCircuit.shouldSkip()) {
      console.log("[Unhireable] ⏭️ LLM circuit open — skipping batch");
      return {};
    }
    if (unknowns.length === 0) return {};

    const store = await chrome.storage.local.get([
      "llmProvider",
      "geminiApiKey",
      "mistralApiKey",
      "groqApiKey",
      "llmLocalUrl",
      "llmLocalModel",
    ]);

    // Priority logic: respect explicit provider, otherwise fall back to the best available default
    // In dev (no credentials): chrome_ai (Gemini Nano, on-device, free) works without any setup
    let provider = store.llmProvider;
    if (!provider) {
      if (store.groqApiKey) provider = "groq";
      else if (store.geminiApiKey) provider = "gemini";
      else if (store.unhireableProxyUrl) provider = "unhireable_proxy"; // Proxy URL set = Worker deployed
      else provider = "chrome_ai"; // Default in dev: no credentials needed
    }

    const cfg = LLM_PROVIDERS[provider];
    const apiKey =
      cfg.needsKey === false || !cfg.key ? "" : store[cfg.key] || "";
    if (provider === "local") {
      const url = (store.llmLocalUrl || "http://localhost:11434").trim();
      if (!url) {
        console.error(
          "[Unhireable] ❌ Local LLM URL not set. Set in popup → LLM Settings.",
        );
        return {};
      }
    } else if (cfg.needsKey !== false && (!apiKey || !apiKey.trim())) {
      console.error(
        `[Unhireable] ❌ No ${cfg.name} API key. Set in popup → LLM Settings.`,
      );
      return {};
    }

    sessionStats.geminiCalls++;
    sessionStats.batchCalls++;
    const callNum = sessionStats.geminiCalls;

    const isSmallModel =
      provider === "groq" ||
      provider === "chrome_ai" ||
      (provider === "local" && store.llmLocalModel?.includes("0.5b"));

    const fieldDescriptions = unknowns
      .map((f) => {
        let desc = `- [${f.id}] "${f.label}" (type: ${f.type})`;
        if (f.options?.length) desc += ` options: [${f.options.join(", ")}]`;
        if (f.required) desc += " [REQUIRED]";
        return desc;
      })
      .join("\n");

    // Aggressive context trimming for speed/small models
    const maxSummary = isSmallModel ? 250 : 400;
    const maxResume = isSmallModel ? 500 : 800;

    const skillsList =
      (Array.isArray(profile?.skills)
        ? profile.skills
        : profile?.skills?.technical_skills
      )
        ?.slice(0, 8)
        ?.join(", ") || "";
    const summary = (profile?.summary || "").substring(0, maxSummary);
    const resumeSnippet = (
      profile?.resume_text ||
      profile?.resume_content ||
      ""
    ).substring(0, maxResume);
    const expWithTech = (profile?.experience || [])
      .slice(0, 4)
      .map((e) => {
        const desc =
          (e.description || e.highlights || [])[0] || e.position || "";
        const tech = (e.technologies || []).slice(0, 5).join(", ");
        return `${e.company || "Role"}: ${desc}${tech ? ` [${tech}]` : ""}`.substring(
          0,
          150,
        );
      })
      .join("\n");

    const education = (profile?.education || [])
      .map(
        (edu) =>
          `${edu.degree} in ${edu.field} from ${edu.school} (${edu.graduation_year || ""})`,
      )
      .join(", ");

    const projects = (profile?.projects || [])
      .map((p) => `${p.name}: ${p.description}`)
      .join("\n");

    const certs = (profile?.certifications || []).join(", ");
    const langs = (profile?.languages || [])
      .map((l) => `${l.language} (${l.proficiency})`)
      .join(", ");

    const company = job?.company || "the company";
    const title = job?.title || "this role";
    const jobDesc = (job?.description || "").substring(0, 800);

    const prompt = `You are filling out a job application for ${company}. Write answers that sound like a real human who researched this company — never generic.

CANDIDATE PROFILE:
- Name: ${profile?.personal_info?.name || ""}
- Email: ${profile?.personal_info?.email || ""}
- Location: ${profile?.personal_info?.location || ""}
- Years Experience (total): ${profile?.personal_info?.years_experience || "5"}
- Skills: ${skillsList}
- Education: ${education}
- Certifications: ${certs}
- Languages: ${langs}
- Requires Sponsorship: ${profile?.personal_info?.requires_sponsorship ? "Yes" : "No"}
- Summary: ${summary}
${expWithTech ? `\nEXPERIENCE:\n${expWithTech}\n` : ""}
${projects ? `\nKEY PROJECTS:\n${projects}\n` : ""}
${resumeSnippet ? `\nRESUME SNIPPET:\n${resumeSnippet}\n` : ""}

JOB: ${title} at ${company}
${jobDesc ? `\nJOB DESCRIPTION:\n${jobDesc}\n` : ""}

FIELDS TO FILL:
${fieldDescriptions}

CRITICAL — AVOID GENERIC PHRASES. Never use:
- "I'm excited about this opportunity"
- "I believe my skills align well"
- "I'd welcome the opportunity to discuss"
- "I'm a motivated professional"
- "I look forward to contributing"

INSTEAD — Be specific:
- For "what interests you" / "why this role" / "why do you want to work here": Mention ${company} by name. Reference something concrete from their work, product, or mission. Connect 1–2 of the candidate's skills/experiences to this specific role. 2–3 sentences max.
- For "tell us about yourself": Lead with a specific achievement or project from their experience, then tie it to ${title} at ${company}.
- For behavioral and technical questions (e.g. "Describe a product you worked on", "Tell us about a growth experiment", "Technologies you are most proficient in", etc.): Answer substantively (2-3 sentences) using the provided experience, skills, and resume snippet. Do NOT leave these blank. Highlight relevant past projects and metrics from the candidate's profile.
- For "years in [tech]" / "experience with [X]": Derive from resume. If tech appears in experience, estimate years. Otherwise use total years or "1" if mentioned in skills.
- For radio/select: respond with EXACT text of one option
- For checkboxes about consent/terms: respond "check"
- For notice period: answer "2 weeks" unless context suggests otherwise.
- For desired salary: answer "${profile?.personal_info?.salary_expectation || "Negotiable"}"
- For gender: "Male" unless profile says otherwise
- For authorization: "Yes", relocation: "Yes"

Respond ONLY with a JSON object mapping field IDs to answers. Every field listed MUST have a corresponding answer in the JSON output, even if it is a best effort. No markdown, no explanation.
Example: {"text_0": "John Doe", "radio_1": "Male"}`;

    console.debug(
      `[Unhireable] ${cfg.name} batch #${callNum} | ${unknowns.length} fields`,
    );

    const extra =
      provider === "local"
        ? {
            localUrl: store.llmLocalUrl || "http://localhost:11434",
            localModel: store.llmLocalModel || "qwen3.5:4b",
          }
        : provider === "unhireable_proxy"
          ? { fields: unknowns, profile, job }
          : {};
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await callLLM(prompt, provider, apiKey, extra);

        if (result.status === 429) {
          geminiCircuit.record429();
          const backoff = 4000 * Math.pow(2, attempt);
          if (geminiCircuit.isOpen) return {};
          console.warn(`[Unhireable] ⏳ 429 — retry in ${backoff / 1000}s`);
          try {
            window.dispatchEvent(
              new CustomEvent("unhireable:geminiRetry", {
                detail: { backoff, attempt },
              }),
            );
          } catch (_) {}
          await sleep(backoff);
          continue;
        }

        if (!result.ok) {
          sessionStats.geminiFails++;
          const errDetail = result.error
            ? ` — ${result.error}`
            : provider === "local"
              ? ' — run: OLLAMA_ORIGINS="*" ollama serve'
              : "";
          console.error(
            `[Unhireable] ❌ ${cfg.name} ${result.status}${errDetail}`,
          );
          return {};
        }

        const clean = result.text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        let answers;
        try {
          answers = JSON.parse(clean);
        } catch (parseErr) {
          sessionStats.geminiFails++;
          console.error(
            `[Unhireable] ❌ ${cfg.name} invalid JSON:`,
            parseErr.message,
          );
          return {};
        }

        sessionStats.geminiSuccesses++;
        geminiCircuit.recordSuccess();
        console.debug(
          `[Unhireable] ${cfg.name} batch #${callNum}: ${Object.keys(answers).length} answers`,
        );
        return answers;
      } catch (error) {
        sessionStats.geminiFails++;
        console.error(
          `[Unhireable] ❌ ${cfg.name} batch error:`,
          error.message,
        );
      }
    }
    return {};
  }

  // Backward-compat shims for greenhouse.js/lever.js (wraps batch)
  async function askGeminiForAnswer(
    question,
    fieldType,
    options,
    profile,
    job,
  ) {
    const answers = await askGeminiBatch(
      [
        {
          id: "single_0",
          label: question,
          type: fieldType,
          options,
        },
      ],
      profile,
      job,
    );
    return answers["single_0"] || null;
  }
  async function getSmartAnswer(question, fieldType, options, profile, job) {
    await loadPatternConfig();
    const patternAnswer = getFieldValue(question, profile, job);
    if (patternAnswer) {
      sessionStats.patternMatches++;
      return { answer: patternAnswer, source: "pattern" };
    }
    const cached = await getAnswerFromCache(question);
    if (cached) {
      sessionStats.cacheHits++;
      return { answer: cached.answer, source: "cache" };
    }
    const llmAnswer = await askGeminiForAnswer(
      question,
      fieldType,
      options,
      profile,
      job,
    );
    if (llmAnswer) {
      await saveAnswerToCache(question, llmAnswer, {
        fieldType,
        options,
        source: "llm",
      });
      return { answer: llmAnswer, source: "llm" };
    }
    return { answer: null, source: "failed" };
  }
  function logUnknownField(el, label, value) {
    console.log(`[Unhireable] ❓ Unknown field: "${label}" = "${value}"`);
  }

  // ========== PROFILE BOOTSTRAP ==========
  async function bootstrapCacheFromProfile(profile) {
    if (!profile) return;
    const storageKey = cacheStorageKey();
    const store = await chrome.storage.local.get([storageKey]);
    const cache = store[storageKey] || {};
    const common = [
      { label: "Tell us about yourself", path: "summary" },
      { label: "About yourself", path: "summary" },
      {
        label: "City",
        path: "personal_info.location",
        transform: "location_city",
      },
      {
        label: "State",
        path: "personal_info.location",
        transform: "location_state",
      },
      {
        label: "Country",
        path: "personal_info.location",
        transform: "location_country",
      },
    ];
    let added = 0;
    for (const c of common) {
      const key = normalizeQuestion(c.label);
      if (cache[key]) continue;
      let val = getNested(profile, c.path);
      if (val != null && val !== "") {
        val = applyTransform(val, c.transform);
        if (val !== undefined && val !== null && val !== "") {
          cache[key] = {
            answer: String(val),
            question: c.label,
            fieldType: "text",
            confidence: "high",
            source: "bootstrap",
            usedCount: 0,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
          };
          added++;
        }
      }
    }
    if (added > 0) {
      await chrome.storage.local.set({ [storageKey]: cache });
      console.debug(`[Unhireable] Bootstrapped ${added} answers from profile`);
    }
  }

  // ========== ORCHESTRATOR: BATCH (PREFERRED) ==========
  // Accepts: [{id, label, type, options, currentValue}]
  // Returns: {fieldId: {answer, source}}
  async function batchGetAnswers(fields, profile, job = null) {
    await getActivePersonaId();
    await loadPatternConfig();
    await bootstrapCacheFromProfile(profile);
    const results = {};
    const needsLLM = [];
    const fieldsMap = {};

    for (const field of fields) {
      // Skip already-filled
      if (field.currentValue?.trim()) continue;

      fieldsMap[field.id] = field;

      // Tier 1: Pattern match
      const labelForMatch =
        field.type === "radio" || field.type === "select"
          ? `${field.label} (options: ${(field.options || []).join(", ")})`
          : field.label;
      const patternAnswer = getFieldValue(labelForMatch, profile, job);
      if (patternAnswer) {
        sessionStats.patternMatches++;
        results[field.id] = { answer: patternAnswer, source: "pattern" };
        continue;
      }

      // Tier 2: Cache
      const cached = await getAnswerFromCache(field.label);
      if (cached) {
        sessionStats.cacheHits++;
        results[field.id] = { answer: cached.answer, source: "cache" };
        continue;
      }

      // Needs LLM
      needsLLM.push(field);
    }

    console.debug(
      `[Unhireable] Batch: ${fields.length} total | ${Object.keys(results).length} resolved | ${needsLLM.length} need LLM`,
    );

    // Tier 3: One Gemini call for ALL remaining unknowns
    if (needsLLM.length > 0) {
      const llmAnswers = await askGeminiBatch(needsLLM, profile, job);
      for (const [fieldId, answer] of Object.entries(llmAnswers)) {
        if (answer) {
          results[fieldId] = { answer, source: "llm" };
        }
      }
      // Save all LLM answers to cache for next time
      await saveBatchToCache(llmAnswers, fieldsMap);
    }

    return results;
  }

  // ========== BACKEND SYNC ==========
  async function syncToBackend() {
    if (!(await checkBackendAvailable())) return;
    try {
      const personaId = _activePersonaId;
      const storageKey = cacheStorageKey();
      const store = await chrome.storage.local.get([storageKey]);
      const cache = store[storageKey] || {};
      const entries = Object.entries(cache).map(([key, val]) => ({
        normalized_key: key,
        question: val.question || key,
        answer: val.answer || "",
        field_type: val.fieldType || null,
        source: val.source || null,
        confidence: val.confidence || null,
        hit_count: val.usedCount || 1,
        persona_id: personaId,
      }));
      if (entries.length === 0) return;

      const resp = await bgFetch(
        `${API_BASE_URL}/api/answer-cache`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entries),
        },
        5000,
      );
      if (resp.ok) {
        const result = await resp.json();
        console.debug(
          `[Unhireable] Synced ${result.data?.upserted || 0} answers`,
        );
      } else if (resp.status >= 500) recordBackendError();
    } catch (e) {
      recordBackendError();
    }
  }

  async function pullFromBackend() {
    if (!(await checkBackendAvailable())) return;
    try {
      await getActivePersonaId();
      const resp = await bgFetch(
        `${API_BASE_URL}/api/answer-cache?persona_id=${_activePersonaId}`,
        {},
        5000,
      );
      if (!resp.ok) {
        if (resp.status >= 500) recordBackendError();
        return;
      }
      const { data: entries } = await resp.json();
      if (!entries || entries.length === 0) return;

      const storageKey = cacheStorageKey();
      const store = await chrome.storage.local.get([storageKey]);
      const cache = store[storageKey] || {};
      let merged = 0;
      for (const entry of entries) {
        const key = entry.normalized_key;
        if (!cache[key]) {
          cache[key] = {
            answer: entry.answer,
            question: entry.question,
            fieldType: entry.field_type || "text",
            confidence: entry.confidence || "medium",
            source: entry.source || "backend",
            usedCount: entry.hit_count || 1,
            createdAt: entry.created_at || new Date().toISOString(),
            lastUsed: entry.updated_at || new Date().toISOString(),
          };
          merged++;
        }
      }
      if (merged > 0) {
        await chrome.storage.local.set({ [storageKey]: cache });
      }
    } catch (e) {
      recordBackendError();
    }
  }

  // ========== EXPOSE API ==========
  window.UnhireableAnswers = {
    checkBackendAvailable,
    recordBackendError,
    // Batch (preferred — all callers should use this)
    batchGetAnswers,
    loadPatternConfig,
    invalidatePatternConfig,
    // Tier 1 pattern matching (used by universal-filler)
    getFieldValue,
    getAnswerFromCache,
    saveAnswerToCache,
    normalizeQuestion,
    syncToBackend,
    pullFromBackend,
    sessionStats,
    geminiCircuit,
    logSessionStats,
    getActivePersonaId,
    bgFetch, // Expose for other scripts
    // Backward-compat shims (greenhouse.js, lever.js)
    getSmartAnswer,
    askGeminiForAnswer,
    logUnknownField,
  };

  // Pull cached answers on load
  pullFromBackend().catch(() => {});

  console.debug("[Unhireable] Smart Answers v2 loaded");
})();
