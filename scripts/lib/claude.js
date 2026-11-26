import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const MODEL = "claude-sonnet-5-5";

let client;
const getClient = () => {
  // Lazily created so dotenv has loaded ANTHROPIC_API_KEY first
  if (!client) client = new Anthropic();
  return client;
};

// Ask Claude for a response that matches a zod schema and return the parsed object
export const generateStructured = async ({ system, prompt, schema, tools }) => {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...(tools ? { tools } : {}),
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(schema)
    }
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude refused the request: ${response.stop_details?.explanation ?? "no explanation"}`
    );
  }
  if (!response.parsed_output) {
    throw new Error(
      `Claude returned no parseable output (stop_reason: ${response.stop_reason})`
    );
  }
  return response.parsed_output;
};

// Anthropic-hosted web search, so the model can check facts instead of guessing
export const webSearchTool = (maxUses = 5) => ({
  type: "web_search_20260209",
  name: "web_search",
  max_uses: maxUses
});
