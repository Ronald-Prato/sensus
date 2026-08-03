import { v } from "convex/values";

export const wordStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("ready"),
  v.literal("not_found"),
  v.literal("failed"),
);

export const definitionValidator = v.object({
  definition: v.string(),
  example: v.string(),
});

export const processingResultValidator = v.union(
  v.object({
    status: v.literal("ready"),
    definitions: v.array(definitionValidator),
    grammaticalCategory: v.string(),
  }),
  v.object({
    status: v.literal("not_found"),
    definitions: v.array(definitionValidator),
    grammaticalCategory: v.string(),
  }),
);

export type Definition = {
  definition: string;
  example: string;
};

export type ProcessingResult =
  | {
      status: "ready";
      definitions: Definition[];
      grammaticalCategory: string;
    }
  | {
      status: "not_found";
      definitions: Definition[];
      grammaticalCategory: string;
    };

export function normalizeText(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function normalizeWord(value: string): {
  word: string;
  wordKey: string;
} {
  const word = normalizeText(value).toLocaleLowerCase("es");
  if (word.length === 0 || word.length > 64) {
    throw new Error("INVALID_WORD");
  }

  return { word, wordKey: word };
}

export function normalizeSearchQuery(value: string): string {
  const query = normalizeText(value);
  if (query.length === 0 || query.length > 100) {
    throw new Error("INVALID_SEARCH_QUERY");
  }
  return query;
}

export function buildSearchText(
  word: string,
  grammaticalCategory: string,
  definitions: Definition[],
): string {
  return [
    word,
    grammaticalCategory,
    ...definitions.flatMap(({ definition, example }) => [definition, example]),
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}
