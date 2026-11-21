import { validateReportForm } from "./reportValidation.js";

const MAX_CODE_ATTEMPTS = 5;
const PUBLIC_REPORT_PROJECTION = {
  _id: 0,
  type: 1,
  status: 1,
  statusHistory: 1,
  createdAt: 1,
  location: 1,
  photoUrl: 1,
};

function unavailable(message) {
  return Response.json({ error: message }, { status: 503 });
}

function isDuplicateCodeError(error) {
  return error?.code === 11000;
}

async function removeOrphan(deleteUpload, blob) {
  try {
    await deleteUpload(blob.url || blob.pathname);
  } catch {
    // Cleanup is best effort; never replace the original storage error.
  }
}

export function createReportsHandlers({
  db,
  upload,
  deleteUpload,
  generateCode,
  now = () => new Date(),
  environment = process.env,
}) {
  async function POST(request) {
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Invalid multipart form data" }, { status: 400 });
    }

    const input = await validateReportForm(formData, environment);
    if (!input.ok) {
      return Response.json({ error: input.error }, { status: input.status });
    }

    const { type, description, lat, lng, photoBytes, photoExtension, photoContentType } = input.value;

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = generateCode();
      let blob;
      try {
        blob = await upload(`reports/${code}.${photoExtension}`, photoBytes, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: photoContentType,
        });
      } catch {
        return unavailable("Photo upload is temporarily unavailable");
      }

      const timestamp = now();
      const report = {
        trackingCode: code,
        type,
        description,
        location: { type: "Point", coordinates: [lng, lat] },
        photoUrl: blob.url,
        photoPathname: blob.pathname,
        status: "submitted",
        statusHistory: [{ status: "submitted", changedAt: timestamp, note: "" }],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await db.collection("reports").insertOne(report);
        return Response.json({ code }, { status: 201 });
      } catch (error) {
        await removeOrphan(deleteUpload, blob);
        if (!isDuplicateCodeError(error)) {
          return unavailable("Report storage is temporarily unavailable");
        }
      }
    }

    return unavailable("Report service is temporarily unavailable");
  }

  async function GET(_request, { params }) {
    let code;
    try {
      code = String((await params).code).toUpperCase();
    } catch {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (!/^[A-Z0-9]+$/.test(code)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    try {
      const report = await db.collection("reports").findOne(
        { trackingCode: code },
        { projection: PUBLIC_REPORT_PROJECTION },
      );
      if (!report) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(report);
    } catch {
      return unavailable("Report lookup is temporarily unavailable");
    }
  }

  return { POST, GET };
}
