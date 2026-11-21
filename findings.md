# Findings

- Existing Next.js repo already contains staff login, type-scoped report list, guarded status patches with history notes, GeoJSON querying and tracking GET route.
- Existing MongoDB indexes: unique trackingCode, geospatial location and compound type/status/createdAt.
- Public report POST route is missing; tracking route is read-only and does not return staff identity.
- Current UI is a raw staff table/login, no public reporting interface and dark-mode global colors contradict requested light UI.
- Report types and statuses must remain `lighting|drainage|roads|waste|water|other` and `submitted|in_progress|fixed`.
- Android SDK 36 and modern AAPT2 with binfmt are available at `/tmp/website-to-apk/android-build` equivalents; use `/tmp/website-to-apk/android-build` only if present, otherwise paths from existing build properties. Native Android build can share dependencies via Gradle home override but cannot reuse the old WebView app Java logic.
- No ADB device is attached. No evidence of human usability participants will be manufactured.
