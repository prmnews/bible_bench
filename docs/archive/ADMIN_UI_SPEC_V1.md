# Admin UI Specification v1

Status: Draft
Updated: 2026-01-17

## 1. Scope
Local-only admin interface for ETL runs, model management, and transform configuration. No authentication in v1.

## 2. Navigation
- Dashboard
- ETL Control
- Models
- Transform Profiles
- Runs
- Config

## 3. Screens and Actions

### 3.1 Dashboard
- Run status cards with totals, failures, and duration.
- Quick actions:
  - Retry failed items for latest run.
  - View run details.
- Alerts for failed items and transform errors.

### 3.2 ETL Control
- Raw ingest trigger (ABS JSON directory input).
- Chapter transform trigger (auto triggers verse transform).
- Status of current and last run.

### 3.3 Models
- List models with active/inactive toggles.
- Create model (provider, displayName, version, routingMethod, apiConfigEncrypted).
- Edit model metadata.

### 3.4 Transform Profiles
- List transform profiles and steps.
- Create new profile.
- Reorder steps.
- Enable/disable steps.
- Map profiles to models (canonicalProfileId, modelProfileId).

### 3.5 Runs
- Run list with filters (runType, status, modelId).
- Run detail page:
  - runItems list with status.
  - error payloads.
  - retry failed items.

### 3.6 Config
- Key/value editor for appConfig.
- Toggle SHOW_LATEST_ONLY (0/1).

## 4. Permissions (v1)
- No authentication in local development.
- Ensure admin routes are not exposed publicly.

## 5. System Messages
- Success: run started, run completed, profile saved.
- Failure: run failed, transform failed, API error, database error.

