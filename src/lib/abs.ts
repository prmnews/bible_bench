type AbsNode = {
  type?: string;
  text?: string;
  items?: AbsNode[];
  attrs?: Record<string, unknown>;
};

type AbsPayload = {
  content?: AbsNode[];
};

type AbsVerse = {
  verseId: string;
  textRaw: string;
  startOffset: number;
  endOffset: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbsNode(value: unknown): value is AbsNode {
  return isRecord(value);
}

export function flattenAbsText(payload: unknown) {
  if (!isRecord(payload)) {
    return "";
  }

  const content = payload["content"];
  if (!Array.isArray(content)) {
    return "";
  }

  const parts: string[] = [];
  const walk = (node: AbsNode) => {
    if (node.type === "text" && typeof node.text === "string") {
      parts.push(node.text);
    }

    if (Array.isArray(node.items)) {
      node.items.forEach((child) => {
        if (isAbsNode(child)) {
          walk(child);
        }
      });
    }
  };

  content.forEach((node) => {
    if (isAbsNode(node)) {
      walk(node);
    }
  });

  return parts.join("");
}

export function flattenAbsTextWithBrackets(payload: unknown): string {
  const verses = extractAbsVerses(payload);
  return verses
    .map((v) => `[${v.verseId}] ${v.textRaw}`)
    .join(" ");
}

export function extractAbsVerses(payload: unknown): AbsVerse[] {
  if (!isRecord(payload)) {
    return [];
  }

  const content = payload["content"];
  if (!Array.isArray(content)) {
    return [];
  }

  const buffers = new Map<
    string,
    { parts: string[]; startOffset: number; endOffset: number }
  >();
  let currentVerseId: string | null = null;
  let cursor = 0;

  const walk = (node: AbsNode) => {
    const attrs = node.attrs;
    if (isRecord(attrs)) {
      const verseId = attrs["verseId"];
      if (typeof verseId === "string" && verseId.trim().length > 0) {
        currentVerseId = verseId;
        if (!buffers.has(verseId)) {
          buffers.set(verseId, {
            parts: [],
            startOffset: cursor,
            endOffset: cursor,
          });
        }
      }
    }

    if (node.type === "text" && typeof node.text === "string") {
      const text = node.text;
      const length = text.length;

      if (currentVerseId) {
        const entry = buffers.get(currentVerseId);
        if (entry) {
          entry.parts.push(text);
          entry.endOffset = cursor + length;
        }
      }

      cursor += length;
    }

    if (Array.isArray(node.items)) {
      node.items.forEach((child) => {
        if (isAbsNode(child)) {
          walk(child);
        }
      });
    }
  };

  content.forEach((node) => {
    if (isAbsNode(node)) {
      walk(node);
    }
  });

  return Array.from(buffers.entries()).map(([verseId, entry]) => ({
    verseId,
    textRaw: entry.parts.join(""),
    startOffset: entry.startOffset,
    endOffset: entry.endOffset,
  }));
}

export type { AbsPayload, AbsNode, AbsVerse };
