# WOWWAI Testing Plan — TEST-001

> **Branch:** security/critical-fixes  
> **Date:** February 2026  
> **Reviewer:** Dali (subagent)  
> **Scope:** Testing infrastructure assessment + full test plan

---

## Current State: Zero Tests

**Confirmed: no test infrastructure exists.**

```
package.json scripts: dev | build | start | lint    (no test script)
devDependencies:      @tailwindcss/postcss | @types/* | eslint | shadcn | tailwindcss | typescript
```

No `jest.config.*`, `vitest.config.*`, or `playwright.config.*` found. No test files in `src/` or `convex/` directories (only node_modules contain test files from third-party libraries).

This means **zero automated regression protection**. Every change to auth, middleware, or Convex mutations is tested manually or not at all. Given the recent security fixes on this branch, establishing a test baseline is now the highest non-security priority.

---

## Recommended Stack

### Unit/Integration Tests: Vitest

**Why Vitest over Jest:**
- Native ESM support — no `transform` config hell for Next.js App Router
- TypeScript support out of the box (no `ts-jest` or `babel-jest` needed)
- Identical API to Jest — easy migration if switching later
- `@vitejs/plugin-react` handles JSX/TSX
- Fast — runs in parallel, watch mode is snappy
- Works well with `@testing-library/react` and `msw`

**Packages to install:**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
```

### E2E Tests: Playwright

**Why Playwright:**
- Official Next.js recommendation for E2E
- Multi-browser (Chromium, Firefox, WebKit)
- Built-in test runner (no Cypress-style separate process)
- `page.waitForLoadState()` handles Next.js navigation well
- Headless CI-ready out of the box

**Packages to install:**
```bash
npm install -D @playwright/test
npx playwright install chromium  # minimum; add firefox/webkit for full coverage
```

### Convex Function Tests: convex-test

**Why convex-test:**
- Official Convex testing library — runs queries/mutations against an in-memory Convex instance
- No network required — fully isolated
- Supports schema validation, indexes, and relationships

**Packages to install:**
```bash
npm install -D convex-test @edge-runtime/vm
```

---

## Configuration Files

### `vitest.config.ts` (create at project root)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "convex/**/*.test.ts"],
    exclude: ["node_modules", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["src/components/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

### `playwright.config.ts` (create at project root)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,  // sequential for single-user app with shared auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### `src/__tests__/setup.ts`

```typescript
import "@testing-library/jest-dom";
// Add any global mocks here
```

### `package.json` scripts (add these)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## Test Plan (Prioritised)

### Priority 1 — Auth Unit Tests (Implement First)

**File:** `src/__tests__/lib/auth.test.ts`  
**Why first:** Auth is the only security gate. It was recently rewritten (SEC-001). Pure functions = easy to test. High confidence return for minimal effort.

#### TEST-001-AUTH: `sha256()` — deterministic hashing

```typescript
import { describe, it, expect } from "vitest";

// Note: sha256 is not exported — test via verifyPassword indirectly,
// or temporarily export for testing and re-unexport after.
// Better: extract pure helper functions to a testable module.

