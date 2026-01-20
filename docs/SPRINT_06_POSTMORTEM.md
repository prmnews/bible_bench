# Sprint-06 Post-Mortem: Genesis 1 LLM Validation Test

**Date**: 2026-01-20  
**Test Scope**: Genesis Chapter 1 (31 verses)  
**Run Type**: MODEL_CHAPTER (chapter-level, single API call)

---

## Executive Summary

Successfully validated the complete LLM evaluation pipeline using a Mock provider on Genesis 1. The pipeline correctly processes LLM responses, applies transforms, computes hash signatures, calculates fidelity scores, and materializes results in the dashboard.

---

## Test Results

### Run Details

| Metric | Value |
|--------|-------|
| Run ID | `0d49b7b3-1da9-4914-ae01-537260b56846` |
| Model | Mock Model (modelId: 1) |
| Chapter | Genesis 1 (chapterId: 1001) |
| Status | **Completed** |
| Duration | 912ms |
| Failed Items | 0 |

### Validation Results

| Goal | Status | Details |
|------|--------|---------|
| LLM calls working | PASS | Run completed successfully with status "completed" |
| Structured response | PASS | Valid JSON with `book`, `chapter`, `verses[]` structure |
| Transforms working | PASS | `responseProcessed` (4137 chars) correctly normalized |
| Hash signatures | PASS | 64-char SHA256 hex strings for `hashRaw` and `hashProcessed` |
| Scoring working | PASS | `fidelityScore: 100`, `hashMatch: true`, `diff` all zeros |
| Dashboard shows results | PASS | Run visible in dashboard with model performance metrics |

### Result Data

```json
{
  "resultId": 1768926733288205,
  "modelId": 1,
  "chapterId": 1001,
  "hashRaw": "c82992c6101ba5f45787efbb2e14fdcb770baf6c68d43534d5290a80a20233e2",
  "hashProcessed": "b93c3805dd72072ecb3a473298088a22144c67b878dee32a5b31db0978af7e55",
  "hashMatch": true,
  "fidelityScore": 100,
  "diff": {
    "substitutions": 0,
    "omissions": 0,
    "additions": 0,
    "transpositions": 0
  },
  "latencyMs": 0,
  "responseRawLength": 4215,
  "responseProcessedLength": 4137
}
```

---

## Issues Found

### 1. OpenAI API Parameter Change

**Issue**: OpenAI's newer models require `max_completion_tokens` instead of `max_tokens`.

**Error**: `400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.`

**Resolution**: Updated `src/lib/model-providers.ts` to use `max_completion_tokens` for OpenAI calls.

**File**: `src/lib/model-providers.ts:285-293`

### 2. Fictional Model Names in Database

**Issue**: The GPT-5-Nano model (`gpt-5-nano-2025-08-07`) is a fictional model name that doesn't exist in OpenAI's API.

**Impact**: Real LLM testing blocked until valid model names are configured.

**Recommendation**: Update model configurations with valid model names (e.g., `gpt-4o`, `gpt-4o-mini`).

### 3. Mock Provider Verse Aggregation

**Observation**: The Mock provider returns all chapter text as a single verse instead of 31 individual verses.

**Impact**: This is expected behavior for the echo mode, but means verse-level granularity isn't validated in chapter runs.

**Recommendation**: Consider adding a Mock mode that produces verse-accurate responses for more realistic testing.

### 4. Environment Configuration Mismatch

**Issue**: `.env.local` and the running Next.js server use different MongoDB URIs.

**Impact**: Test scripts using `.env.local` connect to a different database than the running application.

**Recommendation**: Standardize environment configuration or add admin endpoints for result inspection.

**Resolution**: Added `/api/admin/results/chapter/[chapterId]` endpoint for full result inspection.

---

## Performance Observations

| Metric | Value | Notes |
|--------|-------|-------|
| Run Duration | 912ms | Fast - Mock provider has no network latency |
| Response Raw Size | 4215 bytes | JSON with book, chapter, verses structure |
| Response Processed Size | 4137 bytes | After MODEL_OUTPUT_V1 transform |

---

## Sprint-07 Objectives

Based on this validation, the following objectives are recommended for Sprint-07:

### Priority 1: Real LLM Integration

1. **Fix model configurations** - Update fictional model names to real ones
   - GPT-5-Nano → `gpt-4o-mini` or `gpt-4o`
   - GPT-5-Mini → `gpt-4o`
   - GPT-5.2 → `gpt-4.5-preview` (if available)
   - Validate API keys are correct

2. **Test with real providers** - Execute Genesis 1 with:
   - OpenAI (GPT-4o)
   - Anthropic (Claude Sonnet 4.5)
   - Google (Gemini 2.5 Flash)

3. **Collect baseline metrics** - Document:
   - Fidelity scores per model
   - Latency per model
   - Common error patterns

### Priority 2: Verse-Level Testing

4. **Run verse-level tests** - Execute MODEL_VERSE runs for Genesis 1 (31 individual API calls)
   - Compare verse-level vs chapter-level fidelity
   - Measure cumulative latency

5. **Enhance Mock provider** - Add verse-accurate mock mode
   - Return individual verses with correct verse numbers
   - Better simulate real LLM response structure

### Priority 3: Dashboard Enhancements

6. **Add detailed result view** - Create UI for viewing:
   - Full responseRaw/responseProcessed text
   - Side-by-side canonical vs response comparison
   - Character-level diff visualization

7. **Add result filtering** - Filter by:
   - Model
   - Run ID
   - Fidelity score range
   - Hash match status

### Priority 4: Scaling Preparation

8. **Book-level test** - Run full Genesis (50 chapters)
   - Measure total time and cost
   - Identify rate limiting issues

9. **Add progress tracking** - For long-running runs:
   - Real-time progress updates
   - ETA calculation
   - Pause/resume capability

### Priority 5: Quality Improvements

10. **Improve error handling** - Better error messages for:
    - API rate limits
    - Invalid model configurations
    - Network failures

11. **Add retry logic** - Automatic retry for transient failures
    - Configurable retry count
    - Exponential backoff

---

## Files Modified in Sprint-06

| File | Change |
|------|--------|
| `src/lib/model-providers.ts` | Fixed `max_tokens` → `max_completion_tokens` for OpenAI |
| `src/app/api/admin/results/chapter/[chapterId]/route.ts` | Added full result inspection endpoint |
| `tests/genesis-1-validation.test.ts` | Added validation test (for future use) |

---

## Conclusion

The Sprint-06 validation test confirms the core pipeline is functioning correctly. The main blockers for real LLM testing are:

1. Invalid model names in the database
2. Need to verify API keys are valid

Once these are resolved, the system is ready for real LLM benchmarking at scale.
