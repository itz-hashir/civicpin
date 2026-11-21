package com.incidentapp.android;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;

public final class ReportJsonParser {
    private ReportJsonParser() {}

    public static String parseCreatedCode(String json) throws JSONException {
        JSONObject root = new JSONObject(json);
        String code = TrackingCode.normalize(root.getString("code"));
        if (code == null) throw new JSONException("Invalid tracking code");
        return code;
    }

    public static TrackedReport parseTrackedReport(String json) throws JSONException {
        JSONObject root = new JSONObject(json);
        String type = root.getString("type");
        if (!IncidentTypes.isValid(type)) throw new JSONException("Invalid report type");
        String status = normalizeStatus(root.getString("status"));
        if (status == null) throw new JSONException("Invalid report status");
        String createdAt = root.getString("createdAt").trim();
        if (createdAt.isEmpty()) throw new JSONException("Missing report date");

        ArrayList<TrackedReport.StatusUpdate> history = new ArrayList<>();
        if (root.has("statusHistory") && !root.isNull("statusHistory")) {
            JSONArray updates = root.getJSONArray("statusHistory");
            for (int i = 0; i < updates.length(); i++) {
                JSONObject item = updates.getJSONObject(i);
                String updateStatus = normalizeStatus(item.getString("status"));
                if (updateStatus == null) throw new JSONException("Invalid history status");
                String changedAt = item.optString("changedAt", createdAt).trim();
                String note = item.optString("note", "").trim();
                history.add(new TrackedReport.StatusUpdate(updateStatus, changedAt, note));
            }
        }

        Double latitude = null;
        Double longitude = null;
        if (root.has("location") && !root.isNull("location")) {
            JSONObject location = root.getJSONObject("location");
            if (!"Point".equals(location.optString("type"))) {
                throw new JSONException("Invalid location geometry");
            }
            JSONArray coordinates = location.getJSONArray("coordinates");
            if (coordinates.length() < 2) throw new JSONException("Invalid coordinates");
            double parsedLongitude = coordinates.getDouble(0);
            double parsedLatitude = coordinates.getDouble(1);
            if (!GeoValidation.isValid(parsedLatitude, parsedLongitude)) {
                throw new JSONException("Coordinates out of range");
            }
            latitude = parsedLatitude;
            longitude = parsedLongitude;
        }

        String photoUrl = null;
        String candidate = root.optString("photoUrl", "").trim();
        if (!candidate.isEmpty()) {
            try {
                URI uri = URI.create(candidate);
                String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
                if ((!scheme.equals("https") && !scheme.equals("http")) || uri.getHost() == null) {
                    throw new JSONException("Invalid photo URL");
                }
                photoUrl = candidate;
            } catch (IllegalArgumentException exception) {
                throw new JSONException("Invalid photo URL");
            }
        }

        return new TrackedReport(type, status, createdAt, Collections.unmodifiableList(history),
                latitude, longitude, photoUrl);
    }

    public static String normalizeStatus(String status) {
        if (status == null) return null;
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("submitted") || normalized.equals("in_progress")
                || normalized.equals("fixed") ? normalized : null;
    }
}
