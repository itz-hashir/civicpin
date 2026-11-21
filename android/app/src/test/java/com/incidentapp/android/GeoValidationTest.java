package com.incidentapp.android;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class GeoValidationTest {
    @Test public void acceptsBoundaryAndInteriorCoordinates() {
        assertTrue(GeoValidation.isValid(0, 0));
        assertTrue(GeoValidation.isValid(-90, -180));
        assertTrue(GeoValidation.isValid(90, 180));
        assertTrue(GeoValidation.isValid(46.7712, 23.6236));
    }

    @Test public void rejectsOutOfRangeAndNonFiniteCoordinates() {
        assertFalse(GeoValidation.isValid(90.000001, 0));
        assertFalse(GeoValidation.isValid(-90.1, 0));
        assertFalse(GeoValidation.isValid(0, 180.000001));
        assertFalse(GeoValidation.isValid(0, -180.1));
        assertFalse(GeoValidation.isValid(Double.NaN, 0));
        assertFalse(GeoValidation.isValid(0, Double.NaN));
        assertFalse(GeoValidation.isValid(Double.POSITIVE_INFINITY, 0));
        assertFalse(GeoValidation.isValid(0, Double.NEGATIVE_INFINITY));
    }
}
