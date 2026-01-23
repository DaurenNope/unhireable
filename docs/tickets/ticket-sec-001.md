# TICKET SEC-001: Security Audit & Hardening

**Priority:** CRITICAL  
**Estimate:** 2-3 days  
**Status:** TODO  
**Agent:** Security Agent / Infrastructure Agent  
**Dependencies:** None  
**Blocks:** Production release

---

## Executive Summary

Conduct comprehensive security audit and implement security hardening measures. This is critical before production release to protect user data and prevent vulnerabilities.

---

## Problem Statement

Current state:
- ✅ Basic security measures in place
- ❌ No comprehensive security audit
- ❌ Input validation may be incomplete
- ❌ Credential storage needs review
- ❌ API key security needs verification
- ❌ SQL injection prevention needs verification

**Impact:** Potential security vulnerabilities could expose user data or compromise the application.

---

## Security Audit Checklist

### 1. Input Validation

**Areas to Audit:**
- All Tauri command inputs
- Form inputs in frontend
- File uploads
- URL inputs
- Database queries
- API requests

**Tasks:**

1. **Audit All Command Handlers:**
   ```rust
   // Example: validate input
   #[tauri::command]
   async fn create_job(
       state: State<'_, AppState>,
       mut job: db::models::Job,
   ) -> Result<db::models::Job> {
       // Validate input
       if job.title.is_empty() || job.title.len() > 200 {
           return Err(anyhow::anyhow!("Invalid job title").into());
       }
       
       // Sanitize input
       job.title = sanitize_string(&job.title);
       
       // ... rest of implementation
   }
   ```

2. **Create Validation Utilities:**
   ```rust
   // src-tauri/src/security/validation.rs
   pub fn validate_string(input: &str, max_len: usize) -> Result<()> {
       if input.is_empty() {
           return Err(anyhow::anyhow!("Input cannot be empty"));
       }
       if input.len() > max_len {
           return Err(anyhow::anyhow!("Input too long"));
       }
       // Check for dangerous characters
       if input.contains("<script>") || input.contains("javascript:") {
           return Err(anyhow::anyhow!("Invalid characters detected"));
       }
       Ok(())
   }
   
   pub fn sanitize_string(input: &str) -> String {
       // Remove dangerous characters
       input
           .replace("<", "&lt;")
           .replace(">", "&gt;")
           .replace("\"", "&quot;")
           .replace("'", "&#x27;")
   }
   ```

3. **Add Validation to All Commands:**
   - Job creation/update
   - Application creation/update
   - User profile updates
   - Document generation inputs
   - Scraper queries

---

### 2. SQL Injection Prevention

**Areas to Audit:**
- All database queries
- Raw SQL queries
- Parameterized queries

**Tasks:**

1. **Verify Parameterized Queries:**
   ```rust
   // ✅ Good: Parameterized query
   conn.execute(
       "INSERT INTO jobs (title, company) VALUES (?1, ?2)",
       params![job.title, job.company]
   )?;
   
   // ❌ Bad: String concatenation
   // conn.execute(&format!("INSERT INTO jobs (title) VALUES ('{}')", title))?;
   ```

2. **Audit All Query Files:**
   - `src-tauri/src/db/queries.rs`
   - All `execute()` and `query()` calls
   - Verify all use parameters

3. **Add Query Validation:**
   ```rust
   // Validate query parameters
   pub fn validate_query_params(params: &[&dyn ToSql]) -> Result<()> {
       for param in params {
           // Check for SQL injection patterns
           if let Some(s) = param.to_sql()?.as_str() {
               if s.contains(";") || s.contains("--") || s.contains("DROP") {
                   return Err(anyhow::anyhow!("Invalid query parameter"));
               }
           }
       }
       Ok(())
   }
   ```

---

### 3. XSS Prevention

**Areas to Audit:**
- Frontend rendering
- User-generated content
- Document generation
- Email content

**Tasks:**

1. **Sanitize Frontend Output:**
   ```typescript
   // frontend/src/utils/sanitize.ts
   import DOMPurify from 'dompurify';
   
   export function sanitizeHtml(html: string): string {
     return DOMPurify.sanitize(html);
   }
   
   export function sanitizeText(text: string): string {
     return text
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#x27;');
   }
   ```

2. **Use React Safely:**
   ```tsx
   // ✅ Good: Use text content
   <div>{job.title}</div>
   
   // ✅ Good: Sanitize if needed
   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
   
   // ❌ Bad: Direct HTML injection
   // <div dangerouslySetInnerHTML={{ __html: userContent }} />
   ```

3. **Audit All User Content Rendering:**
   - Job descriptions
   - Application notes
   - User profile content
   - Generated documents

---

### 4. Credential Storage Security

**Areas to Audit:**
- API keys storage
- Database credentials
- Email credentials
- OAuth tokens

**Tasks:**

1. **Review Credential Storage:**
   ```rust
   // src-tauri/src/db/queries.rs
   // Verify credentials are encrypted
   
   // Use encryption for sensitive data
   use crate::security::encryption;
   
   pub fn store_credential(key: &str, value: &str) -> Result<()> {
       let encrypted = encryption::encrypt(value)?;
       // Store encrypted value
   }
   
   pub fn get_credential(key: &str) -> Result<String> {
       let encrypted = // Get from database
       encryption::decrypt(encrypted)
   }
   ```

