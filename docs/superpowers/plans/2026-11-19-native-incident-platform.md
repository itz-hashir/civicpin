# Native Incident Reporting Platform — Implementation Plan

> Implementation follows this shared contract. Each owner works only in its named files; integration and all builds/tests are owned by the parent session.

**Goal:** Ship a native Android client and light-themed web dashboard for anonymous, map-based incident reports with photo evidence, typed routing, private tracking, and staff status progress.

**Architecture:** Native Java Android Views app calls the existing Next.js API. The web provides a public reporting/tracking client plus authenticated staff views. MongoDB stores only incident data; Vercel Blob stores submitted photos. Android stores tracking codes locally, not identity information.

**Tech Stack:** Java 11, Android Views, AndroidX, Material Components, OSMDroid, OkHttp; Next.js/React; MongoDB; Vercel Blob.

## Shared contracts

### Create report
`POST /api/reports`, multipart form:
- `type`: one of `lighting|drainage|roads|waste|water|other`
- `description`: 0–1000 characters, optional
- `lat`: finite number, -90..90
- `lng`: finite number, -180..180
- `photo`: required JPEG/PNG/WebP image, max 4_500_000 bytes

201 success: `{ "code": "UPPERCASE_TRACKING_CODE" }`; errors: `{ "error": "specific message" }`.
No cookies, registration, names, email, device ID, IP storage, or other identity field is required or stored. `photoUrl` and `photoPathname` are stored for staff display/deletion. `trackingCode` is the only lookup secret. Use unique indexes and bounded duplicate retry. Preserve current MongoDB GeoJSON `{ type: "Point", coordinates: [lng, lat] }`, `statusHistory`, `createdAt`, `updatedAt`.

### Track report
`GET /api/reports/{code}`; existing response remains compatible and may add public fields: `{ type, status, statusHistory, createdAt, location, photoUrl }`. Never expose staff email or private identity fields. Invalid/unavailable code returns 404.

### Staff
Keep existing `GET /api/admin/reports?status={submitted|in_progress|fixed}` and authenticated `PATCH /api/admin/reports/{id}` with `{ status, note }`. Status history notes can be entered from the staff dashboard.

### Public base URL
`https://incident-app-chi.vercel.app`. Local builds may override this with a debug-only build field.

## Ownership / independent slices

1. **Backend:** create `app/api/reports/route.js` and focused backend validation/unit tests. Do not edit mobile, public pages, or global styles. Implement input/stream/file validation, photo Blob upload, photo metadata, duplicate-safe tracking codes, and documented errors. Preserve GET tracking compatibility.
2. **Web:** create public `/report` and `/track` pages; change root to a concise usable landing/report flow; restyle `app/globals.css`, login and `app/admin/Dashboard.js`. Reuse shared `MapPicker.js` and extend for geolocation/photo flows. Provide report tracking entry, saved code confirmation, staff status notes and assign office/type visibility. Light UI only. Do not edit API handlers or Android.
3. **Android:** create `android/` standalone Gradle Java app, package `com.incidentapp.android`. Native layouts and colors (warm white / dark forest / safety amber / brick red), readable type, clear content hierarchy and proper disabled/error/loading states. Three explicitly implemented user paths: map+photo+type+description submission, opaque-code tracking, local recent-report history. Use OSMDroid with marker tap, photo picker with camera capture if practical, HTTP multipart/JSON via OkHttp, caching last tracking codes only. FileProvider and runtime permissions handled. Correct network/error/JSON/lifecycle behavior. API base URL build variable uses shared base. Write deterministic local unit tests around model/status/tracking logic. Do not edit web files.

## Verification gates

- Backend: run focused route-handler tests using an isolated/fake DB and Blob boundary; test MIME/size/type/geo/description validation, success shape, private tracking, staff status note history.
- Web: install dependencies, lint and production build; inspect the actual public/staff UI at desktop/mobile using browser screenshots; test report and tracking workflows against a local test backend where accessible.
- Android: compile release APK with existing SDK 36, run local unit tests and lint as available. Inspect packaged manifest, certificate, URL, permissions and resources. No claim of on-device runtime without an actual device/emulator.
- Integration: prove Android request encoding against the backend contract in an isolated HTTP test; verify unauthenticated status APIs reject access and authorized staff workflows where credentials are available.
- Documentation: honest DB/data lifecycle/API/testing report. Do not invent human participants or user-study results. Include a ready-to-run short usability protocol and mark actual human evaluation not performed if nobody participates.
- Delivery: signed native release APK on a link fetched back and compared byte-for-byte.

## Global risks

- Do not expose secret Blob/MongoDB/staff credentials in the APK.
- Tracking codes are secrets; do not place high-entropy codes in analytics or logs.
- Photo EXIF is stripped by the Android client before upload; backend rejects oversized/unsupported media and never blindly trusts client MIME alone.
- 4.5 MB body limit accounts for managed serverless request-limits; client resizes large camera images.
- A public report must leave no edit/delete capability without staff authorization; tracking view is read-only.

## Next step

Parallel implementation of the backend, web and Android slices against the shared contracts, then parent-owned integration and verification.
