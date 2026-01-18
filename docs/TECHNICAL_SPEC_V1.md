# Bible Bench Technical Specification v1

Status: Draft
Owner: Bible Bench
Updated: 2026-01-17

## 1. Goals
- Evaluate LLM fidelity for KJV text at chapter and verse grain.
- Preserve complete audit trail and historical results.
- Use config-driven transforms (no hard-coded normalization).
- Manual batch processing (no job queue).
- Local-only admin controls (no auth) for ETL and model runs.
- Ensure that all dependencies are at latest stable (there have been many CVEs recently)

## 2. Non-Goals (v1)
- Behavioral flags (deferred).
- Public auth, user accounts, or billing.
- External write integrations.

## 3. System Overview
- Monorepo
- Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui.
- Backend: Node.js 20, Express, Mongoose.
- Database: MongoDB Atlas.
- Hosting: Vercel (frontend, backend).

## 4. Data States
1. raw: ABS chapter JSON stored as-is.
2. chapters: chapter-level text persisted as a single document.
3. verses: verse-level text parsed from chapter content.

## 5. Run Types
- RAW_INGEST: load ABS raw chapter payloads an canonical source of truth.
- CHAPTER_TRANSFORM: transform raw -> chapters, then auto-trigger verse transform.
- MODEL_CHAPTER: call model with chapter prompt; parse into verse results.
- MODEL_VERSE: call model with verse prompt for verse-by-verse results.

Each run has distinct runId and run items with retry/backoff.

## 6. Transform Rules
- No implicit normalization.
- All transforms are configured by profile in a collection.
- Two profiles per model:
  - canonical profile for ABS text.
  - model output profile for model responses.
- Strip markup tags (wj, add, verse-span, para, etc.).
- Strip paragraph markers (e.g., "\u00b6").
- Verse numbers may be stripped by profile (e.g., [1] -> 1, or leading verse numerals).
- Whitespace is not a scoring concern (handle by transform if needed).

## 7. Hashing and Comparison
- SHA-256 hashes for raw and processed text.
- Comparison uses processed text only.
- Raw retained for audit.
- Pass/fail is hashProcessed equality.
- Fidelity score computed by diff (character-level).

## 8. Canonical and Model Processing
### 8.1 Canonical ETL
- Raw ingest by chapter JSON.
- Chapter transform produces chapter text and hashes.
- Verse transform produces verse text and hashes.

### 8.2 Model Chapter Run
- Prompt model with chapter prompt.
- Store raw and processed outputs with hashes.
- Compare to canonical chapter.
- Attempt verse segmentation for verse-level results.

### 8.3 Model Verse Run
- Prompt model by verse.
- Store raw and processed outputs with hashes.
- Compare to canonical verse.

## 9. User Exploration
- User selects a single model.
- Allowed scopes: within a book, allows chapter or verse range within a chapter.
- Results persisted in userQueries.

## 10. Admin Controls (Local)
- Raw ingest trigger.
- Chapter transform trigger (auto verse transform).
- Model runs at scopes:
  - Bible -> model (all books/chapters/verses).
  - Book -> model (chapters + verses).
  - Chapter -> model (verses only).
- Model CRUD.
- Transform profile CRUD.
- Feature flags via appConfig.

## 11. Feature Flags
- SHOW_LATEST_ONLY stored in appConfig.

## 12. Error Codes
```
DB-LOCK-001  Lock acquire failed
DB-LOCK-002  Lock release failed
DB-READ-001  Database read failed
DB-WRITE-001 Database write failed
ETL-RAW-001  Raw ingest failed
ETL-CHAP-001 Chapter transform failed
ETL-VERSE-001 Verse transform failed
MODEL-API-001 Model API failed
MODEL-TIMEOUT-001 Model timeout
MODEL-PARSE-001 Model parse failed
```

## 13. Retry and Backoff
- Exponential backoff with jitter.
- Default retry limit: 3 (configurable).
- Safe-run retries only failed items.

## 14. Audit and ETL Control
- Audit fields on all documents: createdAt, createdBy, updatedAt, updatedBy.
- ETL control for lock state, last processed run, and batchId.

## 15. Observability
- Run metrics: totals, success, failure counts, durations.
- Latency per model request.
- Diff size and fidelity score distribution.

## 16. Security Notes
- API keys are stored encrypted in models collection.
- No public access to admin endpoints in production.

