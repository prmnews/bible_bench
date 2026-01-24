import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { RunModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const runType = searchParams.get("runType");
  const status = searchParams.get("status");
  const modelIdValue = searchParams.get("modelId");

  // Pagination params
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");

  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limitParam) || DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;

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

  const [runs, total] = await Promise.all([
    RunModel.find(query, { _id: 0 })
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RunModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    ok: true,
    data: runs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}
