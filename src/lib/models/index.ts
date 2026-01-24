import mongoose, { Schema, type InferSchemaType } from "mongoose";

type JsonSchemaProperty = {
  bsonType: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  additionalProperties?: boolean;
  description?: string;
};

type JsonSchemaValidator = {
  $jsonSchema: JsonSchemaProperty;
};

const numberSchema: JsonSchemaProperty = {
  bsonType: ["int", "long", "double", "decimal"],
};

const stringSchema: JsonSchemaProperty = {
  bsonType: "string",
};

const dateSchema: JsonSchemaProperty = {
  bsonType: "date",
};

const boolSchema: JsonSchemaProperty = {
  bsonType: "bool",
};

const nullableStringSchema: JsonSchemaProperty = {
  bsonType: ["string", "null"],
};

const nullableDateSchema: JsonSchemaProperty = {
  bsonType: ["date", "null"],
};

const auditJsonSchema: JsonSchemaProperty = {
  bsonType: "object",
  required: ["createdAt", "createdBy"],
  properties: {
    createdAt: dateSchema,
    createdBy: stringSchema,
  },
  additionalProperties: true,
};

const etlControlJsonSchema: JsonSchemaProperty = {
  bsonType: "object",
  required: ["stage", "isLocked"],
  properties: {
    stage: stringSchema,
    isLocked: boolSchema,
    lockedBy: nullableStringSchema,
    lockedAt: nullableDateSchema,
    lastProcessedBy: nullableStringSchema,
    lastProcessedAt: nullableDateSchema,
    batchId: nullableStringSchema,
  },
  additionalProperties: true,
};

