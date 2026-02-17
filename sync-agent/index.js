import { watch } from "chokidar";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname, extname, relative } from "path";
import { config as dotenvConfig } from "dotenv";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const agentConfig = require("./config.json");

// Load .env from sync-agent directory
dotenvConfig({ path: resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), ".env") });

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL;
const AGENT_SECRET = process.env.AGENT_SECRET;

if (!CONVEX_SITE_URL || !AGENT_SECRET) {
  console.error("[sync-agent] Missing CONVEX_SITE_URL or AGENT_SECRET in .env");
  process.exit(1);
}

const ALLOWED_EXTENSIONS = new Set(agentConfig.allowedExtensions);
const POLL_INTERVAL = agentConfig.pollIntervalMs;
const HEARTBEAT_INTERVAL = agentConfig.heartbeatIntervalMs;

// Resolve the project root (parent of sync-agent/)
const AGENT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const PROJECT_ROOT = resolve(AGENT_DIR, "..");

function timestamp() {
  return new Date().toISOString();
}

/**
 * Path safety: reject paths outside allowed root and non-allowed extensions.
 * Strips null bytes.
 */
function resolveSafePath(filePath) {
  // Strip null bytes
  const cleaned = filePath.replace(/\0/g, "");
  const resolved = resolve(PROJECT_ROOT, cleaned);

  // Must be within project root
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`Path outside allowed root: ${filePath}`);
  }

  // Must have allowed extension
  const ext = extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Extension not allowed: ${ext} (${filePath})`);
  }

  return resolved;
}

async function callConvex(path, method, body) {
  const url = `${CONVEX_SITE_URL}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": AGENT_SECRET,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// --- File Watcher (US-037) ---

function startFileWatcher() {
  const watchPaths = agentConfig.watchPaths.map((p) =>
    resolve(AGENT_DIR, p)
  );

  console.log(`[${timestamp()}] [sync-agent] Watching paths:`);
  watchPaths.forEach((p) => console.log(`  - ${p}`));

  const watcher = watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 },
  });

  watcher.on("change", async (filePath) => {
    await handleFileChange(filePath, "change");
  });

  watcher.on("add", async (filePath) => {
    await handleFileChange(filePath, "add");
  });

  watcher.on("error", (error) => {
    console.error(`[${timestamp()}] [sync-agent] Watcher error:`, error.message);
  });

  return watcher;
}

async function handleFileChange(filePath, event) {
  try {
    const ext = extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return;

    const relativePath = relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
    console.log(`[${timestamp()}] [sync-agent] File ${event}: ${relativePath}`);

    const content = await readFile(filePath, "utf-8");

    await callConvex("/sync/upsertFile", "POST", {
      filePath: relativePath,
      content,
      editedBy: "local-file",
    });

    console.log(`[${timestamp()}] [sync-agent] Synced to Convex: ${relativePath}`);
  } catch (error) {
    console.error(`[${timestamp()}] [sync-agent] Error syncing ${filePath}:`, error.message);
  }
}

// --- Pull from Convex (US-038) ---

async function pollSyncQueue() {
  try {
    const items = await callConvex("/sync/getPending", "GET");

    for (const item of items) {
      try {
        const safePath = resolveSafePath(item.filePath);

        // Create parent directories if they don't exist
        const dir = dirname(safePath);
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }

        await writeFile(safePath, item.content, "utf-8");
        console.log(`[${timestamp()}] [sync-agent] Wrote to local: ${item.filePath}`);

        await callConvex("/sync/markSynced", "POST", {
          id: item._id,
          status: "synced",
        });
      } catch (error) {
        console.error(
          `[${timestamp()}] [sync-agent] Error writing ${item.filePath}:`,
          error.message
        );

        // Mark as conflict
        try {
          await callConvex("/sync/markSynced", "POST", {
            id: item._id,
            status: "conflict",
          });
        } catch (markError) {
          console.error(
            `[${timestamp()}] [sync-agent] Failed to mark conflict:`,
            markError.message
          );
        }
      }
    }
  } catch (error) {
    console.error(`[${timestamp()}] [sync-agent] Poll error:`, error.message);
  }
}

// --- Heartbeat ---

function logHeartbeat() {
  console.log(`[${timestamp()}] [sync-agent] Heartbeat — running`);
}

// --- Main ---

console.log(`[${timestamp()}] [sync-agent] Starting...`);
console.log(`[${timestamp()}] [sync-agent] Convex URL: ${CONVEX_SITE_URL}`);
console.log(`[${timestamp()}] [sync-agent] Project root: ${PROJECT_ROOT}`);

const watcher = startFileWatcher();

// Poll sync queue every POLL_INTERVAL
setInterval(pollSyncQueue, POLL_INTERVAL);

// Heartbeat every HEARTBEAT_INTERVAL
setInterval(logHeartbeat, HEARTBEAT_INTERVAL);

// Initial poll
pollSyncQueue();

// Initial heartbeat
logHeartbeat();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(`[${timestamp()}] [sync-agent] Shutting down...`);
  watcher.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(`[${timestamp()}] [sync-agent] Shutting down...`);
  watcher.close();
  process.exit(0);
});
