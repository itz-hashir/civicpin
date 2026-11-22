# Reporter Privacy Controls Implementation Plan

> **For agentic workers:** Implement task-by-task with focused behavior tests and browser verification.

**Goal:** Give reporters meaningful control over third-party map requests, public evidence, evidence retention, and local tracking-code storage.

**Architecture:** Keep staff-only data in the existing report document while serializing an explicit public tracking view. The browser loads the Leaflet module only after consent and writes localStorage only after an opt-in. Resolution deletes opted-in evidence through the existing staff API before removing its references.

**Tech Stack:** Next.js 16, React 19, Node test runner, MongoDB, Vercel Blob, Leaflet.

**Spec:** User request: "make sure there are more privacy options available".

## Global Constraints

- New reports default to approximate public location, staff-only photo, no automatic evidence deletion, and no local tracking-code storage.
- Staff always receive the exact submitted coordinates and photo until requested resolution deletion.
- Existing reports retain their legacy exact-location and public-photo tracking behavior.
- Public tracking must never receive staff-only fields and then rely on the client to hide them.

## Review Focus

- Invalid privacy form values must be rejected before upload or storage.
- Public approximate coordinates must differ from exact staff coordinates.
- Blob deletion failure must leave the report unfixed so deletion can be retried.
- Re-opening the report form must not load OpenStreetMap without another explicit action.
- Saved-code removal must update both localStorage and the rendered list.

### Task 1: Enforce evidence visibility and retention in the backend

**Files:** `lib/reportValidation.js`, `lib/reports.js`, `app/api/admin/reports/[id]/route.js`, `tests/backend.test.mjs`, `tests/admin-reports.test.mjs`.

- Accept `locationVisibility=approximate|exact|staff`, `photoVisibility=staff|tracking`, and `deleteEvidenceOnResolution=true`; default to `approximate`, `staff`, and `false`.
- Store exact staff coordinates, a separate rounded public location where allowed, and the privacy choices.
- Serialize public tracking from those choices; preserve legacy behavior when the fields are absent.
- On a requested transition to fixed, delete the blob, remove exact/public coordinates and blob references, and record `evidenceRemovedAt`; fail the update if deletion fails.
- Run `node --test tests/backend.test.mjs tests/admin-reports.test.mjs`.

### Task 2: Add reporter and staff privacy controls

**Files:** `components/ReportForm.js`, `app/report/page.js`, `app/admin/Dashboard.js`, `app/globals.css`.

- Replace automatic map mounting with an explicit Load interactive map action and a third-party request explanation.
- Add labeled location visibility, photo visibility, and resolution-deletion controls using the Task 1 form contract.
- Show staff the selected visibility and whether evidence was removed.
- Verify the actual form and staff states in Chromium.

### Task 3: Make tracking-code storage opt-in and reversible

**Files:** `components/trackingStorage.js`, `components/ReportForm.js`, `components/TrackReport.js`, `app/globals.css`.

- Default the Save on this device checkbox to off and pass the choice to `saveReportLocally`.
- Add removal of individual saved codes and a Clear saved codes action.
- Verify storage remains absent by default, appears after opt-in, and disappears after removal.

### Task 4: Verify the integrated privacy behavior

- Run the focused backend suites, existing frontend checks, lint, and production build.
- Exercise map consent, all privacy defaults, submission payload, tracking-code opt-in, and saved-code removal in Chromium.
- Check desktop and mobile layouts and browser console errors.
