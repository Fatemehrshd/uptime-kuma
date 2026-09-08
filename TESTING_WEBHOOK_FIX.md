# Testing the Webhook JSON Fix on Localhost

You don't need to bring down a real website! Here are several easy ways to test the fix.

## Prerequisites

1. Make sure you're on the fix branch:
```bash
git checkout fix/webhook-multiline-payload
```

2. Install and build:
```bash
npm install
npm run build
```

3. Start the dev server:
```bash
npm run start-server-dev
```

4. Open http://localhost:3001 in your browser

## Method 1: Use a Webhook Testing Service (Easiest)

### Step 1: Get a Test Webhook URL

Go to one of these free services:
- **webhook.site** - https://webhook.site (creates instant webhook URL)
- **requestbin.com** - https://requestbin.com
- **beeceptor.com** - https://beeceptor.com

For example, webhook.site will give you a URL like:
```
https://webhook.site/12345678-abcd-1234-5678-123456789abc
```

### Step 2: Create a Monitor That Will Fail

1. In Uptime Kuma, click "Add New Monitor"
2. Configure:
   - **Type**: Ping
   - **Friendly Name**: "Test Multiline Error"
   - **Hostname**: `invalid.hostname.that.does.not.exist.local`
   - **Heartbeat Interval**: 60 seconds
3. Click "Save"

This monitor will immediately fail with a multiline error message like:
```
ping: cannot resolve invalid.hostname.that.does.not.exist.local: Unknown host
ping: cannot resolve invalid.hostname.that.does.not.exist.local: Unknown host
```

### Step 3: Create Webhook Notification

1. Go to Settings → Notifications
2. Click "Setup Notification"
3. Select "Webhook"
4. Configure:
   - **Friendly Name**: "Test Webhook"
   - **Webhook URL**: (paste your webhook.site URL)
   - **HTTP Method**: POST
   - **Content Type**: Custom
   - **Custom Body**:
     ```json
     {
       "message": "{{msg | json_escape}}",
       "monitor": "{{monitorJSON.name | json_escape}}",
       "status": "{{heartbeatJSON.status}}",
       "time": "{{heartbeatJSON.time}}"
     }
     ```
5. Click "Test" - you should see a success message
6. Click "Save"

### Step 4: Enable Notification for Monitor

1. Go back to your "Test Multiline Error" monitor
2. Edit it
3. Scroll down to "Notifications"
4. Check your "Test Webhook" notification
5. Save

### Step 5: Watch It Work!

1. Go to your webhook.site page (keep it open)
2. Wait for the monitor to check (60 seconds)
3. You'll see a POST request arrive with **valid JSON**:
   ```json
   {
     "message": "ping: cannot resolve invalid.hostname.that.does.not.exist.local: Unknown host\nping: cannot resolve invalid.hostname.that.does.not.exist.local: Unknown host",
     "monitor": "Test Multiline Error",
     "status": "0",
     "time": "2026-09-07T..."
   }
   ```

✅ **Success!** The newlines are properly escaped as `\n`

### Step 6: Test WITHOUT the Filter (Show the Bug)

1. Edit your webhook notification
2. Change the custom body to NOT use the filter:
   ```json
   {
     "message": "{{msg}}",
     "monitor": "{{monitorJSON.name}}"
   }
   ```
3. Save and wait for the next heartbeat
4. Check webhook.site - you'll see the request **failed** or the JSON is **invalid**

## Method 2: Use a Local Webhook Receiver (No Internet Required)

### Step 1: Create a Simple Webhook Server

Create a file `test-webhook-server.js`:

```javascript
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.text({ type: '*/*' }));

app.post('/webhook', (req, res) => {
    console.log('\n=== Webhook Received ===');
    console.log('Headers:', req.headers);
    console.log('Body Type:', typeof req.body);
    console.log('Raw Body:', req.body);
    
    if (typeof req.body === 'string') {
        console.log('\nAttempting to parse JSON...');
        try {
            const parsed = JSON.parse(req.body);
            console.log('✅ VALID JSON!');
            console.log('Parsed:', JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log('❌ INVALID JSON!');
            console.log('Error:', e.message);
        }
    } else {
        console.log('✅ Object received (axios auto-parsed)');
        console.log(JSON.stringify(req.body, null, 2));
    }
    
    res.json({ success: true });
});

app.listen(3002, () => {
    console.log('Webhook test server running on http://localhost:3002');
    console.log('Use webhook URL: http://localhost:3002/webhook');
});
```

### Step 2: Run the Webhook Server

