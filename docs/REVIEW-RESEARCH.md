# WOWWAI Review Research

> Research compiled for the WOWWAI multi-layered security, testing & code review plan.
> Sources verified February 2026.

---

## 1. Next.js Security Vulnerabilities

### CVE-2025-29927 — Middleware Authorization Bypass (CRITICAL)
**Affects:** Versions prior to 12.3.5, 13.5.9, 14.2.25, 15.2.3  
**Fix:** Update to ≥15.2.3 or ≥16.x (patched)  
**Source:** https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass  
**Source:** https://www.offsec.com/blog/cve-2025-29927/  
**Source:** https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/

**How it works:** The `x-middleware-subrequest` header was designed internally by Next.js to prevent infinite middleware loops. Attackers discovered they could send this header in external requests to skip middleware execution entirely — bypassing all auth checks implemented in `middleware.ts`. WOWWAI's entire auth gate lives in middleware.ts, so this CVE is directly relevant.

**Impact for WOWWAI:** WOWWAI 16.1.6 is likely in the patched range, but must be verified. Any external request with `x-middleware-subrequest: middleware` would bypass the auth check and reach protected routes directly.

**Mitigation:**
- Verify Next.js version is ≥15.2.3
- Never rely solely on middleware for auth — add server-side checks in pages/API routes
- Consider Vercel WAF rule for blocking this header pattern

### CVE-2024-34351 — SSRF in Server Actions
**Affects:** Next.js < 14.1.1  
**Source:** https://www.assetnote.io/resources/research/advisory-next-js-ssrf-cve-2024-34351  
**Source:** https://github.com/advisories/GHSA-fr5h-rqp8-mj6g

**How it works:** If a request's `Host` header is spoofed, Server Actions would redirect to an attacker-controlled URL with full request headers — leaking session cookies and auth tokens, and enabling SSRF to internal services.

**Impact for WOWWAI:** WOWWAI 16.1.6 is well past the fix version. No Server Actions used (uses API routes + Convex mutations). Low direct risk, but worth noting for future use.

### `unsafe-inline` in script-src CSP
**Source:** https://owasp.org/www-community/attacks/xss/  
**WOWWAI Issue:** `next.config.ts` sets `script-src 'self' 'unsafe-inline'` which nullifies XSS protection. Any XSS injection would execute because inline scripts are allowed.

### Middleware Bypass Vectors (General)
- Path suffix bypasses: `/_next/...` patterns
- Static asset route matches that overlap with dynamic routes  
- The `pathname.includes(".")` check in WOWWAI middleware can be bypassed with specially crafted paths containing a dot (e.g., `/dashboard.html` or `/api/data.json`)

---

## 2. Custom Auth Security

### Timing Attacks on Hash Comparison
**Source:** https://dev.ngockhuong.com/posts/timing-attack-a-hidden-risk-when-comparing-secrets/  
**Source:** https://www.arun.blog/timing-safe-auth-web-crypto/  
**Source:** https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/

**Problem:** WOWWAI's `verifyPassword` uses `hash === getPasswordHash()` and `verifySessionToken` uses `sig !== expectedSig`. Both are non-constant-time string comparisons. A remote attacker can measure response times to infer hash characters (microsecond-level differences).

**Fix:** Use `crypto.subtle.timingSafeEqual()` for all secret comparisons. For Web Crypto in edge runtime, HMAC-based comparison is the pattern:
```typescript
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const hmac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(a));
  return await crypto.subtle.verify('HMAC', key, hmac, new TextEncoder().encode(b));
}
```

### SHA-256 for Password Hashing
**Source:** https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

SHA-256 is a **fast** hash, not designed for password storage. An attacker with a SHA-256 hash can brute-force billions of passwords per second. Passwords should use a **slow, adaptive** hash like Argon2id, bcrypt, or scrypt.

**WOWWAI mitigation:** Since this is a single-user app deployed on Vercel (edge runtime), bcrypt (Node.js) isn't available in edge middleware. Options:
- Use Argon2id in a regular Node.js API route (not middleware)
- Or keep SHA-256 but enforce a very long, high-entropy password and rate limiting

### CSRF Considerations
**Source:** https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html  
**Source:** https://www.telerik.com/blogs/protecting-nextjs-applications-cross-site-request-forgery-csrf-attacks

