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

On ordinary AMD64 hosts, no AAPT2 override is needed. For an ARM64 host whose official AAPT2 binary is unavailable, pass it only for that build:

```sh
./gradlew -Pandroid.aapt2FromMavenOverride=/absolute/path/to/aapt2 testDebugUnitTest assembleDebug
```

Never commit a host-specific AAPT2 path or `local.properties`.

The normal API origin is `https://incident-app-gamma.vercel.app`, baked into the build. For local debugging only, pass `-PcivicpinApiBaseUrl=http://YOUR_HOST:3000` and configure the appropriate debug-only cleartext network policy. Localhost is `10.0.2.2` inside the stock Android emulator. The delivered release remains HTTPS-only by default.

The release needs your signing key. `assembleRelease` produces an unsigned APK. Align it with `zipalign -p 4`, then sign with `apksigner`. The delivered APK here is signed with a one-off local prototype key, not a Google Play/upload signing key. Preserve your own future signing key consistently for application updates.

**Deployment and secrets:** deploy this commit to the existing Vercel project at the configured HTTPS origin. Set `MONGODB_URI`, `AUTH_SECRET`, and `BLOB_READ_WRITE_TOKEN` as encrypted Vercel environment variables accessible only to the project owner. MongoDB must also authorize the Vercel deployment's outbound network. GitHub Actions secrets are CI-only and do not automatically configure Vercel. Never commit `.env.local` or put credentials in the Android APK; the app contains only the public HTTPS API origin.

## Verification and operational details

- [Verification evidence](docs/verification.md)
- [Database design](docs/database-design.md)
- [Implementation, deployment, privacy, and real-user testing protocol](docs/final-report.md)
- [Implementation plan](docs/superpowers/plans/2026-11-19-native-incident-platform.md)

No human usability study or physical-device Android run is claimed by the automated reports.
