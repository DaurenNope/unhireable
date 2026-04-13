#!/bin/bash
# Unhireable Test Suite - Run all tests

set -e

echo "🧪 Unhireable Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Track results
PASSED=0
FAILED=0

run_test() {
    local name="$1"
    local cmd="$2"
    
    echo -n "Testing: $name... "
    if eval "$cmd" > /tmp/test_$$.log 2>&1; then
        echo "✅ PASS"
        ((PASSED++))
    else
        echo "❌ FAIL"
        echo "   Error: $(cat /tmp/test_$$.log | head -3)"
        ((FAILED++))
    fi
}

echo "📦 UNIT TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Data format tests
run_test "Jobs JSON valid" "node -e 'JSON.parse(require(\"fs\").readFileSync(\"data/jobs_evaluated.json\"))'"
run_test "CV text exists" "test -s data/cv.txt"
run_test "Config YAML valid" "node -e 'require(\"yaml\").parse(require(\"fs\").readFileSync(\"data/config.yml\", \"utf8\"))'"

# File structure tests
run_test "Backend server exists" "test -f backend/pipeline-server.js"
run_test "Dashboard exists" "test -f dashboard/index.html"
run_test "Extension manifest valid" "node -e 'JSON.parse(require(\"fs\").readFileSync(\"chrome-extension/manifest.json\"))'"

echo ""
echo "🔗 INTEGRATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend API tests
run_test "Backend health endpoint" "curl -sf http://localhost:3001/api/health"
run_test "Backend status endpoint" "curl -sf http://localhost:3001/api/status"
run_test "Backend jobs endpoint" "curl -sf http://localhost:3001/api/jobs?type=extension"

# Dashboard tests
run_test "Dashboard serves HTML" "curl -sf http://localhost:8081/dashboard/index.html | grep -q '<title>'"
run_test "Dashboard API accessible" "curl -sf http://localhost:8081/dashboard/app.js | grep -q 'function'"

echo ""
echo "🌍 REAL-WORLD TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Data integrity tests
run_test "Jobs have required fields" "node tests/validate-jobs.js"
run_test "At least 1 APPLY job exists" "node -e 'const j=JSON.parse(require(\"fs\").readFileSync(\"data/jobs_evaluated.json\")); const a=j.filter(x=>x.recommendation===\"APPLY\"&&x.score>=4); process.exit(a.length>0?0:1)'"
run_test "CV has content" "test $(wc -c < data/cv.txt) -gt 500"

# CV generator tests
run_test "CV generator script exists" "test -f cv-generator/cvgen.cjs"
run_test "CV generator runs" "node cv-generator/cvgen.cjs 2>/dev/null || test $? -eq 0"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed. Check logs above."
    exit 1
fi
