# 🧪 Quiet Hours - Localhost Testing Guide

This guide will walk you through testing the Quiet Hours feature on your local machine.

## Prerequisites

Make sure you're on the feature branch:
```bash
git branch  # Should show: * feature/quiet-hours-notifications
```

## Step 1: Install Dependencies & Build

```bash
# Install all dependencies
npm install

# Build the frontend
npm run build
```

## Step 2: Run Database Migrations

The quiet_hours table will be created automatically when you start the server:

```bash
# Start the development server
npm run start-server-dev
```

The migration `2026-09-07-0000-quiet-hours.js` will run automatically on startup.

Watch the console output for:
```
[DB] Running migration: 2026-09-07-0000-quiet-hours.js
[DB] Migration completed successfully
```

## Step 3: Access Uptime Kuma

1. Open your browser: http://localhost:3001
2. Login or create an account (if first time)

## Step 4: Create a Test Monitor

1. Click "Add New Monitor"
2. Configure a simple monitor:
   - **Type**: HTTP(s)
   - **Friendly Name**: "Quiet Hours Test"
   - **URL**: https://httpstat.us/200 (reliable test endpoint)
   - **Heartbeat Interval**: 60 seconds
3. Click "Save"

## Step 5: Test the Quiet Hours Feature

### Method A: Using Browser Console (Quick Test)

Since the QuietHours component isn't integrated into the UI yet, let's test via the Socket.io API directly:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Run this code to add a quiet hours window:

