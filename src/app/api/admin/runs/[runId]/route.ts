import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { RunItemModel, RunModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const runId = params.runId;
  if (!runId || runId.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "runId is required." }, { status: 400 });
  }

  await connectToDatabase();
  const run = await RunModel.findOne({ runId }, { _id: 0 }).lean();
  if (!run) {
    return NextResponse.json({ ok: false, error: "Run not found." }, { status: 404 });
  }

  const items = await RunItemModel.find({ runId }, { _id: 0 })
    .sort({ targetId: 1 })
    .lean();

  return NextResponse.json({ ok: true, data: { run, items } });
}
