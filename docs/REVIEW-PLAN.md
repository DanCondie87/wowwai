# WOWWAI Multi-Layered Code, Testing & Security Review Plan

> **Version:** 1.0  
> **Date:** February 2026  
> **App:** WOWWAI — Ways of Working With AI (wowwai.vercel.app)  
> **Stack:** Next.js 16.1.6 + Convex + Tailwind + shadcn/ui  
> **Methodology:** Multi-model, multi-dimensional agentic review

---

## Executive Summary

WOWWAI is a single-user project management tool with elevated risk due to:

1. **File system write capability** — the sync-agent writes arbitrary content from Convex to local disk
2. **Unauthenticated Convex queries/mutations** — the entire database is publicly readable and writable by anyone with the Convex URL
3. **Custom auth implementation** — homegrown session tokens are subtle to implement correctly
4. **No test suite** — zero tests currently exist, making regressions invisible

This plan structures the review as **7 parallel dimensions**, each assigned to a specialized agent session. The Security Audit must run first (blocking issues may change architecture). Other dimensions can run in parallel after Security findings are communicated.

### Critical Vulnerabilities Identified (Pre-Review)

These were found during planning research and should be fixed **before** running the full review:

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | All Convex public queries/mutations unauthenticated | `convex/*.ts` | 🔴 CRITICAL |
| 2 | `fileSyncQueue.enqueue` is public — enables file write injection | `convex/fileSyncQueue.ts` | 🔴 CRITICAL |
| 3 | `export.getFullExport` unauthenticated — full data dump | `convex/export.ts` | 🔴 CRITICAL |
| 4 | Timing attack: `hash === expected` in password comparison | `src/lib/auth.ts:30` | 🟠 HIGH |
| 5 | Timing attack: `sig !== expectedSig` in session token | `src/lib/auth.ts:66` | 🟠 HIGH |
| 6 | Timing attack: `secret === expected` in Convex HTTP agent secret | `convex/http.ts:22` | 🟠 HIGH |
| 7 | `script-src 'unsafe-inline'` in CSP | `next.config.ts` | 🟠 HIGH |
| 8 | SHA-256 for password hashing (fast hash, easily brute-forced) | `src/lib/auth.ts` | 🟡 MEDIUM |
| 9 | `pathname.includes(".")` in middleware can bypass auth | `middleware.ts:17` | 🟡 MEDIUM |

---

## Methodology: Multi-Model, Multi-Dimensional Review

### Approach
Each dimension is an independent **agent session** with:
- A focused context (only the relevant files)
- A specific model chosen for that task type
- Clear deliverables and acceptance criteria
- Tasks tracked in WOWWAI itself (dogfooding)

### Model Assignment Rationale

| Model | Best For |
|-------|----------|
| **claude-opus** | Deep security reasoning, subtle bug patterns, architecture design |
| **claude-sonnet** | Balanced analysis, testing strategies, code quality, documentation |
| **claude-codex** (OpenAI) | Writing actual test code, fixing implementation bugs, boilerplate generation |
| **claude-haiku** | Quick checks, formatting, dependency lists, low-complexity tasks |

### Execution Order

```
Phase 1 (Now): Security Audit [BLOCKING — must fix criticals before other phases]
Phase 2 (Parallel after SEC): Dependency Audit + Code Quality
Phase 3 (After Phase 2): Testing Coverage + Architecture Review  
Phase 4 (Final): Frontend Review + Performance
```

---

## Dimension 1: 🔒 Security Audit

**Priority:** CRITICAL  
**Model:** claude-opus (deep reasoning required)  
**Blocking:** Yes — must complete before other phases  
**Estimated sessions:** 3–4

### Objective
Identify all security vulnerabilities, authenticate the threat model for a single-user personal tool, and produce a prioritized remediation list.

