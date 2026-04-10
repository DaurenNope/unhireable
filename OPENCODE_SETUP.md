# OpenCode Setup Guide - MiniMax M2.5 or Local LLM

## Option 1: MiniMax M2.5 (Recommended - Faster/Better)

MiniMax M2.5 is available free in OpenCode and likely performs better than local Gemma 4.

### VS Code Settings:
```json
{
  "opencode.ai.provider": "minimax",
  "opencode.ai.model": "MiniMax-M2.5",
  "opencode.ai.temperature": 0.3
}
```

### OpenCode Standalone:
```json
{
  "ai": {
    "provider": "minimax",
    "model": "MiniMax-M2.5"
  }
}
```

**Note:** MiniMax M2.5 is pre-configured in OpenCode - just select it from the provider dropdown.

---

## Option 2: Local LLM (Gemma 4 via LM Studio)

### Option A: OpenCode Settings UI
1. Open OpenCode (VS Code extension or standalone)
2. Go to **Settings** (Cmd/Ctrl + ,)
3. Search for "OpenCode" or "AI Provider"
4. Set:
   - **Provider**: `OpenAI Compatible` or `Custom`
   - **Base URL**: `http://localhost:1234/v1`
   - **API Key**: `lm-studio` (or any dummy key)
   - **Model**: `google/gemma-4-e4b`

### Option B: Settings.json (Recommended)

Add to your VS Code settings.json:

```json
{
  "opencode.ai.provider": "openai-compatible",
  "opencode.ai.baseUrl": "http://localhost:1234/v1",
  "opencode.ai.apiKey": "lm-studio",
  "opencode.ai.model": "google/gemma-4-e4b",
  "opencode.ai.temperature": 0.3
}
```

### OpenCode Standalone (for local LLM):
- **Mac**: `~/Library/Application Support/opencode/settings.json`
- **Windows**: `%APPDATA%/opencode/settings.json`
- **Linux**: `~/.config/opencode/settings.json`

```json
{
  "ai": {
    "provider": "openai-compatible",
    "baseUrl": "http://localhost:1234/v1",
    "apiKey": "lm-studio",
    "model": "google/gemma-4-e4b"
  }
}
```

## Step 2: Test Connection

In OpenCode, open chat and type:
```
Hello, what model are you?
```

Should reply: "I am Gemma 4" or similar.

## Step 3: Load Career Ops Skill

Career Ops has OpenCode command files in:
`.opencode/commands/career-ops*.md`

These should automatically appear as slash commands:
- `/career-ops` - Main menu
- `/career-ops-evaluate` - Evaluate job
- `/career-ops-scan` - Scan portals
- etc.

## Step 4: Use Career Ops with Gemma

Try:
```
/career-ops evaluate https://job-boards.greenhouse.io/anthropic/jobs/5023394008
```

Or paste a job description.

## Troubleshooting

### "Connection refused"
- Make sure LM Studio is running
- Check port: `lsof -i :1234`

### "Invalid model identifier"
- Verify exact model name in LM Studio
- Check: `curl http://localhost:1234/v1/models`

### "No response" or timeout
- Gemma 4 is slow (thinking mode)
- Increase timeout in OpenCode settings
- Try simpler prompts first

### Slash commands not showing
- Restart OpenCode
- Check `.opencode/commands/` folder exists
- Verify files have `.md` extension

## Model Comparison

| Feature | MiniMax M2.5 | Gemma 4 (Local) | Claude Code |
|---------|--------------|-----------------|-------------|
| **Speed** | ✅ Fast | ⚠️ Slow (thinking) | ✅ Fast |
| **Quality** | ✅ Good | ⚠️ Mediocre | ✅ Excellent |
| **Tool use** | ⚠️ Limited | ⚠️ Limited | ✅ Full |
| **Cost** | ✅ Free | ✅ Free | $ |
| **Setup** | ✅ Easy | ⚠️ Complex (LM Studio) | N/A |
| **Career Ops** | ✅ Works | ✅ Works | ✅ Works |

**Recommendation:** Use **MiniMax M2.5** in OpenCode - best balance of speed/quality for free.

## Recommendation

OpenCode + Gemma 4 gives you:
- ✅ Custom LLM (free, local)
- ✅ Career Ops slash commands
- ⚠️ Slower responses
- ⚠️ Less tool integration

Good for testing, but may be slower than Claude Code for complex tasks.

## Next Steps

1. Configure OpenCode (5 min)
2. Test with simple prompt
3. Try `/career-ops evaluate` with a job URL
4. Compare results to Claude Code

Report back what works!
