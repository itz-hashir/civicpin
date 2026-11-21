package com.incidentapp.android;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.material.textfield.TextInputLayout;
import com.incidentapp.android.databinding.ActivityTrackBinding;

import java.util.Locale;

import okhttp3.Call;

public final class TrackActivity extends AppCompatActivity {
    private static final String EXTRA_CODE = "com.incidentapp.android.extra.TRACKING_CODE";

    private ActivityTrackBinding binding;
    private CivicApi api;
    private Call activeCall;
    private int requestVersion;
    private boolean destroyed;
    private String lastRequestedCode;

    public static Intent intent(Context context, String code) {
        Intent intent = new Intent(context, TrackActivity.class);
        if (code != null) intent.putExtra(EXTRA_CODE, code);
        return intent;
    }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityTrackBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        SystemBars.applyChildScreen(this, binding.toolbar, binding.trackScrollView);
        api = new CivicApi();
        binding.toolbar.setNavigationContentDescription(R.string.back);
        binding.toolbar.setNavigationOnClickListener(view -> finish());

        String initialCode = getIntent().getStringExtra(EXTRA_CODE);
        if (savedInstanceState != null && savedInstanceState.containsKey("code")) {
            initialCode = savedInstanceState.getString("code");
        }
        if (initialCode != null) binding.codeInput.setText(initialCode);

