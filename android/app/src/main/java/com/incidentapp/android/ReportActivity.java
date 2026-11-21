package com.incidentapp.android;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputFilter;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.incidentapp.android.databinding.ActivityReportBinding;

import org.osmdroid.config.Configuration;
import org.osmdroid.events.MapEventsReceiver;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.overlay.MapEventsOverlay;
import org.osmdroid.views.overlay.Marker;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import okhttp3.Call;

public final class ReportActivity extends AppCompatActivity {
    private ActivityReportBinding binding;
    private final CivicApi api = new CivicApi();
    private final ExecutorService photoExecutor = Executors.newSingleThreadExecutor();
    private Future<?> photoFuture;
    private Call activeCall;
    private RecentReportsStore store;
    private CurrentLocationFinder locationFinder;
    private Marker issueMarker;

    private Double selectedLatitude;
    private Double selectedLongitude;
    private String selectedType;
    private File processedPhoto;
    private Uri sourcePhotoUri;
    private File pendingCameraFile;
    private Uri pendingCameraUri;
    private boolean photoProcessing;
    private boolean submitting;
    private boolean destroyed;
    private int photoVersion;
    private int requestVersion;
    private AlertDialog successDialog;

    private final ActivityResultLauncher<PickVisualMediaRequest> photoPicker =
            registerForActivityResult(new ActivityResultContracts.PickVisualMedia(), uri -> {
                if (uri != null) processPhoto(uri);
            });

    private final ActivityResultLauncher<Uri> camera =
            registerForActivityResult(new ActivityResultContracts.TakePicture(), captured -> {
                if (Boolean.TRUE.equals(captured) && pendingCameraUri != null) {
                    processPhoto(pendingCameraUri);
                } else {
                    deleteFile(pendingCameraFile);
                    pendingCameraFile = null;
                    pendingCameraUri = null;
                }
            });

