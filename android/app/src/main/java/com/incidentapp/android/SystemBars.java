package com.incidentapp.android;

import android.app.Activity;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

final class SystemBars {
    private SystemBars() {}

    static void applyHome(Activity activity, View content) {
        configure(activity, content, true);
        applyPadding(content, true, true);
    }

    static void applyChildScreen(Activity activity, View toolbar, View content) {
        configure(activity, toolbar, false);
        applyPadding(toolbar, true, false);
        applyPadding(content, false, true);
    }

    private static void configure(Activity activity, View anchor, boolean lightStatusIcons) {
        WindowCompat.setDecorFitsSystemWindows(activity.getWindow(), false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(activity.getWindow(), anchor);
        controller.setAppearanceLightStatusBars(lightStatusIcons);
        controller.setAppearanceLightNavigationBars(true);
    }

    private static void applyPadding(View view, boolean includeTop, boolean includeBottom) {
        final int left = view.getPaddingLeft();
        final int top = view.getPaddingTop();
        final int right = view.getPaddingRight();
        final int bottom = view.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(view, (target, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            target.setPadding(left + bars.left, top + (includeTop ? bars.top : 0),
                    right + bars.right, bottom + (includeBottom ? bars.bottom : 0));
            return windowInsets;
        });
        view.requestApplyInsets();
    }
}
