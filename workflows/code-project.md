# Code Project Workflow

End-to-end software development workflow: requirements gathering, architecture, implementation with build-test loop, review, and deployment.

## Steps

### 1. Requirements Gathering
**Agent:** planner | **Model:** Claude Opus

Collect and clarify project requirements. Review PRD, user stories, and acceptance criteria. Identify ambiguities and resolve with stakeholders.

**References:**
- CLAUDE.md (project conventions)
- docs/prd-template.md (PRD template)

### 2. Architecture Design
**Agent:** architect | **Model:** Claude Opus

Design the technical architecture. Choose patterns, define data models, plan API contracts, and document key decisions in DECISIONS.md.

**References:**
- CLAUDE.md (project conventions)

### 3. Task Breakdown
**Agent:** planner | **Model:** Claude Sonnet

Break the project into discrete, testable tasks. Create task cards with clear acceptance criteria, definition of done, and testing criteria.

### 4. Implementation (Loop: build-test)
**Agent:** coder | **Model:** Claude Sonnet
**Loop:** max 5 iterations | **Exit:** All tests pass and typecheck succeeds

Write the code. Follow project conventions, use established patterns, and keep changes focused. Run typecheck after each change.

**References:**
- CLAUDE.md (project conventions)

### 5. Testing & Validation (Loop: build-test)
**Agent:** tester | **Model:** Claude Sonnet

Run tests, typecheck, and verify against acceptance criteria. Fix any failures before proceeding.

### 6. Code Review
**Agent:** reviewer | **Model:** Claude Opus

Review changes for quality, security, and adherence to conventions. Check for OWASP vulnerabilities, unused code, and proper error handling.

### 7. Deployment
**Agent:** deployer | **Model:** Claude Sonnet

Commit changes, push to remote, and verify deployment. Update progress tracking and mark tasks as done.
