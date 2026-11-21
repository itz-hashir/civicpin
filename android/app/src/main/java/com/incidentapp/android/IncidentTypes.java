package com.incidentapp.android;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public final class IncidentTypes {
    public static final String LIGHTING = "lighting";
    public static final String DRAINAGE = "drainage";
    public static final String ROADS = "roads";
    public static final String WASTE = "waste";
    public static final String WATER = "water";
    public static final String OTHER = "other";

    private static final List<String> VALUES = Collections.unmodifiableList(Arrays.asList(
            LIGHTING, DRAINAGE, ROADS, WASTE, WATER, OTHER));

    private IncidentTypes() {}

    public static List<String> values() {
        return VALUES;
    }

    public static boolean isValid(String type) {
        return VALUES.contains(type);
    }

    public static String displayName(String type) {
        if (!isValid(type)) return "Other";
        return type.substring(0, 1).toUpperCase(java.util.Locale.ROOT) + type.substring(1);
    }
}
