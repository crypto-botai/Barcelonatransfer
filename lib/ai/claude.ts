import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type AiModel = "haiku" | "sonnet";

const MODEL_IDS: Record<AiModel, string> = {
  haiku:  "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
};

// Cost per million tokens in USD cents
const COST: Record<AiModel, { input: number; output: number }> = {
  haiku:  { input: 25,  output: 125  },
  sonnet: { input: 300, output: 1500 },
};

export function computeCostCents(
  model: AiModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const c = COST[model];
  return Math.ceil(
    (inputTokens / 1_000_000) * c.input +
    (outputTokens / 1_000_000) * c.output,
  );
}

interface CallOptions {
  model?: AiModel;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  model: AiModel;
}

export async function callClaude(opts: CallOptions): Promise<CallResult> {
  const model: AiModel = opts.model ?? "haiku";
  const maxTokens = opts.maxTokens ?? 1024;

  const response = await anthropic.messages.create({
    model: MODEL_IDS[model],
    max_tokens: maxTokens,
    system: opts.system,
    messages: opts.messages,
  });

  const inputTokens  = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costCents    = computeCostCents(model, inputTokens, outputTokens);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return { text, inputTokens, outputTokens, costCents, model };
}

// Streaming call — returns an async generator of text chunks
export async function* streamClaude(opts: CallOptions): AsyncGenerator<
  { type: "text"; text: string } | { type: "done"; inputTokens: number; outputTokens: number; costCents: number }
> {
  const model: AiModel = opts.model ?? "haiku";

  const stream = anthropic.messages.stream({
    model: MODEL_IDS[model],
    max_tokens: opts.maxTokens ?? 512,
    system: opts.system,
    messages: opts.messages,
  });

  let inputTokens  = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
    if (event.type === "message_start") {
      inputTokens = event.message.usage.input_tokens;
    }
    if (event.type === "message_delta" && "usage" in event) {
      outputTokens = (event as { usage: { output_tokens: number } }).usage.output_tokens;
    }
  }

  const costCents = computeCostCents(model, inputTokens, outputTokens);
  yield { type: "done", inputTokens, outputTokens, costCents };
}

export { anthropic };
