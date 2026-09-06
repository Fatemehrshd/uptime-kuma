# 🚀 Quick Test Guide - 5 Minutes

Want to test the webhook fix quickly? Here's the fastest way:

## 1. Start Both Servers (2 terminals)

**Terminal 1 - Uptime Kuma:**
```bash
cd "/Users/Fatemeh/Documents/Codeless/session 10/uptime-kuma"
git checkout fix/webhook-multiline-payload
npm run start-server-dev
```

**Terminal 2 - Webhook Test Server:**
```bash
cd "/Users/Fatemeh/Documents/Codeless/session 10/uptime-kuma"
node test-webhook-server.js
```

## 2. Open Browser

Go to: http://localhost:3001

## 3. Create Failing Monitor (2 minutes)

1. Click "Add New Monitor"
2. Set these values:
   - **Monitor Type**: Ping
   - **Friendly Name**: "Test Newline Bug"
   - **Hostname**: `nonexistent.invalid.local`
   - **Heartbeat Interval**: 60 seconds
3. Click "Save"

The monitor will immediately fail with a multiline error message.

## 4. Create Webhook Notification (1 minute)

1. Go to Settings (⚙️) → Notifications
2. Click "Setup Notification"
3. Select "Webhook"
4. Configure:
   - **Friendly Name**: "Local Test"
   - **Webhook URL**: `http://localhost:3002/webhook`
   - **HTTP Method**: POST
   - **Content Type**: Custom
   - **Custom Body**: Copy this exactly:
   ```json
   {
     "message": "{{msg | json_escape}}",
     "monitor": "{{monitorJSON.name | json_escape}}",
     "status": {{heartbeatJSON.status}},
     "time": "{{heartbeatJSON.time}}"
   }
   ```
5. Click "Test" - you should see success!
6. Click "Save"

## 5. Enable Notification (30 seconds)

1. Go back to your "Test Newline Bug" monitor
2. Click "Edit"
3. Scroll to "Notifications" section
4. Check the box next to "Local Test"
5. Click "Save"

## 6. Watch the Magic! (1 minute)

**In Terminal 2 (webhook server), you'll see:**

```
📨 Webhook Received at 2026-09-07T...
================================================================================

📋 Headers:
  content-type: application/json
  ...

📦 Body:
  Type: string
  Content-Type: application/json

📄 Raw Content:
────────────────────────────────────────────────────────────────────────────────
{
  "message": "ping: cannot resolve nonexistent.invalid.local: Unknown host\nping: cannot resolve nonexistent.invalid.local: Unknown host",
  "monitor": "Test Newline Bug",
  "status": 0,
  "time": "2026-09-07T..."
}
────────────────────────────────────────────────────────────────────────────────

🔍 JSON Validation:
  ✅ VALID JSON!

📊 Parsed Object:
{
  "message": "ping: cannot resolve nonexistent.invalid.local: Unknown host\nping: cannot resolve nonexistent.invalid.local: Unknown host",
  "monitor": "Test Newline Bug",
  "status": 0,
  "time": "2026-09-07T..."
}

💬 Message Analysis:
  Length: 107 characters
  Contains newlines: YES
  Contains quotes: NO
  Newline count: 1

================================================================================
✓ Response sent: 200 OK
================================================================================
```

✅ **SUCCESS!** The newlines are properly escaped as `\n` in the JSON string!

## 7. Test WITHOUT Filter (Show the Bug)

Want to see what the bug looked like?

1. Edit your "Local Test" webhook notification
2. Remove the `| json_escape` filters:
   ```json
   {
     "message": "{{msg}}",
     "monitor": "{{monitorJSON.name}}"
   }
   ```
3. Save and wait for next heartbeat (60 seconds)
4. Check Terminal 2:

```
🔍 JSON Validation:
  ❌ INVALID JSON!
  Error: Bad control character in string literal in JSON at position 19

  This is the bug! The payload should be valid JSON.
  Tip: Use {{msg | json_escape}} in your webhook template.
```

❌ **BUG REPRODUCED!** Without the filter, the JSON is broken.

## Alternative: Use webhook.site (No Local Server)

If you don't want to run the test server:

1. Go to https://webhook.site - it gives you a unique URL
2. Copy the URL (looks like `https://webhook.site/abc123...`)
3. Use that URL in step 4 above
4. Watch the requests arrive on webhook.site in your browser
5. Click on a request to see if the JSON is valid

## Running Automated Tests

Want to see the tests pass?

```bash
cd "/Users/Fatemeh/Documents/Codeless/session 10/uptime-kuma"
TEST_BACKEND=1 node --test test/backend-test/notification-providers/test-webhook.js
```

Output:
```
✔ should handle newlines in message correctly (0.789ms)
✔ should handle double quotes in message correctly (0.124875ms)
✔ should handle special characters in custom body template with json_escape filter (16.707292ms)
✔ JSON Payload Handling (18.117542ms)
✔ Webhook Notification Provider (18.468167ms)
```

## Troubleshooting

**"Cannot send notification" error:**
- Make sure webhook server is running (Terminal 2)
- Check the URL is exactly `http://localhost:3002/webhook`

**Monitor not failing:**
- Use hostname: `nonexistent.invalid.local` or `999.999.999.999`
- These will always fail immediately

**Not seeing webhook requests:**
- Check Terminal 2 is showing the webhook server running
- Try the "Test" button in webhook notification settings first

## What You're Testing

✅ **With `json_escape` filter**: Newlines become `\n` in JSON (valid)
❌ **Without filter**: Newlines stay as actual newlines (invalid JSON)

The fix adds the `json_escape` and `json` filters so users can create valid JSON templates even when messages contain special characters.

---

**Total time**: ~5 minutes
**Result**: See the fix working in real-time!
