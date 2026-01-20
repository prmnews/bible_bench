import { randomUUID } from "node:crypto";

import { applyTransformProfile } from "@/lib/transforms";
import { compareText } from "@/lib/evaluation";
import { sha256 } from "@/lib/hash";
import { generateModelResponse } from "@/lib/model-providers";
import {
  ChapterModel,
  ChapterResultModel,
  ModelModel,
  ModelTransformMapModel,
  RunItemModel,
  RunModel,
  TransformProfileModel,
  VerseModel,
  VerseResultModel,
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type RunType = "MODEL_CHAPTER" | "MODEL_VERSE";
type RunScope = "bible" | "book" | "chapter" | "verse";
type RunTargetType = "chapter" | "verse";
type RunStatus = "running" | "completed" | "failed";
type RunLogLevel = "info" | "warn" | "error";

type RunLogEntry = {
  stage: string;
  level: RunLogLevel;
  message: string;
  timestamp: Date;
};

type RunErrorSummary = {
  failedCount: number;
  lastError: string | null;
  lastErrorAt: Date | null;
};

type RunMetrics = {
  total: number;
  success: number;
  failed: number;
  totalChapters?: number;
  totalVerses?: number;
  durationMs?: number;
};

type RunSummary = {
  runId: string;
  runType: RunType;
  status: RunStatus;
  metrics: RunMetrics;
};

type RunResult =
  | { ok: true; data: RunSummary; idempotent?: boolean }
  | { ok: false; status: number; error: string };

type StartRunParams = {
  runId?: string;
  modelId: number;
  runType: RunType;
  scope: RunScope;
  scopeIds: Record<string, number>;
  createdBy?: string;
  limit?: number;
  skip?: number;
};

function createResultId() {
  return Math.floor(Date.now() * 1000 + Math.random() * 1000);
}

function createRunLogger(existingLogs?: RunLogEntry[]) {
  const logs = existingLogs ? [...existingLogs] : [];
  const log = (stage: string, level: RunLogLevel, message: string) => {
    logs.push({ stage, level, message, timestamp: new Date() });
  };

  return { logs, log };
}

async function resolveModelOutputProfile(modelId: number) {
  const mapping = await ModelTransformMapModel.findOne({ modelId }).lean();
  if (mapping?.modelProfileId) {
    const profile = await TransformProfileModel.findOne({
      profileId: mapping.modelProfileId,
      scope: "model_output",
      isActive: true,
    }).lean();

    if (profile) {
      return profile;
    }
  }

  const fallback = await TransformProfileModel.findOne({
    scope: "model_output",
    isDefault: true,
    isActive: true,
  })
    .sort({ profileId: 1 })
    .lean();

  return fallback ?? null;
}

async function resolveTargetIds(
  targetType: RunTargetType,
  scope: RunScope,
  scopeIds: Record<string, number>
) {
  if (targetType === "chapter") {
    if (scope === "bible") {
      const bibleId = scopeIds["bibleId"];
      if (bibleId === undefined) {
        throw new Error("bibleId is required for bible scope.");
      }
      const chapters = await ChapterModel.find({ bibleId }, { chapterId: 1 })
        .sort({ chapterId: 1 })
        .lean();
      return chapters.map((chapter) => chapter.chapterId);
    }

    if (scope === "book") {
      const bookId = scopeIds["bookId"];
      if (bookId === undefined) {
        throw new Error("bookId is required for book scope.");
      }
      const chapters = await ChapterModel.find({ bookId }, { chapterId: 1 })
        .sort({ chapterId: 1 })
        .lean();
      return chapters.map((chapter) => chapter.chapterId);
    }

    if (scope === "chapter") {
      const chapterId = scopeIds["chapterId"];
      if (chapterId === undefined) {
        throw new Error("chapterId is required for chapter scope.");
      }
      return [chapterId];
    }

    throw new Error("Unsupported scope for chapter runs.");
  }

  if (scope === "bible") {
    const bibleId = scopeIds["bibleId"];
    if (bibleId === undefined) {
      throw new Error("bibleId is required for bible scope.");
    }
    const verses = await VerseModel.find({ bibleId }, { verseId: 1 })
      .sort({ verseId: 1 })
      .lean();
    return verses.map((verse) => verse.verseId);
  }

  if (scope === "book") {
    const bookId = scopeIds["bookId"];
    if (bookId === undefined) {
      throw new Error("bookId is required for book scope.");
    }
    const verses = await VerseModel.find({ bookId }, { verseId: 1 })
      .sort({ verseId: 1 })
      .lean();
    return verses.map((verse) => verse.verseId);
  }

  if (scope === "chapter") {
    const chapterId = scopeIds["chapterId"];
    if (chapterId === undefined) {
      throw new Error("chapterId is required for chapter scope.");
    }
    const verses = await VerseModel.find({ chapterId }, { verseId: 1 })
      .sort({ verseId: 1 })
      .lean();
    return verses.map((verse) => verse.verseId);
  }

  if (scope === "verse") {
    const verseId = scopeIds["verseId"];
    if (verseId === undefined) {
      throw new Error("verseId is required for verse scope.");
    }
    return [verseId];
  }

  throw new Error("Unsupported scope for verse runs.");
}

async function createRunItems(
  runId: string,
  targetType: RunTargetType,
  targetIds: number[]
) {
  if (targetIds.length === 0) {
    return;
  }

  const now = new Date();
  const items = targetIds.map((targetId) => ({
    runId,
    targetType,
    targetId,
    status: "pending",
    attempts: 0,
    updatedAt: now,
  }));

  await RunItemModel.insertMany(items);
}

async function executeRunItems(params: {
  runId: string;
  modelId: number;
  targetType: RunTargetType;
  targetIds: number[];
}) {
  const { runId, modelId, targetType, targetIds } = params;
  const model = await ModelModel.findOne({ modelId }).lean();
  if (!model) {
    throw new Error("Model not found.");
  }
  const modelProfile = await resolveModelOutputProfile(modelId);

  let success = 0;
  let failed = 0;
  let lastError: string | null = null;
  let lastErrorAt: Date | null = null;

  for (const targetId of targetIds) {
    const attemptTime = new Date();
    await RunItemModel.updateOne(
      { runId, targetType, targetId },
      {
        $set: {
          status: "running",
          updatedAt: attemptTime,
        },
        $inc: { attempts: 1 },
      }
    );

    try {
      if (targetType === "chapter") {
        const chapter = await ChapterModel.findOne({ chapterId: targetId }).lean();
        if (!chapter) {
          throw new Error("Chapter not found.");
        }

        const startTime = Date.now();
        const { responseRaw } = await generateModelResponse({
          targetType: "chapter",
          targetId,
          reference: chapter.reference,
          canonicalRaw: chapter.textRaw,
          canonicalProcessed: chapter.textProcessed,
          model,
        });
        const latencyMs = Date.now() - startTime;
        const responseProcessed = modelProfile
          ? applyTransformProfile(responseRaw, modelProfile)
          : responseRaw;
        const hashRaw = sha256(responseRaw);
        const hashProcessed = sha256(responseProcessed);
        const hashMatch = hashProcessed === chapter.hashProcessed;
        const { fidelityScore, diff } = compareText(
          chapter.textProcessed,
          responseProcessed
        );

        await ChapterResultModel.create({
          resultId: createResultId(),
          runId,
          modelId,
          chapterId: chapter.chapterId,
          responseRaw,
          responseProcessed,
          hashRaw,
          hashProcessed,
          hashMatch,
          fidelityScore,
          diff,
          latencyMs,
          audit: {
            createdAt: attemptTime,
            createdBy: "model_run",
          },
        });
      } else {
        const verse = await VerseModel.findOne({ verseId: targetId }).lean();
        if (!verse) {
          throw new Error("Verse not found.");
        }

        const startTime = Date.now();
        const { responseRaw } = await generateModelResponse({
          targetType: "verse",
          targetId,
          reference: verse.reference,
          canonicalRaw: verse.textRaw,
          canonicalProcessed: verse.textProcessed,
          model,
        });
        const latencyMs = Date.now() - startTime;
        const responseProcessed = modelProfile
          ? applyTransformProfile(responseRaw, modelProfile)
          : responseRaw;
        const hashRaw = sha256(responseRaw);
        const hashProcessed = sha256(responseProcessed);
        const hashMatch = hashProcessed === verse.hashProcessed;
        const { fidelityScore, diff } = compareText(
          verse.textProcessed,
          responseProcessed
        );

        await VerseResultModel.create({
          resultId: createResultId(),
          runId,
          modelId,
          verseId: verse.verseId,
          responseRaw,
          responseProcessed,
          hashRaw,
          hashProcessed,
          hashMatch,
          fidelityScore,
          diff,
          latencyMs,
          audit: {
            createdAt: attemptTime,
            createdBy: "model_run",
          },
        });
      }

      await RunItemModel.updateOne(
        { runId, targetType, targetId },
        {
          $set: {
            status: "success",
            lastError: null,
            updatedAt: new Date(),
          },
        }
      );
      success += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Run item failed.";
      lastError = message;
      lastErrorAt = new Date();
      await RunItemModel.updateOne(
        { runId, targetType, targetId },
        {
          $set: {
            status: "failed",
            lastError: message,
            updatedAt: new Date(),
          },
        }
      );
    }
  }

  return { success, failed, lastError, lastErrorAt };
}

function buildMetrics(
  targetType: RunTargetType,
  total: number,
  success: number,
  failed: number,
  durationMs?: number
) {
  const metrics: RunMetrics = {
    total,
    success,
    failed,
  };

  if (targetType === "chapter") {
    metrics.totalChapters = total;
  } else {
    metrics.totalVerses = total;
  }

  if (durationMs !== undefined) {
    metrics.durationMs = durationMs;
  }

  return metrics;
}

export async function startModelRun(params: StartRunParams): Promise<RunResult> {
  await connectToDatabase();

  const runId = params.runId ?? randomUUID();
  const existing = await RunModel.findOne({ runId }).lean();
  if (existing) {
    return {
      ok: true,
      data: {
        runId: existing.runId,
        runType: existing.runType as RunType,
        status: existing.status as RunStatus,
        metrics: (existing.metrics ?? {}) as RunMetrics,
      },
      idempotent: true,
    };
  }

  const model = await ModelModel.findOne({ modelId: params.modelId }).lean();
  if (!model) {
    return { ok: false, status: 404, error: "Model not found." };
  }

  const targetType: RunTargetType =
    params.runType === "MODEL_CHAPTER" ? "chapter" : "verse";
  const startedAt = new Date();
  const createdBy = params.createdBy ?? "admin";
  const { logs, log } = createRunLogger();
  log("run", "info", `Run ${runId} started.`);
  const scopeParams: Record<string, number> = {};
  if (params.limit !== undefined) {
    scopeParams.limit = params.limit;
  }
  if (params.skip !== undefined) {
    scopeParams.skip = params.skip;
  }

  await RunModel.create({
    runId,
    runType: params.runType,
    modelId: params.modelId,
    scope: params.scope,
    scopeIds: params.scopeIds,
    scopeParams: Object.keys(scopeParams).length === 0 ? {} : scopeParams,
    status: "running",
    startedAt,
    metrics: {},
    logs,
    errorSummary: null,
    audit: {
      createdAt: startedAt,
      createdBy,
    },
  });

  try {
    const resolvedIds = await resolveTargetIds(targetType, params.scope, params.scopeIds);
    const startIndex = params.skip ?? 0;
    const endIndex =
      params.limit !== undefined ? startIndex + params.limit : undefined;
    const targetIds = resolvedIds.slice(startIndex, endIndex);
    log("resolve_targets", "info", `Resolved ${targetIds.length} targets.`);

    await createRunItems(runId, targetType, targetIds);
    log("run_items", "info", `Created ${targetIds.length} run items.`);
    const { success, failed, lastError, lastErrorAt } = await executeRunItems({
      runId,
      modelId: params.modelId,
      targetType,
      targetIds,
    });
    const status: RunStatus = failed > 0 ? "failed" : "completed";
    const durationMs = Date.now() - startedAt.getTime();
    const metrics = buildMetrics(targetType, targetIds.length, success, failed, durationMs);
    const errorSummary: RunErrorSummary | null =
      failed > 0
        ? {
            failedCount: failed,
            lastError: lastError ?? null,
            lastErrorAt: lastErrorAt ?? null,
          }
        : null;

    log(
      "execute",
      failed > 0 ? "error" : "info",
      `Executed ${targetIds.length} items: ${success} succeeded, ${failed} failed.`
    );
    if (failed > 0 && lastError) {
      log("execute", "error", `Last error: ${lastError}`);
    }
    log("complete", status === "completed" ? "info" : "error", `Run ${status}.`);

    await RunModel.updateOne(
      { runId },
      {
        $set: {
          status,
          completedAt: new Date(),
          metrics,
          logs,
          errorSummary,
        },
      }
    );

    return {
      ok: true,
      data: {
        runId,
        runType: params.runType,
        status,
        metrics,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed.";
    const durationMs = Date.now() - startedAt.getTime();
    log("run", "error", message);
    log("complete", "error", "Run failed.");
    const errorSummary: RunErrorSummary = {
      failedCount: 0,
      lastError: message,
      lastErrorAt: new Date(),
    };
    await RunModel.updateOne(
      { runId },
      {
        $set: {
          status: "failed",
          completedAt: new Date(),
          metrics: { total: 0, success: 0, failed: 0, durationMs },
          logs,
          errorSummary,
        },
      }
    );

    return { ok: false, status: 400, error: message };
  }
}

export async function retryFailedRunItems(runId: string): Promise<RunResult> {
  await connectToDatabase();

  const run = await RunModel.findOne({ runId }).lean();
  if (!run) {
    return { ok: false, status: 404, error: "Run not found." };
  }

  const targetType: RunTargetType =
    run.runType === "MODEL_CHAPTER" ? "chapter" : "verse";
  const { logs, log } = createRunLogger(
    Array.isArray(run.logs) ? (run.logs as RunLogEntry[]) : undefined
  );
  const failedItems = await RunItemModel.find(
    { runId, targetType, status: "failed" },
    { targetId: 1 }
  ).lean();

  if (failedItems.length === 0) {
    return {
      ok: true,
      data: {
        runId: run.runId,
        runType: run.runType as RunType,
        status: run.status as RunStatus,
        metrics: (run.metrics ?? {}) as RunMetrics,
      },
    };
  }

  const retryStartedAt = new Date();
  await RunModel.updateOne(
    { runId },
    {
      $set: {
        status: "running",
      },
    }
  );

  const targetIds = failedItems.map((item) => item.targetId);
  log("retry", "info", `Retry started for ${targetIds.length} items.`);
  log("retry", "info", `Retrying ${targetIds.length} failed items.`);
  const { lastError, lastErrorAt } = await executeRunItems({
    runId,
    modelId: run.modelId as number,
    targetType,
    targetIds,
  });

  const total = await RunItemModel.countDocuments({ runId, targetType });
  const successCount = await RunItemModel.countDocuments({
    runId,
    targetType,
    status: "success",
  });
  const failedCount = total - successCount;
  const status: RunStatus = failedCount > 0 ? "failed" : "completed";
  const durationMs = Date.now() - retryStartedAt.getTime();
  const metrics = buildMetrics(targetType, total, successCount, failedCount, durationMs);
  const errorSummary: RunErrorSummary | null =
    failedCount > 0
      ? {
          failedCount,
          lastError: lastError ?? null,
          lastErrorAt: lastErrorAt ?? null,
        }
      : null;

  log(
    "retry",
    status === "completed" ? "info" : "error",
    `Retry completed: ${successCount} succeeded, ${failedCount} failed.`
  );
  if (failedCount > 0 && lastError) {
    log("retry", "error", `Last error: ${lastError}`);
  }

  await RunModel.updateOne(
    { runId },
    {
      $set: {
        status,
        completedAt: new Date(),
        metrics,
        logs,
        errorSummary,
      },
    }
  );

  return {
    ok: true,
    data: {
      runId,
      runType: run.runType as RunType,
      status,
      metrics,
    },
  };
}

export type { RunMetrics, RunScope, RunSummary, RunType };