export const dimLanguagesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["languageId", "isoCode", "name", "audit"],
    properties: {
      languageId: numberSchema,
      isoCode: stringSchema,
      name: stringSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const dimBiblesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["bibleId", "apiBibleId", "languageId", "name", "source", "audit"],
    properties: {
      bibleId: numberSchema,
      apiBibleId: stringSchema,
      languageId: numberSchema,
      name: stringSchema,
      source: stringSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const dimBooksValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["bookId", "bibleId", "bookCode", "bookName", "bookIndex", "audit"],
    properties: {
      bookId: numberSchema,
      bibleId: numberSchema,
      bookCode: stringSchema,
      bookName: stringSchema,
      bookIndex: numberSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const dimChaptersValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "chapterId",
      "bibleId",
      "bookId",
      "chapterNumber",
      "reference",
      "chapterName",
      "verseCount",
      "audit",
    ],
    properties: {
      chapterId: numberSchema,
      bibleId: numberSchema,
      bookId: numberSchema,
      chapterNumber: numberSchema,
      reference: stringSchema,
      chapterName: stringSchema,
      verseCount: numberSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const dimCampaignsValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "campaignId",
      "campaignTag",
      "campaignName",
      "isActive",
      "isApproved",
      "isVisible",
      "audit",
    ],
    properties: {
      campaignId: numberSchema,
      campaignTag: stringSchema,
      campaignName: stringSchema,
      campaignDescription: nullableStringSchema,
      campaignStartDate: nullableDateSchema,
      campaignEndDate: nullableDateSchema,
      campaignPurposeStatement: nullableStringSchema,
      campaignManager: nullableStringSchema,
      isActive: boolSchema,
      isApproved: boolSchema,
      isVisible: boolSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const canonicalLanguagesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["languageId", "isoCode", "name", "audit"],
    properties: {
      languageId: numberSchema,
      isoCode: stringSchema,
      name: stringSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const canonicalBiblesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["bibleId", "apiBibleId", "languageId", "name", "source", "audit"],
    properties: {
      bibleId: numberSchema,
      apiBibleId: stringSchema,
      languageId: numberSchema,
      name: stringSchema,
      source: stringSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const canonicalBooksValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["bookId", "bibleId", "bookCode", "bookName", "bookIndex", "audit"],
    properties: {
      bookId: numberSchema,
      bibleId: numberSchema,
      bookCode: stringSchema,
      bookName: stringSchema,
      bookIndex: numberSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const canonicalRawChaptersValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "rawChapterId",
      "bibleId",
      "bookId",
      "chapterNumber",
      "reference",
      "rawPayload",
      "hashRaw",
      "source",
      "audit",
    ],
    properties: {
      rawChapterId: numberSchema,
      bibleId: numberSchema,
      bookId: numberSchema,
      chapterNumber: numberSchema,
      reference: stringSchema,
      sourceRef: stringSchema,
      rawPayload: {
        bsonType: "object",
        additionalProperties: true,
      },
      hashRaw: stringSchema,
      sourceHash: stringSchema,
      source: stringSchema,
      ingestedAt: dateSchema,
      ingestedBy: stringSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const canonicalChaptersValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "chapterId",
      "bibleId",
      "bookId",
      "chapterNumber",
      "reference",
      "textRaw",
      "textProcessed",
      "hashRaw",
      "hashProcessed",
      "rawChapterId",
      "transformProfileId",
      "etlControl",
      "audit",
    ],
    properties: {
      chapterId: numberSchema,
      bibleId: numberSchema,
      bookId: numberSchema,
      chapterNumber: numberSchema,
      reference: stringSchema,
      textRaw: stringSchema,
      textProcessed: stringSchema,
      hashRaw: stringSchema,
      hashProcessed: stringSchema,
      rawChapterId: numberSchema,
      transformProfileId: numberSchema,
      etlControl: etlControlJsonSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const canonicalVersesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "verseId",
      "chapterId",
      "bibleId",
      "bookId",
      "chapterNumber",
      "verseNumber",
      "reference",
      "textRaw",
      "textProcessed",
      "hashRaw",
      "hashProcessed",
      "transformProfileId",
      "etlControl",
      "audit",
    ],
    properties: {
      verseId: numberSchema,
      chapterId: numberSchema,
      bibleId: numberSchema,
      bookId: numberSchema,
      chapterNumber: numberSchema,
      verseNumber: numberSchema,
      reference: stringSchema,
      textRaw: stringSchema,
      textProcessed: stringSchema,
      hashRaw: stringSchema,
      hashProcessed: stringSchema,
      offsetStart: numberSchema,
      offsetEnd: numberSchema,
      transformProfileId: numberSchema,
      etlControl: etlControlJsonSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const transformProfilesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["profileId", "name", "scope", "steps", "isActive", "audit"],
    properties: {
      profileId: numberSchema,
      name: stringSchema,
      scope: stringSchema,
      version: numberSchema,
      bibleId: numberSchema,
      isDefault: boolSchema,
      description: nullableStringSchema,
      steps: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["order", "type", "enabled"],
          properties: {
            order: numberSchema,
            type: stringSchema,
            enabled: boolSchema,
            params: {
              bsonType: "object",
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
      },
      isActive: boolSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const schemaValidatorRunsValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["runId", "dryRun", "startedAt", "completedAt", "success", "results", "audit"],
    properties: {
      runId: stringSchema,
      dryRun: boolSchema,
      startedAt: dateSchema,
      completedAt: dateSchema,
      success: boolSchema,
      results: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["name", "action", "ok"],
          properties: {
            name: stringSchema,
            action: stringSchema,
            ok: boolSchema,
            error: nullableStringSchema,
          },
          additionalProperties: true,
        },
      },
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const modelsValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "modelId",
      "provider",
      "displayName",
      "version",
      "routingMethod",
      "isActive",
      "audit",
    ],
    properties: {
      modelId: numberSchema,
      provider: stringSchema,
      displayName: stringSchema,
      version: stringSchema,
      routingMethod: stringSchema,
      isActive: boolSchema,
      releasedAt: nullableDateSchema,
      apiConfigEncrypted: {
        bsonType: ["object", "null"],
        additionalProperties: true,
      },
      capabilities: {
        bsonType: "object",
        properties: {
          supportsJsonSchema: boolSchema,
          supportsToolCalls: boolSchema,
          supportsStrictJson: boolSchema,
          supportsStreaming: boolSchema,
        },
        additionalProperties: true,
      },
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const modelProfileMapValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["modelId", "modelProfileId", "audit"],
    properties: {
      modelId: numberSchema,
      modelProfileId: numberSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const runsValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "runId",
      "campaignTag",
      "runType",
      "modelId",
      "scope",
      "scopeIds",
      "status",
      "startedAt",
      "metrics",
      "audit",
    ],
    properties: {
      runId: stringSchema,
      campaignTag: stringSchema,
      runType: stringSchema,
      modelId: numberSchema,
      scope: stringSchema,
      scopeIds: {
        bsonType: "object",
        additionalProperties: true,
      },
      scopeParams: {
        bsonType: "object",
        additionalProperties: true,
      },
      status: stringSchema,
      cancelRequested: boolSchema,
      startedAt: dateSchema,
      completedAt: nullableDateSchema,
      metrics: {
        bsonType: "object",
        additionalProperties: true,
      },
      logs: {
        bsonType: "array",
        items: {
          bsonType: "object",
          properties: {
            stage: stringSchema,
            level: stringSchema,
            message: stringSchema,
            timestamp: dateSchema,
          },
          additionalProperties: true,
        },
      },
      errorSummary: {
        bsonType: ["object", "null"],
        properties: {
          failedCount: numberSchema,
          lastError: nullableStringSchema,
          lastErrorAt: nullableDateSchema,
        },
        additionalProperties: true,
      },
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const runItemsValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["runId", "targetType", "targetId", "status", "attempts", "updatedAt"],
    properties: {
      runId: stringSchema,
      targetType: stringSchema,
      targetId: numberSchema,
      status: stringSchema,
      attempts: numberSchema,
      lastError: nullableStringSchema,
      updatedAt: dateSchema,
    },
    additionalProperties: true,
  },
};

export const llmRawResponsesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "responseId",
      "runId",
      "modelId",
      "targetType",
      "targetId",
      "evaluatedAt",
      "responseRaw",
      "audit",
    ],
    properties: {
      responseId: numberSchema,
      runId: stringSchema,
      modelId: numberSchema,
      targetType: stringSchema,
      targetId: numberSchema,
      evaluatedAt: dateSchema,
      responseRaw: stringSchema,
      systemPrompt: nullableStringSchema,
      userPrompt: nullableStringSchema,
      parsed: {
        bsonType: ["object", "null"],
        additionalProperties: true,
      },
      parseError: nullableStringSchema,
      extractedText: nullableStringSchema,
      latencyMs: numberSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const llmVerseResultsValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "resultId",
      "campaignTag",
      "runId",
      "modelId",
      "verseId",
      "chapterId",
      "bookId",
      "bibleId",
      "evaluatedAt",
      "responseRaw",
      "responseProcessed",
      "hashRaw",
      "hashProcessed",
      "hashMatch",
      "fidelityScore",
      "diff",
      "audit",
    ],
    properties: {
      resultId: numberSchema,
      campaignTag: stringSchema,
      runId: stringSchema,
      modelId: numberSchema,
      verseId: numberSchema,
      chapterId: numberSchema,
      bookId: numberSchema,
      bibleId: numberSchema,
      evaluatedAt: dateSchema,
      responseRaw: stringSchema,
      responseProcessed: stringSchema,
      hashRaw: stringSchema,
      hashProcessed: stringSchema,
      hashMatch: boolSchema,
      fidelityScore: numberSchema,
      diff: {
        bsonType: "object",
        additionalProperties: true,
      },
      latencyMs: numberSchema,
      audit: auditJsonSchema,
    },
    additionalProperties: true,
  },
};

export const appConfigValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["key", "value", "modifiedAt", "modifiedBy"],
    properties: {
      key: stringSchema,
      value: stringSchema,
      modifiedAt: dateSchema,
      modifiedBy: stringSchema,
    },
    additionalProperties: true,
  },
};

// Aggregate validators for materialized roll-ups
export const aggregationChaptersValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "campaignTag",
      "chapterId",
      "modelId",
      "bibleId",
      "bookId",
      "evaluatedAt",
      "avgFidelity",
      "perfectRate",
      "verseCount",
      "matchCount",
    ],
    properties: {
      campaignTag: stringSchema,
      chapterId: numberSchema,
      modelId: numberSchema,
      bibleId: numberSchema,
      bookId: numberSchema,
      evaluatedAt: dateSchema,
      avgFidelity: numberSchema,
      perfectRate: numberSchema,
      verseCount: numberSchema,
      matchCount: numberSchema,
    },
    additionalProperties: true,
  },
};