        binding.findButton.setOnClickListener(view -> findReport());
        binding.retryButton.setOnClickListener(view -> findReport());
        binding.codeInput.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                findReport();
                return true;
            }
            return false;
        });
        binding.codeInput.setOnFocusChangeListener((view, focused) -> {
            if (focused) binding.codeInputLayout.setError(null);
        });
        if (initialCode != null && !initialCode.trim().isEmpty()) findReport();
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        outState.putString("code", binding.codeInput.getText() == null ? "" : binding.codeInput.getText().toString());
        super.onSaveInstanceState(outState);
    }

    private void findReport() {
        String raw = binding.codeInput.getText() == null ? "" : binding.codeInput.getText().toString();
        binding.codeInputLayout.setError(null);
        if (raw.trim().isEmpty()) {
            showInputError(getString(R.string.error_code_empty));
            return;
        }
        String code = TrackingCode.normalize(raw);
        if (code == null) {
            showInputError(getString(R.string.error_code_malformed));
            return;
        }
        binding.codeInput.setText(code);
        binding.codeInput.setSelection(code.length());
        lastRequestedCode = code;
        if (activeCall != null) activeCall.cancel();
        int version = ++requestVersion;
        setLoading(true);
        binding.resultCard.setVisibility(View.GONE);
        binding.errorText.setVisibility(View.GONE);
        binding.retryButton.setVisibility(View.GONE);
        activeCall = api.trackReport(code, new CivicApi.ResultCallback<TrackedReport>() {
            @Override public void onSuccess(TrackedReport result) {
                postIfCurrent(version, () -> {
                    setLoading(false);
                    activeCall = null;
                    showResult(result);
                });
            }

            @Override public void onError(ApiError error) {
                postIfCurrent(version, () -> {
                    setLoading(false);
                    activeCall = null;
                    if (error.reason != ApiError.Reason.CANCELLED) showNetworkError(error);
                });
            }
        });
    }

    private void postIfCurrent(int version, Runnable action) {
        runOnUiThread(() -> {
            if (!destroyed && !isFinishing() && !isDestroyed() && version == requestVersion) action.run();
        });
    }

    private void showInputError(String message) {
        binding.codeInputLayout.setError(message);
        // TextInputLayout announces errors politely by default.
        binding.codeInput.requestFocus();
    }

    private void showNetworkError(ApiError error) {
        binding.resultCard.setVisibility(View.GONE);
        String message;
        boolean retry = true;
        switch (error.reason) {
            case NOT_FOUND:
                message = getString(R.string.report_not_found);
                retry = false;
                break;
            case OFFLINE:
                message = getString(R.string.network_offline);
                break;
            case TIMEOUT:
                message = getString(R.string.network_timeout);
                break;
            case HTTP:
                message = getString(R.string.track_server_error, errorSuffix(error));
                break;
            case INVALID_RESPONSE:
                message = getString(R.string.invalid_response);
                break;
            default:
                message = getString(R.string.network_failed);
        }
        binding.errorText.setText(message);
        binding.errorText.setVisibility(View.VISIBLE);
        binding.retryButton.setVisibility(retry ? View.VISIBLE : View.GONE);
        binding.errorText.announceForAccessibility(message);
    }

    private void showResult(TrackedReport report) {
        binding.errorText.setVisibility(View.GONE);
        binding.retryButton.setVisibility(View.GONE);
        binding.resultCard.setVisibility(View.VISIBLE);
        binding.typeText.setText(getString(R.string.issue_type, getTypeLabel(report.type)));
        binding.dateText.setText(getString(R.string.submitted_on, DateLabels.formatDateTime(report.createdAt)));
        setStatusChip(binding.statusChip, report.status);
        renderTimeline(report);
        binding.locationLinkButton.setVisibility(report.hasLocation() ? View.VISIBLE : View.GONE);
        binding.photoLinkButton.setVisibility(report.photoUrl == null ? View.GONE : View.VISIBLE);
        binding.locationLinkButton.setOnClickListener(view -> openLocation(report.latitude, report.longitude));
        binding.photoLinkButton.setOnClickListener(view -> openWebLink(report.photoUrl));
        binding.resultCard.announceForAccessibility(getString(R.string.issue_type, getTypeLabel(report.type)));
    }

    private void renderTimeline(TrackedReport report) {
        binding.timelineContainer.removeAllViews();
        if (report.history.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setTextAppearance(R.style.Text_Civicpin_Helper);
            empty.setText(R.string.no_history);
            binding.timelineContainer.addView(empty);
            return;
        }
        for (TrackedReport.StatusUpdate update : report.history) {
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setPadding(0, 0, 0, dp(18));

            TextView status = new TextView(this);
            status.setTextAppearance(R.style.Text_Civicpin_TimelineTitle);
            status.setTypeface(Typeface.DEFAULT_BOLD);
            status.setTextColor(statusColor(update.status));
            status.setText("●  " + getStatusLabel(update.status));
            item.addView(status);

            TextView date = new TextView(this);
            date.setTextAppearance(R.style.Text_Civicpin_Helper);
            date.setPadding(dp(18), dp(2), 0, 0);
            date.setText(DateLabels.formatDateTime(update.changedAt));
            item.addView(date);

            if (!update.note.isEmpty()) {
                TextView note = new TextView(this);
                note.setTextAppearance(R.style.Text_Civicpin_TimelineNote);
                note.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
                note.setPadding(dp(18), dp(6), 0, 0);
                note.setText(update.note);
                item.addView(note);
            }
            binding.timelineContainer.addView(item);
        }
    }

    private void setStatusChip(TextView chip, String status) {
        chip.setText(getStatusLabel(status));
        switch (status) {
            case "submitted":
                chip.setBackgroundResource(R.drawable.bg_status_submitted);
                chip.setTextColor(ContextCompat.getColor(this, R.color.brick));
                break;
            case "fixed":
                chip.setBackgroundResource(R.drawable.bg_status_fixed);
                chip.setTextColor(ContextCompat.getColor(this, R.color.fixed_green));
                break;
            default:
                chip.setBackgroundResource(R.drawable.bg_status_in_progress);
                chip.setTextColor(ContextCompat.getColor(this, R.color.forest));
        }
    }

    private String getStatusLabel(String status) {
        if ("submitted".equals(status)) return getString(R.string.status_submitted);
        if ("fixed".equals(status)) return getString(R.string.status_fixed);
        return getString(R.string.status_in_progress);
    }

    private int statusColor(String status) {
        int color = "submitted".equals(status) ? R.color.brick
                : "fixed".equals(status) ? R.color.fixed_green : R.color.forest;
        return ContextCompat.getColor(this, color);
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

    private void openLocation(double latitude, double longitude) {
        String query = String.format(Locale.US, "%.6f,%.6f(%s)", latitude, longitude,
                Uri.encode("Civicpin issue"));
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + query)));
        } catch (ActivityNotFoundException exception) {
            openWebLink(String.format(Locale.US,
                    "https://www.openstreetmap.org/?mlat=%.6f&mlon=%.6f#map=18/%.6f/%.6f",
                    latitude, longitude, latitude, longitude));
        }
    }

    private void openWebLink(String url) {
        if (url == null) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException | SecurityException exception) {
            binding.errorText.setText(R.string.no_app_for_link);
            binding.errorText.setVisibility(View.VISIBLE);
        }
    }

    private String errorSuffix(ApiError error) {
        if (!error.serverMessage.isEmpty()) return ": " + error.serverMessage;
        return error.httpCode > 0 ? " (HTTP " + error.httpCode + ")" : "";
    }

    private void setLoading(boolean loading) {
        binding.loadingProgress.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.loadingText.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.findButton.setEnabled(!loading);
        binding.findButton.setText(loading ? R.string.lookup_loading : R.string.lookup_report);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override protected void onDestroy() {
        destroyed = true;
        requestVersion++;
        if (activeCall != null) activeCall.cancel();
        super.onDestroy();
    }
}
