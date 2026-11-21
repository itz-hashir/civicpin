# Civicpin

Anonymous municipal incident reporting with a native Java Android client, public web reporting/tracking, and an authenticated staff dashboard.

## Web setup

```sh
npm ci
cp .env.example .env.local
# Set real MONGODB_URI, AUTH_SECRET, and BLOB_READ_WRITE_TOKEN values.
node --env-file=.env.local scripts/create-staff.mjs email@example.org password all
node --env-file=.env.local scripts/setup-indexes.mjs
```

The setup scripts and their exact arguments are documented in `scripts/`. Staff authentication uses signed HTTP-only session cookies. Public report and tracking requests need no account and must never be pointed at a private staff API.

- `/report` submits category, coordinates, optional description, and one JPEG/PNG/WebP photo (maximum 4.5 MB).
- `/track` retrieves the current status and public history using a 12-character private tracking code.
- `/admin` is the staff-only type-scoped queue, filtered list, status updates, and public status notes.

MongoDB lazily connects on the first real API request. A missing database configuration therefore does not prevent a production build; it produces a request-time service error.

## Native Android

`android/` is a standalone Gradle Java application, not a WebView shell. It uses OSMDroid for map input, native Photo Picker/camera capture, metadata-free JPEG processing, and OkHttp for the same API.

Requirements: JDK 17, Android SDK 36, minimum supported Android SDK 26 (Android 8).

```sh
cd android
./gradlew testDebugUnitTest assembleDebug lintDebug
./gradlew testReleaseUnitTest assembleRelease
```

The ARM64 development environment used for this build overrides AAPT2 with `android.aapt2FromMavenOverride=/tmp/website-to-apk/aapt2` in `gradle.properties`. On an ordinary AMD64 host, remove that machine-specific override and use normal SDK-installed AAPT2.

The normal API origin is `https://incident-app-gamma.vercel.app`, baked into the build. For local debugging only, pass `-PcivicpinApiBaseUrl=http://YOUR_HOST:3000` and configure the appropriate debug-only cleartext network policy. Localhost is `10.0.2.2` inside the stock Android emulator. The delivered release remains HTTPS-only by default.

The release needs your signing key. `assembleRelease` produces an unsigned APK. Align it with `zipalign -p 4`, then sign with `apksigner`. The delivered APK here is signed with a one-off local prototype key, not a Google Play/upload signing key. Preserve your own future signing key consistently for application updates.

**Deployment requirement:** the Vercel/MongoDB/Blob project credentials were not available to this build environment. Before public use, deploy this backend to the configured HTTPS origin; the existing old deployment is not modified by a local build.

## Verification and operational details

- [Verification evidence](docs/verification.md)
- [Database design](docs/database-design.md)
- [Implementation, deployment, privacy, and real-user testing protocol](docs/final-report.md)
- [Implementation plan](docs/superpowers/plans/2026-11-19-native-incident-platform.md)

No human usability study or physical-device Android run is claimed by the automated reports.
