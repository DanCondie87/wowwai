# WOWWAI Production Readiness Review

> **Date:** February 19, 2026  
> **Reviewer:** Dali (subagent)  
> **Context:** Prototype → Production gap analysis  
> **Branch:** security/critical-fixes

---

## Executive Summary

**Current State:** WOWWAI is a **functional UI prototype** with all 53 PRD user stories coded and a comprehensive security review completed. The core features work: Kanban board, task CRUD, drag-and-drop, workflow visualizer, audit trails, and agent API endpoints. The security posture has been significantly hardened (timing-safe auth, middleware fixes, CSP improvements, Convex mutation auth).

**Gap to Production:** While the UI is polished and secure, **WOWWAI is not yet integrated into Dan and Dali's daily workflow**. It contains only seed/demo data, has no connection to the real TASKS.md system, cannot display actual workflow documents, and lacks real-time agent task updates. The sync-agent exists but is not configured or running. Essentially: a beautiful dashboard with no data pipeline.

**Production Definition:** For WOWWAI to be "production-ready," it must:
1. Sync bidirectionally with `~/clawd/TASKS.md` (real tasks, not demo data)
2. Display and edit actual workflow documents from `~/clawd/workflows/`
3. Update task status in real-time when Dali (via subagents) completes work
4. Integrate with OpenClaw's heartbeat/cron system for notifications
5. Be the **single source of truth** for task state (replacing manual TASKS.md edits)

