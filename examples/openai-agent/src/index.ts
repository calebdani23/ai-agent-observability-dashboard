import { ObservabilityClient } from "@portfolio/telemetry-sdk";

const openaiApiKey = requiredEnv("OPENAI_API_KEY");
const apiUrl = process.env.OBSERVABILITY_API_URL ?? "http://localhost:8000";
const ingestApiKey = process.env.OBSERVABILITY_INGEST_API_KEY;
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const userPrompt = process.env.OPENAI_AGENT_PROMPT ?? "Summarize why AI agent observability matters for a product engineering team in 3 concise bullets.";

type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: ToolCall[] };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

const systemPrompt = "You are a concise product engineering assistant. Use the available portfolio_context tool when relevant, then answer clearly.";

async function main() {
  const client = new ObservabilityClient({
    apiUrl,
    apiKey: ingestApiKey,
    appName: "real-openai-agent",
    defaultModel: model,
    defaultProvider: "openai",
    metadata: { generated_by: "examples/openai-agent", real_provider: true },
  });

  const trace = client.createTrace({
    sessionId: `openai-session-${Date.now()}`,
    operation: "openai_chat_with_observability",
    model,
    provider: "openai",
    metadata: { redaction_notice: "OpenAI key is read from env and never sent to the dashboard.", user_prompt: userPrompt, system_prompt: systemPrompt },
  });
  client.addStep(trace.id, { stepType: "user_message", name: "Receive real prompt", input: userPrompt, latencyMs: 0 });

  const firstStarted = new Date();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  const first = await callOpenAI(messages);
  const firstLatency = Date.now() - firstStarted.getTime();
  const assistantMessage = first.choices?.[0]?.message;
  const firstUsage = first.usage ?? {};
  const llmStep = client.addStep(trace.id, {
    stepType: "llm_call",
    name: "OpenAI chat completion",
    input: "System prompt + user prompt",
    output: assistantMessage?.content ?? "OpenAI requested a tool call.",
    startedAt: firstStarted,
    endedAt: new Date(),
    latencyMs: firstLatency,
    inputTokens: firstUsage.prompt_tokens ?? 0,
    outputTokens: firstUsage.completion_tokens ?? 0,
    metadata: { model, finish_reason: first.choices?.[0]?.finish_reason },
  });

  let finalOutput = assistantMessage?.content ?? "";
  let inputTokens = firstUsage.prompt_tokens ?? 0;
  let outputTokens = firstUsage.completion_tokens ?? 0;

  if (assistantMessage?.tool_calls?.length) {
    messages.push({ role: "assistant", content: assistantMessage.content ?? null, tool_calls: assistantMessage.tool_calls });
    for (const toolCall of assistantMessage.tool_calls) {
      const toolStarted = Date.now();
      const toolResult = portfolioContextTool(toolCall.function.arguments);
      const toolLatency = Date.now() - toolStarted;
      client.recordToolCall(trace.id, {
        stepId: llmStep.id,
        toolName: toolCall.function.name,
        input: safeJson(toolCall.function.arguments),
        output: toolResult,
        status: "success",
        latencyMs: toolLatency,
      });
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolResult) });
    }

    const finalStarted = new Date();
    const final = await callOpenAI(messages);
    const finalUsage = final.usage ?? {};
    finalOutput = final.choices?.[0]?.message?.content ?? "";
    inputTokens += finalUsage.prompt_tokens ?? 0;
    outputTokens += finalUsage.completion_tokens ?? 0;
    client.addStep(trace.id, {
      stepType: "final_response",
      name: "OpenAI final response after tool",
      input: "Tool result + conversation context",
      output: finalOutput,
      startedAt: finalStarted,
      endedAt: new Date(),
      latencyMs: Date.now() - finalStarted.getTime(),
      inputTokens: finalUsage.prompt_tokens ?? 0,
      outputTokens: finalUsage.completion_tokens ?? 0,
      metadata: { model, finish_reason: final.choices?.[0]?.finish_reason },
    });
  } else {
    client.addStep(trace.id, { stepType: "final_response", name: "Return OpenAI response", output: finalOutput, latencyMs: 0 });
  }

  const finished = client.finishTrace(trace.id, { status: "success", inputTokens, outputTokens });
  const storedTrace = await client.sendTrace(finished.id);
  console.log(`Sent OpenAI trace ${storedTrace.id} to ${apiUrl}`);
  console.log(finalOutput);
}

async function callOpenAI(messages: ChatMessage[]) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "portfolio_context",
            description: "Return short context about the AI Agent Observability Dashboard project.",
            parameters: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"], additionalProperties: false },
          },
        },
      ],
      tool_choice: "auto",
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${response.statusText} ${await response.text()}`);
  return response.json() as Promise<any>;
}

function portfolioContextTool(rawArguments: string) {
  const args = safeJson(rawArguments);
  return {
    topic: args.topic ?? "observability",
    project: "AI Agent Observability Dashboard",
    capabilities: ["trace timeline", "prompt/output inspection", "tool-call logging", "token/cost/latency metrics"],
  };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to run examples/openai-agent`);
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
