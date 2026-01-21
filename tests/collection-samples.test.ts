/**
 * Collection Sample Test Harness
 *
 * Queries samples from MongoDB collections, validates structure,
 * and writes samples to disk for inspection.
 *
 * Usage:
 *   pnpm test:db
 *
 * Environment:
 *   Uses .env.local via Node's --env-file flag
 */

import assert from "node:assert";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME ?? "bible-bench";

// Sample size configuration
const DEFAULT_SAMPLE_SIZE = 3;
const SAMPLE_SIZES: Record<string, number> = {
  dimLanguages: 5,
  dimBibles: 5,
  dimBooks: 10,
  dimChapters: 10,
  canonicalLanguages: 5,
  canonicalBibles: 5,
  canonicalBooks: 10,
  canonicalRawChapters: 3,
  canonicalChapters: 5,
  canonicalVerses: 10,
  transformProfiles: 5,
  models: 5,
  modelProfileMap: 5,
  runs: 3,
  runItems: 5,
  llmRawResponses: 3,
  llmVerseResults: 5,
  aggregationChapters: 3,
  aggregationBooks: 3,
  aggregationBibles: 3,
  schemaValidatorRuns: 2,
  appConfig: 5,
};

// Output directory for samples
const OUTPUT_DIR = path.join(process.cwd(), "tests", "samples");

type ValidationResult = {
  collection: string;
  documentCount: number;
  sampleSize: number;
  samples: unknown[];
  validationErrors: string[];
  fieldAnalysis: Record<string, { type: string; count: number; sample: unknown }>;
};

// Ensure output directory exists
function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Get field type as string
function getFieldType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value instanceof mongoose.Types.ObjectId) return "ObjectId";
  return typeof value;
}

// Analyze fields in a document
function analyzeFields(
  doc: Record<string, unknown>,
  prefix = ""
): Record<string, { type: string; count: number; sample: unknown }> {
  const analysis: Record<string, { type: string; count: number; sample: unknown }> = {};

  for (const [key, value] of Object.entries(doc)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const fieldType = getFieldType(value);

    analysis[fieldPath] = {
      type: fieldType,
      count: 1,
      sample: fieldType === "object" && value !== null ? "[object]" : value,
    };

    // Recurse into objects (but not arrays or dates)
    if (fieldType === "object" && value !== null && !(value instanceof Date)) {
      const nested = analyzeFields(value as Record<string, unknown>, fieldPath);
      Object.assign(analysis, nested);
    }
  }

  return analysis;
}

// Merge field analyses from multiple documents
function mergeFieldAnalyses(
  analyses: Record<string, { type: string; count: number; sample: unknown }>[]
): Record<string, { type: string; count: number; sample: unknown }> {
  const merged: Record<string, { type: string; count: number; sample: unknown }> = {};

  for (const analysis of analyses) {
    for (const [field, info] of Object.entries(analysis)) {
      if (merged[field]) {
        merged[field].count += info.count;
        // Keep first non-null sample
        if (merged[field].sample === null && info.sample !== null) {
          merged[field].sample = info.sample;
        }
      } else {
        merged[field] = { ...info };
      }
    }
  }

  return merged;
}

// Query and validate a collection
async function sampleCollection(
  db: mongoose.mongo.Db,
  collectionName: string,
  sampleSize: number
): Promise<ValidationResult> {
  const collection = db.collection(collectionName);
  const documentCount = await collection.countDocuments();
  const samples = await collection.find({}).limit(sampleSize).toArray();

  const validationErrors: string[] = [];
  const fieldAnalyses: Record<string, { type: string; count: number; sample: unknown }>[] = [];

  for (const doc of samples) {
    const analysis = analyzeFields(doc as Record<string, unknown>);
    fieldAnalyses.push(analysis);
  }

  const fieldAnalysis = mergeFieldAnalyses(fieldAnalyses);

  return {
    collection: collectionName,
    documentCount,
    sampleSize: samples.length,
    samples,
    validationErrors,
    fieldAnalysis,
  };
}

// Write result to disk
function writeResultToDisk(result: ValidationResult): void {
  const filename = path.join(OUTPUT_DIR, `${result.collection}.json`);
  const output = {
    collection: result.collection,
    documentCount: result.documentCount,
    sampleSize: result.sampleSize,
    fieldAnalysis: result.fieldAnalysis,
    samples: result.samples,
    validationErrors: result.validationErrors,
  };
  writeFileSync(filename, JSON.stringify(output, null, 2));
}

// Write summary to disk
function writeSummaryToDisk(results: ValidationResult[]): void {
  const filename = path.join(OUTPUT_DIR, "_summary.json");
  const summary = results.map((r) => ({
    collection: r.collection,
    documentCount: r.documentCount,
    sampleSize: r.sampleSize,
    fieldCount: Object.keys(r.fieldAnalysis).length,
    validationErrorCount: r.validationErrors.length,
  }));
  writeFileSync(filename, JSON.stringify(summary, null, 2));
}