**Critical Blockers (6):**
- Sync-agent not configured (no .env file, pm2 not installed)
- CSP still uses `'unsafe-inline'` for scripts (nonce-based CSP blocked by Next.js hydration)
- Workflow document references show "Not synced" (sync-agent not running → no file content in Convex)
- No TASKS.md migration path (script exists but never run → zero real tasks)
- No agent→WOWWAI integration pattern (Dali doesn't know how to update tasks)
- `cardId` generation bug (duplicate IDs possible after task deletion — data integrity risk)

**Effort Estimate:** **3-4 weeks** to production (1 week critical fixes, 2 weeks integration, 1 week testing/polish).

---

## What Works Today

### ✅ Core Kanban Functionality
- **6-column board:** Ideas, Backlog, To Do, In Progress, Review, Done — fully functional
- **Drag-and-drop:** @dnd-kit integration works (desktop + mobile touch)
- **Task cards:** Display all metadata (cardId, assignee, priority, staleness, tags, subtask progress, blocked status)
- **Filters:** By project, assignee, tags, priority, blocked status (with URL persistence)
- **Keyboard shortcuts:** `j/k` navigation, `←/→` column movement, `n` new task, `⌘K` command palette, `?` help
- **Mobile swipe gestures:** Swipe left/right to move tasks between columns
- **Pull-to-refresh:** Mobile gesture triggers Convex query invalidation

### ✅ Task Management
- **CRUD operations:** Create, read, update, delete tasks (with audit trail)
- **Subtasks:** Nested tasks with parentTaskId relationship, progress bars on parent cards
- **Dependencies:** Blocker/blocked-by relationships with visual indicators
- **Auto-save:** Card detail edits save on blur with "Saved ✓" confirmation
- **Audit trail:** Every change logged (actor, action, before/after, timestamp, model used)
- **Search:** Full-text search across tasks (title, description, cardId) via Convex search index
- **Cross-project view:** "My Work" page shows all tasks for an assignee across projects

### ✅ Workflow Visualizer
- **Template listing:** Displays all workflow templates (3 seeded: Code Project, Research, Self-Improving Skills)
- **Vertical pipeline:** Step-by-step workflow with accordion expand/collapse
- **Loop groups:** Steps with same `loopGroupId` visually grouped with iteration/exit criteria
- **Document references:** Each step lists referenced files (icon, label, file path) with View/Edit buttons
- **Version control:** File edits create new `fileVersions` entries with restore capability
- **Edit UI:** Inline markdown editor with unsaved changes indicator, Save/Cancel buttons

### ✅ Agent API (HTTP Actions)
- **Authentication:** All endpoints verify `x-agent-secret` header (timing-safe comparison)
- **Rate limiting:** 10 mutations/minute, burst to 20 (token bucket via convex-helpers)
- **Endpoints:**
  - `POST /agent/updateTask` — Update task status, model, session summary
  - `POST /agent/createAuditLog` — Add audit log entry
  - `GET /agent/getTask` — Fetch task by cardId
  - `POST /sync/upsertFile` — Sync-agent pushes file changes to Convex
  - `GET /sync/getPending` — Sync-agent polls for UI edits to write to disk
  - `POST /sync/markSynced` — Mark sync queue item as synced/conflict

### ✅ Security Hardening (SEC-001 to SEC-005)
- **Timing-safe auth:** Password hash and session token verification use HMAC-SHA256 XOR comparison
- **Middleware hardening:** `.` bypass fixed, `x-middleware-subrequest` header blocked, exact route matching
- **Convex auth:** `fileSyncQueue.enqueue` and `export.getFullExport` converted to internal mutations (proxied via authenticated Next.js API routes)
- **CSP improvements:** `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, Referrer-Policy, Permissions-Policy, HSTS
- **All write mutations protected:** Tasks, projects, auditLogs converted to `internalMutation` (via `/api/mutations` endpoint)

### ✅ Analytics & Insights
- **Cycle time:** Average days from "todo" to "done" per project
- **Throughput:** Tasks completed per week (last 8 weeks) with bar chart
- **Blocker stats:** Count of currently blocked tasks per project
- **Model usage:** Tasks completed by AI model (pie chart)
- **"What should I work on?" button:** AI recommendation based on priority, staleness, blockers (calls Convex action)

### ✅ Infrastructure
- **Tokenized theme system:** Light/dark mode with system preference, all colors via CSS variables
- **Offline support:** Service worker caches app shell, IndexedDB caches last board state, "Offline — read only" banner
- **Mobile-first:** Responsive design, touch-friendly, PWA-ready
- **Export:** JSON and CSV export of all data (projects, tasks, ideas, audit logs)
- **Schema:** Fully typed Convex schema with indexes on all lookup fields

---

## Critical Gaps (Must Fix)

### 🔴 GAP-1: Nonce-Based CSP (Replace `'unsafe-inline'`)

**Current State:**  
`next.config.ts:55` — CSP header includes `script-src 'self' 'unsafe-inline'`

**Why `'strict-dynamic'` was removed:**  
The original SEC-004 fix added `'strict-dynamic'`, but it **broke Next.js hydration**. Next.js injects inline scripts for initial state without nonces, causing CSP violations. The PR comment in `next.config.ts:51-54` explains this was reverted.

**What's needed:**
1. **Middleware-based nonce generation:** `src/middleware.ts` generates a random nonce per request (`crypto.randomUUID()`)
2. **Nonce propagation:** Pass nonce via headers → `app/layout.tsx` reads via `headers()` → inject into `<Script>` tags and CSP header
3. **CSP header in middleware:** Move CSP from `next.config.ts` to middleware (dynamic header with `nonce-{value}`)
4. **Next.js compatibility:** Use `next/script` with `nonce` prop for all scripts

**Files to modify:**
- `src/middleware.ts` — Generate nonce, inject into CSP header
- `src/app/layout.tsx` — Read nonce from headers, pass to Script components
- `next.config.ts` — Remove CSP header (now in middleware)

**Complexity:** Medium (3-4 hours)  
**Blocker for production?** No — `'unsafe-inline'` is acceptable for a single-user app, but nonce-based CSP is best practice.

**Reference:**
- Next.js CSP guide: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
- Example: https://github.com/vercel/next.js/tree/canary/examples/with-strict-csp

---

### 🔴 GAP-2: Sync-Agent Not Configured or Running

**Current State:**
- `sync-agent/.env` **does not exist** (only `.env.example` present)
- `pm2` is **not installed** globally on this machine (command not found)
- No evidence sync-agent has ever run (no logs, no synced files in Convex)

**Why this is critical:**
- Workflow document references show **"Not synced"** because the sync-agent has never pushed file content to Convex
- Edits in the UI enqueue to `fileSyncQueue` but are never written to local files (sync-agent not polling)
- The entire file sync loop (US-037, US-038) is non-functional

**What's needed:**

**Step 1: Configure sync-agent**
```bash
cd ~/Projects/wowwai/sync-agent
cp .env.example .env
# Edit .env:
CONVEX_SITE_URL=https://{your-deployment}.convex.site
AGENT_SECRET={same value as Vercel AGENT_SECRET env var}
```

**Step 2: Install pm2 globally**
```bash
npm install -g pm2
```

**Step 3: Start sync-agent**
```bash
cd ~/Projects/wowwai/sync-agent
npm install  # install chokidar + dotenv
npm run start  # starts via pm2
pm2 save  # save pm2 process list
pm2 startup  # configure pm2 to start on system boot (Windows: manual)
```

**Step 4: Verify sync works**
1. Edit `~/Projects/wowwai/workflows/code-project.md` locally → sync-agent should log "File change: workflows/code-project.md"
2. Check Convex dashboard → `fileVersions` table should have new entry
3. Open workflow in WOWWAI UI → document reference should show content (not "Not synced")

**Complexity:** Low (30 minutes setup + testing)  
**Blocker for production?** **YES** — workflow document viewing is a core feature and completely broken without this.

**Additional config needed:**
- `sync-agent/config.json` currently watches `../workflows` and `../docs` (relative to sync-agent dir)
- Add `~/clawd/workflows` and `~/clawd/TASKS.md` to `watchPaths` for Dan's actual workspace:

```json
{
  "watchPaths": [
    "../workflows",
    "../docs",
    "../../clawd/workflows",
    "../../clawd"
  ],
  "allowedExtensions": [".md", ".json", ".yaml", ".txt"],
  "pollIntervalMs": 5000,
  "heartbeatIntervalMs": 60000
}
```

---

### 🔴 GAP-3: No Real Tasks in System (Only Seed/Demo Data)

**Current State:**
- `convex/seed.ts` has seeded demo data (REVIEW project with 5 tasks, 3 workflow templates)
- Real `~/clawd/TASKS.md` exists but has never been migrated
- Migration script exists at `scripts/migrate-tasks.ts` but has never been run

**Why this is critical:**
- WOWWAI shows tasks Dan has never created
- Real work items (actual projects, tasks, blockers) are not visible in the UI
- Cannot use WOWWAI as a daily tool without real data

**What's needed:**

**Step 1: Audit current seed data**
- Open Convex dashboard → check `projects` and `tasks` tables
- If seed data exists and conflicts with real data, clear it:
  ```bash
  # Option A: Delete seed data manually via Convex dashboard
  # Option B: Write a "clear seed data" script
  ```

**Step 2: Run migration script**
```bash
cd ~/Projects/wowwai
npx ts-node scripts/migrate-tasks.ts ~/clawd/TASKS.md --dry-run
# Review output (what would be created)
npx ts-node scripts/migrate-tasks.ts ~/clawd/TASKS.md
```

**Step 3: Verify in UI**
- Open `https://wowwai.vercel.app/board` (or localhost:3000)
- Check that real projects and tasks appear
- Verify cardIds match expected format

**Migration script status:**
- Script exists (US-041 coded)
- Needs testing — may require tweaks depending on TASKS.md format
- `--dry-run` mode is safe for initial testing

**Complexity:** Low (1-2 hours including verification)  
**Blocker for production?** **YES** — cannot use WOWWAI without real data.

**Follow-up:** After migration, establish a **bidirectional sync pattern** (see GAP-6).

---

### 🔴 GAP-4: Workflow Document References Don't Show File Content

**Root Cause:**  
This is a **symptom of GAP-2** (sync-agent not running). The `DocumentReference` component (`src/components/workflow/document-reference.tsx`) queries `fileVersions.getLatestByFilePath`. If sync-agent has never run, `fileVersions` table is empty → component shows "Not synced" badge.

**Test to confirm:**
1. Start sync-agent (GAP-2 fix)
2. Wait 5-10 seconds for initial file scan
3. Refresh WOWWAI workflow page (`/workflows/[id]`)
4. Document references should now show "v1" badge and content should load on View

**If content still doesn't show after sync-agent is running:**

**Debugging checklist:**
1. Check Convex dashboard → `fileVersions` table — are there entries?
2. Check sync-agent logs: `pm2 logs wowwai-sync` — any errors?
3. Check file paths in `workflowSteps.references[].filePath` — do they match sync-agent watched paths?
4. Check `sync-agent/config.json` `watchPaths` — does it include the directory where workflow files live?

**Likely issue:** `workflowSteps` seed data (from US-030) may reference files that don't exist or aren't in watched paths.

**Fix workflow seed data:**
- `convex/seed.ts:seedWorkflows()` hardcodes references like `workflows/code-project.md`
- These paths are **relative to project root**, not sync-agent watched paths
- Verify seed data uses correct paths: `../workflows/code-project.md` → correct relative path from sync-agent dir is `../workflows/...`

**Complexity:** Low (if GAP-2 is fixed, this should resolve automatically)  
**Blocker for production?** **YES** — workflow document viewing is a marquee feature.

---

### 🔴 GAP-5: No Agent→WOWWAI Real-Time Task Updates

**Current State:**
- Agent API endpoints exist (`/agent/updateTask`, `/agent/createAuditLog`)
- No integration pattern documented or coded for subagents to call these
- Dali (main agent) doesn't know WOWWAI exists or how to update tasks
- Tasks don't update when subagents complete work

**What's needed:**

**Step 1: Agent helper library**
- Create `~/clawd/lib/wowwai-client.ts` (or add to existing agent helpers)
- Wrapper functions for agent API with AGENT_SECRET auth:

```typescript
// ~/clawd/lib/wowwai-client.ts
import fetch from "node-fetch";

const WOWWAI_URL = process.env.WOWWAI_CONVEX_URL || "https://{deployment}.convex.site";
const AGENT_SECRET = process.env.WOWWAI_AGENT_SECRET;

export async function updateWowwaiTask(cardId: string, updates: {
  status?: "backlog" | "todo" | "in-progress" | "review" | "done";
  modelUsed?: string;
  sessionSummary?: string;
  comment?: string;
}) {
  const res = await fetch(`${WOWWAI_URL}/agent/updateTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": AGENT_SECRET!,
    },
    body: JSON.stringify({ cardId, ...updates }),
  });
  if (!res.ok) throw new Error(`WOWWAI update failed: ${await res.text()}`);
  return res.json();
}

