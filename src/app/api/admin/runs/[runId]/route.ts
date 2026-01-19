import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { RunItemModel, RunModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const resolvedParams = await params;
  const runIdValue = resolvedParams["runId"];
  const runId = Array.isArray(runIdValue) ? runIdValue[0] : runIdValue;
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
