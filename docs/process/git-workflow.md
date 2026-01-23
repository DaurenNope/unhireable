# Git Workflow Guide

## 🚀 Quick Start

### Initial Setup (Already Done)
- Repository initialized
- Remote added: `https://github.com/DaurenNope/jobEz.git`
- Main branch set up and pushed

## 📝 Daily Workflow

### 1. Check Current Status
```bash
git status
```

### 2. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Make Changes
- Edit files
- Test your changes
- Ensure everything works

### 4. Stage Changes
```bash
# Stage specific files
git add path/to/file

# Stage all changes
git add .
```

### 5. Commit Changes
```bash
git commit -m "Descriptive commit message"

# Good commit messages:
# "Add resume generation error handling"
# "Fix job pagination issue"
# "Update README with setup instructions"
# "Implement user profile management"
```

### 6. Push to Remote
```bash
# First push of a new branch
git push -u origin feature/your-feature-name

# Subsequent pushes
git push
```

## 🔄 Common Workflows

### Working on Main Branch
```bash
# Pull latest changes
git pull origin main

# Make changes, commit, and push
git add .
git commit -m "Your commit message"
git push
```

### Working on Feature Branch
```bash
# Create and switch to feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push feature branch
git push -u origin feature/new-feature

# When feature is complete, merge to main
git checkout main
git pull origin main
git merge feature/new-feature
git push
```

### Syncing with Remote
```bash
# Pull latest changes
git pull origin main

# If you have local changes, stash them first
git stash
git pull origin main
git stash pop
```

## 🏷️ Branch Naming Convention

- `feature/` - New features (e.g., `feature/email-integration`)
- `fix/` - Bug fixes (e.g., `fix/job-pagination`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/scraper-module`)
- `test/` - Adding tests (e.g., `test/resume-generation`)

## 📋 Commit Message Guidelines

### Format
```
Type: Short description (50 chars max)

Longer description if needed (wrap at 72 chars)
```

### Types
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Examples
```
feat: Add resume generation with AI integration
fix: Resolve job pagination issue
docs: Update README with setup instructions
refactor: Improve scraper error handling
```

## 🔍 Useful Commands

### View History
```bash
# View commit history
git log

# View commit history (one line per commit)
git log --oneline

# View changes in a file
git log -p path/to/file
```

### Check Differences
```bash
# See what changed
git diff

# See staged changes
git diff --staged

# See changes in a specific file
git diff path/to/file
```

### Undo Changes
```bash
# Unstage a file
git reset HEAD path/to/file

# Discard changes in working directory
git checkout -- path/to/file

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

### Branch Management
```bash
# List all branches
git branch

# List remote branches
git branch -r

# Delete a branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name
```

## 🚨 Troubleshooting

### Merge Conflicts
```bash
# If you have merge conflicts
git status  # See which files have conflicts
# Edit files to resolve conflicts
git add .
git commit -m "Resolve merge conflicts"
```

### Undo Last Push
```bash
# Reset to previous commit
git reset --hard HEAD~1
git push --force origin main  # ⚠️ Use with caution!
```

### Revert a Commit
```bash
# Create a new commit that undoes changes
git revert commit-hash
git push
```

## 📚 Best Practices

1. **Always pull before pushing**
   ```bash
   git pull origin main
   git push
   ```

2. **Commit often** - Small, focused commits are better than large ones

3. **Write clear commit messages** - Describe what and why, not how

4. **Use feature branches** - Don't work directly on main

5. **Test before committing** - Ensure your changes work

6. **Review before pushing** - Check `git diff` before committing

7. **Keep main branch stable** - Only merge working features

## 🔐 Authentication

If you encounter authentication issues:

### Using HTTPS (Current Setup)
```bash
# You'll be prompted for GitHub credentials
git push
```

### Using SSH (Recommended for frequent pushes)
```bash
# Set up SSH key (one-time setup)
ssh-keygen -t ed25519 -C "your_email@example.com"
# Add SSH key to GitHub account
# Change remote URL
git remote set-url origin git@github.com:DaurenNope/jobEz.git
```

## 📖 Additional Resources

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Current Remote:** `https://github.com/DaurenNope/jobEz.git`
**Main Branch:** `main`

