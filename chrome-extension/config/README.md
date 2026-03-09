# Answer Patterns Config

`answer-patterns.json` defines how the extension maps form questions to answers from your profile or literal values. **Edit this file to add or change patterns** — no code changes needed.

## Schema

| Field | Description |
|-------|-------------|
| `labelPatterns` | Substrings to match in the question (case-insensitive). |
| `matchType` | `"all"` = every pattern must match. `"any"` = at least one. Default: `"all"`. |
| `excludePatterns` | If any of these appear in the label, this pattern is skipped. |
| `source` | `"literal"` = fixed value. `"profile"` = from user profile. |
| `literalValue` | Used when `source` is `"literal"`. |
| `profilePath` | Dot path into profile, e.g. `"personal_info.email"`. |
| `fallbackPath` | If `profilePath` is empty, try this path. |
| `default` | Value when profile path is empty. |
| `transform` | `"first_word"` \| `"rest_after_first"` \| `"sponsorship_yes_no"`. |

## Order

First matching pattern wins. Put more specific patterns before generic ones.

## Example

```json
{
  "id": "years_experience",
  "labelPatterns": ["years", "experience"],
  "matchType": "all",
  "source": "profile",
  "profilePath": "personal_info.years_experience",
  "default": "5"
}
```
