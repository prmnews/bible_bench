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

type RunMetrics = {
  total: number;
  success: number;
  failed: number;
  totalChapters?: number;
  totalVerses?: number;
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

  return { success, failed };
}

function buildMetrics(targetType: RunTargetType, total: number, success: number, failed: number) {
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

    await createRunItems(runId, targetType, targetIds);
    const { success, failed } = await executeRunItems({
      runId,
      modelId: params.modelId,
      targetType,
      targetIds,
    });
    const status: RunStatus = failed > 0 ? "failed" : "completed";
    const metrics = buildMetrics(targetType, targetIds.length, success, failed);

    await RunModel.updateOne(
      { runId },
      {
        $set: {
          status,
          completedAt: new Date(),
          metrics,
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
    await RunModel.updateOne(
      { runId },
      {
        $set: {
          status: "failed",
          completedAt: new Date(),
          metrics: { total: 0, success: 0, failed: 0 },
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

  await RunModel.updateOne(
    { runId },
    {
      $set: {
        status: "running",
      },
    }
  );

  const targetIds = failedItems.map((item) => item.targetId);
  await executeRunItems({
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
  const metrics = buildMetrics(targetType, total, successCount, failedCount);

  await RunModel.updateOne(
    { runId },
    {
      $set: {
        status,
        completedAt: new Date(),
        metrics,
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
