/// <reference types="node" />

"use node";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { NonRetryableError } from "@convex-dev/workpool";
import { v } from "convex/values";

import {
  normalizeText,
  processingResultValidator,
  type Definition,
  type ProcessingResult,
} from "./lib/wordTypes";

const MAX_DEFINITIONS = 3;

const openAiResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    found: { type: "boolean" },
    grammaticalCategory: { type: "string" },
    definitions: {
      type: "array",
      maxItems: MAX_DEFINITIONS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          definition: { type: "string" },
          example: { type: "string" },
        },
        required: ["definition", "example"],
      },
    },
  },
  required: ["found", "grammaticalCategory", "definitions"],
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function normalizedModelText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error("INVALID_MODEL_OUTPUT");
  }

  const text = normalizeText(value);
  if (text.length === 0 || text.length > maxLength) {
    throw new Error("INVALID_MODEL_OUTPUT");
  }

  return text;
}

function normalizeModelOutput(value: unknown): ProcessingResult {
  if (!isRecord(value) || typeof value.found !== "boolean") {
    throw new Error("INVALID_MODEL_OUTPUT");
  }

  if (!Array.isArray(value.definitions) || value.definitions.length > 3) {
    throw new Error("INVALID_MODEL_OUTPUT");
  }

  const grammaticalCategory =
    typeof value.grammaticalCategory === "string"
      ? normalizeText(value.grammaticalCategory).toLocaleLowerCase("es")
      : "";

  const definitions: Definition[] = value.definitions.map((definition) => {
    if (!isRecord(definition)) {
      throw new Error("INVALID_MODEL_OUTPUT");
    }

    return {
      definition: normalizedModelText(definition.definition, 400),
      example: normalizedModelText(definition.example, 300),
    };
  });

  if (!value.found || definitions.length === 0) {
    return {
      status: "not_found",
      definitions: [],
      grammaticalCategory: "",
    };
  }

  if (grammaticalCategory.length === 0) {
    throw new Error("INVALID_MODEL_OUTPUT");
  }

  return {
    status: "ready",
    definitions,
    grammaticalCategory,
  };
}

function extractMessageContent(value: unknown): string {
  if (
    !isRecord(value) ||
    !Array.isArray(value.choices) ||
    !isRecord(value.choices[0]) ||
    !isRecord(value.choices[0].message) ||
    typeof value.choices[0].message.content !== "string"
  ) {
    throw new Error("INVALID_OPENAI_RESPONSE");
  }

  return value.choices[0].message.content;
}

async function generateDefinitions(word: string): Promise<ProcessingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new NonRetryableError("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 700,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "spanish_word_definitions",
          strict: true,
          schema: openAiResponseSchema,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Eres un diccionario de español. Devuelve solo JSON válido. " +
            "Para palabras existentes, entrega como máximo tres definiciones " +
            "breves en español, cada una con un ejemplo natural en español y " +
            "la categoría gramatical. Si no reconoces la palabra, usa found " +
            "false y una lista de definiciones vacía.",
        },
        {
          role: "user",
          content: `Palabra: ${word}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      throw new NonRetryableError("OPENAI_REQUEST_REJECTED");
    }
    throw new Error("OPENAI_TEMPORARY_FAILURE");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("INVALID_OPENAI_RESPONSE");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractMessageContent(body));
  } catch {
    throw new Error("INVALID_MODEL_OUTPUT");
  }

  return normalizeModelOutput(parsed);
}

export const processWord = internalAction({
  args: {
    wordId: v.id("words"),
    jobVersion: v.number(),
  },
  returns: v.union(v.null(), processingResultValidator),
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(
      internal.wordProcessingData.claimForProcessing,
      args,
    );

    if (!job) {
      return null;
    }

    const result = await generateDefinitions(job.word);
    await ctx.runMutation(internal.wordProcessingData.completeWord, {
      ...args,
      result,
    });

    return result;
  },
});
