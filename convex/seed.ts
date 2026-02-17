import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

interface StepDef {
  name: string;
  description: string;
  order: number;
  loopGroupId?: string;
  loopMaxIterations?: number;
  loopExitCriteria?: string;
  references: Array<{
    type: string;
    label: string;
    filePath: string;
    section?: string;
  }>;
  modelRecommendation?: string;
  agentType?: string;
}

interface TemplateDef {
  name: string;
  description: string;
  sourceFile?: string;
  steps: StepDef[];
}

const TEMPLATES: TemplateDef[] = [
  {
    name: "Code Project",
    description:
      "End-to-end software development workflow: requirements gathering, architecture, implementation with build-test loop, review, and deployment.",
    sourceFile: "workflows/code-project.md",
    steps: [
      {
        name: "Requirements Gathering",
        description:
          "Collect and clarify project requirements. Review PRD, user stories, and acceptance criteria. Identify ambiguities and resolve with stakeholders.",
        order: 1,
        references: [
          { type: "claude_md", label: "Project CLAUDE.md", filePath: "CLAUDE.md" },
          { type: "prompt_template", label: "PRD Template", filePath: "docs/prd-template.md" },
        ],
        modelRecommendation: "Claude Opus",
        agentType: "planner",
      },
      {
        name: "Architecture Design",
        description:
          "Design the technical architecture. Choose patterns, define data models, plan API contracts, and document key decisions in DECISIONS.md.",
        order: 2,
        references: [
          { type: "claude_md", label: "CLAUDE.md", filePath: "CLAUDE.md" },
        ],
        modelRecommendation: "Claude Opus",
        agentType: "architect",
      },
      {
        name: "Task Breakdown",
        description:
          "Break the project into discrete, testable tasks. Create task cards with clear acceptance criteria, definition of done, and testing criteria.",
        order: 3,
        references: [],
        modelRecommendation: "Claude Sonnet",
        agentType: "planner",
      },
      {
        name: "Implementation",
        description:
          "Write the code. Follow project conventions, use established patterns, and keep changes focused. Run typecheck after each change.",
        order: 4,
        loopGroupId: "build-test",
        loopMaxIterations: 5,
        loopExitCriteria: "All tests pass and typecheck succeeds",
        references: [
          { type: "claude_md", label: "CLAUDE.md", filePath: "CLAUDE.md" },
        ],
        modelRecommendation: "Claude Sonnet",
        agentType: "coder",
      },
      {
        name: "Testing & Validation",
        description:
          "Run tests, typecheck, and verify against acceptance criteria. Fix any failures before proceeding.",
        order: 5,
        loopGroupId: "build-test",
        references: [],
        modelRecommendation: "Claude Sonnet",
        agentType: "tester",
      },
      {
        name: "Code Review",
        description:
          "Review changes for quality, security, and adherence to conventions. Check for OWASP vulnerabilities, unused code, and proper error handling.",
        order: 6,
        references: [],
        modelRecommendation: "Claude Opus",
        agentType: "reviewer",
      },
      {
        name: "Deployment",
        description:
          "Commit changes, push to remote, and verify deployment. Update progress tracking and mark tasks as done.",
        order: 7,
        references: [],
        modelRecommendation: "Claude Sonnet",
        agentType: "deployer",
      },
    ],
  },
  {
    name: "Research",
    description:
      "Structured research workflow: define questions, gather sources, analyze findings, and produce a synthesis document.",
    sourceFile: "workflows/research.md",
    steps: [
      {
        name: "Define Research Questions",
        description:
          "Clearly state what needs to be learned. Define scope, success criteria, and expected output format.",
        order: 1,
        references: [],
        modelRecommendation: "Claude Opus",
        agentType: "planner",
      },
      {
        name: "Source Gathering",
        description:
          "Collect relevant sources: documentation, articles, code examples, API references. Organize by relevance.",
        order: 2,
        references: [],
        modelRecommendation: "Claude Sonnet",
        agentType: "researcher",
      },
      {
        name: "Analysis",
        description:
          "Analyze gathered sources. Extract key findings, identify patterns, compare approaches, note trade-offs.",
        order: 3,
        loopGroupId: "analyze-refine",
        loopMaxIterations: 3,
        loopExitCriteria: "All research questions answered with evidence",
        references: [],
        modelRecommendation: "Claude Opus",
        agentType: "analyst",
      },
      {
        name: "Gap Identification",
        description:
          "Review analysis for gaps. Identify unanswered questions and gather additional sources if needed.",
        order: 4,
        loopGroupId: "analyze-refine",
        references: [],
        modelRecommendation: "Claude Sonnet",
        agentType: "analyst",
      },
      {
        name: "Synthesis",
        description:
          "Produce a synthesis document: executive summary, key findings, recommendations, and references. Write in plain English.",
        order: 5,
        references: [],
        modelRecommendation: "Claude Opus",
        agentType: "writer",
      },
    ],
  },
  {
    name: "Self-Improving Skills",
    description:
      "Metacognitive improvement workflow: identify skill gaps, design practice exercises, execute with feedback loop, and update personal knowledge base.",
    sourceFile: "workflows/self-improving-skills.md",
    steps: [
      {
        name: "Skill Assessment",
        description:
          "Assess current skill level in the target area. Identify strengths, weaknesses, and specific gaps to address.",
        order: 1,
        references: [],
        modelRecommendation: "Claude Opus",
        agentType: "assessor",
      },
      {
        name: "Learning Plan Design",
        description:
          "Design a targeted learning plan. Select resources, define exercises, set measurable milestones.",
        order: 2,
        references: [
          { type: "library", label: "Learning Resources", filePath: "docs/learning-resources.md" },
        ],
        modelRecommendation: "Claude Opus",
        agentType: "planner",
      },
      {
        name: "Practice Exercise",
        description:
          "Execute a practice exercise. Apply the skill in a realistic context with clear success criteria.",
        order: 3,
        loopGroupId: "practice-feedback",
        loopMaxIterations: 5,
        loopExitCriteria: "Skill demonstration meets target proficiency",
        references: [],
        modelRecommendation: "Claude Sonnet",
        agentType: "practitioner",
      },
      {
        name: "Self-Evaluation",
        description:
          "Evaluate practice results against success criteria. Identify what worked, what didn't, and specific areas for improvement.",
        order: 4,
        loopGroupId: "practice-feedback",
        references: [],
        modelRecommendation: "Claude Opus",
        agentType: "evaluator",
      },
      {
        name: "Knowledge Base Update",
        description:
          "Update personal knowledge base with lessons learned. Document patterns, anti-patterns, and reusable techniques.",
        order: 5,
        references: [
          { type: "claude_md", label: "Memory Files", filePath: ".claude/memory/MEMORY.md" },
        ],
        modelRecommendation: "Claude Sonnet",
        agentType: "writer",
      },
    ],
  },
];

