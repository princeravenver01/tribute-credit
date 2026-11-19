# Role Login, Authentication Hardening, and Hostinger Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved branded split login experience for Borrower, Account Officer, and Admin portals, remove development authentication bypasses, enforce hostname/role isolation, and prepare the app for three Hostinger Cloud Startup deployments.

**Architecture:** A shared portal configuration defines trusted hostname, role, copy, color variant, and post-login destination. One reusable client login component renders the three route wrappers, while server-side authentication derives the expected role from the request hostname rather than trusting the browser. Next.js 16 `proxy.ts` performs optimistic hostname/session routing, and reusable server authorization helpers protect API data at the route handler.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript, CSS Modules, `jsonwebtoken`, `bcryptjs`, `mysql2`, Node test runner, Hostinger Node.js 22 and MySQL.

**Spec:** `docs/superpowers/specs/2026-11-19-role-login-design.md`

## Global Constraints

- Public portals are exactly Borrower, Account Officer, and Administrator.
- Borrower and AO use white with Tribute green accents; Admin uses white with restrained crimson accents.
- Use `public/tribute-credit-logo.png` without duplicating its wordmark in adjacent text.
- Preserve existing successful-login destinations and all loan-system functionality.
- Do not add UI libraries, fonts, social login, OTP, biometrics, or MFA.
- Support 320-pixel-wide screens with no horizontal overflow and minimum 48-pixel interactive controls.
- Never render demo credentials, prefill production credentials, accept override passwords, or use a default production JWT secret.
- Production hostnames are `credit.tribute-grace.com`, `ao-credit.tribute-grace.com`, and `admin-credit.tribute-grace.com`.
- Hostinger production MySQL uses `DB_HOST=127.0.0.1` and Node.js 22.

## Review Focus

- A valid account presented on the wrong role hostname receives a generic wrong-portal denial and no session cookie; Task 3 tests this.
- A forged, expired, or wrong-role cookie cannot enter a protected page or API; Tasks 4 and 5 test this.
- A database outage returns a generic service error and never activates demo fallback login; Task 3 tests this.
- A 320-pixel viewport keeps the wordmark, form, password control, and submit button inside the page; Task 2 tests the responsive CSS contract.
- Rapid repeated failures are rate-limited without revealing account existence, while a later successful login clears the limiter; Task 3 tests this.

---

## File Structure

- `src/config/portal-auth.ts`: shared trusted portal metadata and hostname/route lookup helpers.
- `src/components/auth/RoleLoginPage.tsx`: reusable client-side form behavior and accessible login states.
- `src/components/auth/RoleLoginPage.module.css`: approved desktop split and mobile single-column presentation.
- `src/app/{borrower,officer,admin}/login/page.tsx`: thin route wrappers selecting fixed portal configuration.
- `src/lib/auth.ts`: JWT creation/verification with mandatory production secret.
- `src/lib/server-auth.ts`: cookie parsing and reusable role authorization for route handlers.
- `src/lib/login-rate-limit.ts`: bounded in-memory failure limiter for Hostinger's single Node process.
- `src/app/api/auth/login/route.ts`: database-only login, hostname-derived portal role, generic errors, rate limiting, and audit records.
- `src/proxy.ts`: Next.js 16 hostname routing and optimistic session/role redirects.
- `database/schema.sql`: production-safe schema with no known default login passwords.
- `scripts/create-initial-admin.mjs`: explicit one-time admin bootstrap using environment variables.
- `docs/deployment/hostinger-cloud-startup.md`: exact three-site Hostinger deployment checklist.
- `tests/role-login-auth.test.mjs`: shared UI, hostname, authentication, authorization, and deployment regression coverage.

---

### Task 1: Trusted Portal Configuration

**Files:**
- Create: `src/config/portal-auth.ts`
- Create: `tests/role-login-auth.test.mjs`

**Interfaces:**
- Produces: `PortalKey`, `PortalRole`, `PortalConfig`, `PORTAL_CONFIGS`, `getPortalForHostname(hostname)`, `getPortalForPath(pathname)`, and `roleCanAccessPortal(role, portal)`.
- Consumes: No earlier task interfaces.

- [ ] **Step 1: Write failing configuration tests**

