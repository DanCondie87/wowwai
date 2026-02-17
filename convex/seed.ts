import { mutation } from "./_generated/server";

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