2. **Implement Encryption:**
   ```rust
   // src-tauri/src/security/encryption.rs
   use sha2::{Sha256, Digest};
   use aes_gcm::{Aes256Gcm, KeyInit, aead::Aead};
   
   pub fn encrypt(data: &str) -> Result<String> {
       // Use OS keychain or encrypted storage
       // Implement AES-256-GCM encryption
   }
   
   pub fn decrypt(encrypted: &str) -> Result<String> {
       // Decrypt using same key
   }
   ```

3. **Use OS Keychain:**
   - macOS: Keychain Services
   - Windows: Credential Manager
   - Linux: Secret Service API

---

### 5. API Key Security

**Areas to Audit:**
- OpenAI API keys
- Firecrawl API keys
- Other third-party API keys

**Tasks:**

1. **Verify API Key Storage:**
   - Never in code
   - Never in logs
   - Encrypted in database
   - Use environment variables for development

2. **Add API Key Validation:**
   ```rust
   pub fn validate_api_key(key: &str) -> Result<()> {
       if key.is_empty() {
           return Err(anyhow::anyhow!("API key cannot be empty"));
       }
       if key.len() < 20 {
           return Err(anyhow::anyhow!("API key too short"));
       }
       // Check for common patterns
       Ok(())
   }
   ```

3. **Secure API Key Transmission:**
   - Use HTTPS only
   - Never log API keys
   - Rotate keys regularly
   - Use key prefixes for identification

---

### 6. File Upload Security

**Areas to Audit:**
- Resume uploads
- Document uploads
- File type validation
- File size limits

**Tasks:**

1. **Validate File Types:**
   ```rust
   pub fn validate_file_type(filename: &str, allowed_types: &[&str]) -> Result<()> {
       let ext = filename
           .split('.')
           .last()
           .ok_or_else(|| anyhow::anyhow!("No file extension"))?;
       
       if !allowed_types.contains(&ext.to_lowercase().as_str()) {
           return Err(anyhow::anyhow!("File type not allowed"));
       }
       
       Ok(())
   }
   ```

2. **Validate File Size:**
   ```rust
   pub fn validate_file_size(size: u64, max_size: u64) -> Result<()> {
       if size > max_size {
           return Err(anyhow::anyhow!("File too large"));
       }
       Ok(())
   }
   ```

3. **Scan for Malware:**
   - Consider ClamAV integration
   - Or use cloud scanning service
   - At minimum, validate file headers

---

### 7. Authentication & Authorization

**Areas to Audit:**
- User authentication
- Session management
- Permission checks
- Role-based access

**Tasks:**

1. **Review Authentication:**
   - Verify password hashing (if applicable)
   - Check session expiration
   - Verify token rotation
   - Check for session fixation

2. **Implement Authorization:**
   ```rust
   pub fn check_permission(user_id: i64, resource: &str, action: &str) -> Result<bool> {
       // Check if user has permission
       // Implement role-based access control
   }
   ```

---

### 8. Logging Security

**Areas to Audit:**
- Log content
- Sensitive data in logs
- Log storage
- Log access

**Tasks:**

1. **Sanitize Logs:**
   ```rust
   pub fn sanitize_for_logging(data: &str) -> String {
       // Remove API keys
       // Remove passwords
       // Remove sensitive data
       data.replace("api_key", "***")
           .replace("password", "***")
   }
   ```

2. **Review All Logging:**
   - Never log API keys
   - Never log passwords
   - Never log tokens
   - Sanitize user data

---

## Implementation Plan

### Phase 1: Input Validation (Day 1)
1. Create validation utilities
2. Add validation to all commands
3. Test validation

### Phase 2: Database Security (Day 1)
1. Audit all queries
2. Verify parameterization
3. Add query validation

### Phase 3: Credential Security (Day 2)
1. Implement encryption
2. Secure credential storage
3. Use OS keychain

### Phase 4: Frontend Security (Day 2)
1. Sanitize all outputs
2. Prevent XSS
3. Secure file uploads

### Phase 5: Testing & Documentation (Day 3)
1. Security testing
2. Penetration testing
3. Documentation

---

## Testing Instructions

### Security Testing

1. **Input Validation Tests:**
   - Test SQL injection attempts
   - Test XSS attempts
   - Test command injection
   - Test path traversal

2. **Authentication Tests:**
   - Test session management
   - Test token expiration
   - Test unauthorized access

3. **File Upload Tests:**
   - Test malicious files
   - Test oversized files
   - Test invalid file types

---

## Acceptance Criteria

- [ ] All inputs validated
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] Credentials encrypted
- [ ] API keys secured
- [ ] File uploads validated
- [ ] Logging sanitized
- [ ] Security tests pass
- [ ] Penetration test passed
- [ ] Security documentation complete

---

## Security Checklist

- [ ] Input validation on all inputs
- [ ] SQL injection prevention verified
- [ ] XSS prevention implemented
- [ ] Credentials encrypted
- [ ] API keys never logged
- [ ] File uploads validated
- [ ] Authentication secure
- [ ] Session management secure
- [ ] Logging sanitized
- [ ] HTTPS enforced
- [ ] Error messages don't leak info
- [ ] Rate limiting implemented
- [ ] CORS configured correctly

---

## Related Files

- `src-tauri/src/security/` - Security utilities
- `src-tauri/src/db/queries.rs` - Database queries
- `frontend/src/utils/sanitize.ts` - Frontend sanitization
- All command handlers in `lib.rs`

---

## Notes

- Security is ongoing, not one-time
- Regular security audits recommended
- Keep dependencies updated
- Monitor security advisories
- Document security decisions