describe("sha256", () => {
  it("produces consistent output for same input", async () => {
    // Test via verifyPassword with a known hash
    // AUTH_PASSWORD_HASH = sha256("correctpassword")
    process.env.AUTH_PASSWORD_HASH = "<pre-computed hash>";
    process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long";
    const { verifyPassword } = await import("@/lib/auth");
    
    await expect(verifyPassword("correctpassword")).resolves.toBe(true);
    await expect(verifyPassword("wrongpassword")).resolves.toBe(false);
  });
});
```

**All test cases for `src/__tests__/lib/auth.test.ts`:**

| Test | Description | Expected |
|------|-------------|----------|
| `verifyPassword` — correct | Correct password matches stored hash | `true` |
| `verifyPassword` — wrong | Wrong password doesn't match | `false` |
| `verifyPassword` — empty string | Empty password doesn't match | `false` |
| `verifyPassword` — case sensitive | "Password" ≠ "password" | `false` |
| `createSessionToken` — structure | Returns `base64payload.hexsig` format | Matches regex |
| `createSessionToken` — decodable | Payload decodes to valid JSON with user/iat/exp | Passes |
| `createSessionToken` — expiry | `exp` is approximately 30 days from now | `exp > Date.now()` |
| `verifySessionToken` — valid | Fresh token from `createSessionToken` verifies | `true` |
| `verifySessionToken` — expired | Token with `exp` in the past | `false` |
| `verifySessionToken` — tampered payload | Modify base64 payload, keep sig | `false` |
| `verifySessionToken` — tampered signature | Keep payload, modify hex signature | `false` |
| `verifySessionToken` — missing dot | Token without period separator | `false` |
| `verifySessionToken` — empty string | Empty token | `false` |
| `verifySessionToken` — invalid base64 | Payload is not valid base64 | `false` |
| `verifySessionToken` — wrong secret | Token signed with different secret | `false` |

**Setup requirement:** `auth.ts` uses `process.env.AUTH_SECRET` and `AUTH_PASSWORD_HASH`. Set these in `vitest.config.ts`'s `test.env` or in individual test setups using `vi.stubEnv`.

---

### Priority 2 — Middleware Tests

**File:** `src/__tests__/middleware.test.ts`  
**Why:** Middleware is the auth enforcement layer. Bypass vectors are critical. Recent security fixes (SEC-002) changed its behavior.

**Setup:** Middleware uses Next.js `NextRequest`/`NextResponse` — import from `next/server`. Run in Node environment (not jsdom).

| Test | Route | Cookie | Expected |
|------|-------|--------|----------|
| Protected route without cookie | `GET /board` | None | Redirect to `/login` |
| Protected route with valid cookie | `GET /board` | Valid session | Pass through (200) |
| Protected route with expired cookie | `GET /board` | Expired session | Redirect to `/login`, cookie cleared |
| Protected route with tampered cookie | `GET /board` | Modified payload | Redirect to `/login` |
| Login page without cookie | `GET /login` | None | Pass through (render login) |
| Login API without cookie | `POST /api/auth/login` | None | Pass through (auth endpoint) |
| Static assets without cookie | `GET /_next/static/chunk.js` | None | Pass through |
| Root redirect | `GET /` | Valid session | Redirect to `/board` |
| Root redirect without auth | `GET /` | None | Redirect to `/login` |
| Dot bypass attempt | `GET /board.json` | None | Pass through (file, not protected) |
| API agent route | `GET /api/agent` | None | Pass through (public agent endpoint) |

**Sample test structure:**
```typescript
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

function makeRequest(path: string, cookie?: string) {
  const req = new NextRequest(`http://localhost${path}`);
  if (cookie) req.cookies.set("wowwai_session", cookie);
  return req;
}

it("redirects unauthenticated request to /login", async () => {
  const req = makeRequest("/board");
  const res = await middleware(req);
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain("/login");
});
```

---

### Priority 3 — Login API Route Tests

**File:** `src/__tests__/api/auth-login.test.ts`  
**Why:** The login endpoint is the entry point for auth. Rate limiting, cookie flags, and error responses all need verification.

**Setup:** Mock `src/lib/auth.ts` functions. Use `node-mocks-http` or call Next.js route handlers directly.

| Test | Input | Expected |
|------|-------|----------|
| Correct password | `{ password: "correct" }` | 200, `Set-Cookie` header present |
| Wrong password | `{ password: "wrong" }` | 401, `{ error: "..." }` |
| Missing password field | `{}` | 400 |
| Empty password | `{ password: "" }` | 400 or 401 |
| Rate limit — 5th wrong attempt | 5 wrong POSTs | 6th attempt returns 429 |
| Rate limit — resets after window | Wait 15min (mock timer) | Accepts again |
| Cookie flags | Correct password | Cookie has `httpOnly`, `Secure`, `SameSite=Lax` |
| Cookie expiry | Correct password | Cookie `Max-Age` ≈ 30 days |
| Response body | Correct password | `{ ok: true }` or similar |

**Key check — rate limiting:**
The rate limiter uses `convex-helpers/server/rateLimit`. In unit tests, mock the Convex client. In integration tests, use a real Convex test environment.

---

### Priority 4 — Logout API Route Tests

**File:** `src/__tests__/api/auth-logout.test.ts`

| Test | Expected |
|------|----------|
| POST `/api/auth/logout` | 200, cookie cleared (Max-Age=0 or expires in past) |
| GET `/api/auth/logout` (wrong method) | 405 Method Not Allowed |
| Response redirects to login | Location: `/login` or body instructs client |

---

### Priority 5 — Convex Function Tests

**File:** `convex/__tests__/tasks.test.ts`  
**Why:** Task CRUD is the core business logic. `moveToColumn` with `completedAt` side-effect and `cardId` generation format are subtle enough to break silently.

**Setup:** Use `convex-test` to create an in-memory Convex environment.

```typescript
import { convexTest } from "convex-test";
import { api } from "../_generated/api";
import schema from "../schema";

