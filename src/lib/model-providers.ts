import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

type ModelResponseParams = {
  targetType: "chapter" | "verse";
  targetId: number;
  reference: string;
  canonicalRaw: string;
  canonicalProcessed: string;
  model: {
    provider: string;
    apiConfigEncrypted?: Record<string, unknown> | null;
  };
};

type ModelResponseResult = {
  responseRaw: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(([, entry]) => typeof entry === "string");
  return Object.fromEntries(entries) as Record<string, string>;
}

type MockConfig = {
  mode?: "echo_raw" | "echo_processed" | "literal";
  literalResponse?: string;
  overrides?: Record<string, string>;
};

function resolveMockConfig(config: Record<string, unknown> | null | undefined): MockConfig {
  if (!isRecord(config)) {
    return {};
  }

  const source = isRecord(config["mock"]) ? (config["mock"] as Record<string, unknown>) : config;
  const mode = getString(source["mode"]) as MockConfig["mode"] | null;
  const literalResponse = getString(source["literalResponse"]);
  const overrides = getStringMap(source["overrides"]);

  return {
    mode: mode ?? undefined,
    literalResponse: literalResponse ?? undefined,
    overrides,
  };
}

async function generateMockResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = resolveMockConfig(params.model.apiConfigEncrypted);
  const targetKey = String(params.targetId);
  const override = config.overrides?.[targetKey];
  if (override !== undefined) {
    return { responseRaw: override };
  }

  switch (config.mode) {
    case "echo_processed":
      return { responseRaw: params.canonicalProcessed };
    case "literal":
      if (config.literalResponse !== undefined) {
        return { responseRaw: config.literalResponse };
      }
      return { responseRaw: params.canonicalRaw };
    case "echo_raw":
    default:
      return { responseRaw: params.canonicalRaw };
  }
}

function buildPrompt(params: ModelResponseParams): string {
  const typeLabel = params.targetType === "chapter" ? "chapter" : "verse";
  return `Please recite the King James Version (KJV) Bible text for ${params.reference}. 

Provide ONLY the exact KJV text for this ${typeLabel}, without verse numbers, without any introduction, commentary, or explanation. Just the pure biblical text.`;
}

async function generateOpenAIResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = params.model.apiConfigEncrypted;
  if (!isRecord(config)) {
    throw new Error("OpenAI model configuration is missing.");
  }

  const apiKey = getString(config["apiKey"]);
  if (!apiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const modelName = getString(config["model"]) ?? "gpt-4o";
  const maxTokens = typeof config["maxTokens"] === "number" ? config["maxTokens"] : 4096;

  const client = new OpenAI({ apiKey });
  const prompt = buildPrompt(params);

  const response = await client.chat.completions.create({
    model: modelName,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content:
          "You are a biblical scholar with perfect recall of the King James Version of the Bible. When asked to recite scripture, you provide the exact KJV text without any modifications, additions, or commentary.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  return { responseRaw: content };
}

async function generateAnthropicResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = params.model.apiConfigEncrypted;
  if (!isRecord(config)) {
    throw new Error("Anthropic model configuration is missing.");
  }

  const apiKey = getString(config["apiKey"]);
  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  const modelName = getString(config["model"]) ?? "claude-sonnet-4-20250514";
  const maxTokens = typeof config["maxTokens"] === "number" ? config["maxTokens"] : 4096;

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(params);

  const response = await client.messages.create({
    model: modelName,
    max_tokens: maxTokens,
    system:
      "You are a biblical scholar with perfect recall of the King James Version of the Bible. When asked to recite scripture, you provide the exact KJV text without any modifications, additions, or commentary.",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const content = textBlock?.type === "text" ? textBlock.text : "";
  return { responseRaw: content };
}

async function generateGeminiResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = params.model.apiConfigEncrypted;
  if (!isRecord(config)) {
    throw new Error("Gemini model configuration is missing.");
  }

  const apiKey = getString(config["apiKey"]);
  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  const modelName = getString(config["model"]) ?? "gemini-2.0-flash";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction:
      "You are a biblical scholar with perfect recall of the King James Version of the Bible. When asked to recite scripture, you provide the exact KJV text without any modifications, additions, or commentary.",
  });

  const prompt = buildPrompt(params);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const content = response.text();

  return { responseRaw: content };
}

export async function generateModelResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const provider = params.model.provider?.toLowerCase() ?? "mock";

  switch (provider) {
    case "openai":
      return generateOpenAIResponse(params);
    case "anthropic":
      return generateAnthropicResponse(params);
    case "google":
    case "gemini":
      return generateGeminiResponse(params);
    case "mock":
    default:
      return generateMockResponse(params);
  }
}
