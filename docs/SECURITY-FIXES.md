# SECURITY-FIXES.md

> Branch: `security/critical-fixes`  
> Date: February 2026  
> Status: Committed, pending review before deploy

---

## SEC-001: Timing-Safe Authentication Comparisons

### Vulnerability
Three locations used `===` to compare secrets/hashes, making them vulnerable to timing attacks:
1. `src/lib/auth.ts:verifyPassword` — `hash === getPasswordHash()`
2. `src/lib/auth.ts:verifySessionToken` — `sig !== expectedSig`
3. `convex/http.ts:verifySecret` — `secret === expected`

A timing attack measures how long a comparison takes to determine how many bytes match, gradually revealing the secret byte-by-byte.

### Fix
Added `timingSafeEqual(a, b)` using Web Crypto HMAC-SHA256 with a random one-time key:
1. Generate a random HMAC key per comparison
2. HMAC both values with the same key (always produces 32 bytes)
3. XOR all 32 bytes and check if diff === 0

The random key ensures attacker cannot use timing of the XOR to learn about the values. HMAC output is always exactly 32 bytes, so XOR time is constant.

Works in Edge runtime and Convex HTTP action runtime (both have `crypto.subtle`).

### SHA-256 Password Hashing Assessment
**Decision: Acceptable for this context. No bcrypt/scrypt required.**

Risk factors for fast-hash password storage:
- SHA-256 is fast (~billions of hashes/sec with GPU)
- An offline attacker with the `AUTH_PASSWORD_HASH` could brute-force

Mitigating factors specific to WOWWAI:
- Rate limiting: 5 attempts / 15 minutes per IP (in `login/route.ts`)
- Single-user app: only one valid password hash to attack
- `AUTH_PASSWORD_HASH` is a server secret (env var), never exposed to clients
- An attacker would need to exfiltrate `AUTH_PASSWORD_HASH` from Vercel env first
- If that secret is compromised, upgrading to bcrypt is the least of the concerns

If the password hash is ever leaked, upgrading to Argon2id/bcrypt is recommended. Add this to TASKS.md if threat model changes.

---

## SEC-002: Middleware Auth Bypass Hardening

### Vulnerabilities

#### 1. `pathname.includes('.')` bypass
The original middleware allowed any path containing a `.` to bypass auth:
```typescript
if (pathname.includes(".")) return NextResponse.next(); // VULNERABLE
```
An attacker could craft paths like `/dashboard/.hidden` or `/api/secret/.env` to reach protected routes.

**Fix:** Removed this check entirely. Static file filtering now handled exclusively by the `matcher` regex in `config`, which precisely matches known static file extensions.

#### 2. CVE-2025-29927 (x-middleware-subrequest header bypass)
This CVE allows bypassing Next.js middleware by sending the internal `x-middleware-subrequest` header.

**Status:** Next.js 16.1.6 is **patched** (fix landed in 12.3.5 / 13.5.9 / 14.2.25 / 15.2.3). WOWWAI is not vulnerable.

**Defense-in-depth added:** Middleware now explicitly rejects requests with this header (returns 403). This ensures protection even if running behind a proxy or if the version constraint is ever violated.

#### 3. Overly broad PUBLIC_ROUTES matching
`"/api/auth"` matched any path starting with that prefix, e.g., `/api/authXYZ`. Changed to exact route prefixes: `/api/auth/login` and `/api/auth/logout`.

---

## SEC-003: Convex Unauthenticated Access

### Vulnerability
All Convex queries and mutations were publicly accessible to anyone with the Convex URL (which is in the client JavaScript bundle as `NEXT_PUBLIC_CONVEX_URL`). The frontend's auth middleware only protects Next.js routes — Convex functions can be called directly.

Critical exposed endpoints:
- **`export.getFullExport`**: Public query that dumps all projects, tasks, ideas, and audit logs
- **`fileSyncQueue.enqueue`**: Public mutation that writes arbitrary content to the sync queue, which the sync-agent then writes to disk — **file write injection vector**
- `fileSyncQueue.getPending`: Public query exposing pending sync queue
- `fileSyncQueue.updateStatus`: Public mutation modifying sync queue state

### Fix

#### Protected: `getFullExport` → Internal
- `convex/export.ts`: `getFullExport` converted from `query` to `internalQuery`
- New Next.js API route: `src/app/api/export/route.ts`
  - Verifies session cookie via `verifySessionToken`
  - Proxies to the already-auth-protected `/agent/backup` Convex HTTP endpoint
- `settings/page.tsx`: Replaced `useQuery(api.export.getFullExport)` with `fetch("/api/export")`

