import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { transformVerses } from "@/lib/etl";

type TransformVersesPayload = {
  transformProfileId: number;
  rawChapterIds?: number[];
  limit?: number;
  skip?: number;
  batchId?: string | null;
  forceAllVerses?: boolean;
};

type ValidationResult =
  | { ok: true; data: TransformVersesPayload }
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

  const transformProfileId = payload["transformProfileId"];
  if (!isNumber(transformProfileId)) {
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
    batchIdValue === undefined || batchIdValue === null
      ? null
      : String(batchIdValue);

  const forceAllVerses = payload["forceAllVerses"];
  if (forceAllVerses !== undefined && typeof forceAllVerses !== "boolean") {
    return { ok: false, error: "forceAllVerses must be a boolean." };
  }

  return {
    ok: true,
    data: {
      transformProfileId,
      rawChapterIds: rawChapterIds as number[] | undefined,
      limit: limit as number | undefined,
      skip: skip as number | undefined,
      batchId,
      forceAllVerses: forceAllVerses as boolean | undefined,
    },
  };
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

  const result = await transformVerses({
    transformProfileId: validation.data.transformProfileId,
    rawChapterIds: validation.data.rawChapterIds,
    limit: validation.data.limit,
    skip: validation.data.skip,
    batchId: validation.data.batchId,
    forceAllVerses: validation.data.forceAllVerses,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
