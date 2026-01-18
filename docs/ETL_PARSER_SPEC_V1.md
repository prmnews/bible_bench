# ETL and Parsing Specification v1

Status: Draft
Updated: 2026-01-17

## 1. Raw Ingest (ABS JSON)
### Input
- ABS chapter JSON per chapter (1,189 chapters).

### Output
- rawChapters collection.

### Steps
1. Load chapter JSON.
2. Compute hashRaw = SHA-256(JSON.stringify(payload)).
3. Store raw payload and metadata in rawChapters.
4. Create run record (RAW_INGEST) and runItems per chapter.

## 2. Chapter Transform
### Input
- rawChapters

### Output
- chapters collection
- auto-triggers verse transform

### Steps
1. For each rawChapter document:
   - Apply canonical transform profile (strip markup tags, paragraph markers, optional verse numerals).
   - Flatten text content into a single chapter string.
2. Store textRaw, textProcessed, hashRaw, hashProcessed.
3. Create CHAPTER_TRANSFORM run and runItems.
4. Trigger verse transform automatically.

## 3. Verse Transform
### Input
- rawChapters or chapters

### Output
- verses collection

### Parsing Algorithm (ABS content)
1. Traverse the chapter content array.
2. Track current verseId from attrs.verseId on verse-span nodes.
3. For each text node with attrs.verseId, append its text to a per-verse buffer.
4. Ignore markup tags (wj, add, verse-span, para) but preserve text.
5. Strip paragraph markers (e.g., "\u00b6") at transform stage.
6. When verseId changes, flush buffer to create a verse record.
7. Apply canonical transform profile to each verse.
8. Store textRaw, textProcessed, hashRaw, hashProcessed.

## 4. Model Chapter Run
### Input
- chapters (canonical)
- model configuration and transform profile

### Output
- chapterResults and verseResults

### Steps
1. Build prompt using chapter template.
2. Call model API.
3. Store responseRaw.
4. Apply model output transform profile to get responseProcessed.
5. Compare responseProcessed to canonical chapter.
6. Compute hash match + fidelity score + diff.
7. Attempt verse segmentation:
   - Detect verse numbers/markers in model output.
   - Split into verses by detected markers or canonical verse boundaries.
8. If segmentation fails, mark run item MODEL-PARSE-001 and store chapter result only.

## 5. Model Verse Run
### Input
- verses (canonical)
- model configuration and transform profile

### Output
- verseResults

### Steps
1. Build prompt using verse template.
2. Call model API.
3. Store responseRaw.
4. Apply model output transform profile to responseProcessed.
5. Compare responseProcessed to canonical verse.
6. Store hash match + fidelity score + diff.

## 6. Retry and Backoff
- Exponential backoff with jitter.
- Retry limit configurable (default 3).
- Safe-run retries only failed items.

## 7. Failure Handling
- Any failure should store error payload in runItems.lastError.
- Persist partial results whenever possible.

