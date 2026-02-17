#!/usr/bin/env npx tsx
/**
 * US-051: Nightly Backup Script
 *
 * Exports all Convex data (projects, tasks, ideas, audit logs, workflow
 * templates, workflow steps) as JSON and saves to backups/ directory.
 * Auto-deletes backups older than 30 days.
 *
 * Usage:
 *   npx tsx scripts/backup.ts
 *
 * Schedule with Windows Task Scheduler:
 *   schtasks /create /tn "WOWWAI Nightly Backup" /tr "npx tsx C:\path\to\scripts\backup.ts" /sc daily /st 02:00
 *
 * Environment:
 *   CONVEX_SITE_URL — Convex site URL (e.g. https://your-deployment.convex.site)
 *   AGENT_SECRET    — Shared secret for agent API auth
 */

import * as fs from "fs";
import * as path from "path";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL ?? "";
const AGENT_SECRET = process.env.AGENT_SECRET ?? "";
const BACKUP_DIR = path.resolve(__dirname, "..", "backups");
const MAX_AGE_DAYS = 30;

async function main() {
  if (!CONVEX_SITE_URL || !AGENT_SECRET) {
    console.error("Error: CONVEX_SITE_URL and AGENT_SECRET must be set");
    console.error("Set these in your environment or .env file");
    process.exit(1);
  }

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const filename = `backup-${dateStr}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`\nWOWWAI Backup — ${dateStr}`);
  console.log(`Target: ${filepath}\n`);

  try {
    console.log("  Fetching all data from Convex...");

    const response = await fetch(`${CONVEX_SITE_URL}/agent/backup`, {
      headers: { "x-agent-secret": AGENT_SECRET },
    });

    if (response.status === 401) {
      console.error("Error: Invalid AGENT_SECRET");
      process.exit(1);
    }

    if (!response.ok) {
      console.error(`Error: HTTP ${response.status} — ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();

    const backup = {
      exportedAt: now.toISOString(),
      ...data,
    };

    const counts = [
      `${(data.projects as unknown[])?.length ?? 0} projects`,
      `${(data.tasks as unknown[])?.length ?? 0} tasks`,
      `${(data.ideas as unknown[])?.length ?? 0} ideas`,
      `${(data.auditLogs as unknown[])?.length ?? 0} audit logs`,
      `${(data.workflowTemplates as unknown[])?.length ?? 0} workflow templates`,
      `${(data.workflowSteps as unknown[])?.length ?? 0} workflow steps`,
    ];

    console.log(`  Exported: ${counts.join(", ")}`);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    console.log(`\nBackup saved: ${filepath}`);
  } catch (error) {
    console.error("Backup failed:", error);
    process.exit(1);
  }

  // Clean up old backups
  console.log("\nCleaning up old backups...");
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(BACKUP_DIR);
  let deleted = 0;

  for (const file of files) {
    if (!file.startsWith("backup-") || !file.endsWith(".json")) continue;

    const dateMatch = file.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
    if (!dateMatch) continue;

    const fileDate = new Date(dateMatch[1]).getTime();
    if (fileDate < cutoff) {
      fs.unlinkSync(path.join(BACKUP_DIR, file));
      console.log(`  Deleted: ${file}`);
      deleted++;
    }
  }

  console.log(`  ${deleted} old backup(s) removed`);
  console.log("\nDone.");
}

main().catch(console.error);
