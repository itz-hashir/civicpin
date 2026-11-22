import { del } from "@vercel/blob";
import clientPromise from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { STATUSES } from "@/lib/reportTypes";
import { ObjectId } from "mongodb";

function hasPrivacyControls(report) {
  return report.locationVisibility !== undefined &&
    report.photoVisibility !== undefined &&
    report.deleteEvidenceOnResolution !== undefined &&
    report.publicLocation !== undefined;
}

export async function PATCH(req, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const { status, note } = await req.json();
  if (!STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  // The type check is part of the query, so staff can't edit other offices' reports
  const filter = { _id: new ObjectId(id) };
  if (!session.types.includes("all")) filter.type = { $in: session.types };

  const now = new Date();
  const db = (await clientPromise).db();
  const collection = db.collection("reports");
  let removeEvidence = false;
  if (status === "fixed") {
    const report = await collection.findOne(filter);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
    removeEvidence = report.status !== "fixed" &&
      hasPrivacyControls(report) &&
      report.deleteEvidenceOnResolution === true &&
      !report.evidenceRemovedAt;
    if (removeEvidence) {
      try {
        await del(report.photoPathname || report.photoUrl);
      } catch {
        return Response.json({ error: "Evidence deletion is temporarily unavailable" }, { status: 503 });
      }
    }
  }

  const update = {
    $set: { status, updatedAt: now },
    $push: {
      statusHistory: { status, changedAt: now, note: String(note || "").slice(0, 300) },
    },
  };
  if (removeEvidence) {
    update.$unset = { location: "", publicLocation: "", photoUrl: "", photoPathname: "" };
    update.$set.evidenceRemovedAt = now;
  }
  const result = await collection.updateOne(filter, update);

  if (result.matchedCount === 0) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}