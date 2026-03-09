export interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  FREE_DAILY_LIMIT: string;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

type JsonObject = Record<string, JsonValue>;

type AnswerRequest = {
  user_id: string;
  question: string;
  field_type?: string;
  options?: string[];
  profile?: JsonObject;
  job?: JsonObject;
};

type BatchField = {
  id: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
};

type BatchRequest = {
  user_id: string;
  fields: BatchField[];
  profile?: JsonObject;
  job?: JsonObject;
};

type ParseResumeRequest = {
  user_id: string;
  resume_text: string;
  filename?: string;
};

const JSON_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function badRequest(message: string): Response {
  return json(
    {
      ok: false,
      error: message,
      code: "BAD_REQUEST",
    },
    400,
  );
}

function clampString(input: unknown, max = 500): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, max);
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function asObject(input: unknown): JsonObject {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as JsonObject)
    : {};
}

function asArray<T = unknown>(input: unknown): T[] {
  return Array.isArray(input) ? (input as T[]) : [];
}

function sanitizeProfile(profile: JsonObject | undefined): JsonObject {
  if (!profile) return {};

  const personalInfo = asObject(profile.personal_info);
  const experience = asArray<JsonObject>(profile.experience);
  const education = asArray<JsonObject>(profile.education);
  const projects = asArray<JsonObject>(profile.projects);
  const languages = asArray<JsonObject>(profile.languages);

  const rawSkills = Array.isArray(profile.skills)
    ? profile.skills
    : Array.isArray(asObject(profile.skills).technical_skills)
    ? (asObject(profile.skills).technical_skills as JsonValue[])
    : [];

  return {
    skills: rawSkills.slice(0, 20),
    summary: clampString(profile.summary, 600),
    years_experience:
      personalInfo.years_experience ??
      profile.years_experience ??
      null,
    recent_titles: experience
      .slice(0, 5)
      .map((entry) => {
        const title = entry.title ?? entry.position ?? entry.role ?? "";
        return typeof title === "string" ? title : "";
      })
      .filter(Boolean),
    work_authorization:
      personalInfo.work_authorization ??
      profile.work_authorization ??
      null,
    requires_sponsorship:
      personalInfo.requires_sponsorship ??
      profile.requires_sponsorship ??
      null,
    location: personalInfo.location ?? profile.location ?? null,
    education: education.slice(0, 3).map((entry) => ({
      school:
        typeof entry.school === "string"
          ? entry.school
          : typeof entry.institution === "string"
          ? entry.institution
          : "",
      degree: typeof entry.degree === "string" ? entry.degree : "",
      field:
        typeof entry.field === "string"
          ? entry.field
          : typeof entry.major === "string"
          ? entry.major
          : "",
      graduation_year:
        typeof entry.graduation_year === "string"
          ? entry.graduation_year
          : typeof entry.year === "string"
          ? entry.year
          : "",
    })),
    certifications: asArray<JsonValue>(profile.certifications).slice(0, 10),
    languages: languages.slice(0, 10).map((entry) => ({
      language: typeof entry.language === "string" ? entry.language : "",
      proficiency:
        typeof entry.proficiency === "string" ? entry.proficiency : "",
    })),
    projects: projects.slice(0, 5).map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "",
      description:
        typeof entry.description === "string" ? entry.description : "",
    })),
  };
}

function sanitizeJob(job: JsonObject | undefined): JsonObject {
  if (!job) return {};
  return {
    title: clampString(job.title, 200),
    company: clampString(job.company, 200),
    description: clampString(
      job.description ?? job.description_snippet,
      1200,
    ),
    requirements: clampString(job.requirements, 800),
    location: clampString(job.location, 200),
  };
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function enforceDailyLimit(
  env: Env,
  userId: string,
): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
}> {
  const limit = Number(env.FREE_DAILY_LIMIT || "50");
  const key = `rate:${userId}:${todayKey()}`;

  const raw = await env.RATE_LIMIT_KV.get(key);
  const used = raw ? Number(raw) : 0;

  if (used >= limit) {
    return {
      allowed: false,
      remaining: 0,
      used,
      limit,
    };
  }

  const nextUsed = used + 1;

  await env.RATE_LIMIT_KV.put(key, String(nextUsed), {
    expirationTtl: 60 * 60 * 24 * 2,
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextUsed),
    used: nextUsed,
    limit,
  };
}

