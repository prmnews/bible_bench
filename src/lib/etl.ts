import { promises as fs } from "fs";
import path from "path";

import { extractAbsVerses, flattenAbsText } from "@/lib/abs";
import { sha256 } from "@/lib/hash";
import { parseKjvFilename } from "@/lib/kjv-files";
import {
  CanonicalChapterModel,
  CanonicalRawChapterModel,
  CanonicalVerseModel,
  TransformProfileModel,
} from "@/lib/models";
import {
  connectToDatabase,
  ensureConnectionHealthy,
  retryMongoOperation,
} from "@/lib/mongodb";
import { applyTransformProfile } from "@/lib/transforms";

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function resolveIngestFolder(filepath?: string) {
  if (!filepath || filepath.trim().length === 0) {
    return path.join(process.cwd(), "bibles", "kjv-english");
  }

  const trimmed = filepath.trim();
  return path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed);
}

export type IngestKjvParams = {
  bibleId: number;
  source: string;
  limit?: number;
  skip?: number;
  filepath?: string;
};

export type IngestKjvResult = {
  ingested: number;
  rawChapterIds: number[];
  warnings: string[];
};

export async function ingestKjvChapters(
  params: IngestKjvParams
): Promise<Result<IngestKjvResult>> {
  const folder = resolveIngestFolder(params.filepath);
  let entries: string[];

  try {
    entries = (await fs.readdir(folder)).filter((file) => file.endsWith(".json")).sort();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      status: 400,
      error: `Unable to read ingest folder: ${message}`,
    };
  }

  const start = params.skip ?? 0;
  const end = params.limit ? start + params.limit : entries.length;
  const slice = entries.slice(start, end);

  if (slice.length === 0) {
    return { ok: true, data: { ingested: 0, rawChapterIds: [], warnings: [] } };
  }

  await connectToDatabase();
  const now = new Date();
  const rawChapterIds: number[] = [];
  const warnings: string[] = [];

  for (const file of slice) {
    const meta = parseKjvFilename(file);
    if (!meta) {
      warnings.push(`Skipping file with unrecognized name: ${file}`);
      continue;
    }

    const filePath = path.join(folder, file);
    const rawFile = await fs.readFile(filePath, "utf8");
    const rawPayload = JSON.parse(rawFile) as Record<string, unknown>;
    const hashRaw = sha256(JSON.stringify(rawPayload));
    const sourceHash = hashRaw;

    await CanonicalRawChapterModel.updateOne(
      { rawChapterId: meta.rawChapterId },
      {
        $set: {
          rawChapterId: meta.rawChapterId,
          bibleId: params.bibleId,
          bookId: meta.bookId,
          chapterNumber: meta.chapterNumber,
          reference: meta.reference,
          rawPayload,
          hashRaw,
          sourceHash,
          source: params.source,
          sourceRef: file,
          ingestedAt: now,
          ingestedBy: "kjv_ingest",
        },
        $setOnInsert: {
          audit: {
            createdAt: now,
            createdBy: "raw_ingest",
          },
        },
      },
      { upsert: true }
    );

    rawChapterIds.push(meta.rawChapterId);
  }

  return {
    ok: true,
    data: {
      ingested: rawChapterIds.length,
      rawChapterIds,
      warnings,
    },
  };
}

export type TransformChaptersParams = {
  transformProfileId: number;
  rawChapterIds?: number[];
  limit?: number;
  skip?: number;
  batchId?: string | null;
};

export type TransformChaptersResult = {
  processed: number;
  chapterIds: number[];
};

