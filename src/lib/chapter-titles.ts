import { readFile } from "fs/promises";
import path from "path";

export type ChapterTitleEntry = {
  bibleId: number;
  bookCode: string;
  chapterNumber: number;
  title: string;
  line: number;
  raw: string;
};

export type ChapterTitleParseResult = {
  entries: ChapterTitleEntry[];
  warnings: string[];
};

const ENTRY_REGEX = /^([0-9A-Z]+)\.?\s*(\d+)\s*-\s*(.+)$/;
const BIBLE_PREFIX_REGEX = /^\[(\d+)\]\s*(.+)$/;

export async function loadChapterTitleEntries(options?: {
  defaultBibleId?: number;
  filePath?: string;
}): Promise<ChapterTitleParseResult> {
  const defaultBibleId = options?.defaultBibleId ?? 1001;
  const filePath =
    options?.filePath ?? path.join(process.cwd(), "data", "chapter_titles.txt");
  const text = await readFile(filePath, "utf8");

  const entries: ChapterTitleEntry[] = [];
  const warnings: string[] = [];

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      return;
    }

    let line = trimmed;
    let bibleId = defaultBibleId;
    const bibleMatch = BIBLE_PREFIX_REGEX.exec(line);
    if (bibleMatch) {
      bibleId = Number(bibleMatch[1]);
      line = bibleMatch[2].trim();
    }

    const match = ENTRY_REGEX.exec(line);
    if (!match) {
      warnings.push(`[chapter_titles] Unrecognized format at line ${lineNumber}: ${rawLine}`);
      return;
    }

    const bookCodeRaw = match[1].trim();
    const chapterNumber = Number(match[2]);
    const title = match[3].trim();

    if (!Number.isFinite(chapterNumber) || title.length === 0) {
      warnings.push(`[chapter_titles] Invalid entry at line ${lineNumber}: ${rawLine}`);
      return;
    }

    const bookCode = bookCodeRaw.replace(/\./g, "").toUpperCase();

    entries.push({
      bibleId,
      bookCode,
      chapterNumber,
      title,
      line: lineNumber,
      raw: rawLine,
    });
  });

  return { entries, warnings };
}

export function buildChapterTitleMap(entries: ChapterTitleEntry[]): {
  map: Map<string, string>;
  warnings: string[];
} {
  const map = new Map<string, string>();
  const warnings: string[] = [];

  for (const entry of entries) {
    const key = formatChapterTitleKey(
      entry.bibleId,
      entry.bookCode,
      entry.chapterNumber
    );
    if (map.has(key)) {
      warnings.push(
        `[chapter_titles] Duplicate title for ${key} at line ${entry.line}; overwriting.`
      );
    }
    map.set(key, entry.title);
  }

  return { map, warnings };
}

export function formatChapterTitleKey(
  bibleId: number,
  bookCode: string,
  chapterNumber: number
): string {
  return `${bibleId}:${bookCode.toUpperCase()}:${chapterNumber}`;
}
