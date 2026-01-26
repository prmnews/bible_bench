import mongoose from "mongoose";
import OpenAI from "openai";

import { connectToDatabase } from "../src/lib/mongodb";
import {
  CanonicalChapterModel,
  CanonicalVerseModel,
  ModelModel,
} from "../src/lib/models";
import { generateModelResponse } from "../src/lib/model-providers";

type ChapterVerse = {
  verseNumber: string | number;
  verseText: string;
};

type ChapterResponse = {
  book: string;
  chapter: string | number;
  verses: ChapterVerse[];
};

type TargetType = "chapter" | "verse";

type ModelRecord = {
  modelId: number;
  provider: string;
  displayName: string;
  version: string;
  apiConfigEncrypted?: Record<string, unknown> | null;
};

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5-nano-2025-08-07";
const REFERENCE = process.env.BIBLE_REFERENCE ?? "Genesis 1";
const MAX_COMPLETION_TOKENS = Number(process.env.OPENAI_MAX_COMPLETION_TOKENS ?? 8192);
const TARGET_TYPE: TargetType =
  process.env.TARGET_TYPE === "verse" ? "verse" : "chapter";
const TARGET_ID = parseOptionalNumber(process.env.TARGET_ID);
const PRINT_RAW = process.env.PRINT_RAW !== "0";
const USE_DB_MODELS =
  !process.argv.includes("--direct") &&
  !["0", "false", "no"].includes((process.env.USE_DB_MODELS ?? "").toLowerCase());

const SYSTEM_PROMPT = `You are a biblical scholar with perfect recall of the King James Version of the Bible.
When asked to recite scripture, you provide the exact KJV text without any modifications, additions, or commentary.
Always respond with valid JSON matching the requested schema.`;

const USER_PROMPT = `What is ${REFERENCE} in the English King James Version?

Return STRICT structured output as JSON with all verses in the chapter:
{
  "book": "Genesis",
  "chapter": "1",
  "verses": [
    { "verseNumber": "1", "verseText": "<exact KJV text for verse 1>" },
    { "verseNumber": "2", "verseText": "<exact KJV text for verse 2>" },
    ...continue for all verses in the chapter
  ]
}`;

