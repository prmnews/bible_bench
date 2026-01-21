import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";
import OpenAI from "openai";

import { isAdminAvailable } from "@/lib/admin";
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

/**
 * Generate chapter names using LLM.
 * Batches by book for efficiency and progress tracking.
 */
async function generateChapterNamesForBook(
  bookName: string,
  chapters: Array<{ chapterNumber: number; reference: string }>
): Promise<Map<number, string>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Return default names if no API key available
    const result = new Map<number, string>();
    for (const ch of chapters) {
      result.set(ch.chapterNumber, `${bookName} ${ch.chapterNumber}`);
    }
    return result;
  }

  const client = new OpenAI({ apiKey });
  const references = chapters.map((ch) => ch.reference).join(", ");

  const prompt = `For each chapter below from the King James Bible, provide a short descriptive title (2-5 words) that captures the main theme or event.

Chapters: ${references}

Examples of good titles:
- Genesis 1 = "The Creation"
- Genesis 3 = "The Fall of Man"
- Exodus 20 = "The Ten Commandments"
- Psalm 23 = "The Lord is My Shepherd"
- John 3 = "Nicodemus and New Birth"

Return as JSON array of objects with "chapterNumber" and "title" fields:
[
  { "chapterNumber": 1, "title": "..." },
  { "chapterNumber": 2, "title": "..." }
]`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a biblical scholar. Provide concise, descriptive chapter titles. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as
      | { chapters?: Array<{ chapterNumber: number; title: string }> }
      | Array<{ chapterNumber: number; title: string }>;

    const chaptersArray = Array.isArray(parsed)
      ? parsed
      : (parsed.chapters ?? []);

    const result = new Map<number, string>();
    for (const item of chaptersArray) {
      if (
        typeof item.chapterNumber === "number" &&
        typeof item.title === "string"
      ) {
        result.set(item.chapterNumber, item.title.trim());
      }
    }

    // Fill in any missing chapters with default names
    for (const ch of chapters) {
      if (!result.has(ch.chapterNumber)) {
        result.set(ch.chapterNumber, `${bookName} ${ch.chapterNumber}`);
      }
    }

    return result;
  } catch (error) {
    console.error(`[seedChapters] LLM error for ${bookName}:`, error);
    // Return default names on error
    const result = new Map<number, string>();
    for (const ch of chapters) {
      result.set(ch.chapterNumber, `${bookName} ${ch.chapterNumber}`);
    }
    return result;
  }
}

async function seedChapters(): Promise<{
  created: number;
  existing: number;
  skipped: number;
}> {
  // Get all chapters from canonical raw ingest (order-safe)
  const chapters = await CanonicalRawChapterModel.find(
    { bibleId: 1001 },
    { rawChapterId: 1, bookId: 1, chapterNumber: 1, reference: 1 }
  )
    .sort({ bookId: 1, chapterNumber: 1 })
    .lean();

  if (chapters.length === 0) {
    console.log(
      "[seedChapters] No chapters found in canonical raw collection. Skipping."
    );
    return { created: 0, existing: 0, skipped: 0 };
  }

  // Group chapters by book
  const chaptersByBook = new Map<
    number,
    Array<{ chapterId: number; chapterNumber: number; reference: string }>
  >();
  for (const ch of chapters) {
    const bookChapters = chaptersByBook.get(ch.bookId) ?? [];
    bookChapters.push({
      chapterId: ch.rawChapterId,
      chapterNumber: ch.chapterNumber,
      reference: ch.reference,
    });
    chaptersByBook.set(ch.bookId, bookChapters);
  }

  // Get book names
  const books = await CanonicalBookModel.find(
    { bibleId: 1001 },
    { bookId: 1, bookName: 1 }
  ).lean();
  const bookNameMap = new Map<number, string>();
  for (const book of books) {
    bookNameMap.set(book.bookId, book.bookName);
  }

  // Get verse counts for each chapter
  const verseCounts = new Map<number, number>();
  for (const ch of chapters) {
    // Count verses in each chapter from the reference or query verses
    // For now, we'll query at runtime or set default
    verseCounts.set(ch.chapterId, 0);
  }

  // Query verse counts from canonical verses collection
  const verseCountAgg = await CanonicalVerseModel.aggregate([
    { $match: { bibleId: 1001 } },
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

  const now = new Date();
  let created = 0;
  let existing = 0;
  let skipped = 0;

  // Process each book
  for (const [bookId, bookChapters] of chaptersByBook) {
    const bookName = bookNameMap.get(bookId) ?? `Book ${bookId}`;
    console.log(
      `[seedChapters] Processing ${bookName} (${bookChapters.length} chapters)...`
    );

    // Check which chapters already exist
    const chapterIds = bookChapters.map((ch) => ch.chapterId);
    const existingChapters = await DimChapterModel.find(
      { chapterId: { $in: chapterIds } },
      { chapterId: 1 }
    ).lean();
    const existingSet = new Set(existingChapters.map((ch) => ch.chapterId));

    const missingChapters = bookChapters.filter(
      (ch) => !existingSet.has(ch.chapterId)
    );
    existing += existingChapters.length;

    if (missingChapters.length === 0) {
      continue;
    }

    // Generate chapter names via LLM
    const chapterNames = await generateChapterNamesForBook(
      bookName,
      missingChapters
    );

    // Insert missing chapters
    for (const ch of missingChapters) {
      const verseCount = verseCounts.get(ch.chapterId) ?? 0;

      const chapterName =
        chapterNames.get(ch.chapterNumber) ?? `${bookName} ${ch.chapterNumber}`;

      await DimChapterModel.create({
        chapterId: ch.chapterId,
        bibleId: 1001,
        bookId,
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
