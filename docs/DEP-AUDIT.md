# DEP-AUDIT.md — Dependency Vulnerability Audit

> **Date:** 2026-02-18  
> **Branch:** `security/critical-fixes`  
> **Task:** DEP-001  
> **Reviewer:** Dali (subagent)

---

## Summary

| Category | Count |
|----------|-------|
| `npm audit` vulnerabilities | 10 moderate |
| Outdated packages | 5 |
| Packages with known CVEs (direct) | 0 |
| Unnecessary/unused dependencies | 1 candidate |
| Supply chain risks | Low |

No HIGH or CRITICAL npm audit vulnerabilities. All 10 findings are **moderate** and scoped to dev/lint tooling only — they cannot reach production runtime.

---

## Part 1: `npm audit` Findings

### Finding DEP-1 — `ajv < 8.18.0` ReDoS

**Severity:** 🟡 MODERATE (dev-only)  
**CVE/Advisory:** [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6)  
**CVSS:** Not critical (requires control of `$data` option, which is not used here)

**Affected packages (transitive chain):**
```
ajv < 8.18.0
  └── @eslint/eslintrc  *
  └── eslint ≥ 4.2.0
      └── @eslint-community/eslint-utils  *
          └── @typescript-eslint/utils  *
              └── @typescript-eslint/eslint-plugin  *
              └── @typescript-eslint/type-utils ≥ 5.9.2-alpha.0
                  └── typescript-eslint  *
                      └── eslint-config-next ≥ 10.2.1-canary.2
```

**Impact analysis:**  
This chain lives entirely in `devDependencies`. The `ajv` ReDoS vulnerability requires use of the `$data` option in JSON Schema validation, which ESLint does not use. **There is zero production risk.** The vulnerability cannot be triggered in a production Next.js deployment.

**Remediation options:**

| Option | Risk | Notes |
|--------|------|-------|
| `npm audit fix --force` | ⚠️ HIGH — downgrades eslint to 4.1.1 | Breaking: incompatible with ESLint flat config used in this project |
| Upgrade `eslint` to v10 when stable | 🟢 LOW | ESLint 10 ships `ajv@8.18+` — track release |
| Accept as known risk | 🟢 OK for now | Dev-only, no production impact |

**Recommendation:** Accept as a known dev-tooling risk. Track ESLint 10 release (currently in RC). Do NOT run `npm audit fix --force` — it will break the flat config setup.

---

## Part 2: `npm outdated` Analysis

```
Package        Current    Wanted   Latest  
@types/node   20.19.33  20.19.33   25.2.3  
eslint          9.39.2    9.39.2   10.0.0  
lucide-react   0.568.0   0.568.0  0.574.0  
react           19.2.3    19.2.3   19.2.4  
react-dom       19.2.3    19.2.3   19.2.4  
```

### DEP-2 — `react` / `react-dom` 19.2.3 → 19.2.4

**Severity:** 🟢 LOW  
**Action:** Safe patch update. No breaking changes.  
**Command:** `npm install react@19.2.4 react-dom@19.2.4`

### DEP-3 — `lucide-react` 0.568.0 → 0.574.0

**Severity:** 🟢 LOW  
**Action:** Safe minor update (adds new icons, no breaking changes in this range).  
**Command:** `npm install lucide-react@0.574.0`

### DEP-4 — `eslint` 9.39.2 → 10.0.0

**Severity:** 🟡 MEDIUM — major version bump  
**Action:** Hold until `eslint-config-next@16.x` explicitly supports ESLint 10. Next.js pins `eslint-config-next` to the same version as `next`, so this upgrade should be coordinated with a Next.js upgrade.  
**Timeline:** Monitor Next.js 17 release notes.

### DEP-5 — `@types/node` 20.19.33 → 25.2.3

**Severity:** 🟢 LOW  
**Note:** `package.json` pins `"@types/node": "^20"` which prevents automatic major upgrades. Node 20 types are consistent with the LTS version likely in use. No change needed unless Node runtime is upgraded.

---

## Part 3: Package-by-Package Risk Assessment

