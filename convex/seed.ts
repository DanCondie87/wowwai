import { internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Seed the WOWWAI Security & Quality Review project + 23 tasks (dogfooding)
// SEC-003 extension: converted to internalMutation — callable via CLI/dashboard only.
// npx convex run seed:seedReviewProject  (still works from CLI)
export const seedReviewProject = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotent: skip if review project already exists
    const existing = await ctx.db.query("projects").collect();
    const alreadyExists = existing.find((p) => p.slug === "review");
    if (alreadyExists) {
      return { status: "already seeded", projectId: alreadyExists._id };
    }

    const now = Date.now();

    // --- Create project ---
    const projectId = await ctx.db.insert("projects", {
      name: "WOWWAI Security & Quality Review",
      slug: "review",
      description:
        "Systematic multi-dimensional review of WOWWAI covering security, testing, code quality, architecture, frontend, dependencies, and performance.",
      status: "active",
      color: "#e11d48",
      createdAt: now,
    });

    // --- Task data ---
    const tasks: Array<{
      cardId: string;
      title: string;
      description: string;
      status: "backlog";
      assignee: "dan" | "dali";
      priority: "low" | "medium" | "high" | "urgent";
      tags: string[];
      definitionOfDone?: string;
      testingCriteria?: string;
    }> = [
      {
        cardId: "REVIEW-1",
        title: "Auth Implementation Audit — timing attacks & password hashing",
        description:
          "Audit src/lib/auth.ts for timing attack vulnerabilities (non-constant-time comparisons), SHA-256 password hashing weaknesses, and cookie hardening. Implement timing-safe comparisons using crypto.subtle. Document AUTH_SECRET entropy requirements.",
        status: "backlog",
        assignee: "dali",
        priority: "urgent",
        tags: ["security", "auth", "critical"],
        definitionOfDone:
          "All string comparisons in auth.ts use timing-safe equivalents. SHA-256 risk is acknowledged or replaced. Cookie flags are documented and justified.",
        testingCriteria:
          "Unit tests pass for all auth functions including tampered token edge cases. No === comparison between secrets in auth code.",
      },
      {
        cardId: "REVIEW-2",
        title: "Middleware Auth Bypass Analysis — CVE-2025-29927 & path bypass vectors",
        description:
          "Verify Next.js 16.1.6 is not vulnerable to CVE-2025-29927 (x-middleware-subrequest bypass). Audit PUBLIC_ROUTES list. Assess pathname.includes('.') bypass potential. Verify middleware matcher regex coverage.",
        status: "backlog",
        assignee: "dali",
        priority: "urgent",
        tags: ["security", "middleware", "critical"],
        definitionOfDone:
          "CVE-2025-29927 patch status confirmed. All potential bypass vectors documented. Middleware matcher reviewed and hardened if needed.",
        testingCriteria:
          "Middleware tests cover bypass attempt paths. CVE status is documented with version evidence.",
      },
      {
        cardId: "REVIEW-3",
        title:
          "Convex Unauthenticated Access — design & implement auth for all public queries/mutations",
        description:
          "CRITICAL: All Convex public queries and mutations are unauthenticated. getFullExport and fileSyncQueue.enqueue are particularly dangerous. Design and implement auth propagation from Next.js session to Convex server-side validation.",
        status: "backlog",
        assignee: "dali",
        priority: "urgent",
        tags: ["security", "convex", "critical"],
        definitionOfDone:
          "All sensitive queries/mutations have auth checks. getFullExport and enqueue are protected. Architecture decision recorded.",
        testingCriteria:
          "Unauthenticated calls to protected functions return 401. Integration tests verify auth flow end-to-end.",
      },
      {
        cardId: "REVIEW-4",
        title:
          "File System Write Security Audit — sync-agent path traversal & content injection",
        description:
          "Audit sync-agent resolveSafePath() for Windows case-sensitivity issues and symlink attacks. Assess the attack chain: unauthenticated enqueue mutation → Convex queue → sync-agent writes to disk. Review content sanitization.",
        status: "backlog",
        assignee: "dali",
        priority: "urgent",
        tags: ["security", "filesystem", "critical"],
        definitionOfDone:
          "All file write attack vectors assessed with mitigations documented. resolveSafePath hardened for Windows edge cases. Content validation added or risk accepted.",
        testingCriteria:
          "Path traversal attempts are blocked by resolveSafePath. Symlink attack scenario documented.",
      },
      {
        cardId: "REVIEW-5",
        title: "HTTP API Security — timing attacks on AGENT_SECRET & CORS policy",
        description:
          "Fix verifySecret() timing attack in convex/http.ts (secret === expected). Review CORS allowed origin construction. Assess per-IP rate limiting adequacy. Validate all body inputs for injection risks.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["security", "api", "convex"],
        definitionOfDone:
          "verifySecret uses timing-safe comparison. CORS logic is documented and correct. Rate limiting strategy is adequate.",
        testingCriteria:
          "Timing-safe comparison in place. CORS tested with allowed and disallowed origins.",
      },
      {
        cardId: "REVIEW-6",
        title: "CSP & Security Header Hardening — remove unsafe-inline, add missing headers",
        description:
          "Remove script-src 'unsafe-inline' from next.config.ts CSP. Add HSTS, Referrer-Policy, Permissions-Policy, COOP, COEP headers. Review rehype-sanitize configuration in markdown.tsx.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["security", "headers", "xss"],
        definitionOfDone:
          "CSP does not contain unsafe-inline for scripts. All recommended security headers present. Markdown sanitization verified.",
        testingCriteria:
          "securityheaders.com scan passes with A rating. CSP validated against Next.js requirements.",
      },
      {
        cardId: "REVIEW-7",
        title: "Test Infrastructure Setup — Vitest + Playwright + Convex testing",
        description:
          "Install and configure Vitest for unit/integration tests, Playwright for E2E tests, and @convex-dev/testing for Convex function tests. Add test scripts to package.json. Set up folder structure.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["testing", "infrastructure"],
        definitionOfDone:
          "npm test runs successfully. npm run test:e2e starts and runs a basic navigation test. Test folder structure created.",
        testingCriteria:
          "At least one passing smoke test in each test category.",
      },
      {
        cardId: "REVIEW-8",
        title: "Auth Unit Tests — full branch coverage of src/lib/auth.ts",
        description:
          "Write unit tests for all functions in auth.ts: sha256, sign, createSessionToken, verifySessionToken (valid/expired/tampered), verifyPassword (correct/wrong/edge cases). Target full branch coverage.",
        status: "backlog",
        assignee: "dali",
        priority: "urgent",
        tags: ["testing", "auth", "unit-tests"],
        definitionOfDone:
          "≥15 passing tests covering all branches. Expired token, tampered payload, tampered signature all tested.",
        testingCriteria:
          "Full branch coverage of auth.ts shown in coverage report.",
      },
      {
        cardId: "REVIEW-9",
        title: "API Route Integration Tests — login, logout, rate limiting",
        description:
          "Write integration tests for /api/auth/login and /api/auth/logout routes. Cover: correct password, wrong password, missing password, rate limiting (5 attempts then 429), cookie flags.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["testing", "api", "integration-tests"],
        definitionOfDone:
          "All API route behaviors tested including rate limiting. Cookie flags verified in test assertions.",
        testingCriteria:
          "Tests pass and cover all documented API behaviors.",
      },
      {
        cardId: "REVIEW-10",
        title: "Middleware Tests — auth enforcement & bypass prevention",
        description:
          "Write tests for middleware.ts covering: unauthenticated access to protected routes (redirect), public routes (pass through), valid cookie (pass through), expired cookie (redirect + clear), tampered cookie (redirect).",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["testing", "middleware", "security"],
        definitionOfDone:
          "All middleware auth scenarios have tests. Bypass attempt paths are tested and confirmed blocked.",
        testingCriteria:
          "Tests cover all PUBLIC_ROUTES and protected route behaviors.",
      },
      {
        cardId: "REVIEW-11",
        title: "E2E Test Suite — Playwright auth & task management flows",
        description:
          "Write Playwright E2E tests for: login flow (success/failure), protected route redirect, create task, drag task between columns, logout. Tests should run headless in CI.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["testing", "e2e", "playwright"],
        definitionOfDone:
          "E2E suite passes against dev server. Tests run headless. Login, task creation, and drag-drop covered.",
        testingCriteria:
          "All E2E tests pass on clean checkout with dev server running.",
      },
      {
        cardId: "REVIEW-12",
        title: "Convex Function Tests — task lifecycle & project operations",
        description:
          "Write tests for Convex functions using @convex-dev/testing: tasks.create (cardId generation, defaults), tasks.moveToColumn (completedAt on done), tasks.getById (includes subtasks), projects.create.",
        status: "backlog",
        assignee: "dali",
        priority: "medium",
        tags: ["testing", "convex", "unit-tests"],
        definitionOfDone:
          "Core task lifecycle operations have test coverage. cardId generation logic tested.",
        testingCriteria:
          "Convex function tests pass with in-memory Convex backend.",
      },
      {
        cardId: "REVIEW-13",
        title: "TypeScript Strictness Audit — strict mode, any types, unsafe assertions",
        description:
          "Review tsconfig.json for strict mode status. Audit for any types, non-null assertions, unsafe as casts. Verify Convex validator types match handler usage. Enable strict mode if not already on.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["code-quality", "typescript"],
        definitionOfDone:
          "strict mode enabled in tsconfig. No any types in security-relevant code. Findings documented in QUAL-TYPESCRIPT.md.",
        testingCriteria: "tsc --strict compiles without errors.",
      },
      {
        cardId: "REVIEW-14",
        title: "Error Handling Review — unhandled async errors & info leakage",
        description:
          "Audit all async operations for missing try/catch. Check API routes for error info leakage. Review Convex mutation error propagation to UI. Assess catch {} in login route. Check all JSON.parse and atob calls.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["code-quality", "error-handling"],
        definitionOfDone:
          "All security-relevant code has proper error handling. No error messages leak sensitive info to users.",
        testingCriteria:
          "Error scenarios handled gracefully in both API routes and UI components.",
      },
      {
        cardId: "REVIEW-15",
        title: "Dead Code & Unused Dependencies Audit",
        description:
          "Run ts-unused-exports to find unused exports. Audit package.json dependencies for unused packages. Check scripts/ folder, convex/seed.ts, convex/recommend.ts, convex/analytics.ts for whether they're wired up.",
        status: "backlog",
        assignee: "dali",
        priority: "medium",
        tags: ["code-quality", "cleanup"],
        definitionOfDone:
          "Unused code removed or documented as intentional. package.json cleaned up.",
        testingCriteria:
          "npm build succeeds after cleanup. No import errors.",
      },
      {
        cardId: "REVIEW-16",
        title:
          "Convex Schema Hardening — replace v.string() with typed literal unions",
        description:
          "fileSyncQueue.direction and .status use v.string() — replace with typed unions. agentActivity.status same issue. Review all schema fields that should be enums. Verify indexes cover all query patterns.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["architecture", "convex", "schema"],
        definitionOfDone:
          "All status/direction/enum fields use v.union(v.literal()) instead of v.string(). Migration written if needed.",
        testingCriteria:
          "Convex deployment succeeds. All existing queries still work with new schema.",
      },
      {
        cardId: "REVIEW-17",
        title:
          "API Architecture Review — document data flow & agent routing decisions",
        description:
          "Document why agent operations go through Convex HTTP routes vs Next.js API routes. Document /api/agent middleware bypass intent. Create architecture diagram for data flows. Update DECISIONS.md.",
        status: "backlog",
        assignee: "dali",
        priority: "medium",
        tags: ["architecture", "documentation"],
        definitionOfDone:
          "Architecture diagram created. Data flow documented. DECISIONS.md updated with routing rationale.",
        testingCriteria: "Documentation reviewed and approved by Dan.",
      },
      {
        cardId: "REVIEW-18",
        title:
          "XSS & Injection Review — markdown rendering, dangerouslySetInnerHTML, audit logs",
        description:
          "Audit rehype-sanitize configuration in markdown.tsx for completeness (blocks script, javascript: href, event handlers). Find all dangerouslySetInnerHTML usages. Audit audit-trail.tsx for XSS via before/after content.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["security", "frontend", "xss"],
        definitionOfDone:
          "rehype-sanitize blocks all known XSS vectors. All dangerouslySetInnerHTML instances audited. Audit log content is safely rendered.",
        testingCriteria:
          "XSS test payloads (script injection, img onerror, javascript: href) are blocked in markdown renderer.",
      },
      {
        cardId: "REVIEW-19",
        title: "Error & Loading State Completeness",
        description:
          "Audit all components that use Convex query hooks for missing loading and error states. Identify components that render undefined data without guards. Check offline-banner.tsx coverage.",
        status: "backlog",
        assignee: "dali",
        priority: "medium",
        tags: ["frontend", "ux"],
        definitionOfDone:
          "All Convex query consumers handle loading and error states. No unguarded undefined access.",
        testingCriteria:
          "Components render gracefully with undefined/error data in Storybook or manual testing.",
      },
      {
        cardId: "REVIEW-20",
        title: "Security Vulnerability Scan — npm audit & CVE cross-reference",
        description:
          "Run npm audit and document all findings. Cross-reference next@16.1.6 against CVE-2025-29927 patch status. Check convex@1.31.7 and chokidar@4.0.3 for known issues. Review recently updated packages for supply chain risk.",
        status: "backlog",
        assignee: "dali",
        priority: "high",
        tags: ["dependencies", "security"],
        definitionOfDone:
          "DEP-AUDIT.md created with all vulnerabilities and remediation plan. No HIGH/CRITICAL npm audit findings left unresolved.",
        testingCriteria:
          "npm audit exits with code 0 or all remaining issues are documented as accepted risks.",
      },
      {
        cardId: "REVIEW-21",
        title: "Outdated Dependencies & Unnecessary Packages Audit",
        description:
          "Run npm outdated. Assess upgrade paths for convex, next, react. Check if tw-animate-css is actually used. Review convex-helpers usage. Document upgrade plan with risk assessment per package.",
        status: "backlog",
        assignee: "dali",
        priority: "medium",
        tags: ["dependencies", "maintenance"],
        definitionOfDone:
          "Upgrade plan documented. Critical security updates applied. Unused packages removed.",
        testingCriteria:
          "npm build succeeds after updates. All E2E tests pass.",
      },
      {
        cardId: "REVIEW-22",
        title:
          "Server vs Client Component Audit — reduce client bundle",
        description:
          "Audit 'use client' directives for unnecessary placement. Identify pages that could be static. Assess ConvexProvider client rendering impact. Check recharts and @dnd-kit lazy loading.",
        status: "backlog",
        assignee: "dali",
        priority: "low",
        tags: ["performance", "frontend"],
        definitionOfDone:
          "Client boundary is as narrow as possible. Large libraries (recharts, dnd-kit) are dynamically imported.",
        testingCriteria:
          "Bundle size reduced by ≥10% vs baseline. Core Web Vitals maintained.",
      },
      {
        cardId: "REVIEW-23",
        title: "Convex Query Optimization — pagination & efficient lookups",
        description:
          "Add pagination to tasks.getAll() and export.getFullExport(). Replace getByCardId .collect().find() with proper indexed search. Identify queries that load unnecessary full table scans.",
        status: "backlog",
        assignee: "dali",
        priority: "low",
        tags: ["performance", "convex"],
        definitionOfDone:
          "getAll() and getFullExport() support pagination. getByCardId uses search index. No unnecessary full table scans.",
        testingCriteria:
          "Query times measured before and after. Improvement documented.",
      },
    ];

    let tasksCreated = 0;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      await ctx.db.insert("tasks", {
        projectId,
        cardId: task.cardId,
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        priority: task.priority,
        tags: task.tags,
        blockedBy: [],
        definitionOfDone: task.definitionOfDone,
        testingCriteria: task.testingCriteria,
        position: i + 1,
        lastTouchedAt: now,
        createdAt: now,
      });
      tasksCreated++;
    }

    return { status: "seeded", projectId, tasksCreated };
  },
});

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

export const seedWorkflows = internalMutation({
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
export const seedAll = internalMutation({
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
