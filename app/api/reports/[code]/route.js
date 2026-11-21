import clientPromise from "@/lib/mongodb";
import { createReportsHandlers } from "@/lib/reports";

export async function GET(request, context) {
  let db;
  try {
    db = (await clientPromise).db();
  } catch {
    return Response.json({ error: "Report lookup is temporarily unavailable" }, { status: 503 });
  }

  return createReportsHandlers({ db }).GET(request, context);
}