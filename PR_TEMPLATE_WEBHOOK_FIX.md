# Fix: Webhook JSON Payload with Multiline Messages

## 🐛 Fixes Issue
Fixes #3778

## 📝 Description
This PR adds JSON escaping filters to the Liquid template engine for webhook custom body templates, resolving issues where messages containing newlines, quotes, or other special characters would produce invalid JSON payloads.

### Problem
When PING monitors go DOWN, their error messages often contain newlines:
```
ping: cannot resolve example.com: Unknown host
ping: cannot resolve example.com: Unknown host
```

If a webhook uses a custom JSON template like:
```json
{"message": "{{msg}}"}
```

The rendered output becomes invalid JSON:
```json
{"message": "ping: cannot resolve example.com: Unknown host
ping: cannot resolve example.com: Unknown host"}
```

This causes HTTP 400 errors: `{"error":{"message":"Unexpected token \""}}`

### Solution
Added two Liquid template filters for proper JSON handling:

1. **`json_escape`**: Escapes special characters for JSON string values
   ```liquid
   {"message": "{{msg | json_escape}}"}
   ```

2. **`json`**: Full JSON serialization of any value
   ```liquid
   {"message": {{msg | json}}, "data": {{heartbeatJSON | json}}}
   ```

## ✅ Type of Change
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## 🧪 Testing
- [x] Added comprehensive test suite for webhook JSON payload handling
- [x] Tested with messages containing newlines
- [x] Tested with messages containing quotes
- [x] Tested custom templates with `json_escape` filter
- [x] Verified backwards compatibility (existing templates still work)
- [x] All existing tests pass
- [x] Linter passes

### Test Results
```
✔ should handle newlines in message correctly
✔ should handle double quotes in message correctly
✔ should handle special characters in custom body template with json_escape filter
```

## 📸 Screenshots / Examples

**Before (invalid JSON):**
```json
{"message": "Error
Line 2"}
```

**After (valid JSON):**
```json
{"message": "Error\nLine 2"}
```

## ✔️ Checklist
- [x] My code follows the code style of this project
- [x] My change requires a change to the documentation
- [x] I have updated the documentation accordingly (WEBHOOK_FIX_SUMMARY.md)
- [x] I have read the CONTRIBUTING document
- [x] I have added tests to cover my changes
- [x] All new and existing tests passed
- [x] Translation keys are added in `src/lang/en.json` (if applicable) - N/A for this fix
- [x] I have self-reviewed my code
- [x] I have commented my code in hard-to-understand areas (if applicable)

## 🔄 Backwards Compatibility
✅ **Fully backwards compatible**

- Default webhook mode (no custom template) is unaffected
- Existing custom templates continue to work without modification
- New filters are opt-in and only used when explicitly added to templates

## 📚 Related Issues / PRs
- #3778 - Main issue: Webhook multiline message corruption
- #4861 - Related: Webhook custom body newline handling

## 📖 Migration Guide
For users experiencing issues with special characters in webhook custom templates:

**Update your template from:**
```liquid
{"message": "{{msg}}"}
```

**To:**
```liquid
{"message": "{{msg | json_escape}}"}
```

Or use full JSON serialization:
```liquid
{"message": {{msg | json}}}
```

## 🎯 Impact
- **Low risk**: Only affects custom webhook templates that explicitly use the new filters
- **High value**: Fixes a critical bug preventing webhook notifications from working with common monitor types (PING, DNS, etc.)
- **User-friendly**: Provides proper tools for creating JSON templates without manual escaping

## 🔍 Additional Context
The default webhook mode already handled special characters correctly by passing JavaScript objects to axios, which uses `JSON.stringify()`. This fix extends that same robustness to custom templates by exposing JSON escaping functionality through Liquid filters.

---

**Pull Request Checklist by Contributor:**
- [x] Meaningful commit message
- [x] Tests added/updated
- [x] Documentation added/updated
- [x] Linter passed
- [x] Self-review completed
