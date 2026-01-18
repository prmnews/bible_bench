# MongoDB Atlas Data Model v1 (Compass Ready)

Status: Draft
Updated: 2026-01-17

This document shows collection shapes and sample documents for MongoDB Atlas. These are intended to be viewed and validated using MongoDB Compass.

## Collections
- dimLanguages
- dimBibles
- dimBooks
- rawChapters
- chapters
- verses
- models
- transformProfiles
- modelTransformMap
- runs
- runItems
- chapterResults
- verseResults
- canonicalTestVerses
- userQueries
- appConfig

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

## rawChapters
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

## chapters
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

## verses
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
  "apiConfigEncrypted": { "ciphertext": "..." },
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

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

## modelTransformMap
```json
{
  "_id": "ObjectId",
  "modelId": 10,
  "canonicalProfileId": 101,
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

## chapterResults
```json
{
  "_id": "ObjectId",
  "resultId": 900001,
  "runId": "run_2026-01-17_001",
  "modelId": 10,
  "chapterId": 43003,
  "responseRaw": "John 3 (KJV)...",
  "responseProcessed": "There was a man...",
  "hashRaw": "sha256...",
  "hashProcessed": "sha256...",
  "hashMatch": false,
  "fidelityScore": 96.34,
  "diff": { "substitutions": [], "omissions": [], "additions": [], "transpositions": [] },
  "audit": { "createdAt": "2026-01-17T00:00:10Z", "createdBy": "model_run" }
}
```

## verseResults
```json
{
  "_id": "ObjectId",
  "resultId": 910001,
  "runId": "run_2026-01-17_002",
  "modelId": 10,
  "verseId": 43003016,
  "responseRaw": "For God so loved the world...",
  "responseProcessed": "For God so loved the world...",
  "hashRaw": "sha256...",
  "hashProcessed": "sha256...",
  "hashMatch": true,
  "fidelityScore": 100.0,
  "diff": {},
  "audit": { "createdAt": "2026-01-17T00:00:10Z", "createdBy": "model_run" }
}
```

## canonicalTestVerses
```json
{
  "_id": "ObjectId",
  "testId": 501,
  "verseId": 43003016,
  "category": "high_profile",
  "notes": "John 3:16",
  "addedAt": "2026-01-17T00:00:00Z"
}
```

## userQueries
```json
{
  "_id": "ObjectId",
  "queryId": 70001,
  "timestamp": "2026-01-17T00:00:00Z",
  "modelId": 10,
  "queryType": "verse_range",
  "scope": { "bookId": 430, "chapterNumber": 3, "verseStart": 1, "verseEnd": 10 },
  "responseRaw": "1 There was a man...",
  "responseProcessed": "There was a man...",
  "hashRaw": "sha256...",
  "hashProcessed": "sha256...",
  "hashMatch": false,
  "diff": {},
  "metadata": { "sessionId": "abc", "userAgent": "..." },
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "public" }
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
- Unique: languageId, bibleId, bookId, chapterId, verseId, modelId, profileId, runId, key
- Lookup: verses.chapterId, chapters.bookId, results.runId+modelId+chapterId, results.runId+modelId+verseId