Add tests asserting the three exact hostnames, expected roles, login paths, dashboard destinations, and variants; unknown hosts return `null`; ports and uppercase hostnames normalize; `/disbursement` maps to the Admin host surface but is not a fourth public login.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/role-login-auth.test.mjs`

Expected: FAIL because `src/config/portal-auth.ts` does not exist.

- [ ] **Step 3: Implement the portal configuration**

Define:

```ts
export type PortalKey = 'borrower' | 'officer' | 'admin';
export type PortalRole = 'borrower' | 'account_officer' | 'admin' | 'disbursement';
export function getPortalForHostname(hostname: string): PortalConfig | null;
export function getPortalForPath(pathname: string): PortalConfig | null;
export function roleCanAccessPortal(role: PortalRole, portal: PortalConfig): boolean;
```

Use exact production hosts from Global Constraints. Treat `localhost`, `127.0.0.1`, and `.local` hosts as development hosts where route paths select the portal. Admin users may access the existing `/disbursement` workflow, but the Admin login still requires the `admin` role.

- [ ] **Step 4: Run the focused test and confirm pass**

Run: `node --test tests/role-login-auth.test.mjs`

Expected: Portal configuration tests PASS.

- [ ] **Step 5: Commit the configuration**

```bash
git add src/config/portal-auth.ts tests/role-login-auth.test.mjs
git commit -m "feat(auth): define trusted portal host configuration"
```

### Task 2: Shared Branded Split Login UI

**Files:**
- Create: `src/components/auth/RoleLoginPage.tsx`
- Create: `src/components/auth/RoleLoginPage.module.css`
- Modify: `src/app/borrower/login/page.tsx`
- Modify: `src/app/officer/login/page.tsx`
- Modify: `src/app/admin/login/page.tsx`
- Delete: `src/app/admin/login/login.module.css`
- Test: `tests/role-login-auth.test.mjs`

**Interfaces:**
- Consumes: `PortalKey` and `PORTAL_CONFIGS` from Task 1.
- Produces: `RoleLoginPage({ portalKey }: { portalKey: PortalKey })` used by all three route wrappers.

- [ ] **Step 1: Add failing UI contract tests**

Assert one shared component is imported by all three pages; the official logo is rendered through `next/image`; route wrappers contain no email/password state or inline styles; inputs start empty and use `autoComplete="email"` and `autoComplete="current-password"`; password visibility is accessible; the form has loading and generic error states; no source contains `Password123!`, `Pass123`, `Demo Credentials`, or cross-portal login links.

Assert CSS contains a two-column desktop layout, a single-column mobile breakpoint, 48-pixel controls, safe-area padding, visible focus styles, and a 320-pixel overflow guard.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/role-login-auth.test.mjs`

Expected: FAIL because the shared login component and CSS do not exist.

- [ ] **Step 3: Implement `RoleLoginPage` and CSS**

Implement the exact copy and role variants from the approved spec. Keep fields empty, show/hide password with `aria-label`, prevent duplicate submit, and submit only `{ email, password }` to `/api/auth/login`; do not send a client-selected role. Use an `aria-live` status/error region.

Desktop uses the identity/form split. At `max-width: 760px`, collapse to the approved single-column composition and remove long decorative identity copy. Use existing tokens and Lucide icons only.

- [ ] **Step 4: Replace the three login pages with fixed wrappers**

Each route renders only its trusted key:

```tsx
return <RoleLoginPage portalKey="borrower" />;
return <RoleLoginPage portalKey="officer" />;
return <RoleLoginPage portalKey="admin" />;
```

- [ ] **Step 5: Run UI tests and static checks**

Run: `node --test tests/role-login-auth.test.mjs`

Run: `npx eslint src/components/auth src/app/borrower/login src/app/officer/login src/app/admin/login`

Expected: All focused tests PASS and ESLint reports no errors.

- [ ] **Step 6: Commit the shared UI**

```bash
git add src/components/auth src/app/borrower/login src/app/officer/login src/app/admin/login tests/role-login-auth.test.mjs
git commit -m "feat(auth): add unified responsive role login experience"
```

### Task 3: Database-only Login, Secret Enforcement, Rate Limiting, and Audit

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/login-rate-limit.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Test: `tests/role-login-auth.test.mjs`

**Interfaces:**
- Consumes: `getPortalForHostname` and portal expected role from Task 1.
- Produces: `signJwtToken(payload)`, `verifyJwtToken(token)`, `consumeLoginAttempt(key, now?)`, `recordLoginFailure(key, now?)`, and `clearLoginFailures(key)`.

- [ ] **Step 1: Add failing security tests**

Assert the login route contains no built-in account map, default password, generic borrower fallback, or password override; derives portal from `request.url`/host; returns generic `401` for invalid credentials and wrong role; returns `503` for database failure; checks `status === 'active'`; and sets an HTTP-only, secure-in-production, same-site cookie only after bcrypt and role success.

Add executable limiter tests for five failures per normalized IP/email key in 15 minutes, rejection of the sixth attempt, expiry after the window, clearing on success, and bounded stale-entry cleanup.

