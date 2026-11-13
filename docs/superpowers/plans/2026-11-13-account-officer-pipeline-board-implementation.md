# Account Officer Pipeline Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved green-and-white Pipeline Board visual system to the Account Officer portal without changing any existing functionality or business behavior.

**Architecture:** Keep every current route, state hook, effect, handler, API request, storage key, calculation, and status transition intact. Move presentation into scoped CSS Modules and reshape only JSX presentation where needed, using the same data arrays, links, handlers, and controls already present. Shared officer color tokens cascade from the existing page roots; screen-specific modules style each page without affecting Admin, Borrower, or Disbursement routes.

**Tech Stack:** Next.js 16.4.3 App Router, React 19.3, TypeScript, CSS Modules, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-13-account-officer-pipeline-board-design.md`

## Global Constraints

- This phase is a visual-only redesign: do not add, remove, reinterpret, or alter functionality.
- Do not change route destinations, API URLs or payloads, storage keys, polling intervals, calculations, persisted status values, validation rules, or handler bodies.
- Do not add dependencies, modify `package.json`, change the database schema, or edit API route contracts.
- Preserve `use client` boundaries and all existing browser APIs, effects, and state ownership.
- Mockup affordances with no matching current behavior must be omitted or displayed as non-interactive text only when that cannot mislead.
- Keep all existing form fields, print documents, signatures, face/ID capture, GPS verification, renewal, payments, offline drafts, and synchronization available.
- Use fixed light colors: `#15803D` primary, `#16A34A` highlight, `#F6FBF7` page background, and `#FFFFFF` surfaces.
- Use CSS Modules for new scoped styling. Do not add Tailwind or another UI framework.
- Before editing code, read `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` and `05-server-and-client-components.md` as required by `AGENTS.md`.
- Preserve all unrelated user changes already present in the worktree.

## Review Focus

- Local draft restoration: an incomplete `tribute_new_borrower_draft` must still reopen at the stored step with all entered values.
- Offline behavior: Online, Offline, queued, syncing, failed, and manual sync states must retain their existing triggers and actions.
- Governance lifecycle: `pending_assessment`, `pending_admin`, `admin_approved`, `admin_rejected`, `contract_ready`, and `disbursed` must still produce the same actions and transitions.
- High-risk controls: GPS, signature capture, face/ID capture, submission, printing, renewal, payment recording, and logout must invoke the same handlers as before.
- Responsive extremes: 320 px width, long borrower names, long peso values, missing optional data, and seven-step onboarding must remain usable without hiding existing controls.

---

## File Structure

### Create

- `src/components/officer/OfficerTheme.module.css` — shared green-and-white tokens, page shell, content spacing, focus, and responsive primitives.
- `src/components/officer/OfficerChrome.module.css` — scoped Sidebar and MobileNav presentation.
- `src/app/officer/dashboard/dashboard.module.css` — Pipeline dashboard summary strip, search, cards, and desktop table fallback.
- `src/app/officer/queue/queue.module.css` — application registry, tab strip, draft/application cards, and responsive table/list treatment.
- `src/app/officer/borrowers/new/onboarding.module.css` — onboarding header, progress, form sections, fields, actions, and mobile layout.
- `src/app/officer/credit-assessments/assessments.module.css` — assessment queue, evidence sections, recommendation panel, and action area.
- `src/app/officer/borrowers/borrowers.module.css` — borrower directory, operational summary, profile/detail, payment, and renewal presentation.
- `docs/qa/account-officer-visual-regression-checklist.md` — exact before/after routes, widths, interactions, and behavior-preservation results.

### Modify

- `src/components/officer/OfficerSidebar.tsx` — replace presentation-only inline styles with module classes; preserve props, links, active-route logic, and logout handler exactly.
- `src/components/officer/OfficerMobileNav.tsx` — apply white floating navigation and green active state; preserve item order, hrefs, active-route logic, and menu callback exactly.
- `src/components/common/AppHeader.tsx` — apply the green-and-white officer variant only; leave Admin output and all public props unchanged.
- `src/components/common/SyncStatusBar.tsx` — restyle states only; preserve IndexedDB queries, listeners, timers, sync call, Clear Data behavior, and confirmation text.
- `src/app/officer/dashboard/page.tsx` — render existing `stats`, `searchTerm`, `filteredQueue`, links, and data as Pipeline cards without changing their derivation.
- `src/app/officer/queue/page.tsx` — restyle the existing tabs, search, rows/cards, resume, view, and delete controls without changing filters or handlers.
- `src/app/officer/borrowers/new/page.tsx` — apply the approved mobile onboarding presentation around the unchanged seven-step logic.
- `src/app/officer/credit-assessments/page.tsx` — restyle the existing filters, assessment detail, Admin result, and action controls without changing assessment logic.
- `src/app/officer/borrowers/page.tsx` — restyle directory, borrower detail, payment, ledger, and renewal surfaces without changing calculations or handlers.
- `src/app/globals.css` — remove only officer-specific style rules that become redundant after CSS Module migration; retain every print rule and all non-officer global rules.