### Files to Review
- `src/lib/auth.ts` — authentication implementation
- `middleware.ts` — auth enforcement
- `src/app/api/auth/login/route.ts` — login endpoint
- `convex/http.ts` — HTTP API with agent/sync endpoints
- `convex/tasks.ts`, `convex/export.ts`, `convex/fileSyncQueue.ts` — unauthenticated mutations
- `convex/fileVersions.ts` — file content storage
- `sync-agent/index.js` — local file writer
- `next.config.ts` — security headers
- `src/components/ui/markdown.tsx` — XSS via markdown rendering

### Subtasks

#### SEC-001: Auth Implementation Audit
**Model:** claude-opus  
**Priority:** CRITICAL  
**Context files:** `src/lib/auth.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`

**Checks:**
- [ ] Identify all non-constant-time string comparisons
- [ ] Assess SHA-256 password hashing: is it safe given entropy + rate limiting?
- [ ] Cookie hardening: httpOnly ✓, secure ✓, sameSite:lax → should it be strict?
- [ ] Session token claims: exp field validated ✓, iat field ignored — is that safe?
- [ ] CSRF risk: `sameSite: "lax"` adequacy for this threat model
- [ ] Token rotation: should tokens be refreshed on activity?
- [ ] `AUTH_SECRET` entropy requirements — document minimum requirement

**Expected output:** Remediation PR or issue list with code patches

**Acceptance criteria:** All comparisons use timing-safe equivalents; cookie flags documented and justified; SHA-256 risk acknowledged or replaced

---

#### SEC-002: Middleware Auth Bypass Analysis
**Model:** claude-opus  
**Priority:** CRITICAL  
**Context files:** `middleware.ts`, `next.config.ts`

**Checks:**
- [ ] Verify Next.js 16.1.6 is not vulnerable to CVE-2025-29927 (check patch notes)
- [ ] Audit `PUBLIC_ROUTES` list — is `/api/agent` correctly excluded from middleware?
- [ ] Assess `pathname.includes(".")` bypass — can a crafted path with `.` in it reach protected routes?
- [ ] Test: can `/dashboard%2Efile` bypass the dot check?
- [ ] Verify middleware `matcher` regex doesn't have gaps
- [ ] Assess: does the app need server-side auth checks in pages in addition to middleware?

**Expected output:** Confirmed CVE status, list of potential bypass vectors with PoC paths

**Acceptance criteria:** Middleware bypass vectors documented; CVE status confirmed; secondary auth layer recommended if needed

---

#### SEC-003: Convex Unauthenticated Access Remediation Plan
**Model:** claude-opus  
**Priority:** CRITICAL  
**Context files:** All `convex/*.ts` files, `src/components/convex-provider.tsx`

**Checks:**
- [ ] Map every public `query`, `mutation`, and `action` — categorize as needing auth or legitimately public
- [ ] Assess the threat: Convex URL is in client bundle → public, though typically obfuscated
- [ ] Design auth propagation: how to pass the user's session token to Convex for server-side validation?
- [ ] Identify: should WOWWAI use Convex's built-in auth system (Clerk, Auth0, custom JWT) or custom header-based auth?
- [ ] `getFullExport` — must be protected; anyone can call it and dump all data
- [ ] `fileSyncQueue.enqueue` — must be protected; this is an indirect file write vector
- [ ] Design: can Convex functions check `ctx.auth` with a custom JWT from the session token?

**Expected output:** Architecture decision record + migration plan for adding auth to all public Convex functions

**Acceptance criteria:** All sensitive queries/mutations have auth checks; `getFullExport` and `enqueue` are protected

---

#### SEC-004: File System Write Security Audit
**Model:** claude-opus  
**Priority:** CRITICAL  
**Context files:** `sync-agent/index.js`, `sync-agent/config.json`, `convex/fileSyncQueue.ts`, `convex/fileVersions.ts`

**Checks:**
- [ ] Review `resolveSafePath` — is `startsWith(PROJECT_ROOT)` sufficient on Windows (case sensitivity)?
- [ ] Symlink attack: can an attacker create a symlink inside `docs/` that points outside project root?
- [ ] Extension allowlist: `.md`, `.json`, `.yaml`, `.txt` — are all safe to write?
- [ ] Content validation: is there any content sanitization before writing to disk?
- [ ] Since `enqueue` mutation is unauthenticated, an attacker can queue content for any allowed-extension file
- [ ] Assess: the path is validated client-side in sync-agent, but content from Convex has no validation
- [ ] Windows path normalization: `resolve()` with Windows paths — any edge cases?

