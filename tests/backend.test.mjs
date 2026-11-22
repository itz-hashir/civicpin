import assert from "node:assert/strict";
import { File } from "node:buffer";
import test from "node:test";
import { createReportsHandlers } from "../lib/reports.js";
import { MAX_PHOTO_BYTES } from "../lib/reportValidation.js";

const NOW = new Date("2026-11-19T12:00:00.000Z");
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

function photo(bytes = JPEG, type = "image/jpeg") {
  return new File([bytes], "evidence", { type });
}

function reportRequest({
  type = "roads",
  description = "Broken curb",
  lat = "40.7128",
  lng = "-74.006",
  image = photo(),
  includePhoto = true,
  locationVisibility = null,
  photoVisibility = null,
  deleteEvidenceOnResolution = null,
} = {}) {
  const form = new FormData();
  if (type !== null) form.set("type", type);
  if (description !== null) form.set("description", description);
  if (lat !== null) form.set("lat", lat);
  if (lng !== null) form.set("lng", lng);
  if (includePhoto) form.set("photo", image);
  if (locationVisibility !== null) form.set("locationVisibility", locationVisibility);
  if (photoVisibility !== null) form.set("photoVisibility", photoVisibility);
  if (deleteEvidenceOnResolution !== null) form.set("deleteEvidenceOnResolution", deleteEvidenceOnResolution);
  return new Request("http://localhost/api/reports", { method: "POST", body: form });
}

function fakeDatabase(initialReports = []) {
  const records = new Map(initialReports.map((report) => [report.trackingCode, report]));
  return {
    records,
    inserts: [],
    collection(name) {
      assert.equal(name, "reports");
      return {
        async insertOne(report) {
          this.inserts?.push(report);
          if (records.has(report.trackingCode)) {
            const error = new Error("duplicate key");
            error.code = 11000;
            throw error;
          }
          records.set(report.trackingCode, report);
          return { acknowledged: true };
        },
        async findOne(query, { projection }) {
          assert.deepEqual(Object.keys(query), ["trackingCode"]);
          const report = records.get(query.trackingCode);
          if (!report) return null;
          const projected = {};
          for (const [field, include] of Object.entries(projection)) {
            if (field !== "_id" && include && Object.hasOwn(report, field)) {
              projected[field] = report[field];
            }
          }
          return projected;
        },
      };
    },
  };
}

