# Data Dictionary v1

Status: Draft
Updated: 2026-01-17

## Conventions
- PK = primary key
- FK = foreign key
- All text stored as UTF-8
- SHA-256 used for hashes

## dimLanguages
- languageId (int, PK)
- isoCode (string)
- name (string)
- audit (object)

## dimBibles
- bibleId (int, PK)
- apiBibleId (string)
- languageId (int, FK -> dimLanguages.languageId)
- name (string)
- source (string)
- audit (object)

## dimBooks
- bookId (int, PK)
- bibleId (int, FK -> dimBibles.bibleId)
- bookCode (string, e.g., JHN)
- bookName (string)
- bookIndex (int, 1-66)
- audit (object)

## rawChapters
- rawChapterId (int, PK)
- bibleId (int, FK)
- bookId (int, FK)
- chapterNumber (int)
- reference (string)
- rawPayload (object)
- hashRaw (string)
- source (string)
- audit (object)

## chapters
- chapterId (int, PK)
- bibleId (int, FK)
- bookId (int, FK)
- chapterNumber (int)
- reference (string)
- textRaw (string)
- textProcessed (string)
- hashRaw (string)
- hashProcessed (string)
- rawChapterId (int, FK -> rawChapters.rawChapterId)
- transformProfileId (int, FK -> transformProfiles.profileId)
- etlControl (object)
- audit (object)

## verses
- verseId (int, PK)
- chapterId (int, FK -> chapters.chapterId)
- bibleId (int, FK)
- bookId (int, FK)
- chapterNumber (int)
- verseNumber (int)
- reference (string)
- textRaw (string)
- textProcessed (string)
- hashRaw (string)
- hashProcessed (string)
- transformProfileId (int, FK -> transformProfiles.profileId)
- etlControl (object)
- audit (object)

## models
- modelId (int, PK)
- provider (string)
- displayName (string)
- version (string)
- routingMethod (string: direct|openrouter)
- isActive (boolean)
- apiConfigEncrypted (object)
- audit (object)

## transformProfiles
- profileId (int, PK)
- name (string)
- scope (string: canonical|model_output)
- description (string)
- steps (array)
- isActive (boolean)
- audit (object)

## modelTransformMap
- modelId (int, FK -> models.modelId)
- canonicalProfileId (int, FK -> transformProfiles.profileId)
- modelProfileId (int, FK -> transformProfiles.profileId)
- audit (object)

## runs
- runId (string, PK)
- runType (string: RAW_INGEST|CHAPTER_TRANSFORM|MODEL_CHAPTER|MODEL_VERSE)
- modelId (int, FK nullable)
- scope (string: bible|book|chapter)
- scopeIds (object)
- status (string)
- startedAt (date)
- completedAt (date)
- metrics (object)
- audit (object)

## runItems
- runId (string, FK -> runs.runId)
- targetType (string: chapter|verse)
- targetId (int)
- status (string)
- attempts (int)
- lastError (object)
- updatedAt (date)

## chapterResults
- resultId (int, PK)
- runId (string, FK)
- modelId (int, FK)
- chapterId (int, FK)
- responseRaw (string)
- responseProcessed (string)
- hashRaw (string)
- hashProcessed (string)
- hashMatch (boolean)
- fidelityScore (number)
- diff (object)
- audit (object)

## verseResults
- resultId (int, PK)
- runId (string, FK)
- modelId (int, FK)
- verseId (int, FK)
- responseRaw (string)
- responseProcessed (string)
- hashRaw (string)
- hashProcessed (string)
- hashMatch (boolean)
- fidelityScore (number)
- diff (object)
- audit (object)

## canonicalTestVerses
- testId (int, PK)
- verseId (int, FK)
- category (string)
- notes (string)
- addedAt (date)

## userQueries
- queryId (int, PK)
- timestamp (date)
- modelId (int, FK)
- queryType (string: chapter|verse_range)
- scope (object)
- responseRaw (string)
- responseProcessed (string)
- hashRaw (string)
- hashProcessed (string)
- hashMatch (boolean)
- diff (object)
- metadata (object)
- audit (object)

## appConfig
- key (string, PK)
- value (string)
- modifiedAt (date)
- modifiedBy (string)

