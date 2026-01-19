import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { retryFailedRunItems } from "@/lib/model-runs";

export const runtime = "nodejs";

export async function POST(
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

  const result = await retryFailedRunItems(runId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: result.data.status === "completed",
    data: result.data,
  });
}