function harness({ codes = ["ABCDEFGHJKLM"], initialReports = [], environment = {} } = {}) {
  const codeQueue = [...codes];
  const db = fakeDatabase(initialReports);
  const uploads = [];
  const deletions = [];
  const handlers = createReportsHandlers({
    db,
    generateCode() {
      assert.ok(codeQueue.length > 0, "code generation exceeded the expected attempts");
      return codeQueue.shift();
    },
    now: () => new Date(NOW),
    async upload(pathname, body, options) {
      uploads.push({ pathname, body, options });
      return {
        url: `https://blob.test/${pathname}`,
        pathname,
      };
    },
    async deleteUpload(url) {
      deletions.push(url);
    },
    environment,
  });
  return { ...handlers, db, uploads, deletions };
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test("POST stores a complete anonymous report and returns only its uppercase code", async () => {
  const app = harness();
  const rawResponse = await app.POST(reportRequest());
  const response = await json(rawResponse);

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { code: "ABCDEFGHJKLM" });
  assert.equal(app.uploads.length, 1);
  assert.equal(app.uploads[0].pathname, "reports/ABCDEFGHJKLM.jpg");
  assert.deepEqual(app.uploads[0].body, Buffer.from(JPEG));
  assert.deepEqual(app.uploads[0].options, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "image/jpeg",
  });

  const stored = app.db.records.get("ABCDEFGHJKLM");
  assert.deepEqual(stored, {
    trackingCode: "ABCDEFGHJKLM",
    type: "roads",
    description: "Broken curb",
    location: { type: "Point", coordinates: [-74.006, 40.7128] },
    publicLocation: { type: "Point", coordinates: [-74.01, 40.71] },
    locationVisibility: "approximate",
    photoVisibility: "staff",
    deleteEvidenceOnResolution: false,
    photoUrl: "https://blob.test/reports/ABCDEFGHJKLM.jpg",
    photoPathname: "reports/ABCDEFGHJKLM.jpg",
    status: "submitted",
    statusHistory: [{ status: "submitted", changedAt: NOW, note: "" }],
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal(rawResponse.headers.get("set-cookie"), null);
  assert.equal(app.deletions.length, 0);
});

test("POST accepts all supported image signatures and an omitted description", async (t) => {
  const cases = [
    [JPEG, "image/jpeg", "jpg"],
    [PNG, "image/png", "png"],
    [WEBP, "image/webp", "webp"],
  ];
  for (const [bytes, type, extension] of cases) {
    await t.test(type, async () => {
      const app = harness();
      const response = await app.POST(reportRequest({ image: photo(bytes, type), description: null }));
      assert.equal(response.status, 201);
      const stored = app.db.records.get("ABCDEFGHJKLM");
      assert.equal(stored.description, "");
      assert.equal(stored.photoPathname, `reports/ABCDEFGHJKLM.${extension}`);
    });
  }
});

test("POST rejects invalid report shapes before storage", async (t) => {
  const cases = [
    [{ type: null }, /Invalid report type/],
    [{ type: "fire" }, /Invalid report type/],
    [{ includePhoto: false }, /Photo is required/],
    [{ lat: null }, /Latitude is required/],
    [{ lng: "" }, /Longitude is required/],
    [{ description: "x".repeat(1001) }, /1000 characters/],
    [{ locationVisibility: "private" }, /Invalid location visibility/],
    [{ photoVisibility: "public" }, /Invalid photo visibility/],
    [{ deleteEvidenceOnResolution: "false" }, /Invalid evidence deletion preference/],
  ];
  for (const [change, message] of cases) {
    await t.test(String(message), async () => {
      const app = harness();
      const response = await json(await app.POST(reportRequest(change)));
      assert.equal(response.status, 400);
      assert.match(response.body.error, message);
      assert.equal(app.uploads.length, 0);
      assert.equal(app.db.records.size, 0);
    });
  }

  await t.test("non-multipart request", async () => {
    const app = harness();
    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const response = await json(await app.POST(request));
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "Invalid multipart form data");
  });
});

test("POST rejects invalid, non-finite, and out-of-range coordinates", async (t) => {
  const cases = [
    ["not-a-number", "0"],
    ["Infinity", "0"],
    ["90.00001", "0"],
    ["-91", "0"],
    ["0", "180.00001"],
    ["0", "-181"],
  ];
  for (const [lat, lng] of cases) {
    await t.test(`${lat}, ${lng}`, async () => {
      const app = harness();
      const response = await app.POST(reportRequest({ lat, lng }));
      assert.equal(response.status, 400);
      assert.equal(app.uploads.length, 0);
    });
  }
});

test("POST allows any valid coordinates when municipal restrictions are disabled", async () => {
  const app = harness({ environment: {} });
  const response = await app.POST(reportRequest({ lat: "89", lng: "179" }));
  assert.equal(response.status, 201);
  assert.deepEqual(app.db.records.get("ABCDEFGHJKLM").location.coordinates, [179, 89]);
});

test("POST rejects coordinates outside MUNICIPAL_BBOX", async () => {
  const app = harness({ environment: { MUNICIPAL_BBOX: "0,0,1,1" } });
  const response = await json(await app.POST(reportRequest()));
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: "Location is outside the reporting area" });
  assert.equal(app.uploads.length, 0);
});

