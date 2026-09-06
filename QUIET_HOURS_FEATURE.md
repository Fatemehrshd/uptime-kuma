# Quiet Hours Feature - Implementation Summary

## Overview
Added a "Quiet Hours" feature to Uptime Kuma that allows suppressing Down/Recovery notifications during specified recurring time windows. The timezone for each window is automatically detected from the user's browser using `Intl.DateTimeFormat().resolvedOptions().timeZone`.

## Architecture

### Backend Components

#### 1. Database Migration
- **File**: `db/knex_migrations/2026-09-07-0000-quiet-hours.js`
- **Table**: `quiet_hours`
- **Columns**:
  - `id` (primary key)
  - `monitor_id` (foreign key to monitor table, CASCADE on delete)
  - `start_time` (HH:mm format)
  - `end_time` (HH:mm format)
  - `timezone` (string, e.g., "America/New_York")
  - `weekdays` (JSON array, e.g., [1,2,3,4,5] for Mon-Fri)
  - `active` (boolean, default true)

#### 2. QuietHours Model
- **File**: `server/model/quiet-hours.js`
- **Key Methods**:
  - `getQuietHoursForMonitor(monitorId)` - Data access layer, returns plain objects
  - `getAllQuietHoursForMonitor(monitorId)` - Includes inactive windows
  - `isInsideQuietWindow(windows, currentTime)` - Pure function for business logic

#### 3. Pure Business Logic
The `isInsideQuietWindow()` function is completely pure:
- Takes windows array and current time as parameters (no internal Date.now())
- No database queries
- Handles timezone conversion using dayjs
- Supports weekday filtering (1=Monday, 7=Sunday)
- Handles midnight-spanning windows (e.g., 22:00-06:00)
- Easily testable with fixtures

#### 4. Monitor Integration
- **File**: `server/model/monitor.js`
- **Integration Point**: `Monitor.sendNotification()`
- **Behavior**:
  - Loads quiet hours before sending notification
  - Calls `isInsideQuietWindow()` with current time
  - If inside window: logs suppression, returns early
  - If error checking quiet hours: logs error, continues with notification (fail-safe)
  - Heartbeat recording and status changes are NOT affected

#### 5. Socket Handler
- **File**: `server/socket-handlers/quiet-hours-socket-handler.js`
- **Endpoints**:
  - `addQuietHours` - Create new quiet hours window
  - `editQuietHours` - Update existing window
  - `getQuietHours` - Get single window by ID
  - `getMonitorQuietHours` - Get all windows for a monitor
  - `deleteQuietHours` - Remove window
  - `toggleQuietHours` - Enable/disable window

### Frontend Components

#### QuietHours Vue Component
- **File**: `src/components/QuietHours.vue`
- **Features**:
  - Auto-detects timezone using `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - Time pickers for start/end times
  - Weekday selection (checkboxes for each day)
  - List view of existing quiet hours
  - Edit/Delete/Enable/Disable actions
  - Modal for add/edit operations
  - i18n support

## Testing

### Pure Function Tests
- **File**: `test/backend-test/test-quiet-hours.js`
- **Coverage**: 25+ test cases
- **Test Scenarios**:
  - Empty/null window arrays
  - Inside/outside time windows
  - Midnight-spanning windows (22:00-06:00)
  - Weekday restrictions
  - Multiple timezones
  - Multiple windows
  - Boundary conditions (start/end times)
  - Date object compatibility

### Integration Tests
- **File**: `test/backend-test/test-quiet-hours-integration.js`
- **Test Scenarios**:
  - Notification suppression when inside quiet hours
  - Notification sent when outside quiet hours
  - Notification sent when no quiet hours configured
  - Uses mocks/spies to verify notification behavior

## Key Design Decisions

1. **Separation of Concerns**: Data access layer separate from pure business logic
2. **Timezone Handling**: Automatic detection in frontend, no manual dropdown
3. **Pure Functions**: `isInsideQuietWindow()` is testable without database
4. **Fail-Safe**: If quiet hours check fails, notification is still sent
5. **Non-Intrusive**: Only affects notification sending, not monitor status or heartbeats
6. **Recurring**: Windows repeat daily based on weekday configuration
7. **Midnight Spanning**: Properly handles windows that cross midnight

## Usage Example

1. User creates a quiet hours window:
   - Start: 22:00
   - End: 08:00
   - Weekdays: Monday-Friday (1,2,3,4,5)
   - Timezone: Automatically detected (e.g., "America/New_York")

2. When monitor goes DOWN at 23:00 on a Tuesday in New York:
   - System loads quiet hours for that monitor
   - Converts current time to the window's timezone
   - Checks if Tuesday is in weekdays list (yes)
   - Checks if 23:00 is between 22:00 and 08:00 (yes)
   - Notification is suppressed, logged as "inside quiet hours window"

3. When monitor comes UP at 15:00 on the same day:
   - Same checks performed
   - 15:00 is NOT between 22:00 and 08:00
   - Recovery notification is sent normally

## Files Modified/Created

### Backend
- `db/knex_migrations/2026-09-07-0000-quiet-hours.js` (new)
- `server/model/quiet-hours.js` (new)
- `server/model/monitor.js` (modified)
- `server/socket-handlers/quiet-hours-socket-handler.js` (new)
- `server/server.js` (modified - registered handler)

### Frontend
- `src/components/QuietHours.vue` (new)

### Tests
- `test/backend-test/test-quiet-hours.js` (new)
- `test/backend-test/test-quiet-hours-integration.js` (new)

### Utilities
- `validate-quiet-hours.js` (new - validation script)

## Future Enhancements (Not Implemented)

- UI integration into EditMonitor.vue page
- i18n translations for all supported languages
- Notification preview showing next quiet window
- Import/export quiet hours configurations
- Quiet hours templates (e.g., "Business Hours", "Nights & Weekends")
- Different notification priorities (suppress some, not others)
