package com.incidentapp.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;

public final class IncidentTypesTest {
    @Test public void valuesMatchThePublicApiExactly() {
        assertEquals(Arrays.asList("lighting", "drainage", "roads", "waste", "water", "other"),
                IncidentTypes.values());
        for (String type : IncidentTypes.values()) assertTrue(IncidentTypes.isValid(type));
    }

    @Test public void rejectsUnknownAndIncorrectlyCasedTypes() {
        assertFalse(IncidentTypes.isValid("pothole"));
        assertFalse(IncidentTypes.isValid("Roads"));
        assertFalse(IncidentTypes.isValid(""));
        assertFalse(IncidentTypes.isValid(null));
    }
}
