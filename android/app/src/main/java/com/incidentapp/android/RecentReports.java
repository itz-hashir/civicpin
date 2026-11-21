package com.incidentapp.android;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Private-device history containing no location, description, photo, or identity fields. */
public final class RecentReports {
    public static final int MAX_ENTRIES = 20;

    public static final class Entry {
        public final String code;
        public final String type;
        public final long createdAt;

        public Entry(String code, String type, long createdAt) {
            this.code = code;
            this.type = type;
            this.createdAt = createdAt;
        }
    }

    private final List<Entry> entries = new ArrayList<>();

    public RecentReports() {}

    public static RecentReports fromJson(String json) {
        RecentReports result = new RecentReports();
        if (json == null || json.trim().isEmpty()) return result;
        try {
            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length() && result.entries.size() < MAX_ENTRIES; i++) {
                JSONObject item = array.getJSONObject(i);
                String code = TrackingCode.normalize(item.getString("code"));
                String type = item.getString("type");
                long date = item.getLong("createdAt");
                if (code != null && IncidentTypes.isValid(type) && date > 0) {
                    result.entries.add(new Entry(code, type, date));
                }
            }
        } catch (JSONException | ClassCastException ignored) {
            return new RecentReports();
        }
        return result;
    }

    public List<Entry> entries() {
        return Collections.unmodifiableList(new ArrayList<>(entries));
    }

    public boolean isEmpty() {
        return entries.isEmpty();
    }

    public void add(String codeInput, String type, long createdAt) {
        String code = TrackingCode.normalize(codeInput);
        if (code == null || !IncidentTypes.isValid(type) || createdAt <= 0) {
            throw new IllegalArgumentException("Invalid recent report");
        }
        delete(code);
        entries.add(0, new Entry(code, type, createdAt));
        if (entries.size() > MAX_ENTRIES) {
            entries.remove(entries.size() - 1);
        }
    }

    public void delete(String codeInput) {
        String code = TrackingCode.normalize(codeInput);
        if (code == null) return;
        entries.removeIf(entry -> entry.code.equals(code));
    }

    public String toJson() {
        JSONArray array = new JSONArray();
        for (Entry entry : entries) {
            JSONObject item = new JSONObject();
            try {
                item.put("code", entry.code);
                item.put("type", entry.type);
                item.put("createdAt", entry.createdAt);
                array.put(item);
            } catch (JSONException impossible) {
                throw new IllegalStateException(impossible);
            }
        }
        return array.toString();
    }
}
