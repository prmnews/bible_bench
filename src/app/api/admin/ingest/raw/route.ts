import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { CanonicalRawChapterModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type RawChapterIngestPayload = {
  rawChapterId: number;
  bibleId: number;
  bookId: number;
  chapterNumber: number;
  reference: string;
  sourceRef?: string;
  rawPayload: Record<string, unknown>;
  hashRaw: string;
  source: string;
};

type ValidationResult =
  | { ok: true; data: RawChapterIngestPayload }
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

  const rawChapterId = payload["rawChapterId"];
  if (!isNumber(rawChapterId)) {
    return { ok: false, error: "rawChapterId must be a number." };
  }

  const bibleId = payload["bibleId"];
  if (!isNumber(bibleId)) {
    return { ok: false, error: "bibleId must be a number." };
  }

  const bookId = payload["bookId"];
  if (!isNumber(bookId)) {
    return { ok: false, error: "bookId must be a number." };
  }

  const chapterNumber = payload["chapterNumber"];
  if (!isNumber(chapterNumber)) {
    return { ok: false, error: "chapterNumber must be a number." };
  }

  const reference = payload["reference"];
  if (typeof reference !== "string" || reference.trim().length === 0) {
    return { ok: false, error: "reference must be a non-empty string." };
  }

  const sourceRef = payload["sourceRef"];
  if (sourceRef !== undefined && typeof sourceRef !== "string") {
    return { ok: false, error: "sourceRef must be a string." };
  }

  const rawPayload = payload["rawPayload"];
  if (!isRecord(rawPayload)) {
    return { ok: false, error: "rawPayload must be a JSON object." };
  }

  const hashRaw = payload["hashRaw"];
  if (typeof hashRaw !== "string" || hashRaw.trim().length === 0) {
    return { ok: false, error: "hashRaw must be a non-empty string." };
  }

  const source = payload["source"];
  if (typeof source !== "string" || source.trim().length === 0) {
    return { ok: false, error: "source must be a non-empty string." };
  }

  return {
    ok: true,
    data: {
      rawChapterId,
      bibleId,
      bookId,
      chapterNumber,
      reference,
      sourceRef: typeof sourceRef === "string" && sourceRef.trim().length > 0
        ? sourceRef.trim()
        : undefined,
      rawPayload,
      hashRaw,
      source,
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

  await connectToDatabase();

  try {
    const now = new Date();
    const createdBy = "raw_ingest";
    const sourceHash = validation.data.hashRaw;

    const updateSet: Record<string, unknown> = {
      rawChapterId: validation.data.rawChapterId,
      bibleId: validation.data.bibleId,
      bookId: validation.data.bookId,
      chapterNumber: validation.data.chapterNumber,
      reference: validation.data.reference,
      rawPayload: validation.data.rawPayload,
      hashRaw: validation.data.hashRaw,
      source: validation.data.source,
      sourceHash,
      ingestedAt: now,
      ingestedBy: createdBy,
    };

    if (validation.data.sourceRef !== undefined) {
      updateSet.sourceRef = validation.data.sourceRef;
    }

    const result = await CanonicalRawChapterModel.updateOne(
      { rawChapterId: validation.data.rawChapterId },
      {
        $set: updateSet,
        $setOnInsert: {
          audit: {
            createdAt: now,
            createdBy,
          },
        },
      },
      { upsert: true }
    );

    const created = result.upsertedCount > 0;
    return NextResponse.json(
      { ok: true, data: { rawChapterId: validation.data.rawChapterId, created } },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to ingest raw chapter.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
