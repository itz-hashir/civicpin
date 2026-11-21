package com.incidentapp.android;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public final class PhotoProcessorTest {
    @Test public void samplingKeepsDecodeBoundedWithoutBreakingSmallImages() {
        assertEquals(1, PhotoProcessor.sampleSize(1200, 900, 3200));
        assertEquals(1, PhotoProcessor.sampleSize(3199, 2000, 3200));
        assertEquals(2, PhotoProcessor.sampleSize(4000, 3000, 3200));
        assertEquals(4, PhotoProcessor.sampleSize(12000, 9000, 3200));
        assertEquals(8, PhotoProcessor.sampleSize(24000, 18000, 3200));
    }
}
