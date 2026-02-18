# BUGFIXES.md

> Branch: `security/critical-fixes`  
> Date: February 2026  
> Status: Committed, pending deploy

---

## BUG-001: CardId Collision After Task Deletion

### Symptom
Creating a new task after deleting any earlier task would produce a duplicate `cardId`.  
Example: Project has tasks `FOO-1`, `FOO-2`, `FOO-3`. Delete `FOO-2`. Create new task → gets `FOO-3` (collision!).

### Root Cause
`convex/tasks.ts` `create` mutation used:
```typescript
const nextNumber = existingTasks.length + 1;
```
After deletion, `length` can return a number already used by an existing task.

### Fix
`convex/tasks.ts` — scan all existing `cardId` values for this project, extract the numeric suffix, and use `max + 1`:
```typescript
const prefix = project.slug.toUpperCase() + "-";
let maxNumber = 0;
for (const t of existingTasks) {
  if (t.cardId.startsWith(prefix)) {
    const n = parseInt(t.cardId.slice(prefix.length), 10);
    if (!isNaN(n) && n > maxNumber) maxNumber = n;
  }
}
const cardId = `${prefix}${maxNumber + 1}`;
```
Edge case handled: zero existing tasks → `maxNumber = 0` → first card gets `-1`.

### Impact
Previously created duplicate `cardId` values are not retroactively fixed (no migration needed — duplicates only occur during creation, not retroactively). Going forward, all new tasks get unique cardIds.

---

## BUG-002: DST Bug — Quiet Hours Off By 1 Hour

### Symptom
Blocker notifications sent 1 hour early (or late) for ~6 months per year (AEDT season, October–April).

### Root Cause
`convex/notifications.ts` used a hardcoded UTC offset:
```typescript
const AEST_OFFSET_HOURS = 10; // wrong during AEDT (should be 11)
```
Australia/Sydney uses AEDT (UTC+11) during daylight saving, not AEST (UTC+10).

### Fix
Replaced hardcoded offset with `Intl.DateTimeFormat` timezone-aware hour extraction:
```typescript
function getSydneyHour(): number {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? parseInt(hourPart.value, 10) : new Date().getUTCHours();
}
```
The JS engine handles AEDT/AEST transitions automatically via the IANA timezone database.

---

## BUG-003: N+1 Query — `getByCardId` Full Table Scan

### Symptom
Every call to `tasks.getByCardId` (used by the agent API) performed a full table scan of the `tasks` table, loading all documents to find one by `cardId`. Degrades with task count.

### Root Cause
```typescript
// Old code — scans ALL tasks
const tasks = await ctx.db.query("tasks").collect();
return tasks.find((t) => t.cardId === args.cardId) ?? null;
```
No index on `cardId` field.

### Fix
1. `convex/schema.ts` — added index:
   ```typescript
   .index("by_cardId", ["cardId"])
   ```
2. `convex/tasks.ts` — updated `getByCardId` to use the index:
   ```typescript
   return await ctx.db
     .query("tasks")
     .withIndex("by_cardId", (q) => q.eq("cardId", args.cardId))
     .first() ?? null;
   ```
Now O(log n) instead of O(n).

---

## BUG-004: Silent Mutation Failures

### Symptom
Saving task fields (title, description, priority, etc.) would show "Saved" even when the mutation failed. The user had no feedback that their change was lost.

### Root Cause
All `handleFieldBlur` and `handleSelectChange` calls in `card-detail-sheet.tsx` had no error handling. Similarly for `create-task-dialog.tsx`, `subtask-list.tsx`, `blocker-list.tsx`, `kanban-board.tsx`, and `swipeable-task-card.tsx`.

### Fix
- Added `sonner` toast library
- Wrapped all mutation calls in `try/catch`
- On error: `toast.error("Failed to save fieldName: <message>")`
- On create success: `toast.success("Task created")` / `"Subtask added"`
- `<Toaster>` added to root layout (`src/app/layout.tsx`)

---

## BUG-005: Missing Error Boundaries

### Symptom
Any unhandled error in a React component would crash the entire page to a blank screen with no recovery option.

### Fix
Added two error boundary components:

**`src/components/error-boundary.tsx`** — Root error boundary:
- Catches any unhandled React error
- Shows "Something went wrong" with the error message and a "Try again" button
- Wraps the entire app in `layout.tsx`

**`src/components/convex-error-boundary.tsx`** — Convex-aware boundary:
- Detects connection/network/Convex-specific errors by keyword
- Shows "Backend unreachable — check your connection" with both a soft retry and hard reload
- Falls back to generic "Something went wrong" for non-connection errors
- Wraps the `ConvexClientProvider` subtree

Both boundaries use shadcn/ui-compatible styling with appropriate icons.
