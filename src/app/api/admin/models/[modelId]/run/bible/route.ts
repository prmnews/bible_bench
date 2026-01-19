import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { startModelRun } from "@/lib/model-runs";

type RunBiblePayload = {
  runId?: string;
  bibleId?: number;
  limit?: number;
  skip?: number;
};

type ValidationResult =
  | { ok: true; data: Required<Pick<RunBiblePayload, "bibleId">> & RunBiblePayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePayload(payload: unknown): ValidationResult {
  if (payload === undefined || payload === null) {
    return { ok: true, data: { bibleId: 1001 } };
  }

  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const runId = payload["runId"];
  if (runId !== undefined && (typeof runId !== "string" || runId.trim().length === 0)) {
    return { ok: false, error: "runId must be a non-empty string." };
  }

  const bibleId = payload["bibleId"];
  if (bibleId !== undefined && !isNumber(bibleId)) {
    return { ok: false, error: "bibleId must be a number." };
  }

  const limit = payload["limit"];
  if (limit !== undefined && (!isNumber(limit) || limit < 0)) {
    return { ok: false, error: "limit must be a number." };
  }

  const skip = payload["skip"];
  if (skip !== undefined && (!isNumber(skip) || skip < 0)) {
    return { ok: false, error: "skip must be a number." };
  }

  return {
    ok: true,
    data: {
      runId: typeof runId === "string" ? runId.trim() : undefined,
      bibleId: (bibleId as number | undefined) ?? 1001,
      limit: limit as number | undefined,
      skip: skip as number | undefined,
    },
  };
}

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { modelId: string } }
) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const modelId = Number(params.modelId);
  if (!Number.isFinite(modelId)) {
    return NextResponse.json({ ok: false, error: "modelId must be a number." }, { status: 400 });
  }

  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const result = await startModelRun({
    runId: validation.data.runId,
    modelId,
    runType: "MODEL_CHAPTER",
    scope: "bible",
    scopeIds: { bibleId: validation.data.bibleId },
    limit: validation.data.limit,
    skip: validation.data.skip,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: result.data.status === "completed",
    data: result.data,
    idempotent: result.idempotent ?? false,
  });
}
