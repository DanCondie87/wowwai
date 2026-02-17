# Agent Integration Guide

## Overview

WOWWAI provides an HTTP API that AI subagents can use to update task status, log activity, and retrieve task data. All endpoints require authentication via the `x-agent-secret` header.

## Setup

Set these environment variables in your agent's runtime:

```bash
CONVEX_SITE_URL=https://your-convex-deployment.convex.site
AGENT_SECRET=your-shared-secret
```

## Using the Agent Client

```ts
import { updateTaskStatus, addAuditLog, getTask } from "@/lib/agent-client";

// 1. Get current task info
const task = await getTask("WOWWAI-42");
console.log(task.title, task.status);

// 2. Update task status when work begins
await updateTaskStatus("WOWWAI-42", "in-progress", "claude-opus-4-6");

// 3. Log progress as you work
await addAuditLog(
  "WOWWAI-42",
  "dali",
  "comment",
  "Completed unit tests for auth module",
  "claude-opus-4-6"
);

// 4. Mark task as done with a session summary
await updateTaskStatus(
  "WOWWAI-42",
  "done",
  "claude-opus-4-6",
  "Implemented user authentication with Clerk. Added middleware, sign-in/sign-up pages, and session persistence."
);
```

## API Endpoints

### POST /agent/updateTask

Updates a task's status, model used, and/or session summary.

```json
{
  "cardId": "WOWWAI-42",
  "status": "in-progress",
  "modelUsed": "claude-opus-4-6",
  "sessionSummary": "Optional summary of work done",
  "comment": "Optional audit log comment"
}
```

### POST /agent/createAuditLog

Creates an audit log entry for a task.

```json
{
  "cardId": "WOWWAI-42",
  "actor": "dali",
  "action": "comment",
  "comment": "Started working on implementation",
  "modelUsed": "claude-opus-4-6"
}
```

### GET /agent/getTask?cardId=WOWWAI-42

Returns full task data including title, status, assignee, priority, tags, and blockers.

## Rate Limits

All endpoints are rate-limited to 10 requests/minute with burst to 20. If you receive a 429 response, wait for the `Retry-After` header duration before retrying.

## Error Handling

- **401**: Invalid or missing `x-agent-secret` header
- **404**: Task with given `cardId` not found
- **429**: Rate limit exceeded — check `Retry-After` header
