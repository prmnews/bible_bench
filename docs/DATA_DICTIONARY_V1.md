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

## dimChapters
- chapterId (int, PK)
- bibleId (int, FK -> dimBibles.bibleId)
- bookId (int, FK -> dimBooks.bookId)
- chapterNumber (int)
- reference (string)
- chapterName (string)
- verseCount (int)
- audit (object)

## canonicalLanguages
- languageId (int, PK)
- isoCode (string)
- name (string)
- audit (object)

## canonicalBibles
- bibleId (int, PK)
- apiBibleId (string)
- languageId (int, FK -> canonicalLanguages.languageId)
- name (string)
- source (string)
- audit (object)

## canonicalBooks
- bookId (int, PK)
- bibleId (int, FK -> canonicalBibles.bibleId)
- bookCode (string, e.g., JHN)
- bookName (string)
- bookIndex (int, 1-66)
- audit (object)

## canonicalRawChapters
- rawChapterId (int, PK)
- bibleId (int, FK)
- bookId (int, FK)
- chapterNumber (int)
- reference (string)
- rawPayload (object)
- hashRaw (string)
- source (string)
- audit (object)

## canonicalChapters
- chapterId (int, PK)
- bibleId (int, FK)
- bookId (int, FK)
- chapterNumber (int)
- reference (string)
- textRaw (string)
- textProcessed (string)
- hashRaw (string)
- hashProcessed (string)
- rawChapterId (int, FK -> canonicalRawChapters.rawChapterId)
- transformProfileId (int, FK -> transformProfiles.profileId)
- etlControl (object)
- audit (object)

## canonicalVerses
- verseId (int, PK)
- chapterId (int, FK -> canonicalChapters.chapterId)
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

## modelProfileMap
- modelId (int, FK -> models.modelId)
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

## llmRawResponses
- responseId (int, PK)
- runId (string, FK)
- modelId (int, FK)
- targetType (string: chapter|verse)
- targetId (int)
- evaluatedAt (date)
- responseRaw (string)
- parsed (object)
- parseError (string)
- extractedText (string)
- latencyMs (number)
- audit (object)

## llmVerseResults
- resultId (int, PK)
- runId (string, FK)
- modelId (int, FK)
- verseId (int, FK)
- chapterId (int, FK)
- bookId (int, FK)
- bibleId (int, FK)
- evaluatedAt (date)
- responseRaw (string)
- responseProcessed (string)
- hashRaw (string)
- hashProcessed (string)
- hashMatch (boolean)
- fidelityScore (number)
- diff (object)
- latencyMs (number)
- audit (object)

## aggregationChapters
- chapterId (int, FK)
- modelId (int, FK)
- bibleId (int, FK)
- bookId (int, FK)
- runId (string, FK)
- evaluatedAt (date)
- avgFidelity (number)
- perfectRate (number)
- verseCount (int)
- matchCount (int)

## aggregationBooks
- bookId (int, FK)
- modelId (int, FK)
- bibleId (int, FK)
- runId (string, FK)
- evaluatedAt (date)
- avgFidelity (number)
- perfectRate (number)
- chapterCount (int)
- verseCount (int)
- matchCount (int)

## aggregationBibles
- bibleId (int, FK)
- modelId (int, FK)
- runId (string, FK)
- evaluatedAt (date)
- avgFidelity (number)
- perfectRate (number)
- bookCount (int)
- chapterCount (int)
- verseCount (int)
- matchCount (int)

## canonicalTestVerses
- testId (int, PK)
- verseId (int, FK)
- category (string)
- notes (string)
- addedAt (date)

## appConfig
- key (string, PK)
- value (string)
- modifiedAt (date)
- modifiedBy (string)

