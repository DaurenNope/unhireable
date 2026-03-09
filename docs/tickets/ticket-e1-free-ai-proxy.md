# E1 — Cloudflare Worker Free AI Tier

## Status
active

## Priority
critical

## Problem

The extension currently supports multiple AI providers, but the default experience is still too technical for the primary target user.

Today, a user may need:
- their own API key
- desktop app support
- provider knowledge
- extra setup steps

That is too much friction for a non-technical job seeker.

We need a default free AI path that:
- works immediately
- does not expose a master API key in the extension
- does not require a full backend
- stays consistent with local-first product constraints

---

## Goal

Create the default free AI tier for Unhireable by introducing a lightweight Cloudflare Worker proxy backed by Gemini Flash.

The proxy should support:
- health check
- single-answer generation
- batch-answer generation
- resume parsing

The extension should be able to use this provider as the default AI path when the user does not configure their own provider.

---

## Why This Matters

This ticket unlocks:
- low-friction onboarding
- usable AI for non-technical users
- a clean free tier
- a monetization path later
- a stable default behavior for the extension

Without this ticket, the extension remains too dependent on user-supplied AI configuration.

---

## Scope

### In scope
- create Cloudflare Worker project
- add Worker endpoints:
  - `GET /api/health`
  - `POST /api/ai/answer`
  - `POST /api/ai/answer-batch`
  - `POST /api/ai/parse-resume`
- add per-user daily rate limiting
- use Gemini Flash behind the Worker
- define request/response contracts
- add CORS support for extension usage
- add extension-side provider integration
- make `unhireable_proxy` available as a provider option
- set it up to become the default free path

### Out of scope
- full billing or paid plans
- user auth system
- analytics backend
- long-term AI usage telemetry
- cloud persistence of user profiles
- desktop app dependency
- provider abstraction on the Worker for multiple upstream model vendors
- moving all AI to the Worker immediately

---

## Files Affected

### New files
- `tools/cloudflare/unhireable-ai-proxy/wrangler.toml`
- `tools/cloudflare/unhireable-ai-proxy/src/index.ts`
- `docs/tech/unhireable-ai-proxy.md`

### Existing files likely affected
- `chrome-extension/content-scripts/smart-answers.js`
- `chrome-extension/popup.js`
- `chrome-extension/popup.html`
- `project-ledger.yaml`
- `docs/process/project-control/change-log.md`
- `docs/tickets/README.md`

---

## Desired End State

A first-time user can install the extension, choose the default free AI mode, and successfully use AI-assisted form filling without needing to paste an API key.

---

## Technical Design

## Worker Responsibilities

The Worker must do exactly four things:

1. `GET /api/health`
2. `POST /api/ai/answer`
3. `POST /api/ai/answer-batch`
4. `POST /api/ai/parse-resume`

No database.  
No persistent user accounts.  
No profile storage.

---

## Worker Environment

### Bindings / secrets
- `GEMINI_API_KEY`
- `RATE_LIMIT_KV`

### Suggested config
- `FREE_DAILY_LIMIT=50`

---

## Request Privacy Rules

### Allowed to send to Worker
- question label
- field type
- select/radio options
- job title
- company
- short description snippet
- sanitized profile subset:
  - skills
  - recent titles
  - years of experience
  - work authorization
  - location preference
  - education summary

### Must not send by default
- full name
- email
- phone
- exact address
- full raw application history

### Exception
For resume parsing only, extracted resume text may be sent because the user explicitly triggered parsing.

The Worker must not store resume text.

---

## API Contracts

## `GET /api/health`

### Response
```/dev/null/health.json#L1-6
{
  "ok": true,
  "service": "unhireable-ai-proxy",
  "provider": "gemini-flash",
  "free_daily_limit": 50
}
```

---

## `POST /api/ai/answer`

### Request
```/dev/null/answer-request.json#L1-14
{
  "user_id": "uuid-v4-string",
  "question": "Do you now or in the future require sponsorship?",
  "field_type": "radio",
  "options": ["Yes", "No"],
  "profile": {
    "skills": ["React", "TypeScript"],
    "years_experience": 4,
    "recent_titles": ["Frontend Engineer"],
    "work_authorization": "US citizen",
    "location": "San Francisco, CA"
  },
  "job": {
    "title": "Frontend Engineer",
    "company": "Acme"
  }
}
```

### Response
```/dev/null/answer-response.json#L1-8
{
  "ok": true,
  "answer": "No",
  "confidence": "high",
  "source": "unhireable_proxy",
  "remaining_today": 49
}
```

---

## `POST /api/ai/answer-batch`

### Request
```/dev/null/batch-request.json#L1-18
{
  "user_id": "uuid-v4-string",
  "fields": [
    {
      "id": "radio_1",
      "label": "Do you now or in the future require sponsorship?",
      "type": "radio",
      "options": ["Yes", "No"]
    }
  ],
  "profile": {
    "skills": ["React", "TypeScript"],
    "recent_titles": ["Frontend Engineer"]
  },
  "job": {
    "title": "Frontend Engineer",
    "company": "Acme"
  }
}
```

