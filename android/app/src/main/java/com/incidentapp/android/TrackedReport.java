package com.incidentapp.android;

import java.util.List;

public final class TrackedReport {
    public final String type;
    public final String status;
    public final String createdAt;
    public final List<StatusUpdate> history;
    public final Double latitude;
    public final Double longitude;
    public final String photoUrl;

    public TrackedReport(String type, String status, String createdAt, List<StatusUpdate> history,
                         Double latitude, Double longitude, String photoUrl) {
        this.type = type;
        this.status = status;
        this.createdAt = createdAt;
        this.history = history;
        this.latitude = latitude;
        this.longitude = longitude;
        this.photoUrl = photoUrl;
    }

    public boolean hasLocation() {
        return latitude != null && longitude != null;
    }

    public static final class StatusUpdate {
        public final String status;
        public final String changedAt;
        public final String note;

        public StatusUpdate(String status, String changedAt, String note) {
            this.status = status;
            this.changedAt = changedAt;
            this.note = note;
        }
    }
}
