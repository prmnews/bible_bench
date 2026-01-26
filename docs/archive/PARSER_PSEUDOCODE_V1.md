# Parser Pseudocode v1

Status: Draft
Updated: 2026-01-17

## 1. ABS Chapter Flattening

```
function flattenChapterText(absPayload, transformProfile):
    textBuffer = []
    for node in absPayload.content:
        walk(node, textBuffer)
    rawText = join(textBuffer)
    processedText = applyTransformProfile(rawText, transformProfile)
    return { rawText, processedText }

function walk(node, textBuffer):
    if node.type == "text":
        textBuffer.append(node.text)
    if node.items exists:
        for child in node.items:
            walk(child, textBuffer)
```

## 2. Verse Extraction

```
function extractVerses(absPayload, transformProfile):
    buffers = map<verseId, string[]>()
    currentVerseId = null

    function walk(node):
        if node.attrs and node.attrs.verseId:
            currentVerseId = node.attrs.verseId
        if node.type == "text" and currentVerseId != null:
            buffers[currentVerseId].append(node.text)
        if node.items exists:
            for child in node.items:
                walk(child)

    for node in absPayload.content:
        walk(node)

    verses = []
    for verseId, parts in buffers:
        rawText = join(parts)
        processedText = applyTransformProfile(rawText, transformProfile)
        verses.append({ verseId, rawText, processedText })

    return verses
```

## 3. Model Chapter Parsing (Verse Segmentation)

```
function parseModelChapterToVerses(modelOutput, canonicalVerses):
    # Attempt to split by explicit verse numbers first
    segments = splitByVerseNumbers(modelOutput)
    if segments.success:
        return alignSegmentsToCanonical(segments, canonicalVerses)

    # Fallback: split by canonical verse text boundaries (best-effort)
    return heuristicAlign(modelOutput, canonicalVerses)
```

## 4. Transform Pipeline

```
function applyTransformProfile(inputText, profile):
    output = inputText
    for step in profile.steps ordered by step.order:
        if step.enabled:
            output = applyStep(output, step)
    return output
```

## 5. Hashing

```
function sha256(text):
    return SHA-256(text)
```

## 6. Comparison

```
function compareText(canonicalProcessed, modelProcessed):
    hashMatch = sha256(canonicalProcessed) == sha256(modelProcessed)
    diff = computeDiff(canonicalProcessed, modelProcessed)
    fidelity = (diff.matchingChars / diff.totalChars) * 100
    return { hashMatch, diff, fidelity }
```

