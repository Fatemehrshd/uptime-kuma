const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const QuietHours = require("../model/quiet-hours");

/**
 * Handlers for Quiet Hours
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.quietHoursSocketHandler = (socket) => {
    // Add a new quiet hours window
    socket.on("addQuietHours", async (quietHours, callback) => {
        try {
            checkLogin(socket);

            log.debug("quiet-hours", quietHours);

            let bean = QuietHours.jsonToBean(R.dispense("quiet_hours"), quietHours);
            let quietHoursID = await R.store(bean);

            callback({
                ok: true,
                msg: "Quiet hours added successfully",
                quietHoursID,
            });
        } catch (e) {
            log.error("quiet-hours", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Edit a quiet hours window
    socket.on("editQuietHours", async (quietHours, callback) => {
        try {
            checkLogin(socket);

            log.debug("quiet-hours", `Editing quiet hours: ${quietHours.id}`);

            let bean = await R.findOne("quiet_hours", " id = ? ", [quietHours.id]);

            if (!bean) {
                throw new Error("Quiet hours not found");
            }

            QuietHours.jsonToBean(bean, quietHours);
            await R.store(bean);

            callback({
                ok: true,
                msg: "Quiet hours updated successfully",
                quietHoursID: bean.id,
            });
        } catch (e) {
            log.error("quiet-hours", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Get a specific quiet hours window
    socket.on("getQuietHours", async (quietHoursID, callback) => {
        try {
            checkLogin(socket);

            log.debug("quiet-hours", `Get Quiet Hours: ${quietHoursID}`);

            let bean = await R.findOne("quiet_hours", " id = ? ", [quietHoursID]);

            if (!bean) {
                throw new Error("Quiet hours not found");
            }

            callback({
                ok: true,
                quietHours: bean.toJSON(),
            });
        } catch (e) {
            log.error("quiet-hours", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Get all quiet hours for a specific monitor
    socket.on("getMonitorQuietHours", async (monitorID, callback) => {
        try {
            checkLogin(socket);

            log.debug("quiet-hours", `Get Quiet Hours for Monitor: ${monitorID}`);

            const quietHoursList = await QuietHours.getAllQuietHoursForMonitor(monitorID);

            callback({
                ok: true,
                quietHoursList,
            });
        } catch (e) {
            log.error("quiet-hours", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Delete a quiet hours window
    socket.on("deleteQuietHours", async (quietHoursID, callback) => {
        try {
            checkLogin(socket);

            log.debug("quiet-hours", `Delete Quiet Hours: ${quietHoursID}`);

            await R.exec("DELETE FROM quiet_hours WHERE id = ? ", [quietHoursID]);

            callback({
                ok: true,
                msg: "Quiet hours deleted successfully",
            });
        } catch (e) {
            log.error("quiet-hours", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Toggle active status of a quiet hours window
    socket.on("toggleQuietHours", async (quietHoursID, callback) => {
        try {
            checkLogin(socket);

            log.debug("quiet-hours", `Toggle Quiet Hours: ${quietHoursID}`);

            let bean = await R.findOne("quiet_hours", " id = ? ", [quietHoursID]);

            if (!bean) {
                throw new Error("Quiet hours not found");
            }

            bean.active = !bean.active;
            await R.store(bean);

            callback({
                ok: true,
                msg: bean.active ? "Quiet hours activated" : "Quiet hours deactivated",
                active: bean.active,
            });
        } catch (e) {
            log.error("quiet-hours", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
