# Error Codes Reference

This document describes all error codes and error handling in the Unhireable API.

## Error Response Format

All errors follow this structure:

```typescript
{
  error: {
    code: string;
    message: string;
    details?: unknown;
  }
}
```

## Error Categories

### Database Errors

#### `DATABASE_NOT_INITIALIZED`
**Code:** `DATABASE_NOT_INITIALIZED`  
**Message:** "Database not initialized"  
**HTTP Status:** 500  
**Description:** The database connection is not available.  
**Resolution:** Restart the application or check database configuration.

---

#### `DATABASE_CONNECTION_FAILED`
**Code:** `DATABASE_CONNECTION_FAILED`  
**Message:** "Failed to connect to database"  
**HTTP Status:** 500  
**Description:** Cannot establish database connection.  
**Resolution:** Check database file permissions and disk space.

---

### Validation Errors

#### `VALIDATION_ERROR`
**Code:** `VALIDATION_ERROR`  
**Message:** "Validation failed"  
**HTTP Status:** 400  
**Description:** Input validation failed.  
**Resolution:** Check request parameters and ensure all required fields are provided.

---

#### `INVALID_INPUT`
**Code:** `INVALID_INPUT`  
**Message:** "Invalid input provided"  
**HTTP Status:** 400  
**Description:** One or more input parameters are invalid.  
**Resolution:** Review input format and constraints.

---

### Not Found Errors

#### `JOB_NOT_FOUND`
**Code:** `JOB_NOT_FOUND`  
**Message:** "Job not found"  
**HTTP Status:** 404  
**Description:** The requested job does not exist.  
**Resolution:** Verify the job ID is correct.

---

#### `APPLICATION_NOT_FOUND`
**Code:** `APPLICATION_NOT_FOUND`  
**Message:** "Application not found"  
**HTTP Status:** 404  
**Description:** The requested application does not exist.  
**Resolution:** Verify the application ID is correct.

---

#### `PROFILE_NOT_FOUND`
**Code:** `PROFILE_NOT_FOUND`  
**Message:** "User profile not found"  
**HTTP Status:** 404  
**Description:** User profile is missing or not configured.  
**Resolution:** Create a user profile in Settings.

---

#### `DOCUMENT_NOT_FOUND`
**Code:** `DOCUMENT_NOT_FOUND`  
**Message:** "Document not found"  
**HTTP Status:** 404  
**Description:** The requested document does not exist.  
**Resolution:** Verify the document ID is correct.

---

### Permission Errors

#### `PERMISSION_DENIED`
**Code:** `PERMISSION_DENIED`  
**Message:** "Permission denied"  
**HTTP Status:** 403  
**Description:** Insufficient permissions to perform the action.  
**Resolution:** Check authentication status and user permissions.

---

#### `AUTHENTICATION_REQUIRED`
**Code:** `AUTHENTICATION_REQUIRED`  
**Message:** "Authentication required"  
**HTTP Status:** 401  
**Description:** User is not authenticated.  
**Resolution:** Log in to the application.

---

### Network Errors

#### `NETWORK_ERROR`
**Code:** `NETWORK_ERROR`  
**Message:** "Network request failed"  
**HTTP Status:** 0  
**Description:** Network request failed (offline, timeout, etc.).  
**Resolution:** Check internet connection and try again.

---

#### `TIMEOUT_ERROR`
**Code:** `TIMEOUT_ERROR`  
**Message:** "Request timed out"  
**HTTP Status:** 0  
**Description:** Request exceeded timeout limit.  
**Resolution:** Retry the request or check network connection.

---

### Scraper Errors

#### `SCRAPER_ERROR`
**Code:** `SCRAPER_ERROR`  
**Message:** "Scraper error"  
**HTTP Status:** 500  
**Description:** Job scraping failed.  
**Resolution:** Check scraper configuration and source availability.

---

#### `SCRAPER_RATE_LIMIT`
**Code:** `SCRAPER_RATE_LIMIT`  
**Message:** "Rate limit exceeded"  
**HTTP Status:** 429  
**Description:** Scraper rate limit exceeded.  
**Resolution:** Wait before retrying or adjust scraper delays.

---

