package com.incidentapp.android;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.incidentapp.android.databinding.ItemRecentReportBinding;

import java.util.ArrayList;
import java.util.List;

final class RecentReportsAdapter extends RecyclerView.Adapter<RecentReportsAdapter.Holder> {
    interface Listener {
        void onTrack(String code);
        void onDelete(String code);
    }

    private final Listener listener;
    private final List<RecentReports.Entry> entries = new ArrayList<>();

    RecentReportsAdapter(Listener listener) {
        this.listener = listener;
        setHasStableIds(true);
    }

    void setEntries(List<RecentReports.Entry> updated) {
        entries.clear();
        entries.addAll(updated);
        notifyDataSetChanged();
    }

    @Override public long getItemId(int position) {
        return entries.get(position).code.hashCode();
    }

    @NonNull @Override public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemRecentReportBinding binding = ItemRecentReportBinding.inflate(
                LayoutInflater.from(parent.getContext()), parent, false);
        return new Holder(binding);
    }

    @Override public void onBindViewHolder(@NonNull Holder holder, int position) {
        RecentReports.Entry entry = entries.get(position);
        holder.binding.recentCode.setText(entry.code);
        String details = IncidentTypes.displayName(entry.type) + " · " + DateLabels.formatRecentDate(entry.createdAt);
        holder.binding.recentDetails.setText(details);
        holder.binding.deleteRecentButton.setContentDescription(
                holder.binding.getRoot().getContext().getString(R.string.delete_code, entry.code));
        holder.binding.getRoot().setOnClickListener(view -> listener.onTrack(entry.code));
        holder.binding.deleteRecentButton.setOnClickListener(view -> listener.onDelete(entry.code));
    }

    @Override public int getItemCount() {
        return entries.size();
    }

    static final class Holder extends RecyclerView.ViewHolder {
        final ItemRecentReportBinding binding;
        Holder(ItemRecentReportBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }
    }
}
