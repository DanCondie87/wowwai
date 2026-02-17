# PRD: WOWWAI — Ways of Working With AI

## Introduction

WOWWAI is a personal project management + workflow control centre for Dan and his AI assistant Dali. It provides visual oversight of all work in progress via a Kanban board, plus a workflow visualizer that shows how work gets done — including referenced documents, loop controls, and inline editing that writes back to source files. Mobile-accessible from anywhere.

## Goals

- Give Dan real-time visual oversight of all projects, ideas, and tasks from his phone
- Track the full lifecycle: idea → requirements → tasks → subtasks → done
- Visualize workflow templates with step-by-step detail and inline document editing
- Enable AI agents to update task status in real-time as they work
- Provide audit trails, model usage history, and blocker tracking on every task
- Bi-directional sync between the web UI and local markdown files

## Technical Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix primitives)
- **Backend:** Convex (real-time database + HTTP actions)
- **Auth:** Clerk (single-user, session persistence on mobile)
- **DnD:** dnd-kit
- **UI Components:** shadcn/ui — Dialog, Sheet, Command, DropdownMenu, Accordion, Button, Input, Badge, Card, Tooltip, etc.
- **Markdown:** react-markdown + rehype-sanitize
- **Theme:** Tokenized design system (shadcn/ui CSS variables, light/dark, system preference)
- **Hosting:** Vercel (frontend) — no tunnel needed
- **Sync:** Local Node.js agent (chokidar + ConvexHttpClient)
- **Process:** pm2 (sync agent lifecycle)

## User Stories

---

### FOUNDATION

---

### US-001: Project Scaffolding
**Description:** As a developer, I want the project initialized with Next.js + Convex + TypeScript so that we have a working foundation.

**Acceptance Criteria:**
- [x] Next.js app created with App Router, TypeScript, Tailwind CSS
- [x] shadcn/ui initialized (`npx shadcn@latest init`) with default config
- [ ] Convex initialized (`npx convex dev` runs without errors)
- [x] Project structure: `app/`, `convex/`, `components/`, `lib/`, `public/`
- [x] CLAUDE.md created with project conventions (stack, commands, patterns)
- [x] Git repo initialized with .gitignore (includes .env*, node_modules, .next)
- [x] `npm run dev` starts the app at localhost:3000
- [x] Typecheck passes

### US-002: Tokenized Theme System
**Description:** As a user, I want a consistent design system with light/dark mode that respects system preferences so the app looks polished from the start.

**Acceptance Criteria:**
- [x] shadcn/ui CSS variables configured in `globals.css` for both light and dark themes: background, foreground, card, border, primary, secondary, muted, accent, destructive (and their foreground variants)
- [x] Dark mode via `class` strategy (Tailwind `darkMode: "class"`)
- [x] `next-themes` ThemeProvider wrapping the app with system preference detection + localStorage override
- [x] Theme toggle component (sun/moon icon) using shadcn/ui Button in the app header
- [x] All subsequent components use shadcn/ui tokens (e.g., `bg-primary`, `text-muted-foreground`) — no hardcoded colors
- [x] Typecheck passes
- [ ] Verify both themes render correctly in browser

### US-003: Clerk Authentication
**Description:** As a user, I want to log in so that only I can access my data.

