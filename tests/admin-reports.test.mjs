import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const authModule = `
export const getSession = () => globalThis.__adminReportTest.session;
`;
const databaseModule = `
export default Promise.resolve({ db: () => globalThis.__adminReportTest.db });
`;
const hooks = {
  "@/lib/auth": `data:text/javascript,${encodeURIComponent(authModule)}`,
  "@/lib/mongodb": `data:text/javascript,${encodeURIComponent(databaseModule)}`,
  "@/lib/reportTypes": new URL("../lib/reportTypes.js", import.meta.url).href,
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

function fixture() {
  const calls = [];
  globalThis.__adminReportTest = {
    session: { email: "roads@example.test", types: ["roads"] },
    db: {
      collection(name) {
        assert.equal(name, "reports");
        return {
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
