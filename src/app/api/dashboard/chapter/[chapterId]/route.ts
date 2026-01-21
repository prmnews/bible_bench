import { NextResponse } from "next/server";

import { AggregationChapterModel, LlmVerseResultModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const resolvedParams = await params;
  const chapterIdValue = resolvedParams["chapterId"];
  const chapterId = Number(
    Array.isArray(chapterIdValue) ? chapterIdValue[0] : chapterIdValue
  );
  if (!Number.isFinite(chapterId)) {
    return NextResponse.json({ ok: false, error: "chapterId must be a number." }, { status: 400 });
  }

  await connectToDatabase();

  // Try to use stored chapter aggregates first
  const aggregates = await AggregationChapterModel.find(
    { chapterId },
    {
      _id: 0,
      runId: 1,
      modelId: 1,
      avgFidelity: 1,
      perfectRate: 1,
      verseCount: 1,
      matchCount: 1,
      evaluatedAt: 1,
    }
  )
    .sort({ modelId: 1, evaluatedAt: -1 })
    .lean();

  if (aggregates.length > 0) {
    // Use stored aggregates
    const results = aggregates.map((agg) => ({
      runId: agg.runId,
      modelId: agg.modelId,
      avgFidelity: agg.avgFidelity,
      perfectRate: agg.perfectRate,
      verseCount: agg.verseCount,
      matchCount: agg.matchCount,
      evaluatedAt: (agg.evaluatedAt as Date)?.toISOString(),
    }));

    return NextResponse.json({ ok: true, data: { chapterId, results, source: "aggregate" } });
  }

  // Fallback: aggregate from verse results
  const verseAggregation = await LlmVerseResultModel.aggregate([
    { $match: { chapterId } },
    {
      $group: {
        _id: { runId: "$runId", modelId: "$modelId" },
        avgFidelity: { $avg: "$fidelityScore" },
        verseCount: { $sum: 1 },
        matchCount: { $sum: { $cond: ["$hashMatch", 1, 0] } },
        evaluatedAt: { $max: "$evaluatedAt" },
      },
    },
    { $sort: { "_id.modelId": 1, evaluatedAt: -1 } },
  ]);

  const results = verseAggregation.map((agg) => ({
    runId: agg._id.runId,
    modelId: agg._id.modelId,
    avgFidelity: Number(agg.avgFidelity.toFixed(2)),
    perfectRate: agg.verseCount > 0 ? Number((agg.matchCount / agg.verseCount).toFixed(4)) : 0,
    verseCount: agg.verseCount,
    matchCount: agg.matchCount,
    evaluatedAt: agg.evaluatedAt?.toISOString?.(),
  }));

  return NextResponse.json({ ok: true, data: { chapterId, results, source: "computed" } });
}
