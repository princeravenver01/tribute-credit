# Account Officer Visual Redesign — QA & Behavior-Preservation Checklist

## 1. Baseline vs. Post-Redesign Repository & Compilation State

- **Baseline Commit:** `819263e` (`docs: plan behavior-preserving officer redesign`)
- **Baseline Backup Snapshot:** Stored in `scratch/baseline/` prior to any modifications of untracked/modified officer files.
- **Task Commits:**
  - `b121c77` — `style: establish officer visual baseline` (Task 1)
  - `86a64bf` — `style: refresh account officer chrome` (Task 2)
  - `ed82fb1` — `style: present officer dashboard as pipeline board` (Task 3)
  - `0f87f10` — `style: modernize officer application registry` (Task 4)
  - `c16dc84` — `style: refresh borrower onboarding experience` (Task 5)
  - `f369749` — `style: refine officer credit assessments` (Task 6)
  - `069b296` — `style: modernize officer borrower operations` (Task 7)
- **Baseline `npm run lint` Result:**
  ```text
  ✖ 316 problems (111 errors, 205 warnings)
    10 errors and 0 warnings potentially fixable with the `--fix` option.
  ```
- **Post-Redesign `npm run lint` Result:**
  ```text
  ✖ 312 problems (111 errors, 201 warnings)
    10 errors and 0 warnings potentially fixable with the `--fix` option.
  ```
  *(Zero new ESLint errors or warnings introduced; pre-existing 111 errors across the repository remain unchanged).*
- **Baseline `npm run build` Result:**
  ```text
  ▲ Next.js 16.4.3 (Turbopack)
  ✓ Compiled successfully in 4.4s
  ✓ Generating static pages using 11 workers (27/27) in 2.2s
  Exit code: 0
  ```
- **Post-Redesign `npm run build` Result:**
  ```text
  ▲ Next.js 16.4.3 (Turbopack)
  ✓ Compiled successfully in 3.9s
  Finished TypeScript in 11.3s ...
  ✓ Generating static pages using 11 workers (27/27) in 1970ms
  Exit code: 0
  ```

---

## 2. Functional & Visual Verification Matrix

| Feature / Workflow | Route / Component | Baseline Behavior | Pre-Redesign | Post-Redesign |
| --- | --- | --- | --- | --- |
| Officer Login | `/officer/login` | Authenticates officer and redirects to `/officer/dashboard` | PASS | PASS |
| Sidebar Navigation & Drawer | `OfficerSidebar.tsx` | 5 navigation items, mobile backdrop + close button, `POST /api/auth/logout` -> `/officer/login` | PASS | PASS |
| Mobile Bottom Navigation | `OfficerMobileNav.tsx` | 5 route links + `More` button invoking `onOpenSidebar` | PASS | PASS |
| Header & Officer Identity | `AppHeader.tsx` | Logo links to `/officer/dashboard`, renders `SyncStatusBar`, action slot, user pill, title/subtitle (`panelType === 'officer'` scoped) | PASS | PASS |
| Offline & Sync Indicator | `SyncStatusBar.tsx` | Online/Offline state, IndexedDB `pendingCount` every 5s, manual `syncOfflineData()`, `Clear Data` confirm + reload | PASS | PASS |
| Dashboard Search & Stats | `/officer/dashboard` | 4 stat cards, search by `member`, `id`, `product`, `New Onboarding` and `View File` link to `/officer/borrowers/new`, mobile cards (`< 768px`) + desktop table (`>= 768px`) | PASS | PASS |
| Queue Tabs & Draft Vault | `/officer/queue` | `all`, `drafts`, `pending`, `approved` tabs; local `tribute_new_borrower_draft` de-duplication; Resume, Review, View Borrower, Discard Draft; mobile cards (`< 768px`) + desktop table (`>= 768px`) | PASS | PASS |
| 7-Step Onboarding & Autosave | `/officer/borrowers/new` | Steps 1–7, GPS gate, repeatable rows, 60s AI verification, Admin polling, 3x borrower & 3x AO signatures, face/ID capture, autosave to `tribute_new_borrower_draft`, mobile `"Step N of 7"` progress bar | PASS | PASS |
| Credit Assessments | `/officer/credit-assessments` | `all`, `pending`, `admin_queue`, `approved` filters; 5 Cs scorecard calculation; officer adjustment; Save Draft & Submit to Admin; stacked mobile queue + split desktop workspace | PASS | PASS |
| Borrower Directory & Modals | `/officer/borrowers` | Search, product filter, sort (`dueDate`, `name`, `amount`, `balance`), Pay Loan, Savings (CBU), Renew Loan, Details, Passbook, Ledger; mobile cards (`< 1024px`) + desktop table (`>= 1024px`) | PASS | PASS |
| Print Targets | `/officer/borrowers/new`, `/officer/borrowers` | `contract`, `schedule`, `ledger`, `passbook`, `payment-ledger`, `details`, `all` with portrait/landscape `@page` injection and `.no-print` chrome isolation | PASS | PASS |