test("POST applies polygon edge crossings for MUNICIPAL_GEOJSON", async (t) => {
  const environment = {
    MUNICIPAL_GEOJSON: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [-75, 40], [-73, 40], [-73, 41], [-74, 41], [-74, 42], [-75, 42], [-75, 40],
      ]],
    }),
  };

  await t.test("accepts a point inside the first ring", async () => {
    const app = harness({ environment });
    const response = await app.POST(reportRequest());
    assert.equal(response.status, 201);
  });

  await t.test("rejects a point inside the ring bounds but outside its edges", async () => {
    const app = harness({ environment });
    const response = await json(await app.POST(reportRequest({ lat: "41.5", lng: "-73.5" })));
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "Location is outside the reporting area");
    assert.equal(app.uploads.length, 0);
  });
});

test("POST rejects invalid municipal settings without exposing their contents", async (t) => {
  const settings = [
    { MUNICIPAL_BBOX: "0,0,Infinity,1" },
    { MUNICIPAL_GEOJSON: JSON.stringify({
      type: "Polygon",
      coordinates: [[[0, 0], [181, 0], [181, 1], [0, 0]]],
    }) },
  ];
  for (const environment of settings) {
    await t.test(Object.keys(environment)[0], async () => {
      const app = harness({ environment });
      const response = await json(await app.POST(reportRequest()));
      assert.equal(response.status, 503);
      assert.deepEqual(response.body, { error: "Report service is temporarily unavailable" });
      assert.equal(app.uploads.length, 0);
    });
  }
});

test("POST rejects unsupported MIME, forged signatures, and empty photos", async (t) => {
  const cases = [
    [photo(JPEG, "application/octet-stream"), /JPEG, PNG, or WebP/],
    [photo(PNG, "image/jpeg"), /contents do not match/],
    [photo(JPEG, "image/webp"), /contents do not match/],
    [photo(Uint8Array.of(), "image/png"), /must not be empty/],
  ];
  for (const [image, message] of cases) {
    await t.test(`${image.type}: ${message}`, async () => {
      const app = harness();
      const response = await json(await app.POST(reportRequest({ image })));
      assert.equal(response.status, 400);
      assert.match(response.body.error, message);
      assert.equal(app.uploads.length, 0);
    });
  }
});

test("POST rejects a photo over 4.5 MB without uploading it", async () => {
  const oversized = Uint8Array.from(JPEG);
  const bytes = new Uint8Array(MAX_PHOTO_BYTES + 1);
  bytes.set(oversized);
  const app = harness();
  const response = await json(await app.POST(reportRequest({ image: photo(bytes) })));
  assert.equal(response.status, 413);
  assert.equal(response.body.error, "Photo must be 4.5 MB or smaller");
  assert.equal(app.uploads.length, 0);
  assert.equal(app.db.records.size, 0);
});

test("POST enforces actual streamed size even when the supplied size is smaller", async () => {
  const app = harness();
  const form = {
    get(name) {
      const fields = { type: "roads", description: "", lat: "1", lng: "2" };
      if (name !== "photo") return fields[name] ?? null;
      return {
        type: "image/jpeg",
        size: JPEG.length,
        async *stream() {
          yield JPEG;
          yield new Uint8Array(MAX_PHOTO_BYTES);
        },
      };
    },
  };
  const response = await json(await app.POST({ formData: async () => form }));
  assert.equal(response.status, 413);
  assert.equal(app.uploads.length, 0);
});

test("POST retries a duplicate tracking code and removes its orphaned upload", async () => {
  const existing = { trackingCode: "DUPLICATECODE", type: "waste" };
  const app = harness({ codes: ["DUPLICATECODE", "FRESHCODE123"], initialReports: [existing] });
  const response = await json(await app.POST(reportRequest()));

  assert.equal(response.status, 201);
  assert.equal(response.body.code, "FRESHCODE123");
  assert.equal(app.uploads.length, 2);
  assert.deepEqual(app.deletions, ["https://blob.test/reports/DUPLICATECODE.jpg"]);
  assert.equal(app.db.records.get("DUPLICATECODE"), existing);
  assert.equal(app.db.records.get("FRESHCODE123").status, "submitted");
});

