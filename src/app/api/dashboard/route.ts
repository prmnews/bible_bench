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

export async function GET() {
  await connectToDatabase();
  const showLatestOnly = await getShowLatestOnly();
  const models = await ModelModel.find(
    { isActive: true },
    { _id: 0, modelId: 1, displayName: 1, provider: 1, version: 1 }
  )
    .sort({ modelId: 1 })
    .lean();

  const latestRun = await RunModel.findOne({}, { runId: 1 }).sort({ startedAt: -1 }).lean();
  const latestRunId = latestRun?.runId ?? null;

  const summaries = [] as Array<{
    modelId: number;
    displayName: string;
    perfectRate: number;
    avgFidelity: number;
  }>;

  for (const model of models) {
    let runIds: string[] = [];

    if (showLatestOnly) {
      const run = await RunModel.findOne({ modelId: model.modelId }, { runId: 1 })
        .sort({ startedAt: -1 })
        .lean();
      if (run?.runId) {
        runIds = [run.runId];
      }
    } else {
      const runs = await RunModel.find({ modelId: model.modelId }, { runId: 1 }).lean();
      runIds = runs.map((run) => run.runId);
    }

    if (runIds.length === 0) {
      summaries.push({
        modelId: model.modelId,
        displayName: model.displayName,
        perfectRate: 0,
        avgFidelity: 0,
      });
      continue;
    }

    const [chapterResults, verseResults] = await Promise.all([
      ChapterResultModel.find(
        { modelId: model.modelId, runId: { $in: runIds } },
        { _id: 0, hashMatch: 1, fidelityScore: 1 }
      ).lean(),
      VerseResultModel.find(
        { modelId: model.modelId, runId: { $in: runIds } },
        { _id: 0, hashMatch: 1, fidelityScore: 1 }
      ).lean(),
    ]);

    const summary = summarizeResults([...chapterResults, ...verseResults]);
    summaries.push({
      modelId: model.modelId,
      displayName: model.displayName,
      perfectRate: summary.perfectRate,
      avgFidelity: summary.avgFidelity,
    });
  }

  return NextResponse.json({ ok: true, data: { latestRunId, models: summaries } });
}
