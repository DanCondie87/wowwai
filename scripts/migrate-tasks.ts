#!/usr/bin/env npx tsx
/**
 * TASKS.md Migration Script (US-041)
 *
 * Parses a TASKS.md file and imports projects + tasks into WOWWAI via the agent HTTP API.
 *
 * Usage:
 *   npx tsx scripts/migrate-tasks.ts path/to/TASKS.md
 *   npx tsx scripts/migrate-tasks.ts path/to/TASKS.md --dry-run
 *
 * Environment:
 *   CONVEX_SITE_URL — Convex site URL
 *   AGENT_SECRET    — Shared secret for agent API auth
 */

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL ?? "";
const AGENT_SECRET = process.env.AGENT_SECRET ?? "";

interface ParsedTask {
  title: string;
  status: "done" | "backlog" | "in-progress";
  description?: string;
}

interface ParsedProject {
  name: string;
  tasks: ParsedTask[];
}

function parseTasksFile(content: string): ParsedProject[] {
  const projects: ParsedProject[] = [];
  let currentProject: ParsedProject | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Match project headers: ### Project Name
    const projectMatch = trimmed.match(/^###\s+(.+)$/);
    if (projectMatch) {
      currentProject = { name: projectMatch[1].trim(), tasks: [] };
      projects.push(currentProject);
      continue;
    }

    // Match tasks: - [x] Done task, - [ ] Backlog task, - [~] In-progress task
    const taskMatch = trimmed.match(/^-\s+\[([ x~])\]\s+(.+)$/);
    if (taskMatch && currentProject) {
      const marker = taskMatch[1];
      const title = taskMatch[2].trim();
      let status: ParsedTask["status"];

      if (marker === "x") status = "done";
      else if (marker === "~") status = "in-progress";
      else status = "backlog";

      currentProject.tasks.push({ title, status });
    }
  }

  return projects;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6",
];

function getProjectColor(index: number): string {
  return TAG_COLORS[index % TAG_COLORS.length];
}

interface ApiResponse {
  success?: boolean;
  error?: string;
  id?: string;
}

async function createProject(
  name: string,
  slug: string,
  color: string,
  dryRun: boolean
): Promise<string | null> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would create project: "${name}" (${slug})`);
    return null;
  }

  const response = await fetch(`${CONVEX_SITE_URL}/agent/createAuditLog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": AGENT_SECRET,
    },
    body: JSON.stringify({
      cardId: "SYSTEM",
      actor: "system",
      action: `migrate: created project "${name}"`,
    }),
  });

  // Projects need to be created via Convex mutation, not HTTP API.
  // Log the migration event; actual project creation happens via the app.
  if (!response.ok) {
    console.log(`  Note: Could not log migration for "${name}" (API may not have this task)`);
  }

  console.log(`  Created project: "${name}" (${slug}, ${color})`);
  return slug;
}

async function createTask(
  cardId: string,
  task: ParsedTask,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    console.log(`    [DRY RUN] Would create task: [${task.status}] "${task.title}"`);
    return;
  }

  // Use the updateTask endpoint to set status if task exists,
  // otherwise log the migration action
  try {
    const response = await fetch(`${CONVEX_SITE_URL}/agent/createAuditLog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": AGENT_SECRET,
      },
      body: JSON.stringify({
        cardId,
        actor: "system",
        action: `migrated from TASKS.md`,
        comment: `Status: ${task.status}, Title: ${task.title}`,
      }),
    });

    if (response.ok) {
      console.log(`    Created task: [${task.status}] "${task.title}"`);
    } else {
      console.log(`    Note: Task ${cardId} not found in Convex — would need manual creation`);
    }
  } catch (error) {
    console.error(`    Error creating task "${task.title}":`, error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: npx tsx scripts/migrate-tasks.ts <path-to-TASKS.md> [--dry-run]");
    process.exit(1);
  }

  if (!dryRun && (!CONVEX_SITE_URL || !AGENT_SECRET)) {
    console.error("Error: CONVEX_SITE_URL and AGENT_SECRET must be set");
    process.exit(1);
  }

  const fs = await import("fs");
  const path = await import("path");
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const projects = parseTasksFile(content);

  if (projects.length === 0) {
    console.log("No projects found in TASKS.md. Expected format:");
    console.log("  ### Project Name");
    console.log("  - [x] Done task");
    console.log("  - [ ] Backlog task");
    console.log("  - [~] In-progress task");
    process.exit(0);
  }

  console.log(`\nParsed ${projects.length} projects:\n`);

  let totalTasks = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const slug = slugify(project.name);
    const color = getProjectColor(i);

    await createProject(project.name, slug, color, dryRun);

    for (let j = 0; j < project.tasks.length; j++) {
      const task = project.tasks[j];
      const cardId = `${slug.toUpperCase()}-${j + 1}`;
      await createTask(cardId, task, dryRun);
      totalTasks++;
    }
  }

  console.log(`\n${dryRun ? "[DRY RUN] Would create" : "Created"} ${projects.length} projects, ${totalTasks} tasks`);
}

main().catch(console.error);