export const aggregationBooksValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "campaignTag",
      "bookId",
      "modelId",
      "bibleId",
      "evaluatedAt",
      "avgFidelity",
      "perfectRate",
      "chapterCount",
      "verseCount",
      "matchCount",
    ],
    properties: {
      campaignTag: stringSchema,
      bookId: numberSchema,
      modelId: numberSchema,
      bibleId: numberSchema,
      evaluatedAt: dateSchema,
      avgFidelity: numberSchema,
      perfectRate: numberSchema,
      chapterCount: numberSchema,
      verseCount: numberSchema,
      matchCount: numberSchema,
    },
    additionalProperties: true,
  },
};

export const aggregationBiblesValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "campaignTag",
      "bibleId",
      "modelId",
      "evaluatedAt",
      "avgFidelity",
      "perfectRate",
      "bookCount",
      "chapterCount",
      "verseCount",
      "matchCount",
    ],
    properties: {
      campaignTag: stringSchema,
      bibleId: numberSchema,
      modelId: numberSchema,
      evaluatedAt: dateSchema,
      avgFidelity: numberSchema,
      perfectRate: numberSchema,
      bookCount: numberSchema,
      chapterCount: numberSchema,
      verseCount: numberSchema,
      matchCount: numberSchema,
    },
    additionalProperties: true,
  },
};

const auditSchema = new Schema(
  {
    createdAt: { type: Date, required: true },
    createdBy: { type: String, required: true },
  },
  { _id: false }
);

const etlControlSchema = new Schema(
  {
    stage: { type: String, required: true },
    isLocked: { type: Boolean, required: true, default: false },
    lockedBy: { type: String, default: null },
    lockedAt: { type: Date, default: null },
    lastProcessedBy: { type: String, default: null },
    lastProcessedAt: { type: Date, default: null },
    batchId: { type: String, default: null },
  },
  { _id: false }
);

