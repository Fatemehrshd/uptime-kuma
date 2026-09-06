# Webhook JSON Payload Fix - Issue #3778

## Problem

When using the Webhook notification provider with messages containing newlines (common in PING monitor DOWN events), custom JSON templates would produce invalid JSON payloads, causing notifications to fail with errors like:

```
Error: AxiosError: Request failed with status code 400 {"status":400,"error":{"message":"Unexpected token \""}}
```

This occurred because values containing newlines, quotes, or other special characters were inserted directly into JSON template strings without proper escaping.

## Root Cause

When users configured custom webhook templates like:
```json
{
  "message": "{{msg}}",
  "monitor": "{{monitorJSON.name}}"
}
```

And the `msg` contained newlines (e.g., from a PING failure):
```
ping: cannot resolve example.com: Unknown host
ping: cannot resolve example.com: Unknown host
```

The rendered template would become:
```json
{
  "message": "ping: cannot resolve example.com: Unknown host
ping: cannot resolve example.com: Unknown host",
  "monitor": "My Monitor"
}
```

This is invalid JSON because newlines inside string literals must be escaped as `\n`.

## Solution

Added two Liquid template filters to the `NotificationProvider` base class for proper JSON handling:

### 1. `json_escape` Filter
Escapes special characters for use inside JSON string values:
- Newlines (`\n`)
- Quotes (`"`)
- Backslashes (`\`)
- Tabs (`\t`)
- etc.

**Usage:**
```liquid
{"message": "{{msg | json_escape}}"}
```

**Result:**
```json
{"message": "ping: cannot resolve example.com: Unknown host\nping: cannot resolve example.com: Unknown host"}
```

### 2. `json` Filter
Converts any value to its complete JSON representation (includes surrounding quotes for strings, handles objects/arrays):

**Usage:**
```liquid
{"message": {{msg | json}}, "data": {{heartbeatJSON | json}}}
```

**Result:**
```json
{"message": "escaped string value", "data": {"status": 0, "time": "..."}}
```

## Changes Made

### File: `server/notification-providers/notification-provider.js`

Added filter registration in the `renderTemplate` method:

```javascript
// Register filter for JSON string escaping
engine.registerFilter("json_escape", (value) => {
    if (value === null || value === undefined) {
        return "";
    }
    // JSON.stringify escapes special characters, but also adds quotes
    // We remove the surrounding quotes to get just the escaped content
    const stringified = JSON.stringify(String(value));
    return stringified.slice(1, -1);
});

// Register filter for full JSON serialization
engine.registerFilter("json", (value) => {
    return JSON.stringify(value);
});
```

### File: `test/backend-test/notification-providers/test-webhook.js` (NEW)

Added comprehensive tests covering:
1. Default mode with newlines (verifies #3778 doesn't affect default webhooks)
2. Default mode with quotes
3. Custom template mode with `json_escape` filter

## Backwards Compatibility

✅ **Fully backwards compatible**

- Existing webhooks using the default mode (no custom template) are unaffected
- Existing custom templates without filters continue to work as before
- New filters are opt-in - users must explicitly use them in templates

## Migration Guide for Users

If you're using custom webhook templates with JSON and experiencing issues with special characters:

**Before:**
```liquid
{
  "message": "{{msg}}",
  "status": "{{status}}"
}
```

**After:**
```liquid
{
  "message": "{{msg | json_escape}}",
  "status": "{{status | json_escape}}"
}
```

Or use the `json` filter for complete serialization:
```liquid
{
  "message": {{msg | json}},
  "monitor": {{monitorJSON | json}},
  "heartbeat": {{heartbeatJSON | json}}
}
```

## Testing

All tests pass:
```bash
✔ should handle newlines in message correctly
✔ should handle double quotes in message correctly  
✔ should handle special characters in custom body template with json_escape filter
```

The tests verify that:
- Default webhook mode correctly handles newlines and special characters
- Custom templates with `json_escape` filter produce valid JSON
- Values round-trip correctly through JSON serialization

## Related Issues

- Fixes #3778 - Webhook notification provider with multiline messages
- Related to #4861 - Webhook custom body {{msg}} newline issues

## Implementation Details

The fix leverages JavaScript's built-in `JSON.stringify()` which properly escapes all special characters according to the JSON specification. By using `json_escape`, we extract just the escaped content (without the surrounding quotes that `JSON.stringify` adds), making it suitable for insertion into JSON string literals.

For non-JSON custom templates (XML, plain text, etc.), users should continue to use unfiltered variables as before.
