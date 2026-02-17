/**
 * Agent Client — Helper module for AI subagents to interact with WOWWAI's Convex HTTP API.
 *
 * Usage: Import in any Node.js agent script. Requires CONVEX_SITE_URL and AGENT_SECRET env vars.
 */

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL ?? "";
const AGENT_SECRET = process.env.AGENT_SECRET ?? "";

interface AgentRequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

async function agentFetch<T>(options: AgentRequestOptions): Promise<T> {
  const url = new URL(options.path, CONVEX_SITE_URL);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": AGENT_SECRET,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Agent API error (${response.status}): ${(error as Record<string, string>).error ?? response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";

export interface TaskData {
  _id: string;
  cardId: string;
  title: string;
  status: TaskStatus;
  assignee: "dan" | "dali";
  priority: "low" | "medium" | "high" | "urgent";
  projectId: string;
  tags: string[];
  blockedBy: string[];
  modelUsed?: string;
  sessionSummary?: string;
  lastTouchedAt: number;
  createdAt: number;
  completedAt?: number;
}

export async function updateTaskStatus(
  cardId: string,
  status: TaskStatus,
  modelUsed?: string,
  sessionSummary?: string
): Promise<{ success: boolean; taskId: string }> {
  return agentFetch({
    method: "POST",
    path: "/agent/updateTask",
    body: { cardId, status, modelUsed, sessionSummary },
  });
}

export async function addAuditLog(
  cardId: string,
  actor: "dan" | "dali" | "system",
  action: string,
  comment?: string,
  modelUsed?: string
): Promise<{ success: boolean }> {
  return agentFetch({
    method: "POST",
    path: "/agent/createAuditLog",
    body: { cardId, actor, action, comment, modelUsed },
  });
}

export async function getTask(cardId: string): Promise<TaskData> {
  return agentFetch({
    method: "GET",
    path: "/agent/getTask",
    params: { cardId },
  });
}