const dimLanguageSchema = new Schema({
  languageId: { type: Number, required: true },
  isoCode: { type: String, required: true },
  name: { type: String, required: true },
  audit: { type: auditSchema, required: true },
});

dimLanguageSchema.index({ languageId: 1 }, { unique: true });

type DimLanguage = InferSchemaType<typeof dimLanguageSchema>;

const dimBibleSchema = new Schema({
  bibleId: { type: Number, required: true },
  apiBibleId: { type: String, required: true },
  languageId: { type: Number, required: true },
  name: { type: String, required: true },
  source: { type: String, required: true },
  audit: { type: auditSchema, required: true },
});

dimBibleSchema.index({ bibleId: 1 }, { unique: true });
dimBibleSchema.index({ languageId: 1, name: 1 });

type DimBible = InferSchemaType<typeof dimBibleSchema>;

const dimBookSchema = new Schema({
  bookId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  bookCode: { type: String, required: true },
  bookName: { type: String, required: true },
  bookIndex: { type: Number, required: true },
  audit: { type: auditSchema, required: true },
});

dimBookSchema.index({ bookId: 1 }, { unique: true });
dimBookSchema.index({ bibleId: 1 });
dimBookSchema.index({ bibleId: 1, bookCode: 1 }, { unique: true });

type DimBook = InferSchemaType<typeof dimBookSchema>;

const dimChapterSchema = new Schema({
  chapterId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  bookId: { type: Number, required: true },
  chapterNumber: { type: Number, required: true },
  reference: { type: String, required: true },
  chapterName: { type: String, required: true },
  verseCount: { type: Number, required: true },
  audit: { type: auditSchema, required: true },
});

dimChapterSchema.index({ chapterId: 1 }, { unique: true });
dimChapterSchema.index({ bibleId: 1, bookId: 1 });
dimChapterSchema.index({ bookId: 1, chapterNumber: 1 });

type DimChapter = InferSchemaType<typeof dimChapterSchema>;

const dimCampaignSchema = new Schema({
  campaignId: { type: Number, required: true },
  campaignTag: { type: String, required: true },
  campaignName: { type: String, required: true },
  campaignDescription: { type: String, default: null },
  campaignStartDate: { type: Date, default: null },
  campaignEndDate: { type: Date, default: null },
  campaignPurposeStatement: { type: String, default: null },
  campaignManager: { type: String, default: null },
  isActive: { type: Boolean, required: true, default: true },
  isApproved: { type: Boolean, required: true, default: false },
  isVisible: { type: Boolean, required: true, default: true },
  audit: { type: auditSchema, required: true },
});

dimCampaignSchema.index({ campaignId: 1 }, { unique: true });
dimCampaignSchema.index({ campaignTag: 1 }, { unique: true });
dimCampaignSchema.index({ isActive: 1, isVisible: 1 });

type DimCampaign = InferSchemaType<typeof dimCampaignSchema>;

const canonicalLanguageSchema = new Schema({
  languageId: { type: Number, required: true },
  isoCode: { type: String, required: true },
  name: { type: String, required: true },
  audit: { type: auditSchema, required: true },
});

canonicalLanguageSchema.index({ languageId: 1 }, { unique: true });

type CanonicalLanguage = InferSchemaType<typeof canonicalLanguageSchema>;

const canonicalBibleSchema = new Schema({
  bibleId: { type: Number, required: true },
  apiBibleId: { type: String, required: true },
  languageId: { type: Number, required: true },
  name: { type: String, required: true },
  source: { type: String, required: true },
  audit: { type: auditSchema, required: true },
});

canonicalBibleSchema.index({ bibleId: 1 }, { unique: true });
canonicalBibleSchema.index({ languageId: 1, name: 1 });

type CanonicalBible = InferSchemaType<typeof canonicalBibleSchema>;

const canonicalBookSchema = new Schema({
  bookId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  bookCode: { type: String, required: true },
  bookName: { type: String, required: true },
  bookIndex: { type: Number, required: true },
  audit: { type: auditSchema, required: true },
});

canonicalBookSchema.index({ bookId: 1 }, { unique: true });
canonicalBookSchema.index({ bibleId: 1 });
canonicalBookSchema.index({ bibleId: 1, bookCode: 1 }, { unique: true });

type CanonicalBook = InferSchemaType<typeof canonicalBookSchema>;

const canonicalRawChapterSchema = new Schema({
  rawChapterId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  bookId: { type: Number, required: true },
  chapterNumber: { type: Number, required: true },
  reference: { type: String, required: true },
  sourceRef: { type: String },
  rawPayload: { type: Schema.Types.Mixed, required: true },
  hashRaw: { type: String, required: true },
  sourceHash: { type: String },
  source: { type: String, required: true },
  ingestedAt: { type: Date },
  ingestedBy: { type: String },
  audit: { type: auditSchema, required: true },
});

