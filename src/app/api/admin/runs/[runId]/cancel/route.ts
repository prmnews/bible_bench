import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { RunModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * POST /api/admin/runs/[runId]/cancel
 *
 * Request cancellation of a running model run.
 * Sets cancelRequested flag to true, which the run loop checks periodically.
 */
export async function POST(
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

  // Find the run and check its status
  const run = await RunModel.findOne({ runId }, { status: 1, cancelRequested: 1 }).lean();
  if (!run) {
    return NextResponse.json({ ok: false, error: "Run not found." }, { status: 404 });
  }

  if (run.status !== "running") {
    return NextResponse.json(
      { ok: false, error: `Cannot cancel run with status "${run.status}". Only running runs can be cancelled.` },
      { status: 400 }
    );
  }

  if (run.cancelRequested) {
    return NextResponse.json(
      { ok: true, data: { runId, message: "Cancellation already requested." } }
    );
  }

  // Set the cancellation flag
  await RunModel.updateOne(
    { runId },
    { $set: { cancelRequested: true } }
  );

  return NextResponse.json({
    ok: true,
    data: { runId, message: "Cancellation requested. Run will stop after current chapter completes." },
  });
}
