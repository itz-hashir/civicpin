import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const authModule = `
export const getSession = () => globalThis.__adminReportTest.session;
`;
const databaseModule = `
export default Promise.resolve({ db: () => globalThis.__adminReportTest.db });
`;
const blobModule = `
export const del = (path) => globalThis.__adminReportTest.deleteBlob(path);
`;
const hooks = {
  "@/lib/auth": `data:text/javascript,${encodeURIComponent(authModule)}`,
  "@/lib/mongodb": `data:text/javascript,${encodeURIComponent(databaseModule)}`,
  "@/lib/reportTypes": new URL("../lib/reportTypes.js", import.meta.url).href,
  "@vercel/blob": `data:text/javascript,${encodeURIComponent(blobModule)}`,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = specifier.endsWith(".js") ? specifier.slice(0, -3) : specifier;
    if (Object.hasOwn(hooks, alias)) {
      return { shortCircuit: true, url: hooks[alias] };
    }
    return nextResolve(specifier, context);
  },
});

const { PATCH } = await import("../app/api/admin/reports/[id]/route.js");
const ID = "507f1f77bcf86cd799439011";

function fixture({ report = { status: "in_progress" }, deleteError = null } = {}) {
  const calls = [];
  calls.deletions = [];
  globalThis.__adminReportTest = {
    session: { email: "roads@example.test", types: ["roads"] },
    async deleteBlob(path) {
      calls.deletions.push(path);
      if (deleteError) throw deleteError;
    },
    db: {
      collection(name) {
        assert.equal(name, "reports");
        return {
          async findOne(filter) {
            calls.push({ filter });
            return report;
          },
          async updateOne(filter, update) {
            calls.push({ filter, update });
            const allowed = !filter.type || filter.type.$in.includes("roads");
            return { matchedCount: allowed ? 1 : 0 };
          },
        };
      },
    },
  };
  return calls;
}

function input({ id = ID, status = "in_progress", note = "Crew scheduled for inspection" } = {}) {
  return {
    request: new Request(`http://localhost/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, note }),
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

test("a scoped staff session appends a bounded note and a timestamp", async () => {
  const calls = fixture();
  const longNote = "x".repeat(350);
  const { request, context } = input({ note: longNote });
  const response = await PATCH(request, context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 1);
  const [entry] = calls;
  assert.deepEqual(entry.filter.type, { $in: ["roads"] });
  assert.equal(String(entry.filter._id), ID);
  assert.equal(entry.update.$set.status, "in_progress");
  assert.equal(entry.update.$push.statusHistory.status, "in_progress");
  assert.equal(entry.update.$push.statusHistory.note.length, 300);
  assert.equal(entry.update.$push.statusHistory.changedAt instanceof Date, true);
  assert.equal(entry.update.$push.statusHistory.changedAt.getTime(), entry.update.$set.updatedAt.getTime());
});

test("an unauthenticated request cannot update a report", async () => {
  const calls = fixture();
  globalThis.__adminReportTest.session = null;
  const { request, context } = input();
  const response = await PATCH(request, context);
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("staff cannot use another office's category", async () => {
  const calls = fixture();
  globalThis.__adminReportTest.session.types = ["water"];
  const { request, context } = input();
  const response = await PATCH(request, context);
  assert.equal(response.status, 404);
  assert.deepEqual(calls[0].filter.type, { $in: ["water"] });
});

test("all-office staff do not add a category filter", async () => {
  const calls = fixture();
  globalThis.__adminReportTest.session.types = ["all"];
  const { request, context } = input({ status: "fixed", note: "Repair complete" });
  const response = await PATCH(request, context);
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(calls[0].filter, "type"), false);
});

test("invalid ids and statuses fail before persistence", async (t) => {
  const cases = [
    { value: { id: "not-an-object-id" }, expected: "Invalid id" },
    { value: { status: "closed" }, expected: "Invalid status" },
  ];
  for (const { value, expected } of cases) {
    await t.test(expected, async () => {
      const calls = fixture();
      const { request, context } = input(value);
      const response = await PATCH(request, context);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, expected);
      assert.equal(calls.length, 0);
    });
  }
});

function privacyReport() {
  return {
    status: "in_progress",
    location: { type: "Point", coordinates: [-74.006, 40.7128] },
    publicLocation: { type: "Point", coordinates: [-74.01, 40.71] },
    locationVisibility: "approximate",
    photoVisibility: "staff",
    deleteEvidenceOnResolution: true,
    photoUrl: "https://blob.test/reports/ABCDEFGHJKLM.jpg",
    photoPathname: "reports/ABCDEFGHJKLM.jpg",
  };
}

test("resolving an opted-in report deletes its blob and removes all evidence references", async () => {
  const calls = fixture({ report: privacyReport() });
  const { request, context } = input({ status: "fixed", note: "Repair complete" });
  const response = await PATCH(request, context);
  assert.equal(response.status, 200);
  assert.deepEqual(calls.deletions, ["reports/ABCDEFGHJKLM.jpg"]);
  const update = calls.find((entry) => entry.update)?.update;
  assert.deepEqual(update.$unset, { location: "", publicLocation: "", photoUrl: "", photoPathname: "" });
  assert.equal(update.$set.status, "fixed");
  assert.equal(update.$set.evidenceRemovedAt instanceof Date, true);
  assert.equal(update.$set.evidenceRemovedAt.getTime(), update.$set.updatedAt.getTime());
});

test("a blob deletion failure leaves the report unfixed for retry", async () => {
  const calls = fixture({ report: privacyReport(), deleteError: new Error("storage unavailable") });
  const { request, context } = input({ status: "fixed" });
  const response = await PATCH(request, context);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Evidence deletion is temporarily unavailable" });
  assert.deepEqual(calls.deletions, ["reports/ABCDEFGHJKLM.jpg"]);
  assert.equal(calls.some((entry) => entry.update), false);
});

test("legacy and opt-out reports keep evidence when resolved", async (t) => {
  const reports = [
    { status: "in_progress", photoUrl: "https://blob.test/legacy.jpg", photoPathname: "legacy.jpg" },
    { ...privacyReport(), deleteEvidenceOnResolution: false },
  ];
  for (const report of reports) {
    await t.test(report.deleteEvidenceOnResolution === undefined ? "legacy" : "opt out", async () => {
      const calls = fixture({ report });
      const { request, context } = input({ status: "fixed" });
      const response = await PATCH(request, context);
      assert.equal(response.status, 200);
      assert.deepEqual(calls.deletions, []);
      const update = calls.find((entry) => entry.update)?.update;
      assert.equal(Object.hasOwn(update, "$unset"), false);
      assert.equal(Object.hasOwn(update.$set, "evidenceRemovedAt"), false);
    });
  }
});