canonicalRawChapterSchema.index({ rawChapterId: 1 }, { unique: true });
canonicalRawChapterSchema.index({ bibleId: 1, bookId: 1, chapterNumber: 1 });

type CanonicalRawChapter = InferSchemaType<typeof canonicalRawChapterSchema>;

const canonicalChapterSchema = new Schema({
  chapterId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  bookId: { type: Number, required: true },
  chapterNumber: { type: Number, required: true },
  reference: { type: String, required: true },
  textRaw: { type: String, required: true },
  textProcessed: { type: String, required: true },
  hashRaw: { type: String, required: true },
  hashProcessed: { type: String, required: true },
  rawChapterId: { type: Number, required: true },
  transformProfileId: { type: Number, required: true },
  etlControl: { type: etlControlSchema, required: true },
  audit: { type: auditSchema, required: true },
});

canonicalChapterSchema.index({ chapterId: 1 }, { unique: true });
canonicalChapterSchema.index({ bookId: 1 });
canonicalChapterSchema.index({ bibleId: 1, bookId: 1, chapterNumber: 1 });

type CanonicalChapter = InferSchemaType<typeof canonicalChapterSchema>;

const canonicalVerseSchema = new Schema({
  verseId: { type: Number, required: true },
  chapterId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  bookId: { type: Number, required: true },
  chapterNumber: { type: Number, required: true },
  verseNumber: { type: Number, required: true },
  reference: { type: String, required: true },
  textRaw: { type: String, required: true },
  textProcessed: { type: String, required: true },
  hashRaw: { type: String, required: true },
  hashProcessed: { type: String, required: true },
  offsetStart: { type: Number },
  offsetEnd: { type: Number },
  transformProfileId: { type: Number, required: true },
  etlControl: { type: etlControlSchema, required: true },
  audit: { type: auditSchema, required: true },
});

canonicalVerseSchema.index({ verseId: 1 }, { unique: true });
canonicalVerseSchema.index({ chapterId: 1 });
canonicalVerseSchema.index({ chapterId: 1, verseNumber: 1 });

type CanonicalVerse = InferSchemaType<typeof canonicalVerseSchema>;

