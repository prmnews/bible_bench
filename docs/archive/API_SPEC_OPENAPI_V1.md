# API Specification v1 (OpenAPI-Style)

Status: Draft
Updated: 2026-01-17

## 1. Conventions
- Base URL: /api
- Content-Type: application/json
- Auth: none (admin endpoints local only)

### Response Envelope
```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": { "requestId": "uuid", "timestamp": "ISO8601" }
}
```

### Error Object
```json
{
  "code": "ETL-CHAP-001",
  "message": "Chapter transform failed",
  "details": { "runId": "run_2026-01-17_001" }
}
```

## 2. Public Endpoints

### GET /api/models
List active models.

Response:
```json
{
  "ok": true,
  "data": [
    { "modelId": 10, "displayName": "GPT-4o", "provider": "OpenAI", "version": "2025-12" }
  ]
}
```

### GET /api/chapters
Query chapter data.

Query params:
- bookId (int, required)
- chapterNumber (int, required)

Response:
```json
{
  "ok": true,
  "data": {
    "chapterId": 43003,
    "reference": "John 3",
    "textProcessed": "There was a man...",
    "verses": [
      { "verseId": 43003001, "reference": "John 3:1" },
      { "verseId": 43003002, "reference": "John 3:2" }
    ]
  }
}
```

### GET /api/verses
Query verse data.

Query params:
- bookId (int, required)
- chapterNumber (int, required)
- verseStart (int, optional)
- verseEnd (int, optional)

Response:
```json
{
  "ok": true,
  "data": [
    { "verseId": 43003016, "reference": "John 3:16", "textProcessed": "For God so loved..." }
  ]
}
```

### GET /api/dashboard
Latest canonical summary or full history based on SHOW_LATEST_ONLY.

Response:
```json
{
  "ok": true,
  "data": {
    "latestRunId": "run_2026-01-17_001",
    "models": [
      { "modelId": 10, "perfectRate": 0.84, "avgFidelity": 97.3 }
    ]
  }
}
```

### GET /api/dashboard/model/:modelId
Model detail with chapter and verse results.

### GET /api/dashboard/chapter/:chapterId
All model results for a chapter.

### GET /api/dashboard/verse/:verseId
All model results for a verse.

### GET /api/dashboard/history
Trend data by model.

Query params:
- modelId (int, required)

### POST /api/explore/benchmark
User exploration benchmark (single model at a time).

Request:
```json
{
  "modelId": 10,
  "queryType": "chapter" | "verse_range",
  "scope": { "bookId": 430, "chapterNumber": 3, "verseStart": 1, "verseEnd": 10 }
}
```

Response:
```json
{
  "ok": true,
  "data": { "queryId": 70001, "status": "queued" }
}
```

## 3. Admin Endpoints (Local Only)

### POST /api/admin/ingest/raw
Bulk raw ingest from ABS JSON.

Request:
```json
{ "source": "file", "path": "/abs/chapters" }
```

### POST /api/admin/transform/chapters
Transform raw chapters; auto-triggers verse transforms.

Request:
```json
{ "bibleId": 1001, "runId": "run_2026-01-17_001" }
```

### POST /api/admin/models/:modelId/run/bible
Run all books, chapters, and verses for a model.

### POST /api/admin/models/:modelId/run/book
Request:
```json
{ "bookId": 430 }
```

### POST /api/admin/models/:modelId/run/chapter
Request:
```json
{ "chapterId": 43003 }
```

### POST /api/admin/models/:modelId/run/verse
Request:
```json
{ "verseId": 43003016 }
```

### GET /api/admin/runs
List runs.

### GET /api/admin/runs/:runId
Run detail with run items and errors.

### POST /api/admin/runs/:runId/retry-failed
Retry failed run items.

### POST /api/admin/models
Create model.

### PATCH /api/admin/models/:modelId
Update model.

### POST /api/admin/transformProfiles
Create transform profile.

### PATCH /api/admin/transformProfiles/:profileId
Update transform profile.

### PATCH /api/admin/config/SHOW_LATEST_ONLY
Request:
```json
{ "value": "1" }
```

## 4. Error Codes
See TECHNICAL_SPEC_V1 for the standard error list.

