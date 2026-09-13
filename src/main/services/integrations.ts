import { randomUUID } from "node:crypto";
import { Composio } from "@composio/core";
import { OpenAIResponsesProvider } from "@composio/openai";
import OpenAI from "openai";
import {
  TOOLKITS,
  type ActionPlan,
  type ActionResult,
  type Toolkit,
  type ToolkitConnection,
} from "../../shared/contracts";

const pendingPlans = new Map<string, ActionPlan>();
const provider = new OpenAIResponsesProvider({ strict: true });

let composio: Composio<OpenAIResponsesProvider> | undefined;
let sessionPromise: ReturnType<Composio<OpenAIResponsesProvider>["create"]> | undefined;

function requireEnvironment(name: "COMPOSIO_API_KEY" | "OPENAI_API_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Add ${name} to use actions`);
  return value;
}

function getOpenAI() {
  return new OpenAI({ apiKey: requireEnvironment("OPENAI_API_KEY") });
}

function getComposio() {
  if (!composio) {
    composio = new Composio({
      apiKey: requireEnvironment("COMPOSIO_API_KEY"),
      provider,
      allowTracking: false,
      dangerouslyAllowAutoUploadDownloadFiles: false,
    });
  }
  return composio;
}

function getSession() {
  if (!sessionPromise) {
    sessionPromise = getComposio().create(process.env.TWIN_USER_ID || "local-user", {
      toolkits: [...TOOLKITS],
      tags: { disable: ["destructiveHint"] },
      manageConnections: false,
      sandbox: { enable: false },
    });
  }
  return sessionPromise;
}

function isToolkit(value: unknown): value is Toolkit {
  return typeof value === "string" && TOOLKITS.includes(value as Toolkit);
}

function readPlan(value: unknown, command: string): ActionPlan {
  if (!value || typeof value !== "object") throw new Error("Twin could not understand that action");
  const data = value as Record<string, unknown>;
  if (!isToolkit(data.toolkit)) throw new Error("That action is outside the connected apps");

  const required = ["title", "description", "operation", "confirmation"] as const;
  for (const key of required) {
    if (typeof data[key] !== "string" || !data[key].trim()) {
      throw new Error("Twin could not build a complete action plan");
    }
  }

  return {
    id: randomUUID(),
    command,
    title: String(data.title).trim(),
    description: String(data.description).trim(),
    toolkit: data.toolkit,
    operation: String(data.operation).trim(),
    confirmation: String(data.confirmation).trim(),
  };
}

export async function getConnections(): Promise<ToolkitConnection[]> {
  const session = await getSession();
  const details = await session.toolkits({ toolkits: [...TOOLKITS] });
  return TOOLKITS.map((slug) => {
    const item = details.items.find((candidate) => candidate.slug.toLowerCase() === slug);
    return {
      slug,
      connected: Boolean(item?.connection?.isActive),
      accountId: item?.connection?.connectedAccount?.id,
    };
  });
}

export async function connectToolkit(toolkit: Toolkit) {
  const session = await getSession();
  const request = await session.authorize(toolkit);
  if (!request.redirectUrl) throw new Error(`Could not start the ${toolkit} connection`);
  return { redirectUrl: request.redirectUrl };
}

export async function prepareAction(command: string): Promise<ActionPlan> {
  const spokenCommand = command.trim();
  if (!spokenCommand) throw new Error("Say what you want Twin to do");

  const response = await getOpenAI().responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions:
      "You turn a spoken work request into a short review card. Choose exactly one toolkit: slack, jira, gmail, or github. Do not execute anything. Return JSON only with title, description, toolkit, operation, and confirmation. Description must include the recipient, destination, repository, project, or channel when the user supplied it. Confirmation must clearly state the external effect. Never invent missing names or content; mention missing details in the description.",
    input: spokenCommand,
    text: {
      format: {
        type: "json_schema",
        name: "twin_action_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            toolkit: { type: "string", enum: [...TOOLKITS] },
            operation: { type: "string" },
            confirmation: { type: "string" },
          },
          required: ["title", "description", "toolkit", "operation", "confirmation"],
        },
      },
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new Error("Twin could not prepare that action");
  }

  const plan = readPlan(parsed, spokenCommand);
  pendingPlans.set(plan.id, plan);
  return plan;
}

export async function executeAction(planId: string): Promise<ActionResult> {
  const plan = pendingPlans.get(planId);
  if (!plan) throw new Error("This action has expired. Prepare it again.");
  pendingPlans.delete(planId);

  const session = await getSession();
  const tools = await session.tools();
  const client = getOpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  let response = await client.responses.create({
    model,
    tools,
    instructions: [
      "You are Twin, a focused work assistant with access to Slack, Jira, Gmail, and GitHub through Composio.",
      "Execute exactly the approved request. Do not expand its scope, delete data, or perform additional actions.",
      "Use the relevant connected app tools. If a required detail or connection is missing, explain it without guessing.",
      "After tool use, give a concise factual result suitable for showing in a desktop confirmation card.",
    ].join(" "),
    input: `Approved request:\n${plan.command}\n\nReviewed plan:\n${plan.title}\n${plan.description}\nExpected effect: ${plan.confirmation}`,
  });

  let turns = 0;
  while (response.output.some((item) => item.type === "function_call")) {
    if (++turns > 8) throw new Error("The action took too many steps and was stopped");
    const results = await provider.handleToolCalls(session, response.output);
    response = await client.responses.create({
      model,
      tools,
      previous_response_id: response.id,
      input: results,
    });
  }

  return {
    planId,
    summary: response.output_text.trim() || "Action completed.",
  };
}
