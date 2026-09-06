const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const { R } = require("redbean-node");
const { UP, DOWN } = require("../../src/util");
const Monitor = require("../../server/model/monitor");
const QuietHours = require("../../server/model/quiet-hours");

describe("Quiet Hours Integration - Notification Suppression", () => {
    let mockMonitor;
    let mockBean;
    let originalNotificationSend;
    let notificationCallCount;

    before(async () => {
        // Set up test environment
        // Mock the Notification.send to track calls
        const Notification = require("../../server/notification");
        originalNotificationSend = Notification.send;
        
        notificationCallCount = 0;
        Notification.send = async () => {
            notificationCallCount++;
        };
    });

    after(async () => {
        // Restore original Notification.send
        const Notification = require("../../server/notification");
        Notification.send = originalNotificationSend;
    });

    test("should suppress notification when inside quiet hours window", async () => {
        // Reset counter
        notificationCallCount = 0;

        // Create mock monitor
        mockMonitor = {
            id: 999,
            name: "Test Monitor",
            active: true,
        };

        // Create mock heartbeat bean
        mockBean = {
            status: DOWN,
            msg: "Service is down",
            toJSONAsync: async () => ({
                msg: "Service is down",
                time: new Date().toISOString(),
            }),
        };

        // Mock getQuietHoursForMonitor to return a window that includes current time
        const originalGetQuietHours = QuietHours.getQuietHoursForMonitor;
        QuietHours.getQuietHoursForMonitor = async () => {
            // Return a window that's always active (00:00-23:59 UTC)
            return [
                {
                    id: 1,
                    monitorId: 999,
                    startTime: "00:00",
                    endTime: "23:59",
                    timezone: "UTC",
                    weekdays: [],
                    active: true,
                },
            ];
        };

        // Mock getNotificationList to return empty (we just want to test suppression)
        const originalGetNotificationList = Monitor.getNotificationList;
        Monitor.getNotificationList = async () => [];

        try {
            // Call sendNotification
            await Monitor.sendNotification(false, mockMonitor, mockBean);

            // Notification should NOT be sent (suppressed)
            assert.strictEqual(notificationCallCount, 0, "Notification should be suppressed");
        } finally {
            // Restore original methods
            QuietHours.getQuietHoursForMonitor = originalGetQuietHours;
            Monitor.getNotificationList = originalGetNotificationList;
        }
    });

    test("should send notification when outside quiet hours window", async () => {
        // Reset counter
        notificationCallCount = 0;

        mockMonitor = {
            id: 999,
            name: "Test Monitor",
            active: true,
        };

        mockBean = {
            status: DOWN,
            msg: "Service is down",
            toJSONAsync: async () => ({
                msg: "Service is down",
                time: new Date().toISOString(),
            }),
        };

        // Mock getQuietHoursForMonitor to return a window that doesn't include current time
        const originalGetQuietHours = QuietHours.getQuietHoursForMonitor;
        QuietHours.getQuietHoursForMonitor = async () => {
            // Return a window that's never active (narrow window in the past)
            return [
                {
                    id: 1,
                    monitorId: 999,
                    startTime: "01:00",
                    endTime: "01:01",
                    timezone: "UTC",
                    weekdays: [],
                    active: true,
                },
            ];
        };

        // Mock getNotificationList to return one notification
        const originalGetNotificationList = Monitor.getNotificationList;
        Monitor.getNotificationList = async () => [
            {
                id: 1,
                name: "Test Notification",
                config: JSON.stringify({ type: "webhook" }),
            },
        ];

        // Mock UptimeKumaServer
        const { UptimeKumaServer } = require("../../server/uptime-kuma-server");
        const mockServer = {
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        };
        const originalGetInstance = UptimeKumaServer.getInstance;
        UptimeKumaServer.getInstance = () => mockServer;

        // Mock R.getRow for lastDownTime query
        const originalGetRow = R.getRow;
        R.getRow = async () => null;

        // Mock Monitor.preparePreloadData
        const originalPreparePreloadData = Monitor.preparePreloadData;
        Monitor.preparePreloadData = async () => ({});

        try {
            // Call sendNotification
            await Monitor.sendNotification(false, mockMonitor, mockBean);

            // Notification SHOULD be sent (not suppressed)
            assert.strictEqual(notificationCallCount, 1, "Notification should be sent");
        } finally {
            // Restore original methods
            QuietHours.getQuietHoursForMonitor = originalGetQuietHours;
            Monitor.getNotificationList = originalGetNotificationList;
            UptimeKumaServer.getInstance = originalGetInstance;
            R.getRow = originalGetRow;
            Monitor.preparePreloadData = originalPreparePreloadData;
        }
    });

    test("should send notification when monitor has no quiet hours configured", async () => {
        // Reset counter
        notificationCallCount = 0;

        mockMonitor = {
            id: 999,
            name: "Test Monitor",
            active: true,
        };

        mockBean = {
            status: DOWN,
            msg: "Service is down",
            toJSONAsync: async () => ({
                msg: "Service is down",
                time: new Date().toISOString(),
            }),
        };

        // Mock getQuietHoursForMonitor to return empty array
        const originalGetQuietHours = QuietHours.getQuietHoursForMonitor;
        QuietHours.getQuietHoursForMonitor = async () => [];

        // Mock getNotificationList to return one notification
        const originalGetNotificationList = Monitor.getNotificationList;
        Monitor.getNotificationList = async () => [
            {
                id: 1,
                name: "Test Notification",
                config: JSON.stringify({ type: "webhook" }),
            },
        ];

        // Mock UptimeKumaServer
        const { UptimeKumaServer } = require("../../server/uptime-kuma-server");
        const mockServer = {
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        };
        const originalGetInstance = UptimeKumaServer.getInstance;
        UptimeKumaServer.getInstance = () => mockServer;

        // Mock R.getRow
        const originalGetRow = R.getRow;
        R.getRow = async () => null;

        // Mock Monitor.preparePreloadData
        const originalPreparePreloadData = Monitor.preparePreloadData;
        Monitor.preparePreloadData = async () => ({});

        try {
            // Call sendNotification
            await Monitor.sendNotification(false, mockMonitor, mockBean);

            // Notification SHOULD be sent (no quiet hours configured)
            assert.strictEqual(notificationCallCount, 1, "Notification should be sent when no quiet hours");
        } finally {
            // Restore original methods
            QuietHours.getQuietHoursForMonitor = originalGetQuietHours;
            Monitor.getNotificationList = originalGetNotificationList;
            UptimeKumaServer.getInstance = originalGetInstance;
            R.getRow = originalGetRow;
            Monitor.preparePreloadData = originalPreparePreloadData;
        }
    });
});
