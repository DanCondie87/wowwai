# WOWWAI Frontend Review — FRONT-001

> **Branch:** security/critical-fixes  
> **Date:** February 2026  
> **Reviewer:** Dali (subagent)  
> **Scope:** src/components/**, src/app/**/page.tsx, loading/error states, accessibility

---

## TL;DR

The frontend is generally well-structured and avoids the most common XSS pitfalls. The biggest concerns are: **no error boundaries** (Convex failures cause infinite loading with no feedback), **missing form labels on the login page** (WCAG fail), **silent mutation failures** (no user feedback when Convex writes fail), and **loading states are text-only** (no skeletons).

---

## 1. XSS & Security

### ✅ No `dangerouslySetInnerHTML` usage
Search of all `src/**/*.tsx` and `src/**/*.ts` found **zero** instances of `dangerouslySetInnerHTML`, `innerHTML`, `eval()`, or `document.write`.

### ✅ Markdown component correctly sanitised
**`src/components/ui/markdown.tsx:12`**

```tsx
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {children}
</ReactMarkdown>
```

`rehype-sanitize` uses the default GitHub-compatible schema by default, which:
- Strips `<script>` tags ✅
- Strips `javascript:` hrefs ✅
- Strips `on*` event attributes ✅
- Strips `<iframe>`, `<object>`, `<embed>` ✅

**Action required:** None — sanitization is correct as shipped.

**Note:** Session summary (`card-detail-sheet.tsx:336`) and workflow step descriptions render via `<Markdown>`, which is safe.

### ⚠️ Input validation gaps (LOW severity)

**`src/components/kanban/create-task-dialog.tsx:76–94`**  
Task creation validates `title.trim()` and `projectId` presence, but:
- No max-length on `title` (stored as plain string in Convex — schema should enforce)
- Tags parsed via `split(",")` — no individual tag length limit
- No validation that `projectId` is a valid Convex ID format (relies entirely on TypeScript)

**`src/components/kanban/card-detail-sheet.tsx:267`**  
`EditableField` for `figmaLink` uses `type="url"` which validates format client-side, but:
- No length limit
- Validation is not re-applied on blur — any URL format is stored as-is
- `javascript:` URLs are blocked by `type="url"` in modern browsers but could be bypassed if rendered as an `<a href>` elsewhere

**Action:** Add Convex schema `v.string().max(500)` (or similar) for `title` and tag strings. Check where `figmaLink` is rendered — if rendered as `<a href>`, add `rel="noopener noreferrer"` and sanitize `javascript:` scheme.

### ✅ Audit trail — no raw HTML rendering
**`src/components/kanban/audit-trail.tsx:98–140`**  
`log.comment`, `log.modelUsed`, `log.actor`, `log.before`, `log.after` are all rendered as React text nodes (via `{text}`, `{log.comment}`, etc.) — not as HTML. React escapes all of these. ✅

### ✅ Command palette — search results safely rendered
**`src/components/command-palette.tsx:118–130`**  
`task.title`, `task.cardId`, `task.status` rendered as text nodes inside `<span>`. ✅

---

## 2. Accessibility

### 🔴 Login page — missing label (WCAG 1.3.1 fail)
**`src/app/login/page.tsx:36`**

```tsx
<input
  type="password"
  value={password}
  placeholder="Password"
  ...
/>
```

The password input has **no `<label>` element** and relies entirely on `placeholder`. Placeholder text is not a label equivalent — it disappears on input and has poor screen reader support for some AT combinations. This is a WCAG 1.3.1 (Level A) failure.

**Fix:**
```tsx
<label htmlFor="password" className="sr-only">Password</label>
<input id="password" type="password" ... />
```

### 🔴 Sidebar close button — no accessible name
**`src/components/app-sidebar.tsx:38–40`**

```tsx
<Button variant="ghost" size="icon" onClick={onClose}>
  <X className="h-5 w-5" />
</Button>
```

Icon-only button with no `sr-only` text and no `aria-label`. Screen readers will announce this as an unlabeled button.

**Fix:** Add `<span className="sr-only">Close sidebar</span>` or `aria-label="Close sidebar"`.

### 🟠 Color-only status indicators — unreliable for screen readers
**`src/components/kanban/task-card.tsx:75–80`**

