# WOWWAI — Ways of Working With AI

Personal project management and workflow control centre. Kanban board + workflow visualizer built for Dan and his AI assistant Dali.

## Features

- **Kanban Board** — Drag-and-drop task management across 5 status columns
- **Workflow Visualizer** — Vertical pipeline renderer with step-by-step detail
- **Real-time Updates** — Convex reactive queries for instant UI sync
- **AI Agent Integration** — HTTP API for AI subagents to update tasks
- **Mobile-first** — Swipe gestures, pull-to-refresh, responsive layout
- **Analytics Dashboard** — Cycle time, throughput, blocker stats, model usage
- **AI Recommendations** — "What should I work on?" priority scoring
- **Keyboard Shortcuts** — Full keyboard navigation (`?` for help)
- **PWA Support** — Offline read mode with service worker caching
- **Dark Mode** — System preference detection with manual toggle

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend:** Convex (real-time database, HTTP actions, scheduled functions)
- **Auth:** Clerk (single user)
- **DnD:** @dnd-kit/core + @dnd-kit/sortable
- **Charts:** Recharts
- **Markdown:** react-markdown + rehype-sanitize

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/DanCondie87/wowwai.git
cd wowwai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your keys:
#   NEXT_PUBLIC_CONVEX_URL=
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
#   CLERK_SECRET_KEY=

# Start Convex dev server (in one terminal)
npx convex dev

# Start Next.js dev server (in another terminal)
npm run dev
```

Open http://localhost:3000 to see the app.

### Convex Setup

```bash
# Initialize Convex (first time only)
npx convex init

# Deploy schema and functions
npx convex dev

# Set Convex environment variables
npx convex env set AGENT_SECRET your-secret-here
```

### Sync Agent (optional)

The sync agent watches local markdown files and syncs them with Convex.

```bash
cd sync-agent
npm install
cp .env.example .env
# Edit .env with CONVEX_SITE_URL and AGENT_SECRET
npm start
```

## Deployment (Vercel)

### Environment Variables

Set these in Vercel project settings:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

### Convex Production

```bash
npx convex deploy
npx convex env set AGENT_SECRET your-production-secret
```

### Build

```bash
npm run build
```

## Project Structure

```
src/
  app/                   # Next.js App Router pages
    (app)/               # Authenticated app pages
      board/             # Kanban board
      workflows/         # Workflow visualizer
      analytics/         # Analytics dashboard
      my-work/           # Cross-project task view
      settings/          # Export, preferences
    (auth)/              # Auth pages (sign-in, sign-up)
  components/            # React components
    kanban/              # Kanban board components
    workflow/            # Workflow visualizer components
    ui/                  # shadcn/ui components
  hooks/                 # Custom React hooks
  lib/                   # Utilities, helpers
convex/                  # Convex backend
scripts/                 # Migration & backup scripts
sync-agent/              # Local file sync agent
docs/                    # Integration documentation
public/                  # Static assets, PWA manifest
```

## Scripts

```bash
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run start            # Start production server
npx convex dev           # Start Convex dev server
npx tsx scripts/backup.ts              # Manual backup
npx tsx scripts/migrate-tasks.ts       # Import TASKS.md
```

## Keyboard Shortcuts

Press `?` on the board to see all shortcuts. Key ones:

| Key | Action |
|-----|--------|
| `n` | New task |
| `j` / `k` | Navigate cards |
| `g b` | Go to Board |
| `g w` | Go to Workflows |
| `g a` | Go to Analytics |
| `Cmd+K` | Command palette |
| `?` | Show shortcuts help |