const t = convexTest(schema);
```

| Test | Mutation/Query | Expected |
|------|----------------|----------|
| Create task | `tasks.create` with valid args | Document created, `cardId` matches `{SLUG}-{N}` format |
| Create task — cardId format | First task in project | `cardId = "SLUG-1"` |
| Create task — cardId increments | Second task | `cardId = "SLUG-2"` |
| Move to "done" | `tasks.moveToColumn` with status="done" | `completedAt` is set (non-null) |
| Move from "done" | `tasks.moveToColumn` with status="in-progress" | `completedAt` is cleared (null) |
| Update task — title | `tasks.update` with new title | `title` updated, `lastTouchedAt` updated |
| Update tags | `tasks.update` with `tags: ["foo", "bar"]` | Tags stored correctly |
| Reorder | `tasks.reorder` with new position | `position` updated |
| Get by project | `tasks.getByProject` | Only returns tasks for given projectId |
| Get by ID | `tasks.getById` | Returns task with embedded subtasks array |
| Get all tags | `tasks.getAllTags` | Returns deduplicated list of tags |

**File:** `convex/__tests__/projects.test.ts`

| Test | Mutation/Query | Expected |
|------|----------------|----------|
| Create project | `projects.create` | Document created with correct fields |
| Get all | `projects.getAll` | Returns all projects |
| Update name | `projects.update` | Name field changed |

---

### Priority 6 — E2E Tests (Playwright)

**File:** `e2e/auth.spec.ts`

```
Prerequisite: Set TEST_PASSWORD env var for E2E suite
```

| Test | Steps | Expected |
|------|-------|----------|
| Login — correct password | Navigate to `/login`, type password, submit | Redirected to `/board` |
| Login — wrong password | Type wrong password, submit | Error message shown, still on `/login` |
| Login — empty password | Submit empty form | Button disabled (no request sent) |
| Protected route redirect | Navigate directly to `/board` without auth | Redirected to `/login` |
| Session persistence | Login, close tab, reopen `/board` | Still authenticated (cookie persists) |
| Logout | Login, click logout button | Redirected to `/login`, session cleared |
| Post-logout redirect | After logout, navigate to `/board` | Redirected to `/login` |

**File:** `e2e/tasks.spec.ts`

| Test | Steps | Expected |
|------|-------|----------|
| Create task | Click "+ Add task" on Backlog, fill form, submit | Task card appears in Backlog column |
| Create task — validation | Submit form with empty title | Submit button is disabled |
| Open task detail | Click a task card | Detail sheet slides in from right |
| Edit task title | Click title in detail sheet, type new title, press Enter | Title updated (and `savedMessage` appears) |
| Move task via drag | Drag task card from Backlog to In Progress | Task appears in In Progress column |
| Move task via keyboard | Select card with j/k, press `→` arrow (keyboard shortcut) | Task moves to next column |
| Search task | Press Ctrl+K, type task title | Task appears in command palette results |
| Navigate via command palette | Select task in command palette | Detail sheet opens for that task |
| Create subtask | Open task, click "Add subtask" in subtask list | Subtask created and listed |

**File:** `e2e/navigation.spec.ts`

| Test | Steps | Expected |
|------|-------|----------|
| Board page loads | Navigate to `/board` | Kanban columns visible |
| My Work page | Click "My Work" in sidebar | Task list view loads |
| Workflows page | Click "Workflows" in sidebar | Workflow list loads |
| Settings page | Click "Settings" in sidebar | Settings page loads |
| Mobile menu | Resize to 375px, click hamburger | Sidebar slides in |
| Mobile sidebar close | Open sidebar, click X | Sidebar closes |

---

## Test Folder Structure

```
wowwai/
├── src/
│   └── __tests__/
│       ├── setup.ts              ← @testing-library/jest-dom + global mocks
│       ├── lib/
│       │   └── auth.test.ts      ← Priority 1 (auth functions)
│       ├── middleware.test.ts    ← Priority 2 (middleware)
│       └── api/
│           ├── auth-login.test.ts  ← Priority 3
│           └── auth-logout.test.ts ← Priority 4
├── convex/
│   └── __tests__/
│       ├── tasks.test.ts         ← Priority 5a
│       └── projects.test.ts      ← Priority 5b
└── e2e/
    ├── auth.spec.ts              ← Priority 6a
    ├── tasks.spec.ts             ← Priority 6b
    └── navigation.spec.ts        ← Priority 6c
