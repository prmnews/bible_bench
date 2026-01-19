import { NextResponse } from "next/server";

import {
  AppConfigModel,
  ChapterResultModel,
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

export async function GET(
  request: Request,
  { params }: { params: { modelId: string } }
) {
  const modelId = Number(params.modelId);
  if (!Number.isFinite(modelId)) {
    return NextResponse.json({ ok: false, error: "modelId must be a number." }, { status: 400 });
  }

  await connectToDatabase();
  const model = await ModelModel.findOne(
    { modelId },
    { _id: 0, modelId: 1, displayName: 1, provider: 1, version: 1 }
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
        model,
        latestRunId,
        metrics: { total: 0, matches: 0, perfectRate: 0, avgFidelity: 0 },
        chapterResults: [],
        verseResults: [],
      },
    });
  }

  const [chapterResults, verseResults] = await Promise.all([
    ChapterResultModel.find(
      { modelId, runId: { $in: runIds } },
      { _id: 0, runId: 1, chapterId: 1, hashMatch: 1, fidelityScore: 1, diff: 1 }
    )
      .sort({ chapterId: 1 })
      .lean(),
    VerseResultModel.find(
      { modelId, runId: { $in: runIds } },
      { _id: 0, runId: 1, verseId: 1, hashMatch: 1, fidelityScore: 1, diff: 1 }
    )
      .sort({ verseId: 1 })
      .lean(),
  ]);

  const summary = summarizeResults([...chapterResults, ...verseResults]);

  return NextResponse.json({
    ok: true,
    data: {
      model,
      latestRunId,
      metrics: summary,
      chapterResults,
      verseResults,
    },
  });
}