test("POST bounds repeated duplicate code conflicts", async () => {
  const app = harness({
    codes: Array(5).fill("DUPLICATECODE"),
    initialReports: [{ trackingCode: "DUPLICATECODE" }],
  });
  const response = await json(await app.POST(reportRequest()));
  assert.equal(response.status, 503);
  assert.equal(response.body.error, "Report service is temporarily unavailable");
  assert.equal(app.uploads.length, 5);
  assert.equal(app.deletions.length, 5);
});

test("POST does not write DB records after an upload failure or expose internal errors", async () => {
  const app = harness();
  app.POST = createReportsHandlers({
    db: app.db,
    environment: {},
    generateCode: () => "ABCDEFGHJKLM",
    upload: async () => { throw new Error("secret blob credential invalid"); },
    deleteUpload: async () => assert.fail("nothing should be deleted"),
  }).POST;
  const response = await json(await app.POST(reportRequest()));
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Photo upload is temporarily unavailable" });
  assert.equal(app.db.records.size, 0);
});

test("POST cleans up after DB failure and survives orphan cleanup failure", async () => {
  const db = fakeDatabase();
  const deleted = [];
  const app = createReportsHandlers({
    db,
    environment: {},
    generateCode: () => "ABCDEFGHJKLM",
    upload: async (pathname) => ({ url: `https://blob.test/${pathname}`, pathname }),
    deleteUpload: async (url) => {
      deleted.push(url);
      throw new Error("delete failed");
    },
  }).POST;
  db.collection = () => ({
    async insertOne() { throw new Error("private mongo URI failed"); },
  });
  const response = await json(await app(reportRequest()));
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Report storage is temporarily unavailable" });
  assert.deepEqual(deleted, ["https://blob.test/reports/ABCDEFGHJKLM.jpg"]);
});