## Interfaces

- `OfficerSidebarProps`, `OfficerMobileNavProps`, and `AppHeaderProps` remain byte-for-byte compatible.
- Every existing page remains the default export for its current route.
- No new data types, API interfaces, storage abstractions, or view-model transformations are introduced.
- CSS Modules expose class names only; they do not own state or behavior.

---

### Task 1: Freeze the behavioral baseline and add the shared theme

**Files:**
- Create: `docs/qa/account-officer-visual-regression-checklist.md`
- Create: `src/components/officer/OfficerTheme.module.css`
- Modify: none of the runtime TypeScript files in this task

**Interfaces:**
- Produces: `.theme`, `.pageShell`, `.main`, `.screenReaderOnly`, `.mobileOnly`, and `.desktopOnly` classes plus `--officer-*` custom properties.
- Consumes: approved spec colors and existing breakpoint behavior from `src/app/globals.css`.

- [ ] **Step 1: Read the repository rules and Next.js guides**

Read `AGENTS.md`, the approved spec, `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, and `05-server-and-client-components.md` before editing.

- [ ] **Step 2: Record the unmodified behavior baseline**

Start the current application with `npm run dev`. In `docs/qa/account-officer-visual-regression-checklist.md`, record pass/fail for login, dashboard search, queue tabs, draft resume, all seven onboarding steps, assessment submission, borrower details, payment, renewal, offline indicator, sync, print actions, drawer, bottom navigation, and logout. Capture 390×844 and 1440×900 screenshots of the five Account Officer routes.

- [ ] **Step 3: Verify the baseline compiles**

Run: `npm run lint`

Run: `npm run build`

Record existing failures verbatim in the QA checklist; do not fix unrelated failures.

- [ ] **Step 4: Create shared design tokens and shell classes**

Implement `OfficerTheme.module.css` with the exact green/white tokens, 44 px minimum touch target, 320/600/1024 px responsive behavior, safe-area bottom spacing, and visible focus styles. Do not target unscoped HTML elements.

- [ ] **Step 5: Verify CSS isolation**

Run: `npm run lint`

Expected: no new lint errors.

- [ ] **Step 6: Commit**

```bash
git add docs/qa/account-officer-visual-regression-checklist.md src/components/officer/OfficerTheme.module.css
git commit -m "style: establish officer visual baseline"
```

---

### Task 2: Restyle shared Account Officer chrome

**Files:**
- Create: `src/components/officer/OfficerChrome.module.css`
- Modify: `src/components/officer/OfficerSidebar.tsx`
- Modify: `src/components/officer/OfficerMobileNav.tsx`
- Modify: `src/components/common/AppHeader.tsx`
- Modify: `src/components/common/SyncStatusBar.tsx`

**Interfaces:**
- Consumes: `OfficerTheme.module.css` custom properties inherited from each page root.
- Produces: the same component props and actions as today, with new class-based presentation.

- [ ] **Step 1: Add behavior-preservation assertions to the QA checklist**

List the exact Sidebar and MobileNav href arrays, the menu open/close callback behavior, the logout request and redirect, the AppHeader logo link, and every SyncStatusBar state/action before editing.

- [ ] **Step 2: Implement the shared chrome styling**

Create `OfficerChrome.module.css`. Convert presentation-only inline styles in Sidebar and MobileNav to module classes. Use a white navigation surface, green active state, green raised New/Onboard emphasis only where an existing link already exists, and safe-area spacing. Do not reorder items or change any `href`, `onClick`, or `isActive` expression.

- [ ] **Step 3: Apply the officer-only header variant**

Modify `AppHeader.tsx` so only `panelType === 'officer'` receives the new green-and-white classes. Preserve Admin styles, all props, action slots, logo destination, mobile menu callback, and `SyncStatusBar` placement.

- [ ] **Step 4: Restyle synchronization states**

Change only JSX classes and style values in `SyncStatusBar.tsx`. Preserve `checkPendingQueue`, `handleManualSync`, effects, timers, IndexedDB access, `syncOfflineData`, Clear Data confirmation, API request, and reload behavior exactly.

- [ ] **Step 5: Run focused static checks**

Run: `npm run lint -- src/components/officer/OfficerSidebar.tsx src/components/officer/OfficerMobileNav.tsx src/components/common/AppHeader.tsx src/components/common/SyncStatusBar.tsx`

Expected: no new errors.

- [ ] **Step 6: Perform a behavior diff review**

Run: `git diff --word-diff=plain HEAD -- src/components/officer/OfficerSidebar.tsx src/components/officer/OfficerMobileNav.tsx src/components/common/AppHeader.tsx src/components/common/SyncStatusBar.tsx`

Expected: changes are imports, class names, wrappers, and presentation values only; no handler body, condition, URL, timer, storage key, or array item changed.

- [ ] **Step 7: Commit**

```bash
git add src/components/officer/OfficerChrome.module.css src/components/officer/OfficerSidebar.tsx src/components/officer/OfficerMobileNav.tsx src/components/common/AppHeader.tsx src/components/common/SyncStatusBar.tsx
git commit -m "style: refresh account officer chrome"
```

---

### Task 3: Convert the dashboard to the Pipeline Board presentation

**Files:**
- Create: `src/app/officer/dashboard/dashboard.module.css`
- Modify: `src/app/officer/dashboard/page.tsx`

**Interfaces:**
- Consumes: existing `stats`, `queue`, `searchTerm`, `filteredQueue`, `setSearchTerm`, and existing Link destinations.
- Produces: the same dashboard data and actions rendered as green-and-white summary and application cards.

- [ ] **Step 1: Pin dashboard behavior in the QA checklist**

Record the current stat calculations, queue mapping precedence for amount/status/score, search fields, New Onboarding href, and View File href. These values must remain unchanged.

- [ ] **Step 2: Create the responsive dashboard styles**

Implement the approved mobile Pipeline visual hierarchy: green summary header, compact stage/status summary using the existing `stats`, search/filter area using the existing search input, white application cards on phones, and a readable wider layout on desktop. Do not implement interactive stage filters because the current dashboard does not have them.

- [ ] **Step 3: Reshape only the dashboard JSX**

Import `OfficerTheme.module.css` and `dashboard.module.css`. Keep every hook, effect, calculation, map, filter, and data property above the return unchanged. Reuse `filteredQueue` directly; retain the existing New Onboarding and View File destinations and search `onChange` handler.

- [ ] **Step 4: Verify mobile and desktop states**

At 320×800, 390×844, 768×1024, and 1440×900, verify long names, large peso values, zero applications, and several applications. Confirm no horizontal page scroll and no hidden action.

- [ ] **Step 5: Run focused checks and behavior diff**

Run: `npm run lint -- src/app/officer/dashboard/page.tsx`

Run: `git diff --word-diff=plain HEAD -- src/app/officer/dashboard/page.tsx`

Expected: data/effect/filter logic and link destinations are unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/officer/dashboard/page.tsx src/app/officer/dashboard/dashboard.module.css
git commit -m "style: present officer dashboard as pipeline board"
```

