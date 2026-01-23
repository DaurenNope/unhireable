# ATS Suggestions Implementation Plan

## Overview
Add clear ATS detection and suggestions to help users understand:
1. What ATS system is being used
2. Automation support level
3. Tips for applying
4. Known quirks/limitations

## Backend Implementation

### 1. Add `get_ats_suggestions` Tauri Command

Location: `src-tauri/src/lib.rs`

```rust
#[derive(serde::Serialize)]
struct AtsSuggestion {
    ats_type: Option<String>,
    confidence: String, // "high", "medium", "low"
    tips: Vec<String>,
    known_quirks: Vec<String>,
    automation_support: String, // "full", "partial", "manual"
}

#[tauri::command]
async fn get_ats_suggestions(job_url: String) -> Result<AtsSuggestion> {
    use crate::applicator::ats_detector::AtsDetector;
    
    let detected = AtsDetector::detect_ats(&job_url);
    let ats_type_str = detected.as_ref().map(|ats| format!("{:?}", ats));
    
    // Match on detected ATS type and return appropriate suggestions
    // (Implementation details in the actual code)
}
```

### 2. Register Command in Handler

Add to `generate_handler!` macro:
```rust
get_ats_suggestions,
```

## Frontend Implementation

### 1. Add API Method

Location: `frontend/src/api/client.ts`

```typescript
export const atsApi = {
  getSuggestions: (jobUrl: string) =>
    apiCall<{
      ats_type: string | null;
      confidence: string;
      tips: string[];
      known_quirks: string[];
      automation_support: string;
    }>('get_ats_suggestions', { job_url: jobUrl }),
};
```

### 2. Create ATS Suggestions Component

Location: `frontend/src/components/ats-suggestions.tsx`

Features:
- Display detected ATS type with confidence badge
- Show automation support level (Full/Partial/Manual)
- List helpful tips
- Show known quirks/limitations
- Color-coded badges for confidence and support levels

### 3. Integrate into Job Details Page

Add the component to `frontend/src/pages/job-details.tsx`:
- Show ATS suggestions card when viewing a job
- Fetch suggestions when job URL is available
- Display prominently near the "Apply" button

## ATS-Specific Guidance

### Greenhouse
- **Automation**: Full support
- **Tips**: Well-structured forms, resume required, cover letter optional
- **Quirks**: Custom questions may require manual review, 5MB file limit

### Lever
- **Automation**: Full support
- **Tips**: Clean form structure, portfolio/GitHub/LinkedIn URLs common
- **Quirks**: Dynamic fields, specific format requirements

### Workday
- **Automation**: Partial support
- **Tips**: Complex multi-step forms, may need account creation
- **Quirks**: Many required fields, custom configurations, PDF preferred

### Workable
- **Automation**: Full support
- **Tips**: Well-structured, resume required, cover letter can be text or file
- **Quirks**: Consent checkboxes, 10MB file limit

### LinkedIn Easy Apply
- **Automation**: Full support
- **Tips**: Quick applications, uses LinkedIn profile resume
- **Quirks**: May require Premium, pre-filled fields

### Custom/Unknown
- **Automation**: Manual
- **Tips**: Review form structure, test with dry-run
- **Quirks**: Unique validation, possible CAPTCHA

## Testing

1. Test with various job URLs from different ATS systems
2. Verify suggestions are accurate and helpful
3. Ensure UI displays correctly on job details page
4. Test with unknown/custom forms

