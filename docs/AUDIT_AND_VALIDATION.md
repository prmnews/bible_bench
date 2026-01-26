# Audit and Validation Logic

## Purpose
This document explains how Bible Bench enforces data integrity, auditability, and validation across the ETL and evaluation pipeline.

## Audit Trail
### Audit Fields
All core collections include an `audit` object with `createdAt` and `createdBy`. This ensures a minimal, consistent trail of when and why each record was created.

### ETL Control State
Canonical chapter and verse documents store `etlControl` state with:
- `stage`: logical pipeline stage (chapters, verses).
- `isLocked`, `lockedBy`, `lockedAt`: reserved for document-level locking.
- `lastProcessedBy`, `lastProcessedAt`: last ETL execution metadata.
- `batchId`: optional batch identifier for traceability.

This metadata enables reliable reprocessing and supports recovery workflows.

## Run Tracking and Metrics
### Runs
The `runs` collection records every ETL and model run with:
- `status`, `startedAt`, `completedAt`
- `metrics` for counts and durations
- `logs` for stage-level messages
- `errorSummary` for last failure context

### Run Items
The `runItems` collection captures per-target status, attempts, and errors for run-level granularity.

## Validation Layers
### API Payload Validation
Admin endpoints validate payloads for data type and required fields before any write. This protects downstream collections from malformed input.

### Schema Validators (MongoDB)
The schema validator registry applies JSON schema validation to all collections. Validators are applied with:
- `validationLevel`: moderate
- `validationAction`: error

Use `POST /api/admin/schema/validators` to apply or update validators. The endpoint records every run in `schemaValidatorRuns`.

## Integrity Checks
### Hashes
Every canonical chapter and verse records both `hashRaw` and `hashProcessed` using SHA-256. This enables:
- deterministic equality checks
- diff comparisons against model output
- immutable audit trails for normalization steps

### Transform Profiles
Transform profiles are stored in MongoDB and applied deterministically in a defined order. This prevents hidden normalization logic and guarantees repeatable processing.

## Reliability and Recovery
### Idempotency
Upserts are used for ingest and transforms, allowing safe re-runs without duplicating records.

### Retriable Operations
Verse transforms use retry logic for MongoDB operations, and process in batches with periodic connection health checks.

### Error Visibility
Failures bubble into:
- `runItems.lastError`
- `runs.errorSummary`
- `runs.logs`

This makes error diagnosis and recovery actions explicit.

## Recommended Validation Workflow
1. Apply schema validators (`/api/admin/schema/validators`).
2. Run seed scripts to populate dimensions and default profiles.
3. Ingest and transform canonical data.
4. Validate counts and hashes before running model evaluations.
