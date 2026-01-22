/**
 * Verse Parser for Model Output
 *
 * Parses LLM chapter responses into individual verses.
 * Unlike the ABS parser which handles structured JSON, this parser
 * works with plain text output that may have varying formats.
 */

type ParsedVerse = {
  verseNumber: number;
  text: string;
  startOffset: number;
  endOffset: number;
};

type VerseParseResult = {
  verses: ParsedVerse[];
  unmatchedText: string[];
  warnings: string[];
};

type CanonicalVerse = {
  verseId: number;
  verseNumber: number;
  textProcessed: string;
  hashProcessed: string;
};

type MappedVerse = {
  verseId: number;
  verseNumber: number;
  canonicalText: string;
  canonicalHash: string;
  extractedText: string;
  matched: boolean;
};

type VerseMapResult = {
  mapped: MappedVerse[];
  missingVerses: number[];
  extraVerses: number[];
  warnings: string[];
};

/**
 * Common verse number patterns found in LLM output:
 * - "1 In the beginning..." (number at start of line)
 * - "[1] In the beginning..." (bracketed number)
 * - "1. In the beginning..." (number with period)
 * - "Verse 1: In the beginning..." (explicit verse label)
 * - "1: In the beginning..." (number with colon)
 */
const VERSE_PATTERNS = [
  // Pattern: "1 Text..." or "1. Text..." at line start
  /^(\d{1,3})[\.\s]\s*(.+)$/,
  // Pattern: "[1] Text..."
  /^\[(\d{1,3})\]\s*(.+)$/,
  // Pattern: "Verse 1: Text..." or "v1: Text..."
  /^(?:verse\s*|v)(\d{1,3})[\:\s]\s*(.+)$/i,
  // Pattern: "1: Text..."
  /^(\d{1,3}):\s*(.+)$/,
];

/**
 * Parse model output text into individual verses.
 * Handles various formatting styles that LLMs may use.
 */
export function parseModelVerses(text: string): VerseParseResult {
  const verses: ParsedVerse[] = [];
  const unmatchedText: string[] = [];
  const warnings: string[] = [];

  // Normalize line endings and split into lines
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedText.split("\n");

  let cursor = 0;
  let currentVerse: ParsedVerse | null = null;
  const seenVerseNumbers = new Set<number>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    const lineStart = cursor;
    const lineEnd = cursor + line.length;

    if (trimmedLine.length === 0) {
      // Empty line - if we have a current verse, this might be a paragraph break
      cursor = lineEnd + 1; // +1 for newline
      continue;
    }

    // Try to match verse pattern
    let matched = false;
    for (const pattern of VERSE_PATTERNS) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const verseNumber = parseInt(match[1], 10);
        const verseText = match[2].trim();

        // Check for duplicate verse numbers
        if (seenVerseNumbers.has(verseNumber)) {
          warnings.push(`Duplicate verse number ${verseNumber} found`);
        }
        seenVerseNumbers.add(verseNumber);

        // Save previous verse if exists
        if (currentVerse) {
          verses.push(currentVerse);
        }

        // Start new verse
        currentVerse = {
          verseNumber,
          text: verseText,
          startOffset: lineStart,
          endOffset: lineEnd,
        };

        matched = true;
        break;
      }
    }

    if (!matched) {
      if (currentVerse) {
        // Continuation of current verse (multi-line verse)
        currentVerse.text += " " + trimmedLine;
        currentVerse.endOffset = lineEnd;
      } else {
        // Text before first verse number - could be header/intro
        unmatchedText.push(trimmedLine);
      }
    }

    cursor = lineEnd + 1; // +1 for newline
  }

  // Don't forget the last verse
  if (currentVerse) {
    verses.push(currentVerse);
  }

  // Sort verses by verse number
  verses.sort((a, b) => a.verseNumber - b.verseNumber);

  return { verses, unmatchedText, warnings };
}

/**
 * Alternative parser that uses a more aggressive regex approach
 * for text where verses might not be on separate lines.
 */
