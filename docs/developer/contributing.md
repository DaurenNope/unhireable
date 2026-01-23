# Contributing Guide

Thank you for your interest in contributing to Unhireable! This guide will help you get started.

## Getting Started

### Prerequisites

- **Rust** (latest stable) - [rustup.rs](https://rustup.rs)
- **Node.js** (v18+) - [nodejs.org](https://nodejs.org)
- **Tauri CLI** - `npm install -g @tauri-apps/cli`
- **Git** - For version control

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DaurenNope/jobEz.git
   cd jobEz
   ```

2. **Install dependencies:**
   ```bash
   # Frontend dependencies
   cd frontend
   npm install
   
   # Backend dependencies (handled by Cargo)
   cd ../src-tauri
   # Cargo will install dependencies automatically
   ```

3. **Run development server:**
   ```bash
   # From root directory
   npm run dev:tauri
   ```

4. **Run tests:**
   ```bash
   cd src-tauri
   cargo test
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write clean, readable code
- Follow the code style guide
- Add tests for new features
- Update documentation

### 3. Test Your Changes

```bash
# Run all tests
cd src-tauri
cargo test

# Run specific test
cargo test test_name

# Run with output
cargo test -- --nocapture
```

### 4. Commit Your Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new feature"
git commit -m "fix: fix bug in scraper"
git commit -m "docs: update API documentation"
```

**Commit Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting)
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

### Rust Code Style

Follow Rust standard formatting:

```bash
# Format code
cargo fmt

# Check formatting
cargo fmt -- --check

# Run clippy
cargo clippy -- -D warnings
```

**Guidelines:**
- Use `rustfmt` default settings
- Follow Rust naming conventions
- Use meaningful variable names
- Add documentation comments (`///`)
- Handle errors properly (use `Result`)

**Example:**
```rust
/// Calculates the match score between a job and user profile.
///
/// # Arguments
/// * `job` - The job to match
/// * `profile` - The user profile
///
/// # Returns
/// A `JobMatchResult` with the match score and details.
pub fn calculate_match(&self, job: &Job, profile: &UserProfile) -> JobMatchResult {
    // Implementation
}
```

### TypeScript/React Code Style

Follow TypeScript and React best practices:

```bash
# Format code
npm run format

# Lint code
npm run lint
```

**Guidelines:**
- Use TypeScript for type safety
- Use functional components with hooks
- Follow React best practices
- Use meaningful component names
- Add JSDoc comments for complex functions

**Example:**
```typescript
/**
 * Displays an error message with retry functionality.
 * 
 * @param error - The error to display
 * @param onRetry - Callback for retry action
 */
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  // Implementation
}
```

## Testing

### Writing Tests

**Unit Tests:**
- Test individual functions
- Mock external dependencies
- Fast execution (< 1 second)

**Integration Tests:**
- Test module interactions
- Use test database
- Test real workflows

**E2E Tests:**
- Test complete user journeys
- Use real browser automation
- Test with real data

**Example Unit Test:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_match_score() {
        let matcher = JobMatcher::new();
        let job = create_test_job();
        let profile = create_test_profile();
        
        let result = matcher.calculate_match(&job, &profile);
        
        assert!(result.match_score >= 0.0);
        assert!(result.match_score <= 100.0);
    }
}
```

## Pull Request Process

### Before Submitting

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Run all tests** and ensure they pass
4. **Format code** (`cargo fmt`, `npm run format`)
5. **Check for linting errors** (`cargo clippy`, `npm run lint`)

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally
```

### Review Process

1. **Automated Checks:**
   - Tests must pass
   - Code must be formatted
   - No linting errors
   - Build must succeed

2. **Code Review:**
   - At least one approval required
   - Address review comments
   - Update PR if needed

3. **Merge:**
   - Squash and merge (preferred)
   - Or merge commit

## Project Structure

### Adding a New Feature

1. **Backend Feature:**
   - Create module in `src-tauri/src/`
   - Add Tauri commands in `lib.rs`
   - Add tests
   - Update documentation

2. **Frontend Feature:**
   - Create page/component in `frontend/src/`
   - Add API calls in `api/client.ts`
   - Add routing if needed
   - Update documentation

### Adding a New Scraper

1. Create new file in `src-tauri/src/scraper/`
2. Implement `JobScraper` trait
3. Add to `ScraperManager` in `mod.rs`
4. Add tests
5. Update documentation

**Example:**
```rust
// src-tauri/src/scraper/new_source.rs
pub struct NewSourceScraper;

impl JobScraper for NewSourceScraper {
    fn scrape(&self, query: &str) -> Result<Vec<Job>> {
        // Implementation
    }
}
```

## Documentation

### Code Documentation

- **Rust**: Use `///` for public items
- **TypeScript**: Use JSDoc comments
- **Explain complex logic**
- **Include examples** where helpful

### User Documentation

- Update `docs/user/` for user-facing changes
- Add screenshots for UI changes
- Update FAQ if needed

### API Documentation

- Update `docs/api/commands.md` for new commands
- Document parameters and return types
- Include examples

## Reporting Issues

### Bug Reports

Include:
- **Description**: What happened
- **Steps to Reproduce**: How to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, version, etc.
- **Logs**: Relevant error messages

### Feature Requests

Include:
- **Use Case**: Why is this needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions considered

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn

## Getting Help

- **Documentation**: Check `docs/` directory
- **GitHub Issues**: Ask questions or report bugs
- **Discussions**: Join community discussions

---

**Thank you for contributing!** 🎉








