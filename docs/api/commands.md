# API Reference - Tauri Commands

This document provides comprehensive documentation for all 92 Tauri commands available in the Unhireable application.

## Table of Contents

- [Job Commands](#job-commands)
- [Application Commands](#application-commands)
- [Contact Commands](#contact-commands)
- [Interview Commands](#interview-commands)
- [Document Commands](#document-commands)
- [Activity Commands](#activity-commands)
- [Credential Commands](#credential-commands)
- [User Profile Commands](#user-profile-commands)
- [Authentication Commands](#authentication-commands)
- [Document Generation Commands](#document-generation-commands)
- [Job Matching Commands](#job-matching-commands)
- [Recommendation & Insights Commands](#recommendation--insights-commands)
- [Email Notification Commands](#email-notification-commands)
- [Desktop Notification Commands](#desktop-notification-commands)
- [Persona Commands](#persona-commands)
- [ATS Suggestions Commands](#ats-suggestions-commands)
- [Resume Analysis Commands](#resume-analysis-commands)
- [Auto-Apply Commands](#auto-apply-commands)

---

## Job Commands

### `get_jobs`

Retrieves a list of jobs with optional filtering, search, and pagination.

**Parameters:**
- `status: Option<String>` - Filter by job status (e.g., "saved", "applied", "rejected")
- `query: Option<String>` - Search query to filter jobs by title, company, description, or requirements
- `page: Option<usize>` - Page number for pagination (default: 1)
- `page_size: Option<usize>` - Number of jobs per page (default: all if not specified)

**Returns:**
- `Result<Vec<Job>>` - Array of job objects

**Example:**
```typescript
const jobs = await invoke('get_jobs', {
  status: 'saved',
  query: 'developer',
  page: 1,
  page_size: 20
});
```

**Errors:**
- `Database not initialized` - Database connection failed

---

### `get_job`

Retrieves a single job by ID.

**Parameters:**
- `id: i64` - The job ID

**Returns:**
- `Result<Option<Job>>` - Job object or null if not found

**Example:**
```typescript
const job = await invoke('get_job', { id: 123 });
```

**Errors:**
- `Database not initialized` - Database connection failed

---

### `create_job`

Creates a new job entry.

**Parameters:**
- `job: Job` - Job object with all required fields

**Returns:**
- `Result<Job>` - Created job object with ID

**Example:**
```typescript
const newJob = await invoke('create_job', {
  job: {
    title: 'Senior Developer',
    company: 'Tech Corp',
    url: 'https://example.com/job/1',
    description: 'Job description...',
    requirements: 'Requirements...',
    location: 'Remote',
    source: 'linkedin',
    status: 'saved'
  }
});
```

**Errors:**
- `Database not initialized` - Database connection failed
- Validation errors for missing required fields

---

### `update_job`

Updates an existing job.

**Parameters:**
- `job: Job` - Job object with updated fields (must include ID)

**Returns:**
- `Result<Job>` - Updated job object

**Example:**
```typescript
const updated = await invoke('update_job', {
  job: {
    id: 123,
    title: 'Updated Title',
    // ... other fields
  }
});
```

**Errors:**
- `Database not initialized` - Database connection failed
- `Job not found` - Job with given ID doesn't exist

---

### `delete_job`

Deletes a job by ID.

**Parameters:**
- `id: i64` - The job ID to delete

**Returns:**
- `Result<()>` - Success

**Example:**
```typescript
await invoke('delete_job', { id: 123 });
```

**Errors:**
- `Database not initialized` - Database connection failed
- `Job not found` - Job with given ID doesn't exist

---

### `scrape_jobs`

Scrapes jobs from configured sources based on a search query.

**Parameters:**
- `query: String` - Search query (e.g., "React developer")
- `sources: Option<Vec<String>>` - Optional list of source names to scrape from

**Returns:**
- `Result<Vec<Job>>` - Array of scraped jobs

**Example:**
```typescript
const jobs = await invoke('scrape_jobs', {
  query: 'React developer',
  sources: ['linkedin', 'wellfound']
});
```

**Errors:**
- `Scraper error` - Scraping failed for one or more sources
- Network errors

---

### `scrape_jobs_selected`

Scrapes jobs from selected sources with advanced configuration.

**Parameters:**
- `query: String` - Search query
- `selected_sources: Vec<String>` - List of source names to scrape
- `config: Option<ScraperConfig>` - Optional scraper configuration

**Returns:**
- `Result<Vec<Job>>` - Array of scraped jobs

**Example:**
```typescript
const jobs = await invoke('scrape_jobs_selected', {
  query: 'Python developer',
  selected_sources: ['hh_kz', 'remote_ok'],
  config: {
    max_results: 50,
    delay_ms: 1000
  }
});
```

**Errors:**
- `Scraper error` - Scraping failed
- Network errors

---

## Application Commands

### `get_applications`

Retrieves a list of applications with optional filtering.

**Parameters:**
- `job_id: Option<i64>` - Filter by job ID
- `status: Option<String>` - Filter by application status

**Returns:**
- `Result<Vec<Application>>` - Array of application objects

**Example:**
```typescript
const applications = await invoke('get_applications', {
  job_id: 123,
  status: 'pending'
});
```

---

### `create_application`

Creates a new application for a job.

**Parameters:**
- `application: Application` - Application object

**Returns:**
- `Result<Application>` - Created application object

**Example:**
```typescript
const app = await invoke('create_application', {
  application: {
    job_id: 123,
    status: 'pending',
    applied_at: new Date().toISOString()
  }
});
```

---

### `update_application`

Updates an existing application.

**Parameters:**
- `application: Application` - Application object with updated fields

**Returns:**
- `Result<Application>` - Updated application object

---

### `delete_application`

Deletes an application by ID.

**Parameters:**
- `id: i64` - Application ID

**Returns:**
- `Result<()>` - Success

---

## Contact Commands

### `get_contacts`

Retrieves contacts, optionally filtered by job ID.

**Parameters:**
- `job_id: Option<i64>` - Filter by job ID

**Returns:**
- `Result<Vec<Contact>>` - Array of contact objects

---

### `create_contact`

Creates a new contact.

**Parameters:**
- `contact: Contact` - Contact object

**Returns:**
- `Result<Contact>` - Created contact object

---

### `update_contact`

Updates an existing contact.

**Parameters:**
- `contact: Contact` - Contact object with updated fields

**Returns:**
- `Result<Contact>` - Updated contact object

---

### `delete_contact`

Deletes a contact by ID.

**Parameters:**
- `id: i64` - Contact ID

**Returns:**
- `Result<()>` - Success

---

## Interview Commands

### `get_interviews`

Retrieves interviews, optionally filtered by application ID.

**Parameters:**
- `application_id: Option<i64>` - Filter by application ID

**Returns:**
- `Result<Vec<Interview>>` - Array of interview objects

---

### `create_interview`

Creates a new interview record.

**Parameters:**
- `interview: Interview` - Interview object

**Returns:**
- `Result<Interview>` - Created interview object

---

### `update_interview`

Updates an existing interview.

**Parameters:**
- `interview: Interview` - Interview object with updated fields

**Returns:**
- `Result<Interview>` - Updated interview object

---

### `delete_interview`

Deletes an interview by ID.

**Parameters:**
- `id: i64` - Interview ID

**Returns:**
- `Result<()>` - Success

---

## Document Commands

### `get_documents`

Retrieves documents, optionally filtered by type or job ID.

**Parameters:**
- `document_type: Option<String>` - Filter by document type
- `job_id: Option<i64>` - Filter by job ID

**Returns:**
- `Result<Vec<Document>>` - Array of document objects

---

### `create_document`

Creates a new document record.

**Parameters:**
- `document: Document` - Document object

**Returns:**
- `Result<Document>` - Created document object

---

### `update_document`

Updates an existing document.

**Parameters:**
- `document: Document` - Document object with updated fields

**Returns:**
- `Result<Document>` - Updated document object

---

### `delete_document`

Deletes a document by ID.

**Parameters:**
- `id: i64` - Document ID

**Returns:**
- `Result<()>` - Success

---

## Activity Commands

### `get_activities`

Retrieves activity log entries.

**Parameters:**
- `entity_type: Option<String>` - Filter by entity type (e.g., "job", "application")
- `limit: Option<usize>` - Maximum number of activities to return

**Returns:**
- `Result<Vec<Activity>>` - Array of activity objects

**Example:**
```typescript
const activities = await invoke('get_activities', {
  entity_type: 'job',
  limit: 50
});
```

---

## Credential Commands

### `get_credential`

Retrieves a credential by platform name.

**Parameters:**
- `platform: String` - Platform name (e.g., "openai", "gmail")

**Returns:**
- `Result<Option<Credential>>` - Credential object or null

---

### `create_credential`

Creates a new credential.

**Parameters:**
- `credential: Credential` - Credential object

**Returns:**
- `Result<Credential>` - Created credential object

---

### `update_credential`

Updates an existing credential.

**Parameters:**
- `credential: Credential` - Credential object with updated fields

**Returns:**
- `Result<Credential>` - Updated credential object

---

### `list_credentials`

Lists all stored credentials.

**Parameters:**
- None

**Returns:**
- `Result<Vec<Credential>>` - Array of credential objects

---

### `delete_credential`

Deletes a credential by platform name.

**Parameters:**
- `platform: String` - Platform name

**Returns:**
- `Result<()>` - Success

---

## User Profile Commands

### `save_user_profile`

Saves or updates the user profile.

**Parameters:**
- `profile: UserProfile` - User profile object

**Returns:**
- `Result<UserProfile>` - Saved profile object

**Example:**
```typescript
const profile = await invoke('save_user_profile', {
  profile: {
    personal_info: {
      name: 'John Doe',
      email: 'john@example.com',
      // ...
    },
    skills: {
      technical_skills: ['React', 'TypeScript'],
      // ...
    },
    // ...
  }
});
```

---

### `get_user_profile`

Retrieves the current user profile.

**Parameters:**
- None

**Returns:**
- `Result<Option<UserProfile>>` - User profile object or null

---

## Authentication Commands

### `auth_get_status`

Gets the current authentication status.

**Parameters:**
- None

**Returns:**
- `Result<AuthStatus>` - Authentication status object

**Example:**
```typescript
const status = await invoke('auth_get_status');
// Returns: { configured: true, authenticated: true, user_id: "..." }
```

---

### `auth_setup`

Sets up authentication (first-time setup).

**Parameters:**
- `password: String` - Master password

**Returns:**
- `Result<()>` - Success

---

### `auth_login`

Logs in with password.

**Parameters:**
- `password: String` - Master password

**Returns:**
- `Result<()>` - Success

**Errors:**
- `Invalid password` - Password is incorrect

---

### `auth_logout`

Logs out the current user.

**Parameters:**
- None

**Returns:**
- `Result<()>` - Success

---

## Document Generation Commands

### `generate_resume`

Generates a tailored resume for a specific job.

**Parameters:**
- `profile: UserProfile` - User profile
- `job_id: i64` - Job ID
- `template_name: Option<String>` - Template name (optional)
- `improve_with_ai: Option<bool>` - Whether to use AI improvement (default: false)

**Returns:**
- `Result<GeneratedDocument>` - Generated resume document

**Example:**
```typescript
const resume = await invoke('generate_resume', {
  profile: userProfile,
  job_id: 123,
  template_name: 'resume_modern',
  improve_with_ai: true
});
```

**Errors:**
- `Job not found` - Job doesn't exist
- `Profile not found` - User profile is missing
- `AI API error` - AI service unavailable (if improve_with_ai is true)

---

### `generate_cover_letter`

Generates a tailored cover letter for a specific job.

**Parameters:**
- `profile: UserProfile` - User profile
- `job_id: i64` - Job ID
- `template_name: Option<String>` - Template name (optional)
- `improve_with_ai: Option<bool>` - Whether to use AI improvement (default: false)

**Returns:**
- `Result<GeneratedDocument>` - Generated cover letter document

---

### `generate_email_version`

Generates an email-friendly version of a document.

**Parameters:**
- `document_content: String` - Document content
- `format: Option<String>` - Output format (default: "text")

**Returns:**
- `Result<String>` - Email-formatted document

---

### `export_document_to_pdf`

Exports a document to PDF format.

**Parameters:**
- `content: String` - Document content
- `output_path: String` - Output file path

**Returns:**
- `Result<String>` - Path to generated PDF

---

### `get_available_resume_templates`

Lists all available resume templates.

**Parameters:**
- None

**Returns:**
- `Result<Vec<String>>` - Array of template names

---

### `get_available_cover_letter_templates`

Lists all available cover letter templates.

**Parameters:**
- None

**Returns:**
- `Result<Vec<String>>` - Array of template names

---

### `analyze_job_for_profile`

Analyzes a job posting and provides insights for profile improvement.

**Parameters:**
- `job_id: i64` - Job ID
- `profile: UserProfile` - User profile

**Returns:**
- `Result<JobAnalysis>` - Analysis results with recommendations

---

### `optimize_document_for_ats`

Optimizes a document for ATS (Applicant Tracking System) compatibility.

**Parameters:**
- `document_content: String` - Document content
- `job_description: String` - Job description

**Returns:**
- `Result<String>` - Optimized document content

---

### `check_ats_compatibility`

Checks ATS compatibility of a document.

**Parameters:**
- `document_content: String` - Document content

**Returns:**
- `Result<AtsCompatibility>` - Compatibility score and issues

---

### `score_document_quality`

Scores the quality of a document.

**Parameters:**
- `document_content: String` - Document content
- `job_description: String` - Job description

**Returns:**
- `Result<f64>` - Quality score (0-100)

---

### `list_ai_providers`

Lists available AI providers for document generation.

**Parameters:**
- None

**Returns:**
- `Result<Vec<String>>` - Array of provider names

---

### `generate_resume_with_provider`

Generates a resume using a specific AI provider.

**Parameters:**
- `profile: UserProfile` - User profile
- `job_id: i64` - Job ID
- `provider: String` - AI provider name
- `template_name: Option<String>` - Template name

**Returns:**
- `Result<GeneratedDocument>` - Generated resume

---

### `generate_bulk_documents`

Generates multiple documents for multiple jobs.

**Parameters:**
- `profile: UserProfile` - User profile
- `job_ids: Vec<i64>` - Array of job IDs
- `document_type: String` - Document type ("resume" or "cover_letter")

**Returns:**
- `Result<Vec<GeneratedDocument>>` - Array of generated documents

---

### `create_document_version`

Creates a version of a document for version control.

**Parameters:**
- `document_id: i64` - Document ID
- `content: String` - Document content
- `notes: Option<String>` - Version notes

**Returns:**
- `Result<DocumentVersion>` - Created version object

---

### `get_document_versions`

Retrieves all versions of a document.

**Parameters:**
- `document_id: i64` - Document ID

**Returns:**
- `Result<Vec<DocumentVersion>>` - Array of document versions

---

### `restore_document_version`

Restores a specific version of a document.

**Parameters:**
- `version_id: i64` - Version ID

**Returns:**
- `Result<DocumentVersion>` - Restored version object

---

### `translate_document`

Translates a document to another language.

**Parameters:**
- `document_content: String` - Document content
- `target_language: String` - Target language code (e.g., "es", "fr")

**Returns:**
- `Result<String>` - Translated document content

---

### `get_available_languages`

Lists available languages for translation.

**Parameters:**
- None

**Returns:**
- `Result<Vec<String>>` - Array of language codes

---

## Job Matching Commands

### `calculate_job_match_score`

Calculates the match score between a job and user profile.

**Parameters:**
- `job_id: i64` - Job ID
- `profile: UserProfile` - User profile

**Returns:**
- `Result<JobMatchResult>` - Match result with score and details

**Example:**
```typescript
const match = await invoke('calculate_job_match_score', {
  job_id: 123,
  profile: userProfile
});
// Returns: { match_score: 85.5, skills_match: 90.0, ... }
```

---

### `match_jobs_for_profile`

Matches all jobs against a user profile.

**Parameters:**
- `profile: UserProfile` - User profile
- `min_score: Option<f64>` - Minimum match score threshold

**Returns:**
- `Result<Vec<JobMatchResult>>` - Array of match results, sorted by score

---

### `update_job_match_scores`

Updates match scores for all jobs.

**Parameters:**
- `profile: UserProfile` - User profile

**Returns:**
- `Result<()>` - Success

---

## Recommendation & Insights Commands

### `get_recommended_jobs`

Gets personalized job recommendations.

**Parameters:**
- `limit: Option<usize>` - Maximum number of recommendations

**Returns:**
- `Result<Vec<RecommendedJob>>` - Array of recommended jobs

---

### `get_trending_jobs`

Gets trending jobs based on activity.

**Parameters:**
- `limit: Option<usize>` - Maximum number of jobs

**Returns:**
- `Result<Vec<Job>>` - Array of trending jobs

---

### `get_similar_jobs`

Gets jobs similar to a given job.

**Parameters:**
- `job_id: i64` - Job ID
- `limit: Option<usize>` - Maximum number of similar jobs

**Returns:**
- `Result<Vec<Job>>` - Array of similar jobs

---

### `track_job_interaction`

Tracks user interaction with a job (view, save, apply, etc.).

**Parameters:**
- `job_id: i64` - Job ID
- `interaction_type: String` - Type of interaction ("view", "save", "apply", "dismiss", "ignore")

**Returns:**
- `Result<()>` - Success

---

### `get_resume_environment_status`

Gets the status of the resume analysis environment.

**Parameters:**
- None

**Returns:**
- `Result<ResumeEnvironmentStatus>` - Environment status

---

### `get_market_insights`

Gets market insights and trends.

**Parameters:**
- `query: Option<String>` - Optional search query

**Returns:**
- `Result<MarketInsights>` - Market insights data

---

### `automation_health_check`

Checks the health of automation systems.

**Parameters:**
- None

**Returns:**
- `Result<AutomationHealth>` - Health status

---

## Email Notification Commands

### `test_email_connection`

Tests the email connection configuration.

**Parameters:**
- None

**Returns:**
- `Result<()>` - Success if connection works

**Errors:**
- `Email configuration error` - Invalid SMTP settings
- `Connection failed` - Cannot connect to SMTP server

---

### `send_test_email`

Sends a test email.

**Parameters:**
- `to: String` - Recipient email address

**Returns:**
- `Result<()>` - Success

---

### `send_job_match_email_with_result`

Sends an email notification for a job match.

**Parameters:**
- `job_id: i64` - Job ID
- `match_result: JobMatchResult` - Match result

**Returns:**
- `Result<()>` - Success

---

### `send_new_jobs_notification_email`

Sends an email notification for new jobs.

**Parameters:**
- `jobs: Vec<Job>` - Array of new jobs

**Returns:**
- `Result<()>` - Success

---

### `extract_emails_from_jobs`

Extracts email addresses from job descriptions.

**Parameters:**
- `job_ids: Option<Vec<i64>>` - Optional list of job IDs (extracts from all if not provided)

**Returns:**
- `Result<Vec<String>>` - Array of extracted email addresses

---

### `create_contacts_from_jobs`

Creates contact records from extracted emails.

**Parameters:**
- `job_ids: Option<Vec<i64>>` - Optional list of job IDs

**Returns:**
- `Result<Vec<Contact>>` - Array of created contacts

---

## Desktop Notification Commands

### `send_desktop_notification`

Sends a desktop notification.

**Parameters:**
- `title: String` - Notification title
- `body: String` - Notification body

**Returns:**
- `Result<()>` - Success

---

### `send_desktop_job_match`

Sends a desktop notification for a job match.

**Parameters:**
- `job_id: i64` - Job ID
- `match_score: f64` - Match score

**Returns:**
- `Result<()>` - Success

---

### `send_desktop_new_jobs`

Sends a desktop notification for new jobs.

**Parameters:**
- `count: usize` - Number of new jobs

**Returns:**
- `Result<()>` - Success

---

### `send_desktop_application_status`

Sends a desktop notification for application status change.

**Parameters:**
- `application_id: i64` - Application ID
- `status: String` - New status

**Returns:**
- `Result<()>` - Success

---

### `send_desktop_application_success`

Sends a desktop notification for successful application.

**Parameters:**
- `application_id: i64` - Application ID

**Returns:**
- `Result<()>` - Success

---

### `request_notification_permission`

Requests permission for desktop notifications.

**Parameters:**
- None

**Returns:**
- `Result<bool>` - True if permission granted

---

## Persona Commands

### `list_personas_catalog`

Lists available test personas.

**Parameters:**
- None

**Returns:**
- `Result<Vec<String>>` - Array of persona names

---

### `load_test_persona`

Loads a test persona profile.

**Parameters:**
- `persona_name: String` - Persona name

**Returns:**
- `Result<UserProfile>` - Persona profile

---

### `persona_dry_run`

Performs a dry run with a test persona.

**Parameters:**
- `persona_name: String` - Persona name
- `job_id: i64` - Job ID

**Returns:**
- `Result<GeneratedDocument>` - Generated document

---

## ATS Suggestions Commands

### `get_ats_suggestions`

Gets suggestions for ATS (Applicant Tracking System) optimization.

**Parameters:**
- `job_url: String` - Job posting URL

**Returns:**
- `Result<AtsSuggestion>` - ATS suggestions and tips

**Example:**
```typescript
const suggestions = await invoke('get_ats_suggestions', {
  job_url: 'https://example.com/job/123'
});
// Returns: { ats_type: "Greenhouse", confidence: "high", tips: [...], ... }
```

---

## Resume Analysis Commands

### `analyze_resume`

Analyzes a resume file and extracts information.

**Parameters:**
- `file_path: String` - Path to resume file (PDF or DOCX)

**Returns:**
- `Result<ResumeAnalysis>` - Analysis results

**Example:**
```typescript
const analysis = await invoke('analyze_resume', {
  file_path: '/path/to/resume.pdf'
});
// Returns: { skills: [...], experience: [...], education: [...], ... }
```

---

## Auto-Apply Commands

### `auto_apply_to_jobs`

Automatically applies to jobs using browser automation.

**Parameters:**
- `job_ids: Vec<i64>` - Array of job IDs to apply to
- `config: Option<ApplicationConfig>` - Optional application configuration

**Returns:**
- `Result<Vec<ApplicationResult>>` - Array of application results

**Example:**
```typescript
const results = await invoke('auto_apply_to_jobs', {
  job_ids: [123, 456, 789],
  config: {
    resume_path: '/path/to/resume.pdf',
    cover_letter_path: '/path/to/cover_letter.pdf',
    dry_run: false
  }
});
```

**Errors:**
- `Browser automation failed` - Browser automation error
- `Job not found` - One or more jobs don't exist
- `Application failed` - Application submission failed

---

## Error Codes

All commands may return the following error types:

- `Database not initialized` - Database connection not available
- `Not found` - Requested resource doesn't exist
- `Validation error` - Invalid input parameters
- `Permission denied` - Insufficient permissions
- `Network error` - Network request failed
- `Server error` - Internal server error

---

## Type Definitions

See `docs/api/types.md` for detailed type definitions for all data structures used in the API.

---

**Last Updated:** 2024
**Total Commands:** 92








