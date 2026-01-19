export type KjvFileMeta = {
  bookNumber: number;
  bookName: string;
  bookCode: string;
  chapterNumber: number;
  bookId: number;
  rawChapterId: number;
  reference: string;
};

const FILE_REGEX = /^(\d+)-(.+)-([A-Z0-9]+)\.(\d+)\.json$/;

export function parseKjvFilename(fileName: string): KjvFileMeta | null {
  const match = FILE_REGEX.exec(fileName);
  if (!match) {
    return null;
  }

  const bookNumber = Number(match[1]);
  const bookName = match[2];
  const bookCode = match[3];
  const chapterNumber = Number(match[4]);

  if (!Number.isFinite(bookNumber) || !Number.isFinite(chapterNumber)) {
    return null;
  }

  const bookId = bookNumber * 10;
  const rawChapterId = bookId * 100 + chapterNumber;
  const reference = `${bookName} ${chapterNumber}`;

  return {
    bookNumber,
    bookName,
    bookCode,
    chapterNumber,
    bookId,
    rawChapterId,
    reference,
  };
}
