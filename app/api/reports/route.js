import { del, put } from "@vercel/blob";
import { customAlphabet } from "nanoid";
import clientPromise from "@/lib/mongodb";
import { createReportsHandlers } from "@/lib/reports";

const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 12);

export async function POST(request) {
  let db;
  try {
    db = (await clientPromise).db();
  } catch {
    return Response.json({ error: "Report storage is temporarily unavailable" }, { status: 503 });
  }

  return createReportsHandlers({
    db,
    upload: put,
    deleteUpload: del,
    generateCode,
  }).POST(request);
}
