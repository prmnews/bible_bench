import { NextResponse } from "next/server";

import {
  AppConfigModel,
  ChapterModel,
  ChapterResultModel,
  ModelModel,
  RawChapterModel,
  RunModel,
  VerseModel,
  VerseResultModel,
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { summarizeResults } from "@/lib/results";

type RunDetails = {
  runId: string;
  runType: string;
  modelId: number;
  scope: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  failedCount: number;
  durationMs: number | null;
};

type Alert = {
  runId: string;
  errorCode: string;
  message: string;
  timestamp: string;
};

async function getShowLatestOnly() {
  const config = await AppConfigModel.findOne({ key: "SHOW_LATEST_ONLY" }).lean();
  const value = config?.value ?? "1";
  return value === "1" || value.toLowerCase() === "true";
}

export async function GET() {
  await connectToDatabase();
  const showLatestOnly = await getShowLatestOnly();
  
  const [
    rawChapterCount,
    chapterCount,
    verseCount,
    modelCount,
    runCount,
    models,
    latestRunDoc,
    recentFailedRuns,
  ] = await Promise.all([
    RawChapterModel.countDocuments(),
    ChapterModel.countDocuments(),
    VerseModel.countDocuments(),
    ModelModel.countDocuments({ isActive: true }),
    RunModel.countDocuments(),
    ModelModel.find(
      { isActive: true },
      { _id: 0, modelId: 1, displayName: 1, provider: 1, version: 1 }
    )
      .sort({ modelId: 1 })
      .lean(),
    RunModel.findOne(
      {},
      {
        _id: 0,
        runId: 1,
        runType: 1,
        modelId: 1,
        scope: 1,
        status: 1,
        startedAt: 1,
        completedAt: 1,
        metrics: 1,
        errorSummary: 1,
      }
    )
      .sort({ startedAt: -1 })
      .lean(),
    RunModel.find(
      { "errorSummary.lastError": { $ne: null } },
      {
        _id: 0,
        runId: 1,
        errorSummary: 1,
        startedAt: 1,
      }
    )
      .sort({ startedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  // Build latest run details
  let latestRun: RunDetails | null = null;
  if (latestRunDoc) {
    const metrics = latestRunDoc.metrics as Record<string, unknown> | undefined;
    const errorSummary = latestRunDoc.errorSummary as Record<string, unknown> | undefined;
    latestRun = {
      runId: latestRunDoc.runId as string,
      runType: latestRunDoc.runType as string,
      modelId: latestRunDoc.modelId as number,
      scope: latestRunDoc.scope as string,
      status: latestRunDoc.status as string,
      startedAt: (latestRunDoc.startedAt as Date)?.toISOString() ?? "",
      completedAt: latestRunDoc.completedAt
        ? (latestRunDoc.completedAt as Date).toISOString()
        : null,
      failedCount: (errorSummary?.failedCount as number) ?? (metrics?.failed as number) ?? 0,
      durationMs: (metrics?.durationMs as number) ?? null,
    };
  }

  // Build alerts from recent failed runs
  const alerts: Alert[] = [];
  for (const run of recentFailedRuns) {
    const errorSummary = run.errorSummary as Record<string, unknown> | undefined;
    if (errorSummary?.lastError) {
      // Try to extract error code from message (e.g., "MODEL-PARSE-001: ...")
      const message = String(errorSummary.lastError);
      const codeMatch = message.match(/^([A-Z]+-[A-Z]+-\d+)/);
      const errorCode = codeMatch ? codeMatch[1] : "RUN-ERROR";
      
      alerts.push({
        runId: run.runId as string,
        errorCode,
        message: message.length > 100 ? message.slice(0, 100) + "..." : message,
        timestamp: (errorSummary.lastErrorAt as Date)?.toISOString?.() ??
          (run.startedAt as Date)?.toISOString() ?? "",
      });
    }
  }

  const latestRunId = latestRunDoc?.runId ?? null;
  const counts = {
    rawChapters: rawChapterCount,
    chapters: chapterCount,
    verses: verseCount,
    models: modelCount,
    runs: runCount,
  };

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

  return NextResponse.json({
    ok: true,
    data: { counts, latestRunId, latestRun, alerts, models: summaries },
  });
}