```javascript
// Get the socket instance
const socket = window.socket || window.$root?.getSocket();

// Add a quiet hours window (10 minutes from now for 1 hour)
const now = new Date();
const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
const endHour = now.getHours() + 1;
const endTime = `${String(endHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

const quietHoursData = {
    monitorId: 1,  // Change this to your monitor's ID
    startTime: startTime,
    endTime: endTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekdays: [],  // Empty = all days
    active: true
};

socket.emit('addQuietHours', quietHoursData, (response) => {
    console.log('Quiet Hours Response:', response);
});
```

4. Verify it was added:

```javascript
socket.emit('getMonitorQuietHours', 1, (response) => {
    console.log('Quiet Hours List:', response);
});
```

### Method B: Using the QuietHours Component (Full UI Test)

To integrate the component into the monitor edit page:

1. Open `src/pages/EditMonitor.vue`
2. Find line ~2202 where it says `<!-- Notifications -->`
3. Add this BEFORE the Notifications section:

```vue
<!-- Quiet Hours -->
<QuietHours v-if="monitor.id" :monitor-id="monitor.id" />
```

4. Add the import at the top of the script section (around line 3240):

```javascript
import QuietHours from "../components/QuietHours.vue";
```

5. Register the component (around line 3348):

```javascript
components: {
    // ... existing components
    QuietHours,
},
```

6. Rebuild and restart:

```bash
npm run build
# Restart the dev server (Ctrl+C then npm run start-server-dev)
```

7. Now you'll see the Quiet Hours section in the monitor edit page!

## Step 6: Test Notification Suppression

### Setup

1. **Add a notification provider**:
   - Go to Settings → Notifications
   - Add a test notification (e.g., Webhook to https://webhook.site)
   - Or use Telegram/Discord/Email if you have them

2. **Enable notifications for your test monitor**:
   - Edit your monitor
   - Check the notification you just created

### Test Scenario 1: Inside Quiet Hours

1. Add a quiet hours window that includes the current time:
   ```javascript
   // Current time to 2 hours from now
   const now = new Date();
   const start = now.getHours();
   const end = (now.getHours() + 2) % 24;
   
   socket.emit('addQuietHours', {
       monitorId: 1,
       startTime: `${String(start).padStart(2, '0')}:00`,
       endTime: `${String(end).padStart(2, '0')}:00`,
       timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
       weekdays: [],
       active: true
   }, console.log);
   ```

2. Force the monitor to go DOWN:
   - Change the URL to something that fails: https://httpstat.us/500
   - Or use: https://httpstat.us/200?sleep=60000 (will timeout)
   - Save the monitor

3. **Watch the server logs** (in terminal where you ran `npm run start-server-dev`):
   ```
   [monitor] [Quiet Hours Test] Notification suppressed - inside quiet hours window
   ```

4. **Verify**: You should NOT receive a notification

### Test Scenario 2: Outside Quiet Hours

1. Modify the quiet hours window to NOT include current time:
   ```javascript
   socket.emit('getMonitorQuietHours', 1, (res) => {
       const window = res.quietHoursList[0];
       // Toggle it off
       socket.emit('toggleQuietHours', window.id, console.log);
   });
   ```

2. Trigger another DOWN event (change URL again or wait for timeout)

3. **Watch the server logs**:
   ```
   [monitor] [Quiet Hours Test] sendNotification
   ```

4. **Verify**: You SHOULD receive a notification

### Test Scenario 3: Midnight-Spanning Window

Test a window like 22:00 to 06:00:

```javascript
socket.emit('addQuietHours', {
    monitorId: 1,
    startTime: "22:00",
    endTime: "06:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekdays: [],
    active: true
}, console.log);
```

- Test at 23:00 (should suppress)
- Test at 02:00 (should suppress)
- Test at 12:00 (should NOT suppress)

### Test Scenario 4: Weekday Filtering

Test Monday-Friday only (1,2,3,4,5):

```javascript
socket.emit('addQuietHours', {
    monitorId: 1,
    startTime: "00:00",
    endTime: "23:59",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekdays: [1, 2, 3, 4, 5],  // Monday to Friday
    active: true
}, console.log);
```

- Test on a weekday (should suppress)
- Test on Saturday/Sunday (should NOT suppress)

## Step 7: Verify Database

Check if data is being stored correctly:

```bash
# If using SQLite (default)
sqlite3 data/kuma.db

# Run queries
SELECT * FROM quiet_hours;
SELECT id, name FROM monitor;
```

Expected output:
```
id|monitor_id|start_time|end_time|timezone|weekdays|active
1|1|22:00|06:00|America/New_York|[]|1
```

## Step 8: Run Automated Tests

```bash
# Run the quiet hours unit tests
chmod +x run-quiet-hours-tests.sh
./run-quiet-hours-tests.sh

# Run all backend tests (requires cross-env)
npm install cross-env
npm run test-backend
```

Expected output:
```
✔ should return false when windows array is empty
✔ should return true when current time is inside a quiet window
✔ should handle window spanning midnight
... (25+ tests)
```

## Troubleshooting

### Migration Not Running

If the quiet_hours table isn't created:

1. Check the database file location: `data/kuma.db`
2. Manually run migration:
   ```bash
   node server/server.js
   # Watch for migration logs
   ```

### Notifications Still Being Sent

Check these:

1. **Verify quiet hours are active**:
   ```javascript
   socket.emit('getMonitorQuietHours', YOUR_MONITOR_ID, console.log);
   ```

2. **Check server logs** for:
   ```
   [monitor] [MonitorName] Notification suppressed - inside quiet hours window
   ```

3. **Verify time is actually inside window**:
   ```javascript
   const { isInsideQuietWindow } = require('./server/model/quiet-hours');
   // Test manually
   ```

### Socket Commands Not Working

Make sure you're logged in and socket is connected:

```javascript
// Check socket status
console.log('Socket connected:', socket?.connected);

// If not working, try:
const socket = window.$root?.$socket || window.socket;
```

### Component Not Showing in UI

If you integrated QuietHours.vue into EditMonitor.vue:

1. Check for build errors: `npm run build`
2. Clear browser cache (Ctrl+Shift+R)
3. Check browser console for Vue errors
4. Verify import path is correct

## Example Complete Test Flow

```bash
# 1. Start clean
git status  # Confirm on feature branch
npm install
npm run build

# 2. Start server
npm run start-server-dev

# 3. In browser (http://localhost:3001)
# - Login
# - Create a test monitor
# - Open DevTools console

# 4. In console
socket.emit('addQuietHours', {
    monitorId: 1,
    startTime: "00:00",
    endTime: "23:59",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekdays: [],
    active: true
}, console.log);

# 5. Trigger DOWN event
# - Change monitor URL to https://httpstat.us/500
# - Save

# 6. Watch terminal
# Should see: "Notification suppressed - inside quiet hours window"

# 7. Disable quiet hours
socket.emit('getMonitorQuietHours', 1, (res) => {
    socket.emit('toggleQuietHours', res.quietHoursList[0].id, console.log);
});

# 8. Trigger DOWN event again
# Should see: Notification sent

# 9. Run tests
npm run test-backend
```

## Advanced Testing

### Test with Multiple Monitors

```javascript
// Add quiet hours to multiple monitors
[1, 2, 3].forEach(monitorId => {
    socket.emit('addQuietHours', {
        monitorId: monitorId,
        startTime: "22:00",
        endTime: "06:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        weekdays: [1,2,3,4,5],
        active: true
    }, console.log);
});
```

### Test Timezone Edge Cases

```javascript
// Test with different timezones
const timezones = [
    'America/New_York',
    'Europe/London', 
    'Asia/Tokyo',
    'UTC'
];

timezones.forEach(tz => {
    socket.emit('addQuietHours', {
        monitorId: 1,
        startTime: "12:00",
        endTime: "13:00",
        timezone: tz,
        weekdays: [],
        active: true
    }, console.log);
});
```

## Success Criteria

✅ Migration runs without errors
✅ Can add quiet hours via socket commands
✅ Can retrieve quiet hours for a monitor
✅ Notifications are suppressed during quiet hours (log shows suppression message)
✅ Notifications are sent outside quiet hours
✅ Weekday filtering works correctly
✅ Midnight-spanning windows work correctly
✅ Different timezones are handled correctly
✅ All automated tests pass

## Need Help?

Check these files for reference:
- `QUIET_HOURS_FEATURE.md` - Technical architecture
- `IMPLEMENTATION_COMPLETE.md` - Complete implementation details
- `server/model/quiet-hours.js` - Core logic
- `test/backend-test/test-quiet-hours.js` - Test examples
