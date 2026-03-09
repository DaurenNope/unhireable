#!/usr/bin/env bash
# Deploy Unhireable AI Proxy (Cloudflare Worker)
# Usage: ./tools/scripts/deploy-ai-proxy.sh
# Prerequisites: wrangler CLI, Cloudflare account, GEMINI_API_KEY

set -e
cd "$(dirname "$0")/../../tools/cloudflare/unhireable-ai-proxy"

echo "=== Unhireable AI Proxy Deployment ==="

# Check wrangler
if ! command -v wrangler &>/dev/null; then
  echo "Error: wrangler CLI not found. Install: npm install -g wrangler"
  exit 1
fi

# Check if KV namespace ID is still placeholder
if grep -q "REPLACE_WITH_KV_NAMESPACE_ID" wrangler.toml; then
  echo ""
  echo "Step 1: Create KV namespace"
  echo "  Run: wrangler kv namespace create RATE_LIMIT_KV"
  echo "  Then update wrangler.toml: replace REPLACE_WITH_KV_NAMESPACE_ID with the output id"
  echo ""
  read -p "Press Enter after updating wrangler.toml..."
fi

# Check GEMINI_API_KEY
if ! wrangler secret list 2>/dev/null | grep -q GEMINI_API_KEY; then
  echo ""
  echo "Step 2: Set GEMINI_API_KEY"
  echo "  Run: wrangler secret put GEMINI_API_KEY"
  echo ""
  read -p "Press Enter after setting the secret..."
fi

echo ""
echo "Deploying..."
wrangler deploy

echo ""
echo "=== Deployment complete ==="
echo "Worker URL is shown above. If it differs from the default, update the extension's unhireableProxyUrl in chrome.storage.local or smart-answers.js"