async function callGemini(env: Env, prompt: string): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
      env.GEMINI_API_KEY,
    )}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Gemini upstream error ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as JsonObject;
  const candidates = asArray<JsonObject>(data.candidates);
  const firstCandidate = candidates[0] ?? {};
  const content = asObject(firstCandidate.content);
  const parts = asArray<JsonObject>(content.parts);
  const text = typeof parts[0]?.text === "string" ? parts[0].text : "";

  if (!text.trim()) {
    throw new Error("Gemini returned empty content");
  }

  return text.trim();
}

function buildSingleAnswerPrompt(input: AnswerRequest): string {
  const profile = sanitizeProfile(input.profile);
  const job = sanitizeJob(input.job);
  const options = Array.isArray(input.options) ? input.options : [];

  return [
    "You are helping fill out a job application.",
    "Answer honestly and concisely using only the provided candidate context.",
    "Never invent experience, credentials, or personal facts.",
    "",
    "RULES:",
    "- If the field is yes/no, answer exactly 'Yes' or 'No'.",
    "- If options are provided, choose exactly one of the provided options if applicable.",
    "- If the field is numeric, answer with only the number.",
    "- If the field is text/textarea, answer in 1 to 3 professional sentences maximum.",
    "- If uncertain, give the safest honest best effort without hallucinating.",
    "",
    `FIELD TYPE: ${input.field_type || "text"}`,
    `QUESTION: ${clampString(input.question, 500)}`,
    options.length ? `OPTIONS: ${options.join(" | ")}` : "OPTIONS: none",
    "",
    "CANDIDATE CONTEXT:",
    JSON.stringify(profile, null, 2),
    "",
    "JOB CONTEXT:",
    JSON.stringify(job, null, 2),
    "",
    'Respond only as strict JSON in this shape: {"answer":"...","confidence":"high|medium|low"}',
  ].join("\n");
}

function buildBatchPrompt(input: BatchRequest): string {
  const profile = sanitizeProfile(input.profile);
  const job = sanitizeJob(input.job);

  return [
    "You are helping fill out a job application.",
    "Return answers for every field as strict JSON only.",
    "Never invent experience, credentials, or personal facts.",
    "",
    "RULES:",
    "- Use field IDs as JSON keys.",
    "- If a field is radio/select and options are provided, use exact option text when possible.",
    "- Keep long-form answers concise and professional.",
    "- Every field listed must have a key in the JSON output.",
    "- If the best honest answer is unknown, return an empty string.",
    "",
    "FIELDS:",
    JSON.stringify(input.fields, null, 2),
    "",
    "CANDIDATE CONTEXT:",
    JSON.stringify(profile, null, 2),
    "",
    "JOB CONTEXT:",
    JSON.stringify(job, null, 2),
    "",
    'Respond only as JSON like: {"field_id":"answer"}',
  ].join("\n");
}

function buildResumeParsePrompt(input: ParseResumeRequest): string {
  return [
    "Extract structured candidate profile data from this resume text.",
    "Return strict JSON only.",
    "Do not invent missing facts.",
    "If a field is missing, use an empty string, empty array, or null as appropriate.",
    "",
    "Return JSON in this shape:",
    JSON.stringify(
      {
        profile: {
          personal_info: {
            name: "",
            email: "",
            phone: "",
            location: "",
            linkedin: "",
            github: "",
            website: "",
          },
          summary: "",
          skills: [],
          experience: [
            {
              title: "",
              company: "",
              start_date: "",
              end_date: "",
              highlights: [],
            },
          ],
          education: [
            {
              school: "",
              degree: "",
              field: "",
              graduation_year: "",
            },
          ],
        },
      },
      null,
      2,
    ),
    "",
    `FILENAME: ${clampString(input.filename, 200)}`,
    "RESUME TEXT:",
    clampString(input.resume_text, 24000),
  ].join("\n");
}