### Response
```/dev/null/batch-response.json#L1-9
{
  "ok": true,
  "answers": {
    "radio_1": "No"
  },
  "confidence": "high",
  "source": "unhireable_proxy",
  "remaining_today": 48
}
```

---

## `POST /api/ai/parse-resume`

### Request
```/dev/null/parse-resume-request.json#L1-6
{
  "user_id": "uuid-v4-string",
  "resume_text": "full extracted text...",
  "filename": "resume.pdf"
}
```

### Response
```/dev/null/parse-resume-response.json#L1-19
{
  "ok": true,
  "profile": {
    "personal_info": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1 555 000 1111",
      "location": "San Francisco, CA"
    },
    "summary": "Frontend engineer with 4 years of experience...",
    "skills": ["React", "TypeScript"],
    "experience": [],
    "education": []
  }
}
```

---

## Rate Limiting

### Rule
- 50 AI requests per user per day on the free tier

### Key format
- `rate:<user_id>:<yyyy-mm-dd>`

### Behavior
- increment count on each Worker request
- reject above limit with `429`
- include friendly response body

### 429 response example
```/dev/null/429.json#L1-7
{
  "ok": false,
  "error": "Free daily AI limit reached",
  "code": "RATE_LIMITED",
  "remaining_today": 0,
  "suggestion": "Add your own AI provider in settings for unlimited usage."
}
```

---

## Prompt Rules

### For single answer generation
The model must:
- answer only the field asked
- not invent experience not present in the profile
- return a short professional answer
- use exact option values for radio/select if applicable
- return `Yes` or `No` exactly for yes/no fields
- keep textareas concise and useful

### For batch answers
The model must:
- return JSON only
- use field IDs as keys
- avoid long essays
- leave unknown values blank instead of hallucinating

### For resume parsing
The model must:
- return structured JSON only
- extract what is present
- avoid inventing missing details
- preserve candidate information as accurately as possible

---

## Extension Integration

## `smart-answers.js`
Add a new provider entry:
- `unhireable_proxy`

### Desired behavior
If the user has not configured their own API provider, the extension should be able to use the free Unhireable proxy path.

### Provider priority recommendation
If an explicit provider is set, respect it.

If no provider is set:
1. use user-owned Groq key if present
2. else use user-owned Gemini key if present
3. else use `unhireable_proxy`
4. else use `chrome_ai`
5. else use local model

---

## Storage Requirements

### New keys in `chrome.storage.local`
- `userId`
- `llmProvider`
- optional provider keys if user configures them

### Requirement
`userId` must be created on first run and persisted.  
This is required for rate limiting.

---

## Error Handling

The extension must handle these cases cleanly:

### Worker unavailable
- show fallback message
- do not crash fill flow
- allow deterministic answers and cached answers to continue working

### Worker rate limited
- show user-friendly message
- suggest adding own AI key
- still allow manual filling and cache-based answers

### Bad Worker response
- log safely
- treat as unresolved field rather than hard failure

### Resume parse failure
- show manual profile fallback immediately
- do not block onboarding entirely

---

## Acceptance Criteria

### Worker
- `GET /api/health` works
- `POST /api/ai/answer` returns valid answer JSON
- `POST /api/ai/answer-batch` returns valid batch JSON
- `POST /api/ai/parse-resume` returns structured profile JSON
- rate limiting works per user per day

### Extension
- `unhireable_proxy` appears as a valid AI path
- extension can call proxy successfully
- missing own API keys do not block first use
- error states degrade gracefully
- cached answers still work without Worker

### Product
- a non-technical user can rely on free mode as the default starting experience

---

## Risks

### Risk 1 — AI spend grows too fast
**Mitigation:** cache-first behavior, per-user daily limits, concise prompts

### Risk 2 — privacy concerns
**Mitigation:** only send sanitized profile subsets, never store resume text, document the behavior clearly

### Risk 3 — flaky response parsing
**Mitigation:** strict JSON responses, clear parser guards, safe fallback to unresolved fields

### Risk 4 — extension starts depending on Worker too much
**Mitigation:** preserve deterministic and cache-first logic; Worker remains additive, not required for all fields

---

## Dependencies

### Must happen before
- E4 popup onboarding flow should ideally reuse `parse-resume`
- E5 preview fill should benefit from stable default answer generation

### Not blocked by
- desktop CRM simplification
- extension sync work
- popup ATS detection expansion

---

## Suggested Execution Order

1. create Worker project skeleton
2. implement `/api/health`
3. implement rate limit helper
4. implement `/api/ai/answer`
5. implement `/api/ai/answer-batch`
6. implement `/api/ai/parse-resume`
7. wire `unhireable_proxy` into `smart-answers.js`
8. add first-run `userId` generation
9. add UI option / default provider behavior
10. test degraded behavior when Worker is unavailable

---

## Done Notes

_To be filled when completed._

### Outcome summary
- pending

### Follow-up work created
- pending

### Deviations from original scope
- pending