---

### Task 4: Restyle the application registry and draft vault

**Files:**
- Create: `src/app/officer/queue/queue.module.css`
- Modify: `src/app/officer/queue/page.tsx`

**Interfaces:**
- Consumes: existing `applications`, `activeTab`, `searchQuery`, `filtered`, `getStatusBadge`, `handleDeleteDraft`, and router navigation.
- Produces: the same queue tabs, records, and actions using Pipeline Board cards on mobile and a compact registry on desktop.

- [ ] **Step 1: Record queue behavior before editing**

Add the local-draft de-duplication rules, status mapping, tab filters, search fields, delete confirmation, and resume/view destinations to the QA checklist.

- [ ] **Step 2: Implement the queue module and JSX presentation**

Style the existing All, Drafts, Pending, and Approved tabs as a compact stage strip. Render existing entries as white cards below 600 px and retain a compact table/list above 1024 px. Keep every tab value, filter condition, status label, handler, and destination unchanged.

- [ ] **Step 3: Verify draft and persisted application states**

Test unnamed draft, Step 1 and Step 7 drafts, pending Admin, approved, rejected, contract-ready, and disbursed records. Confirm the same actions appear and invoke the same handlers.

- [ ] **Step 4: Run checks and behavior diff**

Run: `npm run lint -- src/app/officer/queue/page.tsx`

Run: `git diff --word-diff=plain HEAD -- src/app/officer/queue/page.tsx`

