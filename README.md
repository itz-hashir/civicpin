# Civicpin

**Report a local problem. Follow the response. No account required.**

Civicpin is a civic incident-reporting platform for residents and response teams. A resident can send a photo, choose a location on the map, and receive a private tracking link. Staff can review the same report, update its status, and leave public notes from one shared queue.

The project includes a Next.js website and a **native Android app**—not a WebView wrapper. Both use the same API and MongoDB data, so an update made by staff appears on the website and in the app without a separate sync step.

**[Open Civicpin](https://incident-app-chi.vercel.app)** · **[Download the Android app](https://github.com/itz-hashir/civicpin/releases/latest/download/Incident-App-v1.1.apk)** · **[Latest release](https://github.com/itz-hashir/civicpin/releases/latest)**

## Why Civicpin?

Public reporting should be simple for residents and manageable for the people responding to reports.

| For residents | For staff |
| --- | --- |
| Report without creating an account | Sign in to a protected dashboard |
| Add a photo, category, map location, and description | See reports assigned to their incident types |
| Keep a private 12-character tracking code | Move reports from submitted to in progress to fixed |
| Follow public status notes as work happens | Add notes that explain what changed |

## The Android app

The Android client provides native report submission, photo picking or camera capture, an OSMDroid map picker, public tracking, and automatic status refresh. Image metadata is removed before upload.

- **Current version:** 1.1 (`versionCode 2`)
- **Requires:** Android 8.0 (API 26) or newer
- **Package:** `com.incidentapp.android`
- **Download:** [Incident-App-v1.1.apk](https://github.com/itz-hashir/civicpin/releases/latest/download/Incident-App-v1.1.apk)

The APK is signed and zip-aligned, but it is distributed through GitHub rather than Google Play. To install it, download the APK and allow **Install unknown apps** for the browser or file manager you use. Android 1.1 uses the same signing certificate as the earlier prototype, so it can update that installation.

The release APK talks only to the HTTPS production API. For a local backend, build a debug APK with:

```sh
cd android
./gradlew -PcivicpinApiBaseUrl=http://YOUR_HOST:3000 assembleDebug
```

Use `10.0.2.2` instead of `localhost` when the backend runs on the host of the stock Android emulator.

## Run the website locally

### Requirements

- Node.js 22 or newer
- A MongoDB database
- A Vercel Blob store for photo uploads

### Setup

```sh
git clone https://github.com/itz-hashir/civicpin.git
cd civicpin
npm ci
cp .env.example .env.local
```

Fill in these values in `.env.local`:

```dotenv
MONGODB_URI=mongodb+srv://...
AUTH_SECRET=a-long-random-secret
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
APP_ORIGIN=http://localhost:3000
```

Create the database indexes and your first staff account:

```sh
node --env-file=.env.local scripts/setup-indexes.mjs
node --env-file=.env.local scripts/create-staff.mjs email@example.org your-password all
npm run dev
```

Open **http://localhost:3000**. Public reporting is at `/report`, tracking is at `/track`, and staff sign in at `/login`.

You can generate a suitable session secret with `openssl rand -hex 32`. Never commit `.env.local`, staff credentials, database credentials, Blob tokens, or Android signing keys.

## Build and check the project

Website:

```sh
npm run lint
npm run build
```

Android (JDK 17 and Android SDK 36 required):

```sh
cd android
./gradlew testReleaseUnitTest lintRelease assembleRelease
```

`assembleRelease` creates an unsigned APK. For distribution, align and sign it with your private release key:

```sh
zipalign -p 4 app/build/outputs/apk/release/app-release-unsigned.apk Incident-App.apk
apksigner sign --ks /path/to/private-release-key.jks Incident-App.apk
apksigner verify --verbose Incident-App.apk
```

On ARM64 build hosts without an official AAPT2 binary, pass `-Pandroid.aapt2FromMavenOverride=/absolute/path/to/aapt2` for that build. Do not commit host-specific paths or `android/local.properties`.

## Deploy your own instance

1. Import the repository into Vercel and select the **Next.js** framework preset.
2. Add `MONGODB_URI`, `AUTH_SECRET`, and `BLOB_READ_WRITE_TOKEN` to the Production environment.
3. Make sure MongoDB accepts connections from the deployment.
4. Deploy, then change `APP_ORIGIN`, `app/layout.js`, and `android/app/build.gradle` to your public HTTPS origin before building your own APK.

The production deployment at [incident-app-chi.vercel.app](https://incident-app-chi.vercel.app) has been checked with a real photo upload, report creation, staff status changes, Blob storage, and automatic public tracking refresh. See [the verification record](docs/verification.md) for details.

## Project layout

```text
app/                 Next.js pages and API routes
components/          Shared web interface components
lib/                 Authentication, database, and report helpers
scripts/             Index setup and staff-account utilities
android/             Standalone native Java Android application
docs/                Architecture, privacy, database, and verification notes
```

## Privacy and data

- Residents do not need an account.
- A tracking code is required to read a public report.
- Interactive OpenStreetMap tiles load only after the reporter chooses to load the map; coordinates can always be entered manually.
- New reports default to an approximate public location and staff-only photo. Reporters can choose exact or staff-only location and can include the photo on the tracking page.
- Reporters can opt into photo and location deletion when staff mark the report fixed. Status history remains available.
- Browser tracking-code storage is opt-in, and saved codes can be removed individually or all at once from the tracking page.
- Staff passwords are bcrypt-hashed; staff sessions use signed HTTP-only cookies.
- Report photos are stored in Vercel Blob and stripped of image metadata by the web and Android clients before upload.
- Staff status notes are public. Do not place private case information in those notes.
- An optional municipal boundary can restrict accepted coordinates; see `.env.example`.

## Documentation

- [Verification evidence](docs/verification.md)
- [Database design](docs/database-design.md)
- [Implementation, deployment, and privacy notes](docs/final-report.md)
- [Native platform implementation plan](docs/superpowers/plans/2026-11-19-native-incident-platform.md)

The documented checks include production builds, Android release unit tests, APK signature/package inspection, and a live production workflow. A physical-device UI test and a human usability study have not been performed; those limitations are stated rather than presented as completed testing.

## Contributing

Issues and pull requests are welcome. Please keep secrets and real reporter data out of issues, commits, screenshots, and test fixtures. For behavior changes, include the narrowest check that exercises the affected path.
