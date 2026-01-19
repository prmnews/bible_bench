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
      rawPayload: {
        bsonType: "object",
        additionalProperties: true,
      },
      hashRaw: stringSchema,
      source: stringSchema,
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
      transformProfileId: numberSchema,
      etlControl: etlControlJsonSchema,
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
  rawPayload: { type: Schema.Types.Mixed, required: true },
  hashRaw: { type: String, required: true },
  source: { type: String, required: true },
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
  transformProfileId: { type: Number, required: true },
  etlControl: { type: etlControlSchema, required: true },
  audit: { type: auditSchema, required: true },
});

verseSchema.index({ verseId: 1 }, { unique: true });
verseSchema.index({ chapterId: 1 });
verseSchema.index({ chapterId: 1, verseNumber: 1 });

type Verse = InferSchemaType<typeof verseSchema>;

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

const collectionValidators = [
  { name: "dimLanguages", validator: dimLanguagesValidator },
  { name: "dimBibles", validator: dimBiblesValidator },
  { name: "dimBooks", validator: dimBooksValidator },
  { name: "rawChapters", validator: rawChaptersValidator },
  { name: "chapters", validator: chaptersValidator },
  { name: "verses", validator: versesValidator },
];

export async function applySchemaValidators() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized");
  }

  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name
    )
  );

  await Promise.all(
    collectionValidators.map(async ({ name, validator }) => {
      if (!existing.has(name)) {
        await db.createCollection(name, {
          validator,
          validationLevel: "moderate",
          validationAction: "error",
        });
        return;
      }

      await db.command({
        collMod: name,
        validator,
        validationLevel: "moderate",
        validationAction: "error",
      });
    })
  );
}
