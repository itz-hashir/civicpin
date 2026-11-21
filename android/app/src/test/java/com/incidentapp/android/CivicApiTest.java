package com.incidentapp.android;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

public final class CivicApiTest {
    private MockWebServer server;

    @Before public void startServer() throws IOException {
        server = new MockWebServer();
        server.start();
    }

    @After public void stopServer() throws IOException {
        server.shutdown();
    }

    @Test public void submitsExpectedMultipartAndTracksReturnedCode() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(201)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"code\":\"ABCDEFGHJKLM\"}"));
        server.enqueue(new MockResponse().setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"type\":\"roads\",\"status\":\"submitted\","
                        + "\"createdAt\":\"2026-11-19T12:00:00.000Z\","
                        + "\"statusHistory\":[{\"status\":\"submitted\","
                        + "\"changedAt\":\"2026-11-19T12:00:00.000Z\",\"note\":\"\"}],"
                        + "\"location\":{\"type\":\"Point\",\"coordinates\":[69.3451,30.3753]}}"));
        BlockingQueue<Object> results = new LinkedBlockingQueue<>();
        CivicApi api = new CivicApi(server.url("/").toString());
        File photo = File.createTempFile("civicpin-evidence", ".jpg");
        Files.write(photo.toPath(), new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff});
        try {
            api.submitReport("roads", "Damaged curb at the crossing", 30.3753, 69.3451,
                    photo, callback(results));
            assertEquals("ABCDEFGHJKLM", await(results));

            RecordedRequest post = server.takeRequest(5, TimeUnit.SECONDS);
            assertNotNull(post);
            assertEquals("POST", post.getMethod());
            assertEquals("/api/reports", post.getPath());
            String body = post.getBody().readUtf8();
            assertField(body, "type", "roads");
            assertField(body, "description", "Damaged curb at the crossing");
            assertField(body, "lat", "30.3753");
            assertField(body, "lng", "69.3451");
            assertTrue(body.contains("name=\"photo\"; filename=\"" + photo.getName() + "\""));
            assertTrue(body.contains("Content-Type: image/jpeg"));

            api.trackReport("ABCDEFGHJKLM", callback(results));
            TrackedReport tracked = await(results);
            assertEquals("roads", tracked.type);
            assertEquals("submitted", tracked.status);
            assertEquals(1, tracked.history.size());
            RecordedRequest trackedRequest = server.takeRequest(5, TimeUnit.SECONDS);
            assertNotNull(trackedRequest);
            assertEquals("GET", trackedRequest.getMethod());
            assertEquals("/api/reports/ABCDEFGHJKLM", trackedRequest.getPath());
        } finally {
            Files.deleteIfExists(photo.toPath());
        }
    }

    private static void assertField(String multipart, String name, String value) {
        int header = multipart.indexOf("name=\"" + name + "\"\r\n");
        int bodyStart = header < 0 ? -1 : multipart.indexOf("\r\n\r\n", header);
        assertTrue("Expected valid multipart field " + name + ": " + multipart,
                bodyStart >= 0 && multipart.startsWith(value + "\r\n", bodyStart + 4));
    }

    private static <T> CivicApi.ResultCallback<T> callback(BlockingQueue<Object> results) {
        return new CivicApi.ResultCallback<T>() {
            @Override public void onSuccess(T value) { results.add(value); }
            @Override public void onError(ApiError error) { results.add(error); }
        };
    }

    @SuppressWarnings("unchecked")
    private static <T> T await(BlockingQueue<Object> results) throws Exception {
        Object result = results.poll(10, TimeUnit.SECONDS);
        if (result instanceof ApiError) throw (ApiError) result;
        assertNotNull("Callback did not arrive within 10 seconds", result);
        return (T) result;
    }
}
