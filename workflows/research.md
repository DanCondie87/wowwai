# Research Workflow

Structured research workflow: define questions, gather sources, analyze findings, and produce a synthesis document.

## Steps

### 1. Define Research Questions
**Agent:** planner | **Model:** Claude Opus

Clearly state what needs to be learned. Define scope, success criteria, and expected output format.

### 2. Source Gathering
**Agent:** researcher | **Model:** Claude Sonnet

Collect relevant sources: documentation, articles, code examples, API references. Organize by relevance.

### 3. Analysis (Loop: analyze-refine)
**Agent:** analyst | **Model:** Claude Opus
**Loop:** max 3 iterations | **Exit:** All research questions answered with evidence

Analyze gathered sources. Extract key findings, identify patterns, compare approaches, note trade-offs.

### 4. Gap Identification (Loop: analyze-refine)
**Agent:** analyst | **Model:** Claude Sonnet

Review analysis for gaps. Identify unanswered questions and gather additional sources if needed.

### 5. Synthesis
**Agent:** writer | **Model:** Claude Opus

Produce a synthesis document: executive summary, key findings, recommendations, and references. Write in plain English.
