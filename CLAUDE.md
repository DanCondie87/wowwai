# WOWWAI — Claude Code Context

## What This Is
WOWWAI (Ways of Working With AI) — Personal project management + workflow control centre.
Kanban board + workflow visualizer. Built for Dan and his AI assistant Dali.

## Stack
- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend:** Convex (real-time database, HTTP actions, cron)
- **Auth:** Clerk (single user, ConvexProviderWithClerk)
- **DnD:** @dnd-kit/core + @dnd-kit/sortable
- **Theme:** shadcn/ui CSS variables + next-themes (light/dark, system preference)
- **Markdown:** react-markdown + rehype-sanitize
- **Hosting:** Vercel

## Commands
```bash
npm run dev          # Start Next.js dev server
npx convex dev       # Start Convex dev server (run alongside npm run dev)
npx shadcn@latest add <component>  # Add shadcn/ui component
```

## Project Structure
```
app/                 # Next.js App Router pages
  (auth)/            # Auth pages (sign-in, sign-up)
  board/             # Kanban board
  workflows/         # Workflow visualizer
  analytics/         # Analytics dashboard
  my-work/           # Cross-project task view
  settings/          # Export, preferences
components/          # Shared React components
  ui/                # shadcn/ui components
convex/              # Convex backend (schema, queries, mutations, HTTP actions)
lib/                 # Utilities, helpers, agent client
sync-agent/          # Local file sync agent (separate Node.js process)
scripts/             # Migration, backup scripts
docs/                # Integration docs
```

## Conventions
- All colors via CSS variables (shadcn tokens) — NEVER hardcode colors
- Mobile-first: design for phone, enhance for desktop
- All markdown rendering MUST use rehype-sanitize
- Every mutation that changes task state MUST create an audit log entry
- HTTP actions for agent API MUST verify x-agent-secret header
- Use shadcn/ui components wherever possible — don't build custom when shadcn has it

## Key Patterns
- Convex reactive queries for real-time UI updates
- ConvexProviderWithClerk for authenticated Convex access
- dnd-kit DndContext + SortableContext for kanban drag-and-drop
- shadcn/ui Sheet for card detail (side drawer desktop, full screen mobile)
- shadcn/ui Command for ⌘K palette
- shadcn/ui Accordion for workflow steps

## Environment Variables (.env.local)
```
NEXT_PUBLIC_CONVEX_URL=           # Convex deployment URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= # Clerk publishable key
CLERK_SECRET_KEY=                  # Clerk secret key
```

## Git
- Commit after each completed task
- Message format: `feat: US-XXX description`
- Push to origin/main after each commit
