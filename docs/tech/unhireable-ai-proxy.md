# Unhireable AI Proxy (Cloudflare Worker)

Lightweight proxy for the extension's free AI tier. Backed by Gemini Flash, rate-limited per user.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check, returns `free_daily_limit` |
| POST | `/api/ai/answer` | Single answer generation |
| POST | `/api/ai/answer-batch` | Batch answer generation |
| POST | `/api/ai/parse-resume` | Resume text → structured profile |

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account
- Gemini API key

## Deployment

### 1. Login

```bash
cd tools/cloudflare/unhireable-ai-proxy
wrangler login
```

### 2. Create KV namespace

```bash
wrangler kv namespace create RATE_LIMIT_KV
```

Copy the `id` from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<YOUR_KV_NAMESPACE_ID>"
```

### 3. Set secrets

```bash
wrangler secret put GEMINI_API_KEY
# Paste your Gemini API key when prompted
```

### 4. Deploy

```bash
wrangler deploy
```

The Worker URL will be printed (e.g. `https://unhireable-ai-proxy.<account>.workers.dev`).

### 5. Update extension (if URL differs)

If your Worker URL is not `https://unhireable-ai-proxy.unhireable.workers.dev`, set it in the extension:

- Option A: In popup/settings, store `unhireableProxyUrl` in `chrome.storage.local`
- Option B: Update `UNHIREABLE_PROXY_DEFAULT_URL` in `chrome-extension/content-scripts/smart-answers.js`

## Local development

```bash
cd tools/cloudflare/unhireable-ai-proxy
echo "GEMINI_API_KEY=your-key" > .dev.vars
wrangler dev
```

Test health: `curl http://localhost:8787/api/health`

## Rate limiting

- 50 requests per user per day (configurable via `FREE_DAILY_LIMIT`)
- Key format: `rate:<user_id>:<yyyy-mm-dd>`
- 429 response when limit exceeded

## Privacy

See ticket E1 for allowed vs. disallowed data. Only sanitized profile subsets and job context are sent. Resume text is sent only for parse-resume and is not stored.
