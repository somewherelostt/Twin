import { randomUUID } from "node:crypto";
import { Composio } from "@composio/core";
import { OpenAIResponsesProvider } from "@composio/openai";
import OpenAI from "openai";
import {
  TOOLKITS,
  type ActionPlan,
  type ActionProgress,
  type ActionResult,
  type ActionStep,
  type Toolkit,
  type ToolkitConnection,
} from "../../shared/contracts";

const pendingPlans = new Map<string, ActionPlan>();
const provider = new OpenAIResponsesProvider({ strict: true });

interface IntegrationRuntime {
  getSessionId(): string | undefined;
  setSessionId(sessionId: string | undefined): void;
  onProgress(progress: ActionProgress): void;
  onConnectionsChanged(): void;
}

let runtime: IntegrationRuntime = {
  getSessionId: () => undefined,
  setSessionId: () => undefined,
  onProgress: () => undefined,
  onConnectionsChanged: () => undefined,
};

let composio: Composio<OpenAIResponsesProvider> | undefined;
let sessionPromise: ReturnType<Composio<OpenAIResponsesProvider>["create"]> | undefined;

export function configureIntegrations(nextRuntime: IntegrationRuntime) {
  runtime = nextRuntime;
}

export function resetIntegrations() {
  composio = undefined;
  sessionPromise = undefined;
  runtime.setSessionId(undefined);
}

function requireEnvironment(name: "COMPOSIO_API_KEY" | "OPENAI_API_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Add ${name} to use actions`);
  return value;
}

function getOpenAI() {
  return new OpenAI({
    apiKey: requireEnvironment("OPENAI_API_KEY"),
    timeout: 60_000,
    maxRetries: 2,
  });
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

async function createOrResumeSession() {
  const client = getComposio();
  const savedSessionId = runtime.getSessionId();
  if (savedSessionId) {
    try {
      return await client.use(savedSessionId);
    } catch {
      runtime.setSessionId(undefined);
    }
  }

  const session = await client.create(process.env.TWIN_USER_ID || "local-user", {
    toolkits: [...TOOLKITS],
    tags: { disable: ["destructiveHint"] },
    manageConnections: false,
    sandbox: { enable: false },
  });
  runtime.setSessionId(session.sessionId);
  return session;
}

function getSession() {
  if (!sessionPromise) {
    sessionPromise = createOrResumeSession().catch((error) => {
      sessionPromise = undefined;
      throw error;
    });
  }
  return sessionPromise;
}

function createExecutionSession(toolkits: Toolkit[]) {
  return getComposio().create(process.env.TWIN_USER_ID || "local-user", {
    toolkits,
    tags: { disable: ["destructiveHint"] },
    manageConnections: false,
    sandbox: { enable: false },
  });
}

function isToolkit(value: unknown): value is Toolkit {
  return typeof value === "string" && TOOLKITS.includes(value as Toolkit);
}

function readPlan(value: unknown, command: string): ActionPlan {
  if (!value || typeof value !== "object") throw new Error("Twin could not understand that action");
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.toolkits) || !data.toolkits.length || !data.toolkits.every(isToolkit)) {
    throw new Error("That action is outside the connected apps");
  }

  const required = ["title", "description", "operation", "confirmation"] as const;
  for (const key of required) {
    if (typeof data[key] !== "string" || !data[key].trim()) {
      throw new Error("Twin could not build a complete action plan");
    }
  }
  if (typeof data.ready !== "boolean" || !Array.isArray(data.missingDetails) || !data.missingDetails.every((item) => typeof item === "string")) {
    throw new Error("Twin could not verify the action details");
  }

  return {
    id: randomUUID(),
    command,
    title: String(data.title).trim(),
    description: String(data.description).trim(),
    toolkits: [...new Set(data.toolkits)],
    operation: String(data.operation).trim(),
    confirmation: String(data.confirmation).trim(),
    ready: data.ready,
    missingDetails: data.missingDetails.map((item) => item.trim()).filter(Boolean),
  };
}

function toolkitForCall(name: string): Toolkit | undefined {
  const normalized = name.toLowerCase();
  return TOOLKITS.find((toolkit) => normalized.includes(toolkit));
}

function toolkitNames(toolkit: Toolkit) {
  return ({ slack: "Slack", jira: "Jira", gmail: "Gmail", github: "GitHub" } as const)[toolkit];
}

function actionLabel(name: string) {
  const normalized = name
    .replace(/^composio_/i, "")
    .replace(/_/g, " ")
    .toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function resultFailed(output: unknown) {
  if (typeof output !== "string") return false;
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    return parsed.successful === false || (typeof parsed.error === "string" && Boolean(parsed.error));
  } catch {
    return false;
  }
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
  void request.waitForConnection(180_000).then(() => runtime.onConnectionsChanged()).catch(() => undefined);
  return { redirectUrl: request.redirectUrl };
}

