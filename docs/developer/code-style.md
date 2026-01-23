# Code Style Guide

This document defines the coding standards for the Unhireable project.

## Rust Code Style

### Formatting

Use `rustfmt` with default settings:

```bash
cargo fmt
```

**Key Rules:**
- 4 spaces for indentation
- 100 character line limit (soft)
- Trailing commas in multi-line structures
- Blank lines between functions

### Naming Conventions

- **Functions**: `snake_case`
- **Types/Structs**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Modules**: `snake_case`
- **Files**: `snake_case.rs`

**Examples:**
```rust
// Function
fn calculate_match_score() {}

// Struct
struct JobMatchResult {}

// Constant
const MAX_RETRIES: usize = 3;

// Module
mod job_matcher;
```

### Documentation

Use `///` for public items:

```rust
/// Calculates the match score between a job and user profile.
///
/// # Arguments
/// * `job` - The job to match against
/// * `profile` - The user profile
///
/// # Returns
/// A `JobMatchResult` containing the match score and details.
///
/// # Example
/// ```
/// let matcher = JobMatcher::new();
/// let result = matcher.calculate_match(&job, &profile);
/// assert!(result.match_score > 0.0);
/// ```
pub fn calculate_match(&self, job: &Job, profile: &UserProfile) -> JobMatchResult {
    // Implementation
}
```

### Error Handling

Always use `Result` for fallible operations:

```rust
// Good
fn get_job(&self, id: i64) -> Result<Option<Job>> {
    // Implementation
}

// Bad
fn get_job(&self, id: i64) -> Option<Job> {
    // Should return Result for database errors
}
```

Use `anyhow::Result` for application-level errors, `thiserror` for library errors.

### Async Code

Use `async/await` for I/O operations:

```rust
// Good
async fn fetch_jobs() -> Result<Vec<Job>> {
    let response = client.get(url).await?;
    Ok(response.json().await?)
}

// Bad (blocking in async context)
async fn fetch_jobs() -> Result<Vec<Job>> {
    let response = client.get(url).blocking_get()?; // Don't block
    Ok(response.json()?)
}
```

### Imports

Organize imports:

```rust
// Standard library
use std::collections::HashMap;
use std::sync::Arc;

// External crates
use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

// Internal modules
use crate::db::models::Job;
use crate::matching::JobMatcher;
```

### Comments

- Use `//` for inline comments
- Use `///` for documentation
- Use `//!` for module-level documentation
- Explain **why**, not **what**

```rust
// Good: Explains why
// Use exponential backoff to avoid overwhelming the server
let delay = initial_delay * 2.pow(retry_count);

// Bad: States the obvious
// Multiply delay by 2
let delay = initial_delay * 2.pow(retry_count);
```

---

## TypeScript/React Code Style

### Formatting

Use Prettier with project settings:

```bash
npm run format
```

**Key Rules:**
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line structures

### Naming Conventions

- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE` or `PascalCase`
- **Files**: `kebab-case.tsx` or `PascalCase.tsx`
- **Types/Interfaces**: `PascalCase`

**Examples:**
```typescript
// Component
export function JobCard() {}

// Function
function calculateMatch() {}

// Variable
const jobCount = 10;

// Constant
const MAX_RETRIES = 3;

// Type/Interface
interface JobMatchResult {}
type JobStatus = 'saved' | 'applied';
```

### Component Structure

```typescript
// 1. Imports
import React, { useState } from 'react';
import { Button } from './ui/button';

// 2. Types/Interfaces
interface JobCardProps {
  job: Job;
  onApply: (id: number) => void;
}