#### `SCRAPER_SOURCE_UNAVAILABLE`
**Code:** `SCRAPER_SOURCE_UNAVAILABLE`  
**Message:** "Scraper source unavailable"  
**HTTP Status:** 503  
**Description:** The scraper source is temporarily unavailable.  
**Resolution:** Try again later or use a different source.

---

### AI/API Errors

#### `AI_API_ERROR`
**Code:** `AI_API_ERROR`  
**Message:** "AI API error"  
**HTTP Status:** 500  
**Description:** AI service API call failed.  
**Resolution:** Check AI API key configuration and service status.

---

#### `AI_API_UNAVAILABLE`
**Code:** `AI_API_UNAVAILABLE`  
**Message:** "AI API unavailable"  
**HTTP Status:** 503  
**Description:** AI service is temporarily unavailable.  
**Resolution:** Try again later or use a different AI provider.

---

#### `AI_API_QUOTA_EXCEEDED`
**Code:** `AI_API_QUOTA_EXCEEDED`  
**Message:** "AI API quota exceeded"  
**HTTP Status:** 429  
**Description:** AI API quota/rate limit exceeded.  
**Resolution:** Wait before retrying or upgrade API plan.

---

### File Errors

#### `FILE_NOT_FOUND`
**Code:** `FILE_NOT_FOUND`  
**Message:** "File not found"  
**HTTP Status:** 404  
**Description:** The requested file does not exist.  
**Resolution:** Verify the file path is correct.

---

#### `FILE_READ_ERROR`
**Code:** `FILE_READ_ERROR`  
**Message:** "Failed to read file"  
**HTTP Status:** 500  
**Description:** Cannot read the file.  
**Resolution:** Check file permissions and format.

---

#### `FILE_WRITE_ERROR`
**Code:** `FILE_WRITE_ERROR`  
**Message:** "Failed to write file"  
**HTTP Status:** 500  
**Description:** Cannot write to the file.  
**Resolution:** Check file permissions and disk space.

---

### Email Errors

#### `EMAIL_CONFIG_ERROR`
**Code:** `EMAIL_CONFIG_ERROR`  
**Message:** "Email configuration error"  
**HTTP Status:** 400  
**Description:** Email configuration is invalid.  
**Resolution:** Check SMTP settings in Settings → Email Notifications.

---

#### `EMAIL_SEND_FAILED`
**Code:** `EMAIL_SEND_FAILED`  
**Message:** "Failed to send email"  
**HTTP Status:** 500  
**Description:** Email sending failed.  
**Resolution:** Check email configuration and SMTP server status.

---

### Automation Errors

#### `AUTOMATION_FAILED`
**Code:** `AUTOMATION_FAILED`  
**Message:** "Automation failed"  
**HTTP Status:** 500  
**Description:** Browser automation failed.  
**Resolution:** Check browser automation setup and form structure.

---

#### `ATS_DETECTION_FAILED`
**Code:** `ATS_DETECTION_FAILED`  
**Message:** "ATS detection failed"  
**HTTP Status:** 500  
**Description:** Failed to detect ATS system.  
**Resolution:** Verify job URL is accessible.

---

### Unknown Errors

#### `UNKNOWN_ERROR`
**Code:** `UNKNOWN_ERROR`  
**Message:** "An unexpected error occurred"  
**HTTP Status:** 500  
**Description:** An unexpected error occurred.  
**Resolution:** Check application logs and report the issue.

---

## Error Handling Best Practices

1. **Always check for errors** after API calls
2. **Display user-friendly messages** based on error codes
3. **Log technical details** for debugging
4. **Provide retry options** for retryable errors
5. **Handle network errors gracefully** with offline detection

## Retryable Errors

The following errors are retryable:
- `NETWORK_ERROR`
- `TIMEOUT_ERROR`
- `SCRAPER_ERROR` (some cases)
- `AI_API_UNAVAILABLE`
- `SERVER_ERROR` (5xx)

## Non-Retryable Errors

The following errors should not be retried:
- `VALIDATION_ERROR`
- `PERMISSION_DENIED`
- `NOT_FOUND` errors
- `AUTHENTICATION_REQUIRED`

---

**Last Updated:** 2024








