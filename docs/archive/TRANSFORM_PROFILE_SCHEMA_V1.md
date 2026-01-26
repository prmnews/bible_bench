# Transform Profile Schema v1

Status: Draft
Updated: 2026-01-17

## 1. Purpose
Provide a config-driven, model-specific transformation pipeline for canonical text and model outputs. No hard-coded logic in ETL or comparison.

## 2. Collections
- transformProfiles
- modelProfileMap

## 3. transformProfiles Document
```json
{
  "_id": "ObjectId",
  "profileId": 101,
  "name": "ABS_KJV_CANONICAL_V1",
  "scope": "canonical",
  "description": "Strip ABS markup and normalize for comparison",
  "steps": [
    {
      "order": 1,
      "type": "stripMarkupTags",
      "enabled": true,
      "params": { "tagNames": ["wj", "add", "verse", "verse-span", "para", "char"] }
    },
    {
      "order": 2,
      "type": "stripParagraphMarkers",
      "enabled": true,
      "params": { "markers": ["\u00b6"] }
    },
    {
      "order": 3,
      "type": "stripVerseNumbers",
      "enabled": true,
      "params": { "patterns": ["^\\[?\\d+\\]?\\s+"] }
    },
    {
      "order": 4,
      "type": "regexReplace",
      "enabled": true,
      "params": { "pattern": "\\s+", "replacement": " " }
    },
    { "order": 5, "type": "trim", "enabled": true, "params": {} }
  ],
  "isActive": true,
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## 4. modelProfileMap Document
```json
{
  "_id": "ObjectId",
  "modelId": 10,
  "modelProfileId": 201,
  "audit": { "createdAt": "2026-01-17T00:00:00Z", "createdBy": "admin" }
}
```

## 5. Step Types (v1)
- stripMarkupTags
  - params.tagNames: array of tag names to remove from canonical or model output.
- stripParagraphMarkers
  - params.markers: array of markers to remove (e.g., \u00b6).
- stripVerseNumbers
  - params.patterns: array of regex patterns to remove verse numerals.
- stripHeadings
  - params.patterns: array of regex patterns for headings (e.g., John 3:16 (KJV)).
- regexReplace
  - params.pattern: regex string
  - params.replacement: string
- replaceMap
  - params.map: key/value dictionary replacement map
- collapseWhitespace
  - params.maxRuns: integer; collapse whitespace to a single space
- trim
  - params: empty

## 6. Execution Rules
- Steps are applied in ascending order.
- Steps with enabled=false are skipped.
- Any failure logs error and marks run item as TRANSFORM_FAILED.
- Output text is always captured even if later steps fail (audit).

## 7. Validation
- profileId is unique.
- scope must be one of: canonical, model_output.
- steps.order must be unique per profile.