// 3. Component
export function JobCard({ job, onApply }: JobCardProps) {
  // 4. Hooks
  const [loading, setLoading] = useState(false);
  
  // 5. Event handlers
  const handleApply = async () => {
    setLoading(true);
    await onApply(job.id);
    setLoading(false);
  };
  
  // 6. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### TypeScript

**Always use types:**
```typescript
// Good
function getJob(id: number): Promise<Job | null> {
  return apiCall('get_job', { id });
}

// Bad
function getJob(id: any): any {
  return apiCall('get_job', { id });
}
```

**Use interfaces for objects:**
```typescript
// Good
interface UserProfile {
  name: string;
  email: string;
  skills: string[];
}

// Avoid
type UserProfile = {
  name: string;
  email: string;
  skills: string[];
};
```

### React Hooks

**Follow Rules of Hooks:**
- Only call hooks at top level
- Only call hooks from React functions
- Use dependency arrays correctly

```typescript
// Good
function MyComponent() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    // Effect logic
  }, [count]);
  
  return <div>{count}</div>;
}

// Bad
function MyComponent() {
  if (condition) {
    const [count, setCount] = useState(0); // Don't conditionally call hooks
  }
}
```

### Error Handling

Use error boundaries and proper error handling:

```typescript
// Good
try {
  const result = await apiCall('get_jobs');
  setJobs(result);
} catch (error) {
  setError(error);
  // Log for debugging
  console.error('Failed to fetch jobs:', error);
}

// Bad
const result = await apiCall('get_jobs'); // Unhandled promise
setJobs(result);
```

### Comments

Use JSDoc for functions:

```typescript
/**
 * Calculates the match score between a job and user profile.
 * 
 * @param job - The job to match
 * @param profile - The user profile
 * @returns The match score (0-100)
 * 
 * @example
 * ```typescript
 * const score = calculateMatch(job, profile);
 * console.log(`Match score: ${score}%`);
 * ```
 */
function calculateMatch(job: Job, profile: UserProfile): number {
  // Implementation
}
```

---

## File Organization

### Rust Files

```
src/
├── module_name/
│   ├── mod.rs          # Module declaration
│   ├── submodule.rs    # Submodules
│   └── types.rs        # Type definitions
└── lib.rs              # Main library
```

### TypeScript Files

```
src/
├── components/
│   ├── ComponentName.tsx
│   └── ui/
│       └── button.tsx
├── pages/
│   └── PageName.tsx
├── hooks/
│   └── useHook.ts
└── utils/
    └── utility.ts
```

---

## Git Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```
feat(matching): add skills-based matching algorithm

fix(scraper): handle rate limit errors gracefully

docs(api): document all Tauri commands

refactor(generator): simplify template rendering
```

---

## Best Practices

### General

1. **Keep functions small** - Single responsibility
2. **Use meaningful names** - Self-documenting code
3. **Avoid magic numbers** - Use named constants
4. **Handle errors properly** - Don't ignore errors
5. **Write tests** - Especially for critical logic
6. **Document complex logic** - Explain why, not what

### Rust Specific

1. **Use `Result` for errors** - Don't panic in library code
2. **Prefer `Option` over null** - Type safety
3. **Use `Arc` for shared ownership** - Thread safety
4. **Use `async/await` for I/O** - Don't block
5. **Leverage type system** - Let compiler catch errors

### TypeScript Specific

1. **Use TypeScript strictly** - Enable strict mode
2. **Avoid `any`** - Use proper types
3. **Use React hooks properly** - Follow rules
4. **Handle async errors** - Use try/catch
5. **Memoize expensive computations** - Use `useMemo`

---

## Linting and Formatting

### Rust

```bash
# Format
cargo fmt

# Lint
cargo clippy -- -D warnings

# Check formatting
cargo fmt -- --check
```

### TypeScript

```bash
# Format
npm run format

# Lint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

---

## Code Review Checklist

- [ ] Code follows style guide
- [ ] Functions are well-documented
- [ ] Error handling is proper
- [ ] Tests are included
- [ ] No linting errors
- [ ] Code is formatted
- [ ] No hardcoded values
- [ ] Performance considered
- [ ] Security considered

---

**Last Updated:** 2024