**WOWWAI status:** Cookie has `sameSite: "lax"` which protects against CSRF on cross-site navigation-based POSTs. However `lax` does not protect against:
- Subdomain cookie injection attacks
- Top-level navigation that results in a POST (in some browsers)

`sameSite: "strict"` would be safer, though `lax` is generally considered adequate for this threat model.

### Session Token Hardening
- **No token rotation:** Session token doesn't rotate after validation (increased replay window)
- **30-day lifetime:** Long session increases risk from leaked tokens
- **No refresh tokens:** Single long-lived token

---

## 3. Convex Security

### Unauthenticated Queries/Mutations
**Source:** https://docs.convex.dev/auth  
**Source:** https://stack.convex.dev/authorization  
**Source:** https://stack.convex.dev/row-level-security

**Critical issue:** Convex public `query` and `mutation` functions are callable by anyone who has the Convex deployment URL. All of WOWWAI's data-access functions are unauthenticated public queries/mutations.

**Data exposed:**
- All tasks, projects, ideas, audit logs — `getAll`, `getFullExport` 
- All file versions and sync queue items
- All mutations (create, update, delete) callable without any auth

**Fix pattern:**
```typescript
// Instead of bare query(), use an authenticated wrapper:
export const getTasks = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.db.query("tasks").collect();
  },
});
```

For custom auth (non-Clerk), WOWWAI would need to pass a token to Convex and validate it server-side. One approach: use Convex HTTP actions for all mutations (as WOWWAI does for agent API), which do validate the `x-agent-secret`.

### `fileSyncQueue.enqueue` — Unauthenticated File Write Vector
**WOWWAI specific issue:** The `fileSyncQueue.enqueue` is a public Convex mutation. Any caller can queue arbitrary file content for any file path. The sync agent polls `/sync/getPending` (protected by AGENT_SECRET) but uses `getPendingInternal` — however the queue is writable publicly.

**Attack chain:**
1. Attacker calls `fileSyncQueue.enqueue({ filePath: "../../../.env", content: "..." })` directly via Convex client
2. Sync agent polls pending items and calls `resolveSafePath` — this would be caught if path traversal is detected
3. But `filePath: "docs/evil-script.md"` is a valid path — content injection is possible

### Rate Limiting
**Source:** https://stack.convex.dev/rate-limiting  
**Source:** https://www.convex.dev/components/rate-limiter

WOWWAI has rate limiting on the HTTP agent API via `convex-helpers/server/rateLimit` (10/min, burst 20). But there is **no rate limiting** on public Convex queries/mutations, which can be called at high frequency by scrapers or DoS attacks.

---

## 4. File System Access Security

### Path Traversal
**Source:** https://portswigger.net/web-security/file-path-traversal  
**Source:** https://owasp.org/www-community/attacks/Path_Traversal

WOWWAI's sync agent has `resolveSafePath()` which:
1. Strips null bytes (`\0`)
2. Resolves to absolute path via `resolve(PROJECT_ROOT, cleaned)`
3. Checks `resolved.startsWith(PROJECT_ROOT)` — **RACE CONDITION**: on Windows, path resolution is case-insensitive; `PROJECT_ROOT` might be `C:\Users\danie\Projects\wowwai` but resolved path could come back with different casing
4. Checks allowed extensions

**Vulnerability:** The path safety check uses `startsWith` which could be bypassed with symlinks. If an attacker controls the filePath via unauthenticated `enqueue` mutation and creates a symlink inside the project, they could write to arbitrary locations.

### Content Injection
Even if path traversal is blocked, the sync agent writes raw `content` from Convex to disk. If an attacker can call the `enqueue` mutation (which is unauthenticated), they can inject malicious content into watched files like `docs/*.md` or `workflows/*.json`.

### File Permission Issues
The sync agent runs with the developer's credentials, giving it full filesystem access. No privilege separation exists between "what Convex can request" and "what the OS allows."

---

## 5. Code Review Methodologies

### Multi-Model Agentic Review
**Source:** https://www.qodo.ai/blog/best-ai-code-review-tools-2026/  
**Source:** https://redmonk.com/kholterhoff/2025/12/22/10-things-developers-want-from-their-agentic-ides-in-2025/

Modern agentic code review patterns:
- **Role specialization:** Different models excel at different tasks (security vs. architecture vs. testing)
- **Parallel agents:** Independent agents review separate dimensions simultaneously
- **Staged review:** Pass outputs between agents (security agent feeds findings to remediation agent)
- **Context injection:** Feed each agent only the relevant code slice + domain-specific prompts

