<template>
    <div class="quiet-hours-section">
        <h5 class="mt-4 mb-3">{{ $t("Quiet Hours") }}</h5>
        <p class="form-text">
            {{ $t("Quiet hours are time windows where Down/Recovery notifications will not be sent.") }}
        </p>

        <div v-if="quietHoursList.length > 0" class="mb-3">
            <div
                v-for="(window, index) in quietHoursList"
                :key="window.id || index"
                class="quiet-hours-item mb-2 p-3 border rounded"
            >
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold">
                            {{ window.startTime }} - {{ window.endTime }}
                            <span class="badge bg-secondary ms-2">{{ window.timezone }}</span>
                        </div>
                        <div v-if="window.weekdays && window.weekdays.length > 0" class="text-muted small mt-1">
                            {{ formatWeekdays(window.weekdays) }}
                        </div>
                        <div v-else class="text-muted small mt-1">
                            {{ $t("Every day") }}
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            @click="editWindow(window)"
                        >
                            {{ $t("Edit") }}
                        </button>
                        <button
                            type="button"
                            class="btn btn-sm"
                            :class="window.active ? 'btn-outline-warning' : 'btn-outline-success'"
                            @click="toggleWindow(window)"
                        >
                            {{ window.active ? $t("Disable") : $t("Enable") }}
                        </button>
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            @click="deleteWindow(window)"
                        >
                            {{ $t("Delete") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="showAddModal"
        >
            {{ $t("Add Quiet Hours") }}
        </button>

        <!-- Modal for Add/Edit -->
        <div v-if="isModalVisible" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ editingWindow ? $t("Edit Quiet Hours") : $t("Add Quiet Hours") }}
                        </h5>
                        <button type="button" class="btn-close" @click="closeModal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Start Time") }}</label>
                            <input
                                v-model="formData.startTime"
                                type="time"
                                class="form-control"
                                required
                            />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("End Time") }}</label>
                            <input
                                v-model="formData.endTime"
                                type="time"
                                class="form-control"
                                required
                            />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Weekdays (leave empty for all days)") }}</label>
                            <div class="d-flex flex-wrap gap-2">
                                <div
                                    v-for="day in weekdayOptions"
                                    :key="day.value"
                                    class="form-check"
                                >
                                    <input
                                        :id="`day-${day.value}`"
                                        v-model="formData.weekdays"
                                        :value="day.value"
                                        type="checkbox"
                                        class="form-check-input"
                                    />
                                    <label :for="`day-${day.value}`" class="form-check-label">
                                        {{ day.label }}
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Timezone") }}</label>
                            <input
                                v-model="formData.timezone"
                                type="text"
                                class="form-control"
                                :placeholder="detectedTimezone"
                                readonly
                            />
                            <div class="form-text">
                                {{ $t("Timezone is automatically detected from your browser") }}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="closeModal">
                            {{ $t("Cancel") }}
                        </button>
                        <button type="button" class="btn btn-primary" @click="saveWindow">
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";

export default {
    name: "QuietHours",
    props: {
        monitorId: {
            type: Number,
            required: true,
        },
    },
    data() {
        return {
            quietHoursList: [],
            isModalVisible: false,
            editingWindow: null,
            detectedTimezone: "",
            formData: {
                startTime: "22:00",
                endTime: "08:00",
                weekdays: [],
                timezone: "",
            },
            weekdayOptions: [],
        };
    },
    mounted() {
        this.weekdayOptions = [
            { value: 1, label: this.$t("Monday") },
            { value: 2, label: this.$t("Tuesday") },
            { value: 3, label: this.$t("Wednesday") },
            { value: 4, label: this.$t("Thursday") },
            { value: 5, label: this.$t("Friday") },
            { value: 6, label: this.$t("Saturday") },
            { value: 7, label: this.$t("Sunday") },
        ];
        this.detectTimezone();
        this.loadQuietHours();
    },
    methods: {
        detectTimezone() {
            try {
                this.detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                this.formData.timezone = this.detectedTimezone;
            } catch (e) {
                console.error("Error detecting timezone:", e);
                this.detectedTimezone = "UTC";
                this.formData.timezone = "UTC";
            }
        },
        loadQuietHours() {
            this.$root.getSocket().emit("getMonitorQuietHours", this.monitorId, (res) => {
                if (res.ok) {
                    this.quietHoursList = res.quietHoursList || [];
                }
            });
        },
        showAddModal() {
            this.editingWindow = null;
            this.formData = {
                startTime: "22:00",
                endTime: "08:00",
                weekdays: [],
                timezone: this.detectedTimezone,
            };
            this.isModalVisible = true;
        },
        editWindow(window) {
            this.editingWindow = window;
            this.formData = {
                startTime: window.startTime,
                endTime: window.endTime,
                weekdays: [...(window.weekdays || [])],
                timezone: window.timezone,
            };
            this.isModalVisible = true;
        },
        closeModal() {
            this.isModalVisible = false;
            this.editingWindow = null;
        },
        saveWindow() {
            const toast = useToast();
            const data = {
                monitorId: this.monitorId,
                startTime: this.formData.startTime,
                endTime: this.formData.endTime,
                weekdays: this.formData.weekdays,
                timezone: this.formData.timezone,
                active: true,
            };

            if (this.editingWindow) {
                data.id = this.editingWindow.id;
                this.$root.getSocket().emit("editQuietHours", data, (res) => {
                    if (res.ok) {
                        toast.success(this.$t("Quiet hours updated successfully"));
                        this.loadQuietHours();
                        this.closeModal();
                    } else {
                        toast.error(res.msg);
                    }
                });
            } else {
                this.$root.getSocket().emit("addQuietHours", data, (res) => {
                    if (res.ok) {
                        toast.success(this.$t("Quiet hours added successfully"));
                        this.loadQuietHours();
                        this.closeModal();
                    } else {
                        toast.error(res.msg);
                    }
                });
            }
        },
        toggleWindow(window) {
            const toast = useToast();
            this.$root.getSocket().emit("toggleQuietHours", window.id, (res) => {
                if (res.ok) {
                    toast.success(res.msg);
                    this.loadQuietHours();
                } else {
                    toast.error(res.msg);
                }
            });
        },
        deleteWindow(window) {
            const toast = useToast();
            if (confirm(this.$t("Are you sure you want to delete this quiet hours window?"))) {
                this.$root.getSocket().emit("deleteQuietHours", window.id, (res) => {
                    if (res.ok) {
                        toast.success(this.$t("Quiet hours deleted successfully"));
                        this.loadQuietHours();
                    } else {
                        toast.error(res.msg);
                    }
                });
            }
        },
        formatWeekdays(weekdays) {
            if (!weekdays || weekdays.length === 0) {
                return this.$t("Every day");
            }
            const dayNames = {
                1: this.$t("Mon"),
                2: this.$t("Tue"),
                3: this.$t("Wed"),
                4: this.$t("Thu"),
                5: this.$t("Fri"),
                6: this.$t("Sat"),
                7: this.$t("Sun"),
            };
            return weekdays.map(day => dayNames[day]).join(", ");
        },
    },
};
</script>

<style scoped>
.quiet-hours-item {
    background-color: var(--bs-light);
}

.quiet-hours-item.inactive {
    opacity: 0.6;
}

.modal.show {
    display: block;
}
</style>