```bash
node test-webhook-server.js
```

### Step 3: Configure Uptime Kuma

1. Create a Ping monitor to `invalid.hostname.local` (will fail)
2. Create Webhook notification with URL: `http://localhost:3002/webhook`
3. Use custom body with `json_escape` filter (see Method 1)
4. Enable notification for the monitor

### Step 4: Watch the Console

You'll see output like:
```
=== Webhook Received ===
Body Type: string
Raw Body: {"message":"ping: cannot resolve...\npng: cannot resolve...","monitor":"Test"}

Attempting to parse JSON...
✅ VALID JSON!
Parsed: {
  "message": "ping: cannot resolve...\npng: cannot resolve...",
  "monitor": "Test"
}
```

## Method 3: Use httpstat.us to Simulate Failures

### Step 1: Create HTTP Monitor

1. Type: HTTP(s)
2. URL: `https://httpstat.us/500?sleep=100`
3. This will always return 500 error

### Step 2: Configure Webhook with Custom Body

```json
{
  "alert": "{{msg | json_escape}}",
  "url": "{{monitorJSON.url | json_escape}}",
  "status": {{heartbeatJSON.status}}
}
```

### Step 3: Check Results

The webhook will receive proper JSON even though the message might contain HTTP error details with special characters.

## Method 4: Use the Test Button (Simplest!)

1. Create any monitor (doesn't need to fail)
2. Create Webhook notification with custom body using filters
3. Click the **"Test"** button in the notification settings
4. Check webhook.site to see the test payload
5. Verify it's valid JSON

## Testing the Filters

### Test 1: json_escape Filter

**Template:**
```json
{"msg": "{{msg | json_escape}}"}
```

**Input:** `Line 1\nLine 2"quoted"`

**Output:** 
```json
{"msg": "Line 1\\nLine 2\"quoted\""}
```
✅ Valid JSON

### Test 2: json Filter

**Template:**
```json
{"msg": {{msg | json}}}
```

**Input:** `Line 1\nLine 2`

**Output:**
```json
{"msg": "Line 1\nLine 2"}
```
✅ Valid JSON (includes quotes)

### Test 3: No Filter (Bug Demonstration)

**Template:**
```json
{"msg": "{{msg}}"}
```

**Input:** `Line 1\nLine 2`

**Output:**
```json
{"msg": "Line 1
Line 2"}
```
❌ Invalid JSON (unescaped newline)

## Troubleshooting

### Webhook Not Receiving Anything

1. Check the Uptime Kuma server logs:
   ```bash
   # In the terminal where you ran npm run start-server-dev
   # Look for:
   [MONITOR] sendNotification
   [MONITOR] Cannot send notification to...
   ```

2. Make sure the webhook URL is accessible:
   ```bash
   curl http://localhost:3002/webhook -X POST -H "Content-Type: application/json" -d '{"test": "data"}'
   ```

### Getting "Cannot send notification" Error

1. Check if the custom body template is valid Liquid syntax
2. Try the "Test" button first before waiting for monitor failures
3. Check server logs for detailed error messages

### Webhook Receives Invalid JSON

If you're NOT using the filters, this is expected! That's the bug we fixed.

If you ARE using the filters and still get invalid JSON:
1. Make sure you're on the `fix/webhook-multiline-payload` branch
2. Make sure you rebuilt: `npm run build`
3. Restart the server
4. Check that the filter syntax is correct: `{{msg | json_escape}}`

## Quick Test Script

Want to test programmatically? Run this:

```bash
cd "/Users/Fatemeh/Documents/Codeless/session 10/uptime-kuma"
TEST_BACKEND=1 node --test test/backend-test/notification-providers/test-webhook.js
```

You should see:
```
✔ should handle newlines in message correctly
✔ should handle double quotes in message correctly
✔ should handle special characters in custom body template with json_escape filter
```

## Success Criteria

✅ Webhook receives valid JSON when using `json_escape` filter
✅ Newlines are escaped as `\n` in the JSON
✅ Quotes are escaped as `\"` in the JSON
✅ The JSON can be parsed without errors
✅ Message content is preserved correctly

## Example Complete Test

1. **Start webhook receiver**: webhook.site
2. **Create failing monitor**: Ping to `nonexistent.local`
3. **Create webhook** with:
   ```json
   {
     "text": "{{msg | json_escape}}",
     "monitor": "{{monitorJSON.name | json_escape}}"
   }
   ```
4. **Wait 60 seconds**
5. **Check webhook.site**: Should see valid JSON with escaped newlines

That's it! No need to bring down any real services.