**Acceptance Criteria:**
- [x] Clerk provider wraps the app in `app/layout.tsx`
- [x] Middleware protects all routes except `/sign-in` and `/sign-up`
- [x] Sign-in page at `/sign-in` using Clerk's `<SignIn />` component
- [x] User button (avatar + sign out) in the app header
- [x] Convex client authenticated via Clerk (uses `ConvexProviderWithClerk`)
- [x] Unauthenticated users redirected to sign-in
- [ ] Environment variables: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` in `.env.local`
- [x] Typecheck passes
- [ ] Verify sign-in flow works in browser

### US-004: Convex Schema — Projects & Ideas
**Description:** As a developer, I want the database schema for projects and ideas so that we can store and query them.

**Acceptance Criteria:**
- [x] `convex/schema.ts` defines `projects` table: name (string), slug (string), description (optional string), status ("active" | "archived"), color (string), createdAt (number)
- [x] `convex/schema.ts` defines `ideas` table: projectId (optional Id), title (string), description (optional string), tags (array of strings), status ("captured" | "exploring" | "ready" | "parked"), source ("dan" | "dali"), createdAt (number)
- [x] Indexes defined: projects by status, ideas by projectId, ideas by status
- [ ] `npx convex dev` deploys schema without errors
- [x] Typecheck passes

### US-005: Convex Schema — Tasks & Audit Logs
**Description:** As a developer, I want the database schema for tasks and audit logs so that we can track work items and their history.

**Acceptance Criteria:**
- [x] `tasks` table: projectId (Id), parentTaskId (optional Id), cardId (string), title (string), description (optional string), status ("backlog" | "todo" | "in-progress" | "review" | "done"), assignee ("dan" | "dali"), priority ("low" | "medium" | "high" | "urgent"), tags (array of strings), workflowTemplateId (optional Id), modelUsed (optional string), blockedBy (array of Ids), definitionOfDone (optional string), testingCriteria (optional string), figmaLink (optional string), position (number), sessionSummary (optional string), lastTouchedAt (number), createdAt (number), completedAt (optional number)
- [x] `auditLogs` table: taskId (Id), actor ("dan" | "dali" | "system"), action (string), before (optional string), after (optional string), comment (optional string), modelUsed (optional string), timestamp (number)
- [x] Indexes: tasks by projectId, tasks by status, tasks by assignee, tasks by parentTaskId, auditLogs by taskId
- [ ] `npx convex dev` deploys without errors
- [x] Typecheck passes

### US-006: Convex Schema — Workflows, File Sync, Agent Activity
**Description:** As a developer, I want the remaining schema tables so that the full data model is in place.

**Acceptance Criteria:**
- [x] `workflowTemplates` table: name (string), description (optional string), sourceFile (optional string), createdAt (number)
- [x] `workflowSteps` table: templateId (Id), name (string), description (string), order (number), loopGroupId (optional string), loopMaxIterations (optional number), loopExitCriteria (optional string), references (array of objects with type/label/filePath/section/content), modelRecommendation (optional string), agentType (optional string)
- [x] `fileVersions` table: filePath (string), content (string), editedBy (string), editedVia (string), snapshotName (optional string), timestamp (number)
- [x] `fileSyncQueue` table: filePath (string), content (string), direction (string), status (string), timestamp (number)
- [x] `agentActivity` table: taskId (optional Id), sessionKey (string), model (string), status (string), currentAction (optional string), startedAt (number), lastHeartbeat (number)
- [x] Indexes defined for all tables on primary lookup fields
- [ ] `npx convex dev` deploys without errors
- [x] Typecheck passes

### US-007: Project CRUD Mutations & Queries
**Description:** As a user, I want to create, read, update, and archive projects so that I can organize my work.

**Acceptance Criteria:**
- [x] `convex/projects.ts` — mutation `create`: takes name, slug, color, description; sets status="active", createdAt=Date.now()
- [x] `convex/projects.ts` — mutation `update`: takes id + partial fields, updates them
- [x] `convex/projects.ts` — mutation `archive`: sets status="archived"
- [x] `convex/projects.ts` — query `getAll`: returns all active projects
- [x] `convex/projects.ts` — query `getById`: returns single project by id
- [x] Auto-generate slug from name (lowercase, hyphens, no special chars)
- [x] Typecheck passes

### US-008: Task CRUD Mutations & Queries
**Description:** As a user, I want to create, read, update, move, and complete tasks so that I can manage work items.

**Acceptance Criteria:**
- [x] `convex/tasks.ts` — mutation `create`: takes projectId, title, description, assignee, priority, tags, status (default "backlog"); auto-generates cardId as `{PROJECT_SLUG}-{incrementing number}`; sets position, lastTouchedAt, createdAt
- [x] `convex/tasks.ts` — mutation `update`: takes id + partial fields, updates them, updates lastTouchedAt, creates audit log entry
- [x] `convex/tasks.ts` — mutation `moveToColumn`: takes id + new status + position; updates status + position + lastTouchedAt; creates audit log
- [x] `convex/tasks.ts` — mutation `reorder`: takes id + new position within same column
- [x] `convex/tasks.ts` — query `getByProject`: returns all tasks for a project, ordered by status then position
- [x] `convex/tasks.ts` — query `getByStatus`: returns all tasks with given status across all projects
- [x] `convex/tasks.ts` — query `getById`: returns single task with its subtasks (child tasks)
- [x] Typecheck passes

### US-009: Audit Log Mutations & Queries
**Description:** As a developer, I want audit log helpers so that every task change is recorded automatically.

**Acceptance Criteria:**
- [x] `convex/auditLogs.ts` — mutation `create`: takes taskId, actor, action, before, after, comment, modelUsed; sets timestamp
- [x] `convex/auditLogs.ts` — query `getByTask`: returns all audit logs for a task, ordered by timestamp descending
- [x] Task mutations from US-008 automatically create audit log entries on status changes, assignee changes, and field updates
- [x] Typecheck passes

---

### KANBAN BOARD UI

---

### US-010: App Layout Shell
**Description:** As a user, I want a responsive app layout with header, sidebar, and main content area so that I can navigate the app.

**Acceptance Criteria:**
- [x] App layout with: header (logo "WOWWAI", theme toggle, user button), collapsible sidebar (nav links: Board, Projects, Workflows), main content area
- [x] Sidebar collapses to icons on mobile (hamburger menu toggle)
- [x] Uses CSS variables from theme system throughout
- [x] Responsive: sidebar hidden by default on mobile, shown on desktop
- [x] Typecheck passes
- [ ] Verify layout renders correctly in browser (desktop + mobile viewport)

### US-011: Kanban Board — Column Layout
**Description:** As a user, I want to see my tasks organized in columns so that I can visualize work status at a glance.

**Acceptance Criteria:**
- [x] Board page at `/board` showing 6 columns: Ideas, Backlog, To Do, In Progress, Review, Done
- [x] Each column has: header with name + task count, scrollable card list, "+" add button at bottom
- [x] Columns scroll horizontally on desktop (all visible if screen is wide enough)
- [x] On mobile: swipe between columns (one column visible at a time with column name tabs at top)
- [x] Project filter dropdown above the board — filters all columns by selected project
- [x] Empty state: each column shows a subtle message when empty ("No tasks yet")
- [x] Typecheck passes
- [ ] Verify columns render with mock data in browser

### US-012: Task Card Component
**Description:** As a user, I want task cards that show key info at a glance so that I can scan the board quickly.

**Acceptance Criteria:**
- [x] Card component shows: project color strip (left border, 3px), card ID (e.g., "WOWWAI-42" in muted text), title (bold), assignee avatar (🦈 for dali, 👤 for dan), priority dot (green=low, blue=medium, orange=high, red=urgent)
- [x] Tags shown as small pills below title (max 3 visible, "+N" for overflow)
- [x] Subtask progress bar if task has children (visual bar, not just fraction)
- [x] 🔴 "BLOCKED" badge shown when blockedBy array is non-empty
- [x] Staleness indicator: green dot (<24h), yellow (1-3 days), orange (3-7 days), red (>7 days) based on lastTouchedAt
- [x] Card uses theme CSS variables, hover state with subtle elevation
- [x] Typecheck passes
- [ ] Verify card renders correctly with various data combinations in browser

### US-013: Drag and Drop Between Columns
**Description:** As a user, I want to drag tasks between columns so that I can update their status visually.

**Acceptance Criteria:**
- [x] dnd-kit installed and configured (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- [x] Cards are draggable within and between columns
- [x] Drag overlay shows a ghost of the card being dragged
- [x] Dropping a card in a new column calls `moveToColumn` mutation (updates status + position)
- [x] Reordering within a column calls `reorder` mutation
- [x] Touch-friendly: drag works on mobile with long-press to initiate
- [x] Visual feedback: column highlights when a card is dragged over it
- [x] Typecheck passes
- [ ] Verify drag and drop works in browser (desktop + mobile)

### US-014: Create Task Modal
**Description:** As a user, I want to create new tasks quickly so that I can capture work items.

**Acceptance Criteria:**
- [x] Clicking "+" on any column opens shadcn/ui `<Dialog>` (desktop) or `<Sheet>` (mobile)
- [x] Form fields using shadcn/ui components: title (Input, required), description (Textarea, optional), project (Select), assignee (dan/dali toggle via RadioGroup), priority (Select), tags (Input with comma handling)
- [x] Task created in the column where "+" was clicked (maps column to status)
- [x] On mobile: modal is a bottom sheet (slides up from bottom)
- [x] After creation: modal closes, new card appears in the column with animation
- [x] Typecheck passes
- [ ] Verify task creation works in browser

### US-015: Card Detail View
**Description:** As a user, I want to tap a card to see and edit all its details so that I can manage tasks fully.

**Acceptance Criteria:**
- [x] Clicking a card opens a detail panel (shadcn/ui `<Sheet>` as side drawer on desktop, full-screen sheet on mobile)
- [x] Detail view shows: card ID, title (editable inline), description (editable markdown textarea), status, assignee (toggleable), priority (dropdown), project, tags (editable), blockedBy list, definitionOfDone (editable textarea), testingCriteria (editable textarea), figmaLink (editable URL field)
- [x] Changes auto-save on field blur (with brief "Saved ✓" confirmation)
- [x] Close button returns to board
- [x] Typecheck passes
- [ ] Verify detail view opens and edits save in browser

### US-016: Subtask Display in Card Detail
**Description:** As a user, I want to see and create subtasks within a task so that I can break work into smaller pieces.

**Acceptance Criteria:**
- [x] Card detail view shows "Subtasks" section with list of child tasks (parentTaskId = this task's id)
- [x] Each subtask shows: title, status badge (colored pill), assignee avatar
- [x] "Add subtask" button opens an inline form (title + assignee) — creates task with parentTaskId set
- [x] Clicking a subtask navigates to its own detail view (with "← Back to parent" link)
- [x] Subtask count + progress bar visible on parent card in board view (from US-012)
- [x] Typecheck passes
- [ ] Verify subtask creation and display in browser

### US-017: Audit Trail in Card Detail
**Description:** As a user, I want to see a timeline of all changes to a task so that I have full history.

**Acceptance Criteria:**
- [ ] Card detail view shows "Activity" section at the bottom — chronological list of audit log entries
- [ ] Each entry shows: actor avatar, action description (human-readable, e.g., "Dali moved this to In Progress"), timestamp (relative, e.g., "2 hours ago")
- [ ] Status changes shown with colored badges (old → new)
- [ ] Comments displayed with full text in a distinct style
- [ ] Entries load from `auditLogs.getByTask` query
- [ ] Typecheck passes
- [ ] Verify audit trail renders in browser

### US-018: Blocker / Dependency Indicators
**Description:** As a user, I want to see and manage task dependencies so that I know what's blocked and why.

**Acceptance Criteria:**
- [ ] Card detail view shows "Blocked By" section listing tasks that block this one
- [ ] Each blocker shows: card ID, title, current status (colored badge), link to open that task
- [ ] "Add blocker" button: opens a search/select to pick a task from the same project
- [ ] Remove blocker: X button on each blocker entry
- [ ] When all blockers are "done", the 🔴 BLOCKED badge automatically disappears from the card
- [ ] Typecheck passes
- [ ] Verify blocker management in browser

### US-019: Session Summary Field
**Description:** As a user, I want to see AI-written work summaries on completed tasks so that I have a permanent narrative record.

**Acceptance Criteria:**
- [ ] Card detail view shows "Session Summary" section — a read-only markdown-rendered block
- [ ] Displayed prominently when task status is "done" and sessionSummary is populated
- [ ] Summary can also be edited manually (click to edit, save on blur)
- [ ] Field included in task update mutation
- [ ] Typecheck passes
- [ ] Verify session summary renders markdown correctly in browser

---

### SEARCH & NAVIGATION

---

### US-020: Global Search
**Description:** As a user, I want to search across all tasks so that I can find anything quickly.

**Acceptance Criteria:**
- [ ] `convex/search.ts` — query `searchTasks`: full-text search across task title, description, cardId; returns matching tasks with project info
- [ ] Convex search index defined on tasks table for title and description fields
- [ ] Search results show: card ID, title, project name, status badge, assignee
- [ ] Clicking a result opens the card detail view
- [ ] Typecheck passes

### US-021: Command Palette (⌘K)
**Description:** As a user, I want a keyboard-accessible command palette so that I can navigate and act quickly.

**Acceptance Criteria:**
- [ ] `⌘K` (Mac) / `Ctrl+K` (Windows) opens a modal search/command palette
- [ ] Uses shadcn/ui `<Command>` component (cmdk) for the palette UI
- [ ] Palette shows: search input at top, results below grouped by type (Tasks, Projects, Actions)
- [ ] Typing searches tasks by title/cardId (uses searchTasks from US-020)
- [ ] Action commands available: "Create task", "Go to Board", "Go to Projects", "Go to Workflows"
- [ ] Arrow keys navigate results, Enter selects, Escape closes
- [ ] On mobile: accessible via search icon in header (no keyboard shortcut)
- [ ] Typecheck passes
- [ ] Verify command palette works in browser

### US-022: Cross-Project "My Work" View
**Description:** As a user, I want to see all tasks assigned to me across all projects in one view.

**Acceptance Criteria:**
- [ ] "My Work" page at `/my-work` — shows tasks grouped by project
- [ ] `convex/tasks.ts` — query `getByAssignee`: returns all non-done tasks for a given assignee across all projects
- [ ] Each section: project name header + list of tasks (card component, compact version)
- [ ] Filter toggles: "Dan's tasks" / "Dali's tasks" / "All"
- [ ] Sort by: priority, staleness, project
- [ ] Typecheck passes
- [ ] Verify My Work page renders in browser

---

### TAGS & FILTERING

---

### US-023: Tag System
**Description:** As a user, I want to add and filter by tags so that I can categorize tasks flexibly.

**Acceptance Criteria:**
- [ ] Tags displayed as colored pills on cards (colors auto-assigned from a palette based on tag name hash)
- [ ] Tag input in card detail: type tag name, press Enter to add, X to remove
- [ ] Autocomplete: suggest existing tags as user types (query all unique tags across tasks)
- [ ] `convex/tasks.ts` — query `getAllTags`: returns distinct tag values across all tasks
- [ ] Typecheck passes
- [ ] Verify tag CRUD in browser

### US-024: Board Filter Bar
**Description:** As a user, I want to filter the board by project, assignee, tags, priority, and blocked status so that I can focus.

**Acceptance Criteria:**
- [ ] Filter bar above the board with: project dropdown, assignee toggle (Dan/Dali/All), priority multi-select, tag multi-select, "Show blocked only" toggle
- [ ] Filters apply to all columns simultaneously
- [ ] Active filter count shown as badge on filter bar
- [ ] "Clear filters" button resets all
- [ ] Filter state persisted in URL query params (shareable/bookmarkable)
- [ ] On mobile: filter bar collapses to a "Filter" button that opens a bottom sheet
- [ ] Typecheck passes
- [ ] Verify filtering works in browser

---

### SECURITY & INFRASTRUCTURE

---

### US-025: Agent API with Shared Secret Auth
**Description:** As a developer, I want authenticated HTTP endpoints so that AI agents can update tasks securely.

**Acceptance Criteria:**
- [ ] `convex/http.ts` defines HTTP routes for agent operations
- [ ] Every HTTP action checks `x-agent-secret` header against `AGENT_SECRET` environment variable
- [ ] Returns 401 Unauthorized if secret is missing or wrong
- [ ] Endpoints: `POST /agent/updateTask` (cardId, status, modelUsed, sessionSummary, comment), `POST /agent/createAuditLog` (taskId, actor, action, comment, modelUsed), `GET /agent/getTask` (cardId)
- [ ] `AGENT_SECRET` set as Convex environment variable (not in code)
- [ ] CORS headers: allow only Vercel frontend origin + localhost
- [ ] Typecheck passes

### US-026: Rate Limiting on Agent API
**Description:** As a developer, I want rate limiting on the agent API so that runaway loops can't spam the database.

**Acceptance Criteria:**
- [ ] Install `convex-helpers` package
- [ ] Rate limiter configured: 10 mutations/minute, burst to 20 (token bucket)
- [ ] Rate limit applied to all HTTP action endpoints from US-025
- [ ] Returns 429 Too Many Requests when limit exceeded
- [ ] Typecheck passes

### US-027: Content Security Headers
**Description:** As a developer, I want security headers so that XSS and injection attacks are mitigated.

**Acceptance Criteria:**
- [ ] `next.config.js` adds security headers: X-Content-Type-Options (nosniff), X-Frame-Options (DENY), X-XSS-Protection (1; mode=block), Content-Security-Policy (default-src 'self', connect-src Convex domains, script-src 'self' 'unsafe-inline', style-src 'self' 'unsafe-inline')
- [ ] All markdown rendering uses `rehype-sanitize` (installed, configured in a shared `<Markdown>` component)
- [ ] No raw `dangerouslySetInnerHTML` anywhere in codebase
- [ ] Typecheck passes

### US-028: Data Export
**Description:** As a user, I want to export my data so that I have a backup and am never locked in.

**Acceptance Criteria:**
- [ ] Settings page at `/settings` with "Export Data" section
- [ ] "Export as JSON" button: downloads full dump (projects, tasks, ideas, audit logs) as a single JSON file
- [ ] "Export as CSV" button: downloads tasks as CSV (cardId, title, project, status, assignee, priority, tags, createdAt, completedAt)
- [ ] `convex/export.ts` — query `getFullExport`: returns all tables data
- [ ] Typecheck passes
- [ ] Verify export downloads valid files in browser

---

### WORKFLOW VISUALIZER

---

### US-029: Workflow Template Queries
**Description:** As a developer, I want queries for workflow templates and steps so that the UI can display them.

**Acceptance Criteria:**
- [ ] `convex/workflows.ts` — query `getAllTemplates`: returns all workflow templates
- [ ] `convex/workflows.ts` — query `getTemplateWithSteps`: takes templateId, returns template + all its steps ordered by `order` field
- [ ] `convex/workflows.ts` — mutation `createTemplate`: takes name, description, sourceFile
- [ ] `convex/workflows.ts` — mutation `createStep`: takes templateId, name, description, order, loopGroupId, references, modelRecommendation, agentType
- [ ] Typecheck passes

### US-030: Workflow Seed Data
**Description:** As a user, I want our existing workflow templates pre-loaded so that the visualizer has content from day one.

**Acceptance Criteria:**
- [ ] Seed script (`convex/seed.ts`) or init mutation that creates our 3 workflow templates: "Code Project", "Research", "Self-Improving Skills"
- [ ] Each template populated with steps from the corresponding workflow files (`workflows/code-project.md`, `workflows/research.md`, `workflows/self-improving-skills.md`)
- [ ] Steps include: name, description, order, references (filePath + type), modelRecommendation, agentType
- [ ] Loop groups defined where applicable (e.g., build-test loop in code-project)
- [ ] Seed is idempotent (can run multiple times without duplicating)
- [ ] Typecheck passes

### US-031: Workflows List Page
**Description:** As a user, I want to browse my workflow templates so that I can select one to view.

**Acceptance Criteria:**
- [ ] Workflows page at `/workflows` showing all templates as cards
- [ ] Each card shows: name, description, step count, source file path (if set)
- [ ] Clicking a card navigates to `/workflows/[id]`
- [ ] Typecheck passes
- [ ] Verify workflows list renders in browser

### US-032: Vertical Pipeline Renderer
**Description:** As a user, I want to see a workflow as a vertical pipeline of steps so that I can understand the process at a glance.

**Acceptance Criteria:**
- [ ] Workflow detail page at `/workflows/[id]` shows template name + vertical list of steps
- [ ] Each step rendered as a collapsible card: step number, icon (based on type), name, status indicator
- [ ] Steps connected by a vertical line/connector between cards
- [ ] All steps start collapsed (show name + summary only)
- [ ] Clicking a step expands it accordion-style to show: description, agent type, model recommendation, references list
- [ ] Typecheck passes
- [ ] Verify pipeline renders in browser

### US-033: Loop Group Containers
**Description:** As a user, I want to see grouped steps that form a loop so that I understand iterative processes.

**Acceptance Criteria:**
- [ ] Steps with the same `loopGroupId` are visually grouped inside a container with tinted background
- [ ] Container header shows: 🔁 icon, loop name, max iterations, exit criteria
- [ ] Container is collapsible (collapsed: "🔁 Build & Refine Loop (3 steps)", expanded: shows nested steps)
- [ ] Steps inside the loop are slightly indented relative to non-loop steps
- [ ] Typecheck passes
- [ ] Verify loop container renders in browser

### US-034: Document Reference Display
**Description:** As a user, I want to see referenced documents in workflow steps so that I know what guides each step.

**Acceptance Criteria:**
- [ ] Each step's expanded view shows "References" section with listed documents
- [ ] Each reference shows: type icon (📄 for claude_md, 📝 for prompt_template, 📚 for library), label, file path
- [ ] [View] button on each reference: opens an inline expandable panel showing the file content (fetched from `fileVersions` table or loaded on demand)
- [ ] Content rendered as markdown (using sanitized Markdown component from US-027)
- [ ] If content not yet synced, show file path with "Not synced" indicator
- [ ] Typecheck passes
- [ ] Verify reference display in browser

### US-035: Inline Document Editing
**Description:** As a user, I want to edit referenced documents inline and save changes back to source files so that I can fine-tune workflows from the UI.

**Acceptance Criteria:**
- [ ] [Edit] button next to [View] on each document reference
- [ ] Clicking [Edit] transforms the preview panel into a textarea editor with markdown content
- [ ] Breadcrumb shows: "Editing: {filePath}" (or section if specified)
- [ ] Orange "Unsaved changes" indicator appears when content differs from saved version
- [ ] [Save] button: writes content to `fileSyncQueue` (direction: "to-local", status: "pending"), creates entry in `fileVersions`, shows "✅ Saved" confirmation
- [ ] [Cancel] button: reverts to view mode without saving
- [ ] On mobile: editor opens as full-screen bottom sheet
- [ ] Typecheck passes
- [ ] Verify edit + save flow in browser (saves to Convex — local sync tested separately)

### US-036: Document Version History
**Description:** As a user, I want to see the edit history of documents and restore previous versions so that I can undo mistakes.

**Acceptance Criteria:**
- [ ] Version badge on each document reference showing "v{N}" (count of fileVersions entries)
- [ ] Clicking the version badge opens a version history panel
- [ ] History shows: list of versions with timestamp, editedBy, editedVia
- [ ] Clicking a version shows its content in a read-only preview
- [ ] [Restore] button on any previous version: creates a new version with the old content, adds to fileSyncQueue
- [ ] Typecheck passes
- [ ] Verify version history in browser

---

### SYNC AGENT

---

### US-037: Sync Agent — File Watcher
**Description:** As a developer, I want a local Node.js agent that watches markdown files and pushes changes to Convex.

**Acceptance Criteria:**
- [ ] `sync-agent/` directory in project root with its own `package.json`
- [ ] Uses `chokidar` to watch configurable directories (default: workspace `workflows/`, `templates/`, project CLAUDE.md paths)
- [ ] On file change: reads file content, calls Convex HTTP action to upsert `fileVersions` entry
- [ ] Configurable watch paths via `sync-agent/config.json`
- [ ] Path safety: `resolveSafePath()` function that rejects paths outside allowed root, rejects non-allowed extensions (.md, .json, .yaml, .txt only), strips null bytes
- [ ] Logs every file change with timestamp + file path to console
- [ ] `AGENT_SECRET` loaded from `.env` file (not hardcoded)
- [ ] Typecheck passes (if using TypeScript) or linting passes

### US-038: Sync Agent — Pull from Convex
**Description:** As a developer, I want the sync agent to pull UI edits from Convex and write them to local files.

**Acceptance Criteria:**
- [ ] Agent polls `fileSyncQueue` (direction: "to-local", status: "pending") every 5 seconds
- [ ] For each pending entry: resolves safe path, writes content to local file, marks queue entry as "synced"
- [ ] Uses `resolveSafePath()` from US-037 for all write operations
- [ ] Creates parent directories if they don't exist
- [ ] Logs every write operation with timestamp + file path
- [ ] Error handling: if write fails, marks queue entry status as "conflict", logs error
- [ ] Typecheck/lint passes

### US-039: Sync Agent — Process Management
**Description:** As a developer, I want the sync agent to run reliably as a background process.

**Acceptance Criteria:**
- [ ] `pm2` ecosystem file (`sync-agent/ecosystem.config.js`) configured to run the agent
- [ ] `npm run start` in sync-agent starts via pm2
- [ ] pm2 configured for auto-restart on crash (max 10 restarts)
- [ ] Health check: agent logs a heartbeat every 60 seconds
- [ ] README.md in sync-agent/ with setup instructions (install, configure, start, stop, logs)
- [ ] Typecheck/lint passes

---

### AGENT INTEGRATION

---

### US-040: Subagent Task Update Flow
**Description:** As an AI agent, I want to update task status in Convex when I complete work so that the board reflects real-time progress.

**Acceptance Criteria:**
- [ ] `lib/agent-client.ts` — helper module that wraps Convex HTTP calls with auth header
- [ ] Functions: `updateTaskStatus(cardId, status, modelUsed, sessionSummary)`, `addAuditLog(cardId, actor, action, comment, modelUsed)`, `getTask(cardId)`
- [ ] Uses `CONVEX_SITE_URL` and `AGENT_SECRET` from environment
- [ ] Example usage documented in `docs/agent-integration.md` showing how a subagent would call these after completing a PRD task
- [ ] Typecheck passes

### US-041: TASKS.md Migration Script
**Description:** As a user, I want to import my existing TASKS.md into WOWWAI so that the board starts with real data.

**Acceptance Criteria:**
- [ ] `scripts/migrate-tasks.ts` — reads a TASKS.md file, parses sections and tasks
- [ ] Maps sections to projects: each "### Project Name" becomes a project
- [ ] Maps task status: `[x]` → "done", `[ ]` → "backlog", `[~]` → "in-progress"
- [ ] Preserves task titles and descriptions
- [ ] Creates tasks in Convex via HTTP actions (authenticated with AGENT_SECRET)
- [ ] Outputs summary: "Created X projects, Y tasks"
- [ ] Dry-run mode (`--dry-run`): prints what would be created without writing
- [ ] Typecheck passes

---

### NOTIFICATIONS

---

### US-042: WhatsApp Notification Helper
**Description:** As a developer, I want a reusable notification function so that WOWWAI can alert Dan via WhatsApp.

**Acceptance Criteria:**
- [ ] `lib/notifications.ts` — function `notifyDan(message: string)` that sends a WhatsApp message via OpenClaw's message tool pattern
- [ ] Notification content follows security rules: minimal info, no sensitive project details (e.g., "WOWWAI: 3 tasks need your input" not full task descriptions)
- [ ] Function is async, handles errors gracefully (logs but doesn't throw)
- [ ] Documented usage in `docs/notifications.md`
- [ ] Typecheck passes

### US-043: Blocker Notification Trigger
**Description:** As a user, I want to be notified when a task is blocked so that I can unblock it promptly.

**Acceptance Criteria:**
- [ ] When a task's `blockedBy` array becomes non-empty (via mutation), trigger a notification
- [ ] Convex scheduled function or mutation hook that detects blocked state change
- [ ] Notification text: "WOWWAI: {cardId} is blocked — needs your input"
- [ ] Only notifies if task is assigned to "dali" and blocker requires Dan's action
- [ ] Respects quiet hours: no notifications between 23:00–08:00 AEST
- [ ] Typecheck passes

---

### ANALYTICS

---

### US-044: Basic Analytics Queries
**Description:** As a user, I want basic analytics so that I can understand how work is progressing.

**Acceptance Criteria:**
- [ ] `convex/analytics.ts` — query `getCycleTime`: calculates average time from "todo" to "done" per project (using createdAt and completedAt)
- [ ] `convex/analytics.ts` — query `getThroughput`: counts tasks completed per week for the last 8 weeks
- [ ] `convex/analytics.ts` — query `getBlockerStats`: counts currently blocked tasks per project
- [ ] `convex/analytics.ts` — query `getModelUsage`: counts tasks completed per model (from modelUsed field)
- [ ] Typecheck passes

### US-045: Analytics Dashboard Page
**Description:** As a user, I want a dashboard showing key metrics so that I can track how we're working.

**Acceptance Criteria:**
- [ ] Analytics page at `/analytics` with 4 metric cards
- [ ] Card 1: "Average Cycle Time" — shows days from todo to done, per project
- [ ] Card 2: "Weekly Throughput" — simple bar chart showing tasks completed per week (last 8 weeks)
- [ ] Card 3: "Blocked Tasks" — count of currently blocked tasks with list
- [ ] Card 4: "Model Usage" — pie/donut chart showing task completions by AI model
- [ ] Charts use a lightweight library (recharts or similar)
- [ ] Responsive: cards stack vertically on mobile
- [ ] Typecheck passes
- [ ] Verify analytics page renders in browser

---

### AI-NATIVE FEATURES

---

### US-046: "What Should I Work On?" Button
**Description:** As a user, I want AI-powered priority recommendations so that I can make better decisions about what to focus on.

**Acceptance Criteria:**
- [ ] Button on Board page: "🤖 What should I work on?"
- [ ] Clicking it: sends current task state (open tasks, blocked tasks, priorities, staleness) to a Convex action that calls an AI model
- [ ] AI returns top 3 recommended tasks with reasoning (e.g., "Unblock WOWWAI-12 — it's been stuck 3 days and blocks 2 other tasks")
- [ ] Recommendations displayed in a modal/panel
- [ ] Typecheck passes
- [ ] Verify button and response display in browser

### US-047: AI Activity Presence Indicator
**Description:** As a user, I want to see when Dali is actively working on a task so that I know work is in progress.

**Acceptance Criteria:**
- [ ] `agentActivity` table populated by agent API: when a subagent starts working, it calls an HTTP action to set status "working" with currentAction text
- [ ] Board cards show a pulsing 🦈 indicator when agentActivity has an active "working" entry for that task
- [ ] Hovering/tapping the indicator shows: model being used, currentAction text, time started
- [ ] Activity auto-expires after 30 minutes of no heartbeat update (Convex cron job sets status to "idle")
- [ ] Typecheck passes
- [ ] Verify presence indicator in browser

---

### MOBILE POLISH

---

### US-048: Mobile Swipe Gestures on Cards
**Description:** As a mobile user, I want to swipe cards to quickly change their status so that I can manage tasks with one hand.

**Acceptance Criteria:**
- [ ] Swipe right on a card: moves it to the next column (e.g., "To Do" → "In Progress")
- [ ] Swipe left on a card: moves it to the previous column
- [ ] Swipe action shows a color-coded background (green for forward, orange for backward) with an arrow icon
- [ ] Haptic feedback hint via CSS animation (scale bounce on complete)
- [ ] Only active on mobile viewports (touch devices)
- [ ] Typecheck passes
- [ ] Verify swipe works on mobile viewport in browser

### US-049: Pull to Refresh
**Description:** As a mobile user, I want to pull down to refresh the board so that I can see the latest state.

**Acceptance Criteria:**
- [ ] Pull-to-refresh gesture on the board page triggers Convex query invalidation
- [ ] Loading spinner shown during refresh
- [ ] Works on both Board and My Work pages
- [ ] Only active on mobile/touch viewports
- [ ] Typecheck passes

---

### OFFLINE & RESILIENCE

---

### US-050: Service Worker for Offline Read
**Description:** As a user, I want the app to show cached data when offline so that I can still review my board without internet.

**Acceptance Criteria:**
- [ ] Next.js PWA setup with service worker (next-pwa or similar)
- [ ] Service worker caches the app shell (HTML, CSS, JS)
- [ ] Last known board state cached in IndexedDB (via Convex's offline support or custom cache)
- [ ] When offline: board renders from cache with "Offline — read only" banner at top
- [ ] Mutations disabled when offline (buttons grayed out with tooltip "You're offline")
- [ ] When back online: banner disappears, queries re-sync automatically
- [ ] Typecheck passes
- [ ] Verify offline mode in browser (DevTools → Network → Offline)

### US-051: Nightly Backup Script
**Description:** As a developer, I want automated nightly backups so that data is never lost.

**Acceptance Criteria:**
- [ ] `scripts/backup.ts` — exports all Convex data (projects, tasks, ideas, audit logs, workflow templates, workflow steps) as JSON
- [ ] Saves to `backups/backup-YYYY-MM-DD.json` in workspace
- [ ] Auto-deletes backups older than 30 days
- [ ] Windows Task Scheduler instruction in README for nightly execution
- [ ] Script uses AGENT_SECRET for authenticated Convex HTTP calls
- [ ] Typecheck passes

---

### KEYBOARD SHORTCUTS (DESKTOP)

---

### US-052: Keyboard Shortcuts
**Description:** As a desktop user, I want keyboard shortcuts so that I can navigate and act without reaching for the mouse.

**Acceptance Criteria:**
- [ ] Global keyboard listener (disabled when input/textarea is focused)
- [ ] Shortcuts: `n` (new task in current/first column), `e` (edit selected card), `j`/`k` (navigate between cards), `→`/`←` (move selected card to next/previous column), `/` (focus search), `g b` (go to board), `g w` (go to workflows), `g a` (go to analytics)
- [ ] `?` opens a shortcuts help modal listing all shortcuts
- [ ] Selected card has a visible focus ring
- [ ] Typecheck passes
- [ ] Verify shortcuts work in browser

---

### DEPLOYMENT & GITHUB

---

### US-053: GitHub Repo & Vercel Deployment
**Description:** As a developer, I want the project on GitHub and deployed to Vercel so that it's accessible from anywhere.

**Acceptance Criteria:**
- [ ] GitHub repo created at `DanCondie87/wowwai`
- [ ] All code pushed to `main` branch
- [ ] Vercel project connected to GitHub repo (auto-deploy on push)
- [ ] Environment variables configured in Vercel: Clerk keys, Convex URL, Convex deploy key
- [ ] Production URL accessible and shows login page
- [ ] README.md with: project description, setup instructions (local dev + Convex + Clerk), deployment notes
- [ ] Typecheck passes
- [ ] Verify production URL loads and auth works

---

## Non-Goals

- Native mobile app (we use responsive web, not React Native)
- Multi-user collaboration (single user: Dan, with AI agent Dali)
- Real-time collaborative editing (only one person edits a document at a time)
- Full n8n-style node canvas (we use vertical pipeline)
- Email-to-task (future consideration)
- Calendar integration (future consideration)
- Semantic/vector search (future — standard full-text search first)

## Technical Considerations

- **Convex free tier:** 1M function calls/month — sufficient for personal use
- **Convex 1MB doc limit:** Large files stored as references (path only), content loaded on demand
- **dnd-kit:** Use `@dnd-kit/sortable` for within-column reordering, `@dnd-kit/core` for cross-column moves
- **Clerk free tier:** 10,000 MAU — more than sufficient
- **rehype-sanitize:** Must be used on ALL markdown rendering — no exceptions
- **Theme tokens:** All colors via CSS custom properties, no hardcoded values anywhere
- **Mobile-first:** Design for phone viewport first, enhance for desktop

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-17 | Initial PRD — full feature set across all phases | Dali 🦈 |