export function parseModelVersesInline(text: string): VerseParseResult {
  const verses: ParsedVerse[] = [];
  const warnings: string[] = [];

  // Pattern to find verse numbers embedded in continuous text
  // Matches: "1 word word" or "[1] word" or "1. word"
  const inlinePattern = /(?:^|[\s\n])(\d{1,3})(?:[\.\:\]\s])\s*([^0-9]+?)(?=(?:[\s\n]\d{1,3}[\.\:\]\s])|$)/g;

  let match;
  const seenVerseNumbers = new Set<number>();

  while ((match = inlinePattern.exec(text)) !== null) {
    const verseNumber = parseInt(match[1], 10);
    const verseText = match[2].trim();

    if (seenVerseNumbers.has(verseNumber)) {
      warnings.push(`Duplicate verse number ${verseNumber} found`);
    }
    seenVerseNumbers.add(verseNumber);

    verses.push({
      verseNumber,
      text: verseText,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }

  // Sort verses by verse number
  verses.sort((a, b) => a.verseNumber - b.verseNumber);

  return { verses, unmatchedText: [], warnings };
}

/**
 * Smart parser that tries line-based first, falls back to inline.
 */
export function parseModelVersesAuto(text: string): VerseParseResult {
  // Try line-based parsing first
  const lineResult = parseModelVerses(text);

  // If we got a reasonable number of verses, use line-based result
  if (lineResult.verses.length > 0) {
    return lineResult;
  }

  // Fall back to inline parsing
  return parseModelVersesInline(text);
}

/**
 * Map parsed verses to canonical verses for a chapter.
 * Returns matched verses with their canonical counterparts.
 */
export function mapToCanonicalVerses(
  parsed: ParsedVerse[],
  canonical: CanonicalVerse[]
): VerseMapResult {
  const mapped: MappedVerse[] = [];
  const warnings: string[] = [];

  // Build lookup by verse number
  const canonicalByNumber = new Map<number, CanonicalVerse>();
  for (const verse of canonical) {
    canonicalByNumber.set(verse.verseNumber, verse);
  }

  const parsedByNumber = new Map<number, ParsedVerse>();
  for (const verse of parsed) {
    parsedByNumber.set(verse.verseNumber, verse);
  }

  // Find canonical verses
  const canonicalNumbers = new Set(canonical.map((v) => v.verseNumber));
  const parsedNumbers = new Set(parsed.map((v) => v.verseNumber));

  // Missing: in canonical but not in parsed
  const missingVerses: number[] = [];
  for (const num of canonicalNumbers) {
    if (!parsedNumbers.has(num)) {
      missingVerses.push(num);
    }
  }

  // Extra: in parsed but not in canonical
  const extraVerses: number[] = [];
  for (const num of parsedNumbers) {
    if (!canonicalNumbers.has(num)) {
      extraVerses.push(num);
      warnings.push(`Verse ${num} found in model output but not in canonical`);
    }
  }

  // Map matched verses
  for (const canonicalVerse of canonical) {
    const parsedVerse = parsedByNumber.get(canonicalVerse.verseNumber);

    mapped.push({
      verseId: canonicalVerse.verseId,
      verseNumber: canonicalVerse.verseNumber,
      canonicalText: canonicalVerse.textProcessed,
      canonicalHash: canonicalVerse.hashProcessed,
      extractedText: parsedVerse?.text ?? "",
      matched: !!parsedVerse,
    });
  }

  if (missingVerses.length > 0) {
    warnings.push(`Missing verses: ${missingVerses.join(", ")}`);
  }

  return { mapped, missingVerses, extraVerses, warnings };
}

/**
 * Build canonical verse IDs from chapter context.
 */
export function buildVerseId(
  bookId: number,
  chapterNumber: number,
  verseNumber: number
): number {
  return bookId * 100000 + chapterNumber * 1000 + verseNumber;
}

/**
 * Normalize extracted verse text for comparison.
 * Applies minimal normalization (whitespace, trim).
 */
export function normalizeVerseText(text: string): string {
  return text
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/\u2019/g, "'") // Smart apostrophe to regular
    .replace(/[\u201c\u201d]/g, '"') // Smart quotes to regular
    .trim();
}

export type {
  ParsedVerse,
  VerseParseResult,
  CanonicalVerse,
  MappedVerse,
  VerseMapResult,
};
