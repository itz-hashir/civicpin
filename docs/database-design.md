# Database design

MongoDB stores two independent identities: a public tracking code and a staff account. Nothing in the public report schema contains a reporter name, account, email, or device identifier.

## `reports`

| Field | Type / constraint | Purpose |
| `_id` | MongoDB ObjectId | Internal staff-dashboard update key; never used for public tracking |
| `trackingCode` | 12 characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, unique | Anonymous lookup |
| `photoUrl` | Public Vercel Blob URL | Staff dashboard and optional public tracking display |
| `photoPathname` | Vercel Blob storage object key | Upload cleanup and opted-in resolution deletion |
| `type` | `lighting`, `drainage`, `roads`, `waste`, `water`, `other` | Staff routing |
| `description` | String, 0–1000 UTF-16 characters | Optional citizen-provided description |
| `location` | GeoJSON `Point`; `[longitude, latitude]` | Exact staff location and municipal-area filter |
| `publicLocation` | GeoJSON `Point` or `null` | Approximate or exact coordinates exposed through public tracking |
| `locationVisibility` | `approximate`, `exact`, `staff` | Reporter-selected public location precision |
| `photoVisibility` | `staff`, `tracking` | Reporter-selected photo visibility |
| `deleteEvidenceOnResolution` | Boolean | Whether fixing the report deletes its photo and coordinates |
| `evidenceRemovedAt` | UTC Date, present after deletion | Records that resolution cleanup occurred |
| `status` | `submitted`, `in_progress`, `fixed` | Public progress state |
| `statusHistory` | `{ status, changedAt, note }[]` | Immutable status timeline; starts at submission |
| `createdAt` | UTC Date | Submission time |
| `updatedAt` | UTC Date | Last staff update |

`updatedAt` and the internal ObjectId are not returned by the public tracking API. Staff role constraints are applied both to report queries and to the status-update filter. A status history entry records what staff entered; anonymous submissions without a session cannot use the staff update route.

### Indexes

```js
await db.collection('reports').createIndexes([
  { key: { trackingCode: 1 }, unique: true, name: 'trackingCode_unique' },
  { key: { location: '2dsphere' }, name: 'location_2dsphere' },
  { key: { type: 1, status: 1, createdAt: -1 }, name: 'reports_by_type_status_date' },
]);
```

Insertion retries a random-code collision. A failure to insert does not silently return the tracking code of another report. Vercel Blob storage is deliberately separate: a database rollback/deletion does not implicitly delete a blob.

## `staff`

| Field | Purpose |
| --- | --- |
| `_id` | Internal staff identifier |
| `email` | Login identity; normalized to lower-case and trimmed by the login route |
| `passwordHash` | bcrypt password hash; no plaintext passwords stored |
| `types` | Allowed report categories or `["all"]` |
| `name` | Optional dashboard label |

Sessions are signed, eight-hour JWTs stored in a `HttpOnly; SameSite=Lax` cookie. They are reserved for staff login. Public Android endpoints do not accept or require staff-session cookies.

## Privacy model

The anonymous channel deliberately allows no user signup. The random twelve-character code is the public capability to look up a report. New reports default to coordinates rounded to two decimal places for public tracking and staff-only photos; staff retain the exact coordinates and evidence needed to respond. Reporters may instead choose exact public coordinates, no public location, or a public tracking photo. Legacy reports without privacy fields retain their original exact-location/public-photo behavior.

When a reporter opts into resolution deletion, the staff transition to `fixed` deletes the Blob object and removes its URL, object key, exact coordinates, and public coordinates. Status and status history remain. A failed Blob deletion prevents the status transition so it can be retried. Both clients sanitize photos before upload where their platform supports re-encoding, and the server validates content signatures rather than trusting the submitted filename or MIME type alone.

## Setup

1. Copy `.env.example` to `.env.local` and supply actual deployment secrets.
2. Create staff with `npm run create-staff`.
3. Run `npm run setup-indexes` in every new database environment.
4. Deploy the Next.js backend before pointing the Android client at its HTTPS origin.

The upload store and database are operational dependencies. Missing credentials are surfaced to the UI as a submission failure, not a fake success code.
