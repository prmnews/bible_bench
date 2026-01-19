import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { ingestKjvChapters } from "@/lib/etl";

type IngestKjvPayload = {
  bibleId?: number;
  source?: string;
  limit?: number;
  skip?: number;
};

type ValidationResult =
  | { ok: true; data: Required<Pick<IngestKjvPayload, "bibleId" | "source">> & IngestKjvPayload }
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

  const bibleId = payload["bibleId"];
  if (bibleId !== undefined && !isNumber(bibleId)) {
    return { ok: false, error: "bibleId must be a number." };
  }

  const limit = payload["limit"];
  if (limit !== undefined && !isNumber(limit)) {
    return { ok: false, error: "limit must be a number." };
  }

  const skip = payload["skip"];
  if (skip !== undefined && !isNumber(skip)) {
    return { ok: false, error: "skip must be a number." };
  }

  const source = payload["source"];
  const sourceValue = typeof source === "string" && source.trim().length > 0 ? source : "ABS";

  return {
    ok: true,
    data: {
      bibleId: bibleId ?? 1001,
      source: sourceValue,
      limit: limit as number | undefined,
      skip: skip as number | undefined,
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

  const result = await ingestKjvChapters({
    bibleId: validation.data.bibleId,
    source: validation.data.source,
    limit: validation.data.limit,
    skip: validation.data.skip,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: { ingested: result.data.ingested } });
}
