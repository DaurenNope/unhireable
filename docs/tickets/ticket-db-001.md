# TICKET DB-001: Complete PostgreSQL Integration

**Priority:** MEDIUM  
**Estimate:** 1 week  
**Status:** TODO  
**Agent:** Infrastructure Agent

## Description

Complete PostgreSQL integration. Currently, PostgreSQL is initialized but queries still use SQLite.

## CTO Recommendation

**SQLite is sufficient for MVP and single-user desktop app.**

PostgreSQL is needed for:
- Multi-user/SaaS version
- High concurrency
- Advanced queries/analytics
- Production scale

**Recommendation:** Defer PostgreSQL until needed. Focus on workflow implementations and testing first.

## If Proceeding

### Tasks

1. **Implement PostgreSQL query traits**
   - `JobQueries` for PostgreSQL
   - `ApplicationQueries` for PostgreSQL
   - `UserProfileQueries` for PostgreSQL
   - All other query traits

2. **Create database abstraction layer**
   - Trait for database operations
   - Factory for database selection
   - Unified query interface

3. **Add PostgreSQL migrations**
   - Create migration scripts
   - Test migrations
   - Add rollback support

4. **Test PostgreSQL integration**
   - Unit tests with PostgreSQL
   - Integration tests
   - Performance tests

## Files to Modify

- `src-tauri/src/db/postgres.rs`
- `src-tauri/src/db/queries.rs`
- `src-tauri/src/db/mod.rs`
- `src-tauri/src/lib.rs` (database selection)

## Current State

- PostgreSQL initialization works (`PostgresDatabase::new`)
- Migration system ready
- Connection pooling configured
- Queries still use SQLite (fallback in `setup_app_state`)

## Database Abstraction Example

```rust
pub trait DatabaseOperations {
    async fn get_job(&self, id: i64) -> Result<Option<Job>>;
    async fn create_job(&self, job: &mut Job) -> Result<()>;
    // ... other operations
}

impl DatabaseOperations for SqliteDatabase { ... }
impl DatabaseOperations for PostgresDatabase { ... }
```

## Acceptance Criteria

- [ ] All queries work with PostgreSQL
- [ ] Database abstraction layer created
- [ ] Migrations work correctly
- [ ] Tests pass with PostgreSQL
- [ ] Performance is acceptable
- [ ] Can switch between SQLite and PostgreSQL

## Notes

- Current SQLite implementation is solid
- PostgreSQL can be added incrementally
- Consider using `sqlx` for PostgreSQL queries
- Test both databases in CI/CD






