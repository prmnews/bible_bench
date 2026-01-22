import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";
import { isAdminAvailable } from "@/lib/admin";
import {
  buildChapterTitleMap,
  formatChapterTitleKey,
  loadChapterTitleEntries,
} from "@/lib/chapter-titles";
import { parseKjvFilename } from "@/lib/kjv-files";
import {
  CanonicalBibleModel,
  CanonicalBookModel,
  CanonicalRawChapterModel,
  CanonicalVerseModel,
  CanonicalLanguageModel,
  DimBibleModel,
  DimBookModel,
  DimChapterModel,
  DimLanguageModel,
  TransformProfileModel,
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type SeedResult = {
  languages: { created: number; existing: number };
  bibles: { created: number; existing: number };
  books: { created: number; existing: number };
  transformProfiles: { created: number; existing: number };
  chapters: { created: number; existing: number; skipped: number };
};

async function seedLanguages(): Promise<{ created: number; existing: number }> {
  const now = new Date();
  const existing = await CanonicalLanguageModel.findOne({ languageId: 1 }).lean();
  if (!existing) {
    await CanonicalLanguageModel.create({
      languageId: 1,
      isoCode: "en",
      name: "English",
      audit: {
        createdAt: now,
        createdBy: "seed",
      },
    });
  }

  await DimLanguageModel.updateOne(
    { languageId: 1 },
    {
      $set: {
        languageId: 1,
        isoCode: "en",
        name: "English",
      },
      $setOnInsert: {
        audit: {
          createdAt: now,
          createdBy: "seed",
        },
      },
    },
    { upsert: true }
  );

  if (existing) {
    return { created: 0, existing: 1 };
  }

  return { created: 1, existing: 0 };
}

async function seedBibles(): Promise<{ created: number; existing: number }> {
  const now = new Date();
  const existing = await CanonicalBibleModel.findOne({ bibleId: 1001 }).lean();
  if (!existing) {
    await CanonicalBibleModel.create({
      bibleId: 1001,
      apiBibleId: "de4e12af7f28f599-02",
      languageId: 1,
      name: "King James Version",
      source: "ABS",
      audit: {
        createdAt: now,
        createdBy: "seed",
      },
    });
  }

  await DimBibleModel.updateOne(
    { bibleId: 1001 },
    {
      $set: {
        bibleId: 1001,
        apiBibleId: "de4e12af7f28f599-02",
        languageId: 1,
        name: "King James Version",
        source: "ABS",
      },
      $setOnInsert: {
        audit: {
          createdAt: now,
          createdBy: "seed",
        },
      },
    },
    { upsert: true }
  );

  if (existing) {
    return { created: 0, existing: 1 };
  }

  return { created: 1, existing: 0 };
}

async function seedBooks(): Promise<{ created: number; existing: number }> {
  const folder = path.join(process.cwd(), "bibles", "kjv-english");
  const files = await fs.readdir(folder);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  const bookMap = new Map<
    number,
    { bookCode: string; bookName: string; bookIndex: number }
  >();

  for (const file of jsonFiles) {
    const meta = parseKjvFilename(file);
    if (!meta) continue;

    if (!bookMap.has(meta.bookId)) {
      bookMap.set(meta.bookId, {
        bookCode: meta.bookCode,
        bookName: meta.bookName,
        bookIndex: meta.bookNumber,
      });
    }
  }

  const now = new Date();
  let created = 0;
  let existing = 0;

  for (const [bookId, info] of bookMap) {
    const existingBook = await CanonicalBookModel.findOne({ bookId }).lean();
    if (existingBook) {
      existing++;
    } else {
      await CanonicalBookModel.create({
        bookId,
        bibleId: 1001,
        bookCode: info.bookCode,
        bookName: info.bookName,
        bookIndex: info.bookIndex,
        audit: {
          createdAt: now,
          createdBy: "seed",
        },
      });
      created++;
    }

    await DimBookModel.updateOne(
      { bookId },
      {
        $set: {
          bookId,
          bibleId: 1001,
          bookCode: info.bookCode,
          bookName: info.bookName,
          bookIndex: info.bookIndex,
        },
        $setOnInsert: {
          audit: {
            createdAt: now,
            createdBy: "seed",
          },
        },
      },
      { upsert: true }
    );
  }

  return { created, existing };
}

async function seedTransformProfiles(): Promise<{
  created: number;
  existing: number;
}> {
  const now = new Date();
  let created = 0;
  let existing = 0;

  // Canonical profile for ETL processing
  const canonicalProfile = await TransformProfileModel.findOne({
    profileId: 1,
  }).lean();
  if (!canonicalProfile) {
    await TransformProfileModel.create({
      profileId: 1,
      name: "KJV_CANONICAL_V1",
      scope: "canonical",
      version: 1,
      bibleId: 1001,
      isDefault: true,
      description: "Default canonical transform profile for KJV Bible text",
      steps: [
        {
          order: 1,
          type: "stripMarkupTags",
          enabled: true,
          params: {
            tagNames: [
              "wj",
              "add",
              "verse-span",
              "para",
              "char",
              "verse",
              "chapter",
            ],
          },
        },
        {
          order: 2,
          type: "stripParagraphMarkers",
          enabled: true,
          params: { markers: ["\u00b6"] },
        },
        {
          order: 3,
          type: "stripVerseNumbers",
          enabled: true,
          params: { patterns: ["^\\d+\\s*"] },
        },
        {
          order: 4,
          type: "collapseWhitespace",
          enabled: true,
          params: {},
        },
        {
          order: 5,
          type: "trim",
          enabled: true,
          params: {},
        },
      ],
      isActive: true,
      audit: {
        createdAt: now,
        createdBy: "seed",
      },
    });
    created++;
  } else {
    existing++;
  }

  // Model output profile for normalizing LLM responses
  const modelProfile = await TransformProfileModel.findOne({
    profileId: 2,
  }).lean();
  if (!modelProfile) {
    await TransformProfileModel.create({
      profileId: 2,
      name: "MODEL_OUTPUT_V1",
      scope: "model_output",
      version: 1,
      bibleId: 1001,
      isDefault: true,
      description: "Default transform profile for model output normalization",
      steps: [
        {
          order: 1,
          type: "collapseWhitespace",
          enabled: true,
          params: {},
        },
        {
          order: 2,
          type: "trim",
          enabled: true,
          params: {},
        },
      ],
      isActive: true,
      audit: {
        createdAt: now,
        createdBy: "seed",
      },
    });
    created++;
  } else {
    existing++;
  }

  return { created, existing };
}

async function seedChapters(): Promise<{
  created: number;
  existing: number;
  skipped: number;
}> {
  const { entries, warnings: parseWarnings } = await loadChapterTitleEntries({
    defaultBibleId: 1001,
  });
  const { map: titleMap, warnings: mapWarnings } = buildChapterTitleMap(entries);

  for (const warning of parseWarnings) {
    console.warn(warning);
  }
  for (const warning of mapWarnings) {
    console.warn(warning);
  }

  // Get all chapters from canonical raw ingest (order-safe)
  const chapters = await CanonicalRawChapterModel.find(
    {},
    { rawChapterId: 1, bibleId: 1, bookId: 1, chapterNumber: 1, reference: 1 }
  )
    .sort({ bibleId: 1, bookId: 1, chapterNumber: 1 })
    .lean();

  if (chapters.length === 0) {
    console.log(
      "[seedChapters] No chapters found in canonical raw collection. Skipping."
    );
    return { created: 0, existing: 0, skipped: 0 };
  }

  const bibleIds = Array.from(new Set(chapters.map((ch) => ch.bibleId)));
  const books = await CanonicalBookModel.find(
    { bibleId: { $in: bibleIds } },
    { bibleId: 1, bookId: 1, bookCode: 1, bookName: 1 }
  ).lean();

  const bookMetaMap = new Map<string, { bookCode: string; bookName: string }>();
  for (const book of books) {
    bookMetaMap.set(`${book.bibleId}:${book.bookId}`, {
      bookCode: book.bookCode,
      bookName: book.bookName,
    });
  }

  // Query verse counts from canonical verses collection
  const verseCounts = new Map<number, number>();
  const verseCountAgg = await CanonicalVerseModel.aggregate([
    { $match: { bibleId: { $in: bibleIds } } },
    {
      $group: {
        _id: "$chapterId",
        verseCount: { $sum: 1 },
      },
    },
  ]);
  for (const agg of verseCountAgg) {
    verseCounts.set(
      (agg._id as number) ?? 0,
      (agg.verseCount as number) ?? 0
    );
  }

  const chapterIds = chapters.map((ch) => ch.rawChapterId);
  const existingChapters = await DimChapterModel.find(
    { chapterId: { $in: chapterIds } },
    { chapterId: 1 }
  ).lean();
  const existingSet = new Set(existingChapters.map((ch) => ch.chapterId));

  const now = new Date();
  let created = 0;
  const existing = existingChapters.length;
  const skipped = 0;
  let missingTitles = 0;

  for (const ch of chapters) {
    if (existingSet.has(ch.rawChapterId)) {
      continue;
    }

    const bookKey = `${ch.bibleId}:${ch.bookId}`;
    const bookMeta = bookMetaMap.get(bookKey);
    const bookName = bookMeta?.bookName ?? `Book ${ch.bookId}`;
    const bookCode = bookMeta?.bookCode ?? "";

    let chapterName = `${bookName} ${ch.chapterNumber}`;
    if (bookCode) {
      const titleKey = formatChapterTitleKey(
        ch.bibleId,
        bookCode,
        ch.chapterNumber
      );
      const title = titleMap.get(titleKey);
      if (!title) {
        missingTitles++;
        console.warn(`[seedChapters] Missing title for ${titleKey}.`);
      } else {
        chapterName = title;
      }
    } else {
      missingTitles++;
      console.warn(
        `[seedChapters] Missing book code for bibleId ${ch.bibleId}, bookId ${ch.bookId}.`
      );
    }

    const verseCount = verseCounts.get(ch.rawChapterId) ?? 0;

    await DimChapterModel.create({
      chapterId: ch.rawChapterId,
      bibleId: ch.bibleId,
      bookId: ch.bookId,
      chapterNumber: ch.chapterNumber,
      reference: ch.reference,
      chapterName,
      verseCount,
      audit: {
        createdAt: now,
        createdBy: "seed",
      },
    });
    created++;
  }

  if (missingTitles > 0) {
    console.warn(`[seedChapters] Missing chapter titles: ${missingTitles}.`);
  }

  return { created, existing, skipped };
}

export async function POST() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  await connectToDatabase();

  try {
    console.log("[seed] Starting seedLanguages...");
    const languages = await seedLanguages();
    console.log("[seed] Languages:", languages);

    console.log("[seed] Starting seedBibles...");
    const bibles = await seedBibles();
    console.log("[seed] Bibles:", bibles);

    console.log("[seed] Starting seedBooks...");
    const books = await seedBooks();
    console.log("[seed] Books:", books);

    console.log("[seed] Starting seedTransformProfiles...");
    const transformProfiles = await seedTransformProfiles();
    console.log("[seed] TransformProfiles:", transformProfiles);

    console.log("[seed] Starting seedChapters...");
    const chapters = await seedChapters();
    console.log("[seed] Chapters:", chapters);

    const result: SeedResult = {
      languages,
      bibles,
      books,
      transformProfiles,
      chapters,
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("[seed] Error:", error);
    // Log MongoDB validation error details if available
    if (error && typeof error === "object" && "errInfo" in error) {
      console.error("[seed] Validation errInfo:", JSON.stringify((error as { errInfo: unknown }).errInfo, null, 2));
    }
    const message = error instanceof Error ? error.message : "Seed failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
