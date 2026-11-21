package com.incidentapp.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public final class TrackingCodeTest {
    @Test public void normalizesWhitespaceAndCase() {
        assertEquals("ABCDEFGHJKLM", TrackingCode.normalize("  abcdefghjklm\n"));
    }

    @Test public void rejectsWrongLengthAndAmbiguousCharacters() {
        assertNull(TrackingCode.normalize(null));
        assertNull(TrackingCode.normalize(""));
        assertNull(TrackingCode.normalize("ABCDEFGHJKL"));
        assertNull(TrackingCode.normalize("ABCDEFGHJKLMN"));
        assertNull(TrackingCode.normalize("ABCDEFGHIJKL"));
        assertNull(TrackingCode.normalize("ABCDEFGHJKL0"));
        assertNull(TrackingCode.normalize("ABCD EFGHJKLM"));
        assertNull(TrackingCode.normalize("ABCD-EFGHJKLM"));
    }
}
