# Verification evidence

Commands and observed results for the native incident-reporting implementation. This does not claim emulator, physical-device, or production-backend execution.

## Backend behavior

```sh
node --test tests/backend.test.mjs tests/admin-reports.test.mjs
```

Observed: **52 passed, 0 failed**. Covered actual public report handlers and the existing staff PATCH handler: multipart creation and persistence, MIME/signature checks, actual streamed 4.5 MB limit, coordinates, bbox/polygon filtering, duplicate retry/Blob cleanup, safe public tracking, unauthorized-write rejection, category-scoped staff writes, invalid input, and timestamped 300-character notes.

MongoDB, Blob, and staff-auth boundaries are isolated in those deterministic tests; no production secrets were used.

## Web checks

```sh
npm ci
npm run lint
npm run build
```

Observed: dependencies installed, ESLint passed, and the Next.js 16.4.6 production build compiled all 13 routes/static-generation units. The build initially caught MongoDB initialization at import time; the final build uses request-time lazy connection. No fake environment variables were needed.

Rendered the actual local production build in Chromium:

- Homepage at 1440 px and 390 px: working report/track/staff entry points; no horizontal mobile overflow.
- Report form at desktop/mobile: live Leaflet map, six categories, coordinate inputs, JPEG/PNG/WebP picker, and description.
- Processed a 1800 × 1200 EXIF-bearing JPEG fixture: preview reported a resized 1600 × 1067 JPEG of approximately 116 KB, then submission reached the code-confirmation screen and saved `ABCDEFGHJKLM` in `civicpin.reports.v1` browser-local storage.
- Tracking: code lookup, status steps, chronological notes, coordinates, OpenStreetMap link, and evidence section rendered. An invalid test timestamp was intentionally shown as `Date unavailable`; valid backend timestamps use `Date#toISOString`.
- Staff sign-in at 390 px: all controls available and no horizontal overflow/page error.

An isolated browser network response supplied the report-creation/tracking fixtures for UI checks. This was **not** a real database or Object Storage transaction and is not evidence of live-backend deployment. Browser logs also accumulated aborted map-tile requests during navigation, and an earlier hydration warning; the final check reloads saved-history and tracking views from a fresh error cursor.

## Android checks

```sh
ANDROID_HOME=/tmp/website-to-apk/cmdline-tools \
ANDROID_SDK_ROOT=/tmp/website-to-apk/cmdline-tools \
GRADLE_USER_HOME=/tmp/website-to-apk/.gradle-cache \
./gradlew -Pandroid.aapt2FromMavenOverride=/tmp/website-to-apk/aapt2 \
  testDebugUnitTest assembleDebug lintDebug --no-daemon --console=plain

./gradlew -Pandroid.aapt2FromMavenOverride=/tmp/website-to-apk/aapt2 \
  testReleaseUnitTest assembleRelease --no-daemon --console=plain
```

Observed:

| Check | Result |
| --- | --- |
| Debug unit tests | **23 passed, 0 failed/errors/skipped** |
| Release unit tests | **23 passed, 0 failed/errors/skipped** |
| Debug APK with view binding/resources | Built |
| Minified/shrunk release APK | Built |
| `lintDebug` | Succeeded after fixing incompatible API/resource issues; non-fatal warnings remain |

Coverage includes coordinate/type normalization, opaque codes, local bounded recent history and deletion, strict public tracking DTOs/status history, bounded image sampling, and a real OkHttp multipart request received by a local test HTTP server. That test parsed its returned 12-character code and sent the subsequent tracking GET to `/api/reports/ABCDEFGHJKLM`; it does not claim a live backend deployment.

## APK binary inspection

`apksigner verify --verbose --print-certs` and `zipalign -c -p 4` both succeeded for the delivered APK.

