/**
 * Schema Validation Test Harness
 *
 * Validates documents in each collection against expected schemas
 * defined in the data model specifications.
 *
 * Usage:
 *   pnpm test:db
 *
 * Environment:
 *   Uses .env.local via Node's --env-file flag
 */

import assert from "node:assert";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME ?? "bible-bench";

// Sample size for validation (increase for more thorough testing)
const VALIDATION_SAMPLE_SIZE = 50;

const OUTPUT_DIR = path.join(process.cwd(), "tests", "samples");

// Schema definitions for validation
type FieldSpec = {
  type: "string" | "number" | "boolean" | "date" | "object" | "array" | "objectId";
  required: boolean;
  nullable?: boolean;
  nested?: Record<string, FieldSpec>;
  items?: FieldSpec;
};

type CollectionSpec = {
  name: string;
  fields: Record<string, FieldSpec>;
};

// Audit subdocument spec (reused across collections)
const auditSpec: Record<string, FieldSpec> = {
  createdAt: { type: "date", required: true },
  createdBy: { type: "string", required: true },
};

// ETL Control subdocument spec
const etlControlSpec: Record<string, FieldSpec> = {
  stage: { type: "string", required: true },
  isLocked: { type: "boolean", required: true },
  lockedBy: { type: "string", required: false, nullable: true },
  lockedAt: { type: "date", required: false, nullable: true },
  lastProcessedBy: { type: "string", required: false, nullable: true },
  lastProcessedAt: { type: "date", required: false, nullable: true },
  batchId: { type: "string", required: false, nullable: true },
};

