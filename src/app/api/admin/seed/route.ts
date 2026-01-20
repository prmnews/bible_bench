import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { parseKjvFilename } from "@/lib/kjv-files";
import {
  DimBibleModel,
  DimBookModel,
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
};

async function seedLanguages(): Promise<{ created: number; existing: number }> {
  const now = new Date();
  const existing = await DimLanguageModel.findOne({ languageId: 1 }).lean();
  if (existing) {
    return { created: 0, existing: 1 };
  }

  await DimLanguageModel.create({
    languageId: 1,
    isoCode: "en",
    name: "English",
    audit: {
      createdAt: now,
      createdBy: "seed",
    },
  });

  return { created: 1, existing: 0 };
}

async function seedBibles(): Promise<{ created: number; existing: number }> {
  const now = new Date();
  const existing = await DimBibleModel.findOne({ bibleId: 1001 }).lean();
  if (existing) {
    return { created: 0, existing: 1 };
  }

  await DimBibleModel.create({
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
    const existingBook = await DimBookModel.findOne({ bookId }).lean();
    if (existingBook) {
      existing++;
      continue;
    }

    await DimBookModel.create({
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

    const result: SeedResult = {
      languages,
      bibles,
      books,
      transformProfiles,
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