    private final ActivityResultLauncher<String[]> locationPermission =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), grants -> {
                if (hasLocationPermission(grants)) startLocationLookup();
                else showError(getString(R.string.location_permission_needed));
            });

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Configuration.getInstance().load(this,
                getSharedPreferences("civicpin_osmdroid", Context.MODE_PRIVATE));
        Configuration.getInstance().setUserAgentValue(BuildConfig.APPLICATION_ID);
        Configuration.getInstance().setOsmdroidBasePath(new File(getCacheDir(), "osmdroid"));
        Configuration.getInstance().setOsmdroidTileCache(new File(getCacheDir(), "osmdroid/tiles"));
        binding = ActivityReportBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        SystemBars.applyChildScreen(this, binding.toolbar, binding.scrollView);
        store = new RecentReportsStore(this);
        binding.toolbar.setNavigationContentDescription(R.string.back);
        binding.toolbar.setNavigationOnClickListener(view -> finish());
        binding.descriptionInput.setFilters(new InputFilter[]{new InputFilter.LengthFilter(1000)});

        setupMap();
        setupTypes();
        locationFinder = new CurrentLocationFinder(this, new CurrentLocationFinder.Listener() {
            @Override public void onLocation(Location location) {
                if (!destroyed) {
                    setLocation(location.getLatitude(), location.getLongitude());
                    setLocationLoading(false);
                }
            }

            @Override public void onUnavailable() {
                if (!destroyed) {
                    setLocationLoading(false);
                    showError(getString(R.string.location_unavailable));
                }
            }
        });

        binding.choosePhotoButton.setOnClickListener(view -> photoPicker.launch(
                new PickVisualMediaRequest.Builder()
                        .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE).build()));
        binding.cameraButton.setOnClickListener(view -> launchCamera());
        binding.locationButton.setOnClickListener(view -> requestLocation());
        binding.submitButton.setOnClickListener(view -> submit());

        if (savedInstanceState != null) restoreState(savedInstanceState);
        updateSubmitEnabled();
    }

    private void setupMap() {
        binding.map.setMultiTouchControls(true);
        binding.map.getController().setZoom(3.0);
        binding.map.getController().setCenter(new GeoPoint(20.0, 0.0));
        binding.map.setTileSource(org.osmdroid.tileprovider.tilesource.TileSourceFactory.MAPNIK);
        MapEventsOverlay events = new MapEventsOverlay(new MapEventsReceiver() {
            @Override public boolean singleTapConfirmedHelper(GeoPoint point) {
                if (!submitting) setLocation(point.getLatitude(), point.getLongitude());
                return true;
            }

            @Override public boolean longPressHelper(GeoPoint point) {
                return false;
            }
        });
        binding.map.getOverlays().add(events);
    }

    private void setupTypes() {
        List<String> labels = new ArrayList<>();
        for (String ignored : IncidentTypes.values()) labels.add("");
        for (int i = 0; i < IncidentTypes.values().size(); i++) {
            labels.set(i, getTypeLabel(IncidentTypes.values().get(i)));
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, labels);
        binding.typeInput.setAdapter(adapter);
        binding.typeInput.setOnClickListener(view -> binding.typeInput.showDropDown());
        binding.typeInput.setOnItemClickListener((parent, view, position, id) -> {
            selectedType = IncidentTypes.values().get(position);
            binding.typeInputLayout.setError(null);
        });
    }

    private void restoreState(Bundle state) {
        if (state.containsKey("lat") && state.containsKey("lng")) {
            setLocation(state.getDouble("lat"), state.getDouble("lng"));
        }
        selectedType = state.getString("type");
        if (IncidentTypes.isValid(selectedType)) binding.typeInput.setText(getTypeLabel(selectedType), false);
        String cameraPath = state.getString("cameraPath");
        if (cameraPath != null) {
            pendingCameraFile = new File(cameraPath);
            pendingCameraUri = pendingCameraFile.exists() ? fileUri(pendingCameraFile) : null;
        }
        String photoPath = state.getString("photoPath");
        if (photoPath != null) {
            File existing = new File(photoPath);
            if (existing.isFile()) {
                processedPhoto = existing;
                showPhotoPreview(existing, getString(R.string.photo_attached));
            }
        }
        String source = state.getString("sourceUri");
        if (source != null && processedPhoto == null) processPhoto(Uri.parse(source));
    }

    private void launchCamera() {
        if (submitting || photoProcessing) return;
        try {
            File directory = new File(getCacheDir(), "camera");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Camera directory");
            deleteFile(pendingCameraFile);
            pendingCameraFile = new File(directory, UUID.randomUUID() + ".jpg");
            pendingCameraUri = fileUri(pendingCameraFile);
            camera.launch(pendingCameraUri);
        } catch (RuntimeException exception) {
            showError(getString(R.string.camera_unavailable));
        }
    }

    private Uri fileUri(File file) {
        return FileProvider.getUriForFile(this, getPackageName() + ".files", file);
    }

    private void processPhoto(Uri uri) {
        if (destroyed) return;
        sourcePhotoUri = uri;
        int version = ++photoVersion;
        if (photoFuture != null) photoFuture.cancel(true);
        deleteFile(processedPhoto);
        processedPhoto = null;
        binding.photoPreview.setImageDrawable(null);
        binding.photoPreview.setContentDescription(getString(R.string.photo_preview_placeholder));
        photoProcessing = true;
        binding.photoStatusText.setText(R.string.photo_preparing);
        clearError();
        updateSubmitEnabled();
        File output = new File(getCacheDir(), "processed/" + UUID.randomUUID() + ".jpg");
        photoFuture = photoExecutor.submit(() -> {
            try {
                PhotoProcessor.Result result = PhotoProcessor.process(getApplicationContext(), uri, output);
                runOnUiThread(() -> {
                    if (!isPhotoCallbackCurrent(version)) {
                        deleteFile(result.file);
                        return;
                    }
                    photoProcessing = false;
                    processedPhoto = result.file;
                    if (uri.equals(pendingCameraUri)) {
                        deleteFile(pendingCameraFile);
                    }
                    showPhotoPreview(result.file, getString(R.string.photo_ready,
                            result.width, result.height, Math.max(1, result.bytes / 1024)));
                    updateSubmitEnabled();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if (!isPhotoCallbackCurrent(version)) return;
                    photoProcessing = false;
                    binding.photoPreview.setImageDrawable(null);
                    binding.photoStatusText.setText(R.string.photo_failed);
                    updateSubmitEnabled();
                });
            }
        });
    }

    private boolean isPhotoCallbackCurrent(int version) {
        return !destroyed && !isFinishing() && !isDestroyed() && version == photoVersion;
    }

    private void showPhotoPreview(File file, String status) {
        binding.photoPreview.setImageBitmap(BitmapFactory.decodeFile(file.getAbsolutePath()));
        binding.photoPreview.setContentDescription(getString(R.string.photo_preview));
        binding.photoStatusText.setText(status);
    }

    private void requestLocation() {
        if (hasLocationPermission(null)) startLocationLookup();
        else locationPermission.launch(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION});
    }

    private boolean hasLocationPermission(Map<String, Boolean> grants) {
        if (grants != null) {
            return Boolean.TRUE.equals(grants.get(Manifest.permission.ACCESS_FINE_LOCATION))
                    || Boolean.TRUE.equals(grants.get(Manifest.permission.ACCESS_COARSE_LOCATION));
        }
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void startLocationLookup() {
        clearError();
        setLocationLoading(true);
        locationFinder.start();
    }

    private void setLocationLoading(boolean loading) {
        binding.locationButton.setEnabled(!loading && !submitting);
        binding.locationButton.setText(loading ? R.string.finding_location : R.string.use_my_location);
    }

    private void setLocation(double latitude, double longitude) {
        if (!GeoValidation.isValid(latitude, longitude)) return;
        selectedLatitude = latitude;
        selectedLongitude = longitude;
        GeoPoint point = new GeoPoint(latitude, longitude);
        if (issueMarker == null) {
            issueMarker = new Marker(binding.map);
            issueMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            issueMarker.setTitle(getString(R.string.app_name));
            binding.map.getOverlays().add(issueMarker);
        }
        issueMarker.setPosition(point);
        binding.map.getController().animateTo(point);
        if (binding.map.getZoomLevelDouble() < 15.0) binding.map.getController().setZoom(16.0);
        binding.map.invalidate();
        binding.locationText.setText(getString(R.string.selected_location, latitude, longitude));
    }

    private void submit() {
        if (submitting || photoProcessing) return;
        clearError();
        binding.typeInputLayout.setError(null);
        String description = binding.descriptionInput.getText() == null ? ""
                : binding.descriptionInput.getText().toString().trim();
        if (processedPhoto == null || !processedPhoto.isFile()) {
            showError(getString(R.string.error_photo_required));
            return;
        }
        if (selectedLatitude == null || selectedLongitude == null
                || !GeoValidation.isValid(selectedLatitude, selectedLongitude)) {
            showError(getString(R.string.error_location_required));
            return;
        }
        if (!IncidentTypes.isValid(selectedType)) {
            binding.typeInputLayout.setError(getString(R.string.error_type_required));
            binding.typeInput.requestFocus();
            return;
        }
        if (description.length() > 1000) {
            showError(getString(R.string.description_too_long));
            return;
        }
        locationFinder.cancel();
        setLocationLoading(false);

        final String type = selectedType;
        final double latitude = selectedLatitude;
        final double longitude = selectedLongitude;
        final File photo = processedPhoto;
        final long submittedAt = System.currentTimeMillis();
        if (activeCall != null) activeCall.cancel();
        int version = ++requestVersion;
        setSubmitting(true);
        activeCall = api.submitReport(type, description, latitude, longitude, photo,
                new CivicApi.ResultCallback<String>() {
                    @Override public void onSuccess(String code) {
                        runOnUiThread(() -> {
                            if (!isRequestCallbackCurrent(version)) return;
                            setSubmitting(false);
                            activeCall = null;
                            store.save(code, type, submittedAt);
                            deleteFile(processedPhoto);
                            processedPhoto = null;
                            showCreated(code);
                        });
                    }

                    @Override public void onError(ApiError error) {
                        runOnUiThread(() -> {
                            if (!isRequestCallbackCurrent(version)) return;
                            setSubmitting(false);
                            activeCall = null;
                            if (error.reason != ApiError.Reason.CANCELLED) showApiError(error);
                        });
                    }
                });
    }

    private boolean isRequestCallbackCurrent(int version) {
        return !destroyed && !isFinishing() && !isDestroyed() && version == requestVersion;
    }

    private void showApiError(ApiError error) {
        switch (error.reason) {
            case OFFLINE: showError(getString(R.string.network_offline)); break;
            case TIMEOUT: showError(getString(R.string.network_timeout)); break;
            case HTTP: showError(getString(R.string.server_error, errorSuffix(error))); break;
            case INVALID_RESPONSE: showError(getString(R.string.invalid_response)); break;
            default: showError(getString(R.string.network_failed));
        }
    }

    private String errorSuffix(ApiError error) {
        if (!error.serverMessage.isEmpty()) return ": " + error.serverMessage;
        return error.httpCode > 0 ? " (HTTP " + error.httpCode + ")" : "";
    }

    private void showCreated(String code) {
        successDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.report_created_title)
                .setMessage(getString(R.string.report_created_message, code))
                .setPositiveButton(R.string.track_report, (dialog, which) -> {
                    startActivity(TrackActivity.intent(this, code));
                    finish();
                })
                .setNegativeButton(R.string.done, (dialog, which) -> finish())
                .setNeutralButton(R.string.copy_code, (dialog, which) -> {
                    ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    clipboard.setPrimaryClip(ClipData.newPlainText(getString(R.string.tracking_code_label), code));
                    Toast.makeText(this, R.string.code_copied, Toast.LENGTH_SHORT).show();
                    finish();
                })
                .setCancelable(false)
                .show();
    }

    private String getTypeLabel(String type) {
        switch (type) {
            case IncidentTypes.LIGHTING: return getString(R.string.type_lighting);
            case IncidentTypes.DRAINAGE: return getString(R.string.type_drainage);
            case IncidentTypes.ROADS: return getString(R.string.type_roads);
            case IncidentTypes.WASTE: return getString(R.string.type_waste);
            case IncidentTypes.WATER: return getString(R.string.type_water);
            default: return getString(R.string.type_other);
        }
    }

    private void setSubmitting(boolean submitting) {
        this.submitting = submitting;
        binding.submitProgress.setVisibility(submitting ? View.VISIBLE : View.GONE);
        binding.submitButton.setText(submitting ? R.string.submitting_report : R.string.submit_report);
        binding.choosePhotoButton.setEnabled(!submitting && !photoProcessing);
        binding.cameraButton.setEnabled(!submitting && !photoProcessing);
        binding.typeInput.setEnabled(!submitting);
        binding.descriptionInput.setEnabled(!submitting);
        setLocationLoading(false);
        updateSubmitEnabled();
    }

    private void updateSubmitEnabled() {
        if (binding == null) return;
        binding.submitButton.setEnabled(!submitting && !photoProcessing);
        binding.choosePhotoButton.setEnabled(!submitting && !photoProcessing);
        binding.cameraButton.setEnabled(!submitting && !photoProcessing);
    }

    private void showError(String message) {
        binding.errorText.setText(message);
        binding.errorText.setVisibility(View.VISIBLE);
        binding.errorText.announceForAccessibility(message);
        binding.scrollView.post(() -> binding.scrollView.smoothScrollTo(0, binding.errorText.getTop()));
    }

    private void clearError() {
        binding.errorText.setVisibility(View.GONE);
    }

    @Override protected void onResume() {
        super.onResume();
        binding.map.onResume();
    }

    @Override protected void onPause() {
        binding.map.onPause();
        super.onPause();
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        if (selectedLatitude != null && selectedLongitude != null) {
            outState.putDouble("lat", selectedLatitude);
            outState.putDouble("lng", selectedLongitude);
        }
        outState.putString("type", selectedType);
        if (processedPhoto != null) outState.putString("photoPath", processedPhoto.getAbsolutePath());
        if (sourcePhotoUri != null) outState.putString("sourceUri", sourcePhotoUri.toString());
        if (pendingCameraFile != null) outState.putString("cameraPath", pendingCameraFile.getAbsolutePath());
        super.onSaveInstanceState(outState);
    }

    @Override protected void onDestroy() {
        destroyed = true;
        requestVersion++;
        photoVersion++;
        if (activeCall != null) activeCall.cancel();
        if (photoFuture != null) photoFuture.cancel(true);
        photoExecutor.shutdownNow();
        if (locationFinder != null) locationFinder.cancel();
        if (successDialog != null) successDialog.dismiss();
        if (binding != null) binding.map.onDetach();
        super.onDestroy();
    }

    private static void deleteFile(File file) {
        if (file != null && file.exists()) file.delete();
    }
}