// Collection specifications
const COLLECTION_SPECS: CollectionSpec[] = [
  {
    name: "dimLanguages",
    fields: {
      _id: { type: "objectId", required: true },
      languageId: { type: "number", required: true },
      isoCode: { type: "string", required: true },
      name: { type: "string", required: true },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "dimBibles",
    fields: {
      _id: { type: "objectId", required: true },
      bibleId: { type: "number", required: true },
      apiBibleId: { type: "string", required: true },
      languageId: { type: "number", required: true },
      name: { type: "string", required: true },
      source: { type: "string", required: true },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "dimBooks",
    fields: {
      _id: { type: "objectId", required: true },
      bookId: { type: "number", required: true },
      bibleId: { type: "number", required: true },
      bookCode: { type: "string", required: true },
      bookName: { type: "string", required: true },
      bookIndex: { type: "number", required: true },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "canonicalRawChapters",
    fields: {
      _id: { type: "objectId", required: true },
      rawChapterId: { type: "number", required: true },
      bibleId: { type: "number", required: true },
      bookId: { type: "number", required: true },
      chapterNumber: { type: "number", required: true },
      reference: { type: "string", required: true },
      rawPayload: { type: "object", required: true },
      hashRaw: { type: "string", required: true },
      source: { type: "string", required: true },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "canonicalChapters",
    fields: {
      _id: { type: "objectId", required: true },
      chapterId: { type: "number", required: true },
      bibleId: { type: "number", required: true },
      bookId: { type: "number", required: true },
      chapterNumber: { type: "number", required: true },
      reference: { type: "string", required: true },
      textRaw: { type: "string", required: true },
      textProcessed: { type: "string", required: true },
      hashRaw: { type: "string", required: true },
      hashProcessed: { type: "string", required: true },
      rawChapterId: { type: "number", required: true },
      transformProfileId: { type: "number", required: true },
      etlControl: { type: "object", required: true, nested: etlControlSpec },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "canonicalVerses",
    fields: {
      _id: { type: "objectId", required: true },
      verseId: { type: "number", required: true },
      chapterId: { type: "number", required: true },
      bibleId: { type: "number", required: true },
      bookId: { type: "number", required: true },
      chapterNumber: { type: "number", required: true },
      verseNumber: { type: "number", required: true },
      reference: { type: "string", required: true },
      textRaw: { type: "string", required: true },
      textProcessed: { type: "string", required: true },
      hashRaw: { type: "string", required: true },
      hashProcessed: { type: "string", required: true },
      transformProfileId: { type: "number", required: true },
      etlControl: { type: "object", required: true, nested: etlControlSpec },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "transformProfiles",
    fields: {
      _id: { type: "objectId", required: true },
      profileId: { type: "number", required: true },
      name: { type: "string", required: true },
      scope: { type: "string", required: true },
      version: { type: "number", required: false },
      bibleId: { type: "number", required: false },
      isDefault: { type: "boolean", required: false },
      description: { type: "string", required: false, nullable: true },
      steps: { type: "array", required: true },
      isActive: { type: "boolean", required: true },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "models",
    fields: {
      _id: { type: "objectId", required: true },
      modelId: { type: "number", required: true },
      provider: { type: "string", required: true },
      displayName: { type: "string", required: true },
      version: { type: "string", required: true },
      routingMethod: { type: "string", required: true },
      isActive: { type: "boolean", required: true },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
  {
    name: "schemaValidatorRuns",
    fields: {
      _id: { type: "objectId", required: true },
      runId: { type: "string", required: true },
      dryRun: { type: "boolean", required: true },
      startedAt: { type: "date", required: true },
      completedAt: { type: "date", required: true },
      success: { type: "boolean", required: true },
      results: { type: "array", required: true },
      audit: { type: "object", required: true, nested: auditSpec },
    },
  },
];

type ValidationError = {
  collection: string;
  documentId: string;
  field: string;
  expected: string;
  actual: string;
  message: string;
};

// Get actual type of a value
function getActualType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value instanceof mongoose.Types.ObjectId) return "objectId";
  return typeof value;
}

// Validate a single document against a spec
function validateDocument(
  doc: Record<string, unknown>,
  spec: CollectionSpec,
  docId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [fieldName, fieldSpec] of Object.entries(spec.fields)) {
    const value = doc[fieldName];
    const actualType = getActualType(value);

    // Check required fields
    if (fieldSpec.required && (value === undefined || value === null)) {
      if (!(fieldSpec.nullable && value === null)) {
        errors.push({
          collection: spec.name,
          documentId: docId,
          field: fieldName,
          expected: fieldSpec.type,
          actual: actualType,
          message: `Required field missing or null`,
        });
        continue;
      }
    }

    // Skip undefined optional fields
    if (value === undefined && !fieldSpec.required) {
      continue;
    }

    // Skip null for nullable fields
    if (value === null && fieldSpec.nullable) {
      continue;
    }

    // Check type
    if (value !== undefined && value !== null) {
      if (actualType !== fieldSpec.type) {
        // Special case: objectId stored as string
        if (fieldSpec.type === "objectId" && actualType === "string") {
          continue;
        }
        // Special case: numbers can be stored as various BSON types
        if (fieldSpec.type === "number" && actualType === "number") {
          continue;
        }
        errors.push({
          collection: spec.name,
          documentId: docId,
          field: fieldName,
          expected: fieldSpec.type,
          actual: actualType,
          message: `Type mismatch`,
        });
      }

      // Validate nested objects
      if (fieldSpec.type === "object" && fieldSpec.nested && typeof value === "object") {
        for (const [nestedField, nestedSpec] of Object.entries(fieldSpec.nested)) {
          const nestedValue = (value as Record<string, unknown>)[nestedField];
          const nestedActualType = getActualType(nestedValue);

          if (nestedSpec.required && (nestedValue === undefined || nestedValue === null)) {
            if (!(nestedSpec.nullable && nestedValue === null)) {
              errors.push({
                collection: spec.name,
                documentId: docId,
                field: `${fieldName}.${nestedField}`,
                expected: nestedSpec.type,
                actual: nestedActualType,
                message: `Required nested field missing`,
              });
            }
          } else if (nestedValue !== undefined && nestedValue !== null) {
            if (nestedActualType !== nestedSpec.type) {
              errors.push({
                collection: spec.name,
                documentId: docId,
                field: `${fieldName}.${nestedField}`,
                expected: nestedSpec.type,
                actual: nestedActualType,
                message: `Nested field type mismatch`,
              });
            }
          }
        }
      }
    }
  }

  return errors;
}

describe("Schema Validation", () => {
  let db: mongoose.mongo.Db;
  const allErrors: ValidationError[] = [];
  const collectionStats: Record<string, { total: number; sampled: number; errors: number }> = {};

  before(async () => {
    assert.ok(MONGODB_URI, "MONGODB_URI must be set in .env.local");
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DBNAME });
    db = mongoose.connection.db!;

    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  after(async () => {
    // Write validation report
    const report = {
      timestamp: new Date().toISOString(),
      sampleSize: VALIDATION_SAMPLE_SIZE,
      totalErrors: allErrors.length,
      collectionStats,
      errors: allErrors,
    };
    writeFileSync(
      path.join(OUTPUT_DIR, "_validation_report.json"),
      JSON.stringify(report, null, 2)
    );

    console.log("\n📊 Validation Summary:");
    for (const [name, stats] of Object.entries(collectionStats)) {
      const status = stats.errors === 0 ? "✅" : "❌";
      console.log(`  ${status} ${name}: ${stats.sampled}/${stats.total} docs, ${stats.errors} errors`);
    }
    console.log(`\n📁 Report written to: ${path.join(OUTPUT_DIR, "_validation_report.json")}`);

    await mongoose.disconnect();
  });

  for (const spec of COLLECTION_SPECS) {
    it(`should validate ${spec.name} documents`, async () => {
      const collection = db.collection(spec.name);
      const total = await collection.countDocuments();
      const docs = await collection.find({}).limit(VALIDATION_SAMPLE_SIZE).toArray();

      let errorCount = 0;
      for (const doc of docs) {
        const docId = String(doc._id);
        const errors = validateDocument(doc as Record<string, unknown>, spec, docId);
        if (errors.length > 0) {
          errorCount += errors.length;
          allErrors.push(...errors);
        }
      }

      collectionStats[spec.name] = {
        total,
        sampled: docs.length,
        errors: errorCount,
      };

      // Don't fail test if collection is empty
      if (total === 0) {
        console.log(`  ⚠️  ${spec.name}: Empty collection`);
        return;
      }

      assert.strictEqual(errorCount, 0, `Found ${errorCount} validation errors in ${spec.name}`);
    });
  }
});