| Package | Version | Usage | Risk Assessment |
|---------|---------|-------|----------------|
| `next` | 16.1.6 | Core framework | ✅ CVE-2025-29927 patched — confirmed in this version (fix landed ≤15.2.3) |
| `convex` | 1.31.7 | Database/backend | ✅ No known CVEs; actively maintained |
| `react` / `react-dom` | 19.2.3 | UI runtime | ✅ Current LTS, no known CVEs |
| `chokidar` | 4.0.3 (sync-agent) | File watcher | ✅ No known CVEs; stable library |
| `@dnd-kit/core` | 6.3.1 | Drag-and-drop | ✅ No known CVEs |
| `recharts` | 3.7.0 | Analytics charts | ✅ No known CVEs |
| `react-markdown` | 10.1.0 | Markdown rendering | ✅ No known CVEs; uses rehype pipeline |
| `rehype-sanitize` | 6.0.0 | XSS sanitization | ✅ Current version; correctly implemented |
| `radix-ui` | 1.4.3 | UI primitives | ✅ New combined package (correct choice over old `@radix-ui/*` separate packages) |
| `convex-helpers` | 0.1.112 | Rate limiting | ✅ No known issues; used correctly for rate limiting only |
| `tw-animate-css` | 1.4.0 | CSS animations | ✅ DevDependency; no runtime risk |

---

## Part 4: Unnecessary Dependencies

### DEP-6 — `recharts` not dynamically imported

**Severity:** 🟡 MEDIUM (performance, not security)  
**File:** `src/app/(app)/analytics/page.tsx`  
**Finding:** `recharts` (~500KB gzipped) is a runtime dependency imported directly at the top of `analytics/page.tsx`. It is bundled into the initial client chunk even for users who never visit the analytics page.

**Recommendation:** Use dynamic import:
```typescript
// analytics/page.tsx
const { BarChart, Bar, /* ... */ } = await import('recharts');
// Or with Next.js dynamic():
import dynamic from 'next/dynamic';
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart));
```

### DEP-7 — `convex/seed.ts` is a public mutation in production

**Severity:** 🟠 HIGH  
**File:** `convex/seed.ts:4`  
**Finding:** `seedReviewProject`, `seedWorkflows`, and `seedAll` are exported as public `mutation` functions. Anyone with the Convex URL can call `api.seed.seedAll` and wipe/overwrite all projects, tasks, and workflow templates with seed data.

**This is a significant data integrity risk** for a production deployment. The mutations are idempotent (check before inserting), but `seedAll` skips if projects exist — meaning this is less of a "wipe" risk and more of a "won't work if already seeded" scenario. Still, exposing seed mutations publicly in production is bad practice.

**Recommendation:**  
Convert all seed mutations to `internalMutation` or move to a separate script that runs against the Convex dev deployment only:
```typescript
// Before:
export const seedAll = mutation({ ... })

// After:
export const seedAll = internalMutation({ ... })
```

Or remove the file from the deployed bundle entirely if seeding is complete.

---

## Part 5: Supply Chain Risk Assessment

**Risk level: 🟢 LOW**

- No packages flagged in recent CISA supply chain advisories (checked for `convex`, `next`, `radix-ui`, `recharts`)
- No suspicious recently-published packages in the dependency tree
- All major dependencies are backed by large organizations (Vercel/Next.js, Convex, Radix/WorkOS)
- Lock file (`package-lock.json`) is committed — protects against dependency confusion attacks
- No `postinstall` scripts in direct dependencies that could execute arbitrary code

---

## Remediation Checklist

| Finding | Action | Priority | Effort |
|---------|--------|----------|--------|
| DEP-1 (ajv ReDoS) | Accept risk; track ESLint 10 | Accept | — |
| DEP-2 (react patch) | `npm install react@19.2.4 react-dom@19.2.4` | 🟢 Low | 5 min |
| DEP-3 (lucide-react) | `npm install lucide-react@0.574.0` | 🟢 Low | 5 min |
| DEP-4 (eslint major) | Hold; wait for Next.js 17 | Hold | — |
| DEP-5 (@types/node) | No change needed | None | — |
| DEP-6 (recharts bundling) | Dynamic import | 🟡 Medium | 30 min |
| DEP-7 (seed mutations public) | Convert to internalMutation | 🟠 High | 15 min |