```tsx
<span
  className={cn("h-2 w-2 rounded-full", getStalenessColor(task.lastTouchedAt))}
  title={getStalenessLabel(task.lastTouchedAt)}
/>
<span
  className={cn("h-2 w-2 rounded-full", PRIORITY_COLORS[task.priority])}
  title={`Priority: ${task.priority}`}
/>
```

Both staleness and priority dots use color only, with `title` for supplemental info. `title` attributes:
- Are not accessible to keyboard-only users (no focus for `<span>`)
- Are not reliably announced by screen readers on non-interactive elements

**Fix:** Add `aria-label` to each dot:
```tsx
<span
  role="img"
  aria-label={getStalenessLabel(task.lastTouchedAt)}
  className={...}
/>
<span
  role="img"
  aria-label={`Priority: ${task.priority}`}
  className={...}
/>
```

### 🟠 Create task dialog — unlabelled Select components
**`src/components/kanban/create-task-dialog.tsx:100–140`**

Project, Assignee, and Priority `<Select>` components have visible `<label>` text above them but no `htmlFor`/`id` association:

```tsx
<label className="text-sm font-medium text-foreground">Project</label>
<Select value={projectId} onValueChange={setProjectId}>
```

`<label>` without `htmlFor` does not associate with the select trigger. AT won't read "Project" when the select is focused.

**Fix:** Add `id` to `SelectTrigger` and `htmlFor` to `<label>`, or use `aria-label` on the trigger. Example:
```tsx
<label htmlFor="task-project" ...>Project</label>
<Select>
  <SelectTrigger id="task-project">
```

Note: shadcn `SelectTrigger` renders a `<button>` — use `aria-label` as the practical fix:
```tsx
<SelectTrigger aria-label="Select project">
```

### 🟠 Mobile kanban tabs — missing tab semantics
**`src/components/kanban/kanban-board.tsx:127–141`**

The mobile column switcher renders plain `<button>` elements with no `role="tab"`, `aria-selected`, or `role="tablist"` wrapper:

```tsx
<div className="flex border-b lg:hidden overflow-x-auto">
  {COLUMNS.map((col, idx) => (
    <button key={col.id} onClick={() => setActiveColumnIndex(idx)} ...>
```

This is a tab interface without ARIA tab semantics. Screen readers won't announce it as a tab group.

**Fix:**
```tsx
<div role="tablist" aria-label="Kanban columns" className="flex border-b lg:hidden overflow-x-auto">
  <button role="tab" aria-selected={idx === activeColumnIndex} aria-controls={`panel-${col.id}`} ...>
```

### 🟡 Theme toggle — no current state announcement
**`src/components/theme-toggle.tsx:10–17`**

```tsx
<Button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
  <Sun ... />
  <Moon ... />
  <span className="sr-only">Toggle theme</span>
</Button>
```

`sr-only` text says "Toggle theme" without indicating the *current* state or the *result* of clicking. A screen reader user doesn't know if they're switching to dark or light.

**Fix:** Use dynamic `sr-only` text:
```tsx
<span className="sr-only">
  Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
</span>
```

### 🟡 Card detail sheet — editable title loses label context
**`src/components/kanban/card-detail-sheet.tsx:178–196`**

When `editing` is true, `EditableTitle` renders an `<Input>` without any label:
```tsx
<Input value={draft} onChange={...} autoFocus className="text-lg font-semibold" />
```

**Fix:** Add `aria-label="Task title"` to the Input.

