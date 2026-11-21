package com.incidentapp.android;

import android.content.Context;
import android.content.SharedPreferences;

public final class RecentReportsStore {
    private static final String PREFERENCES = "civicpin_private_history";
    private static final String KEY_REPORTS = "reports";
    private final SharedPreferences preferences;

    public RecentReportsStore(Context context) {
        preferences = context.getApplicationContext()
                .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    public RecentReports load() {
        return RecentReports.fromJson(preferences.getString(KEY_REPORTS, null));
    }

    public void save(String code, String type, long createdAt) {
        RecentReports reports = load();
        reports.add(code, type, createdAt);
        preferences.edit().putString(KEY_REPORTS, reports.toJson()).apply();
    }

    public void delete(String code) {
        RecentReports reports = load();
        reports.delete(code);
        preferences.edit().putString(KEY_REPORTS, reports.toJson()).apply();
    }
}
