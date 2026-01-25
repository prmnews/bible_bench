/**
 * Chapter Raw Comparison API - Fetch raw chapter data for side-by-side comparison
 *
 * Returns canonical chapter text (raw + processed) and LLM raw response data
 * for a given chapter and model.
 *
 * GET /api/admin/explorer/chapter-raw
 *   Query params:
 *     - chapterId: number (required)
 *     - modelId: number (optional - if not provided, returns first available)
 */

import { NextRequest, NextResponse } from "next/server";

import { flattenAbsTextWithBrackets } from "@/lib/abs";
import { isAdminAvailable } from "@/lib/admin";
import {
  CanonicalChapterModel,
  CanonicalRawChapterModel,
  LlmRawResponseModel,
  ModelModel,
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type LlmResponseData = {
  responseId: number;
  runId: string;
  modelId: number;
  modelName: string;
  responseRaw: string;
  parsed: unknown;
  parseError: string | null;
  extractedText: string | null;
  systemPrompt: string | null;
  userPrompt: string | null;
  latencyMs: number | null;
  evaluatedAt: string;
};

type ChapterRawResponse = {
  chapterId: number;
  reference: string;
  bookId: number;
  bibleId: number;
  canonical: {
    textRaw: string;
    textProcessed: string;
    hashRaw: string;
    hashProcessed: string;
    sourceJson: unknown;
  };
  llmResponse: LlmResponseData | null;
  availableModels: Array<{ modelId: number; modelName: string }>;
};

export async function GET(request: NextRequest) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const chapterIdParam = searchParams.get("chapterId");
  const modelIdParam = searchParams.get("modelId");

  if (!chapterIdParam) {
    return NextResponse.json(
      { ok: false, error: "chapterId is required" },
      { status: 400 }
    );
  }

  const chapterId = Number(chapterIdParam);
  if (!Number.isFinite(chapterId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid chapterId" },
      { status: 400 }
    );
  }

  const modelId = modelIdParam ? Number(modelIdParam) : null;

  await connectToDatabase();

  // Fetch canonical chapter data
  const chapter = await CanonicalChapterModel.findOne(
    { chapterId },
    {
      _id: 0,
      chapterId: 1,
      reference: 1,
      bookId: 1,
      bibleId: 1,
      chapterNumber: 1,
      textProcessed: 1,
      hashRaw: 1,
      hashProcessed: 1,
    }
  ).lean();

  if (!chapter) {
    return NextResponse.json(
      { ok: false, error: `Chapter not found: ${chapterId}` },
      { status: 404 }
    );
  }

  // Fetch the raw chapter to get the actual ABS JSON payload
  const rawChapter = await CanonicalRawChapterModel.findOne(
    { bibleId: chapter.bibleId, bookId: chapter.bookId, chapterNumber: chapter.chapterNumber },
    { rawPayload: 1 }
  ).lean();

  // Compute textRaw on-the-fly using bracket formatting from ABS payload
  const textRaw = rawChapter?.rawPayload
    ? flattenAbsTextWithBrackets(rawChapter.rawPayload)
    : "";

  // Find available LLM raw responses for this chapter
  const rawResponses = await LlmRawResponseModel.find(
    { targetType: "chapter", targetId: chapterId },
    { modelId: 1 }
  ).lean();

  const availableModelIds = [...new Set(rawResponses.map((r) => r.modelId))];

  // Get model names
  const models = await ModelModel.find(
    { modelId: { $in: availableModelIds } },
    { modelId: 1, displayName: 1 }
  ).lean();
  const modelMap = new Map(models.map((m) => [m.modelId, m.displayName]));

  const availableModels = availableModelIds.map((id) => ({
    modelId: id,
    modelName: modelMap.get(id) ?? `Model ${id}`,
  }));

  // Determine which model to fetch
  const targetModelId = modelId ?? availableModelIds[0] ?? null;

  let llmResponse: LlmResponseData | null = null;

  if (targetModelId !== null) {
    const rawResponse = await LlmRawResponseModel.findOne(
      { targetType: "chapter", targetId: chapterId, modelId: targetModelId },
      { _id: 0 }
    )
      .sort({ evaluatedAt: -1 })
      .lean();

    if (rawResponse) {
      const modelName = modelMap.get(targetModelId) ?? `Model ${targetModelId}`;
      llmResponse = {
        responseId: rawResponse.responseId,
        runId: rawResponse.runId,
        modelId: rawResponse.modelId,
        modelName,
        responseRaw: rawResponse.responseRaw,
        parsed: rawResponse.parsed,
        parseError: rawResponse.parseError ?? null,
        extractedText: rawResponse.extractedText ?? null,
        systemPrompt: rawResponse.systemPrompt ?? null,
        userPrompt: rawResponse.userPrompt ?? null,
        latencyMs: rawResponse.latencyMs ?? null,
        evaluatedAt: rawResponse.evaluatedAt.toISOString(),
      };
    }
  }

  const response: ChapterRawResponse = {
    chapterId: chapter.chapterId,
    reference: chapter.reference,
    bookId: chapter.bookId,
    bibleId: chapter.bibleId,
    canonical: {
      textRaw,
      textProcessed: chapter.textProcessed,
      hashRaw: chapter.hashRaw,
      hashProcessed: chapter.hashProcessed,
      sourceJson: rawChapter?.rawPayload ?? null,
    },
    llmResponse,
    availableModels,
  };

  return NextResponse.json({ ok: true, data: response });
}
