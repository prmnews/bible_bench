import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { ingestKjvChapters, transformChapters, transformVerses } from "@/lib/etl";
import { EtlRunModel, TransformProfileModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type EtlStage = "ingest" | "chapters" | "verses";

type EtlRunPayload = {
  runId?: string;
  stages?: EtlStage[];
  bibleId?: number;
  source?: string;
  filepath?: string;
  transformProfileId?: number;
  rawChapterIds?: number[];
  limit?: number;
  skip?: number;
  batchId?: string | null;
};

type ValidationResult =
  | { ok: true; data: Required<Pick<EtlRunPayload, "stages">> & EtlRunPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePayload(payload: unknown): ValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const runId = payload["runId"];
  if (runId !== undefined && (typeof runId !== "string" || runId.trim().length === 0)) {
    return { ok: false, error: "runId must be a non-empty string." };
  }

  const stagesValue = payload["stages"];
  const allowedStages: EtlStage[] = ["ingest", "chapters", "verses"];
  let stages: EtlStage[] = allowedStages;

  if (stagesValue !== undefined) {
    if (!Array.isArray(stagesValue)) {
      return { ok: false, error: "stages must be an array." };
    }

    if (stagesValue.length === 0) {
      return { ok: false, error: "stages must include at least one stage." };
    }

    const normalized = stagesValue.filter((stage) => typeof stage === "string");
    if (normalized.length !== stagesValue.length) {
      return { ok: false, error: "stages must be an array of strings." };
    }

    const invalid = normalized.filter((stage) => !allowedStages.includes(stage as EtlStage));
    if (invalid.length > 0) {
      return { ok: false, error: `Invalid stages: ${invalid.join(", ")}` };
    }

    stages = normalized as EtlStage[];
  }

  const bibleId = payload["bibleId"];
  if (bibleId !== undefined && !isNumber(bibleId)) {
    return { ok: false, error: "bibleId must be a number." };
  }

  const source = payload["source"];
  if (source !== undefined && (typeof source !== "string" || source.trim().length === 0)) {
    return { ok: false, error: "source must be a non-empty string." };
  }

  const filepath = payload["filepath"];
  if (filepath !== undefined && (typeof filepath !== "string" || filepath.trim().length === 0)) {
    return { ok: false, error: "filepath must be a non-empty string." };
  }

  const transformProfileId = payload["transformProfileId"];
  if (transformProfileId !== undefined && !isNumber(transformProfileId)) {
    return { ok: false, error: "transformProfileId must be a number." };
  }

  const rawChapterIds = payload["rawChapterIds"];
  if (rawChapterIds !== undefined) {
    if (!Array.isArray(rawChapterIds) || rawChapterIds.some((id) => !isNumber(id))) {
      return { ok: false, error: "rawChapterIds must be an array of numbers." };
    }
  }

  const limit = payload["limit"];
  if (limit !== undefined && !isNumber(limit)) {
    return { ok: false, error: "limit must be a number." };
  }

  const skip = payload["skip"];
  if (skip !== undefined && !isNumber(skip)) {
    return { ok: false, error: "skip must be a number." };
  }

  const batchIdValue = payload["batchId"];
  const batchId =
    batchIdValue === undefined || batchIdValue === null ? null : String(batchIdValue);

  if (
    stages.some((stage) => stage === "chapters" || stage === "verses") &&
    transformProfileId === undefined &&
    bibleId === undefined
  ) {
    return {
      ok: false,
      error: "bibleId is required when transformProfileId is not provided.",
    };
  }

  return {
    ok: true,
    data: {
      runId: typeof runId === "string" ? runId.trim() : undefined,
      stages,
      bibleId: bibleId as number | undefined,
      source: typeof source === "string" ? source.trim() : undefined,
      filepath: typeof filepath === "string" ? filepath.trim() : undefined,
      transformProfileId: transformProfileId as number | undefined,
      rawChapterIds: rawChapterIds as number[] | undefined,
      limit: limit as number | undefined,
      skip: skip as number | undefined,
      batchId,
    },
  };
}

async function resolveTransformProfileId(
  transformProfileId: number | undefined,
  bibleId: number | undefined
) {
  if (transformProfileId !== undefined) {
    return transformProfileId;
  }

  if (bibleId === undefined) {
    return null;
  }

  const profile = await TransformProfileModel.findOne({
    bibleId,
    scope: "canonical",
    isDefault: true,
    isActive: true,
  }).lean();

  return profile?.profileId ?? null;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  await connectToDatabase();

  const runId = validation.data.runId ?? randomUUID();
  const existing = await EtlRunModel.findOne({ runId }).lean();
  if (existing) {
    return NextResponse.json({ ok: true, data: existing.summary, idempotent: true });
  }

  const logs: Array<{ stage: string; level: string; message: string; timestamp: Date }> = [];
  const stageResults: Record<string, unknown> = {};
  const stageDurationsMs: Record<string, number> = {};
  const startedAt = new Date();

  const addLog = (stage: string, level: string, message: string) => {
    logs.push({ stage, level, message, timestamp: new Date() });
  };

  await EtlRunModel.create({
    runId,
    status: "running",
    startedAt,
    metrics: {},
    summary: { runId, ok: false, stages: {} },
    logs: [],
    audit: {
      createdAt: startedAt,
      createdBy: "admin",
    },
  });

  let overallOk = true;
  let rawChapterIds = validation.data.rawChapterIds;
  const bibleId = validation.data.bibleId;
  const ingestBibleId = validation.data.bibleId ?? 1001;
  const source = validation.data.source ?? "ABS";
  const stages = validation.data.stages;

  for (const stage of stages) {
    const stageStart = Date.now();
    if (!overallOk) {
      stageResults[stage] = { ok: false, skipped: true, reason: "Previous stage failed." };
      stageDurationsMs[stage] = Date.now() - stageStart;
      continue;
    }

    addLog(stage, "info", `Starting ${stage} stage.`);

    if (stage === "ingest") {
      const ingestResult = await ingestKjvChapters({
        bibleId: ingestBibleId,
        source,
        filepath: validation.data.filepath,
        limit: validation.data.limit,
        skip: validation.data.skip,
      });

      if (!ingestResult.ok) {
        overallOk = false;
        stageResults.ingest = { ok: false, error: ingestResult.error };
        addLog(stage, "error", ingestResult.error);
      } else {
        rawChapterIds = ingestResult.data.rawChapterIds;
        stageResults.ingest = {
          ok: true,
          ingested: ingestResult.data.ingested,
          rawChapterIds: ingestResult.data.rawChapterIds,
          warnings: ingestResult.data.warnings,
        };
        addLog(stage, "info", `Ingested ${ingestResult.data.ingested} chapters.`);
      }
    }

    if (stage === "chapters") {
      const profileId = await resolveTransformProfileId(
        validation.data.transformProfileId,
        bibleId
      );

      if (profileId === null) {
        overallOk = false;
        const message = "Transform profile not found for chapters stage.";
        stageResults.chapters = { ok: false, error: message };
        addLog(stage, "error", message);
        stageDurationsMs[stage] = Date.now() - stageStart;
        continue;
      }

      const chaptersResult = await transformChapters({
        transformProfileId: profileId,
        rawChapterIds,
        limit: validation.data.limit,
        skip: validation.data.skip,
        batchId: validation.data.batchId,
      });

      if (!chaptersResult.ok) {
        overallOk = false;
        stageResults.chapters = { ok: false, error: chaptersResult.error };
        addLog(stage, "error", chaptersResult.error);
      } else {
        stageResults.chapters = {
          ok: true,
          processed: chaptersResult.data.processed,
          chapterIds: chaptersResult.data.chapterIds,
        };
        addLog(stage, "info", `Transformed ${chaptersResult.data.processed} chapters.`);
      }
    }

    if (stage === "verses") {
      const profileId = await resolveTransformProfileId(
        validation.data.transformProfileId,
        bibleId
      );

      if (profileId === null) {
        overallOk = false;
        const message = "Transform profile not found for verses stage.";
        stageResults.verses = { ok: false, error: message };
        addLog(stage, "error", message);
        stageDurationsMs[stage] = Date.now() - stageStart;
        continue;
      }

      const versesResult = await transformVerses({
        transformProfileId: profileId,
        rawChapterIds,
        limit: validation.data.limit,
        skip: validation.data.skip,
        batchId: validation.data.batchId,
      });

      if (!versesResult.ok) {
        overallOk = false;
        stageResults.verses = { ok: false, error: versesResult.error };
        addLog(stage, "error", versesResult.error);
      } else {
        stageResults.verses = {
          ok: true,
          processed: versesResult.data.processed,
          verseIds: versesResult.data.verseIds,
        };
        addLog(stage, "info", `Transformed ${versesResult.data.processed} verses.`);
      }
    }

    stageDurationsMs[stage] = Date.now() - stageStart;
  }

  const completedAt = new Date();
  const summary = {
    runId,
    ok: overallOk,
    stages: stageResults,
  };
  const getStageMetric = (stage: string, key: string) => {
    const result = stageResults[stage];
    if (!isRecord(result)) {
      return 0;
    }
    const value = result[key];
    return isNumber(value) ? value : 0;
  };
  const metrics = {
    durationMs: completedAt.getTime() - startedAt.getTime(),
    ingestCount: getStageMetric("ingest", "ingested"),
    chapterCount: getStageMetric("chapters", "processed"),
    verseCount: getStageMetric("verses", "processed"),
    stageDurationsMs,
  };

  await EtlRunModel.updateOne(
    { runId },
    {
      $set: {
        status: overallOk ? "completed" : "failed",
        completedAt,
        summary,
        logs,
        metrics,
      },
    }
  );

  return NextResponse.json({ ok: overallOk, data: summary }, { status: overallOk ? 200 : 500 });
}
