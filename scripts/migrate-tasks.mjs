#!/usr/bin/env node
/**
 * TASKS.md Migration Script (US-056)
 * 
 * Parses ~/clawd/TASKS.md and creates real projects + tasks in WOWWAI via the /mutations HTTP endpoint.
 * 
 * Usage:
 *   node scripts/migrate-tasks.mjs [--dry-run]
 */

const CONVEX_SITE_URL = "https://scrupulous-weasel-702.convex.site";
const AGENT_SECRET = "693961ad4a059f6c2f7a0915f18f2fb8c3c11ef4fff234c968bf8b9ff0f03ea4";

import { readFileSync } from "fs";
import { resolve } from "path";

const TASKS_PATH = resolve(process.env.HOME || process.env.USERPROFILE, "clawd", "TASKS.md");
const DRY_RUN = process.argv.includes("--dry-run");

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6",
];

async function callMutation(mutation, args) {
  const res = await fetch(`${CONVEX_SITE_URL}/mutations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": AGENT_SECRET,
    },
    body: JSON.stringify({ mutation, args }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${mutation} failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.result;
}

function parseTasksFile(content) {
  const sections = [];
  let currentSection = null;
  let currentProject = null;
  
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Match section headers: ## 🎯 Today's Focus, ## 🔥 Active Projects, etc.
    const sectionMatch = trimmed.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      // Skip non-project sections
      if (name.includes("Notes") || name.includes("Backlog") || name.includes("Recently Completed")) {
        currentSection = null;
        currentProject = null;
        continue;
      }
      currentSection = name;
      currentProject = null;
      continue;
    }
    
    // Match project headers: ### Project Name
    const projectMatch = trimmed.match(/^###\s+(.+)$/);
    if (projectMatch && currentSection) {
      const rawName = projectMatch[1].trim();
      // Clean up emoji and status markers
      const name = rawName
        .replace(/[✅🔥🆕🔄]/g, "")
        .replace(/\(.*?\)/g, "")
        .trim();
      
      if (name) {
        currentProject = { name, tasks: [], section: currentSection };
        sections.push(currentProject);
      }
      continue;
    }
    
    // Match tasks: - [x] Done task, - [ ] Backlog task, - [~] In-progress task
    const taskMatch = trimmed.match(/^-\s+\[([ x~])\]\s+(.+)$/);
    if (taskMatch && currentProject) {
      const marker = taskMatch[1];
      let title = taskMatch[2].trim();
      
      // Remove date annotations like ~~2026-02-04~~
      title = title.replace(/\s*~~[\d-]+~~\s*/g, "").trim();
      
      // Skip sub-items that are clearly sub-checkboxes (indented)
      if (line.startsWith("    ") || line.startsWith("\t")) continue;
      
      let status;
      if (marker === "x") status = "done";
      else if (marker === "~") status = "in-progress";
      else status = "backlog";
      
      // Determine priority from title keywords
      let priority = "medium";
      if (title.toLowerCase().includes("blocked")) priority = "high";
      if (title.toLowerCase().includes("urgent")) priority = "urgent";
      
      // Determine assignee
      let assignee = "dan";
      if (title.toLowerCase().includes("dali")) assignee = "dali";
      
      currentProject.tasks.push({ title, status, priority, assignee });
    }
  }
  
  return sections;
}

async function main() {
  console.log(`\nWOWWAI Migration (US-056)`);
  console.log(`Source: ${TASKS_PATH}`);
  console.log(`Target: ${CONVEX_SITE_URL}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
  
  const content = readFileSync(TASKS_PATH, "utf-8");
  const projects = parseTasksFile(content);
  
  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }
  
  console.log(`Found ${projects.length} projects:\n`);
  
  let totalTasks = 0;
  let createdProjects = 0;
  let createdTasks = 0;
  
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const color = TAG_COLORS[i % TAG_COLORS.length];
    
    console.log(`📁 ${project.name} (${project.tasks.length} tasks)`);
    
    let projectId = null;
    
    if (!DRY_RUN) {
      try {
        projectId = await callMutation("projects.create", {
          name: project.name,
          color,
          description: `Migrated from TASKS.md (${project.section})`,
        });
        createdProjects++;
        console.log(`   ✅ Created project (id: ${projectId})`);
      } catch (err) {
        console.error(`   ❌ Failed to create project: ${err.message}`);
        continue;
      }
    } else {
      console.log(`   [DRY RUN] Would create project`);
    }
    
    for (const task of project.tasks) {
      totalTasks++;
      
      if (!DRY_RUN && projectId) {
        try {
          const taskId = await callMutation("tasks.create", {
            projectId,
            title: task.title,
            assignee: task.assignee,
            priority: task.priority,
            status: task.status,
            tags: [],
          });
          createdTasks++;
          console.log(`   ${task.status === "done" ? "✅" : task.status === "in-progress" ? "🔧" : "⬜"} [${task.status}] ${task.title}`);
        } catch (err) {
          console.error(`   ❌ Failed: ${task.title} — ${err.message}`);
        }
      } else {
        console.log(`   ${task.status === "done" ? "✅" : task.status === "in-progress" ? "🔧" : "⬜"} [${task.status}] ${task.title}`);
      }
    }
    
    console.log("");
  }
  
  console.log(`\n${"=".repeat(50)}`);
  console.log(`${DRY_RUN ? "[DRY RUN] Would create" : "Created"}: ${createdProjects || projects.length} projects, ${createdTasks || totalTasks} tasks`);
}

main().catch(console.error);
