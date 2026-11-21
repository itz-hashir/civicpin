# Incident reporting prototype — final report

## Delivered scope

The project contains a native Java Android client and a Next.js public/staff web application sharing the same backend. This is not the previous WebView URL-wrapper experiment. Staff dashboard APIs, role-scoped report queries, signed sessions, status updates, and their existing MongoDB structures are retained.

### Anonymous report

1. Select an incident category.
2. Place a pin by tapping the map, dragging the marker, or requesting device location.
3. Provide a camera or gallery photo and an optional description.
4. Submit multipart data to `POST /api/reports`.
5. Receive and save an opaque tracking code. No staff session, user name, account, email, postal address, or device identifier is requested.

### Track an incident

`GET /api/reports/{code}` exposes only the category, public location, evidence URL, current status, creation timestamp, and public status-history notes. Public clients neither submit staff updates nor receive the report’s internal ObjectId. The Android recent-code list is local to the device. Server logs or analytics for the tracking-code route are outside this repository’s configuration and must not be populated with lookup codes.

### Staff

Staff authenticate through the existing bcrypt + signed-HTTP-cookie flow. Staff category assignments restrict both report list results and status updates. Status changes append `{ status, changedAt, note }` to history. The web dashboard remains the staff-facing management interface.

## Database and storage

See [`database-design.md`](database-design.md) for the complete schema, indexes, session model, and privacy boundaries. Required operational dependencies are MongoDB and Vercel Blob; credentials live only on the backend. Both parties use the same `/api/reports` API. No database or Blob secrets are packaged in the Android application.

## Threat and abuse boundaries

- Submitted file size is enforced from the actual stream, not only the multipart `File.size` declaration.
- Accepted media are JPEG, PNG, and WebP, with server-side signature and MIME checks.
- Bounding-box/polygon restrictions can limit coordinates to a municipality when configured.
- Tracking is a length-limited uppercase code, normalized without exposing internal error messages.
- Tracking codes are a read capability, not an authenticated identity. Treat them as sensitive; possession proves no real-world identity.
- Anonymous submission is intentionally unauthenticated. Production infrastructure should add rate limits/egress quotas to the endpoint and Blob account; this prototype does not claim complete abuse prevention or guaranteed DDoS protection.
- HTTPS is required for the deployed API. Local-only debugging can explicitly opt into cleartext emulator traffic without changing the production default.

## Verification limits

This report distinguishes automated checks from human and deployed-service evaluation. It does not fabricate participants, satisfaction scores, screenshots of an unrun Android app, or real-device compatibility.

At the time of implementation, no ADB device is connected and no Vercel project credentials, MongoDB credentials, Blob credentials, or deployment link are available in this environment. Consequently a local deterministic API test cannot establish that the existing live Vercel origin has been updated. The final verification section records only commands actually run. Android packaging, signature, and resources can be checked without installing it; that is distinct from an on-device usability test.

## Usability protocol — not a completed user study

Recruit actual municipal residents and staff after backend deployment. Obtain consent and use deliberately non-sensitive demonstration incidents. Do not submit real emergency information.

### Participant tasks

1. **Resident, unassisted report:** From an Android device, report a demonstration broken streetlamp. Give no category, map or photo instructions after starting the timer.
2. **Resident, manual correction:** Turn off location permission, place the marker manually, and correct an incorrect category if needed.
3. **Resident, preserve the code:** Confirm where the code is visible and explain how they would recover it after leaving the submission screen.
4. **Resident, tracking:** Use the saved code to read the latest status without staff login.
5. **Staff:** Sign in, filter to the assigned category, set the demonstration report to `in_progress` with a public-facing note, then `fixed`.
6. **Resident:** Refresh tracking and identify the staff status and note.

### Record per task

Time, success/failure, wrong taps, requests for help, device/OS/browser, network conditions, and verbatim confusion. Do not record names or private incident details in the study dataset. Success means the correct report or update exists in the backend, not merely a visible toast.

### Exit questions

- Were any fields unclear or unnecessary?
- Did you understand that only the tracking code is needed for lookup?
- Did you expect the report to be editable or deletable?
- Was the photo/pin interface reliable on your network and device?
- What would prevent you from submitting a real municipal problem?

Actual human testing has not been performed in this environment.

## Deployment required for real public use

Supply secrets through `.env` in the backend deployment environment, execute the existing index setup against the target database, and deploy this Next.js source. The Android `API_BASE_URL` must point at the deployed HTTPS origin. This environment cannot perform that live update without the project’s deployment authorization.
