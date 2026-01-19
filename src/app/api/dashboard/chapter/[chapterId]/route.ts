import { NextResponse } from "next/server";

import { ChapterResultModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  const chapterId = Number(params.chapterId);
  if (!Number.isFinite(chapterId)) {
    return NextResponse.json({ ok: false, error: "chapterId must be a number." }, { status: 400 });
  }

  await connectToDatabase();
  const results = await ChapterResultModel.find(
    { chapterId },
    { _id: 0, runId: 1, modelId: 1, hashMatch: 1, fidelityScore: 1, diff: 1 }
  )
    .sort({ modelId: 1 })
    .lean();

  return NextResponse.json({ ok: true, data: { chapterId, results } });
}