**Expected output:** Security assessment with specific attack scenarios and mitigations

**Acceptance criteria:** All file write vectors have validated mitigations; `enqueue` auth status addressed in SEC-003

---

#### SEC-005: HTTP API & Agent Secret Security
**Model:** claude-opus  
**Priority:** HIGH  
**Context files:** `convex/http.ts`, `src/lib/agent-client.ts`

**Checks:**
- [ ] `verifySecret` uses `secret === expected` — timing attack; replace with HMAC comparison
- [ ] CORS policy: `allowed` array construction — does it correctly handle all Vercel preview URLs?
- [ ] CORS: `effectiveOrigin = ... : allowed[0]` — if `origin` doesn't match, defaults to first allowed origin; is this the right behavior?
- [ ] Rate limit: 10/min global for all agent calls — is there per-IP or per-key rate limiting?
- [ ] Validate all body inputs: `cardId`, `filePath`, `content` — are there injection risks in how these are stored?
- [ ] `AGENT_SECRET` in environment — ensure it's not exposed in Vercel logs or error messages

**Expected output:** Timing attack fix + CORS/rate limit assessment

**Acceptance criteria:** `verifySecret` uses timing-safe comparison; CORS logic is clearly correct; rate limiting is adequate

---

#### SEC-006: CSP & Security Header Hardening
**Model:** claude-sonnet  
**Priority:** HIGH  
**Context files:** `next.config.ts`, `src/components/ui/markdown.tsx`