Assert `auth.ts` has no production default secret and rejects missing/weak production secrets.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/role-login-auth.test.mjs`

Expected: FAIL on demo fallbacks, rate limiter, and secret rules.

- [ ] **Step 3: Implement secret enforcement and bounded limiter**

Keep JWT duration at seven days. Require a non-empty `JWT_SECRET` of at least 32 characters in production. Limit login failures to five per 15-minute window using a module-level `Map`; prune expired entries and cap stored keys at 5,000.

- [ ] **Step 4: Rewrite the login route**

Derive the expected portal from the request hostname. Query the user by normalized email, require active status and exact expected role, compare bcrypt hash, create the session, clear the limiter, and write an `audit_logs` success entry. On failure, increment the limiter and best-effort record a generic failure action without storing the submitted password.

Do not reveal whether the email, password, role, status, or database lookup caused the failure. Preserve the response shape required by existing clients.

- [ ] **Step 5: Harden logout cookie attributes**

Clear the cookie with the same `httpOnly`, `secure`, `sameSite`, and `path` attributes used during login.

- [ ] **Step 6: Verify security tests and type checking**

Run: `node --test tests/role-login-auth.test.mjs`

Run: `npx tsc --noEmit --incremental false`

Expected: All focused tests PASS and TypeScript reports no errors.

- [ ] **Step 7: Commit login hardening**

```bash
git add src/lib/auth.ts src/lib/login-rate-limit.ts src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts tests/role-login-auth.test.mjs
git commit -m "fix(auth): remove login bypasses and enforce portal roles"
```

### Task 4: Next.js 16 Hostname and Session Proxy

**Files:**
- Create: `src/proxy.ts`
- Delete: `src/middleware.ts`
- Test: `tests/role-login-auth.test.mjs`

**Interfaces:**
- Consumes: Task 1 portal lookup and Task 3 JWT verification.
- Produces: Next.js 16 `proxy(request: NextRequest): NextResponse` and matcher configuration.

- [ ] **Step 1: Add failing proxy tests**

Assert the project uses `src/proxy.ts`, not deprecated `src/middleware.ts`; root requests redirect to the hostname's login/dashboard; unmatched role paths redirect to the correct portal root; valid matching sessions pass; wrong-role/invalid sessions are cleared and redirected; Admin host permits `/admin` and `/disbursement`; static assets and image optimization are excluded.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/role-login-auth.test.mjs`

Expected: FAIL because only the cookie-existence middleware is present.

- [ ] **Step 3: Implement `src/proxy.ts`**

Follow the local Next.js 16 Proxy guide. Perform only optimistic cookie/JWT/role checks in Proxy; do not query MySQL. Preserve localhost path-based development. Ensure API requests continue to their handlers, where Task 5 performs authoritative authorization.

- [ ] **Step 4: Run focused tests and build**

Run: `node --test tests/role-login-auth.test.mjs`

Run: `npm run build`

Expected: Tests PASS and Next.js recognizes Proxy without a middleware deprecation warning.

- [ ] **Step 5: Commit hostname routing**

```bash
git add src/proxy.ts src/middleware.ts tests/role-login-auth.test.mjs
git commit -m "feat(auth): isolate portals by production hostname"
```

### Task 5: Authoritative API Role Guards

**Files:**
- Create: `src/lib/server-auth.ts`
- Modify: `src/app/api/admin/products/route.ts`
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `src/app/api/admin/stats/route.ts`
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/officer/account/route.ts`
- Modify: `src/app/api/officer/queue/route.ts`
- Modify: `src/app/api/borrower/portal/route.ts`
- Modify: `src/app/api/borrower/apply/route.ts`
- Modify: `src/app/api/assessments/route.ts`
- Modify: `src/app/api/sync/route.ts`
- Test: `tests/role-login-auth.test.mjs`

**Interfaces:**
- Consumes: `verifyJwtToken` and `PortalRole`.
- Produces: `getSessionFromCookies()` and `requireApiRole(...allowedRoles)` returning a discriminated authorized/unauthorized result.

- [ ] **Step 1: Add failing API authorization tests**

Assert every sensitive API route imports the central guard and declares its allowed roles. Add executable helper tests for missing, invalid, and wrong-role tokens returning `401`/`403`, and permitted roles returning the token payload. Verify borrower data APIs accept borrower only; Admin APIs accept admin only; AO account/queue accept account officer only; assessments/sync accept only their explicitly required staff roles.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/role-login-auth.test.mjs`

Expected: FAIL because authorization is duplicated or absent.

- [ ] **Step 3: Implement the central guard**

Use `cookies()` and signed JWT verification. Return generic JSON-ready errors without exposing token details. Keep authorization near the data source as required by the local Next.js authentication guide.

- [ ] **Step 4: Apply guards to sensitive routes**

Replace duplicated or cookie-existence checks while preserving each handler's business behavior. Remove the borrower password-change override for `Password123!`/`Pass123` and remove equivalent Admin/AO password fallbacks encountered in the listed routes.

- [ ] **Step 5: Run focused and full regression suites**

