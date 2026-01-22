import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import OpenAI from "openai";

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

type VerseResponseData = {
  book: string;
  chapter: string;
  verseNumber: string;
  verseText: string;
};

type ChapterVerseData = {
  verseNumber: string;
  verseText: string;
};

type ChapterResponseData = {
  book: string;
  chapter: string;
  verses: ChapterVerseData[];
};

type ParsedResponse = VerseResponseData | ChapterResponseData;

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

type ModelResponseParams = {
  targetType: "chapter" | "verse";
  targetId: number;
  reference: string;
  canonicalRaw: string;
  canonicalProcessed: string;
  model: {
    provider: string;
    apiConfigEncrypted?: Record<string, unknown> | null;
  };
};

type ModelResponseResult = {
  responseRaw: string;
  parsed: ParsedResponse | null;
  parseError: string | null;
  extractedText: string | null;
  systemPrompt?: string;
  userPrompt?: string;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(([, entry]) => typeof entry === "string");
  return Object.fromEntries(entries) as Record<string, string>;
}

// ============================================================================
// JSON PARSING & TEXT EXTRACTION
// ============================================================================

function parseJsonResponse(
  responseRaw: string,
  targetType: "chapter" | "verse"
): { parsed: ParsedResponse | null; parseError: string | null } {
  try {
    // Handle potential markdown code blocks
    let jsonStr = responseRaw.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr) as ParsedResponse;

    // Basic validation
    if (targetType === "verse") {
      const verse = parsed as VerseResponseData;
      if (typeof verse.verseText !== "string") {
        return { parsed: null, parseError: "Missing verseText field" };
      }
    } else {
      const chapter = parsed as ChapterResponseData;
      if (!Array.isArray(chapter.verses)) {
        return { parsed: null, parseError: "Missing verses array" };
      }
    }

    return { parsed, parseError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON parse failed";
    return { parsed: null, parseError: message };
  }
}

function extractText(parsed: ParsedResponse | null, targetType: "chapter" | "verse"): string | null {
  if (!parsed) {
    return null;
  }

  if (targetType === "verse") {
    const verse = parsed as VerseResponseData;
    return verse.verseText?.trim() ?? null;
  }

  const chapter = parsed as ChapterResponseData;
  if (!Array.isArray(chapter.verses)) {
    return null;
  }

  // Join all verse texts with space
  return chapter.verses
    .map((v) => v.verseText?.trim())
    .filter((t) => t)
    .join(" ");
}

function normalizeEmptyResponse(result: ModelResponseResult): ModelResponseResult {
  if (result.responseRaw.trim().length === 0) {
    return {
      ...result,
      responseRaw: "[empty response]",
      parsed: null,
      parseError: "Empty response from provider.",
      extractedText: null,
    };
  }

  return result;
}

// ============================================================================
// PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `You are a biblical scholar with perfect recall of the King James Version of the Bible. When asked to recite scripture, you provide the exact KJV text without any modifications, additions, or commentary. Always respond with valid JSON matching the requested schema.`;

function buildVersePrompt(reference: string): string {
  return `What is ${reference} in the English King James Version?

Return STRICT structured output as JSON:
{
  "book": "<book name>",
  "chapter": "<chapter number>",
  "verseNumber": "<verse number>",
  "verseText": "<exact KJV text without verse number>"
}`;
}

function buildChapterPrompt(reference: string): string {
  return `What is ${reference} in the English King James Version?

Return STRICT structured output as JSON with all verses in the chapter:
{
  "book": "<book name>",
  "chapter": "<chapter number>",
  "verses": [
    { "verseNumber": "1", "verseText": "<exact KJV text for verse 1>" },
    { "verseNumber": "2", "verseText": "<exact KJV text for verse 2>" },
    ...continue for all verses in the chapter
  ]
}`;
}

function buildPrompt(params: ModelResponseParams): string {
  if (params.targetType === "chapter") {
    return buildChapterPrompt(params.reference);
  }
  return buildVersePrompt(params.reference);
}

function getPromptBundle(params: ModelResponseParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildPrompt(params),
  };
}

// ============================================================================
// MOCK PROVIDER
// ============================================================================

type MockConfig = {
  mode?: "echo_raw" | "echo_processed" | "literal";
  literalResponse?: string;
  overrides?: Record<string, string>;
};

function resolveMockConfig(config: Record<string, unknown> | null | undefined): MockConfig {
  if (!isRecord(config)) {
    return {};
  }

  const source = isRecord(config["mock"]) ? (config["mock"] as Record<string, unknown>) : config;
  const mode = getString(source["mode"]) as MockConfig["mode"] | null;
  const literalResponse = getString(source["literalResponse"]);
  const overrides = getStringMap(source["overrides"]);

  return {
    mode: mode ?? undefined,
    literalResponse: literalResponse ?? undefined,
    overrides,
  };
}