### 🟡 Keyboard navigation — @dnd-kit keyboard support present but undocumented
**`src/components/kanban/kanban-board.tsx:35–48`**

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
);
```

`KeyboardSensor` from `@dnd-kit/core` is **not included** in the sensors array. This means the drag-and-drop interaction is **not keyboard accessible**. While `j/k` keyboard shortcuts exist for card navigation and `←/→` for column movement, these are custom shortcuts that require knowledge of the app (documented only in the keyboard shortcuts dialog).

The `SortableTaskCard` uses `useSortable`'s `attributes` and `listeners` which include ARIA props when `KeyboardSensor` is active — but without the sensor, drag-and-drop is mouse/touch only.

**Fix:** Add `KeyboardSensor`:
```tsx
import { KeyboardSensor } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
```

### ✅ Things that are correct

- `app-header.tsx`: Menu, Search, and Logout buttons all have `sr-only` text ✅
- `agent-activity-indicator.tsx:27`: has `aria-label="AI agent is working"` ✅
- `task-card.tsx:34–39`: uses `role="button"`, `tabIndex={0}`, and handles `Enter`/`Space` keydown ✅
- `create-task-dialog.tsx:96–97`: title and description inputs have proper `id`/`label` associations ✅
- `kanban-column.tsx:51`: column header uses `<h3>` ✅
- `card-detail-sheet.tsx`: uses `SheetTitle` and `SheetDescription` (radix-ui focus trap, ESC key, ARIA) ✅
- `create-task-dialog.tsx`: uses `DialogTitle` and `DialogDescription` ✅

---

## 3. Error States

### 🔴 No error boundaries — Convex failures cause infinite loading
**`src/app/(app)/board/page.tsx`, `src/app/(app)/my-work/page.tsx`**

All pages use `useQuery` from Convex. When a query is loading, it returns `undefined`. When it **fails** (Convex down, network error), it also returns `undefined` — the same as loading. There is no way to distinguish "loading" from "failed" using `useQuery` alone without inspecting the Convex client state.

`board/page.tsx:107–110`:
```tsx
<KanbanBoard
  projects={projects ?? []}
  tasks={filteredTasks}
  isLoading={projects === undefined || tasks === undefined}