const transformStepSchema = new Schema(
  {
    order: { type: Number, required: true },
    type: { type: String, required: true },
    enabled: { type: Boolean, required: true },
    params: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { _id: false }
);

const transformProfileSchema = new Schema({
  profileId: { type: Number, required: true },
  name: { type: String, required: true },
  scope: { type: String, required: true },
  version: { type: Number, required: true, default: 1 },
  bibleId: { type: Number },
  isDefault: { type: Boolean, required: true, default: false },
  description: { type: String, default: null },
  steps: { type: [transformStepSchema], required: true },
  isActive: { type: Boolean, required: true, default: true },
  audit: { type: auditSchema, required: true },
});

transformProfileSchema.index({ profileId: 1 }, { unique: true });
transformProfileSchema.index({ scope: 1, isActive: 1 });
transformProfileSchema.index({ name: 1 });
transformProfileSchema.index({ bibleId: 1, isDefault: 1, scope: 1, isActive: 1 });

type TransformProfile = InferSchemaType<typeof transformProfileSchema>;

const schemaValidatorRunSchema = new Schema({
  runId: { type: String, required: true },
  dryRun: { type: Boolean, required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, required: true },
  success: { type: Boolean, required: true },
  results: { type: [Schema.Types.Mixed], required: true },
  audit: { type: auditSchema, required: true },
});

schemaValidatorRunSchema.index({ runId: 1 }, { unique: true });

type SchemaValidatorRun = InferSchemaType<typeof schemaValidatorRunSchema>;

const modelCapabilitySchema = new Schema(
  {
    supportsJsonSchema: { type: Boolean, default: false },
    supportsToolCalls: { type: Boolean, default: false },
    supportsStrictJson: { type: Boolean, default: false },
    supportsStreaming: { type: Boolean, default: false },
  },
  { _id: false }
);

const modelSchema = new Schema({
  modelId: { type: Number, required: true },
  provider: { type: String, required: true },
  displayName: { type: String, required: true },
  version: { type: String, required: true },
  routingMethod: { type: String, required: true },
  isActive: { type: Boolean, required: true, default: true },
  releasedAt: { type: Date, default: null }, // For time-series analysis
  apiConfigEncrypted: { type: Schema.Types.Mixed, default: {} },
  capabilities: { type: modelCapabilitySchema, default: {} },
  audit: { type: auditSchema, required: true },
});

modelSchema.index({ modelId: 1 }, { unique: true });
modelSchema.index({ provider: 1 });
modelSchema.index({ isActive: 1 });

type ModelRegistry = InferSchemaType<typeof modelSchema>;

const modelProfileMapSchema = new Schema({
  modelId: { type: Number, required: true },
  modelProfileId: { type: Number, required: true },
  audit: { type: auditSchema, required: true },
});

modelProfileMapSchema.index({ modelId: 1 }, { unique: true });

type ModelProfileMap = InferSchemaType<typeof modelProfileMapSchema>;

const runLogSchema = new Schema(
  {
    stage: { type: String, required: true },
    level: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const runErrorSummarySchema = new Schema(
  {
    failedCount: { type: Number, required: true },
    lastError: { type: String, default: null },
    lastErrorAt: { type: Date, default: null },
  },
  { _id: false }
);

const runSchema = new Schema({
  runId: { type: String, required: true },
  campaignTag: { type: String, required: true },
  runType: { type: String, required: true },
  modelId: { type: Number, required: true },
  scope: { type: String, required: true },
  scopeIds: { type: Schema.Types.Mixed, required: true },
  scopeParams: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, required: true },
  cancelRequested: { type: Boolean, default: false },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  metrics: { type: Schema.Types.Mixed, default: {} },
  logs: { type: [runLogSchema], default: [] },
  errorSummary: { type: runErrorSummarySchema, default: null },
  audit: { type: auditSchema, required: true },
});

runSchema.index({ runId: 1 }, { unique: true });
runSchema.index({ campaignTag: 1, modelId: 1, startedAt: -1 });
runSchema.index({ modelId: 1, startedAt: -1 });
runSchema.index({ status: 1 });

type Run = InferSchemaType<typeof runSchema>;

const runItemSchema = new Schema({
  runId: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: Number, required: true },
  status: { type: String, required: true },
  attempts: { type: Number, required: true, default: 0 },
  lastError: { type: String, default: null },
  updatedAt: { type: Date, required: true },
});

runItemSchema.index({ runId: 1, targetType: 1, targetId: 1 }, { unique: true });
runItemSchema.index({ runId: 1, status: 1 });

type RunItem = InferSchemaType<typeof runItemSchema>;

const llmRawResponseSchema = new Schema({
  responseId: { type: Number, required: true },
  runId: { type: String, required: true },
  modelId: { type: Number, required: true },
  targetType: { type: String, required: true },
  targetId: { type: Number, required: true },
  evaluatedAt: { type: Date, required: true },
  responseRaw: { type: String, required: true },
  systemPrompt: { type: String, default: null },
  userPrompt: { type: String, default: null },
  parsed: { type: Schema.Types.Mixed, default: null },
  parseError: { type: String, default: null },
  extractedText: { type: String, default: null },
  latencyMs: { type: Number },
  audit: { type: auditSchema, required: true },
});

llmRawResponseSchema.index({ responseId: 1 }, { unique: true });
llmRawResponseSchema.index({ runId: 1, modelId: 1, targetType: 1, targetId: 1 });
llmRawResponseSchema.index({ modelId: 1, evaluatedAt: -1 });

type LlmRawResponse = InferSchemaType<typeof llmRawResponseSchema>;

const llmVerseResultSchema = new Schema({
  resultId: { type: Number, required: true },
  campaignTag: { type: String, required: true },
  runId: { type: String, required: true },
  modelId: { type: Number, required: true },
  verseId: { type: Number, required: true },
  // Hierarchy fields for efficient roll-up aggregation
  chapterId: { type: Number, required: true },
  bookId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  evaluatedAt: { type: Date, required: true }, // Time dimension
  responseRaw: { type: String, required: true },
  responseProcessed: { type: String, required: true },
  hashRaw: { type: String, required: true },
  hashProcessed: { type: String, required: true },
  hashMatch: { type: Boolean, required: true },
  fidelityScore: { type: Number, required: true },
  diff: { type: Schema.Types.Mixed, required: true },
  latencyMs: { type: Number },
  audit: { type: auditSchema, required: true },
});

llmVerseResultSchema.index({ resultId: 1 }, { unique: true });
llmVerseResultSchema.index({ campaignTag: 1, modelId: 1, verseId: 1 }, { unique: true });
llmVerseResultSchema.index({ runId: 1, modelId: 1, verseId: 1 });
llmVerseResultSchema.index({ verseId: 1 });
// Model-centric indexes for dashboard queries
llmVerseResultSchema.index({ modelId: 1, bibleId: 1, evaluatedAt: -1 });
llmVerseResultSchema.index({ modelId: 1, chapterId: 1 });
llmVerseResultSchema.index({ modelId: 1, bookId: 1 });

type LlmVerseResult = InferSchemaType<typeof llmVerseResultSchema>;

// Aggregate schemas for materialized roll-ups
const aggregationChapterSchema = new Schema({
  campaignTag: { type: String, required: true },
  chapterId: { type: Number, required: true },
  modelId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  bookId: { type: Number, required: true },
  evaluatedAt: { type: Date, required: true },
  avgFidelity: { type: Number, required: true },
  perfectRate: { type: Number, required: true },
  verseCount: { type: Number, required: true },
  matchCount: { type: Number, required: true },
});

aggregationChapterSchema.index({ campaignTag: 1, modelId: 1, chapterId: 1 }, { unique: true });
aggregationChapterSchema.index({ campaignTag: 1, modelId: 1, bibleId: 1, evaluatedAt: -1 });
aggregationChapterSchema.index({ campaignTag: 1, modelId: 1, bookId: 1 });

type AggregationChapter = InferSchemaType<typeof aggregationChapterSchema>;

const aggregationBookSchema = new Schema({
  campaignTag: { type: String, required: true },
  bookId: { type: Number, required: true },
  modelId: { type: Number, required: true },
  bibleId: { type: Number, required: true },
  evaluatedAt: { type: Date, required: true },
  avgFidelity: { type: Number, required: true },
  perfectRate: { type: Number, required: true },
  chapterCount: { type: Number, required: true },
  verseCount: { type: Number, required: true },
  matchCount: { type: Number, required: true },
});

aggregationBookSchema.index({ campaignTag: 1, modelId: 1, bookId: 1 }, { unique: true });
aggregationBookSchema.index({ campaignTag: 1, modelId: 1, bibleId: 1, evaluatedAt: -1 });

type AggregationBook = InferSchemaType<typeof aggregationBookSchema>;

const aggregationBibleSchema = new Schema({
  campaignTag: { type: String, required: true },
  bibleId: { type: Number, required: true },
  modelId: { type: Number, required: true },
  evaluatedAt: { type: Date, required: true },
  avgFidelity: { type: Number, required: true },
  perfectRate: { type: Number, required: true },
  bookCount: { type: Number, required: true },
  chapterCount: { type: Number, required: true },
  verseCount: { type: Number, required: true },
  matchCount: { type: Number, required: true },
});

aggregationBibleSchema.index({ campaignTag: 1, modelId: 1, bibleId: 1 }, { unique: true });
aggregationBibleSchema.index({ campaignTag: 1, modelId: 1, evaluatedAt: -1 });

type AggregationBible = InferSchemaType<typeof aggregationBibleSchema>;

const appConfigSchema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
  modifiedAt: { type: Date, required: true },
  modifiedBy: { type: String, required: true },
});

