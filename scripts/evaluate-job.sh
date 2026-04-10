#!/bin/bash
# Evaluate a job using MiniMax M2.5 (best free model in OpenCode)
# Usage: ./evaluate-job.sh "Job Title" "Company" "Requirements" "Location"

JOB_TITLE="${1:-AI Engineer}"
COMPANY="${2:-Anthropic}"
REQUIREMENTS="${3:-Python, ML, LLM}"
LOCATION="${4:-Remote}"

MODEL="opencode/minimax-m2.5-free"

echo "🎯 Evaluating: $JOB_TITLE at $COMPANY"
echo "📋 Requirements: $REQUIREMENTS"
echo "📍 Location: $LOCATION"
echo "🤖 Model: $MODEL"
echo ""

opencode run --model "$MODEL" "
Evaluate this job using Career Ops A-F framework:

Job: $JOB_TITLE at $COMPANY
Location: $LOCATION  
Requirements: $REQUIREMENTS

Candidate Profile:
- AI/ML Engineer with Python, JavaScript, Machine Learning, AI/LLM Applications
- Experience: Educated 100+ individuals on AI/blockchain through PTB Academy
- Founded Zorox Research Lab, advised \$500K crypto portfolio
- Skills: Python, JavaScript, Machine Learning, AI/LLM Applications, Data Analysis
- Remote only preference

Provide:
A) Role Fit Score (1-5) and archetype classification
B) Skills Match Score (1-5) with table showing requirements vs candidate skills, plus gaps analysis
C) Logistics Score (1-5) covering remote fit and salary alignment
D) Company Quality Score (1-5) assessing reputation and growth potential

Overall Recommendation: APPLY / CONSIDER / SKIP with brief reasoning.
"
