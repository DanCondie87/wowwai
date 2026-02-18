# CODE-QUALITY.md — TypeScript Strictness & Code Quality Review

> **Date:** 2026-02-18  
> **Branch:** `security/critical-fixes`  
> **Task:** QUAL-001  
> **Reviewer:** Dali (subagent)

---

## Summary

| Category | Status |
|----------|--------|
| TypeScript `strict: true` | ✅ Enabled |
| `any` types in codebase | ✅ None found |
| Error boundaries | ❌ None — missing |
| Production console.logs | 🟡 Minor (acceptable) |
| Hardcoded values needing constants | 🟡 Several |
| Unauthenticated public Convex mutations (non-SEC-003) | 🔴 High — residual issue |
| Duplicate type definitions | 🟡 2 instances |
| Missing error handling | 🟡 Several UI components |

Overall: Code quality is solid. TypeScript is strict, `any` is absent, and patterns are generally consistent. The most significant finding is **residual unauthenticated Convex operations** that were not addressed in SEC-003.

---

## Part 1: TypeScript Strictness

### QUAL-1 — `strict: true` is enabled ✅

**File:** `tsconfig.json:8`  
`"strict": true` is set, which enables:
- `strictNullChecks` ✅
- `strictFunctionTypes` ✅
- `strictBindCallApply` ✅
- `strictPropertyInitialization` ✅
- `noImplicitAny` ✅
- `noImplicitThis` ✅
- `alwaysStrict` ✅

### QUAL-2 — Additional strictness flags not enabled

**Severity:** 🟡 MEDIUM  
**File:** `tsconfig.json`

The following flags provide additional safety but require opt-in:

```json
// Recommended additions to tsconfig.json:
{
  "noUncheckedIndexedAccess": true,   // arr[0] is T | undefined, not T
  "exactOptionalPropertyTypes": true, // distinguishes undefined vs absent property
  "noImplicitOverride": true,         // requires 'override' keyword in subclasses
  "noFallthroughCasesInSwitch": true  // prevents switch fallthrough bugs
}
```

**Impact:** `noUncheckedIndexedAccess` would be most impactful — there are several places where array indexing is done without undefined checks (e.g., `board/page.tsx:90` `visibleTasks[0]`, `visibleTasks[idx + 1]`). Adding this flag would surface these.

**Recommendation:** Add at minimum `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch`. These catch real bugs.

### QUAL-3 — `any` types: none found ✅

Search across all `src/**/*.ts`, `src/**/*.tsx`, and `convex/**/*.ts` — no `: any`, `as any`, `<any>`, or `any[]` found in authored code. The codebase uses `unknown`, `Record<string, unknown>`, and proper generics throughout. This is excellent.

---

## Part 2: Residual Unauthenticated Convex Operations

### QUAL-4 — 🔴 HIGH: Public mutations/queries not addressed in SEC-003

**Severity:** 🔴 HIGH  
**Context:** SEC-003 correctly secured `fileSyncQueue.enqueue` and `export.getFullExport`, which were the most dangerous vectors (file write injection + data dump). However, the broader Convex auth problem persists. The following remain as **unauthenticated public API** callable by anyone with the Convex URL:

**Public mutations (write operations):**
| File | Function | Risk |
|------|----------|------|
| `convex/tasks.ts:9` | `tasks.create` | Anyone can create tasks |
| `convex/tasks.ts:56` | `tasks.update` | Anyone can modify any task |
| `convex/tasks.ts:112` | `tasks.moveToColumn` | Anyone can move tasks |
| `convex/tasks.ts:139` | `tasks.reorder` | Anyone can reorder tasks |
| `convex/projects.ts:12` | `projects.create` | Anyone can create projects |
| `convex/projects.ts:24` | `projects.update` | Anyone can modify projects |
| `convex/projects.ts:40` | `projects.archive` | Anyone can archive projects |
| `convex/auditLogs.ts:7` | `auditLogs.create` | Anyone can inject fake audit entries |
| `convex/workflows.ts:30` | `workflows.createTemplate` | Anyone can create workflow templates |
| `convex/workflows.ts:41` | `workflows.createStep` | Anyone can create workflow steps |

