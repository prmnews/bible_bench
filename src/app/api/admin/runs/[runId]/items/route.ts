import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { RunItemModel, RunModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * GET /api/admin/runs/[runId]/items
 *
 * Returns the status of all run items for progress polling.
 * Response: { runId, status, cancelRequested, items: [{ targetId, status }] }
 */
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

  // Get run status
  const run = await RunModel.findOne(
    { runId },
    { status: 1, cancelRequested: 1, metrics: 1 }
  ).lean();

  if (!run) {
    return NextResponse.json({ ok: false, error: "Run not found." }, { status: 404 });
  }

  // Get all run items with minimal fields for efficiency
  const items = await RunItemModel.find(
    { runId },
    { targetId: 1, status: 1, _id: 0 }
  )
    .sort({ targetId: 1 })
    .lean();

  return NextResponse.json({
    ok: true,
    data: {
      runId,
      status: run.status,
      cancelRequested: run.cancelRequested ?? false,
      metrics: run.metrics,
      items: items.map((item) => ({
        targetId: item.targetId,
        status: item.status,
      })),
    },
  });
}