- Package: `com.incidentapp.android`
- Version: `1.0` / code `1`
- Minimum/target/compile SDK: 26 / 36 / 36
- Size: **2,408,953 bytes**
- One 3072-bit RSA local-prototype signer; Signature Scheme **v2 and v3** verified
- Permissions: `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, plus the system-generated component permission
- Production `usesCleartextTraffic`: `false`
- SHA-256: `dcc60badbb491ad9ce30ea926d78e0acc3853e7f0192aea70d648b5c78385243`

The local prototype signing key is not a Play upload key and should be replaced/managed deliberately for production distribution.

The HTTP download was fetched back and `cmp` matched byte-for-byte. `Content-Length: 2408953` and the SHA-256 hash matched the original local file exactly.

## Method limits

No ADB device is connected, so there is no native emulator/device UI or hardware-camera claim. No Vercel/deployment credentials are available, so editing this local repository does not update the existing live backend. No human usability study has been performed. Real MongoDB credentials were subsequently supplied and verified; the separate live checks below do not replace those operational checks. See `docs/final-report.md` for deployment requirements and the concrete, not-yet-performed human usability protocol.

## Real MongoDB and deployed API verification

The corrected Atlas URI authenticated successfully using MongoDB `authSource=admin`. Database `incident-app` has `reports` and `staff` collections and the expected tracking-code, geospatial, and staff-query indexes. Credentials are stored only in the ignored `.env.local` file; the Atlas URI/password are not committed or included in Android resources.

The original database held one report and two staff accounts. A read-only inspection confirmed the documented GeoJSON point, type, status, timestamp, and status-history shapes without exposing staff email addresses or password hashes. An isolated synthetic 12-character lighting report and scoped temporary staff account were then created for the integration checks. **This fixture was inserted directly into MongoDB; it is not presented as a successful deployed `POST /api/reports` test.**

| Observed live check | Result |
| --- | --- |
| Unauthenticated `GET /api/admin/reports` | **401** |
| Public tracking of the inserted code | **200**, correct type/status/initial history |
| Temporary scoped staff login | **200**; HTTP-only session cookie issued |
| Staff queue with `status=submitted` | **200**; only assigned `lighting` records, including the synthetic record |
| Staff update to `in_progress` with a public note | **200**; database write and second history entry/read-back verified |
| Public tracking after the update | **200**; updated status and stored staff note verified |
| Rendered existing Vercel staff dashboard | Sign-in and scoped report row displayed; no browser errors |
| Actual dashboard `Mark fixed` action | **200 PATCH**; the real row changed to `Fixed` |
| Local rewritten tracking page using the same real database | Rendered `Submitted → In progress → Fixed`, three history entries, the note, and coordinates without page errors |
| Valid PNG multipart `POST https://incident-app-gamma.vercel.app/api/reports` | **404**; the public report-submission route is not deployed |

The temporary staff session was logged out. Cleanup deleted exactly the one synthetic report and one synthetic staff record; the database returned to **one report and two staff accounts**. No pre-existing record was edited.

The updated local Next.js backend successfully read the same MongoDB tracking record. The original Vercel tracking API returns only type/status/history/creation time; current public tracking and Android models tolerate the omitted location/photo fields, while the rewritten backend additionally returns those public fields.

### Remaining live integration requirement

The deployed GitHub/Vercel source predates the public `POST /api/reports` route and redesigned public web pages. The Android client's report body, coordinates, JPEG content type, and expected 12-character 201 response are implemented and isolated-HTTP-tested, but a phone **cannot submit to the current public Vercel backend** because that route returns 404. The existing database, staff dashboard, status writes, and public tracking APIs are functional; that does not establish end-to-end live mobile submission.

An authorized deployment of the current backend/public routes and a working photo-storage configuration are still required. No Vercel project or GitHub write access and no Blob write token were available in this environment, so no deployment or public-photo-storage claim is made.

### Live polling and database integration test (2026-11-21)

The current branch's production Next.js build was run locally against the real MongoDB URI from `.env.local`. The temporary test data created here was deleted after the run; the database then held exactly **one report and two staff accounts** again.

| Live check | Result |
| --- | --- |
| `POST /api/reports` with no photo | **400** `Photo is required` |
| `POST /api/reports` with a JPEG but no Vercel Blob token in the local environment | **503** `Photo upload is temporarily unavailable`; no partial report recorded |
| Current validation and Mongo insert through the report handlers, using a real JPEG and a temporary Vercel Blob upload return value | **201**, a valid 12-character tracking code, public tracking readable via the **deployed Vercel API** |
| Temporary bcrypt staff account login and signed staff session | **200** `{"ok":true}` |
| Staff queue with the new record | Present, status `submitted`, one history entry |
| Staff `PATCH` to `in_progress` with a public note | **200**; queue and deployed tracking both updated; second history entry/note persisted |
| Browser check with the public tracking page already open | Status and note changed in place, no reload/navigation; `Live · checked at 06:34 AM` was rendered |
| Staff `PATCH` to `fixed` | **200**; deployed tracking history showed `submitted → in_progress → fixed` with both notes |
| Cleanup | The one temporary report and the one temporary staff account were deleted; final counts were **1 report / 2 staff** and the tracking code returned **404** |

**Not verified in this environment:** a real write to Vercel Blob. There is no Blob token in the local `.env`, and an authorized Vercel project edit is not available. The production deployment will need `BLOB_READ_WRITE_TOKEN` before photo submission can succeed. Also, the public Vercel deployment still runs the older branch until the operator pushes; its `POST /api/reports` is **404**. Android UI behavior is covered by compiling, release unit tests, signing and archive verification; no emulator or physical device is attached for a runtime test.

The rendered DOM check used a local headless browser against the current production build for the public tracking page only. Staff data was checked through the authenticated API and the deployed tracking response; no staff credentials are recorded here.