**Public queries (read operations):**
| File | Function | Risk |
|------|----------|------|
| `convex/tasks.ts:150` | `tasks.getAll` | All tasks readable |
| `convex/tasks.ts:162` | `tasks.getByProject` | All project tasks readable |
| `convex/tasks.ts:172` | `tasks.getByStatus` | All tasks by status readable |
| `convex/tasks.ts:187` | `tasks.getByAssignee` | All tasks by assignee readable |
| `convex/tasks.ts:201` | `tasks.getAllTags` | All tags readable |
| `convex/tasks.ts:207` | `tasks.getById` | Any task (with subtasks) readable |
| `convex/projects.ts:47` | `projects.getAll` | All projects readable |
| `convex/projects.ts:55` | `projects.getById` | Any project readable |
| `convex/search.ts:5` | `search.searchTasks` | Full-text search over all tasks |
| `convex/analytics.ts:7` | `analytics.getCycleTime` | Analytics data readable |
| `convex/analytics.ts:45` | `analytics.getThroughput` | Analytics data readable |
| `convex/analytics.ts:75` | `analytics.getBlockerStats` | Analytics data readable |
| `convex/analytics.ts:109` | `analytics.getModelUsage` | Analytics data readable |
| `convex/agentActivity.ts:7` | `agentActivity.getActiveByTaskId` | Agent activity readable |
| `convex/agentActivity.ts:21` | `agentActivity.getAllActive` | All agent activity readable |
| `convex/auditLogs.ts:50` | `auditLogs.getByTask` | Task audit history readable |
| `convex/workflows.ts:7` | `workflows.getAllTemplates` | All workflows readable |
| `convex/workflows.ts:17` | `workflows.getTemplateWithSteps` | Workflow details readable |
| `convex/recommend.ts:36` | `recommend.getRecommendations` | AI recommendations readable |

**Assessment for single-user personal tool:**  
The REVIEW-PLAN.md acknowledged this threat model: the Convex URL is in the client bundle and therefore "public, though typically obfuscated." For a genuinely personal single-user tool deployed to `wowwai.vercel.app`, the data exposure risk is moderate (a motivated attacker could find the Convex URL from the client bundle), but the mutation risk is more serious — `auditLogs.create` in particular allows injection of fake audit entries which undermines the integrity of the audit trail.