### SAST (Static Analysis)
Tools: ESLint security plugins, SonarQube, CodeQL, Semgrep  
For Next.js: `eslint-plugin-security`, `eslint-plugin-react`, TypeScript strict mode

### DAST (Dynamic Analysis)
Tools: OWASP ZAP, Burp Suite  
Approach: Run against localhost dev server, test all auth bypass vectors, fuzz input validation

### Manual Review Checklist (OWASP Top 10 for Next.js)
1. **Injection** — SQL/NoSQL injection, command injection
2. **Broken Auth** — session management, credential storage, timing attacks
3. **Sensitive Data Exposure** — env vars, API keys in client bundle
4. **XXE** — XML parsing (N/A for this app)
5. **Broken Access Control** — unprotected API routes, Convex queries
6. **Security Misconfiguration** — CSP headers, CORS, exposed debug info
7. **XSS** — DOM-based XSS, reflected XSS via markdown rendering
8. **Insecure Deserialization** — JSON.parse without validation
9. **Known Vulnerabilities** — outdated deps, CVE monitoring
10. **Logging/Monitoring** — insufficient audit trails

---

## 6. Testing Strategy for Next.js + Convex

### Official Next.js Testing Guide
**Source:** https://nextjs.org/docs/pages/guides/testing/playwright

Next.js recommends:
- **Unit tests:** Vitest or Jest for utilities, hooks, and pure functions
- **Integration tests:** Jest + React Testing Library for component behavior
- **E2E tests:** Playwright for full user flows

### Convex Testing
**Source:** https://stack.convex.dev/  

Convex functions can be tested via:
- `ConvexTestingHelper` from `@convex-dev/testing` — runs functions against a real in-memory Convex backend
- Mock `ctx.db` with fake data for pure logic testing
- Integration tests that call the actual Convex deployment with test data

### Testing with Auth
Since WOWWAI uses custom cookie auth, E2E tests need to:
1. Login via `/api/auth/login` and capture the cookie
2. Pass the cookie in subsequent Playwright requests using `browser.storageState()`

---

## 7. Dependency Audit

### npm Supply Chain Risks (2025)
**Source:** https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem  
**Source:** https://www.trendmicro.com/en_us/research/25/i/npm-supply-chain-attack.html

In September 2025, a widespread npm supply chain attack compromised multiple popular packages. Key lessons:
- Audit recently updated packages specifically
- Pin exact versions in package.json (not `^`)
- Use `npm audit` + Snyk continuously
- Monitor `webhook.site` outbound connections as indicator of compromise

### WOWWAI Dependency Risk Areas
- `convex@1.31.7` — check for known CVEs
- `next@16.1.6` — check CVE-2025-29927 patch status
- `react-markdown@10.1.0` + `rehype-sanitize@6.0.0` — markdown XSS vector; sanitize is present ✓
- `chokidar@4.0.3` — file watcher; verify no path traversal issues
- `@dnd-kit/core@6.3.1` — DnD library, generally low risk
- No testing framework listed in devDependencies — gap

---

## 8. Performance Considerations

### Next.js Server vs. Client Components
- Default in App Router: all components are server components
- Using `"use client"` adds to the JS bundle
- Recharts requires client components — ensure `"use client"` is scoped correctly

### Convex Query Efficiency
- `getAll()` and `getFullExport()` load ALL records from tables without pagination
- Under load, this becomes both a performance and DoS vector
- Prefer indexed queries with limits

---

## Key Source URLs

| Topic | URL |
|-------|-----|
| CVE-2025-29927 | https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass |
| CVE-2024-34351 (SSRF) | https://www.assetnote.io/resources/research/advisory-next-js-ssrf-cve-2024-34351 |
| Timing-safe comparison | https://www.arun.blog/timing-safe-auth-web-crypto/ |
| CSRF prevention | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html |
| Convex auth | https://docs.convex.dev/auth |
| Convex authorization | https://stack.convex.dev/authorization |
| Convex rate limiting | https://stack.convex.dev/rate-limiting |
| Path traversal | https://portswigger.net/web-security/file-path-traversal |
| OWASP password storage | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |
| npm supply chain | https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem |
| Next.js Playwright testing | https://nextjs.org/docs/pages/guides/testing/playwright |
| AI code review tools | https://www.qodo.ai/blog/best-ai-code-review-tools-2026/ |