```

---

## Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| `src/lib/auth.ts` | 100% branch coverage | Security-critical, pure functions |
| `src/middleware.ts` | 100% branch coverage | Auth enforcement — every path matters |
| `src/app/api/auth/` | >90% | Entry points for auth flow |
| `convex/tasks.ts` | >70% | Core business logic |
| `convex/projects.ts` | >70% | Core business logic |
| Components | >30% | E2E covers the critical paths |
| Overall | >60% | Meets REVIEW-PLAN.md success criteria |

---

## CI Integration (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
  
  e2e:
    runs-on: ubuntu-latest
    env:
      AUTH_SECRET: ${{ secrets.AUTH_SECRET_TEST }}
      AUTH_PASSWORD_HASH: ${{ secrets.AUTH_PASSWORD_HASH_TEST }}
      NEXT_PUBLIC_CONVEX_URL: ${{ secrets.CONVEX_URL_TEST }}
      TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Known Challenges

### 1. Auth functions use Web Crypto API
`src/lib/auth.ts` uses `crypto.subtle` which is available in Node.js v20+ (used in this project). Vitest with `jsdom` environment may need `globalThis.crypto` polyfilled — check Node version first.

**Mitigation:** Run auth tests in `node` environment (not `jsdom`):
```typescript
// auth.test.ts
// @vitest-environment node
```

### 2. Convex rate limiter in tests
The login route uses `convex-helpers` rate limiting backed by Convex. In unit tests, mock the entire Convex interaction. In integration tests, use `convex-test` with time-control (`vi.useFakeTimers()`).

### 3. Next.js middleware in Vitest
Middleware imports from `next/server` — these work in Node environment but require Next.js types. The `@types/node` and `typescript` setup should handle this, but verify `tsconfig.json` includes `"node"` in `lib`.

### 4. E2E requires running Convex dev deployment
Playwright E2E tests need a real Convex backend. Use the existing dev deployment for local testing and a dedicated test deployment for CI. Never run E2E tests against production.

---

## Implementation Order

```
Week 1:
  ├── Day 1: Install Vitest + React Testing Library + write vitest.config.ts
  ├── Day 2: Write auth.test.ts (15+ test cases) — should reach 100% on auth.ts
  └── Day 3: Write middleware.test.ts (11 test cases)

Week 2:
  ├── Day 1: Write auth-login.test.ts + auth-logout.test.ts
  ├── Day 2: Install convex-test + write tasks.test.ts
  └── Day 3: Write projects.test.ts

Week 3:
  ├── Day 1: Install Playwright + write e2e/auth.spec.ts
  ├── Day 2: Write e2e/tasks.spec.ts
  └── Day 3: Set up CI workflow + fix any CI-specific issues
```

Estimated total: **~15 days of focused implementation time** (can parallelize some tasks with Codex subagent for boilerplate generation).

---

## Quick Start Commands

```bash
# Install all test dependencies at once:
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom @testing-library/jest-dom @playwright/test convex-test @edge-runtime/vm

# Create vitest.config.ts + playwright.config.ts (see above)

# Run unit tests:
npm test

# Run with coverage:
npm run test:coverage

# Install Playwright browsers:
npx playwright install chromium

# Run E2E (requires dev server running):
npm run test:e2e

# Or run E2E with UI:
npm run test:e2e:ui
```
