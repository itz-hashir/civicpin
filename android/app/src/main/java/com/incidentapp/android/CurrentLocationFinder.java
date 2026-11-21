package com.incidentapp.android;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.List;

final class CurrentLocationFinder {
    interface Listener {
        void onLocation(Location location);
        void onUnavailable();
    }

    private static final long TIMEOUT_MILLIS = 20_000L;
    private final Activity activity;
    private final LocationManager manager;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Listener listener;
    private CancellationSignal cancellationSignal;
    private boolean active;

    private final LocationListener legacyListener = location -> complete(location);
    private final Runnable timeout = () -> fail();

    CurrentLocationFinder(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        this.manager = (LocationManager) activity.getSystemService(Activity.LOCATION_SERVICE);
    }

    void start() {
        cancel();
        active = true;
        String provider = chooseProvider();
        if (provider == null) {
            useLastKnownOrFail();
            return;
        }
        handler.postDelayed(timeout, TIMEOUT_MILLIS);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                cancellationSignal = new CancellationSignal();
                manager.getCurrentLocation(provider, cancellationSignal, activity.getMainExecutor(), location -> {
                    if (location != null) complete(location);
                    else useLastKnownOrFail();
                });
            } else {
                manager.requestSingleUpdate(provider, legacyListener, Looper.getMainLooper());
            }
        } catch (SecurityException | IllegalArgumentException exception) {
            useLastKnownOrFail();
        }
    }

    void cancel() {
        active = false;
        handler.removeCallbacks(timeout);
        if (cancellationSignal != null) cancellationSignal.cancel();
        cancellationSignal = null;
        if (manager != null) {
            try { manager.removeUpdates(legacyListener); } catch (SecurityException ignored) {}
        }
    }

    private String chooseProvider() {
        if (manager == null) return null;
        boolean fine = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        List<String> providers = manager.getProviders(true);
        if (fine && providers.contains(LocationManager.GPS_PROVIDER)) return LocationManager.GPS_PROVIDER;
        if (providers.contains(LocationManager.NETWORK_PROVIDER)) return LocationManager.NETWORK_PROVIDER;
        return null;
    }

    private void useLastKnownOrFail() {
        if (!active) return;
        if (manager == null) {
            fail();
            return;
        }
        try {
            Location best = null;
            for (String provider : manager.getProviders(true)) {
                Location candidate = manager.getLastKnownLocation(provider);
                if (candidate == null) continue;
                boolean recent = SystemClock.elapsedRealtimeNanos() - candidate.getElapsedRealtimeNanos()
                        < 5 * 60 * 1_000_000_000L;
                if (recent && (best == null || candidate.getAccuracy() < best.getAccuracy())) best = candidate;
            }
            if (best != null) complete(best);
            else fail();
        } catch (SecurityException | IllegalArgumentException exception) {
            fail();
        }
    }

    private void complete(Location location) {
        if (!active || location == null || !GeoValidation.isValid(location.getLatitude(), location.getLongitude())) return;
        active = false;
        handler.removeCallbacks(timeout);
        if (cancellationSignal != null) cancellationSignal.cancel();
        listener.onLocation(location);
    }

    private void fail() {
        if (!active) return;
        cancel();
        listener.onUnavailable();
    }
}
