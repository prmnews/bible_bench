# API DTO Schemas v1

Status: Draft
Updated: 2026-01-17

## 1. Common Types

### ApiResponse<T>
```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": { "requestId": "uuid", "timestamp": "ISO8601" }
}
```

### ErrorObject
```json
{
  "code": "ETL-CHAP-001",
  "message": "Chapter transform failed",
  "details": { "runId": "run_2026-01-17_001" }
}
```

## 2. Models

### ModelSummary
```json
{
  "modelId": 10,
  "displayName": "GPT-4o",
  "provider": "OpenAI",
  "version": "2025-12"
}
```

### ModelDetail
```json
{
  "modelId": 10,
  "provider": "OpenAI",
  "displayName": "GPT-4o",
  "version": "2025-12",
  "routingMethod": "direct",
  "isActive": true
}
```

## 3. Chapters and Verses

### ChapterSummary
```json
{
  "chapterId": 43003,
  "reference": "John 3",
  "textProcessed": "There was a man...",
  "verses": [
    { "verseId": 43003001, "reference": "John 3:1" },
    { "verseId": 43003002, "reference": "John 3:2" }
  ]
}
```

### VerseSummary
```json
{
  "verseId": 43003016,
  "reference": "John 3:16",
  "textProcessed": "For God so loved..."
}
```

## 4. Dashboard

### DashboardSummary
```json
{
  "latestRunId": "run_2026-01-17_001",
  "models": [
    { "modelId": 10, "perfectRate": 0.84, "avgFidelity": 97.3 }
  ]
}
```

### ModelCard
```json
{
  "modelId": 10,
  "displayName": "GPT-4o",
  "perfectMatches": 42,
  "totalTests": 50,
  "avgFidelity": 97.3,
  "avgLatencyMs": 1200
}
```

## 5. Benchmark Requests

### BenchmarkRequest
```json
{
  "modelId": 10,
  "queryType": "chapter" | "verse_range",
  "scope": { "bookId": 430, "chapterNumber": 3, "verseStart": 1, "verseEnd": 10 }
}
```

### BenchmarkResponse
```json
{
  "queryId": 70001,
  "status": "queued"
}
```

## 6. Runs

### RunSummary
```json
{
  "runId": "run_2026-01-17_001",
  "runType": "MODEL_CHAPTER",
  "status": "completed",
  "startedAt": "2026-01-17T00:00:00Z",
  "completedAt": "2026-01-17T01:00:00Z"
}
```

### RunItem
```json
{
  "runId": "run_2026-01-17_001",
  "targetType": "chapter",
  "targetId": 43003,
  "status": "success",
  "attempts": 1,
  "lastError": null
}
```

## 7. Results

### VerseResult
```json
{
  "verseId": 43003016,
  "modelId": 10,
  "hashMatch": true,
  "fidelityScore": 100.0,
  "diff": {}
}
```

### ChapterResult
```json
{
  "chapterId": 43003,
  "modelId": 10,
  "hashMatch": false,
  "fidelityScore": 96.34,
  "diff": { "substitutions": [], "omissions": [], "additions": [], "transpositions": [] }
}
```