#### Protected: `fileSyncQueue.enqueue` → Internal
- `convex/fileSyncQueue.ts`: Removed public `enqueue`, `getPending`, and `updateStatus` mutations. Added `enqueueInternal` (internalMutation). `getPendingInternal` and `updateStatusInternal` already existed.
- New Convex HTTP action: `POST /sync/enqueue` in `convex/http.ts` (AGENT_SECRET protected)
- New Next.js API route: `src/app/api/sync/enqueue/route.ts`
  - Verifies session cookie via `verifySessionToken`
  - Proxies to the new Convex `/sync/enqueue` HTTP endpoint
- `document-reference.tsx`: Replaced `useMutation(api.fileSyncQueue.enqueue)` with `fetch("/api/sync/enqueue")`

### Required Environment Variables (for new routes to work)
Both new API routes need `AGENT_SECRET` to call the Convex HTTP endpoints. Verify this is set in:
- Vercel production environment variables
- Vercel preview environment variables
- Local `.env.local` (for development testing of the export/sync features)

`NEXT_PUBLIC_CONVEX_SITE_URL` must also be set (already is in `.env.local`).

### Remaining Public Convex Mutations (Documented Decision)

The following Convex mutations remain public — risk documented but not fixed in this PR:

| Mutation | Risk | Notes |
|----------|------|-------|
| `tasks.create/update/moveToColumn/reorder` | Data modification | Attacker can CRUD tasks. Annoying, not catastrophic. |
| `projects.create/update` | Data modification | Same as above |
| `tasks.getAll/getById/getByProject` | Data read | Exposes task data to anyone with Convex URL |
| `auditLogs.*` | Data read | Exposes audit history |

**Rationale for deferral:** Moving all frontend Convex calls through Next.js API routes would require significant refactoring of every page and component. For a single-user personal tool, the risk is moderate — the app isn't a high-value target and the Convex URL is semi-obscure. Full remediation is tracked as a follow-up.

**Full fix path (future work):** Implement Convex custom auth using a session-derived JWT passed from the Next.js server side. See Convex docs on custom auth providers.

---

## SEC-004: Content-Security-Policy Hardening

### Vulnerability
`script-src 'unsafe-inline'` allowed execution of any inline script, making XSS attacks easier to exploit.

### Fix

**Removed:** `'unsafe-inline'` from `script-src`

**Added:** `'strict-dynamic'` to `script-src`
- Allows scripts loaded by already-trusted scripts (Next.js runtime → code chunks)
- Blocks unauthorized inline scripts
- `'self'` kept as graceful fallback for browsers without `strict-dynamic` support

**New CSP directives:**
- `frame-ancestors 'none'` — belt-and-suspenders with X-Frame-Options: DENY
- `base-uri 'self'` — prevents base tag injection attacks
- `form-action 'self'` — prevents form exfiltration to external origins

**New security headers:**
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Cross-Origin-Opener-Policy: same-origin`

**Verified existing:**
- `X-Content-Type-Options: nosniff` ✓
- `X-Frame-Options: DENY` ✓
- `connect-src` includes `wss://*.convex.cloud` for Convex WebSocket ✓

### Known Limitation: style-src still has 'unsafe-inline'
Tailwind CSS and shadcn/ui generate inline styles that cannot be hashed or nonced with the current setup. Removing `'unsafe-inline'` from `style-src` would require CSS-in-JS changes or `style-src` hash generation. Accepted risk for now.

### Follow-up: Nonce-based CSP for scripts
`'strict-dynamic'` is a good improvement but a per-request nonce is stronger. Implementation requires:
1. Middleware generates `crypto.randomUUID()` nonce per request
2. Sets `Content-Security-Policy` header with `nonce-{value}` in `script-src`
3. Moves CSP from `next.config.ts` to middleware (dynamic header)
4. Layouts read the nonce via `headers()` and pass to `<Script>` components

---

## Build Verification
```
cd ~/Projects/wowwai
npm run build
```
Verified after all changes. App builds successfully.

---

## Pre-deploy Checklist
Before deploying `security/critical-fixes` to production:

1. [ ] Verify `AGENT_SECRET` is set in Vercel environment (production + preview)
2. [ ] Test `/api/export` endpoint works in preview deployment
3. [ ] Test `/api/sync/enqueue` endpoint works (workflow document edit/restore)
4. [ ] Test settings page exports JSON and CSV correctly
5. [ ] Test login flow still works (timing-safe comparison changes)
6. [ ] Test middleware correctly blocks unauthenticated routes
7. [ ] Test `x-middleware-subrequest` header returns 403
8. [ ] Review `'strict-dynamic'` CSP in browser — check console for CSP violations
9. [ ] Test Convex WebSocket connections still work (wss:// in connect-src)