async function handleHealth(env: Env): Promise<Response> {
  return json({
    ok: true,
    service: "unhireable-ai-proxy",
    provider: "gemini-2.0-flash",
    free_daily_limit: Number(env.FREE_DAILY_LIMIT || "50"),
  });
}

async function handleAnswer(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody<AnswerRequest>(request);
  if (!body) return badRequest("Invalid JSON body");
  if (!clampString(body.user_id, 100)) return badRequest("user_id is required");
  if (!clampString(body.question, 500)) return badRequest("question is required");

  const limit = await enforceDailyLimit(env, body.user_id);
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        error: "Free daily AI limit reached",
        code: "RATE_LIMITED",
        remaining_today: 0,
        suggestion:
          "Add your own AI provider in settings for unlimited usage.",
      },
      429,
    );
  }

  try {
    const prompt = buildSingleAnswerPrompt(body);
    const raw = await callGemini(env, prompt);
    const parsed = JSON.parse(stripCodeFences(raw)) as JsonObject;

    return json({
      ok: true,
      answer: clampString(parsed.answer, 1200),
      confidence: clampString(parsed.confidence, 20) || "medium",
      source: "unhireable_proxy",
      remaining_today: limit.remaining,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Answer generation failed",
        code: "UPSTREAM_ERROR",
      },
      503,
    );
  }
}

async function handleBatchAnswer(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody<BatchRequest>(request);
  if (!body) return badRequest("Invalid JSON body");
  if (!clampString(body.user_id, 100)) return badRequest("user_id is required");
  if (!Array.isArray(body.fields) || body.fields.length === 0) {
    return badRequest("fields must be a non-empty array");
  }

  const limit = await enforceDailyLimit(env, body.user_id);
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        error: "Free daily AI limit reached",
        code: "RATE_LIMITED",
        remaining_today: 0,
        suggestion:
          "Add your own AI provider in settings for unlimited usage.",
      },
      429,
    );
  }

  try {
    const prompt = buildBatchPrompt(body);
    const raw = await callGemini(env, prompt);
    const answers = JSON.parse(stripCodeFences(raw)) as JsonObject;

    return json({
      ok: true,
      answers,
      confidence: "medium",
      source: "unhireable_proxy",
      remaining_today: limit.remaining,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Batch answer generation failed",
        code: "UPSTREAM_ERROR",
      },
      503,
    );
  }
}

async function handleParseResume(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody<ParseResumeRequest>(request);
  if (!body) return badRequest("Invalid JSON body");
  if (!clampString(body.user_id, 100)) return badRequest("user_id is required");
  if (!clampString(body.resume_text, 24000)) {
    return badRequest("resume_text is required");
  }

  const limit = await enforceDailyLimit(env, body.user_id);
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        error: "Free daily AI limit reached",
        code: "RATE_LIMITED",
        remaining_today: 0,
        suggestion:
          "Add your own AI provider in settings for unlimited usage.",
      },
      429,
    );
  }

  try {
    const prompt = buildResumeParsePrompt(body);
    const raw = await callGemini(env, prompt);
    const parsed = JSON.parse(stripCodeFences(raw)) as JsonObject;
    const profile = asObject(parsed.profile).profile
      ? asObject(asObject(parsed.profile).profile)
      : asObject(parsed.profile).personal_info || parsed.profile
      ? asObject(parsed.profile)
      : parsed;

    return json({
      ok: true,
      profile,
      source: "unhireable_proxy",
      remaining_today: limit.remaining,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Resume parsing failed",
        code: "UPSTREAM_ERROR",
      },
      503,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: JSON_HEADERS,
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return handleHealth(env);
    }

    if (request.method === "POST" && url.pathname === "/api/ai/answer") {
      return handleAnswer(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/ai/answer-batch"
    ) {
      return handleBatchAnswer(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/ai/parse-resume"
    ) {
      return handleParseResume(request, env);
    }

    return json(
      {
        ok: false,
        error: "Not found",
        code: "NOT_FOUND",
      },
      404,
    );
  },
};