**Recommendation:** At minimum, convert `auditLogs.create` from `mutation` to `internalMutation` (it's only called from within task operations anyway). For write operations on tasks and projects, consider adding a lightweight Convex auth check using a shared secret injected via `ConvexClientProvider`, or accept the single-user risk formally and document it.

---

## Part 3: Error Handling

### QUAL-5 — Missing `try/catch` in UI mutation calls

**Severity:** 🟡 MEDIUM  
**File:** `src/components/kanban/card-detail-sheet.tsx:76,89`

The `handleFieldBlur` and `handleSelectChange` functions call `await updateTask(...)` without any error handling. If the Convex mutation throws (e.g., task not found, network error), the error will propagate silently to React's unhandled promise rejection handler with no user feedback.

```typescript
// card-detail-sheet.tsx:76 — no try/catch
async function handleFieldBlur(field: string, value: string | string[] | undefined) {
  if (!taskId || !task) return;
  const currentValue = (task as Record<string, unknown>)[field];
  if (JSON.stringify(currentValue) === JSON.stringify(value)) return;
  await updateTask({ id: taskId, [field]: value }); // ← unhandled rejection
  showSaved();
}
```

**Fix:** Wrap in try/catch and show an error state:
```typescript
async function handleFieldBlur(field: string, value: string | string[] | undefined) {
  if (!taskId || !task) return;
  const currentValue = (task as Record<string, unknown>)[field];
  if (JSON.stringify(currentValue) === JSON.stringify(value)) return;
  try {
    await updateTask({ id: taskId, [field]: value });
    showSaved();
  } catch (err) {
    console.error("Failed to update task:", err);
    // TODO: show error toast
  }
}
```

### QUAL-6 — `swipeable-task-card.tsx:78` — unhandled rejection logged but not shown to user

**Severity:** 🟢 LOW  
**File:** `src/components/kanban/swipeable-task-card.tsx:78`  
`console.error("Failed to move task:", error)` is caught and logged but the swipe gesture completes visually without rolling back. The task appears to have moved but hasn't. Consider reverting the optimistic UI state on error.

### QUAL-7 — No error boundaries anywhere in the component tree

**Severity:** 🟠 HIGH  
**Finding:** There are zero React Error Boundaries in the entire application. A runtime error in any component (e.g., from malformed Convex data, a failed `JSON.parse`, or an unexpected null) will crash the entire app with a white screen.

**Recommended boundaries:**
1. Wrap `(app)/layout.tsx` children with a top-level error boundary
2. Wrap `KanbanBoard` — if drag state goes wrong, only the board fails, not the whole app
3. Wrap each page component

```typescript
// Example: src/components/error-boundary.tsx
'use client';
import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <p>Something went wrong. Refresh to try again.</p>;
    }
    return this.props.children;
  }
}
```

### QUAL-8 — `convex/notifications.ts` has a potential edge case

**Severity:** 🟢 LOW  
**File:** `convex/notifications.ts:32-47`  
`processBlockerNotifications` loads all tasks without the `by_taskId` index and does in-memory filtering. The "already notified in last 4 hours" check then queries `auditLogs` for each blocked task — this is an N+1 query inside an `internalMutation`. See also ARCH-004.

---

## Part 4: Production Console Statements

**Severity:** 🟢 LOW — all acceptable

All `console.log`/`console.error` statements found are appropriate for their context:

| File | Line | Statement | Verdict |
|------|------|-----------|---------|
| `service-worker-register.tsx:11` | `console.log("[SW] Registered:")` | Client-side SW debug | ✅ OK (dev info) |
| `service-worker-register.tsx:14` | `console.error("[SW] Registration failed:")` | SW error | ✅ OK |
| `recommend-button.tsx:31` | `console.error("Failed to get recommendations:")` | UI error | ✅ OK |
| `swipeable-task-card.tsx:78` | `console.error("Failed to move task:")` | UI error | ✅ OK |
| `settings/page.tsx:75` | `console.error("Failed to load export data:")` | Client fetch error | ✅ OK |
| `api/export/route.ts:28,41,48` | `console.error(...)` | Server-side logging | ✅ OK |
| `api/sync/enqueue/route.ts:30,53,59` | `console.error(...)` | Server-side logging | ✅ OK |
| `notifications.ts:25,36,38,42` | `console.log/error(...)` | Server function logging | ✅ OK |

No `console.log` statements should be removed. They are appropriately placed.

---

## Part 5: Hardcoded Values

### QUAL-9 — AEST timezone offset hardcoded (not DST-aware)

**Severity:** 🟡 MEDIUM  
**File:** `convex/notifications.ts:8`  
```typescript
const AEST_OFFSET_HOURS = 10; // ← wrong during AEDT (UTC+11)
```
Australia observes AEDT (UTC+11) in summer. During AEDT, quiet hours will be calculated an hour off. "23:00 AEST" is actually midnight AEDT.

**Fix:** Use `Intl.DateTimeFormat` with `timeZone: "Australia/Sydney"` instead:
```typescript
function isQuietHours(): boolean {
  const aestHour = parseInt(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10
  );
  return aestHour >= 23 || aestHour < 8;
}
```

### QUAL-10 — Actor `"dan"` hardcoded in task mutations

**Severity:** 🟡 MEDIUM  
**Files:** `convex/tasks.ts:93,130` (update, moveToColumn mutations)  
The audit log entries created by `tasks.update` and `tasks.moveToColumn` hardcode `actor: "dan"`. If Dali calls these mutations (e.g., via the agent API in the future), the audit log will incorrectly attribute the change to Dan.

**Current code:**
```typescript
// tasks.ts:93
await ctx.db.insert("auditLogs", {
  taskId: id,
  actor: "dan", // ← hardcoded
  action: entry.action,
  ...
```

**Recommendation:** Either accept this limitation (single-user tool, Dan is always the UI user), or pass `actor` as a parameter to the handler.

### QUAL-11 — Duplicate `TaskStatus` type definition

**Severity:** 🟡 MEDIUM  
**Files:** `src/lib/columns.ts:1` and `src/lib/agent-client.ts:43`

Both files define:
```typescript
export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
```

These are identical. `agent-client.ts` appears to be a standalone file for the sync-agent (not imported from `src/lib`), which explains the duplication. But if `agent-client.ts` is also used from `src/`, it should import from `columns.ts`.

**Recommendation:** Check whether `agent-client.ts:43` can be replaced with `import type { TaskStatus } from "@/lib/columns"`. If `agent-client.ts` is for the sync-agent (Node.js, not Next.js), the duplication is acceptable.

### QUAL-12 — 30-minute agent heartbeat threshold hardcoded in multiple files

**Severity:** 🟢 LOW  
**Files:** `convex/agentActivity.ts:17`, `convex/agentActivity.ts:25`  
The 30-minute stale activity threshold appears in two separate places. Extract to a named constant:
```typescript
const STALE_ACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
```

---

## Part 6: Dead Code Assessment

### QUAL-13 — `convex/seed.ts` is production-deployed but setup-only

**Severity:** 🟡 MEDIUM  
`seed.ts` contains `seedReviewProject`, `seedWorkflows`, and `seedAll` as public mutations (see DEP-7 above). These are one-time setup operations but remain deployed. The file is clearly useful during development but should be converted to internal mutations or excluded from production.

### QUAL-14 — `scripts/backup.ts` and `scripts/migrate-tasks.ts` — status unclear

**Severity:** 🟢 LOW  
These scripts exist but are not referenced in `package.json` scripts. They appear to be run manually with `npx ts-node`. They pose no runtime risk but should be documented or cleaned up if no longer needed.

### QUAL-15 — `convex/recommend.ts` uses `api.tasks.getAll` and `api.projects.getAll` (public)

**Severity:** 🟢 LOW (code quality)  
**File:** `convex/recommend.ts:39,40`  
The `getRecommendations` action calls `ctx.runQuery(api.tasks.getAll)` and `ctx.runQuery(api.projects.getAll)`. These use the public API rather than internal. While this works, it means the recommendation action is also subject to the auth considerations in QUAL-4. Consider switching to `internal.tasks.getAll` if internal versions are created.

---

## Remediation Priority

| Finding | Severity | Effort | Priority |
|---------|----------|--------|----------|
| QUAL-4 (residual public Convex mutations) | 🔴 HIGH | Medium | P1 |
| QUAL-7 (no error boundaries) | 🟠 HIGH | Medium | P1 |
| QUAL-9 (DST bug in quiet hours) | 🟡 MEDIUM | Low | P2 |
| QUAL-5 (missing try/catch in card mutations) | 🟡 MEDIUM | Low | P2 |
| QUAL-10 (hardcoded actor "dan") | 🟡 MEDIUM | Low | P2 |
| QUAL-2 (missing tsconfig flags) | 🟡 MEDIUM | Low | P2 |
| QUAL-11 (duplicate TaskStatus) | 🟡 MEDIUM | Low | P3 |
| QUAL-13 (seed.ts public in prod) | 🟡 MEDIUM | Low | P2 |
| QUAL-6 (swipe gesture no rollback) | 🟢 LOW | Medium | P3 |
| QUAL-12 (hardcoded timeouts) | 🟢 LOW | Trivial | P3 |
| QUAL-14 (scripts/ clarity) | 🟢 LOW | Trivial | P3 |
| QUAL-15 (recommend uses public api) | 🟢 LOW | Trivial | P3 |