**Checks:**
- [ ] Remove `'unsafe-inline'` from `script-src` — identify what requires it and find alternatives (nonces, hashes)
- [ ] Add `nonce` support for inline scripts if Next.js requires them
- [ ] Add `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Add `Permissions-Policy` header
- [ ] Add `Strict-Transport-Security` (HSTS) header
- [ ] Add `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy`
- [ ] Review `img-src 'self' data: https:` — `https:` is very permissive, consider restricting to specific domains
- [ ] Verify `rehype-sanitize` is correctly configured in markdown renderer

**Expected output:** Updated `next.config.ts` with hardened headers + `markdown.tsx` sanitization review

**Acceptance criteria:** CSP does not contain `unsafe-inline` for scripts; HSTS, Permissions-Policy, Referrer-Policy present

---

## Dimension 2: 🧪 Testing Coverage

**Priority:** HIGH  
**Model:** claude-sonnet (strategy), claude-codex (test implementation)  
**Blocking:** No (can run parallel with Dim 3)

### Objective
Establish a testing baseline from zero. Define and implement the minimal test suite that provides meaningful confidence in auth, API, and sync behavior.

### Current Status
**Zero tests.** No test framework configured in `package.json`. This is the highest non-security gap.

### Subtasks

#### TEST-001: Test Infrastructure Setup
**Model:** claude-codex  
**Priority:** HIGH

**Tasks:**
- [ ] Install and configure Vitest (preferred for Next.js App Router — Jest has config complexity)
- [ ] Install `@testing-library/react` for component tests
- [ ] Install `@playwright/test` for E2E
- [ ] Install `@convex-dev/testing` for Convex function tests
- [ ] Configure `vitest.config.ts` with Next.js compatibility
- [ ] Add test scripts to `package.json`: `test`, `test:e2e`, `test:coverage`
- [ ] Set up test folder structure: `src/__tests__/`, `convex/__tests__/`, `e2e/`

**Expected output:** Working test infrastructure with one passing smoke test

**Acceptance criteria:** `npm test` runs successfully; `npm run test:e2e` starts and runs a basic navigation test

---

#### TEST-002: Auth Unit Tests
**Model:** claude-codex  
**Priority:** CRITICAL  
**Context files:** `src/lib/auth.ts`

**Tests to write:**
- [ ] `sha256()` — deterministic output for known input
- [ ] `sign()` — different secrets produce different signatures
- [ ] `createSessionToken()` — token contains valid base64-encoded JSON + signature
- [ ] `verifySessionToken()` — valid token returns true
- [ ] `verifySessionToken()` — expired token returns false
- [ ] `verifySessionToken()` — tampered payload returns false
- [ ] `verifySessionToken()` — tampered signature returns false
- [ ] `verifyPassword()` — correct password returns true
- [ ] `verifyPassword()` — wrong password returns false
- [ ] Edge cases: empty token, malformed token, missing period separator

**Expected output:** `src/__tests__/lib/auth.test.ts` with ≥15 passing tests

**Acceptance criteria:** Full branch coverage of `auth.ts`; all edge cases covered

---

#### TEST-003: API Route Integration Tests
**Model:** claude-codex  
**Priority:** HIGH  
**Context files:** `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`

**Tests to write:**
- [ ] POST `/api/auth/login` with correct password → 200, cookie set
- [ ] POST `/api/auth/login` with wrong password → 401
- [ ] POST `/api/auth/login` with missing password → 400
- [ ] POST `/api/auth/login` 5 times with wrong password → 6th attempt 429
- [ ] POST `/api/auth/logout` → 200, cookie cleared
- [ ] Login sets cookie with correct flags: httpOnly, secure, sameSite

**Expected output:** `src/__tests__/api/auth.test.ts`

**Acceptance criteria:** Rate limiting, error responses, and cookie behavior all tested

---

#### TEST-004: Middleware Tests
**Model:** claude-codex  
**Priority:** HIGH  
**Context files:** `middleware.ts`, `src/lib/auth.ts`

**Tests to write:**
- [ ] Request to `/` without cookie → redirects to `/login`
- [ ] Request to `/login` without cookie → passes through
- [ ] Request to `/api/auth/login` without cookie → passes through
- [ ] Request to `/_next/static/...` → passes through
- [ ] Request to `/` with valid session cookie → passes through
- [ ] Request to `/` with expired session cookie → redirects, clears cookie
- [ ] Request to `/` with tampered session cookie → redirects

**Expected output:** `src/__tests__/middleware.test.ts`

**Acceptance criteria:** Auth enforcement tested; bypass vectors have tests that confirm they're blocked

---

#### TEST-005: E2E Test Suite (Playwright)
**Model:** claude-codex  
**Priority:** HIGH

**Tests to write:**
- [ ] Login flow: enter correct password → redirect to dashboard
- [ ] Login flow: enter wrong password → error message shown
- [ ] Protected route: navigate to `/board` without auth → redirect to login
- [ ] Create task: fill form, submit → task appears in Backlog column
- [ ] Move task: drag from Backlog to In Progress → task updates position
- [ ] Logout: click logout → redirect to login, session cookie cleared

**Expected output:** `e2e/auth.spec.ts`, `e2e/tasks.spec.ts`

**Acceptance criteria:** E2E suite passes against dev server; CI-ready (works headless)

---

#### TEST-006: Convex Function Tests
**Model:** claude-codex  
**Priority:** MEDIUM  
**Context files:** `convex/tasks.ts`, `convex/projects.ts`

**Tests to write:**
- [ ] `tasks.create` — creates task with correct defaults
- [ ] `tasks.create` — generates correct cardId format (`{SLUG}-{N}`)
- [ ] `tasks.moveToColumn` — sets completedAt when moved to "done"
- [ ] `tasks.reorder` — updates position
- [ ] `tasks.getById` — returns subtasks in response
- [ ] `projects.create` — creates project with correct fields

**Expected output:** `convex/__tests__/tasks.test.ts`

**Acceptance criteria:** Core task lifecycle operations have test coverage

---

## Dimension 3: 📐 Code Quality

**Priority:** HIGH  
**Model:** claude-sonnet  
**Blocking:** No

### Objective
Identify TypeScript strictness gaps, error handling anti-patterns, dead code, and inconsistent patterns that increase bug risk.

### Subtasks

#### QUAL-001: TypeScript Strictness Audit
**Model:** claude-sonnet  
**Priority:** HIGH

**Checks:**
- [ ] Review `tsconfig.json` — is `strict: true` enabled? Are all strict checks on?
- [ ] Check for `any` types — how many, where, and can they be eliminated?
- [ ] Check for non-null assertions (`!`) — identify unsafe uses
- [ ] Check for `as` casts — are they safe?
- [ ] Convex validators — do all mutation `args` match their handler type usage?
- [ ] Check `convex/_generated/` types are aligned with actual schema

**Expected output:** `QUAL-TYPESCRIPT.md` with findings and recommended tsconfig changes

---

#### QUAL-002: Error Handling Review
**Model:** claude-sonnet  
**Priority:** HIGH

**Checks:**
- [ ] API routes: are all async operations wrapped in try/catch?
- [ ] `login/route.ts` has `catch {}` — does it leak info in errors?
- [ ] Convex mutations: do they throw meaningful errors that surface to UI?
- [ ] `sync-agent/index.js`: catch blocks mark items as "conflict" — is this correct?
- [ ] Client-side: are Convex query errors handled in UI? (loading states, error boundaries?)
- [ ] `JSON.parse` calls — all should be wrapped in try/catch
- [ ] `atob` in `verifySessionToken` — can throw on invalid base64

**Expected output:** List of unhandled error cases + code patches for critical ones

---

#### QUAL-003: Dead Code & Unused Dependencies
**Model:** claude-haiku  
**Priority:** MEDIUM

**Checks:**
- [ ] Run `npx ts-unused-exports` to find unused exports
- [ ] Check `package.json` dependencies — are all listed packages actually imported?
- [ ] Check `scripts/` folder — are migration scripts still needed?
- [ ] Check `convex/seed.ts` — is this used in production?
- [ ] Check `convex/recommend.ts` and `convex/search.ts` — are these wired up?
- [ ] Check `convex/analytics.ts` — is this used?

**Expected output:** List of removable files/deps

---

#### QUAL-004: Consistent Patterns Audit
**Model:** claude-sonnet  
**Priority:** MEDIUM

**Checks:**
- [ ] Convex: some functions use `internal*` prefix, some don't — document the convention
- [ ] API routes: some return `NextResponse.json`, some return `new Response` — standardize
- [ ] Auth: `AUTH_COOKIE` exported from auth.ts but redefined elsewhere?
- [ ] Convex http.ts: `corsHeaders()` always returns an `effectiveOrigin` even when origin doesn't match allowed list — document intent
- [ ] Check actor field in auditLogs: `"dan"` vs `"dali"` hardcoded — should this be dynamic?

**Expected output:** `QUAL-PATTERNS.md` with conventions to document or standardize

---

## Dimension 4: 🏗️ Architecture Review

**Priority:** MEDIUM  
**Model:** claude-sonnet  
**Blocking:** No (parallel with Dim 3)

### Objective
Assess structural decisions: Convex schema design, API route organization, middleware chain, and component hierarchy for long-term maintainability.

### Subtasks

#### ARCH-001: Convex Schema & Access Pattern Review
**Model:** claude-sonnet  
**Priority:** HIGH

**Checks:**
- [ ] `fileSyncQueue.direction` is `v.string()` — should be `v.union(v.literal("to-local"), v.literal("to-cloud"))`
- [ ] `fileSyncQueue.status` is `v.string()` — should be `v.union(v.literal("pending"), v.literal("synced"), v.literal("conflict"))`
- [ ] `agentActivity.status` is `v.string()` — should be typed literal union
- [ ] `workflowSteps.references[].type` is `v.string()` — could benefit from typed enum
- [ ] `auditLogs.actor` is typed union — good, maintain this pattern everywhere
- [ ] Indexes: verify all common query patterns have corresponding indexes
- [ ] No soft delete pattern — is hard delete appropriate for this app?
- [ ] `getAll()` loads all tasks without pagination — risk for large datasets

**Expected output:** Schema improvement recommendations with migration plan

---

#### ARCH-002: API Route Structure
**Model:** claude-sonnet  
**Priority:** MEDIUM

**Checks:**
- [ ] Why are agent calls going through Convex HTTP routes instead of Next.js API routes? Document the rationale
- [ ] `/api/agent` is bypassed in middleware — is this documented and intentional?
- [ ] Convex HTTP routes handle file sync — could this be simplified by using Next.js API routes?
- [ ] Consider: should the Convex HTTP layer be the only entry point for agent operations, or should some go through Next.js?
- [ ] Document the data flow: Browser → Next.js → Convex vs. Agent → Convex HTTP

**Expected output:** Architecture diagram + decision record in `DECISIONS.md`

---

#### ARCH-003: Middleware Chain & Route Groups
**Model:** claude-sonnet  
**Priority:** MEDIUM

**Checks:**
- [ ] Next.js `(app)` route group — does the layout.tsx in `(app)` add a second auth check?
- [ ] Is there any server-side auth check in page components, or only in middleware?
- [ ] The `(app)/layout.tsx` — does it assume auth (no fallback for unauthenticated)?
- [ ] Static vs. dynamic pages — which pages could be prerendered?

**Expected output:** Route/auth flow documentation

---

## Dimension 5: 🌐 Frontend Review

**Priority:** MEDIUM  
**Model:** claude-sonnet  
**Blocking:** No

### Objective
Assess XSS prevention, accessibility, error/loading states, and responsive design quality.

### Subtasks

#### FRONT-001: XSS & Injection Review
**Model:** claude-sonnet  
**Priority:** HIGH

**Checks:**
- [ ] `src/components/ui/markdown.tsx` — is `rehype-sanitize` properly configured to block `<script>`, `javascript:` href, `onload` attributes?
- [ ] Any `dangerouslySetInnerHTML` usage in codebase — audit all instances
- [ ] Task title/description — user-controlled input rendered in UI — is it escaped?
- [ ] `command-palette.tsx` — search results rendered from Convex — XSS risk?
- [ ] `audit-trail.tsx` — renders audit log content including `before`/`after` from Convex — are these sanitized?
- [ ] Workflow step `content` field — rendered where?

**Expected output:** XSS audit findings with fixes

---

#### FRONT-002: Error & Loading State Completeness
**Model:** claude-sonnet  
**Priority:** MEDIUM

**Checks:**
- [ ] Convex query hooks return `undefined` while loading — do all components handle this gracefully?
- [ ] Failed mutations — do components show error feedback?
- [ ] Offline state — is `offline-banner.tsx` comprehensive?
- [ ] Empty states — what shows when there are no tasks/projects?
- [ ] `agent-activity-indicator.tsx` — what if activity query fails?

**Expected output:** List of UI states without proper error/loading handling

---

#### FRONT-003: Accessibility (a11y)
**Model:** claude-sonnet  
**Priority:** MEDIUM

**Checks:**
- [ ] Kanban board — is it keyboard navigable?
- [ ] Drag-and-drop with `@dnd-kit` — does it have keyboard fallback?
- [ ] Color-only status indicators — do they have text alternatives?
- [ ] Dialog/Sheet components — focus trap, ESC key, ARIA attributes?
- [ ] Theme toggle — announces change to screen readers?

**Expected output:** a11y issues list ordered by WCAG impact level

---

## Dimension 6: 📦 Dependency Audit

**Priority:** MEDIUM  
**Model:** claude-haiku (for structured analysis), claude-sonnet (for risk assessment)  
**Blocking:** No

### Subtasks

#### DEP-001: Security Vulnerability Scan
**Model:** claude-haiku  
**Priority:** HIGH

**Tasks:**
- [ ] Run `npm audit` — document all findings
- [ ] Cross-reference `next@16.1.6` against CVE-2025-29927 patch status
- [ ] Check `convex@1.31.7` for known issues
- [ ] Check `chokidar@4.0.3` in sync-agent
- [ ] Review recently updated packages for supply chain risk (per CISA 2025 advisory)

**Expected output:** `DEP-AUDIT.md` with all vulnerabilities and remediation

---

#### DEP-002: Outdated & Unnecessary Dependencies
**Model:** claude-haiku  
**Priority:** MEDIUM

**Tasks:**
- [ ] Run `npm outdated` — list packages with available updates
- [ ] Check if `convex-helpers` is used correctly (it's used for rate limiting only)
- [ ] `radix-ui` vs `@radix-ui/react-*` — which is the correct package? (radix-ui is the new combined package)
- [ ] `tw-animate-css` — is this used? Check against actual animation usage
- [ ] No test framework in devDependencies — add Vitest + Playwright (covered in TEST-001)
- [ ] `shadcn` CLI in devDependencies — needed for component generation but not at runtime ✓

**Expected output:** Upgrade plan with risk assessment per package

---

#### DEP-003: Bundle Size Analysis
**Model:** claude-haiku  
**Priority:** LOW

**Tasks:**
- [ ] Run `next build` and analyze `.next/analyze/` output
- [ ] Identify largest client bundle contributors
- [ ] Check if `recharts` is only used in analytics page (it should be dynamically imported)
- [ ] Check if `@dnd-kit` is only loaded on the board page

**Expected output:** Bundle size baseline and optimization opportunities

---

## Dimension 7: ⚡ Performance

**Priority:** LOW  
**Model:** claude-haiku  
**Blocking:** No

### Subtasks

#### PERF-001: Server vs. Client Component Audit
**Model:** claude-haiku  
**Priority:** LOW

**Checks:**
- [ ] Audit `"use client"` directives — are they at the leaf level or unnecessarily high?
- [ ] Which pages could be static (no Convex queries)?
- [ ] `login/page.tsx` — should be a server component (no dynamic data)
- [ ] Check if `ConvexProvider` forces entire app into client rendering

---

#### PERF-002: Convex Query Optimization
**Model:** claude-haiku  
**Priority:** LOW

**Checks:**
- [ ] `tasks.getAll()` — loads all tasks; add pagination or filtering
- [ ] `export.getFullExport()` — loads all tables; add pagination or streaming
- [ ] Multiple queries per page — consider combining with a single aggregate query
- [ ] `getByCardId` uses `.collect()` then `.find()` — should use a proper index search

**Expected output:** Query optimization recommendations

---

## Review Execution Checklist

### Before Starting
- [ ] Create a WOWWAI project for this review (REVIEW project in WOWWAI)
- [ ] Import `review-tasks.json` into WOWWAI
- [ ] Fix the 3 CRITICAL pre-identified issues (SEC-003 context) before security review

### Spawn Order
```
1. SEC-001 (auth timing) + SEC-002 (middleware) — in parallel
2. SEC-003 (Convex auth) + SEC-004 (file write) — in parallel  
3. SEC-005 (HTTP API) + SEC-006 (CSP headers) — in parallel
4. After SEC complete: DEP-001 (npm audit) + QUAL-001 (TypeScript)
5. TEST-001 (infra) → TEST-002+003+004 in parallel → TEST-005+006
6. ARCH-001 + FRONT-001 in parallel
7. Remaining tasks as capacity allows
```

### Agent Session Template
For each subtask, spawn with:
```
Model: [specified above]
Context: [list of files]
Task: [subtask ID + description]
Output: Update WOWWAI task [REVIEW-N] when complete
```

---

## Success Criteria

The review is considered complete when:

1. ✅ All CRITICAL security issues resolved and verified
2. ✅ All HIGH security issues resolved or have accepted mitigations
3. ✅ Test suite running with >60% coverage of auth and API layer
4. ✅ No `npm audit` HIGH or CRITICAL vulnerabilities
5. ✅ TypeScript strict mode enabled with no `any` in security-relevant code
6. ✅ All WOWWAI review tasks marked DONE
