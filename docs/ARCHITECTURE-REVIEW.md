# ARCHITECTURE-REVIEW.md — Architecture Review

> **Date:** 2026-02-18  
> **Branch:** `security/critical-fixes`  
> **Task:** ARCH-001  
> **Reviewer:** Dali (subagent)

---

## Summary

| Category | Status |
|----------|--------|
| Component hierarchy | ✅ Clean and well-organized |
| Convex schema type safety | 🟡 Several fields use loose `v.string()` |
| Convex indexes | 🟡 Missing one critical index; one N+1 workaround |
| N+1 query patterns | 🔴 3 confirmed N+1 patterns |
| Sync-agent architecture | ✅ Solid; well-secured post SEC-003/004 |
| Server/client boundaries | 🟡 Over-broad client component usage |
| Auth layer depth | 🟡 Single-layer only (middleware only) |
| CardId generation | 🔴 Bug — duplicate IDs possible after task deletion |

---

## Part 1: Component Hierarchy

```
src/app/layout.tsx  [Server Component]
│  ConvexClientProvider  [Client — forces subtree to client]
│    ThemeProvider [Client]
│      OfflineBanner [Client]
│      {children}
│      ServiceWorkerRegister [Client]
│
├── src/app/page.tsx  [Server → redirects to /board or /login]
├── src/app/login/page.tsx  [Server — no Convex, static]
│
└── src/app/(app)/layout.tsx  [Server]
       AppLayout  [Client]
         AppSidebar  [Client]
           CommandPalette  [Client]
         AppHeader  [Client]
           ThemeToggle  [Client]
         {children} (main content):
           │
           ├── board/page.tsx  [Client — Suspense wrapper]
           │     BoardPageContent  [Client]
           │       BoardFilterBar  [Client]
           │       RecommendButton  [Client]
           │       KanbanBoard  [Client]
           │         KanbanColumn  [Client]
           │           SortableTaskCard  [Client — dnd-kit]
           │             TaskCard  [Client]
           │           SwipeableTaskCard  [Client — touch]
           │       CreateTaskDialog  [Client]
           │       CardDetailSheet  [Client]
           │         EditableTitle, EditableField, EditableTextarea
           │         EditableTags
           │         SessionSummary
           │         BlockerList  [Client]
           │         SubtaskList  [Client]
           │         AuditTrail  [Client]
           │       KeyboardShortcutsDialog  [Client]
           │
           ├── my-work/page.tsx  [Client]
           │     CardDetailSheet  [Client]
           │
           ├── workflows/page.tsx  [Client]
           │     WorkflowsPage → Link to [id]/page.tsx
           │       WorkflowPipeline  [Client]
           │         DocumentReference  [Client]
           │
           ├── analytics/page.tsx  [Client]
           │     recharts components (BarChart, PieChart)
           │
           └── settings/page.tsx  [Client]
```

### ARCH-1 — Over-broad "use client" propagation

**Severity:** 🟡 MEDIUM  
**Impact:** Performance (larger initial bundle)

`AppLayout`, `AppSidebar`, and `AppHeader` are all marked `"use client"`. However:
- `AppSidebar` only renders static navigation links with no state — it doesn't need to be a client component unless it subscribes to navigation state
- `AppLayout` manages no state itself and just renders a flex layout — could be a server component