export async function prepareAction(command: string, screenContext?: string): Promise<ActionPlan> {
  const spokenCommand = command.trim();
  if (!spokenCommand) throw new Error("Say what you want Twin to do");

  const response = await getOpenAI().responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions:
      "You turn a spoken work request into a short review card. You may receive a screenshot of the app that was active when the user invoked Twin; use visible text to resolve words such as this, that, it, or here. Choose every required toolkit from slack, jira, gmail, and github. Support workflows that move information between apps. Do not execute anything. Return JSON only with title, description, toolkits, operation, confirmation, ready, and missingDetails. Set ready to false when a required recipient, destination, repository, project, or content cannot be resolved from the request or screenshot, and list each missing item. Confirmation must clearly state every external effect. Never invent missing names or content.",
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: spokenCommand },
        ...(screenContext ? [{ type: "input_image" as const, image_url: screenContext, detail: "low" as const }] : []),
      ],
    }],
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
            toolkits: { type: "array", items: { type: "string", enum: [...TOOLKITS] }, minItems: 1 },
            operation: { type: "string" },
            confirmation: { type: "string" },
            ready: { type: "boolean" },
            missingDetails: { type: "array", items: { type: "string" } },
          },
          required: ["title", "description", "toolkits", "operation", "confirmation", "ready", "missingDetails"],
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
  if (!plan.ready) throw new Error(`Add the missing details: ${plan.missingDetails.join(", ")}`);

  const connectionSession = await getSession();
  runtime.onProgress({ planId, message: "Checking connected apps…", step: 0 });
  const connectionDetails = await connectionSession.toolkits({ toolkits: plan.toolkits });
  const disconnected = plan.toolkits.filter((toolkit) => {
    const item = connectionDetails.items.find((candidate) => candidate.slug.toLowerCase() === toolkit);
    return !item?.connection?.isActive;
  });
  if (disconnected.length) {
    throw new Error(`Connect ${disconnected.map((toolkit) => toolkit[0].toUpperCase() + toolkit.slice(1)).join(" and ")} before running this action`);
  }

  pendingPlans.delete(planId);
  const session = await createExecutionSession(plan.toolkits);
  const steps: ActionStep[] = [];
  const tools = await session.tools();
  const client = getOpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  runtime.onProgress({ planId, message: "Choosing the right actions…", step: 0 });
  try {
    let response = await client.responses.create({
    model,
    tools,
    instructions: [
      "You are Twin, a focused work assistant with access to Slack, Jira, Gmail, and GitHub through Composio.",
      "Execute exactly the approved request. Do not expand its scope, delete data, or perform additional actions.",
      "Use the relevant connected app tools. If a required detail or connection is missing, explain it without guessing.",
      `The approved toolkits are: ${plan.toolkits.join(", ")}. Do not use any other app.`,
      "After tool use, give a concise factual result suitable for showing in a desktop confirmation card.",
    ].join(" "),
    input: `Approved request:\n${plan.command}\n\nReviewed plan:\n${plan.title}\n${plan.description}\nExpected effect: ${plan.confirmation}`,
  });

    let turns = 0;
    let failed = false;
    while (response.output.some((item) => item.type === "function_call")) {
      if (++turns > 8) throw new Error("The action took too many steps and was stopped");
      const calls = response.output.filter((item) => item.type === "function_call");
      if (!calls.length) break;
      for (const call of calls) {
        const toolkit = toolkitForCall(call.name);
        steps.push({ label: actionLabel(call.name), toolkit });
        runtime.onProgress({
          planId,
          message: toolkit ? `Working in ${toolkitNames(toolkit)}…` : "Running the next step…",
          step: steps.length,
        });
      }
      runtime.onProgress({ planId, message: turns === 1 ? "Starting the workflow…" : "Continuing the workflow…", step: steps.length });
      const results = await provider.handleToolCalls(session, response.output);
      failed ||= results.some((item) => item.status === "incomplete" || resultFailed(item.output));
      response = await client.responses.create({
        model,
        tools,
        previous_response_id: response.id,
        input: results,
      });
    }

    if (!steps.length) {
      return {
        planId,
        summary: response.output_text.trim() || "Twin needs more information before it can run this action.",
        status: "needs_attention",
        steps,
      };
    }

    return {
      planId,
      summary: response.output_text.trim() || "Action completed.",
      status: failed ? "needs_attention" : "completed",
      steps,
    };
  } finally {
    await session.delete().catch(() => undefined);
  }
}
