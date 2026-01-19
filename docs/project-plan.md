# Project Plan (Sprint Roadmap)

## Sprint 1 — Foundation & Data Layer
### E-01 Core Project Setup
- **S-01.1 Repo baseline + config hardening**
  - **T-01.1.1** [x] Normalize `package.json` scripts (lint/test/build/dev)
  - **T-01.1.2** [x] Add `.env.local` template + Vercel env guidance (no secrets committed)
- **S-01.3 API Contract & Swagger**
  - **T-01.3.1** [x] Add OpenAPI spec file (base schema, auth/local-only note)
  - **T-01.3.2** [x] Serve Swagger UI at `/api/docs` (dev/local-only)
- **S-01.2 MongoDB connection + health**
  - **T-01.2.1** [x] Connection helper with dbName support
  - **T-01.2.2** [x] Health endpoint returns dbConnected + dbNameConfigured

### E-02 Data Model v1 (Mongo/Mongoose)
- **S-02.1 Base collections & schemas**
  - **T-02.1.1** [x] Define `dimLanguages`, `dimBibles`, `dimBooks` schemas
  - **T-02.1.2** [x] Define `chapters`, `verses`, `rawChapters` schemas
- **S-02.2 Indexes & validation**
  - **T-02.2.1** [x] Create unique + compound indexes
  - **T-02.2.2** [x] Add JSON schema validators (moderate)

### E-03 Admin UI Shell
- **S-03.1 Admin layout + navigation**
  - **T-03.1.1** [x] Basic admin layout + nav
  - **T-03.1.2** [x] Empty pages for Dashboard / ETL / Models / Runs / Config

## Sprint 2 — ETL Pipeline
### E-04 ETL Ingest & Transform
- **S-04.1 Raw ingest API**
  - **T-04.1.1** [x] Admin endpoint: ingest raw chapter
    - Admin-only route with payload validation
    - Accepts source metadata (e.g., `bibleId`, `bookId`, `chapterNumber`, `sourceRef`)
  - **T-04.1.2** [x] Persist raw chapter with audit fields
    - Store `ingestedAt`, `ingestedBy`, `sourceHash`
    - Enforce idempotency for duplicate raw ingest
- **S-04.2 Transform profiles**
  - **T-04.2.1** [x] Transform profile schema + storage
    - Profiles include `name`, `version`, `steps` (regex/replace, normalize)
    - Track active/default profile per bible
  - **T-04.2.2** [x] Apply transform pipeline to raw → chapter
    - Apply profile steps in order with error reporting
    - Persist transformed chapter + profile reference
- **S-04.3 Verse extraction**
  - **T-04.3.1** [x] Verse parsing + storage
    - Extract verse numbers + text, preserve order
    - Store verse-level offsets for traceability
  - **T-04.3.2** [x] Add edge-case catalog tests
    - Cover multi-verse lines, missing numbers, and special markers
    - Include regression set for known translation quirks
- **S-04.4 Admin ETL Triggers**
  - **T-04.4.1** [x] Admin endpoint to apply DB schema validators
    - Admin-only route with optional `dryRun`
    - Returns per-collection validator status + errors
    - Records a validator run entry (startedAt, completedAt, success)
  - **T-04.4.2** [x] Admin endpoints to trigger raw ingest → transform → verse parsing
    - Admin-only routes for single-stage and full-pipeline triggers
    - Supports scoped runs (e.g., `bibleId`, `bookId`, `chapterNumber`, `limit`)
    - Returns run summary with counts + errors
    - Supports idempotent `runId` to prevent duplicate processing
    - Emits run log entries for each stage (ingest/transform/parse)

## Sprint 3 — Model Runs & Evaluation
### E-05 Model Execution
- **S-05.1 Model registry**
  - **T-05.1.1** Model CRUD (admin-only)
  - **T-05.1.2** Model capability flags (structured output)
- **S-05.2 Run orchestration**
  - **T-05.2.1** Run + runItems creation
  - **T-05.2.2** Execute model run + persist outputs

### E-06 Evaluation & Results
- **S-06.1 Compare + scoring**
  - **T-06.1.1** Hash/diff comparison
  - **T-06.1.2** Fidelity score computation
- **S-06.2 Results API**
  - **T-06.2.1** Chapter/verse results endpoints
  - **T-06.2.2** Dashboard metrics endpoint

## Sprint 4 — Hardening & Ops
### E-07 Observability & Ops
- **S-07.1 Logging + metrics**
  - **T-07.1.1** Run logs + error tracking fields
  - **T-07.1.2** Minimal metrics for runs/ETL
- **S-07.2 Deployment checks**
  - **T-07.2.1** Vercel build/test gates
  - **T-07.2.2** Production env validation

## Commit & PR Scoping
- **Commit per Task** (e.g., `T-02.1.1 add language/bible/book schemas`).
- **PR per Story** (e.g., `S-04.2 Transform profiles`).