---

## 3. Responsive Viewport Verification Matrix

| Route | `320×800` (Small Phone) | `390×844` (Standard Phone) | `768×1024` (Tablet Portrait) | `1440×900` (Desktop) |
| --- | --- | --- | --- | --- |
| `/officer/dashboard` | PASS (1-col KPIs, mobile pipeline cards, bottom nav clearance) | PASS (2-col KPIs, mobile pipeline cards, touch targets >= 40px) | PASS (2-col KPIs, pipeline table, drawer toggle) | PASS (280px sidebar, 4-col KPIs, full pipeline table) |
| `/officer/queue` | PASS (2-col summary, scrollable filter pills, mobile record cards) | PASS (2-col summary, mobile record cards, full-width actions) | PASS (4-col summary, registry table, drawer toggle) | PASS (280px sidebar, 4-col summary, full registry table) |
| `/officer/borrowers/new` | PASS (`Step N of 7` bar, compact pills, 1-col fields, 16px input font) | PASS (`Step N of 7` bar, compact pills, 1-col fields, touch buttons) | PASS (labeled stepper, responsive form cards) | PASS (7-col labeled stepper, 2/3-col form grids, summary strip) |
| `/officer/credit-assessments` | PASS (stacked queue list & detail card, 1-col metrics) | PASS (stacked queue list & detail card, full-width CTAs) | PASS (stacked queue & detail workspace, 2-col metrics) | PASS (`340px + 1fr` split master-detail workspace, sticky queue) |
| `/officer/borrowers` | PASS (1-col metrics, stacked filter bar, mobile borrower cards) | PASS (2-col metrics, mobile borrower cards, touch modals) | PASS (2-col metrics, mobile borrower cards `< 1024px`) | PASS (4-col metrics, 10-col operational table, centered modals) |

---

## 4. Pinned Component & Route Contracts (Verified Unchanged via Word Diff)

### Task 2: Shared Chrome (`OfficerSidebar`, `OfficerMobileNav`, `AppHeader`, `SyncStatusBar`)
- **`OfficerSidebar.tsx` navigation items (exact order & hrefs):**
  1. `Dashboard` -> `/officer/dashboard`
  2. `New Borrower` -> `/officer/borrowers/new`
  3. `Applications` -> `/officer/queue` (badge: `Draft Vault`)
  4. `Current Borrowers` -> `/officer/borrowers`
  5. `Credit Assessments` -> `/officer/credit-assessments`
- **`OfficerSidebar.tsx` active-route expression:**
  `pathname === item.href || (item.href !== '/officer/dashboard' && item.href !== '/officer/borrowers' && pathname.startsWith(item.href + '/'))`
- **`OfficerSidebar.tsx` logout handler:**
  `fetch('/api/auth/logout', { method: 'POST' })` followed by `window.location.href = '/officer/login'`
- **`OfficerMobileNav.tsx` items (exact order & hrefs):**
  1. `Dashboard` -> `/officer/dashboard`
  2. `Onboard` -> `/officer/borrowers/new`
  3. `Assess` -> `/officer/credit-assessments`
  4. `Vault` -> `/officer/queue`
  5. `Borrowers` -> `/officer/borrowers`
  6. `More` button -> `onClick={onOpenSidebar}`
- **`AppHeader.tsx` contract:**
  - Props (`panelType`, `userName`, `badgeLabel`, `pageTitle`, `pageSubtitle`, `onOpenMobileSidebar`, `actions`) unchanged.
  - Logo link: `isSuperAdmin ? '/admin/dashboard' : '/officer/dashboard'`.
  - Only `panelType === 'officer'` (`!isSuperAdmin`) receives the green-and-white officer styling; Admin header output remains untouched.
- **`SyncStatusBar.tsx` contract:**
  - Queries `offlineDB.applications` and `offlineDB.collections` where `syncStatus === 'pending'`.
  - Polls every `5000` ms and listens to `online`/`offline` window events.
  - Manual sync button calls `handleManualSync()` -> `syncOfflineData()`.
  - `Clear Data` button prompts exact confirmation `'Are you sure you want to clear all borrower applications, credit assessments, and drafts? (Login accounts will be preserved)'`, clears `credit-assessment-store`, `offlineDB`, posts `action: 'clear_all'` to `/api/assessments`, dispatches `'storage'`, and reloads.

### Task 3: Dashboard (`/officer/dashboard`)
- **Stats derivation:**
  1. `Active Pipeline`: `assessments.length.toString()`
  2. `Total Recommended`: `` `₱ ${assessments.reduce((sum, a) => sum + (a.officerAdjustedAmount || a.aiPreApprovedAmount || a.requestedAmount || 0), 0).toLocaleString('en-PH')}` ``
  3. `Pending CI / Verification`: `assessments.filter(a => a.status === 'pending_assessment').length.toString()`
  4. `Ready for Signature`: `assessments.filter(a => a.status === 'admin_approved').length.toString()`
