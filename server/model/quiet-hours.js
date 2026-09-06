const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const { log } = require("../../src/util");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

class QuietHours extends BeanModel {
    /**
     * Return an object ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            monitorId: this.monitor_id,
            startTime: this.start_time,
            endTime: this.end_time,
            timezone: this.timezone,
            weekdays: this.weekdays ? JSON.parse(this.weekdays) : [],
            active: !!this.active,
        };
    }

    /**
     * Get weekdays list
     * @returns {number[]} Array of weekdays (1=Monday, 7=Sunday)
     */
    getWeekdaysList() {
        return JSON.parse(this.weekdays || "[]").sort((a, b) => a - b);
    }

    /**
     * Convert data from socket to bean
     * @param {Bean} bean Bean to fill in
     * @param {object} obj Data to fill bean with
     * @returns {Bean} Filled bean
     */
    static jsonToBean(bean, obj) {
        if (obj.id) {
            bean.id = obj.id;
        }

        bean.monitor_id = obj.monitorId;
        bean.start_time = obj.startTime;
        bean.end_time = obj.endTime;
        bean.timezone = obj.timezone;
        bean.weekdays = JSON.stringify(obj.weekdays || []);
        bean.active = obj.active !== false; // Default to true

        return bean;
    }

    /**
     * Get all quiet hours for a specific monitor from database
     * Returns plain objects (not ORM beans) for use in pure functions
     * @param {number} monitorId Monitor ID
     * @returns {Promise<Array>} Array of quiet hours windows as plain objects
     */
    static async getQuietHoursForMonitor(monitorId) {
        try {
            const rows = await R.getAll(
                "SELECT id, monitor_id, start_time, end_time, timezone, weekdays, active FROM quiet_hours WHERE monitor_id = ? AND active = 1",
                [monitorId]
            );

            // Convert to plain objects with parsed weekdays
            return rows.map(row => ({
                id: row.id,
                monitorId: row.monitor_id,
                startTime: row.start_time,
                endTime: row.end_time,
                timezone: row.timezone,
                weekdays: JSON.parse(row.weekdays || "[]"),
                active: !!row.active,
            }));
        } catch (error) {
            log.error("quiet-hours", `Error fetching quiet hours for monitor ${monitorId}: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all quiet hours for a monitor (including inactive ones)
     * @param {number} monitorId Monitor ID
     * @returns {Promise<Array>} Array of all quiet hours
     */
    static async getAllQuietHoursForMonitor(monitorId) {
        try {
            const rows = await R.getAll(
                "SELECT id, monitor_id, start_time, end_time, timezone, weekdays, active FROM quiet_hours WHERE monitor_id = ?",
                [monitorId]
            );

            return rows.map(row => ({
                id: row.id,
                monitorId: row.monitor_id,
                startTime: row.start_time,
                endTime: row.end_time,
                timezone: row.timezone,
                weekdays: JSON.parse(row.weekdays || "[]"),
                active: !!row.active,
            }));
        } catch (error) {
            log.error("quiet-hours", `Error fetching all quiet hours for monitor ${monitorId}: ${error.message}`);
            return [];
        }
    }
}

/**
 * Pure function to check if a given time falls within any quiet hours window
 * This function is testable without database access or real time
 * 
 * @param {Array} windows Array of quiet hours windows (plain objects with startTime, endTime, timezone, weekdays)
 * @param {Date|dayjs.Dayjs} currentTime The time to check (passed as parameter for testability)
 * @returns {boolean} True if current time is inside any quiet window
 */
function isInsideQuietWindow(windows, currentTime) {
    if (!windows || windows.length === 0) {
        return false;
    }

    // Convert to dayjs if it's a Date object
    const now = dayjs.isDayjs(currentTime) ? currentTime : dayjs(currentTime);

    for (const window of windows) {
        try {
            // Convert current time to the window's timezone
            const nowInWindowTz = now.tz(window.timezone);
            
            // Get current weekday (1=Monday, 7=Sunday) - dayjs uses 0=Sunday, 6=Saturday
            const currentWeekday = nowInWindowTz.day() === 0 ? 7 : nowInWindowTz.day();

            // Check if current weekday is in the allowed weekdays list
            // If weekdays array is empty, it means all days
            if (window.weekdays && window.weekdays.length > 0) {
                if (!window.weekdays.includes(currentWeekday)) {
                    continue; // Not active on this weekday
                }
            }

            // Parse start and end times in the window's timezone
            const [startHour, startMinute] = window.startTime.split(":").map(Number);
            const [endHour, endMinute] = window.endTime.split(":").map(Number);

            // Create time boundaries for today in the window's timezone
            const startTimeToday = nowInWindowTz.hour(startHour).minute(startMinute).second(0).millisecond(0);
            const endTimeToday = nowInWindowTz.hour(endHour).minute(endMinute).second(0).millisecond(0);

            // Check if the window spans across midnight
            if (endTimeToday.isBefore(startTimeToday) || endTimeToday.isSame(startTimeToday)) {
                // Window spans midnight (e.g., 22:00 - 06:00)
                // Check if we're after start time OR before end time
                if (nowInWindowTz.isSameOrAfter(startTimeToday) || nowInWindowTz.isBefore(endTimeToday)) {
                    return true;
                }
            } else {
                // Normal window within same day
                if (nowInWindowTz.isSameOrAfter(startTimeToday) && nowInWindowTz.isBefore(endTimeToday)) {
                    return true;
                }
            }
        } catch (error) {
            log.error("quiet-hours", `Error checking quiet window: ${error.message}`);
            // Continue checking other windows if one fails
            continue;
        }
    }

    return false;
}

module.exports = QuietHours;
module.exports.isInsideQuietWindow = isInsideQuietWindow;
