#!/bin/bash
# Test script for resume analyzer

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PDF_PATH="$PROJECT_ROOT/Maksut_Beksultan_Cv.pdf"

echo "🧪 Testing Resume Analyzer"
echo "=========================="
echo ""
echo "PDF Path: $PDF_PATH"
echo ""

if [ ! -f "$PDF_PATH" ]; then
    echo "❌ Error: PDF file not found at $PDF_PATH"
    exit 1
fi

echo "✅ PDF file found"
echo ""
echo "Requirements for OCR (scanned PDFs):"
echo "  - Tesseract CLI (e.g. \`brew install tesseract\`)"
echo "  - Poppler tools for \`pdftoppm\` (e.g. \`brew install poppler\`)"
echo ""
echo "To test the resume analyzer:"
echo "1. Start the Tauri app: cd $PROJECT_ROOT && pnpm tauri dev"
echo "2. Navigate to: http://localhost:1420/resume-analyzer (or use the app)"
echo "3. Enter the PDF path: $PDF_PATH"
echo "4. Click 'Analyze Resume'"
echo ""
echo "Or test via CLI (if available):"
echo "  cd $PROJECT_ROOT/src-tauri"
echo "  cargo run -- analyze_resume --pdf-path \"$PDF_PATH\""
echo ""

