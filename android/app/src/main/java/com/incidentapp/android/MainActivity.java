package com.incidentapp.android;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.incidentapp.android.databinding.ActivityMainBinding;

public final class MainActivity extends AppCompatActivity {
    private ActivityMainBinding binding;
    private RecentReportsStore store;
    private RecentReportsAdapter adapter;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        SystemBars.applyHome(this, binding.getRoot());
        store = new RecentReportsStore(this);
        adapter = new RecentReportsAdapter(new RecentReportsAdapter.Listener() {
            @Override public void onTrack(String code) {
                startActivity(TrackActivity.intent(MainActivity.this, code));
            }

            @Override public void onDelete(String code) {
                store.delete(code);
                reloadRecents();
                Toast.makeText(MainActivity.this, R.string.code_removed, Toast.LENGTH_SHORT).show();
            }
        });
        binding.recentList.setLayoutManager(new LinearLayoutManager(this));
        binding.recentList.setAdapter(adapter);
        binding.reportButton.setOnClickListener(view ->
                startActivity(new Intent(this, ReportActivity.class)));
        binding.trackButton.setOnClickListener(view ->
                startActivity(TrackActivity.intent(this, null)));
    }

    @Override protected void onResume() {
        super.onResume();
        reloadRecents();
    }

    private void reloadRecents() {
        RecentReports recent = store.load();
        adapter.setEntries(recent.entries());
        boolean empty = recent.isEmpty();
        binding.emptyRecentText.setVisibility(empty ? View.VISIBLE : View.GONE);
        binding.recentList.setVisibility(empty ? View.GONE : View.VISIBLE);
    }
}
