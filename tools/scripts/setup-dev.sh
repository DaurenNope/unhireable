#!/bin/bash
# Development environment setup script

set -e

echo "🚀 Setting up Jobez development environment..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "📦 Installing pre-commit..."
    if command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    elif command -v pip &> /dev/null; then
        pip install pre-commit
    elif command -v brew &> /dev/null; then
        brew install pre-commit
    else
        echo "⚠️  Please install pre-commit manually: https://pre-commit.com/#installation"
        exit 1
    fi
fi

# Install pre-commit hooks
echo "🔧 Installing pre-commit hooks..."
pre-commit install

# Install Rust tools if not present
if ! command -v cargo &> /dev/null; then
    echo "📦 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Install Rust tools
echo "🔧 Installing Rust development tools..."
rustup component add rustfmt clippy

# Install cargo-tarpaulin for code coverage (optional)
if ! command -v cargo-tarpaulin &> /dev/null; then
    echo "📦 Installing cargo-tarpaulin for code coverage..."
    cargo install cargo-tarpaulin --locked || echo "⚠️  Failed to install cargo-tarpaulin (optional)"
fi

# Install frontend dependencies
if [ -d "frontend" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "  - Run 'cargo test' in src-tauri/ to verify tests"
echo "  - Run 'npm test' in frontend/ to verify frontend tests"
echo "  - Pre-commit hooks will run automatically on git commit"
echo "  - Set SENTRY_DSN environment variable for error tracking (optional)"

