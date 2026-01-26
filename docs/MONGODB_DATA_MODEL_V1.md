# MongoDB Atlas Data Model v1 (Compass Ready)

Status: Draft
Updated: 2026-01-17

This document shows collection shapes and sample documents for MongoDB Atlas. These are intended to be viewed and validated using MongoDB Compass.

## Collections
- dimLanguages
- dimBibles
- dimBooks
- dimChapters
- canonicalLanguages
- canonicalBibles
- canonicalBooks
- canonicalRawChapters
- canonicalChapters
- canonicalVerses
- models
- transformProfiles
- modelProfileMap
- runs
- runItems
- llmRawResponses
- llmVerseResults
- aggregationChapters (materialized roll-up)
- aggregationBooks (materialized roll-up)
- aggregationBibles (materialized roll-up)
- appConfig
- schemaValidatorRuns

## dimLanguages
```json
{
  "_id": "ObjectId",
  "languageId": 1,
  "isoCode": "en",
  "name": "English",
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## dimBibles
```json
{
  "_id": "ObjectId",
  "bibleId": 1001,
  "apiBibleId": "de4e12af7f28f599-02",
  "languageId": 1,
  "name": "King James Version",
  "source": "ABS",
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## dimBooks
```json
{
  "_id": "ObjectId",
  "bookId": 430,
  "bibleId": 1001,
  "bookCode": "JHN",
  "bookName": "John",
  "bookIndex": 43,
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## dimChapters
```json
{
  "_id": "ObjectId",
  "chapterId": 43003,
  "bibleId": 1001,
  "bookId": 430,
  "chapterNumber": 3,
  "reference": "John 3",
  "chapterName": "For God So Loved",
  "verseCount": 36,
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## canonicalLanguages
```json
{
  "_id": "ObjectId",
  "languageId": 1,
  "isoCode": "en",
  "name": "English",
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## canonicalBibles
```json
{
  "_id": "ObjectId",
  "bibleId": 1001,
  "apiBibleId": "de4e12af7f28f599-02",
  "languageId": 1,
  "name": "King James Version",
  "source": "ABS",
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## canonicalBooks
```json
{
  "_id": "ObjectId",
  "bookId": 430,
  "bibleId": 1001,
  "bookCode": "JHN",
  "bookName": "John",
  "bookIndex": 43,
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## canonicalRawChapters
```json
{
  "_id": "ObjectId",
  "rawChapterId": 43003,
  "bibleId": 1001,
  "bookId": 430,
  "chapterNumber": 3,
  "reference": "John 3",
  "rawPayload": { "...": "ABS JSON chapter payload" },
  "hashRaw": "sha256...",
  "source": "ABS",
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "raw_ingest" }
}
```

## canonicalChapters
```json
{
  "_id": "ObjectId",
  "chapterId": 43003,
  "bibleId": 1001,
  "bookId": 430,
  "chapterNumber": 3,
  "reference": "John 3",
  "textRaw": "3 1 There was a man...",
  "textProcessed": "There was a man...",
  "hashRaw": "sha256...",
  "hashProcessed": "sha256...",
  "rawChapterId": 43003,
  "transformProfileId": 101,
  "etlControl": {
    "stage": "chapters",
    "isLocked": false,
    "lockedBy": null,
    "lockedAt": null,
    "lastProcessedBy": "run_2026-01-17_001",
    "lastProcessedAt": "2026-01-17T00:00:00Z",
    "batchId": "batch_2026-01-17_001"
  },
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "chapter_transform" }
}
```

## canonicalVerses
```json
{
  "_id": "ObjectId",
  "verseId": 43003016,
  "chapterId": 43003,
  "bibleId": 1001,
  "bookId": 430,
  "chapterNumber": 3,
  "verseNumber": 16,
  "reference": "John 3:16",
  "textRaw": "16 For God so loved the world...",
  "textProcessed": "For God so loved the world...",
  "hashRaw": "sha256...",
  "hashProcessed": "sha256...",
  "transformProfileId": 101,
  "etlControl": {
    "stage": "verses",
    "isLocked": false,
    "lockedBy": null,
    "lockedAt": null,
    "lastProcessedBy": "run_2026-01-17_001",
    "lastProcessedAt": "2026-01-17T00:00:00Z",
    "batchId": "batch_2026-01-17_001"
  },
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "verse_transform" }
}
```

## models
```json
{
  "_id": "ObjectId",
  "modelId": 10,
  "provider": "OpenAI",
  "displayName": "GPT-4o",
  "version": "2025-12",
  "routingMethod": "direct",
  "isActive": true,
  "releasedAt": "2025-12-01T00:00:00Z",
  "apiConfigEncrypted": {
    "model": "gpt-4o",
    "maxTokens": 4096
  },
  "capabilities": {
    "supportsJsonSchema": true,
    "supportsToolCalls": true,
    "supportsStrictJson": true,
    "supportsStreaming": true
  },
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```
API keys are sourced from environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY) and are not stored in the models collection.

## transformProfiles
```json
{
  "_id": "ObjectId",
  "profileId": 101,
  "name": "ABS_KJV_CANONICAL_V1",
  "scope": "canonical",
  "steps": [
    { "order": 1, "type": "stripMarkupTags", "enabled": true, "params": {} }
  ],
  "isActive": true,
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## modelProfileMap
```json
{
  "_id": "ObjectId",
  "modelId": 10,
  "modelProfileId": 201,
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## runs
```json
{
  "_id": "ObjectId",
  "runId": "run_2026-01-17_001",
  "runType": "MODEL_CHAPTER",
  "modelId": 10,
  "scope": "bible",
  "scopeIds": { "bibleId": 1001 },
  "status": "completed",
  "startedAt": "2026-01-17T00:00:00Z",
  "completedAt": "2026-01-17T01:00:00Z",
  "metrics": { "totalChapters": 1189, "success": 1189, "failed": 0 },
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## runItems
```json
{
  "_id": "ObjectId",
  "runId": "run_2026-01-17_001",
  "targetType": "chapter",
  "targetId": 43003,
  "status": "success",
  "attempts": 1,
  "lastError": null,
  "updatedAt": "2026-01-17T00:00:10Z"
}
```

## llmRawResponses
```json
{
  "_id": "ObjectId",
  "responseId": 800001,
  "runId": "run_2026-01-17_001",
  "modelId": 10,
  "targetType": "chapter",
  "targetId": 43003,
  "evaluatedAt": "2026-01-17T00:00:10Z",
  "responseRaw": "{...raw provider response...}",
  "parsed": { "book": "John", "chapter": "3", "verses": [] },
  "parseError": null,
  "extractedText": "For God so loved the world...",
  "latencyMs": 1234,
  "audit": { "createdAt": "2026-01-17T00:00:10Z", "createdBy": "model_run" }
}
```

## llmVerseResults
```json
{
  "_id": "ObjectId",
  "resultId": 910001,
  "runId": "run_2026-01-17_002",
  "modelId": 10,
  "verseId": 43003016,
  "chapterId": 43003,
  "bookId": 430,
  "bibleId": 1001,
  "evaluatedAt": "2026-01-17T00:00:10Z",
  "responseRaw": "For God so loved the world...",
  "responseProcessed": "For God so loved the world...",
  "hashRaw": "sha256...",
  "hashProcessed": "sha256...",
  "hashMatch": true,
  "fidelityScore": 100.0,
  "diff": {},
  "latencyMs": 150,
  "audit": { "createdAt": "2026-01-17T00:00:10Z", "createdBy": "model_run" }
}
```

## aggregationChapters
Materialized chapter-level metrics rolled up from llmVerseResults.
```json
{
  "_id": "ObjectId",
  "chapterId": 43003,
  "modelId": 10,
  "bibleId": 1001,
  "bookId": 430,
  "runId": "run_2026-01-17_001",
  "evaluatedAt": "2026-01-17T01:00:00Z",
  "avgFidelity": 96.34,
  "perfectRate": 0.85,
  "verseCount": 36,
  "matchCount": 31
}
```

## aggregationBooks
Materialized book-level metrics rolled up from aggregationChapters.
```json
{
  "_id": "ObjectId",
  "bookId": 430,
  "modelId": 10,
  "bibleId": 1001,
  "runId": "run_2026-01-17_001",
  "evaluatedAt": "2026-01-17T01:00:00Z",
  "avgFidelity": 95.12,
  "perfectRate": 0.82,
  "chapterCount": 21,
  "verseCount": 879,
  "matchCount": 721
}
```

## aggregationBibles
Materialized bible-level metrics rolled up from aggregationBooks.
```json
{
  "_id": "ObjectId",
  "bibleId": 1001,
  "modelId": 10,
  "runId": "run_2026-01-17_001",
  "evaluatedAt": "2026-01-17T01:00:00Z",
  "avgFidelity": 94.50,
  "perfectRate": 0.78,
  "bookCount": 66,
  "chapterCount": 1189,
  "verseCount": 31102,
  "matchCount": 24259
}
```

## appConfig
```json
{
  "_id": "ObjectId",
  "key": "SHOW_LATEST_ONLY",
  "value": "1",
  "modifiedAt": "2026-01-17T00:00:00Z",
  "modifiedBy": "admin"
}
```

## Suggested Indexes

### Unique Indexes
- languageId, bibleId, bookId, chapterId, verseId, modelId, profileId, runId, key

### Lookup Indexes
- canonicalVerses: { chapterId }
- canonicalChapters: { bookId }
- llmVerseResults: { runId, modelId, verseId }
- llmVerseResults: { modelId, bibleId, evaluatedAt }
- llmVerseResults: { modelId, chapterId }
- llmVerseResults: { modelId, bookId }

### Aggregate Indexes
- aggregationChapters: { chapterId, modelId, runId } (unique)
- aggregationChapters: { modelId, bibleId, evaluatedAt }
- aggregationBooks: { bookId, modelId, runId } (unique)
- aggregationBooks: { modelId, bibleId, evaluatedAt }
- aggregationBibles: { bibleId, modelId, runId } (unique)
- aggregationBibles: { modelId, bibleId, evaluatedAt }

