package com.incidentapp.android;

import java.util.Locale;
import java.util.regex.Pattern;

public final class TrackingCode {
    private static final int CODE_LENGTH = 12;
    private static final Pattern VALID = Pattern.compile("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}");

    private TrackingCode() {}

    public static String normalize(String input) {
        if (input == null) return null;
        String normalized = input.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() != CODE_LENGTH || !VALID.matcher(normalized).matches()) {
            return null;
        }
        return normalized;
    }
}