Expected: no change to localStorage reads, API calls, de-duplication, filtering, router calls, or delete behavior.

- [ ] **Step 5: Commit**

```bash
git add src/app/officer/queue/page.tsx src/app/officer/queue/queue.module.css
git commit -m "style: modernize officer application registry"
```

---

### Task 5: Apply the mobile onboarding design without touching the seven-step workflow

**Files:**
- Create: `src/app/officer/borrowers/new/onboarding.module.css`
- Modify: `src/app/officer/borrowers/new/page.tsx`

**Interfaces:**
- Consumes: all existing local state, derived calculations, effects, save/restore logic, step navigation, capture components, print targets, and submission handlers.
- Produces: unchanged seven-step onboarding behavior with the approved progress header, white form sections, green actions, and mobile sticky action area.

- [ ] **Step 1: Freeze high-risk onboarding behavior**

In the QA checklist, enumerate every step label, required field, add/remove repeatable row action, calculation preview, GPS gate, attachment action, AI verification, officer adjustment, Admin polling state, signatures, photos, contract agreement, disbursement choice, print action, autosave key, and submission action.

- [ ] **Step 2: Style the onboarding shell and progress presentation**

Add the shared theme class to the existing root. Replace the wide mobile stepper presentation with a visual “Step N of 7” header and progress bar while retaining the same `currentStep`, click handlers, completion logic, and all seven step controls. Desktop may retain the full labeled stepper.

- [ ] **Step 3: Style form sections and fields**

Apply module classes to existing labels, inputs, selects, textareas, repeatable item blocks, validation messages, upload/capture areas, and action rows. Do not rename, reorder, add, remove, disable, or change any field or handler.

- [ ] **Step 4: Style verification, contract, and print surfaces**

Apply the green-and-white visual system to existing AI results, Admin result, signature pads, photo capture, contract execution, disbursement choice, schedules, ledgers, and passbook tabs. Do not edit print markup or any `@media print` rule.

- [ ] **Step 5: Verify every step and resume path**

Complete and navigate backward/forward through Steps 1–7 at 390 px. Reload mid-step and confirm restoration. Exercise GPS, attachment, AI verification, signatures, photo capture, Admin result, contract, disbursement, and every print target against the baseline checklist.

- [ ] **Step 6: Run checks and behavior diff**

Run: `npm run lint -- src/app/officer/borrowers/new/page.tsx`

Run: `git diff --word-diff=plain HEAD -- src/app/officer/borrowers/new/page.tsx`

Expected: logic before and inside handlers is unchanged; only imports, class names, presentation wrappers, and style values differ.

- [ ] **Step 7: Commit**

```bash
git add src/app/officer/borrowers/new/page.tsx src/app/officer/borrowers/new/onboarding.module.css
git commit -m "style: refresh borrower onboarding experience"
```

---

### Task 6: Restyle credit assessments

**Files:**
- Create: `src/app/officer/credit-assessments/assessments.module.css`
- Modify: `src/app/officer/credit-assessments/page.tsx`

**Interfaces:**
- Consumes: existing assessment loading, filter tabs, selected assessment, Five Cs data, adjustment logic, Admin simulation/result, status transitions, and submission handlers.
- Produces: unchanged assessment behavior with a green recommendation summary, capacity breakdown, and expandable-looking evidence hierarchy using existing controls only.

- [ ] **Step 1: Record assessment behavior**

Add all filter values, status mappings, amount precedence, Five Cs labels, officer adjustment requirements, Admin result actions, and submission handlers to the QA checklist.

- [ ] **Step 2: Implement assessment styling**

Create the module and apply classes to the existing queue, selected-assessment details, recommendation panel, Five Cs evidence, notes, and action controls. Do not add new accordion state; preserve the current interaction model.

- [ ] **Step 3: Verify all governance states**

Check pending assessment, pending Admin, Admin approved, Admin rejected, contract ready, and disbursed records. Confirm labels, amounts, notes, and actions match the baseline.

- [ ] **Step 4: Run checks and behavior diff**

Run: `npm run lint -- src/app/officer/credit-assessments/page.tsx`

Run: `git diff --word-diff=plain HEAD -- src/app/officer/credit-assessments/page.tsx`

Expected: no API, status, filter, calculation, or handler changes.

- [ ] **Step 5: Commit**

```bash
git add src/app/officer/credit-assessments/page.tsx src/app/officer/credit-assessments/assessments.module.css
git commit -m "style: refine officer credit assessments"
```

---

### Task 7: Restyle borrower operations, payments, and renewals

