import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { retryFailedRunItems } from "@/lib/model-runs";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

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

  const result = await retryFailedRunItems(runId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: result.data.status === "completed",
    data: result.data,
  });
}