export async function logWowwaiActivity(cardId: string, action: string, comment?: string, model?: string) {
  const res = await fetch(`${WOWWAI_URL}/agent/createAuditLog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": AGENT_SECRET!,
    },
    body: JSON.stringify({ cardId, actor: "dali", action, comment, modelUsed: model }),
  });
  if (!res.ok) throw new Error(`WOWWAI audit log failed: ${await res.text()}`);
}
```

**Step 2: Subagent integration pattern**
- When spawning subagents, pass WOWWAI cardId if the work relates to a tracked task
- Subagent updates task status at key milestones:
  - Start: `updateWowwaiTask(cardId, { status: "in-progress", modelUsed: "sonnet" })`
  - Progress: `logWowwaiActivity(cardId, "progress", "Completed step 3/5")`
  - Done: `updateWowwaiTask(cardId, { status: "done", sessionSummary: "...", comment: "Completed via subagent" })`

**Step 3: TASKS.md ↔ WOWWAI mapping**
- Add WOWWAI cardId as a comment in TASKS.md:
  ```markdown
  - [ ] Fix CSP nonce issue <!-- WOWWAI-12 -->
  ```
- When Dali creates a task in WOWWAI, append cardId to TASKS.md
- When reading TASKS.md, extract cardIds to update WOWWAI status

**Complexity:** Medium (2-3 days — pattern design + testing + Dali behavior update)  
**Blocker for production?** **YES** — without this, WOWWAI is a static dashboard, not a live control center.

**Follow-up:** Real-time presence indicator (US-047) — subagents call `POST /agent/heartbeat` (not yet implemented) to show "🦈 Working on this" in the UI.

---

### 🔴 GAP-6: Bidirectional TASKS.md ↔ WOWWAI Sync

**Current State:**
- Migration script is **one-way** (TASKS.md → WOWWAI)
- No mechanism to write WOWWAI changes back to TASKS.md
- TASKS.md and WOWWAI will diverge immediately after migration

**Why this is critical:**
- Dan's muscle memory is to edit TASKS.md directly
- If changes don't sync back, TASKS.md becomes stale (loses value as canonical source)
- WOWWAI becomes "another place to check" instead of **the single source of truth**

**What's needed:**

**Option A: WOWWAI as primary, TASKS.md as export**
- WOWWAI is the database of record
- Periodically export to TASKS.md (e.g., on every task state change or via cron)
- TASKS.md becomes a **read-only snapshot** for manual inspection
- Edits in TASKS.md are **not synced back** (discouraged workflow)

**Option B: True bidirectional sync**
- Sync-agent watches TASKS.md for changes
- Parse TASKS.md on change → detect added/modified/completed tasks
- Update Convex via agent API
- Conversely, WOWWAI changes trigger TASKS.md rewrite
- **Challenge:** Conflict resolution (what if both change at once?)

**Option C: Hybrid (recommended)**
- **WOWWAI is primary** for task state (status, assignee, priority, blockers)
- **TASKS.md is the inbox** for new task creation (Dan types `- [ ] New task` → sync-agent creates in WOWWAI)
- Daily export from WOWWAI to TASKS.md (updates checkboxes to reflect WOWWAI state)
- Conflicts avoided by scoping: creation in TASKS.md, status updates in WOWWAI

**Implementation (Option C):**

**Step 1: TASKS.md watcher in sync-agent**
- Add `~/clawd/TASKS.md` to `watchPaths`
- On change: parse file, detect new unchecked items
- For each new task: call `/agent/updateTask` (create mode) with title from TASKS.md line

**Step 2: WOWWAI → TASKS.md export**
- Convex cron job (every 5 minutes): generate TASKS.md from current task state
- Enqueue to `fileSyncQueue` (direction: "to-local")
- Sync-agent writes to `~/clawd/TASKS.md`
- Format:
  ```markdown
  ## 🎯 Today's Focus
  - [x] Completed task <!-- WOWWAI-12 -->
  - [ ] In progress task <!-- WOWWAI-15 -->
  
  ## 🔥 Active Projects
  ...
  ```

**Complexity:** High (5-7 days — parser, sync logic, conflict handling, testing)  
**Blocker for production?** **Soft yes** — WOWWAI can function without this, but adoption will be low if it doesn't integrate with existing workflow.

---

### 🔴 GAP-7: cardId Collision Bug (Data Integrity Risk)

**Current State:**  
`convex/tasks.ts:26-28` — cardId generation uses `existingTasks.length + 1`

**The bug:**
- Project has tasks WOWWAI-1, WOWWAI-2, WOWWAI-3 (length=3)
- WOWWAI-2 is deleted (length=2)
- Next task → `2 + 1 = 3` → cardId = `WOWWAI-3` ← **DUPLICATE**

**Impact:**
- `getByCardId` returns **wrong task** (finds first match)
- Agent API calls update **wrong task**
- Audit logs attached to **wrong task**
- Search results show **duplicate cardIds**

**Fix (immediate):**
```typescript
// convex/tasks.ts:26-35 — replace with:
const existingTasks = await ctx.db
  .query("tasks")
  .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
  .collect();

// Find highest cardId number
const taskPrefix = `${project.slug.toUpperCase()}-`;
const maxNumber = existingTasks.reduce((max, t) => {
  const num = parseInt(t.cardId.replace(taskPrefix, ""), 10);
  return isNaN(num) ? max : Math.max(max, num);
}, 0);

const cardId = `${taskPrefix}${maxNumber + 1}`;
```

**Better fix (add atomic counter to project record):**
```typescript
// convex/schema.ts — add to projects table:
taskCounter: v.number(),  // initialize to 0 on project creation

// convex/tasks.ts — use atomic increment:
const project = await ctx.db.get(args.projectId);
const nextNumber = (project.taskCounter ?? 0) + 1;
await ctx.db.patch(args.projectId, { taskCounter: nextNumber });
const cardId = `${project.slug.toUpperCase()}-${nextNumber}`;
```

**Complexity:** Low (30 minutes for immediate fix, 1 hour for atomic counter)  
**Blocker for production?** **YES** — data integrity issue. Risk is low until tasks are deleted, but it's a ticking time bomb.

**Action:** Fix this **before** migrating real TASKS.md data (GAP-3).

---

## Integration Gaps (Make It Actually Useful)

### 🟡 INT-1: No OpenClaw/Dali Workflow Awareness

**Gap:** Dali (main agent) doesn't know WOWWAI exists or how to use it.

**What's needed:**
1. **Add to AGENTS.md or TOOLS.md:**
   ```markdown
   ## WOWWAI — Project Control Center
   - Web UI: https://wowwai.vercel.app
   - All tasks tracked with cardIds (e.g., WOWWAI-42)
   - When working on a tracked task, update status via wowwai-client.ts helper
   - Check WOWWAI board before daily planning (better than TASKS.md for filtering/visualization)
   ```

2. **Daily planning integration:**
   - 8am planning ping: Dali reads WOWWAI board state (via Convex HTTP API or screenshot via browser tool)
   - Recommends focus based on staleness, blockers, priority
   - Updates TASKS.md with today's focus (syncs to WOWWAI)

3. **Heartbeat checks:**
   - Every 2-4 hours: check for newly blocked tasks in WOWWAI
   - Notify Dan via WhatsApp if high-priority task becomes blocked

**Complexity:** Low-Medium (1-2 days — mostly documentation + Dali behavior tuning)  
**Blocker for production?** No, but severely limits usefulness.

---

### 🟡 INT-2: Mobile Notifications When Tasks Change

**Current State:**
- US-042 implemented `notifyDan()` helper (calls OpenClaw message tool)
- US-043 implemented blocker notification trigger (Convex cron job)
- **But:** No Convex cron jobs are actually scheduled (no `convex/crons.ts` or dashboard config)

**What's needed:**

**Step 1: Enable blocker notifications**
```typescript
// convex/crons.ts (create this file)
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check blocked tasks",
  { minutes: 30 },
  internal.notifications.processBlockerNotifications
);

export default crons;
```

**Step 2: Additional notification triggers**
- Task assigned to Dan by Dali (notify immediately)
- Task stuck in "in-progress" for >3 days (daily check at 9am)
- Task completed by subagent (notify with session summary)

**Step 3: OpenClaw message integration**
- `lib/notifications.ts` currently calls a placeholder `notifyDan()` function
- Replace with actual OpenClaw message call:
  ```typescript
  import { message } from "openclaw-sdk";  // hypothetical
  await message({ target: "dan-whatsapp", text: msg });
  ```
- Or: HTTP call to OpenClaw's message webhook (if deployed)

**Complexity:** Low (2-3 hours — mostly cron config + message integration testing)  
**Blocker for production?** No, but significantly improves daily workflow (proactive vs. reactive task management).

---

### 🟡 INT-3: Heartbeats/Cron Jobs Interaction with WOWWAI

**Current State:**
- OpenClaw has heartbeat system (Dali checks email, calendar, tasks every N hours)
- WOWWAI exists in parallel (no integration)

**What's needed:**

**Add WOWWAI check to heartbeat routine:**
```markdown
# ~/clawd/HEARTBEAT.md
## Checks (rotate 2-4x per day)
- [ ] Email inbox
- [ ] Calendar (next 24-48h)
- [ ] WOWWAI board — any blocked tasks? Any stale tasks >3 days?
- [ ] Weather (if relevant)
```

**Heartbeat WOWWAI integration pattern:**
1. Query Convex for blocked tasks: `GET https://{deployment}.convex.site/agent/getBlockedTasks` (new endpoint needed)
2. Query for stale tasks: `lastTouchedAt > 3 days ago AND status IN ("in-progress", "review")`
3. If found: notify Dan via WhatsApp, offer to create a follow-up task or ping the assignee

**Complexity:** Low (1 day — new Convex query + heartbeat.md update + Dali behavior)  
**Blocker for production?** No, but makes WOWWAI **proactive** instead of a passive dashboard.

---

### 🟡 INT-4: Task Auto-Update When Subagents Complete Work

**Gap:** Subagents don't currently report completion to WOWWAI (see GAP-5).

**Extended requirement (beyond GAP-5):**
- **Automatic status inference:** When a subagent completes work, it should:
  1. Mark task as "done" in WOWWAI
  2. Generate session summary (what was accomplished, how it was done)
  3. Attach artifacts (file paths changed, screenshots, test results)
  4. Create audit log with full details

**Implementation:**
- Subagent wrapper pattern (similar to Ralph loop but with WOWWAI integration):
  ```typescript
  async function runTaskWithWowwai(cardId: string, work: () => Promise<string>) {
    await updateWowwaiTask(cardId, { status: "in-progress" });
    const summary = await work();  // subagent does the work
    await updateWowwaiTask(cardId, {
      status: "done",
      sessionSummary: summary,
      comment: "Auto-completed by subagent",
    });
  }
  ```

**Complexity:** Low (extends GAP-5 pattern with auto-completion logic)  
**Blocker for production?** No, but this is the **"game changer"** Dan wants — invisible real-time updates as agents work.

---

### 🟡 INT-5: Agent Activity Presence Indicator

**Current State:**
- US-047 coded `AgentActivityIndicator` component (pulsing 🦈 icon)
- `agentActivity` table exists with `status`, `currentAction`, `lastHeartbeat`
- **But:** No agent API endpoint to set activity (`/agent/heartbeat` not implemented)

**What's needed:**

**Step 1: Add heartbeat endpoint**
```typescript
// convex/http.ts
http.route({
  path: "/agent/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { taskId, cardId, model, currentAction } = await request.json();
    const task = await ctx.runQuery(internal.tasks.getByCardId, { cardId });
    await ctx.runMutation(internal.agentActivity.setActive, {
      taskId: task._id,
      sessionKey: `${cardId}-${Date.now()}`,
      model,
      status: "working",
      currentAction,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }),
});
```

**Step 2: Subagent heartbeat loop**
- When subagent starts: call `/agent/heartbeat` with `currentAction: "Starting work"`
- Every 30 seconds: call heartbeat with progress update (`currentAction: "Step 2/5: Testing"`)
- On completion: call heartbeat with `status: "idle"`

**Step 3: Auto-expire stale activity**
- Convex cron (every 5 minutes): mark activities as "idle" if `lastHeartbeat > 30 minutes ago`

**Complexity:** Low (2-3 hours — endpoint + subagent integration + cron)  
**Blocker for production?** No, but significantly improves "live dashboard" feel.

---

## Nice-to-Haves (Future)

### 🟢 FUTURE-1: Password Change Flow
- Currently auth is single-password (no user profile UI)
- US-003 mentions this as a potential improvement
- Low priority for single-user app (Dan can change password via env var)

### 🟢 FUTURE-2: Error Boundaries
- **FRONT-1 finding:** Zero React Error Boundaries in component tree
- Convex failures cause infinite loading with no user feedback
- Fix: Wrap `(app)/layout.tsx` with ErrorBoundary component
- Complexity: Low (1-2 hours)

### 🟢 FUTURE-3: Accessibility Fixes
- **FRONT-2, FRONT-5, FRONT-6:** Missing labels, color-only indicators, no keyboard DnD
- 14 a11y issues identified (6 high/medium priority)
- Complexity: Low-Medium (4-6 hours total for all)
- Required for public launch, but not blocking for personal use

### 🟢 FUTURE-4: Skeleton Loading States
- **FRONT-11:** All loading states are text ("Loading..."), no skeletons
- Causes content pop-in (bad UX on slow connections)
- Fix: Add shadcn Skeleton components to board, card detail, workflows
- Complexity: Low (2-3 hours)

### 🟢 FUTURE-5: Testing Infrastructure
- **TEST-001:** Zero tests exist (no jest/vitest/playwright)
- Recommended: Vitest for unit/integration, Playwright for E2E
- Priority tests: auth, middleware, Convex mutations, agent API
- Complexity: High (15 days for full test suite, per TEST-001 plan)
- Can parallelize with Codex subagent for boilerplate

### 🟢 FUTURE-6: N+1 Query Optimizations
- **ARCH-6, ARCH-7, ARCH-9:** Several N+1 patterns identified
- Most critical: `getByCardId` does full table scan (needs index on cardId)
- Complexity: Low-Medium (3-4 hours total)
- Not blocking for small data volumes (<1000 tasks)

### 🟢 FUTURE-7: Email-to-Task
- PRD lists this as a non-goal, but could be valuable
- Dan emails task ideas → parsed and created in WOWWAI
- Requires email webhook + parsing logic

### 🟢 FUTURE-8: Calendar Integration
- Sync tasks with due dates to Google Calendar
- Show upcoming deadlines in WOWWAI
- Complexity: Medium (requires Google Calendar API integration)

---

## Recommended Implementation Order

### Week 1: Critical Path (Production Blockers)

**Day 1: Data Integrity + Sync Foundation**
- [ ] **GAP-7** — Fix cardId collision bug (immediate fix: 30 min)
- [ ] **GAP-2** — Configure and start sync-agent (2 hours)
  - Create `.env` file
  - Install pm2 globally
  - Update `config.json` watchPaths to include `~/clawd`
  - Start agent, verify file syncing works
- [ ] **GAP-3** — Migrate real TASKS.md data (2 hours)
  - Run migration script with `--dry-run`
  - Clear seed data if needed
  - Run actual migration
  - Verify tasks appear in UI

**Day 2-3: Agent Integration Core**
- [ ] **GAP-5** — Agent→WOWWAI update pattern (2 days)
  - Create `~/clawd/lib/wowwai-client.ts` helper
  - Document integration pattern in AGENTS.md or TOOLS.md
  - Test manual task updates from command line
  - Update one subagent workflow to use WOWWAI (e.g., PRD completion subagent)

**Day 4-5: Bidirectional Sync (Option C)**
- [ ] **GAP-6** — TASKS.md ↔ WOWWAI sync (2 days)
  - Implement TASKS.md parser in sync-agent
  - New task creation from TASKS.md → WOWWAI
  - WOWWAI → TASKS.md export (Convex cron)
  - Test conflict scenarios

### Week 2: Integration & Polish

**Day 6-7: Workflow Documents**
- [ ] **GAP-4** — Verify workflow document viewing works (should auto-fix with GAP-2)
- [ ] Test document editing: edit in UI → sync to local file → verify content
- [ ] Test version history: edit, restore previous version
- [ ] Seed workflow templates with actual workflow files from `~/clawd/workflows/`

**Day 8-9: Heartbeat & Notifications**
- [ ] **INT-1** — Dali workflow awareness (1 day)
  - Update AGENTS.md with WOWWAI usage guidelines
  - Add WOWWAI check to heartbeat.md
  - Test daily planning integration
- [ ] **INT-2** — Enable blocker notifications (1 day)
  - Create `convex/crons.ts`
  - Test notification delivery via WhatsApp
  - Add task assignment notifications

**Day 10: Agent Presence**
- [ ] **INT-5** — Agent activity presence (1 day)
  - Implement `/agent/heartbeat` endpoint
  - Update subagent pattern to send heartbeats
  - Test presence indicator in UI

### Week 3: Testing & Hardening

**Day 11-12: Critical Bug Fixes**
- [ ] **FUTURE-2** — Add error boundaries (4 hours)
  - Wrap app layout
  - Wrap KanbanBoard
  - Test Convex failure scenarios
- [ ] **ARCH-9** — Add index on cardId (30 min)
- [ ] **ARCH-16** — Atomic taskCounter on projects (1 hour)

**Day 13-14: Accessibility Quick Wins**
- [ ] **FRONT-1** — Add labels to login form (15 min)
- [ ] **FRONT-2** — Add accessible name to sidebar close button (5 min)
- [ ] **FRONT-7** — Add aria-labels to priority/staleness dots (15 min)
- [ ] **FRONT-5** — Add KeyboardSensor to DnD (30 min)
- [ ] **FRONT-6** — Fix create task selects (30 min)

**Day 15: CSP Hardening (Optional)**
- [ ] **GAP-1** — Nonce-based CSP (4 hours)
  - Only if time permits
  - Can defer to Week 4

### Week 4: Production Deployment & Monitoring

**Day 16-17: End-to-End Testing**
- [ ] Manual test all critical flows:
  - Create task in TASKS.md → appears in WOWWAI
  - Update task in WOWWAI → syncs to TASKS.md
  - Subagent completes task → status updates in UI
  - Edit workflow document in UI → writes to local file
  - Blocker notification triggers WhatsApp message
- [ ] Test on mobile (real device, not just browser DevTools)
- [ ] Test offline mode

**Day 18: Deployment**
- [ ] Verify all environment variables set in Vercel:
  - `AUTH_SECRET`, `AUTH_PASSWORD_HASH`
  - `NEXT_PUBLIC_CONVEX_URL`
  - `AGENT_SECRET` (same value in sync-agent `.env`)
- [ ] Deploy to Vercel (already connected per US-053)
- [ ] Verify production URL loads
- [ ] Test auth flow on production
- [ ] Verify Convex connection works

**Day 19-20: Documentation & Handoff**
- [ ] Update README.md with:
  - "How WOWWAI works" section
  - Sync-agent setup instructions
  - Daily workflow (how Dan and Dali use it)
  - Troubleshooting guide
- [ ] Create `docs/DAILY-WORKFLOW.md`:
  - Morning planning with WOWWAI
  - How to create tasks (TASKS.md vs. UI)
  - How subagents update tasks
  - How to handle blocked tasks
- [ ] Record a demo video (5-10 min walkthrough)

---

## Success Criteria

WOWWAI is **production-ready** when:

1. ✅ Real tasks from `~/clawd/TASKS.md` are visible in the UI
2. ✅ Workflow documents show actual file content (not "Not synced")
3. ✅ Editing a workflow document in the UI writes the file to disk
4. ✅ Creating a task in TASKS.md (new unchecked item) creates it in WOWWAI within 5 seconds
5. ✅ Completing a task in WOWWAI marks it `[x]` in TASKS.md within 5 seconds
6. ✅ Subagents can update task status via agent API (test with one real subagent workflow)
7. ✅ Blocker notifications are sent to WhatsApp when a task becomes blocked
8. ✅ Dali checks WOWWAI board during daily planning (8am ping mentions WOWWAI state)
9. ✅ Dan can use WOWWAI from his phone to triage tasks (mobile UI is fully functional)
10. ✅ No cardId collisions after task deletion (GAP-7 fixed and tested)

**Stretch goals:**
- 🎯 Agent presence indicator shows live when a subagent is working on a task
- 🎯 Error boundaries prevent white screen crashes
- 🎯 Basic a11y fixes (login label, sidebar button, priority dots)

---

## Appendix: File Reference

**Critical files for production readiness:**

| File | Purpose | Status |
|------|---------|--------|
| `sync-agent/.env` | Convex URL + AGENT_SECRET | ❌ Missing — must create |
| `sync-agent/index.js` | File sync daemon | ✅ Coded, not running |
| `sync-agent/config.json` | Watch paths config | 🟡 Needs ~/clawd paths added |
| `scripts/migrate-tasks.ts` | TASKS.md → WOWWAI migration | ✅ Coded, never run |
| `~/clawd/lib/wowwai-client.ts` | Agent helper for WOWWAI API | ❌ Doesn't exist — must create |
| `convex/crons.ts` | Scheduled jobs (blocker notifications) | ❌ Doesn't exist — must create |
| `convex/tasks.ts:26-35` | cardId generation logic | 🔴 Bug — must fix before migration |
| `src/components/workflow/document-reference.tsx` | Workflow doc viewer/editor | ✅ Coded, awaiting sync-agent |
| `convex/http.ts` | Agent API endpoints | ✅ Fully functional |
| `next.config.ts:55` | CSP header | 🟡 Has `unsafe-inline` (acceptable, nonce-based is better) |

---

## Summary: The Gap in One Sentence

**WOWWAI is a beautiful, secure UI prototype that isn't connected to anything — no real tasks, no file content, no agent integration, and no sync-agent running. Fix the sync-agent, migrate real data, wire up the agent API, and it becomes a production tool.**

---

**Estimated total effort:** 3-4 weeks (120-160 hours) for one developer working full-time. With Dali's help (Codex subagents for boilerplate, research, testing), this compresses to **2-3 weeks of calendar time**.

**Highest-impact fixes (if time is limited):**
1. GAP-7 (cardId bug) — 30 min, prevents data corruption
2. GAP-2 (sync-agent) — 2 hours, unblocks workflow documents
3. GAP-3 (migrate TASKS.md) — 2 hours, gets real data in
4. GAP-5 (agent integration pattern) — 2 days, makes it "live"

**The rest is polish and bidirectional sync — nice to have but not blocking for a functional MVP.**
