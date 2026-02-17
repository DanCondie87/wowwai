# WOWWAI Sync Agent

Local Node.js agent that provides bi-directional file sync between the WOWWAI web UI and local markdown files.

## What It Does

- **Watches** local workflow and doc files for changes (via chokidar)
- **Pushes** file changes to Convex (creates `fileVersions` entries)
- **Pulls** UI edits from Convex (polls `fileSyncQueue`) and writes to local files
- **Validates** all file paths for safety (extension whitelist, root boundary check)

## Setup

### 1. Install dependencies

```bash
cd sync-agent
npm install
```

### 2. Install pm2 globally (if not already installed)

```bash
npm install -g pm2
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `CONVEX_SITE_URL` — Your Convex deployment site URL (e.g., `https://abc123.convex.site`)
- `AGENT_SECRET` — The shared secret matching your Convex `AGENT_SECRET` env var

### 4. Configure watch paths (optional)

Edit `config.json` to customize which directories are watched:

```json
{
  "watchPaths": ["../workflows", "../docs"],
  "allowedExtensions": [".md", ".json", ".yaml", ".txt"],
  "pollIntervalMs": 5000,
  "heartbeatIntervalMs": 60000
}
```

## Running

### Start with pm2

```bash
npm start
```

### Stop

```bash
npm stop
```

### View logs

```bash
npm run logs
```

### Development mode (auto-restart on code changes)

```bash
npm run dev
```

## How It Works

### File Watching (Push)
1. chokidar watches configured directories for file add/change events
2. On change: reads file content, calls `POST /sync/upsertFile` on Convex
3. Convex creates a new `fileVersions` entry

### Sync Queue (Pull)
1. Agent polls `GET /sync/getPending` every 5 seconds
2. For each pending "to-local" queue entry:
   - Validates the file path (must be within project root, allowed extension)
   - Creates parent directories if needed
   - Writes content to local file
   - Marks queue entry as "synced" (or "conflict" on error)

### Path Safety
- `resolveSafePath()` rejects paths outside the project root
- Only allows `.md`, `.json`, `.yaml`, `.txt` extensions
- Strips null bytes from paths