**Files:**
- Create: `src/app/officer/borrowers/borrowers.module.css`
- Modify: `src/app/officer/borrowers/page.tsx`

**Interfaces:**
- Consumes: existing borrower filtering/sorting, loan calculations, schedules, ledger records, payment handler, savings handler, renewal eligibility, renewal submission, signature, and printing behavior.
- Produces: unchanged borrower operations in a search-first green-and-white directory and detail presentation.

- [ ] **Step 1: Record borrower-operation behavior**

Add search, sort, status selection, due-date calculation, overdue display, detail tabs, payment, savings, settlement, renewal eligibility, renewal offset, signature, submission, and print behavior to the QA checklist.

- [ ] **Step 2: Implement directory and detail styling**

Create the module and apply the approved cards, operational summary, payment/ledger sections, tabs, and mobile action layout. Preserve every calculation and action.

- [ ] **Step 3: Verify financial edge states**

Test no due date, one overdue installment, partial payment, fully paid balance, renewal ineligible, renewal eligible within two installments, offset enabled/disabled, and missing optional borrower fields. Compare amounts and actions with the baseline.

- [ ] **Step 4: Run checks and behavior diff**

Run: `npm run lint -- src/app/officer/borrowers/page.tsx`

Run: `git diff --word-diff=plain HEAD -- src/app/officer/borrowers/page.tsx`

Expected: no calculation, status, ledger mutation, renewal rule, handler, or print behavior changed.

- [ ] **Step 5: Commit**

```bash
git add src/app/officer/borrowers/page.tsx src/app/officer/borrowers/borrowers.module.css
git commit -m "style: modernize officer borrower operations"
```

---

### Task 8: Responsive, accessibility, print, and behavior-preservation audit

**Files:**
- Modify: `src/app/globals.css` only if obsolete officer-specific screen rules conflict
- Modify: `docs/qa/account-officer-visual-regression-checklist.md`
- Modify: CSS Modules from Tasks 1–7 as required by verified defects

**Interfaces:**
- Consumes: all redesigned Account Officer screens.
- Produces: verified mobile/desktop design with unchanged behavior and completed QA evidence.

- [ ] **Step 1: Remove only proven redundant officer screen CSS**

If a rule in `globals.css` conflicts with the new CSS Modules, delete only that officer screen rule after proving its replacement. Do not alter print rules, shared resets, safe-area behavior, or other portal styles.

- [ ] **Step 2: Run the full responsive matrix**

Verify all five routes at 320×800, 390×844, 768×1024, and 1440×900. Confirm touch targets, text wrapping, focus visibility, bottom safe area, drawer behavior, no horizontal page scrolling, and no hidden controls.

- [ ] **Step 3: Repeat the full behavior checklist**

Run every baseline interaction again and record the result. Any mismatch is a release blocker and must be corrected without changing the baseline behavior.

- [ ] **Step 4: Verify print behavior**

Exercise contract, schedule, ledger, passbook, payment ledger, details, and full-bundle print targets. Confirm page orientation, hidden app chrome, and document content match baseline.

- [ ] **Step 5: Run repository verification**

Run: `npm run lint`

Run: `npm run build`

Expected: no new failures. If baseline failures remain, document them separately and prove this branch adds none.

- [ ] **Step 6: Audit the complete behavior diff**

Run: `git diff --stat <baseline-commit>..HEAD`

Run: `git diff --word-diff=plain <baseline-commit>..HEAD -- src/app/officer src/components/officer src/components/common/AppHeader.tsx src/components/common/SyncStatusBar.tsx src/app/globals.css`

Expected: changes are scoped to presentation. Reject any modified URL, storage key, API payload, calculation, status value, validation condition, effect dependency, handler body, or route destination.

- [ ] **Step 7: Complete visual evidence**

Attach final 390×844 and 1440×900 screenshots for Dashboard, Queue, New Borrower, Credit Assessments, and Borrowers to the QA checklist. Record the baseline commit and final commit.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/app/officer src/components/officer src/components/common/AppHeader.tsx src/components/common/SyncStatusBar.tsx docs/qa/account-officer-visual-regression-checklist.md
git commit -m "test: verify officer redesign preserves behavior"
```

## Final Delivery Gate

- All checklist items pass or documented pre-existing failures are unchanged.
- `npm run lint` and `npm run build` introduce no new failures.
- No dependency, API, schema, route, storage, calculation, status, validation, or handler behavior changed.
- The final UI matches the approved green-and-white Pipeline Board direction.
- The implementation remains confined to Account Officer presentation and shared components only where guarded by `panelType === 'officer'`.