export async function transformChapters(
  params: TransformChaptersParams
): Promise<Result<TransformChaptersResult>> {
  await connectToDatabase();

  const profile = await TransformProfileModel.findOne({
    profileId: params.transformProfileId,
    isActive: true,
  }).lean();

  if (!profile) {
    return { ok: false, status: 404, error: "Transform profile not found." };
  }

  let query = CanonicalRawChapterModel.find(
    params.rawChapterIds && params.rawChapterIds.length > 0
      ? { rawChapterId: { $in: params.rawChapterIds } }
      : {}
  ).sort({ rawChapterId: 1 });

  if (params.skip !== undefined) {
    query = query.skip(params.skip);
  }

  if (params.limit !== undefined) {
    query = query.limit(params.limit);
  }

  const rawChapters = await query.lean();
  if (rawChapters.length === 0) {
    return { ok: true, data: { processed: 0, chapterIds: [] } };
  }

  const now = new Date();
  const chapterIds: number[] = [];

  for (const rawChapter of rawChapters) {
    // Build chapter text from verse boundaries so UI uses [n] formatting.
    const verseParts: string[] = [];
    const verses = extractAbsVerses(rawChapter.rawPayload);
    for (const verse of verses) {
      const verseNumber = parseVerseNumber(verse.verseId);
      if (verseNumber === null) {
        continue;
      }

      const verseText = verse.textRaw.replace(/^\s*\d+\s*/, "");
      if (verseText.trim().length === 0) {
        continue;
      }

      verseParts.push(`[${verseNumber}] ${verseText}`);
    }

    const textRaw =
      verseParts.length > 0
        ? verseParts.join(" ")
        : flattenAbsText(rawChapter.rawPayload);
    const textProcessed = applyTransformProfile(textRaw, profile);
    const hashRaw = sha256(textRaw);
    const hashProcessed = sha256(textProcessed);

    const chapterId = rawChapter.rawChapterId;
    chapterIds.push(chapterId);

    await CanonicalChapterModel.updateOne(
      { chapterId },
      {
        $set: {
          chapterId,
          bibleId: rawChapter.bibleId,
          bookId: rawChapter.bookId,
          chapterNumber: rawChapter.chapterNumber,
          reference: rawChapter.reference,
          textRaw,
          textProcessed,
          hashRaw,
          hashProcessed,
          rawChapterId: rawChapter.rawChapterId,
          transformProfileId: params.transformProfileId,
          etlControl: {
            stage: "chapters",
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            lastProcessedBy: "chapter_transform",
            lastProcessedAt: now,
            batchId: params.batchId ?? null,
          },
          audit: {
            createdAt: now,
            createdBy: "chapter_transform",
          },
        },
      },
      { upsert: true }
    );
  }

  return { ok: true, data: { processed: chapterIds.length, chapterIds } };
}

export type TransformVersesParams = {
  transformProfileId: number;
  rawChapterIds?: number[];
  chapterIds?: number[];
  limit?: number;
  skip?: number;
  batchId?: string | null;
  forceAllVerses?: boolean;
};

