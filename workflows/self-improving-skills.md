# Self-Improving Skills Workflow

Metacognitive improvement workflow: identify skill gaps, design practice exercises, execute with feedback loop, and update personal knowledge base.

## Steps

### 1. Skill Assessment
**Agent:** assessor | **Model:** Claude Opus

Assess current skill level in the target area. Identify strengths, weaknesses, and specific gaps to address.

### 2. Learning Plan Design
**Agent:** planner | **Model:** Claude Opus

Design a targeted learning plan. Select resources, define exercises, set measurable milestones.

**References:**
- docs/learning-resources.md (learning resources)

### 3. Practice Exercise (Loop: practice-feedback)
**Agent:** practitioner | **Model:** Claude Sonnet
**Loop:** max 5 iterations | **Exit:** Skill demonstration meets target proficiency

Execute a practice exercise. Apply the skill in a realistic context with clear success criteria.

### 4. Self-Evaluation (Loop: practice-feedback)
**Agent:** evaluator | **Model:** Claude Opus

Evaluate practice results against success criteria. Identify what worked, what didn't, and specific areas for improvement.

### 5. Knowledge Base Update
**Agent:** writer | **Model:** Claude Sonnet

Update personal knowledge base with lessons learned. Document patterns, anti-patterns, and reusable techniques.

**References:**
- .claude/memory/MEMORY.md (memory files)