Run: `node --test tests/role-login-auth.test.mjs`

Run: `node --test tests/*.test.mjs`

Expected: All tests PASS.

- [ ] **Step 6: Commit API authorization**

```bash
git add src/lib/server-auth.ts src/app/api tests/role-login-auth.test.mjs
git commit -m "fix(auth): enforce role authorization at API boundaries"
```

### Task 6: Secure Bootstrap and Hostinger Deployment Readiness

**Files:**
- Modify: `database/schema.sql`
- Create: `scripts/create-initial-admin.mjs`
- Modify: `package.json`
- Create: `.env.example`
- Create: `docs/deployment/hostinger-cloud-startup.md`
- Test: `tests/role-login-auth.test.mjs`

**Interfaces:**
- Consumes: exact production hostnames and environment names from earlier tasks.
- Produces: `npm run create-admin` one-time bootstrap and a complete three-site deployment checklist.

- [ ] **Step 1: Add failing deployment-safety tests**

Assert the schema and scripts contain no known default plaintext login, `.env.example` contains names but no secrets, package metadata selects supported Node 22, and the deployment guide lists all three subdomains, shared database variables, unique strong JWT secret, `DB_HOST=127.0.0.1`, build command `npm run build`, start command `npm run start`, schema import, smoke tests, and rollback steps.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/role-login-auth.test.mjs`

Expected: FAIL on default seed credentials and missing deployment files.

- [ ] **Step 3: Remove insecure user seeds and add explicit bootstrap**

Keep structural schema and non-sensitive loan product seed data. The admin bootstrap requires `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and database variables; refuses the known demo passwords and passwords shorter than 12 characters; bcrypt-hashes the password; and inserts or updates only the intended Admin account.

- [ ] **Step 4: Add deployment configuration and checklist**

Set Node engine compatibility to Node 22. Document creating three Hostinger Node.js Web Apps from the same repository, applying shared DB variables, assigning each subdomain, importing schema once, running the admin bootstrap once, validating role isolation, and retaining a backup of the existing Coming Soon sites before removal.

- [ ] **Step 5: Run complete verification**

Run: `node --test tests/*.test.mjs`

Run: `npm run lint`

Run: `npx tsc --noEmit --incremental false`

Run: `npm run build`

Expected: All tests PASS, lint and TypeScript report no errors, and the production build completes all routes.

- [ ] **Step 6: Commit deployment readiness**

```bash
git add database/schema.sql scripts/create-initial-admin.mjs package.json package-lock.json .env.example docs/deployment/hostinger-cloud-startup.md tests/role-login-auth.test.mjs
git commit -m "chore(deploy): prepare secure Hostinger production rollout"
```

### Task 7: Visual and End-to-End Role Smoke Check

**Files:**
- Modify only if verification finds a scoped defect in files from Tasks 1–6.

**Interfaces:**
- Consumes: completed login, auth, proxy, API guards, and deployment configuration.
- Produces: verified release candidate with no additional feature surface.

- [ ] **Step 1: Start the production server locally**

Run: `npm run build && npm run start`

Expected: Server starts without a missing-secret or route error using the local secure environment values.

- [ ] **Step 2: Check the three login pages at desktop and 320-pixel mobile widths**

Verify official logo, split/stacked layout, role copy and accents, empty fields, show/hide password, keyboard focus, loading state, error region, and no overflow.

- [ ] **Step 3: Check hostname and role isolation**

Send local requests with each production `Host` header. Verify `/` and protected paths route only to the matching portal; wrong-role sessions cannot cross portals; Admin can reach the existing disbursement workflow.

- [ ] **Step 4: Verify authentication failure classes**

Check invalid credentials, inactive account, wrong role, missing database, rate limit, expired/forged cookie, and logout. Confirm no response leaks whether an account exists or includes stack/SQL details.

- [ ] **Step 5: Run the final verification commands again**

Run: `node --test tests/*.test.mjs && npm run lint && npx tsc --noEmit --incremental false && npm run build`

Expected: All commands exit successfully.

- [ ] **Step 6: Commit only if smoke checking required fixes**

```bash
git add <scoped-files>
git commit -m "fix(auth): resolve role login release checks"
```

## Self-Review Result

- Spec coverage: every approved layout, role variant, responsive rule, form state, security requirement, and deployment hostname maps to Tasks 1–7.
- Step scan: each step has a single test, implementation, verification, or commit outcome.
- Type consistency: Tasks 2–5 consume the exact `PortalKey`, `PortalRole`, `PortalConfig`, and authorization interfaces created earlier.
- Review focus: wrong host, bad session, DB outage, narrow viewport, and repeated failures each have an explicit owning test.
- Proportion: code bodies are intentionally omitted except for interfaces and fixed route-wrapper examples.