export const seedWorkflows = mutation({
  args: {},
  handler: async (ctx) => {
    // Idempotent: check if templates already exist
    const existing = await ctx.db.query("workflowTemplates").collect();
    const existingNames = new Set(existing.map((t) => t.name));

    let templatesCreated = 0;
    let stepsCreated = 0;

    for (const template of TEMPLATES) {
      if (existingNames.has(template.name)) continue;

      const templateId = await ctx.db.insert("workflowTemplates", {
        name: template.name,
        description: template.description,
        sourceFile: template.sourceFile,
        createdAt: Date.now(),
      });
      templatesCreated++;

      for (const step of template.steps) {
        await ctx.db.insert("workflowSteps", {
          templateId,
          name: step.name,
          description: step.description,
          order: step.order,
          loopGroupId: step.loopGroupId,
          loopMaxIterations: step.loopMaxIterations,
          loopExitCriteria: step.loopExitCriteria,
          references: step.references,
          modelRecommendation: step.modelRecommendation,
          agentType: step.agentType,
        });
        stepsCreated++;
      }
    }

    return { templatesCreated, stepsCreated };
  },
});

// Seed everything: projects + tasks + workflows
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingProjects = await ctx.db.query("projects").collect();
    if (existingProjects.length > 0) {
      return { status: "already seeded", projects: existingProjects.length };
    }

    const now = Date.now();

    // --- Projects ---
    const wowwaiId = await ctx.db.insert("projects", {
      name: "WOWWAI",
      slug: "wowwai",
      description: "Ways of Working With AI — Project management + workflow control centre",
      status: "active",
      color: "#3b82f6",
      createdAt: now,
    });

    const daliBrainId = await ctx.db.insert("projects", {
      name: "Dali Brain",
      slug: "dali-brain",
      description: "Dali's self-improvement skills, memory systems, and personality evolution",
      status: "active",
      color: "#f59e0b",
      createdAt: now,
    });

    const wyrdoId = await ctx.db.insert("projects", {
      name: "Wyrdo",
      slug: "wyrdo",
      description: "Wyrdo Review App — Community review platform",
      status: "active",
      color: "#8b5cf6",
      createdAt: now,
    });

    // --- WOWWAI Tasks ---
    const wowwaiTasks: Array<{
      title: string;
      description: string;
      status: "backlog" | "todo" | "in-progress" | "review" | "done";
      assignee: "dan" | "dali";
      priority: "low" | "medium" | "high" | "urgent";
      tags: string[];
    }> = [
      {
        title: "Enable Clerk authentication",
        description: "Install @clerk/nextjs, wire up middleware, create sign-in/sign-up pages, integrate with ConvexProviderWithClerk",
        status: "todo",
        assignee: "dali",
        priority: "high",
        tags: ["auth", "security"],
      },
      {
        title: "Test live deployment on mobile",
        description: "Open wowwai.vercel.app on phone, test all views, check responsive layout, report issues",
        status: "todo",
        assignee: "dan",
        priority: "high",
        tags: ["testing", "mobile"],
      },
      {
        title: "Import existing TASKS.md data",
        description: "Run migration script to import current tasks from clawd/TASKS.md into Convex",
        status: "backlog",
        assignee: "dali",
        priority: "medium",
        tags: ["migration", "data"],
      },
      {
        title: "Set up sync agent (pm2)",
        description: "Configure pm2 file watcher for bi-directional sync between local files and Convex",
        status: "backlog",
        assignee: "dali",
        priority: "medium",
        tags: ["sync", "infra"],
      },
      {
        title: "Custom domain setup",
        description: "Point a custom domain to Vercel deployment",
        status: "backlog",
        assignee: "dan",
        priority: "low",
        tags: ["infra"],
      },
      {
        title: "Board view — shipped ✓",
        description: "Kanban board with drag-and-drop, column management, and card details",
        status: "done",
        assignee: "dali",
        priority: "high",
        tags: ["ui", "kanban"],
      },
      {
        title: "Workflow visualizer — shipped ✓",
        description: "Vertical accordion workflow viewer with pipeline steps, loop groups, and references",
        status: "done",
        assignee: "dali",
        priority: "high",
        tags: ["ui", "workflows"],
      },
      {
        title: "Theme system — shipped ✓",
        description: "Light/dark/system theme with shadcn CSS variables and next-themes",
        status: "done",
        assignee: "dali",
        priority: "medium",
        tags: ["ui", "theme"],
      },
    ];

    let taskCount = 0;
    for (const task of wowwaiTasks) {
      taskCount++;
      const cardId = `WOWWAI-${taskCount}`;
      await ctx.db.insert("tasks", {
        projectId: wowwaiId,
        cardId,
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        priority: task.priority,
        tags: task.tags,
        blockedBy: [],
        position: taskCount,
        lastTouchedAt: now,
        createdAt: now,
        completedAt: task.status === "done" ? now : undefined,
      });
    }

    // --- Dali Brain Tasks ---
    const daliTasks: Array<{
      title: string;
      description: string;
      status: "backlog" | "todo" | "in-progress" | "review" | "done";
      assignee: "dan" | "dali";
      priority: "low" | "medium" | "high" | "urgent";
      tags: string[];
    }> = [
      {
        title: "Memory maintenance — weekly review",
        description: "Review daily memory files, distill lessons into MEMORY.md, prune stale info",
        status: "in-progress",
        assignee: "dali",
        priority: "medium",
        tags: ["memory", "maintenance"],
      },
      {
        title: "Improve overnight task pitches",
        description: "Track which pitches Dan accepts/rejects, learn patterns, improve suggestions",
        status: "backlog",
        assignee: "dali",
        priority: "low",
        tags: ["self-improvement"],
      },
    ];

    let daliTaskCount = 0;
    for (const task of daliTasks) {
      daliTaskCount++;
      await ctx.db.insert("tasks", {
        projectId: daliBrainId,
        cardId: `DALI-BRAIN-${daliTaskCount}`,
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        priority: task.priority,
        tags: task.tags,
        blockedBy: [],
        position: daliTaskCount,
        lastTouchedAt: now,
        createdAt: now,
      });
    }

    // --- Wyrdo Tasks ---
    await ctx.db.insert("tasks", {
      projectId: wyrdoId,
      cardId: "WYRDO-1",
      title: "Review app live at wyrdo-review.vercel.app",
      description: "Community review platform — deployed and running",
      status: "done",
      assignee: "dali",
      priority: "medium",
      tags: ["shipped"],
      blockedBy: [],
      position: 1,
      lastTouchedAt: now,
      createdAt: now,
      completedAt: now,
    });

    // --- Seed workflow templates ---
    let templatesCreated = 0;
    let stepsCreated = 0;

    for (const template of TEMPLATES) {
      const templateId = await ctx.db.insert("workflowTemplates", {
        name: template.name,
        description: template.description,
        sourceFile: template.sourceFile,
        createdAt: now,
      });
      templatesCreated++;

      for (const step of template.steps) {
        await ctx.db.insert("workflowSteps", {
          templateId,
          name: step.name,
          description: step.description,
          order: step.order,
          loopGroupId: step.loopGroupId,
          loopMaxIterations: step.loopMaxIterations,
          loopExitCriteria: step.loopExitCriteria,
          references: step.references,
          modelRecommendation: step.modelRecommendation,
          agentType: step.agentType,
        });
        stepsCreated++;
      }
    }

    return {
      projects: 3,
      tasks: taskCount + daliTaskCount + 1,
      templates: templatesCreated,
      steps: stepsCreated,
    };
  },
});