- **Queue item mapping precedence:**
  - `id`: `a.applicationId || a.id`
  - `member`: `a.borrowerName`
  - `product`: `a.productName || 'Regular Loan'`
  - `amount`: `` `₱ ${(a.officerAdjustedAmount || a.aiPreApprovedAmount || a.requestedAmount || 0).toLocaleString('en-PH')}` ``
  - `term`: `` `${a.termMonths || 3} mos` ``
  - `date`: `a.evaluatedAt || 'Today'`
  - `status`: `a.status === 'admin_approved' ? 'Approved' : a.status === 'contract_ready' ? 'Contract Executed' : a.status === 'disbursed' ? 'Disbursed' : 'Pending Admin'`
  - `score`: `a.fiveCs?.riskGrade || 'Class A'`
- **Search filter:** Matches `q.member`, `q.id`, or `q.product` (case-insensitive).
- **Links:** `New Onboarding` -> `/officer/borrowers/new`; `View File` -> `/officer/borrowers/new`.

### Task 4: Application Registry & Draft Vault (`/officer/queue`)
- **Draft source:** `localStorage.getItem('tribute_new_borrower_draft')`.
- **De-duplication rule:** Draft is unshifted only if no assessment item matches `id` (when not `'DRAFT-ACTIVE'`), `policyNo` (when not `'LCAP-'`), or `applicantName.toLowerCase()`.
- **Tab filter keys:** `'all' | 'drafts' | 'pending' | 'approved'`.
- **Search fields:** `applicantName`, `id`, `productName`, `policyNo`.
- **Actions:**
  - `status === 'draft'`: Link `/officer/borrowers/new?id=${encodeURIComponent(item.id)}` (`Resume`) + `handleDeleteDraft(item.id)` (`Discard this saved draft permanently?`).
  - `status === 'approved' || status === 'completed'`: `router.push('/officer/borrowers?viewDetails=' + encodeURIComponent(item.id))` (`View Borrower`).
  - Other statuses: `router.push('/officer/borrowers/new?id=' + encodeURIComponent(item.id))` (`Review`).

### Task 5: New Borrower Onboarding (`/officer/borrowers/new`)
- **Steps 1–7:**
  1. `1. Personal` (with mandatory Account Officer GPS Geolocation Verification gate)
  2. `2. Contact` (PSGC province/city/barangay + repeatable Government IDs)
  3. `3. Dependants` (repeatable dependants)
  4. `4. Livelihood` (occupation, income, repeatable assets, other incomes, liabilities + financial summary totals)
  5. `5. Loan Terms` (product, principal, term, frequency, purpose + `calculateTributeLoan` breakdown)
  6. `6. Review` (attachments, officer assessment notes, privacy consent, 60s AI verification with fast-track, officer adjustment & endorsement to Admin, Admin status polling)
  7. `7. Contract` (3 borrower specimen signatures, live face photo, holding ID photo, 3 officer signatures, contract agreement checkbox, finalize contract, disbursement mode/channel, executed schedule/contract/passbook/ledger tabs & print actions)
- **Storage key:** `tribute_new_borrower_draft` (auto-saved on state changes).

### Task 6: Credit Assessments (`/officer/credit-assessments`)
- **Filter tabs:** `all` (`All`), `pending` (`Pending CI` -> `pending_assessment`), `admin_queue` (`In Admin` -> `pending_admin`), `approved` (`Approved` -> `admin_approved | contract_ready | disbursed`).
- **5 Cs Scorecard inputs:** Character (0–20), Capacity (0–25), Capital (0–20), Collateral (0–20), Conditions (0–15) -> `calculate5CsGrade(total)`.
- **Officer recommendation & adjustment:** `officerAmount`, `recommendation` (`recommend_approve | recommend_adjust | recommend_reject`), `officerNote`.
- **Actions:** `handleSaveAssessment(false)` (`Save Assessment Draft`), `handleSaveAssessment(true)` (`Submit & Endorse to Admin`), and when `status === 'admin_approved'`, Link to `/officer/borrowers/new` (`Proceed to Step 7 Contract`).

### Task 7: Current Borrowers (`/officer/borrowers`)
- **Included statuses:** `disbursed`, `contract_ready`, `admin_approved`.
- **Controls:** Search (`borrowerName`, `policyNo`, `id`, `location`), Product filter (`All`, `Regular Loan`, `Small Business Loan`, `Emergency Loan`), Sort (`dueDate`, `name`, `amount`, `balance`).
- **Row / Card actions:** `Pay Loan` (or disabled `Fully Paid`), `Savings (CBU)`, `Renew Loan (Cycle N)` when `currentRemBal <= singleInst * 2`, `Details`, `Passbook`, `Ledger`.
- **Modals & Print targets:** Pay Loan modal, Savings modal, Renewal modal, Details print (`print-mode-details`), Passbook modal (`print-mode-passbook`), Payment Ledger print (`print-mode-payment-ledger`).