test("GET returns only public tracking fields and normalizes code casing", async () => {
  const stored = {
    _id: "internal-id",
    trackingCode: "ABCDEFGHJKLM",
    type: "water",
    description: "private description is not projected",
    location: { type: "Point", coordinates: [12.5, 45] },
    photoUrl: "https://blob.test/reports/ABCDEFGHJKLM.jpg",
    photoPathname: "reports/ABCDEFGHJKLM.jpg",
    status: "in_progress",
    statusHistory: [{ status: "in_progress", changedAt: NOW, note: "Crew assigned" }],
    createdAt: NOW,
    updatedAt: NOW,
    staffEmail: "staff@example.test",
    session: "private-session",
  };
  const app = harness({ initialReports: [stored] });
  const response = await json(await app.GET(null, { params: Promise.resolve({ code: "abcdefghjklm" }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    type: "water",
    location: { type: "Point", coordinates: [12.5, 45] },
    locationPrecision: "exact",
    photoUrl: "https://blob.test/reports/ABCDEFGHJKLM.jpg",
    status: "in_progress",
    statusHistory: [{ status: "in_progress", changedAt: NOW.toISOString(), note: "Crew assigned" }],
    createdAt: NOW.toISOString(),
    evidenceRemoved: false,
  });
  for (const field of ["_id", "trackingCode", "description", "photoPathname", "updatedAt", "staffEmail", "session"]) {
    assert.equal(Object.hasOwn(response.body, field), false);
  }
});

test("POST preserves explicit privacy choices while keeping exact staff coordinates", async () => {
  const app = harness();
  const response = await app.POST(reportRequest({
    locationVisibility: "exact",
    photoVisibility: "tracking",
    deleteEvidenceOnResolution: "true",
  }));
  assert.equal(response.status, 201);
  const stored = app.db.records.get("ABCDEFGHJKLM");
  assert.deepEqual(stored.location, { type: "Point", coordinates: [-74.006, 40.7128] });
  assert.deepEqual(stored.publicLocation, stored.location);
  assert.equal(stored.locationVisibility, "exact");
  assert.equal(stored.photoVisibility, "tracking");
  assert.equal(stored.deleteEvidenceOnResolution, true);
});

test("GET enforces each new public location and photo visibility combination", async (t) => {
  const base = {
    trackingCode: "ABCDEFGHJKLM",
    type: "roads",
    description: "staff only",
    location: { type: "Point", coordinates: [-74.006, 40.7128] },
    publicLocation: { type: "Point", coordinates: [-74.01, 40.71] },
    photoUrl: "https://blob.test/reports/ABCDEFGHJKLM.jpg",
    photoPathname: "reports/ABCDEFGHJKLM.jpg",
    deleteEvidenceOnResolution: false,
    status: "submitted",
    statusHistory: [],
    createdAt: NOW,
  };
  const cases = [
    { locationVisibility: "approximate", photoVisibility: "staff", coordinates: [-74.01, 40.71], photo: false },
    { locationVisibility: "exact", photoVisibility: "tracking", publicLocation: base.location, coordinates: [-74.006, 40.7128], photo: true },
    { locationVisibility: "staff", photoVisibility: "staff", publicLocation: null, coordinates: null, photo: false },
  ];
  for (const example of cases) {
    await t.test(`${example.locationVisibility}/${example.photoVisibility}`, async () => {
      const app = harness({ initialReports: [{ ...base, ...example }] });
      const response = await json(await app.GET(null, { params: Promise.resolve({ code: "ABCDEFGHJKLM" }) }));
      assert.equal(response.status, 200);
      if (example.coordinates) {
        assert.deepEqual(response.body.location, { type: "Point", coordinates: example.coordinates });
        assert.equal(response.body.locationPrecision, example.locationVisibility);
      } else {
        assert.equal(Object.hasOwn(response.body, "location"), false);
        assert.equal(Object.hasOwn(response.body, "locationPrecision"), false);
      }
      assert.equal(Object.hasOwn(response.body, "photoUrl"), example.photo);
      assert.equal(response.body.evidenceRemoved, false);
      for (const field of ["description", "locationVisibility", "photoVisibility", "deleteEvidenceOnResolution", "publicLocation", "photoPathname"]) {
        assert.equal(Object.hasOwn(response.body, field), false);
      }
    });
  }
});

test("GET suppresses stale evidence fields after resolution deletion", async () => {
  const stored = {
    trackingCode: "ABCDEFGHJKLM",
    type: "roads",
    location: { type: "Point", coordinates: [-74.006, 40.7128] },
    publicLocation: { type: "Point", coordinates: [-74.01, 40.71] },
    locationVisibility: "approximate",
    photoVisibility: "tracking",
    deleteEvidenceOnResolution: true,
    photoUrl: "https://blob.test/reports/ABCDEFGHJKLM.jpg",
    status: "fixed",
    statusHistory: [],
    createdAt: NOW,
    evidenceRemovedAt: NOW,
  };
  const app = harness({ initialReports: [stored] });
  const response = await json(await app.GET(null, { params: Promise.resolve({ code: "ABCDEFGHJKLM" }) }));
  assert.equal(response.body.evidenceRemoved, true);
  assert.equal(Object.hasOwn(response.body, "location"), false);
  assert.equal(Object.hasOwn(response.body, "photoUrl"), false);
});

test("GET returns 404 for invalid and unavailable tracking codes", async (t) => {
  for (const code of ["missing", "bad/code", ""]) {
    await t.test(code || "empty", async () => {
      const app = harness();
      const response = await json(await app.GET(null, { params: Promise.resolve({ code }) }));
      assert.equal(response.status, 404);
      assert.deepEqual(response.body, { error: "Not found" });
    });
  }
});

test("GET exposes a safe error boundary when lookup fails", async () => {
  const handlers = createReportsHandlers({
    db: { collection: () => ({ findOne: async () => { throw new Error("private credentials"); } }) },
  });
  const response = await json(await handlers.GET(null, { params: Promise.resolve({ code: "ABCDEFGHJKLM" }) }));
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Report lookup is temporarily unavailable" });
});