```

If Convex is down, `isLoading` stays `true` forever → "Loading board..." text forever.

`my-work/page.tsx:94–98`:
```tsx
if (tasks === undefined || projects === undefined) {
  return <div>Loading...</div>;
}
```

Same problem — indefinite loading spinner.

**Fix options:**
1. Add a global Convex error boundary using `ConvexError` from Convex SDK
2. Add a timeout-based "Convex appears to be down" message after ~10s
3. Use `useConvexQueryState` (if available in convex version) or wrap in error boundary

Recommended: Add a React error boundary at the `(app)/layout.tsx` level that catches Convex errors and shows a "Connection error — please refresh" banner.

### 🟠 Auth failure — no explicit error page
If the session cookie is valid but the user is somehow de-authenticated at the Convex level (e.g., future auth propagation), there's no error state — Convex queries simply return `undefined` (see above). The app shows infinite loading.

**`src/components/convex-provider.tsx:10–15`**:
```tsx
if (!convexUrl) {
  return <>{children}</>;
}
```

If `NEXT_PUBLIC_CONVEX_URL` is missing in production, children render without Convex. All `useQuery` calls return `undefined` permanently — same infinite loading problem with no warning.

**Fix:** Show an explicit error if `convexUrl` is falsy:
```tsx
if (!convexUrl) {
  if (process.env.NODE_ENV === "development") {
    return <div>Error: NEXT_PUBLIC_CONVEX_URL is not set</div>;
  }
  return <>{children}</>; // or show error boundary
}
```

### 🟠 Mutation failures are silent
**`src/components/kanban/create-task-dialog.tsx:68–77`**:
```tsx
async function handleSubmit(e: FormEvent) {
  setIsSubmitting(true);
  try {
    await createTask({ ... });
    onOpenChange(false);
  } finally {
    setIsSubmitting(false);
  }
}
```

If `createTask` throws (Convex error, validation failure, network error), the dialog closes or stays open with `isSubmitting = false` — **no error message is shown to the user**.

**`src/components/kanban/card-detail-sheet.tsx:62–71`**:
```tsx
async function handleFieldBlur(field, value) {
  await updateTask({ id: taskId, [field]: value });
  showSaved();
}
```

No try/catch — if the mutation fails, `showSaved()` still shows "Saved" even though the save failed. The user thinks their edit was saved when it wasn't.

**Fix:** Wrap mutations in try/catch and display error state (toast or inline error):
```tsx
try {
  await updateTask({ ... });
  showSaved();
} catch (err) {
  showError("Failed to save — please try again");
}
```

### 🟡 Audit trail — failed query shows misleading empty state
**`src/components/kanban/audit-trail.tsx:71–76`**:
```tsx
if (!logs || logs.length === 0) {
  return <p>No activity yet</p>;
}
```

If the `auditLogs.getByTask` query fails, `logs` is `undefined` → shows "No activity yet" — which is factually incorrect. User may think no actions have been taken on the task.

**Fix:** Distinguish between `undefined` (loading/error) and `[]` (genuinely empty):
```tsx
if (logs === undefined) return <p>Loading activity...</p>;
if (logs.length === 0) return <p>No activity yet</p>;
```

### ✅ Login page error handling is correct
**`src/app/login/page.tsx:30–40`**: Catches network errors, displays server-returned error messages, clears password on failure. ✅

---

## 4. Loading States

### 🟡 No skeleton loading — all loading states are text
Every loading state in the app uses a text message, not a skeleton:

| Component | File | Loading UI |
|-----------|------|------------|
| Board | `board/page.tsx` → `kanban-board.tsx:114` | `"Loading board..."` text |
| My Work | `my-work/page.tsx:94` | `"Loading..."` text |
| Card Detail | `card-detail-sheet.tsx:173` | `"Loading task..."` text |
| Audit Trail | `audit-trail.tsx:71` | Shows nothing / empty state |

This causes **content pop-in** — the layout shifts from a text message to a full board in one jump. No progressive disclosure of loading progress.

**Recommended improvements (low priority for single-user app):**
- `kanban-board.tsx`: Replace "Loading board..." with 3 skeleton columns (5–6 skeleton cards each)
- `card-detail-sheet.tsx`: Replace "Loading task..." with field-level skeleton lines
- `my-work/page.tsx`: Replace "Loading..." with task row skeletons

shadcn has a `Skeleton` component available — use `import { Skeleton } from "@/components/ui/skeleton"` (may need to add via `npx shadcn add skeleton`).

### ✅ Convex reactive queries auto-refresh
The board and task list use Convex reactive queries — changes by other clients (or the sync agent) update the UI automatically without manual refresh. `PullToRefresh` wrapper exists for mobile UX even though it's not strictly needed for data freshness. ✅

---

## 5. Summary & Priority Matrix

| # | Issue | Severity | File | Fix Complexity |
|---|-------|----------|------|----------------|
| 1 | Login input has no `<label>` | 🔴 High (WCAG A) | `login/page.tsx:36` | 5 min |
| 2 | Sidebar close button has no accessible name | 🔴 High (WCAG A) | `app-sidebar.tsx:38` | 5 min |
| 3 | No error boundaries — Convex failures look like infinite loading | 🔴 High (UX) | `(app)/layout.tsx` | 30 min |
| 4 | Mutation failures are silent (create task, update field) | 🟠 Medium | `create-task-dialog.tsx`, `card-detail-sheet.tsx` | 30 min |
| 5 | DnD is not keyboard accessible (no KeyboardSensor) | 🟠 Medium (WCAG) | `kanban-board.tsx:35` | 15 min |
| 6 | Create task selects (Project/Assignee/Priority) not labelled | 🟠 Medium (WCAG) | `create-task-dialog.tsx:100` | 15 min |
| 7 | Color-only priority/staleness dots — no screen reader text | 🟠 Medium (WCAG) | `task-card.tsx:75` | 10 min |
| 8 | Mobile kanban tabs missing tab ARIA semantics | 🟡 Low | `kanban-board.tsx:127` | 20 min |
| 9 | Theme toggle doesn't announce current/resulting state | 🟡 Low | `theme-toggle.tsx:13` | 5 min |
| 10 | Audit trail shows "No activity" on query failure | 🟡 Low | `audit-trail.tsx:71` | 10 min |
| 11 | No skeleton loading states | 🟡 Low (UX) | Multiple | 2–4 hours |
| 12 | No input length limits on task title/tags | 🟡 Low | `create-task-dialog.tsx:77` | 15 min |
| 13 | Editable title Input has no aria-label when editing | 🟡 Low | `card-detail-sheet.tsx:183` | 5 min |
| 14 | `convex-provider.tsx` renders silently if URL missing | 🟡 Low | `convex-provider.tsx:10` | 5 min |

---

## Quick Wins (Fix in < 1 hour total)

Items 1, 2, 7, 9, 13 can all be resolved in under an hour of focused work. Items 1 and 2 are WCAG Level A failures and should be fixed before any public launch.