async function generateMockResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = resolveMockConfig(params.model.apiConfigEncrypted);
  const targetKey = String(params.targetId);
  const override = config.overrides?.[targetKey];

  let text: string;
  if (override !== undefined) {
    text = override;
  } else {
    switch (config.mode) {
      case "echo_processed":
        text = params.canonicalProcessed;
        break;
      case "literal":
        text = config.literalResponse ?? params.canonicalRaw;
        break;
      case "echo_raw":
      default:
        text = params.canonicalRaw;
    }
  }

  // For mock, generate a synthetic JSON response
  let parsed: ParsedResponse;

  if (params.targetType === "verse") {
    const parts = params.reference.split(" ");
    const book = parts.slice(0, -1).join(" ");
    const chapterVerse = parts[parts.length - 1]?.split(":") ?? ["1", "1"];

    parsed = {
      book,
      chapter: chapterVerse[0] ?? "1",
      verseNumber: chapterVerse[1] ?? "1",
      verseText: text,
    };
  } else {
    const parts = params.reference.split(" ");
    const book = parts.slice(0, -1).join(" ");
    const chapter = parts[parts.length - 1] ?? "1";

    // For mock chapter, just put all text as verse 1
    parsed = {
      book,
      chapter,
      verses: [{ verseNumber: "1", verseText: text }],
    };
  }

  const responseRaw = JSON.stringify(parsed);
  const extractedText = extractText(parsed, params.targetType);

  return { responseRaw, parsed, parseError: null, extractedText };
}

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

async function generateOpenAIResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = params.model.apiConfigEncrypted;
  if (!isRecord(config)) {
    throw new Error("OpenAI model configuration is missing.");
  }

  const apiKey = getString(config["apiKey"]);
  if (!apiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const modelName = getString(config["model"]) ?? "gpt-4o";
  const maxTokens = typeof config["maxTokens"] === "number" ? config["maxTokens"] : 4096;

  const client = new OpenAI({ apiKey });
  const prompt = buildPrompt(params);

  const response = await client.chat.completions.create({
    model: modelName,
    max_completion_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const responseRaw = response.choices[0]?.message?.content ?? "";
  const { parsed, parseError } = parseJsonResponse(responseRaw, params.targetType);
  const extractedText = extractText(parsed, params.targetType);

  return { responseRaw, parsed, parseError, extractedText };
}

// ============================================================================
// ANTHROPIC PROVIDER
// ============================================================================

async function generateAnthropicResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = params.model.apiConfigEncrypted;
  if (!isRecord(config)) {
    throw new Error("Anthropic model configuration is missing.");
  }

  const apiKey = getString(config["apiKey"]);
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  const modelName = getString(config["model"]) ?? "claude-sonnet-4-20250514";
  const maxTokens = typeof config["maxTokens"] === "number" ? config["maxTokens"] : 4096;

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(params);

  // Anthropic doesn't have native JSON mode, so we rely on prompt engineering
  const response = await client.messages.create({
    model: modelName,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: prompt },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const responseRaw = textBlock?.type === "text" ? textBlock.text : "";
  const { parsed, parseError } = parseJsonResponse(responseRaw, params.targetType);
  const extractedText = extractText(parsed, params.targetType);

  return { responseRaw, parsed, parseError, extractedText };
}

// ============================================================================
// GEMINI PROVIDER
// ============================================================================

const GEMINI_VERSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    book: { type: SchemaType.STRING },
    chapter: { type: SchemaType.STRING },
    verseNumber: { type: SchemaType.STRING },
    verseText: { type: SchemaType.STRING },
  },
  required: ["book", "chapter", "verseNumber", "verseText"],
};

const GEMINI_CHAPTER_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    book: { type: SchemaType.STRING },
    chapter: { type: SchemaType.STRING },
    verses: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          verseNumber: { type: SchemaType.STRING },
          verseText: { type: SchemaType.STRING },
        },
        required: ["verseNumber", "verseText"],
      },
    },
  },
  required: ["book", "chapter", "verses"],
};

async function generateGeminiResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = params.model.apiConfigEncrypted;
  if (!isRecord(config)) {
    throw new Error("Gemini model configuration is missing.");
  }

  const apiKey = getString(config["apiKey"]);
  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  const modelName = getString(config["model"]) ?? "gemini-2.0-flash";
  const responseSchema = params.targetType === "chapter" 
    ? GEMINI_CHAPTER_SCHEMA 
    : GEMINI_VERSE_SCHEMA;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const prompt = buildPrompt(params);
  const result = await model.generateContent(prompt);
  const responseRaw = result.response.text();
  const { parsed, parseError } = parseJsonResponse(responseRaw, params.targetType);
  const extractedText = extractText(parsed, params.targetType);

  return { responseRaw, parsed, parseError, extractedText };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function generateModelResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const provider = params.model.provider?.toLowerCase() ?? "mock";
  const { systemPrompt, userPrompt } = getPromptBundle(params);
  let result: ModelResponseResult;

  switch (provider) {
    case "openai":
      result = await generateOpenAIResponse(params);
      break;
    case "anthropic":
      result = await generateAnthropicResponse(params);
      break;
    case "google":
    case "gemini":
      result = await generateGeminiResponse(params);
      break;
    case "mock":
    default:
      result = await generateMockResponse(params);
      break;
  }

  const normalized = normalizeEmptyResponse(result);
  return {
    ...normalized,
    systemPrompt,
    userPrompt,
  };
}

export type {
  ModelResponseParams,
  ModelResponseResult,
  VerseResponseData,
  ChapterResponseData,
  ChapterVerseData,
  ParsedResponse,
};
