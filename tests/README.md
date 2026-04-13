# Unhireable Test Suite

Comprehensive testing for unit, integration, and real-world scenarios.

## Quick Start

```bash
# Run all tests
cd tests
./run-all-tests.sh

# Or run individual test suites
node test-api.js          # API integration tests
node test-cv-generator.js # CV generator tests
node test-pipeline-e2e.js   # End-to-end tests
node validate-jobs.js     # Data validation
```

## Test Categories

### 1. Unit Tests
Tests individual components in isolation:
- Data file format validation
- JSON/YAML parsing
- File structure checks
- Required field validation

### 2. Integration Tests
Tests component interactions:
- Backend API endpoints
- Dashboard server responses
- API data flow
- Error handling

### 3. Real-World Tests
Tests actual usage scenarios:
- Full pipeline simulation
- CV generation workflow
- Extension loading
- Job data quality

## Test Files

| File | Purpose | Type |
|------|---------|------|
| `run-all-tests.sh` | Master test runner | All |
| `test-api.js` | API endpoint tests | Integration |
| `test-cv-generator.js` | CV generation tests | Unit + Real-world |
| `test-pipeline-e2e.js` | Full pipeline E2E | Real-world |
| `validate-jobs.js` | Job data validation | Unit |

## Expected Results

When everything is working:

```
🧪 Unhireable Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 UNIT TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Testing: Jobs JSON valid... ✅ PASS
Testing: CV text exists... ✅ PASS
...

🔗 INTEGRATION TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Testing: Backend health endpoint... ✅ PASS
Testing: Dashboard serves HTML... ✅ PASS
...

🌍 REAL-WORLD TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Testing: Jobs have required fields... ✅ PASS
Testing: At least 1 APPLY job exists... ✅ PASS
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Passed: XX
❌ Failed: 0

🎉 All tests passed!
```

## Prerequisites

- Backend server running on port 3001
- Dashboard server running on port 8081
- Data files populated (`jobs_evaluated.json`, `cv.txt`)

## Troubleshooting

**"Backend not running" errors:**
```bash
cd backend && node pipeline-server.js
```

**"Dashboard not serving" errors:**
```bash
cd dashboard && python3 -m http.server 8081
```

**"No data files" errors:**
```bash
# Run pipeline first or use test data
node -e "const fs=require('fs'); fs.writeFileSync('data/jobs_evaluated.json', JSON.stringify([...]))"
```
