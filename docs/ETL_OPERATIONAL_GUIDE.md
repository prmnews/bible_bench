# ETL Operational Guide

## Scope
This guide covers the operational steps to run the canonical ETL pipeline, apply validators, seed reference data, and refresh aggregations.

## Prerequisites
- Admin endpoints are available only when `NODE_ENV=development` or `ADMIN_LOCAL_ONLY=true`.
- Canonical KJV JSON files are expected in `bibles/kjv-english/` by default.
- A default canonical transform profile is seeded with `profileId=1`.

## Recommended Run Order
1. Apply schema validators.
2. Seed dimension tables and default transform profiles.
3. Ingest canonical raw chapters.
4. Transform chapters.
5. Transform verses.
6. Recompute aggregations.

## Run from the Admin UI
Open `http://localhost:3000/admin/etl` and use the step buttons or "Run All Steps".

## Run via API (curl examples)
### 1) Apply schema validators
```
curl -X POST http://localhost:3000/api/admin/schema/validators \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2) Seed dimensions and defaults
```
curl -X POST http://localhost:3000/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3) Ingest KJV chapters (default folder)
```
curl -X POST http://localhost:3000/api/admin/ingest/kjv \
  -H "Content-Type: application/json" \
  -d '{"bibleId":1001,"source":"ABS"}'
```

### 4) Transform chapters
```
curl -X POST http://localhost:3000/api/admin/transform/chapters \
  -H "Content-Type: application/json" \
  -d '{"transformProfileId":1}'
```

### 5) Transform verses
```
curl -X POST http://localhost:3000/api/admin/transform/verses \
  -H "Content-Type: application/json" \
  -d '{"transformProfileId":1}'
```

### 6) Recompute aggregations
```
curl -X POST http://localhost:3000/api/admin/aggregations \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Orchestrated ETL Run
Use the ETL runner to execute one or more stages in order.
```
curl -X POST http://localhost:3000/api/admin/etl/run \
  -H "Content-Type: application/json" \
  -d '{
    "stages": ["ingest", "chapters", "verses"],
    "bibleId": 1001,
    "source": "ABS",
    "batchId": "etl_2026_01_25"
  }'
```

### Optional Inputs
- `runId`: idempotency key; reusing the same `runId` returns the prior summary.
- `rawChapterIds`: process a specific subset of chapters.
- `limit`/`skip`: batch processing controls.
- `forceAllVerses`: reprocess verses even if they already exist.
- `filepath`: custom ingest directory (applies to the `ingest` stage).

## Direct Raw Ingest (Advanced)
If you already have raw chapter payloads, use:
`POST /api/admin/ingest/raw` with required fields: `rawChapterId`, `bibleId`, `bookId`, `chapterNumber`, `reference`, `rawPayload`, `hashRaw`, `source`.

## Operational Notes
- All ingest and transform steps are idempotent and use upserts.
- Canonical transforms and hashes are applied at both chapter and verse stages.
- Aggregations can be recomputed at any time and are safe to re-run.
- If a stage fails, check `runs` and `runItems` for status, logs, and errors.
