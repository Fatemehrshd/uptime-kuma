const { describe, test } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const { isInsideQuietWindow } = require("../../server/model/quiet-hours");

describe("Quiet Hours - isInsideQuietWindow Pure Function Tests", () => {
    
    test("should return false when windows array is empty", () => {
        const now = dayjs("2026-09-07T15:30:00Z");
        const result = isInsideQuietWindow([], now);
        assert.strictEqual(result, false);
    });

    test("should return false when windows is null", () => {
        const now = dayjs("2026-09-07T15:30:00Z");
        const result = isInsideQuietWindow(null, now);
        assert.strictEqual(result, false);
    });

    test("should return true when current time is inside a quiet window", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "America/New_York",
                weekdays: [],
            },
        ];
        
        // 2026-09-07 23:30 in New York time (inside 22:00-08:00 window)
        const now = dayjs.tz("2026-09-07 23:30", "America/New_York");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should return false when current time is outside a quiet window", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "America/New_York",
                weekdays: [],
            },
        ];
        
        // 2026-09-07 15:30 in New York time (outside 22:00-08:00 window)
        const now = dayjs.tz("2026-09-07 15:30", "America/New_York");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, false);
    });

    test("should handle window spanning midnight - after start time", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "06:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // 23:30 UTC (after 22:00, should be inside)
        const now = dayjs.utc("2026-09-07 23:30");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle window spanning midnight - before end time", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "06:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // 05:30 UTC (before 06:00, should be inside)
        const now = dayjs.utc("2026-09-07 05:30");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle window spanning midnight - in middle period", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "06:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // 12:00 UTC (between 06:00 and 22:00, should be outside)
        const now = dayjs.utc("2026-09-07 12:00");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, false);
    });

    test("should handle normal same-day window", () => {
        const windows = [
            {
                startTime: "09:00",
                endTime: "17:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // 14:00 UTC (inside 09:00-17:00)
        const now = dayjs.utc("2026-09-07 14:00");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should return false for same-day window when outside", () => {
        const windows = [
            {
                startTime: "09:00",
                endTime: "17:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // 20:00 UTC (outside 09:00-17:00)
        const now = dayjs.utc("2026-09-07 20:00");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, false);
    });

    test("should respect weekday restrictions - matching weekday", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [1], // Monday only (2026-09-07 is Monday)
            },
        ];
        
        // Monday 23:30 UTC
        const now = dayjs.utc("2026-09-07 23:30"); // This is a Monday
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should respect weekday restrictions - non-matching weekday", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [3], // Wednesday only
            },
        ];
        
        // Monday 23:30 UTC (not Wednesday)
        const now = dayjs.utc("2026-09-07 23:30"); // This is a Monday
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, false);
    });

    test("should work with multiple weekdays", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [1, 2, 3, 4, 5], // Monday-Friday
            },
        ];
        
        // Monday 23:30 UTC
        const now = dayjs.utc("2026-09-07 23:30"); // Monday
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should return false on weekend when weekdays is Mon-Fri", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [1, 2, 3, 4, 5], // Monday-Friday
            },
        ];
        
        // Saturday 23:30 UTC
        const now = dayjs.utc("2026-09-12 23:30"); // Saturday
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, false);
    });

    test("should handle Sunday as weekday 7", () => {
        const windows = [
            {
                startTime: "00:00",
                endTime: "23:59",
                timezone: "UTC",
                weekdays: [7], // Sunday only
            },
        ];
        
        // Sunday 12:00 UTC
        const now = dayjs.utc("2026-09-13 12:00"); // Sunday
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle different timezones correctly", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "Asia/Tokyo",
                weekdays: [],
            },
        ];
        
        // When it's 23:00 in Tokyo, it should be inside the window
        const now = dayjs.tz("2026-09-07 23:00", "Asia/Tokyo");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle multiple windows and return true if inside any", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [],
            },
            {
                startTime: "12:00",
                endTime: "13:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // 12:30 UTC (inside second window)
        const now = dayjs.utc("2026-09-07 12:30");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle multiple windows and return false if outside all", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [],
            },
            {
                startTime: "12:00",
                endTime: "13:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // 15:00 UTC (outside both windows)
        const now = dayjs.utc("2026-09-07 15:00");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, false);
    });

    test("should handle boundary condition at start time (inclusive)", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "23:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // Exactly 22:00 UTC
        const now = dayjs.utc("2026-09-07 22:00:00");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle boundary condition at end time (exclusive)", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "23:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // Exactly 23:00 UTC (should be outside)
        const now = dayjs.utc("2026-09-07 23:00:00");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, false);
    });

    test("should work with Date objects in addition to dayjs objects", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [],
            },
        ];
        
        // Pass a regular Date object
        const now = new Date("2026-09-07T23:30:00Z");
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle recurring window - next day activation", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [], // All days
            },
        ];
        
        // Test on Tuesday night (should also work)
        const now = dayjs.utc("2026-09-08 23:30"); // Tuesday
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });

    test("should handle empty weekdays array as all days", () => {
        const windows = [
            {
                startTime: "22:00",
                endTime: "08:00",
                timezone: "UTC",
                weekdays: [], // Empty means all days
            },
        ];
        
        // Any day should work
        const now = dayjs.utc("2026-09-13 23:30"); // Sunday
        const result = isInsideQuietWindow(windows, now);
        assert.strictEqual(result, true);
    });
});
