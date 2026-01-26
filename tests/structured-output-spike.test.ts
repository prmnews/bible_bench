/**
 * Structured Output Spike Test
 * 
 * Tests structured JSON output from OpenAI, Anthropic, and Gemini
 * for Genesis 1:1 to validate the approach before refactoring.
 * 
 * Run with: node --test --env-file=.env.local --import tsx tests/structured-output-spike.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import OpenAI from "openai";

import { sha256 } from "../src/lib/hash";
import { compareText } from "../src/lib/evaluation";

// ============================================================================
// CANONICAL DATA
// ============================================================================

const CANONICAL = {
  reference: "Genesis 1:1",
  book: "Genesis",
  chapter: 1,
  verseNumber: 1,
  // Text WITHOUT verse number - this is what we want models to return
  textNormalized: "In the beginning God created the heaven and the earth.",
  hashNormalized: "", // Will compute below
};

// Compute the hash of normalized text
CANONICAL.hashNormalized = sha256(CANONICAL.textNormalized);

// ============================================================================
// EXPECTED SCHEMAS
// ============================================================================

type VerseResponse = {
  book: string;
  chapter: string | number;
  verseNumber: string | number;
  verseText: string;
};

type ChapterVerseData = {
  verseNumber: string | number;
  verseText: string;
};

type ChapterResponse = {
  book: string;
  chapter: string | number;
  verses: ChapterVerseData[];
};

function isSkippableProviderError(message?: string | null): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("not set") ||
    normalized.includes("429") ||
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("resource exhausted")
  );
}

// Schema definition for reference (used in prompts, not programmatically)
// {
//   book: string - The book name
//   chapter: string - The chapter number
//   verseNumber: string - The verse number
//   verseText: string - The exact KJV verse text without verse numbers
// }

// ============================================================================
// PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a biblical scholar with perfect recall of the King James Version of the Bible. 
When asked to recite scripture, you provide the exact KJV text without any modifications, additions, or commentary.
Always respond with valid JSON matching the requested schema.`;

const USER_PROMPT = `What is Genesis 1:1 in the English King James Version?

Return STRICT structured output as JSON:
{
  "book": "Genesis",
  "chapter": "1",
  "verseNumber": "1",
  "verseText": "<exact KJV text without verse number>"
}`;

// ============================================================================
// PROVIDER IMPLEMENTATIONS
// ============================================================================

type ProviderResult = {
  provider: string;
  success: boolean;
  responseRaw: string;
  parsed: VerseResponse | null;
  parseError: string | null;
  validationErrors: string[];
  extractedText: string | null;
  hashMatch: boolean;
  fidelityScore: number | null;
  diff: Record<string, number> | null;
  latencyMs: number;
};

async function testOpenAI(): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      provider: "openai",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: "OPENAI_API_KEY not set",
      validationErrors: [],
      extractedText: null,
      hashMatch: false,
      fidelityScore: null,
      diff: null,
      latencyMs: 0,
    };
  }

  const client = new OpenAI({ apiKey });
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 256,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT },
      ],
    });

    const latencyMs = Date.now() - start;
    const responseRaw = response.choices[0]?.message?.content ?? "";

    return parseAndValidate("openai", responseRaw, latencyMs);
  } catch (error) {
    return {
      provider: "openai",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: error instanceof Error ? error.message : "Unknown error",
      validationErrors: [],
      extractedText: null,
      hashMatch: false,
      fidelityScore: null,
      diff: null,
      latencyMs: Date.now() - start,
    };
  }
}

async function testAnthropic(): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      provider: "anthropic",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: "ANTHROPIC_API_KEY not set",
      validationErrors: [],
      extractedText: null,
      hashMatch: false,
      fidelityScore: null,
      diff: null,
      latencyMs: 0,
    };
  }

  const client = new Anthropic({ apiKey });
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: USER_PROMPT },
      ],
    });

    const latencyMs = Date.now() - start;
    const textBlock = response.content.find((block) => block.type === "text");
    const responseRaw = textBlock?.type === "text" ? textBlock.text : "";

    return parseAndValidate("anthropic", responseRaw, latencyMs);
  } catch (error) {
    return {
      provider: "anthropic",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: error instanceof Error ? error.message : "Unknown error",
      validationErrors: [],
      extractedText: null,
      hashMatch: false,
      fidelityScore: null,
      diff: null,
      latencyMs: Date.now() - start,
    };
  }
}

async function testGemini(): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      provider: "gemini",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: "GEMINI_API_KEY or GOOGLE_API_KEY not set",
      validationErrors: [],
      extractedText: null,
      hashMatch: false,
      fidelityScore: null,
      diff: null,
      latencyMs: 0,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          book: { type: SchemaType.STRING },
          chapter: { type: SchemaType.STRING },
          verseNumber: { type: SchemaType.STRING },
          verseText: { type: SchemaType.STRING },
        },
        required: ["book", "chapter", "verseNumber", "verseText"],
      },
    },
  });

  const start = Date.now();

  try {
    const result = await model.generateContent(USER_PROMPT);
    const latencyMs = Date.now() - start;
    const responseRaw = result.response.text();

    return parseAndValidate("gemini", responseRaw, latencyMs);
  } catch (error) {
    return {
      provider: "gemini",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: error instanceof Error ? error.message : "Unknown error",
      validationErrors: [],
      extractedText: null,
      hashMatch: false,
      fidelityScore: null,
      diff: null,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================================
// PARSING & VALIDATION
// ============================================================================

function parseAndValidate(
  provider: string,
  responseRaw: string,
  latencyMs: number
): ProviderResult {
  // Try to parse JSON
  let parsed: VerseResponse | null = null;
  let parseError: string | null = null;

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

    parsed = JSON.parse(jsonStr) as VerseResponse;
  } catch (error) {
    parseError = error instanceof Error ? error.message : "JSON parse failed";
  }

  if (!parsed) {
    return {
      provider,
      success: false,
      responseRaw,
      parsed: null,
      parseError,
      validationErrors: [],
      extractedText: null,
      hashMatch: false,
      fidelityScore: null,
      diff: null,
      latencyMs,
    };
  }

  // Validate schema
  const validationErrors: string[] = [];

  if (typeof parsed.book !== "string") {
    validationErrors.push("book is not a string");
  }
  if (parsed.chapter === undefined) {
    validationErrors.push("chapter is missing");
  }
  if (parsed.verseNumber === undefined) {
    validationErrors.push("verseNumber is missing");
  }
  if (typeof parsed.verseText !== "string") {
    validationErrors.push("verseText is not a string");
  }

  // Validate metadata matches request
  if (parsed.book?.toLowerCase() !== CANONICAL.book.toLowerCase()) {
    validationErrors.push(`book mismatch: expected "${CANONICAL.book}", got "${parsed.book}"`);
  }
  if (String(parsed.chapter) !== String(CANONICAL.chapter)) {
    validationErrors.push(`chapter mismatch: expected "${CANONICAL.chapter}", got "${parsed.chapter}"`);
  }
  if (String(parsed.verseNumber) !== String(CANONICAL.verseNumber)) {
    validationErrors.push(`verseNumber mismatch: expected "${CANONICAL.verseNumber}", got "${parsed.verseNumber}"`);
  }

  // Extract and compare text
  const extractedText = parsed.verseText?.trim() ?? null;
  let hashMatch = false;
  let fidelityScore: number | null = null;
  let diff: Record<string, number> | null = null;

  if (extractedText) {
    const extractedHash = sha256(extractedText);
    hashMatch = extractedHash === CANONICAL.hashNormalized;

    const comparison = compareText(CANONICAL.textNormalized, extractedText);
    fidelityScore = comparison.fidelityScore;
    diff = comparison.diff;
  }

  return {
    provider,
    success: validationErrors.length === 0 && hashMatch,
    responseRaw,
    parsed,
    parseError,
    validationErrors,
    extractedText,
    hashMatch,
    fidelityScore,
    diff,
    latencyMs,
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Structured Output Spike - Genesis 1:1", () => {
  it("should display canonical reference", () => {
    console.log("\n" + "=".repeat(70));
    console.log("STRUCTURED OUTPUT SPIKE TEST - Genesis 1:1");
    console.log("=".repeat(70));
    console.log("\nCANONICAL REFERENCE:");
    console.log(`  Reference: ${CANONICAL.reference}`);
    console.log(`  Text: "${CANONICAL.textNormalized}"`);
    console.log(`  Hash: ${CANONICAL.hashNormalized}`);
    console.log("");
  });

  it("should test OpenAI structured output", async () => {
    console.log("\n--- OPENAI (gpt-4o) ---");
    const result = await testOpenAI();
    printResult(result);
    
    // Don't fail the test if API key missing, just report
    if (isSkippableProviderError(result.parseError)) {
      console.log("  ⚠️  Skipped (no API key or rate limited)");
      return;
    }
    
    assert.ok(result.parsed !== null, "Should parse JSON successfully");
  });

  it("should test Anthropic structured output", async () => {
    console.log("\n--- ANTHROPIC (claude-sonnet-4) ---");
    const result = await testAnthropic();
    printResult(result);
    
    if (isSkippableProviderError(result.parseError)) {
      console.log("  ⚠️  Skipped (no API key or rate limited)");
      return;
    }
    
    assert.ok(result.parsed !== null, "Should parse JSON successfully");
  });

  it("should test Gemini structured output", async () => {
    console.log("\n--- GEMINI (gemini-2.0-flash) ---");
    const result = await testGemini();
    printResult(result);
    
    if (isSkippableProviderError(result.parseError)) {
      console.log("  ⚠️  Skipped (no API key or rate limited)");
      return;
    }
    
    assert.ok(result.parsed !== null, "Should parse JSON successfully");
  });

  it("should display summary", async () => {
    console.log("\n" + "=".repeat(70));
    console.log("RUNNING ALL PROVIDERS FOR SUMMARY...");
    console.log("=".repeat(70));

    const results = await Promise.all([
      testOpenAI(),
      testAnthropic(),
      testGemini(),
    ]);

    console.log("\n📊 SUMMARY:");
    console.log("-".repeat(70));
    console.log(
      "Provider".padEnd(15) +
      "JSON Parse".padEnd(12) +
      "Schema OK".padEnd(12) +
      "Hash Match".padEnd(12) +
      "Fidelity".padEnd(12) +
      "Latency"
    );
    console.log("-".repeat(70));

    for (const r of results) {
      const jsonParse = r.parsed
        ? "✓"
        : isSkippableProviderError(r.parseError)
          ? "⚠️ skip"
          : "✗";
      const schemaOk = r.validationErrors.length === 0 ? "✓" : "✗";
      const hashMatch = r.hashMatch ? "✓" : "✗";
      const fidelity = r.fidelityScore !== null ? `${r.fidelityScore}%` : "-";
      const latency = r.latencyMs > 0 ? `${r.latencyMs}ms` : "-";

      console.log(
        r.provider.padEnd(15) +
        jsonParse.padEnd(12) +
        schemaOk.padEnd(12) +
        hashMatch.padEnd(12) +
        fidelity.padEnd(12) +
        latency
      );
    }

    console.log("-".repeat(70));

    // Show any validation errors
    const withErrors = results.filter((r) => r.validationErrors.length > 0);
    if (withErrors.length > 0) {
      console.log("\n⚠️  VALIDATION ISSUES:");
      for (const r of withErrors) {
        console.log(`  ${r.provider}:`);
        for (const err of r.validationErrors) {
          console.log(`    - ${err}`);
        }
      }
    }

    // Show text comparison for non-matching
    const nonMatching = results.filter((r) => r.extractedText && !r.hashMatch);
    if (nonMatching.length > 0) {
      console.log("\n🔍 TEXT DIFFERENCES:");
      for (const r of nonMatching) {
        console.log(`  ${r.provider}:`);
        console.log(`    Canonical: "${CANONICAL.textNormalized}"`);
        console.log(`    Got:       "${r.extractedText}"`);
        console.log(`    Diff:      ${JSON.stringify(r.diff)}`);
      }
    }

    // Final assessment
    const allSuccess = results.filter((r) => r.success);
    const allTested = results.filter((r) => !r.parseError?.includes("not set"));
    
    console.log("\n" + "=".repeat(70));
    console.log(`RESULT: ${allSuccess.length}/${allTested.length} providers achieved perfect match`);
    console.log("=".repeat(70) + "\n");
  });
});

function printResult(result: ProviderResult) {
  console.log(`  Latency: ${result.latencyMs}ms`);
  
  if (result.parseError) {
    console.log(`  Parse Error: ${result.parseError}`);
    return;
  }

  console.log(`  Raw Response: ${result.responseRaw.substring(0, 100)}...`);
  console.log(`  Parsed: ${JSON.stringify(result.parsed)}`);
  
  if (result.validationErrors.length > 0) {
    console.log(`  Validation Errors: ${result.validationErrors.join(", ")}`);
  }
  
  console.log(`  Extracted Text: "${result.extractedText}"`);
  console.log(`  Hash Match: ${result.hashMatch}`);
  console.log(`  Fidelity: ${result.fidelityScore}%`);
  
  if (!result.hashMatch && result.diff) {
    console.log(`  Diff: ${JSON.stringify(result.diff)}`);
  }
}

// ============================================================================
// CHAPTER-LEVEL TEST (Psalm 117 - shortest chapter, 2 verses)
// ============================================================================

const PSALM_117 = {
  reference: "Psalm 117",
  book: "Psalm",
  chapter: 117,
  verses: [
    { verseNumber: 1, text: "O praise the LORD, all ye nations: praise him, all ye people." },
    { verseNumber: 2, text: "For his merciful kindness is great toward us: and the truth of the LORD endureth for ever. Praise ye the LORD." },
  ],
};

const CHAPTER_PROMPT = `What is Psalm 117 in the English King James Version?

Return STRICT structured output as JSON with all verses in the chapter:
{
  "book": "Psalm",
  "chapter": "117",
  "verses": [
    { "verseNumber": "1", "verseText": "<exact KJV text for verse 1>" },
    { "verseNumber": "2", "verseText": "<exact KJV text for verse 2>" }
  ]
}`;

type ChapterProviderResult = {
  provider: string;
  success: boolean;
  responseRaw: string;
  parsed: ChapterResponse | null;
  parseError: string | null;
  validationErrors: string[];
  verseCount: number;
  latencyMs: number;
};

async function testOpenAIChapter(): Promise<ChapterProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      provider: "openai",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: "OPENAI_API_KEY not set",
      validationErrors: [],
      verseCount: 0,
      latencyMs: 0,
    };
  }

  const client = new OpenAI({ apiKey });
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: CHAPTER_PROMPT },
      ],
    });

    const latencyMs = Date.now() - start;
    const responseRaw = response.choices[0]?.message?.content ?? "";

    return parseAndValidateChapter("openai", responseRaw, latencyMs);
  } catch (error) {
    return {
      provider: "openai",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: error instanceof Error ? error.message : "Unknown error",
      validationErrors: [],
      verseCount: 0,
      latencyMs: Date.now() - start,
    };
  }
}

async function testAnthropicChapter(): Promise<ChapterProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      provider: "anthropic",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: "ANTHROPIC_API_KEY not set",
      validationErrors: [],
      verseCount: 0,
      latencyMs: 0,
    };
  }

  const client = new Anthropic({ apiKey });
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: CHAPTER_PROMPT },
      ],
    });

    const latencyMs = Date.now() - start;
    const textBlock = response.content.find((block) => block.type === "text");
    const responseRaw = textBlock?.type === "text" ? textBlock.text : "";

    return parseAndValidateChapter("anthropic", responseRaw, latencyMs);
  } catch (error) {
    return {
      provider: "anthropic",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: error instanceof Error ? error.message : "Unknown error",
      validationErrors: [],
      verseCount: 0,
      latencyMs: Date.now() - start,
    };
  }
}

async function testGeminiChapter(): Promise<ChapterProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      provider: "gemini",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: "GEMINI_API_KEY or GOOGLE_API_KEY not set",
      validationErrors: [],
      verseCount: 0,
      latencyMs: 0,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
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
      },
    },
  });

  const start = Date.now();

  try {
    const result = await model.generateContent(CHAPTER_PROMPT);
    const latencyMs = Date.now() - start;
    const responseRaw = result.response.text();

    return parseAndValidateChapter("gemini", responseRaw, latencyMs);
  } catch (error) {
    return {
      provider: "gemini",
      success: false,
      responseRaw: "",
      parsed: null,
      parseError: error instanceof Error ? error.message : "Unknown error",
      validationErrors: [],
      verseCount: 0,
      latencyMs: Date.now() - start,
    };
  }
}

function parseAndValidateChapter(
  provider: string,
  responseRaw: string,
  latencyMs: number
): ChapterProviderResult {
  let parsed: ChapterResponse | null = null;
  let parseError: string | null = null;

  try {
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

    parsed = JSON.parse(jsonStr) as ChapterResponse;
  } catch (error) {
    parseError = error instanceof Error ? error.message : "JSON parse failed";
  }

  if (!parsed) {
    return {
      provider,
      success: false,
      responseRaw,
      parsed: null,
      parseError,
      validationErrors: [],
      verseCount: 0,
      latencyMs,
    };
  }

  const validationErrors: string[] = [];

  if (typeof parsed.book !== "string") {
    validationErrors.push("book is not a string");
  }
  if (parsed.chapter === undefined) {
    validationErrors.push("chapter is missing");
  }
  if (!Array.isArray(parsed.verses)) {
    validationErrors.push("verses is not an array");
  }

  // Validate metadata
  if (parsed.book?.toLowerCase() !== PSALM_117.book.toLowerCase()) {
    validationErrors.push(`book mismatch: expected "${PSALM_117.book}", got "${parsed.book}"`);
  }
  if (String(parsed.chapter) !== String(PSALM_117.chapter)) {
    validationErrors.push(`chapter mismatch: expected "${PSALM_117.chapter}", got "${parsed.chapter}"`);
  }

  // Validate verse count
  const verseCount = Array.isArray(parsed.verses) ? parsed.verses.length : 0;
  if (verseCount !== PSALM_117.verses.length) {
    validationErrors.push(`verse count mismatch: expected ${PSALM_117.verses.length}, got ${verseCount}`);
  }

  // Validate each verse has required fields
  if (Array.isArray(parsed.verses)) {
    for (let i = 0; i < parsed.verses.length; i++) {
      const v = parsed.verses[i];
      if (!v || typeof v.verseText !== "string") {
        validationErrors.push(`verse ${i + 1} missing verseText`);
      }
      if (!v || v.verseNumber === undefined) {
        validationErrors.push(`verse ${i + 1} missing verseNumber`);
      }
    }
  }

  return {
    provider,
    success: validationErrors.length === 0 && verseCount === PSALM_117.verses.length,
    responseRaw,
    parsed,
    parseError,
    validationErrors,
    verseCount,
    latencyMs,
  };
}

// ============================================================================
// CHAPTER-LEVEL TEST SUITE
// ============================================================================

describe("Structured Output Spike - Chapter (Psalm 117)", () => {
  it("should display chapter test info", () => {
    console.log("\n" + "=".repeat(70));
    console.log("CHAPTER-LEVEL STRUCTURED OUTPUT TEST - Psalm 117");
    console.log("=".repeat(70));
    console.log("\nPsalm 117 is the shortest chapter in the Bible (2 verses).");
    console.log("This tests the verse array structure for chapter responses.\n");
  });

  it("should test OpenAI chapter output", async () => {
    console.log("\n--- OPENAI CHAPTER (gpt-4o) ---");
    const result = await testOpenAIChapter();
    printChapterResult(result);
    
    if (isSkippableProviderError(result.parseError)) {
      console.log("  ⚠️  Skipped (no API key or rate limited)");
      return;
    }
    
    assert.ok(result.parsed !== null, "Should parse JSON successfully");
    assert.ok(Array.isArray(result.parsed?.verses), "Should have verses array");
  });

  it("should test Anthropic chapter output", async () => {
    console.log("\n--- ANTHROPIC CHAPTER (claude-sonnet-4) ---");
    const result = await testAnthropicChapter();
    printChapterResult(result);
    
    if (isSkippableProviderError(result.parseError)) {
      console.log("  ⚠️  Skipped (no API key or rate limited)");
      return;
    }
    
    assert.ok(result.parsed !== null, "Should parse JSON successfully");
    assert.ok(Array.isArray(result.parsed?.verses), "Should have verses array");
  });

  it("should test Gemini chapter output", async () => {
    console.log("\n--- GEMINI CHAPTER (gemini-2.0-flash) ---");
    const result = await testGeminiChapter();
    printChapterResult(result);
    
    if (isSkippableProviderError(result.parseError)) {
      console.log("  ⚠️  Skipped (no API key or rate limited)");
      return;
    }
    
    assert.ok(result.parsed !== null, "Should parse JSON successfully");
    assert.ok(Array.isArray(result.parsed?.verses), "Should have verses array");
  });

  it("should display chapter summary", async () => {
    console.log("\n" + "=".repeat(70));
    console.log("CHAPTER TEST SUMMARY");
    console.log("=".repeat(70));

    const results = await Promise.all([
      testOpenAIChapter(),
      testAnthropicChapter(),
      testGeminiChapter(),
    ]);

    console.log("\n📊 CHAPTER SUMMARY:");
    console.log("-".repeat(70));
    console.log(
      "Provider".padEnd(15) +
      "JSON Parse".padEnd(12) +
      "Has Array".padEnd(12) +
      "Verse Count".padEnd(14) +
      "Latency"
    );
    console.log("-".repeat(70));

    for (const r of results) {
      const jsonParse = r.parsed
        ? "✓"
        : isSkippableProviderError(r.parseError)
          ? "⚠️ skip"
          : "✗";
      const hasArray = Array.isArray(r.parsed?.verses) ? "✓" : "✗";
      const verseCount = r.verseCount === PSALM_117.verses.length 
        ? `✓ ${r.verseCount}` 
        : `✗ ${r.verseCount}/${PSALM_117.verses.length}`;
      const latency = r.latencyMs > 0 ? `${r.latencyMs}ms` : "-";

      console.log(
        r.provider.padEnd(15) +
        jsonParse.padEnd(12) +
        hasArray.padEnd(12) +
        verseCount.padEnd(14) +
        latency
      );
    }

    console.log("-".repeat(70));

    // Show verse text samples
    const successful = results.filter((r) => r.parsed?.verses?.length === PSALM_117.verses.length);
    if (successful.length > 0) {
      console.log("\n📖 VERSE TEXT SAMPLES (from first successful provider):");
      const first = successful[0];
      if (first?.parsed?.verses) {
        for (const v of first.parsed.verses) {
          console.log(`  v${v.verseNumber}: "${v.verseText?.substring(0, 50)}..."`);
        }
      }
    }

    // Show any validation errors
    const withErrors = results.filter((r) => r.validationErrors.length > 0);
    if (withErrors.length > 0) {
      console.log("\n⚠️  VALIDATION ISSUES:");
      for (const r of withErrors) {
        console.log(`  ${r.provider}:`);
        for (const err of r.validationErrors) {
          console.log(`    - ${err}`);
        }
      }
    }

    const allSuccess = results.filter((r) => r.success);
    const allTested = results.filter((r) => !r.parseError?.includes("not set"));
    
    console.log("\n" + "=".repeat(70));
    console.log(`RESULT: ${allSuccess.length}/${allTested.length} providers achieved correct structure`);
    console.log("=".repeat(70) + "\n");
  });
});

function printChapterResult(result: ChapterProviderResult) {
  console.log(`  Latency: ${result.latencyMs}ms`);
  
  if (result.parseError) {
    console.log(`  Parse Error: ${result.parseError}`);
    return;
  }

  console.log(`  Raw Response: ${result.responseRaw.substring(0, 100)}...`);
  console.log(`  Book: ${result.parsed?.book}, Chapter: ${result.parsed?.chapter}`);
  console.log(`  Verses Array: ${Array.isArray(result.parsed?.verses) ? "✓" : "✗"}`);
  console.log(`  Verse Count: ${result.verseCount} (expected: ${PSALM_117.verses.length})`);
  
  if (result.validationErrors.length > 0) {
    console.log(`  Validation Errors: ${result.validationErrors.join(", ")}`);
  }
}
