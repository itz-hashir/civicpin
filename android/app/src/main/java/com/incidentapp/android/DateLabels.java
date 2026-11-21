package com.incidentapp.android;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.FormatStyle;
import java.util.Locale;

public final class DateLabels {
    private DateLabels() {}

    public static String formatDateTime(String isoDate) {
        return formatDateTime(isoDate, Locale.getDefault(), ZoneId.systemDefault());
    }

    static String formatDateTime(String isoDate, Locale locale, ZoneId zone) {
        if (isoDate == null || isoDate.trim().isEmpty()) return "Date unavailable";
        try {
            Instant instant = Instant.parse(isoDate);
            return DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM)
                    .withLocale(locale).withZone(zone).format(instant);
        } catch (DateTimeParseException exception) {
            return isoDate;
        }
    }

    public static String formatRecentDate(long epochMillis) {
        return DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM)
                .withLocale(Locale.getDefault()).withZone(ZoneId.systemDefault())
                .format(Instant.ofEpochMilli(epochMillis));
    }
}