The `ConvexClientProvider` in `layout.tsx` wraps all children in a client context, but Next.js 13+ handles this correctly — server components can be rendered inside client providers as children (they're still server-rendered). The key is that **the `(app)/layout.tsx` could remain a server component** even though it wraps `AppLayout` (a client component), if `AppLayout` accepted `children` properly.

**Recommended approach:** The `(app)/layout.tsx` is already a server component. The issue is lower in the tree. `AppLayout` could split its client-side parts (if any) to a smaller wrapper component, keeping the static shell as a server component.

**Impact of not fixing:** No functional bug, but clients download unnecessary JS for the navigation shell. Estimated impact: ~5-15KB.

### ARCH-2 — `login/page.tsx` should be Server Component ✅

**File:** `src/app/login/page.tsx`  
Checking: The login page doesn't have a `"use client"` directive found in the client component list — it's a server component. ✅

---

## Part 2: Convex Schema Design

### ARCH-3 — Loose `v.string()` where typed unions should be used

**Severity:** 🟡 MEDIUM  
**File:** `convex/schema.ts`

| Table | Field | Current | Should Be |
|-------|-------|---------|-----------|
| `fileSyncQueue` | `direction` | `v.string()` | `v.union(v.literal("to-local"), v.literal("to-cloud"))` |
| `fileSyncQueue` | `status` | `v.string()` | `v.union(v.literal("pending"), v.literal("synced"), v.literal("conflict"))` |
| `agentActivity` | `status` | `v.string()` | `v.union(v.literal("working"), v.literal("idle"))` |
| `workflowSteps` | `references[].type` | `v.string()` | `v.union(v.literal("claude_md"), v.literal("prompt_template"), v.literal("library"))` |
| `auditLogs` | `action` | `v.string()` | Could be typed, but many dynamic values like `"updated ${field}"` — acceptable as string |

**Impact of loose strings:**
1. Convex cannot validate invalid values at the database layer — invalid direction/status values can be stored
2. TypeScript types in `_generated/dataModel.d.ts` will be `string` instead of the union, losing type safety in all Convex function handlers
3. The `fileSyncQueue.updateStatusInternal` mutation at `convex/fileSyncQueue.ts:48` accepts any status string — including invalid ones

**Recommended schema fix (no data migration required — only adds validation):**
```typescript
// convex/schema.ts
fileSyncQueue: defineTable({
  filePath: v.string(),
  content: v.string(),
  direction: v.union(v.literal("to-local"), v.literal("to-cloud")),
  status: v.union(v.literal("pending"), v.literal("synced"), v.literal("conflict")),
  timestamp: v.number(),
})

agentActivity: defineTable({
  // ...
  status: v.union(v.literal("working"), v.literal("idle")),
  // ...
})
```

### ARCH-4 — `notifications.ts` has duplicate query logic vs schema query

**Severity:** 🟡 MEDIUM  
**File:** `convex/notifications.ts:21-35` and `convex/notifications.ts:42-68`  

`checkBlockedTasks` (internalQuery) and `processBlockerNotifications` (internalMutation) both load all tasks with `ctx.db.query("tasks").collect()` and filter in-memory for blocked tasks assigned to "dali". This is duplicated logic and both perform full table scans.

`checkBlockedTasks` appears to be unused in the current codebase (no scheduler or HTTP endpoint calls it). `processBlockerNotifications` also appears to have no scheduler wired up — there's no `convex/crons.ts` or scheduled function registration.

**Recommendation:** Either wire up the scheduler or remove these functions if not yet in use.

### ARCH-5 — `ideas` table has no usage in the frontend

**Severity:** 🟢 LOW  
The `ideas` table is defined in schema with indexes `by_projectId` and `by_status`, but there's no page, component, or Convex function that reads or writes ideas (other than the export). This appears to be a planned feature not yet implemented.

**Recommendation:** Either implement or mark clearly as "planned but not active." Currently the export backup (`getFullBackup`) includes ideas, which is correct for data completeness.

---

## Part 3: N+1 Query Patterns

### ARCH-6 — 🔴 `convex/search.ts`: N+1 project lookups

**Severity:** 🔴 HIGH (performance correctness issue)  
**File:** `convex/search.ts:29-38`

```typescript
// After merging up to 20 results:
const results = await Promise.all(
  merged.slice(0, 20).map(async (task) => {
    const project = await ctx.db.get(task.projectId); // ← N ctx.db.get calls
    return { ...task, projectName: project?.name ?? "Unknown", ... };
  })
);
```

This performs up to 20 individual `ctx.db.get` calls for project lookups. While Convex batches these via `Promise.all` (so they're concurrent, not serial), it's still N database reads where 1 would suffice.

**Fix:** Pre-fetch all active projects and build a Map:
```typescript
// Efficient approach:
const projects = await ctx.db
  .query("projects")
  .withIndex("by_status", (q) => q.eq("status", "active"))
  .collect();
const projectMap = new Map(projects.map((p) => [p._id, p]));

const results = merged.slice(0, 20).map((task) => ({
  ...task,
  projectName: projectMap.get(task.projectId)?.name ?? "Unknown",
  projectColor: projectMap.get(task.projectId)?.color ?? "#888",
}));
```

### ARCH-7 — 🔴 `convex/workflows.ts:getAllTemplates`: N+1 step count queries

**Severity:** 🔴 HIGH (performance)  
**File:** `convex/workflows.ts:7-17`

```typescript
export const getAllTemplates = query({
  handler: async (ctx) => {
    const templates = await ctx.db.query("workflowTemplates").collect();
    const enriched = await Promise.all(
      templates.map(async (t) => {
        const steps = await ctx.db  // ← N queries, one per template
          .query("workflowSteps")
          .withIndex("by_templateId", (q) => q.eq("templateId", t._id))
          .collect();
        return { ...t, stepCount: steps.length };
      })
    );
    return enriched;
  },
});
```

For N workflow templates, this fires N+1 queries (1 for templates + N for step counts). Currently there are 3 templates, so the impact is small, but it scales linearly.

**Fix options:**
1. Store `stepCount` as a denormalized field on `workflowTemplates` and update it when steps are added/removed
2. Load all steps in one query and group in-memory:
```typescript
const templates = await ctx.db.query("workflowTemplates").collect();
const allSteps = await ctx.db.query("workflowSteps").collect();
const stepsByTemplate = allSteps.reduce((acc, s) => {
  acc[s.templateId] = (acc[s.templateId] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);
return templates.map((t) => ({ ...t, stepCount: stepsByTemplate[t._id] ?? 0 }));
```

### ARCH-8 — `convex/analytics.ts`: Full table scans with in-memory joins

**Severity:** 🟡 MEDIUM  
**File:** `convex/analytics.ts:7-41` (getCycleTime)

```typescript
const tasks = await ctx.db.query("tasks").collect(); // All tasks (no index)
const projects = await ctx.db.query("projects")
  .withIndex("by_status", q => q.eq("status", "active")).collect();

// Then: for each project, filter tasks in-memory
for (const project of projects) {
  const projectTasks = tasks.filter(t => t.projectId === project._id && ...)
```

This is O(projects × tasks) in-memory work. With small data volumes (personal tool) this is acceptable, but as tasks grow, performance degrades. A proper indexed query per project would be:
```typescript
// More efficient:
for (const project of projects) {
  const projectTasks = await ctx.db.query("tasks")
    .withIndex("by_projectId", q => q.eq("projectId", project._id))
    .filter(q => q.eq(q.field("status"), "done"))
    .collect();
}
```
This trades one big scan for N indexed scans, which is better until task counts become very large.

### ARCH-9 — 🔴 `convex/tasks.ts:getByCardId`: Full table scan

**Severity:** 🔴 HIGH  
**File:** `convex/tasks.ts:224-229`

```typescript
export const getByCardId = internalQuery({
  args: { cardId: v.string() },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("tasks").collect(); // ← ALL tasks
    return tasks.find((t) => t.cardId === args.cardId) ?? null;
  },
});
```

This loads every task in the database for every agent API call (`/agent/updateTask`, `/agent/createAuditLog`, `/agent/getTask`). The `tasks` schema has a `search_cardId` search index but it's for full-text search. There's no regular index on `cardId`.

**Fix:** Add an index on `cardId` to the schema:
```typescript
// convex/schema.ts
tasks: defineTable({
  // ...
}).index("by_cardId", ["cardId"])  // ← add this
```

Then use it in `getByCardId`:
```typescript
export const getByCardId = internalQuery({
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_cardId", (q) => q.eq("cardId", args.cardId))
      .first();
  },
});
```

This reduces every agent API call from an O(n) table scan to an O(log n) indexed lookup — critical for a tool where the agent makes frequent API calls.

---

## Part 4: Sync-Agent Architecture

### ARCH-10 — Sync-agent design: ✅ Solid post SEC-003/004

The sync-agent (`sync-agent/index.js`) has a well-thought-out architecture:

**Strengths:**
- `resolveSafePath()` properly validates paths against `PROJECT_ROOT` using `resolve()` + `startsWith()`
- Null byte stripping: `filePath.replace(/\0/g, "")` ✅
- Extension allowlist: `.md`, `.json`, `.yaml`, `.txt` only ✅
- Directory creation before writes (`mkdir -p`) ✅
- Graceful shutdown on `SIGINT`/`SIGTERM` ✅
- Error handling per-item with conflict marking ✅
- AGENT_SECRET verified on every Convex HTTP call ✅

**Residual concern — ARCH-11 (Medium):** Windows path case sensitivity

**Severity:** 🟡 MEDIUM  
**File:** `sync-agent/index.js:34`

```javascript
if (!resolved.startsWith(PROJECT_ROOT)) {
  throw new Error(`Path outside allowed root: ${filePath}`);
}
```

On Windows (NTFS), the file system is case-insensitive. `C:\Users\danie\Projects\wowwai` and `C:\users\danie\projects\wowwai` resolve to the same path, but `String.startsWith` is case-sensitive. An attacker crafting a path with different casing (e.g., `../PROJECTS/wowwai/docs/test.md`) could potentially bypass this check on Windows.

**Fix:** Normalize both paths to lowercase (or use `path.resolve` consistently and compare the normalized forms):
```javascript
function resolveSafePath(filePath) {
  const cleaned = filePath.replace(/\0/g, "");
  const resolved = resolve(PROJECT_ROOT, cleaned);
  // Case-insensitive comparison on Windows
  const normalizedResolved = resolved.toLowerCase();
  const normalizedRoot = PROJECT_ROOT.toLowerCase();
  if (!normalizedResolved.startsWith(normalizedRoot)) {
    throw new Error(`Path outside allowed root: ${filePath}`);
  }
  // ... rest of validation
}
```

**ARCH-12 — Sync-agent has no heartbeat to Convex (only console logging)**

**Severity:** 🟢 LOW  
**File:** `sync-agent/index.js:161-163`  
The sync-agent's heartbeat is only a `console.log`. It doesn't call the `/agent/heartbeat` Convex endpoint, so the UI's "agent activity" indicator (`agentActivity.getAllActive`) won't show the sync-agent as active even when it's running. This may be intentional (sync-agent is infrastructure, not an AI session), but worth noting.

---

## Part 5: Server/Client Boundaries & Auth Layer

### ARCH-13 — Single-layer auth: middleware only, no secondary checks

**Severity:** 🟡 MEDIUM  
**File:** `src/app/(app)/layout.tsx`

The `(app)/layout.tsx` performs no auth check — it purely delegates to `AppLayout`. The entire auth enforcement relies on `middleware.ts`. This is acceptable for most Next.js apps (the docs recommend this pattern), but it means:

1. If middleware is ever misconfigured or bypassed, there is **no defense-in-depth** in the page layer
2. Server-side data fetching within page components (if added in future) would have no auth guard

**Recommendation:** For the most sensitive data operations, add a server-side auth check in the page or a server action:
```typescript
// Example server component auth check:
import { cookies } from 'next/headers';
import { verifySessionToken, AUTH_COOKIE } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) redirect('/login');
  // ... render page
}
```

This provides defense-in-depth without breaking the existing middleware approach.

### ARCH-14 — Data flow is well-documented and clean

The three data flow patterns in WOWWAI are clearly separated:

```
1. Browser → Convex (reactive queries):
   Browser → ConvexClientProvider → useQuery(api.xxx.yyy) → Convex functions
   [Unauthenticated — see QUAL-4]

2. Browser → Next.js API → Convex (authenticated mutations):
   Browser → /api/export or /api/sync/enqueue → verifySessionToken → 
   fetch(CONVEX_SITE_URL/..., { x-agent-secret }) → Convex HTTP action → internalMutation
   [Authenticated — correct pattern for sensitive ops]

3. Sync-Agent → Convex (AGENT_SECRET):
   Sync-Agent → fetch(CONVEX_SITE_URL/sync/..., { x-agent-secret }) → 
   Convex HTTP action → verifySecret → internalMutation
   [Authenticated — correct]
```

Pattern 2 is the right architecture for sensitive operations. The challenge (QUAL-4) is that Pattern 1 still covers too many write operations.

### ARCH-15 — `ConvexClientProvider` gracefully handles missing URL

**File:** `src/components/convex-provider.tsx:7-12`  
```typescript
const client = useMemo(() => {
  if (!convexUrl) return null;
  return new ConvexReactClient(convexUrl);
}, [convexUrl]);

if (!client) {
  return <>{children}</>;  // renders without Convex
}
```
This is a good defensive pattern — the app renders (without real-time data) rather than crashing if `NEXT_PUBLIC_CONVEX_URL` is missing. ✅

---

## Part 6: Bug — CardId Collision After Task Deletion

### ARCH-16 — 🔴 HIGH: Duplicate cardIds possible after task deletion

**Severity:** 🔴 HIGH  
**File:** `convex/tasks.ts:26-28`

```typescript
const existingTasks = await ctx.db
  .query("tasks")
  .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
  .collect();
const nextNumber = existingTasks.length + 1; // ← BUG
const cardId = `${project.slug.toUpperCase()}-${nextNumber}`;
```

**The bug:** CardId numbers are derived from `existingTasks.length + 1`, not from `max(existingCardIdNumbers) + 1`. If tasks are deleted:

- Project has tasks WOWWAI-1, WOWWAI-2, WOWWAI-3, WOWWAI-4, WOWWAI-5 (length=5)
- WOWWAI-3 is deleted (length=4)
- Next task created → `4 + 1 = 5` → cardId = `WOWWAI-5` ← **DUPLICATE!**

CardIds are used as audit log keys, search indexes, and agent API identifiers. Duplicate cardIds would cause:
- `getByCardId` to return the wrong task (finds first match)
- Audit logs referencing the wrong task
- Agent API calling `/agent/updateTask?cardId=WOWWAI-5` would update the wrong task

**Fix:**
```typescript
// Option A: Use search index to find max cardId number
const taskPrefix = `${project.slug.toUpperCase()}-`;
const existingTasks = await ctx.db
  .query("tasks")
  .withIndex("by_projectId", q => q.eq("projectId", args.projectId))
  .collect();
const maxNumber = existingTasks.reduce((max, t) => {
  const num = parseInt(t.cardId.replace(taskPrefix, ""), 10);
  return isNaN(num) ? max : Math.max(max, num);
}, 0);
const cardId = `${taskPrefix}${maxNumber + 1}`;

// Option B (better): Store a counter on the project record
// Add `taskCounter: v.number()` to projects schema and increment atomically
```

Option B (an atomic counter) is preferred as it's O(1) and race-condition-safe. Option A is O(n) but safer than the current code.

---

## Summary of Findings

| ID | Finding | Severity | File:Line |
|----|---------|----------|-----------|
| ARCH-1 | Over-broad client component usage | 🟡 MEDIUM | Multiple |
| ARCH-3 | `v.string()` should be typed unions | 🟡 MEDIUM | `convex/schema.ts:94,97,107,118` |
| ARCH-4 | Notifications not wired to scheduler | 🟡 MEDIUM | `convex/notifications.ts` |
| ARCH-5 | `ideas` table has no frontend usage | 🟢 LOW | `convex/schema.ts:17-31` |
| ARCH-6 | N+1: search.ts project lookups | 🔴 HIGH | `convex/search.ts:29-38` |
| ARCH-7 | N+1: workflows.ts step counts | 🔴 HIGH | `convex/workflows.ts:7-17` |
| ARCH-8 | Full table scan in analytics | 🟡 MEDIUM | `convex/analytics.ts:7-41` |
| ARCH-9 | Full table scan in getByCardId | 🔴 HIGH | `convex/tasks.ts:224-229` |
| ARCH-11 | Windows case sensitivity in path check | 🟡 MEDIUM | `sync-agent/index.js:34` |
| ARCH-12 | Sync-agent heartbeat not in Convex | 🟢 LOW | `sync-agent/index.js:161` |
| ARCH-13 | No secondary auth check in pages | 🟡 MEDIUM | `src/app/(app)/layout.tsx` |
| ARCH-16 | **BUG: Duplicate cardIds after deletion** | 🔴 HIGH | `convex/tasks.ts:26-28` |

---

## Recommended Fix Order

1. **ARCH-16** (cardId collision bug) — data integrity, fix before any task deletions occur
2. **ARCH-9** (getByCardId full scan) — every agent API call touches this; add `by_cardId` index
3. **ARCH-6** (search N+1) — every search query hits this
4. **ARCH-7** (workflows N+1) — fix with single-query approach
5. **ARCH-3** (schema type safety) — no migration needed, pure improvement
6. **ARCH-11** (Windows path casing) — low probability but simple fix
7. **ARCH-13** (secondary auth) — defense-in-depth
8. **ARCH-1** (client boundary) — performance optimization