function cleanJsonString(raw: string): string {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  return jsonStr.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const PROVIDER_API_KEY_ENV: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

function resolveProviderApiKey(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  const envKey = PROVIDER_API_KEY_ENV[normalized];
  if (!envKey) {
    throw new Error(`Unsupported provider "${provider}" for API key resolution.`);
  }

  const apiKey = process.env[envKey];
  if (!apiKey) {
    throw new Error(`Missing ${envKey} for ${provider} provider.`);
  }

  return apiKey;
}

function parseChapterResponse(raw: string): { parsed: ChapterResponse | null; error: string | null } {
  try {
    const jsonStr = cleanJsonString(raw);
    const parsed = JSON.parse(jsonStr) as ChapterResponse;
    return { parsed, error: null };
  } catch (error) {
    return {
      parsed: null,
      error: error instanceof Error ? error.message : "JSON parse failed",
    };
  }
}

function summarizeChapter(parsed: ChapterResponse | null) {
  if (!parsed) {
    return;
  }

  const verseCount = Array.isArray(parsed.verses) ? parsed.verses.length : 0;
  const firstVerse = parsed.verses?.[0];
  const lastVerse = parsed.verses?.[verseCount - 1];

  console.log("\n[summary] Parsed response");
  console.log(`  Book: ${parsed.book}`);
  console.log(`  Chapter: ${parsed.chapter}`);
  console.log(`  Verses: ${verseCount}`);

  if (firstVerse) {
    console.log(`  First verse: ${firstVerse.verseNumber} - ${firstVerse.verseText}`);
  }
  if (lastVerse && lastVerse !== firstVerse) {
    console.log(`  Last verse: ${lastVerse.verseNumber} - ${lastVerse.verseText}`);
  }
}

function summarizeParsed(targetType: TargetType, parsed: unknown) {
  if (!parsed || !isRecord(parsed)) {
    return;
  }

  if (targetType === "chapter") {
    if (Array.isArray(parsed["verses"])) {
      summarizeChapter(parsed as ChapterResponse);
    }
    return;
  }

  const verseText = typeof parsed["verseText"] === "string" ? parsed["verseText"] : null;
  const verseNumber = parsed["verseNumber"];
  if (verseText) {
    console.log("\n[summary] Parsed response");
    console.log(`  Verse: ${verseNumber ?? "?"} - ${verseText}`);
  }
}

async function loadTargetPayload(targetType: TargetType, reference: string) {
  if (targetType === "chapter") {
    const query = TARGET_ID ? { chapterId: TARGET_ID } : { reference };
    const chapter = await CanonicalChapterModel.findOne(query).lean();
    if (!chapter) {
      throw new Error(`Chapter not found for reference "${reference}".`);
    }
    return {
      targetId: chapter.chapterId,
      reference: chapter.reference,
      canonicalRaw: chapter.textRaw,
      canonicalProcessed: chapter.textProcessed,
    };
  }

  const query = TARGET_ID ? { verseId: TARGET_ID } : { reference };
  const verse = await CanonicalVerseModel.findOne(query).lean();
  if (!verse) {
    throw new Error(`Verse not found for reference "${reference}".`);
  }
  return {
    targetId: verse.verseId,
    reference: verse.reference,
    canonicalRaw: verse.textRaw,
    canonicalProcessed: verse.textProcessed,
  };
}

async function runDbModelSweep() {
  console.log("[mode] DB model mode enabled");
  await connectToDatabase();

  try {
    const models = (await ModelModel.find({ isActive: true }, { _id: 0 })
      .sort({ modelId: 1 })
      .lean()) as ModelRecord[];

    const model = models[0];
    if (!model) {
      console.error("[db] No active models found.");
      return;
    }

    const target = await loadTargetPayload(TARGET_TYPE, REFERENCE);
    console.log("[target] Type:", TARGET_TYPE);
    console.log("[target] Reference:", target.reference);
    console.log("[target] ID:", target.targetId);

    const provider = model.provider;
    const providerNormalized = provider.toLowerCase();
    const modelName = isRecord(model.apiConfigEncrypted)
      ? String(model.apiConfigEncrypted.model ?? "")
      : "";
    const apiKeyValue = providerNormalized === "mock" ? "" : resolveProviderApiKey(provider);

    console.log("\n" + "-".repeat(80));
    console.log(`[model] ${model.displayName ?? "unknown"}`);
    console.log(`  Model ID: ${model.modelId ?? "?"}`);
    console.log(`  Provider: ${provider}`);
    console.log(`  Version: ${model.version ?? "?"}`);
    console.log(`  Model name: ${modelName || "(none)"}`);
    console.log(`  API key present: ${Boolean(apiKeyValue)} (len: ${apiKeyValue.length})`);

    const start = Date.now();
    try {
      const result = await generateModelResponse({
        targetType: TARGET_TYPE,
        targetId: target.targetId,
        reference: target.reference,
        canonicalRaw: target.canonicalRaw,
        canonicalProcessed: target.canonicalProcessed,
        model: {
          provider,
          apiConfigEncrypted: isRecord(model.apiConfigEncrypted)
            ? model.apiConfigEncrypted
            : undefined,
        },
      });

      const latencyMs = Date.now() - start;
      console.log("  [result] Latency (ms):", latencyMs);
      console.log("  [result] Parse error:", result.parseError ?? "none");
      console.log("  [result] Response length:", result.responseRaw.length);
      console.log("  [result] Extracted length:", result.extractedText?.length ?? 0);

      if (result.systemPrompt) {
        console.log("\n  [prompt] SYSTEM:");
        console.log(result.systemPrompt);
      }
      if (result.userPrompt) {
        console.log("\n  [prompt] USER:");
        console.log(result.userPrompt);
      }

      if (PRINT_RAW) {
        console.log("\n  [response] Raw JSON:");
        console.log(result.responseRaw);
      }

      summarizeParsed(TARGET_TYPE, result.parsed);
    } catch (error) {
      console.error(
        "  [error] Model run failed:",
        error instanceof Error ? error.message : error
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

async function runOpenAiDirect() {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("[config] OPENAI_API_KEY present:", Boolean(apiKey));
  console.log("[config] OPENAI_API_KEY length:", apiKey?.length ?? 0);
  console.log("[config] Model:", MODEL);
  console.log("[config] Reference:", REFERENCE);
  console.log("[config] Max completion tokens:", MAX_COMPLETION_TOKENS);
  console.log("[config] Max output tokens:", MAX_COMPLETION_TOKENS);
  console.log("[config] Temperature: default (1)");

  if (!apiKey) {
    console.error("[error] OPENAI_API_KEY is not set.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  console.log("\n[request] Sending OpenAI chat.completions request...");
  console.log("[request] System prompt length:", SYSTEM_PROMPT.length);
  console.log("[request] User prompt length:", USER_PROMPT.length);
  console.log("\n[request] SYSTEM PROMPT:");
  console.log(SYSTEM_PROMPT);
  console.log("\n[request] USER PROMPT:");
  console.log(USER_PROMPT);

  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT },
      ],
    });

    const latencyMs = Date.now() - start;
    const responseRaw = response.choices[0]?.message?.content ?? "";
    const finishReason = response.choices[0]?.finish_reason ?? "unknown";
    const message = response.choices[0]?.message;

    console.log("\n[response] Latency (ms):", latencyMs);
    console.log("[response] Finish reason:", finishReason);
    console.log("[response] Response model:", response.model);
    console.log("[response] Usage:", JSON.stringify(response.usage ?? {}));
    console.log("[response] Raw length:", responseRaw.length);
    console.log("[response] Choice 0:", JSON.stringify(response.choices[0] ?? null, null, 2));

    if (message && typeof message === "object") {
      const messageContent = typeof message.content === "string" ? message.content : "";
      const refusal = (message as { refusal?: unknown }).refusal ?? null;
      const toolCalls = (message as { tool_calls?: unknown }).tool_calls ?? null;

      console.log("[response] Message content length:", messageContent.length);
      console.log("[response] Message refusal:", JSON.stringify(refusal));
      console.log("[response] Message tool_calls:", JSON.stringify(toolCalls));
    }

    if (!responseRaw.trim()) {
      console.warn("[response] Empty response received.");
    }

    console.log("\n[response] Raw JSON:");
    console.log(responseRaw);

    const { parsed, error } = parseChapterResponse(responseRaw);

    if (error) {
      console.error("\n[parse] Error:", error);
      console.log("\n[responses] Falling back to Responses API (reasoning effort: minimal)...");
      const responsesStart = Date.now();

      const responsesResponse = await client.responses.create({
        model: MODEL,
        instructions: SYSTEM_PROMPT,
        input: USER_PROMPT,
        max_output_tokens: MAX_COMPLETION_TOKENS,
        reasoning: { effort: "minimal" },
        text: { format: { type: "json_object" } },
      });

      const responsesLatencyMs = Date.now() - responsesStart;
      const outputText = (responsesResponse as { output_text?: string }).output_text ?? "";

      console.log("[responses] Latency (ms):", responsesLatencyMs);
      console.log("[responses] Response id:", responsesResponse.id);
      console.log("[responses] Status:", responsesResponse.status);
      console.log("[responses] Output text length:", outputText.length);
      console.log("[responses] Usage:", JSON.stringify(responsesResponse.usage ?? {}));

      if (!outputText.trim()) {
        console.warn("[responses] Empty output_text received.");
        return;
      }

      console.log("\n[responses] Output JSON:");
      console.log(outputText);

      const parsedFallback = parseChapterResponse(outputText);
      if (parsedFallback.error) {
        console.error("\n[responses parse] Error:", parsedFallback.error);
        return;
      }

      summarizeChapter(parsedFallback.parsed);
      return;
    }

    summarizeChapter(parsed);
  } catch (error) {
    const latencyMs = Date.now() - start;
    console.error("\n[error] OpenAI request failed after", latencyMs, "ms");
    if (error instanceof Error) {
      console.error("[error] Message:", error.message);
      console.error("[error] Stack:", error.stack);
    } else {
      console.error("[error] Unknown error:", error);
    }
  }
}

async function main() {
  if (!USE_DB_MODELS) {
    await runOpenAiDirect();
    return;
  }

  await runDbModelSweep();
}

main().catch((error) => {
  console.error("[fatal] Unhandled error:", error);
  process.exit(1);
});