appConfigSchema.index({ key: 1 }, { unique: true });

type AppConfig = InferSchemaType<typeof appConfigSchema>;

export const DimLanguageModel =
  mongoose.models.DimLanguage ??
  mongoose.model<DimLanguage>("DimLanguage", dimLanguageSchema, "dimLanguages");

export const DimBibleModel =
  mongoose.models.DimBible ??
  mongoose.model<DimBible>("DimBible", dimBibleSchema, "dimBibles");

export const DimBookModel =
  mongoose.models.DimBook ??
  mongoose.model<DimBook>("DimBook", dimBookSchema, "dimBooks");

export const DimChapterModel =
  mongoose.models.DimChapter ??
  mongoose.model<DimChapter>("DimChapter", dimChapterSchema, "dimChapters");

export const DimCampaignModel =
  mongoose.models.DimCampaign ??
  mongoose.model<DimCampaign>("DimCampaign", dimCampaignSchema, "dimCampaigns");

export const CanonicalLanguageModel =
  mongoose.models.CanonicalLanguage ??
  mongoose.model<CanonicalLanguage>(
    "CanonicalLanguage",
    canonicalLanguageSchema,
    "canonicalLanguages"
  );

export const CanonicalBibleModel =
  mongoose.models.CanonicalBible ??
  mongoose.model<CanonicalBible>("CanonicalBible", canonicalBibleSchema, "canonicalBibles");

export const CanonicalBookModel =
  mongoose.models.CanonicalBook ??
  mongoose.model<CanonicalBook>("CanonicalBook", canonicalBookSchema, "canonicalBooks");

export const CanonicalRawChapterModel =
  mongoose.models.CanonicalRawChapter ??
  mongoose.model<CanonicalRawChapter>(
    "CanonicalRawChapter",
    canonicalRawChapterSchema,
    "canonicalRawChapters"
  );

export const CanonicalChapterModel =
  mongoose.models.CanonicalChapter ??
  mongoose.model<CanonicalChapter>(
    "CanonicalChapter",
    canonicalChapterSchema,
    "canonicalChapters"
  );

export const CanonicalVerseModel =
  mongoose.models.CanonicalVerse ??
  mongoose.model<CanonicalVerse>("CanonicalVerse", canonicalVerseSchema, "canonicalVerses");

export const TransformProfileModel =
  mongoose.models.TransformProfile ??
  mongoose.model<TransformProfile>(
    "TransformProfile",
    transformProfileSchema,
    "transformProfiles"
  );