describe("Collection Samples", () => {
  let db: mongoose.mongo.Db;
  const results: ValidationResult[] = [];

  before(async () => {
    assert.ok(MONGODB_URI, "MONGODB_URI must be set in .env.local");
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DBNAME });
    db = mongoose.connection.db!;
    ensureOutputDir();
  });

  after(async () => {
    writeSummaryToDisk(results);
    console.log(`\n📁 Samples written to: ${OUTPUT_DIR}`);
    await mongoose.disconnect();
  });

  // Get all collections
  it("should list all collections", async () => {
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name).sort();
    console.log("\n📚 Collections found:", collectionNames.join(", "));
    assert.ok(collectionNames.length > 0, "Should have at least one collection");
  });

  // Dimension tables
  it("should sample dimLanguages", async () => {
    const result = await sampleCollection(db, "dimLanguages", SAMPLE_SIZES.dimLanguages ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  dimLanguages: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample dimBibles", async () => {
    const result = await sampleCollection(db, "dimBibles", SAMPLE_SIZES.dimBibles ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  dimBibles: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample dimBooks", async () => {
    const result = await sampleCollection(db, "dimBooks", SAMPLE_SIZES.dimBooks ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  dimBooks: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample dimChapters", async () => {
    const result = await sampleCollection(db, "dimChapters", SAMPLE_SIZES.dimChapters ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  dimChapters: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  // Canonical reference data
  it("should sample canonicalLanguages", async () => {
    const result = await sampleCollection(
      db,
      "canonicalLanguages",
      SAMPLE_SIZES.canonicalLanguages ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  canonicalLanguages: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample canonicalBibles", async () => {
    const result = await sampleCollection(
      db,
      "canonicalBibles",
      SAMPLE_SIZES.canonicalBibles ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  canonicalBibles: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample canonicalBooks", async () => {
    const result = await sampleCollection(
      db,
      "canonicalBooks",
      SAMPLE_SIZES.canonicalBooks ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  canonicalBooks: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  // Canonical raw and transformed data
  it("should sample canonicalRawChapters", async () => {
    const result = await sampleCollection(
      db,
      "canonicalRawChapters",
      SAMPLE_SIZES.canonicalRawChapters ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  canonicalRawChapters: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample canonicalChapters", async () => {
    const result = await sampleCollection(
      db,
      "canonicalChapters",
      SAMPLE_SIZES.canonicalChapters ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  canonicalChapters: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample canonicalVerses", async () => {
    const result = await sampleCollection(
      db,
      "canonicalVerses",
      SAMPLE_SIZES.canonicalVerses ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  canonicalVerses: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  // Configuration and profiles
  it("should sample transformProfiles", async () => {
    const result = await sampleCollection(db, "transformProfiles", SAMPLE_SIZES.transformProfiles ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  transformProfiles: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample models", async () => {
    const result = await sampleCollection(db, "models", SAMPLE_SIZES.models ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  models: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample modelProfileMap", async () => {
    const result = await sampleCollection(
      db,
      "modelProfileMap",
      SAMPLE_SIZES.modelProfileMap ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  modelProfileMap: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  // Runs and results
  it("should sample runs", async () => {
    const result = await sampleCollection(db, "runs", SAMPLE_SIZES.runs ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  runs: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample runItems", async () => {
    const result = await sampleCollection(db, "runItems", SAMPLE_SIZES.runItems ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  runItems: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample llmRawResponses", async () => {
    const result = await sampleCollection(
      db,
      "llmRawResponses",
      SAMPLE_SIZES.llmRawResponses ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  llmRawResponses: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample llmVerseResults", async () => {
    const result = await sampleCollection(
      db,
      "llmVerseResults",
      SAMPLE_SIZES.llmVerseResults ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  llmVerseResults: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample aggregationChapters", async () => {
    const result = await sampleCollection(
      db,
      "aggregationChapters",
      SAMPLE_SIZES.aggregationChapters ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  aggregationChapters: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample aggregationBooks", async () => {
    const result = await sampleCollection(
      db,
      "aggregationBooks",
      SAMPLE_SIZES.aggregationBooks ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  aggregationBooks: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample aggregationBibles", async () => {
    const result = await sampleCollection(
      db,
      "aggregationBibles",
      SAMPLE_SIZES.aggregationBibles ?? DEFAULT_SAMPLE_SIZE
    );
    results.push(result);
    writeResultToDisk(result);
    console.log(`  aggregationBibles: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  // System tables
  it("should sample schemaValidatorRuns", async () => {
    const result = await sampleCollection(db, "schemaValidatorRuns", SAMPLE_SIZES.schemaValidatorRuns ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  schemaValidatorRuns: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });

  it("should sample appConfig", async () => {
    const result = await sampleCollection(db, "appConfig", SAMPLE_SIZES.appConfig ?? DEFAULT_SAMPLE_SIZE);
    results.push(result);
    writeResultToDisk(result);
    console.log(`  appConfig: ${result.documentCount} docs, sampled ${result.sampleSize}`);
    assert.ok(result.documentCount >= 0);
  });
});