export type TransformVersesResult = {
  processed: number;
  verseIds: number[];
};
export function parseVerseNumber(verseId: string) {
  const match = verseId.match(/(\d+)\s*$/);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

export function buildReference(
  reference: unknown,
  bookId: number,
  chapterNumber: number,
  verseNumber: number
) {
  const base = typeof reference === "string" ? reference.trim() : "";
  if (base.length > 0) {
    return `${base}:${verseNumber}`;
  }

  return `${bookId} ${chapterNumber}:${verseNumber}`;
}

export async function transformVerses(
  params: TransformVersesParams
): Promise<Result<TransformVersesResult>> {
  await connectToDatabase();

  const profile = await retryMongoOperation(
    () =>
      TransformProfileModel.findOne({
        profileId: params.transformProfileId,
        scope: "canonical",
        isActive: true,
      }).lean(),
    {
      maxRetries: 3,
      onRetry: (attempt, error) => {
        console.log(
          `[transformVerses] Retry ${attempt} fetching transform profile:`,
          error.message
        );
      },
    }
  );

  if (!profile) {
    return { ok: false, status: 404, error: "Transform profile not found." };
  }

  const chapterIds = params.rawChapterIds ?? params.chapterIds;
  let query = CanonicalRawChapterModel.find(
    chapterIds && chapterIds.length > 0
      ? { rawChapterId: { $in: chapterIds } }
      : {}
  ).sort({ rawChapterId: 1 });

  if (params.skip !== undefined) {
    query = query.skip(params.skip);
  }

  if (params.limit !== undefined) {
    query = query.limit(params.limit);
  }

  const rawChapters = await retryMongoOperation(
    () => query.lean(),
    {
      maxRetries: 3,
      onRetry: (attempt, error) => {
        console.log(
          `[transformVerses] Retry ${attempt} fetching raw chapters:`,
          error.message
        );
      },
    }
  );

  if (rawChapters.length === 0) {
    return { ok: true, data: { processed: 0, verseIds: [] } };
  }

  const forceAllVerses = params.forceAllVerses ?? false;
  let existingVerseIds = new Set<number>();

  if (!forceAllVerses) {
    const bibleIds = Array.from(new Set(rawChapters.map((chapter) => chapter.bibleId)));

    if (bibleIds.length > 0) {
      const existingVerses = await retryMongoOperation(
        () =>
          CanonicalVerseModel.find(
            {
              transformProfileId: params.transformProfileId,
              bibleId: { $in: bibleIds },
            },
            { verseId: 1 }
          ).lean(),
        {
          maxRetries: 3,
          onRetry: (attempt, error) => {
            console.log(
              `[transformVerses] Retry ${attempt} fetching existing verses:`,
              error.message
            );
          },
        }
      );

      existingVerseIds = new Set(existingVerses.map((verse) => verse.verseId));
    }
  }

  const now = new Date();
  const verseIds: number[] = [];
  
  // Batch size for bulk operations (process in chunks to avoid memory issues)
  const BATCH_SIZE = 500;
  let processedCount = 0;
  let lastHealthCheck = Date.now();
  const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

  // Collect all verse operations
  const verseOperations: Array<{
    verseId: number;
    update: Record<string, unknown>;
  }> = [];

  for (const rawChapter of rawChapters) {
    const verses = extractAbsVerses(rawChapter.rawPayload);

    for (const verse of verses) {
      const verseNumber = parseVerseNumber(verse.verseId);
      if (verseNumber === null) {
        continue;
      }

      const verseId =
        rawChapter.bookId * 100000 +
        rawChapter.chapterNumber * 1000 +
        verseNumber;
      if (!forceAllVerses && existingVerseIds.has(verseId)) {
        continue;
      }
      const textRaw = verse.textRaw;
      const textProcessed = applyTransformProfile(textRaw, profile);
      const hashRaw = sha256(textRaw);
      const hashProcessed = sha256(textProcessed);
      const reference = buildReference(
        rawChapter.reference,
        rawChapter.bookId,
        rawChapter.chapterNumber,
        verseNumber
      );

      verseIds.push(verseId);

      verseOperations.push({
        verseId,
        update: {
          $set: {
            verseId,
            chapterId: rawChapter.rawChapterId,
            bibleId: rawChapter.bibleId,
            bookId: rawChapter.bookId,
            chapterNumber: rawChapter.chapterNumber,
            verseNumber,
            reference,
            textRaw,
            textProcessed,
            hashRaw,
            hashProcessed,
            offsetStart: verse.startOffset,
            offsetEnd: verse.endOffset,
            transformProfileId: params.transformProfileId,
            etlControl: {
              stage: "verses",
              isLocked: false,
              lockedBy: null,
              lockedAt: null,
              lastProcessedBy: "verse_transform",
              lastProcessedAt: now,
              batchId: params.batchId ?? null,
            },
            audit: {
              createdAt: now,
              createdBy: "verse_transform",
            },
          },
        },
      });

      // Process in batches
      if (verseOperations.length >= BATCH_SIZE) {
        await processVerseBatch(verseOperations, processedCount);
        processedCount += verseOperations.length;
        verseOperations.length = 0; // Clear array

        // Periodic connection health check
        const nowMs = Date.now();
        if (nowMs - lastHealthCheck >= HEALTH_CHECK_INTERVAL_MS) {
          await ensureConnectionHealthy();
          lastHealthCheck = nowMs;
          console.log(
            `[transformVerses] Processed ${processedCount} verses, connection health checked`
          );
        }
      }
    }
  }

  // Process remaining verses
  if (verseOperations.length > 0) {
    await processVerseBatch(verseOperations, processedCount);
  }

  return { ok: true, data: { processed: verseIds.length, verseIds } };
}

/**
 * Process a batch of verse updates using bulk operations with retry logic
 */
async function processVerseBatch(
  operations: Array<{ verseId: number; update: Record<string, unknown> }>,
  offset: number
): Promise<void> {
  await retryMongoOperation(
    async () => {
      const bulkOps = operations.map((op) => ({
        updateOne: {
          filter: { verseId: op.verseId },
          update: op.update,
          upsert: true,
        },
      }));

      await CanonicalVerseModel.bulkWrite(bulkOps, { ordered: false });
    },
    {
      maxRetries: 5,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
      onRetry: (attempt, error) => {
        console.log(
          `[transformVerses] Retry ${attempt} processing batch (offset ${offset}, size ${operations.length}):`,
          error.message
        );
      },
    }
  );
}

export type { Result };
