package com.incidentapp.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class RecentReportsTest {
    private static final String CODE = "ABCDEFGHJKLM";

    @Test public void defaultAndMissingStateAreEmpty() {
        assertTrue(new RecentReports().isEmpty());
        assertTrue(RecentReports.fromJson(null).isEmpty());
        assertTrue(RecentReports.fromJson("").isEmpty());
    }

    @Test public void loadsKnownFieldsAndPersistedRoundTrip() {
        RecentReports loaded = RecentReports.fromJson(
                "[{\"code\":\"ABCDEFGHJKLM\",\"type\":\"roads\",\"createdAt\":1763500000000}]");
        assertEquals(1, loaded.entries().size());
        RecentReports.Entry entry = loaded.entries().get(0);
        assertEquals(CODE, entry.code);
        assertEquals("roads", entry.type);
        assertEquals(1763500000000L, entry.createdAt);

        RecentReports restored = RecentReports.fromJson(loaded.toJson());
        assertEquals(CODE, restored.entries().get(0).code);
        assertEquals("roads", restored.entries().get(0).type);
        assertEquals(1763500000000L, restored.entries().get(0).createdAt);
    }

    @Test public void addingMovesNewestFirstAndReplacesDuplicateCode() {
        RecentReports reports = new RecentReports();
        reports.add(CODE, "roads", 1000L);
        reports.add("23456789ABCD", "waste", 2000L);
        reports.add(CODE, "lighting", 3000L);
        assertEquals(2, reports.entries().size());
        assertEquals(CODE, reports.entries().get(0).code);
        assertEquals("lighting", reports.entries().get(0).type);
        assertEquals(3000L, reports.entries().get(0).createdAt);
    }

    @Test public void deletionOnlyRemovesMatchingCode() {
        RecentReports reports = new RecentReports();
        reports.add(CODE, "roads", 1000L);
        reports.add("23456789ABCD", "waste", 2000L);
        reports.delete(CODE);
        assertEquals(1, reports.entries().size());
        assertEquals("23456789ABCD", reports.entries().get(0).code);
    }

    @Test public void historyIsBoundedToTwentyEntries() {
        RecentReports reports = new RecentReports();
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (int i = 0; i < 25; i++) {
            reports.add("ABCDEFGHJKL" + alphabet.charAt(i), "other", i + 1L);
        }
        assertEquals(20, reports.entries().size());
        assertEquals(25L, reports.entries().get(0).createdAt);
        assertEquals(6L, reports.entries().get(19).createdAt);
    }

    @Test public void malformedStoredJsonFallsBackToSafeEmptyState() {
        assertTrue(RecentReports.fromJson("{not an array").isEmpty());
        assertFalse(RecentReports.fromJson("[]").entries().iterator().hasNext());
    }

    @Test(expected = IllegalArgumentException.class)
    public void refusesUnknownTypes() {
        new RecentReports().add(CODE, "pothole", 1000L);
    }
}