export const SchemaValidatorRunModel =
  mongoose.models.SchemaValidatorRun ??
  mongoose.model<SchemaValidatorRun>(
    "SchemaValidatorRun",
    schemaValidatorRunSchema,
    "schemaValidatorRuns"
  );

export const ModelModel =
  mongoose.models.ModelRegistry ??
  mongoose.model<ModelRegistry>("ModelRegistry", modelSchema, "models");

export const ModelProfileMapModel =
  mongoose.models.ModelProfileMap ??
  mongoose.model<ModelProfileMap>(
    "ModelProfileMap",
    modelProfileMapSchema,
    "modelProfileMap"
  );

export const RunModel =
  mongoose.models.Run ?? mongoose.model<Run>("Run", runSchema, "runs");

export const RunItemModel =
  mongoose.models.RunItem ??
  mongoose.model<RunItem>("RunItem", runItemSchema, "runItems");

export const LlmRawResponseModel =
  mongoose.models.LlmRawResponse ??
  mongoose.model<LlmRawResponse>("LlmRawResponse", llmRawResponseSchema, "llmRawResponses");

export const LlmVerseResultModel =
  mongoose.models.LlmVerseResult ??
  mongoose.model<LlmVerseResult>("LlmVerseResult", llmVerseResultSchema, "llmVerseResults");

export const AggregationChapterModel =
  mongoose.models.AggregationChapter ??
  mongoose.model<AggregationChapter>(
    "AggregationChapter",
    aggregationChapterSchema,
    "aggregationChapters"
  );

export const AggregationBookModel =
  mongoose.models.AggregationBook ??
  mongoose.model<AggregationBook>(
    "AggregationBook",
    aggregationBookSchema,
    "aggregationBooks"
  );

export const AggregationBibleModel =
  mongoose.models.AggregationBible ??
  mongoose.model<AggregationBible>(
    "AggregationBible",
    aggregationBibleSchema,
    "aggregationBibles"
  );

export const AppConfigModel =
  mongoose.models.AppConfig ??
  mongoose.model<AppConfig>("AppConfig", appConfigSchema, "appConfig");

const collectionValidators = [
  { name: "dimLanguages", validator: dimLanguagesValidator },
  { name: "dimBibles", validator: dimBiblesValidator },
  { name: "dimBooks", validator: dimBooksValidator },
  { name: "dimChapters", validator: dimChaptersValidator },
  { name: "dimCampaigns", validator: dimCampaignsValidator },
  { name: "canonicalLanguages", validator: canonicalLanguagesValidator },
  { name: "canonicalBibles", validator: canonicalBiblesValidator },
  { name: "canonicalBooks", validator: canonicalBooksValidator },
  { name: "canonicalRawChapters", validator: canonicalRawChaptersValidator },
  { name: "canonicalChapters", validator: canonicalChaptersValidator },
  { name: "canonicalVerses", validator: canonicalVersesValidator },
  { name: "models", validator: modelsValidator },
  { name: "modelProfileMap", validator: modelProfileMapValidator },
  { name: "transformProfiles", validator: transformProfilesValidator },
  { name: "runs", validator: runsValidator },
  { name: "runItems", validator: runItemsValidator },
  { name: "llmRawResponses", validator: llmRawResponsesValidator },
  { name: "llmVerseResults", validator: llmVerseResultsValidator },
  { name: "aggregationChapters", validator: aggregationChaptersValidator },
  { name: "aggregationBooks", validator: aggregationBooksValidator },
  { name: "aggregationBibles", validator: aggregationBiblesValidator },
  { name: "appConfig", validator: appConfigValidator },
  { name: "schemaValidatorRuns", validator: schemaValidatorRunsValidator },
];

export type SchemaValidatorResult = {
  name: string;
  action: "create" | "update";
  ok: boolean;
  error?: string;
};

export async function applySchemaValidators(options?: {
  dryRun?: boolean;
}): Promise<SchemaValidatorResult[]> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized");
  }

  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name
    )
  );

  const results = await Promise.all(
    collectionValidators.map(async ({ name, validator }) => {
      const action: "create" | "update" = existing.has(name) ? "update" : "create";
      if (options?.dryRun) {
        return { name, action, ok: true } satisfies SchemaValidatorResult;
      }

      try {
        if (!existing.has(name)) {
          console.log(`[applySchemaValidators] Creating collection: ${name}`);
          await db.createCollection(name, {
            validator,
            validationLevel: "moderate",
            validationAction: "error",
          });
        } else {
          console.log(`[applySchemaValidators] Updating collection: ${name}`);
          await db.command({
            collMod: name,
            validator,
            validationLevel: "moderate",
            validationAction: "error",
          });
        }

        return { name, action, ok: true } satisfies SchemaValidatorResult;
      } catch (error) {
        console.error(`[applySchemaValidators] Error on ${name}:`, error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return { name, action, ok: false, error: message } satisfies SchemaValidatorResult;
      }
    })
  );

  return results;
}
