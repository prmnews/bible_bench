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

export const rawChaptersValidator: JsonSchemaValidator = {
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

export const chaptersValidator: JsonSchemaValidator = {
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

export const versesValidator: JsonSchemaValidator = {
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
          required: ["order", "type", "enabled", "params"],
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

export const etlRunsValidator: JsonSchemaValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["runId", "status", "startedAt", "summary", "logs", "audit"],
    properties: {
      runId: stringSchema,
      status: stringSchema,
      startedAt: dateSchema,
      completedAt: nullableDateSchema,
      stages: {
        bsonType: "object",
        additionalProperties: true,
      },
      summary: {
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
      audit: auditJsonSchema,
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

const rawChapterSchema = new Schema({
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

rawChapterSchema.index({ rawChapterId: 1 }, { unique: true });
rawChapterSchema.index({ bibleId: 1, bookId: 1, chapterNumber: 1 });

type RawChapter = InferSchemaType<typeof rawChapterSchema>;

const chapterSchema = new Schema({
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

chapterSchema.index({ chapterId: 1 }, { unique: true });
chapterSchema.index({ bookId: 1 });
chapterSchema.index({ bibleId: 1, bookId: 1, chapterNumber: 1 });

type Chapter = InferSchemaType<typeof chapterSchema>;

const verseSchema = new Schema({
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

verseSchema.index({ verseId: 1 }, { unique: true });
verseSchema.index({ chapterId: 1 });
verseSchema.index({ chapterId: 1, verseNumber: 1 });

type Verse = InferSchemaType<typeof verseSchema>;

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

const etlRunSchema = new Schema({
  runId: { type: String, required: true },
  status: { type: String, required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  stages: { type: Schema.Types.Mixed, default: {} },
  summary: { type: Schema.Types.Mixed, required: true },
  logs: { type: [Schema.Types.Mixed], required: true, default: [] },
  audit: { type: auditSchema, required: true },
});

etlRunSchema.index({ runId: 1 }, { unique: true });

type EtlRun = InferSchemaType<typeof etlRunSchema>;

export const DimLanguageModel =
  mongoose.models.DimLanguage ??
  mongoose.model<DimLanguage>("DimLanguage", dimLanguageSchema, "dimLanguages");

export const DimBibleModel =
  mongoose.models.DimBible ??
  mongoose.model<DimBible>("DimBible", dimBibleSchema, "dimBibles");

export const DimBookModel =
  mongoose.models.DimBook ??
  mongoose.model<DimBook>("DimBook", dimBookSchema, "dimBooks");

export const RawChapterModel =
  mongoose.models.RawChapter ??
  mongoose.model<RawChapter>("RawChapter", rawChapterSchema, "rawChapters");

export const ChapterModel =
  mongoose.models.Chapter ??
  mongoose.model<Chapter>("Chapter", chapterSchema, "chapters");

export const VerseModel =
  mongoose.models.Verse ??
  mongoose.model<Verse>("Verse", verseSchema, "verses");

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

export const EtlRunModel =
  mongoose.models.EtlRun ??
  mongoose.model<EtlRun>("EtlRun", etlRunSchema, "etlRuns");

const collectionValidators = [
  { name: "dimLanguages", validator: dimLanguagesValidator },
  { name: "dimBibles", validator: dimBiblesValidator },
  { name: "dimBooks", validator: dimBooksValidator },
  { name: "rawChapters", validator: rawChaptersValidator },
  { name: "chapters", validator: chaptersValidator },
  { name: "verses", validator: versesValidator },
  { name: "transformProfiles", validator: transformProfilesValidator },
  { name: "schemaValidatorRuns", validator: schemaValidatorRunsValidator },
  { name: "etlRuns", validator: etlRunsValidator },
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
          await db.createCollection(name, {
            validator,
            validationLevel: "moderate",
            validationAction: "error",
          });
        } else {
          await db.command({
            collMod: name,
            validator,
            validationLevel: "moderate",
            validationAction: "error",
          });
        }

        return { name, action, ok: true } satisfies SchemaValidatorResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { name, action, ok: false, error: message } satisfies SchemaValidatorResult;
      }
    })
  );

  return results;
}
