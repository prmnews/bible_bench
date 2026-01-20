import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { ChapterResultModel } from "@/lib/models";
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
  const chapterIdValue = resolvedParams["chapterId"];
  const chapterId = Number(
    Array.isArray(chapterIdValue) ? chapterIdValue[0] : chapterIdValue
  );
  if (!Number.isFinite(chapterId)) {
    return NextResponse.json({ ok: false, error: "chapterId must be a number." }, { status: 400 });
  }

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  await connectToDatabase();
  
  const query: Record<string, unknown> = { chapterId };
  if (runId) {
    query.runId = runId;
  }

  const results = await ChapterResultModel.find(query, { _id: 0 })
    .sort({ "audit.createdAt": -1 })
    .limit(runId ? 1 : 10)
    .lean();

  return NextResponse.json({ ok: true, data: { chapterId, results } });
}
