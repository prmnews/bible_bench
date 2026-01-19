import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { RunModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const runType = searchParams.get("runType");
  const status = searchParams.get("status");
  const modelIdValue = searchParams.get("modelId");

  const query: Record<string, unknown> = {};
  if (runType) {
    query.runType = runType;
  }
  if (status) {
    query.status = status;
  }
  if (modelIdValue) {
    const modelId = Number(modelIdValue);
    if (!Number.isFinite(modelId)) {
      return NextResponse.json({ ok: false, error: "modelId must be a number." }, { status: 400 });
    }
    query.modelId = modelId;
  }

  await connectToDatabase();
  const runs = await RunModel.find(query, { _id: 0 })
    .sort({ startedAt: -1 })
    .lean();

  return NextResponse.json({ ok: true, data: runs });
}
