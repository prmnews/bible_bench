import { NextResponse } from "next/server";

import {
  AppConfigModel,
  BibleAggregateModel,
  BookAggregateModel,
  ChapterAggregateModel,
  ModelModel,
  RunModel,
  VerseResultModel,
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { summarizeResults } from "@/lib/results";

async function getShowLatestOnly() {
  const config = await AppConfigModel.findOne({ key: "SHOW_LATEST_ONLY" }).lean();
  const value = config?.value ?? "1";
  return value === "1" || value.toLowerCase() === "true";
}

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const resolvedParams = await params;
  const modelIdValue = resolvedParams["modelId"];
  const modelId = Number(Array.isArray(modelIdValue) ? modelIdValue[0] : modelIdValue);
  if (!Number.isFinite(modelId)) {
    return NextResponse.json({ ok: false, error: "modelId must be a number." }, { status: 400 });
  }

  await connectToDatabase();
  const model = await ModelModel.findOne(
    { modelId },
    { _id: 0, modelId: 1, displayName: 1, provider: 1, version: 1, releasedAt: 1 }
  ).lean();
  if (!model) {
    return NextResponse.json({ ok: false, error: "Model not found." }, { status: 404 });
  }

  const showLatestOnly = await getShowLatestOnly();
  let runIds: string[] = [];
  let latestRunId: string | null = null;

  if (showLatestOnly) {
    const run = await RunModel.findOne({ modelId }, { runId: 1 })
      .sort({ startedAt: -1 })
      .lean();
    if (run?.runId) {
      runIds = [run.runId];
      latestRunId = run.runId;
    }
  } else {
    const runs = await RunModel.find({ modelId }, { runId: 1 })
      .sort({ startedAt: -1 })
      .lean();
    runIds = runs.map((run) => run.runId);
    latestRunId = runs[0]?.runId ?? null;
  }

  if (runIds.length === 0) {
    return NextResponse.json({
      ok: true,
      data: {
        model: {
          ...model,
          releasedAt: (model.releasedAt as Date)?.toISOString?.() ?? null,
        },
        latestRunId,
        metrics: { total: 0, matches: 0, perfectRate: 0, avgFidelity: 0 },
        bibleAggregates: [],
        bookAggregates: [],
        chapterAggregates: [],
        timeSeries: [],
      },
    });
  }

  // Get stored aggregates
  const [bibleAggregates, bookAggregates, chapterAggregates] = await Promise.all([
    BibleAggregateModel.find(
      { modelId, runId: { $in: runIds } },
      { _id: 0, bibleId: 1, runId: 1, avgFidelity: 1, perfectRate: 1, verseCount: 1, evaluatedAt: 1 }
    )
      .sort({ evaluatedAt: -1 })
      .lean(),
    BookAggregateModel.find(
      { modelId, runId: { $in: runIds } },
      { _id: 0, bookId: 1, bibleId: 1, runId: 1, avgFidelity: 1, perfectRate: 1, evaluatedAt: 1 }
    )
      .sort({ bookId: 1 })
      .limit(100)
      .lean(),
    ChapterAggregateModel.find(
      { modelId, runId: { $in: runIds } },
      { _id: 0, chapterId: 1, bookId: 1, runId: 1, avgFidelity: 1, perfectRate: 1, evaluatedAt: 1 }
    )
      .sort({ chapterId: 1 })
      .limit(100)
      .lean(),
  ]);

  // Calculate overall metrics from bible aggregates or fallback
  let metrics: { total: number; matches: number; perfectRate: number; avgFidelity: number };

  if (bibleAggregates.length > 0) {
    const totalFidelity = bibleAggregates.reduce((sum, agg) => sum + (agg.avgFidelity as number), 0);
    const totalPerfectRate = bibleAggregates.reduce((sum, agg) => sum + (agg.perfectRate as number), 0);
    const totalVerses = bibleAggregates.reduce((sum, agg) => sum + (agg.verseCount as number), 0);

    metrics = {
      total: totalVerses,
      matches: Math.round(totalVerses * (totalPerfectRate / bibleAggregates.length)),
      perfectRate: Number((totalPerfectRate / bibleAggregates.length).toFixed(4)),
      avgFidelity: Number((totalFidelity / bibleAggregates.length).toFixed(2)),
    };
  } else {
    // Fallback to verse-level
    const verseResults = await VerseResultModel.find(
      { modelId, runId: { $in: runIds } },
      { _id: 0, hashMatch: 1, fidelityScore: 1 }
    ).lean();
    metrics = summarizeResults(verseResults);
  }

  // Build time series data for chart (X: evaluatedAt, Y: avgFidelity)
  const timeSeries = bibleAggregates.map((agg) => ({
    evaluatedAt: (agg.evaluatedAt as Date)?.toISOString(),
    avgFidelity: agg.avgFidelity,
    perfectRate: agg.perfectRate,
    bibleId: agg.bibleId,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      model: {
        ...model,
        releasedAt: (model.releasedAt as Date)?.toISOString?.() ?? null,
      },
      latestRunId,
      metrics,
      bibleAggregates: bibleAggregates.map((agg) => ({
        ...agg,
        evaluatedAt: (agg.evaluatedAt as Date)?.toISOString(),
      })),
      bookAggregates: bookAggregates.map((agg) => ({
        ...agg,
        evaluatedAt: (agg.evaluatedAt as Date)?.toISOString(),
      })),
      chapterAggregates: chapterAggregates.map((agg) => ({
        ...agg,
        evaluatedAt: (agg.evaluatedAt as Date)?.toISOString(),
      })),
      timeSeries,
    },
  });
}
