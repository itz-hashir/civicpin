package com.incidentapp.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONException;
import org.junit.Test;

public final class ReportJsonParserTest {
    @Test public void parsesCreationCodeAndNormalizesCase() throws Exception {
        assertEquals("ABCDEFGHJKLM", ReportJsonParser.parseCreatedCode("{\"code\":\"abcdefghjklm\"}"));
    }

    @Test public void parsesCompleteTrackingResponseWithFlatPhotoUrl() throws Exception {
        String json = "{"
                + "\"type\":\"drainage\",\"status\":\"in_progress\","
                + "\"createdAt\":\"2026-11-19T10:15:30.000Z\","
                + "\"statusHistory\":["
                + "{\"status\":\"submitted\",\"changedAt\":\"2026-11-19T10:15:30.000Z\",\"note\":\"\"},"
                + "{\"status\":\"in_progress\",\"changedAt\":\"2026-11-19T11:20:00.000Z\",\"note\":\"Crew assigned\"}],"
                + "\"location\":{\"type\":\"Point\",\"coordinates\":[23.6236,46.7712]},"
                + "\"photoUrl\":\"https://example.blob.vercel-storage.com/photo.jpg\"}";
        TrackedReport report = ReportJsonParser.parseTrackedReport(json);

        assertEquals("drainage", report.type);
        assertEquals("in_progress", report.status);
        assertEquals("2026-11-19T10:15:30.000Z", report.createdAt);
        assertEquals(2, report.history.size());
        assertEquals("Crew assigned", report.history.get(1).note);
        assertEquals(46.7712, report.latitude, 0.0000001);
        assertEquals(23.6236, report.longitude, 0.0000001);
        assertEquals("https://example.blob.vercel-storage.com/photo.jpg", report.photoUrl);
    }

    @Test public void parsesResponseWithoutOptionalLinksOrHistory() throws Exception {
        TrackedReport report = ReportJsonParser.parseTrackedReport(
                "{\"type\":\"other\",\"status\":\"fixed\",\"createdAt\":\"2026-11-19T10:15:30Z\"}");
        assertTrue(report.history.isEmpty());
        assertNull(report.latitude);
        assertNull(report.longitude);
        assertNull(report.photoUrl);
    }

    @Test public void mapsStatusesAtTheDtoBoundary() {
        assertEquals("submitted", ReportJsonParser.normalizeStatus(" submitted "));
        assertEquals("in_progress", ReportJsonParser.normalizeStatus("IN_PROGRESS"));
        assertEquals("fixed", ReportJsonParser.normalizeStatus("fixed"));
        assertNull(ReportJsonParser.normalizeStatus("deleted"));
    }

    @Test(expected = JSONException.class)
    public void rejectsMalformedCreationJson() throws Exception {
        ReportJsonParser.parseCreatedCode("not-json");
    }

    @Test(expected = JSONException.class)
    public void rejectsUnknownTrackingStatus() throws Exception {
        ReportJsonParser.parseTrackedReport(
                "{\"type\":\"roads\",\"status\":\"archived\",\"createdAt\":\"2026-11-19T10:15:30Z\"}");
    }

    @Test(expected = JSONException.class)
    public void rejectsInvalidCoordinates() throws Exception {
        ReportJsonParser.parseTrackedReport("{\"type\":\"roads\",\"status\":\"submitted\","
                + "\"createdAt\":\"2026-11-19T10:15:30Z\",\"location\":{\"type\":\"Point\","
                + "\"coordinates\":[200,46]}}");
    }

    @Test(expected = JSONException.class)
    public void rejectsUnsafePhotoSchemes() throws Exception {
        ReportJsonParser.parseTrackedReport("{\"type\":\"roads\",\"status\":\"submitted\","
                + "\"createdAt\":\"2026-11-19T10:15:30Z\","
                + "\"photoUrl\":\"javascript:alert(1)\"}");
    }
}
