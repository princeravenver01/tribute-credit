# Account Officer Pipeline Board Design

## Intent

Redesign the Account Officer experience as a modern, professional, mobile-first loan operations workspace. The primary interface is a pipeline board that lets an officer understand the state of every application, spot urgent work, and take the correct next action with minimal navigation.

The design must support the workflow that already exists in Tribute Credit: borrower onboarding, location and identity capture, livelihood and capacity assessment, Five Cs review, endorsement to Admin, Admin decision tracking, contract execution, disbursement readiness, borrower monitoring, renewals, and offline synchronization.

The visual direction selected by the user is **Pipeline Board**.

## Why this direction

Account Officers manage many files in different stages. The current dashboard emphasizes summary cards and a desktop table, which makes mobile users scan too much before they know what needs attention. Pipeline Board instead treats application stage, urgency, risk grade, missing requirements, and next action as the main information architecture.

It should feel like a focused field-operations product, not a miniature desktop admin panel.

## Goals

- Make the next required action obvious within five seconds of opening the app.
- Let an officer move between pipeline stages without leaving the dashboard.
- Present each application as a readable mobile card rather than a compressed table row.
- Preserve the existing loan lifecycle and route structure unless implementation planning identifies a safe simplification.
- Make onboarding and assessment manageable on a phone through short, resumable sections.
- Keep offline state, draft saving, and synchronization visible without dominating the interface.
- Use consistent status language across Dashboard, Applications, Assessments, and Borrowers.
- Scale cleanly from 320 px phones to tablets and desktop screens.
- Preserve the Tribute Credit green identity while making the product calmer, cleaner, and more legible.

## Non-goals

- Redesigning the Admin, Borrower, or Disbursement portals in this phase.
- Changing lending policy, approval authority, scoring logic, interest calculations, or database schema.
- Replacing existing face capture, signature capture, GPS verification, print documents, or offline storage behavior.
- Adding a new communications, mapping, or route-planning product.
- Creating decorative analytics that do not help an Account Officer complete work.

## Anti-goals

The redesign fails if it:

- Looks polished but hides urgent or blocked files.
- Recreates desktop tables on narrow screens.
- Uses color alone to communicate status or risk.
- Requires several taps to resume an incomplete application.
- Makes officers fear losing field data when connectivity changes.
- Adds large numbers of cards, badges, gradients, or charts that compete with the work queue.
- Changes business meaning while merely renaming statuses.

## Constraints and existing product facts

- This phase is strictly a visual redesign. It must not add, remove, reinterpret, or alter any product functionality.
- Existing routes, API calls, data mapping, calculations, persisted status values, storage keys, polling, draft restoration, event handlers, form validation, submission behavior, signatures, GPS, face capture, printing, and offline synchronization must remain functionally identical.
- Mockup controls that do not map to an existing interaction must not be implemented as new behavior. They may be shown only as non-interactive presentation when that cannot mislead the user; otherwise omit them.
- Do not add dependencies, change the database schema, or modify API contracts for this redesign.
- The application uses Next.js 16.4.3, React 19.3, TypeScript, and Lucide icons.
- Relevant Account Officer routes currently include:
  - `/officer/dashboard`
  - `/officer/queue`
  - `/officer/borrowers/new`
  - `/officer/borrowers`
  - `/officer/credit-assessments`
- The main persisted assessment states are `pending_assessment`, `pending_admin`, `admin_approved`, `admin_rejected`, `contract_ready`, and `disbursed`.
- Onboarding currently contains seven steps and supports draft restoration, GPS verification, documents, AI-assisted verification, signatures, face and ID capture, contract execution, and disbursement choice.
- The product already supports offline drafts and queued synchronization through IndexedDB.
- The current UI relies heavily on inline styles. The implementation plan should introduce reusable presentation primitives without rewriting business logic unnecessarily.
- Existing local changes in the repository belong to the user and must be preserved.

## Approaches considered

### Field Focus

A balanced dashboard with a prominent “New borrower” action, compact daily metrics, and a short priority list.

**Tradeoff:** easiest to learn and visually calm, but less effective when officers manage a large number of simultaneous applications.

### Pipeline Board — selected

A stage-led workspace with Review, Admin, Sign, and Release views. Each card exposes the borrower, reference, amount, capacity, risk grade, blocker, and next action.

**Tradeoff:** carries more information and requires disciplined card hierarchy, but best matches the actual multi-stage workload.

### Guided Day

A schedule-and-task view organized around visits, signatures, and a daily checklist.

**Tradeoff:** excellent for appointment-heavy field operations but makes unscheduled underwriting and queue management secondary.

## Information architecture

### Primary mobile navigation

The fixed bottom navigation has five destinations:

1. **Pipeline** — dashboard and active applications by stage.
2. **Borrowers** — active and historical member records.
3. **New** — elevated primary action that starts onboarding.
4. **Assess** — the existing Credit Assessments workspace, focused on Five Cs review and endorsement.
5. **Profile** — officer identity, sync state, settings, and sign out.

The current drawer can remain on larger screens and as a mobile fallback for secondary destinations, but it is not the primary navigation on phones.

### Pipeline stages

The dashboard stage selector uses business-friendly labels while preserving exact system states:

| Pipeline label | Included system state | Meaning |
| --- | --- | --- |
| Review | `pending_assessment` and incomplete local drafts | Officer must complete or correct the file |
| Admin | `pending_admin` | Endorsed and waiting for Admin action |
| Sign | `admin_approved` | Approved; borrower and officer execution is next |
| Release | `contract_ready` | Contract completed; ready for disbursement handling |
| Closed | `disbursed` and `admin_rejected` | Available through filters/history, not a primary active stage |

Rejected applications must always say **Declined by Admin** and expose the reason when available. They must not look like an active stage.

Incomplete local drafts are sourced from `tribute_new_borrower_draft`. They appear first in Review with a **Draft · Step N of 7** label and a **Resume application** action. A draft and a persisted assessment are de-duplicated using the existing application ID, policy number, then borrower-name checks. Drafts count toward Review but retain a distinct draft label so they are never mistaken for completed assessments.

## Screen designs

### 1. Pipeline dashboard

The mobile header contains the page title, officer identity, search, and a compact synchronization indicator. A dark forest header provides clear product framing without turning the whole app dark.

Below it:

- One portfolio summary: total recommended amount and active-file count.
- A four-stage segmented control: Review, Admin, Sign, Release, each with a count.
- A stage-specific queue sorted by actionable attention state, then most recently updated.
- Search and a compact filter action.

Each application card contains only information needed for triage:

- Borrower name and initials/avatar.
- Loan reference and product.
- Requested or currently recommended amount, clearly labeled.
- Capacity amount or payment capacity indicator.
- Risk grade with a text label, not just a colored letter.
- One blocker or context line such as “Missing proof of income,” “Due today,” or “Visit verified.”
- One stage-appropriate action: Continue review, View Admin status, Start signing, or View release file.

Cards are fully tappable. The explicit action label tells users what opening the card will do.

The first implementation must not invent deadlines. “Due today” appears only when a real due or appointment value exists. Otherwise, attention signals are derived from known data: incomplete draft step, missing required onboarding fields or attachments, failed synchronization, Admin decision, or readiness for signing. Within an equal attention level, sort by `evaluatedAt` or draft `savedAt`, newest first.

Card financial and risk values use these existing sources:

- Active recommended amount: `officerAdjustedAmount`, falling back to `aiPreApprovedAmount`, then `requestedAmount`.
- Approved amount: `adminApprovedAmount`, falling back to the active recommended amount.
- Contract amount: `finalContractAmount`, falling back to the approved amount.
- Capacity: `netDisposableIncome`, labeled **Net disposable**, with **Not calculated** when absent. Do not substitute an invented value.
- Risk: `fiveCs.riskGrade`, falling back to `aiRiskRating`, with **Not assessed** when absent. Do not default missing risk to Class A.

### 2. Application detail

Opening a card leads to a mobile detail view, not directly into a large form.

The top summary includes borrower, loan reference, stage, amount, risk grade, last updated time, and sync state. Below it is a compact progress tracker using the actual lifecycle.

The tracker has these exact states: **Draft (Step N of 7)** → **Officer review** (`pending_assessment`) → **Admin review** (`pending_admin`) → **Signing** (`admin_approved`) → **Release** (`contract_ready`) → **Disbursed** (`disbursed`). `admin_rejected` is a terminal **Declined** branch from Admin review. The tracker reads local `currentStep` only while a draft is incomplete; persisted governance states remain the authority after submission.

Content is grouped into collapsible sections:

- Identity and contact
- Household and dependants
- Livelihood and income
- Assets and liabilities
- Loan request and calculation
- Documents and verification
- Assessment and recommendation
- Signatures and contract

The primary action is sticky at the bottom and changes by stage. Secondary actions appear in an overflow menu. Destructive actions never share equal visual weight with the primary action.

### 3. New borrower onboarding

The existing seven-step flow remains, but its mobile presentation becomes a resumable task sequence:

1. Personal information
2. Contact, address, and IDs
3. Household and dependants
4. Livelihood, income, assets, and liabilities
5. Loan request and repayment terms
6. Consent, attachments, and officer review
7. Contract execution and disbursement choice

On mobile, show the current step name, progress such as “2 of 7,” and a short completion checklist. Do not display seven wide tabs.

Every section autosaves. The top bar shows **Saved on device**, **Sync pending**, or **Synced** with both icon and text. “Save and exit” returns to Review and keeps the application at the top of the queue.

Long sections use subsections and repeatable item cards. Add/edit actions open focused sheets or panels rather than expanding a huge page. Numeric inputs use Philippine peso formatting while editing without changing the stored calculation behavior.

### 4. Credit assessment

The assessment view leads with the recommendation and the evidence behind it, not with a large score graphic.

- Recommended amount
- Requested amount
- Estimated installment
- Capacity and debt burden
- Five Cs grade with a text interpretation
- Verification findings and exceptions

Each Five Cs category can expand to show its evidence. Officer adjustments require a reason and display the previous value. The final endorsement action summarizes what will be sent to Admin before submission.

### 5. Borrower directory and profile

The borrower directory is search-first. It uses compact rows or cards with name, member number, active-loan state, next due date, and overdue indicator when applicable.

The borrower profile begins with one operational summary, then tabs or segmented sections for Loan, Payments, Documents, Activity, and Renewal. Renewal remains a clear contextual action when the record is eligible.

Directory payment details come from existing fields: `nextDueDate`, `remainingBalance`, and `paymentLedgerRecords`. An account is shown as overdue only when a ledger record is explicitly `Overdue`; absence of a due date does not imply delinquency. Keep the current renewal eligibility rule: the loan is eligible when its remaining balance is zero or no more than two scheduled installments, using the existing loan calculation and remaining-balance fallback.

### 6. Offline and synchronization states

Connectivity is persistent but quiet:

- **Synced** — small success state in the header.
- **Saved on device** — the current change is safe locally.
- **Sync pending · N items** — amber state with a manual Sync action.
- **Offline** — an explanatory banner appears once, then collapses to a compact indicator.
- **Sync failed** — show the failed count and a retry action; never imply data was lost.

The existing Clear Data control must not appear beside normal synchronization. It belongs in a protected development or settings area with explicit confirmation.

## Visual system

### Color

- Primary: Tribute green `#15803D`, with `#16A34A` available for selected highlights.
- Header: solid or subtly graded forest green, never black or teal.
- Background: very pale green-white `#F6FBF7`.
- Surfaces: white `#FFFFFF`; this Account Officer redesign uses a fixed green-and-white light theme.
- Amber: waiting, missing information, or attention.
- Red: destructive actions, failed states, and declined decisions only.
- Blue: informational states where green would incorrectly imply success.

Every semantic color is paired with text, an icon, or a shape.

### Typography

Use the existing Plus Jakarta Sans unless implementation testing shows a readability issue. Maintain a restrained scale:

- 20–24 px for page-level values or headings.
- 14–16 px for core labels and card titles.
- 12–13 px for supporting metadata.
- Never below 11 px for meaningful text.

Use weight and spacing before introducing more colors.

### Geometry

- Application cards: 16–18 px radius.
- Inputs and compact controls: 10–12 px radius.
- Minimum touch target: 44 by 44 px.
- One subtle shadow layer for floating navigation or temporary overlays only.
- Use dividers and spacing instead of nesting cards inside cards.

### Icons

Continue using Lucide icons. Icons support labels and must not replace essential words in navigation or actions.

## Responsive behavior

### Phones: 320–599 px

- Single-column layout.
- Fixed bottom navigation with safe-area padding.
- Pipeline cards use stacked financial fields.
- Primary stage selector remains visible near the top; it may scroll horizontally only if localization or accessibility text size requires it.
- Sticky bottom action on detail and form screens.
- Sheets and full-screen panels replace desktop modals.

### Tablets: 600–1023 px

- Two-column queue when card widths remain readable, otherwise one wide column.
- Application detail may use a summary rail beside content.
- Bottom navigation may become a compact side rail in landscape orientation.

### Desktop: 1024 px and above

- Persistent side navigation.
- Pipeline stages can appear as columns or as a stage selector plus wider queue; implementation should choose the form that preserves shared components and avoids horizontal card compression.
- Application detail uses a main content area plus a sticky summary/action rail.
- Desktop must remain functional, but mobile is the design source of truth.

## Interaction and feedback

- Loading uses skeleton rows shaped like the eventual content.
- Empty stages explain what the stage means and provide the relevant next action.
- Errors remain near the affected field and are summarized when a form submission fails.
- Successful submission changes the visible stage immediately and confirms the new state.
- Tapping an application never triggers a status transition by itself.
- Important transitions such as endorsement, signing completion, and finalization require a review confirmation.
- Motion is short and functional, and respects reduced-motion preferences.

## Accessibility

- Meet WCAG AA contrast for text and controls.
- Support text scaling without clipping at 320 px.
- Preserve native keyboard and screen-reader semantics.
- Use visible focus states.
- Announce synchronization, validation, and submission results through appropriate live regions.
- Do not rely on swipe gestures or hover for essential actions.

## Content principles

- Use the same label for the same state everywhere.
- Prefer action language: **Continue review**, **View Admin decision**, **Start signing**, **Prepare release**.
- Show peso values with clear labels and Philippine locale formatting.
- Use “Borrower” consistently in the officer workspace, while preserving formal “Member” language where required by documents.
- Keep policy and compliance wording intact even when surrounding UI copy becomes shorter.

## Implementation boundaries left to the builder

- Exact component filenames and folder structure.
- Whether reusable styling is implemented with CSS Modules, shared classes, or another approach already supported by the repository; do not add a large UI dependency solely for the redesign.
- The safest order for extracting inline styles while preserving behavior.
- Whether the desktop pipeline uses columns or a selector after testing with realistic data density.
- Exact loading placeholders and non-semantic animation details.

## Acceptance criteria

- A behavior-diff review confirms that no business logic, event-handler bodies, API requests, storage keys, calculation calls, or route destinations changed.
- At 390 px, an officer can identify the current stage, top urgent file, blocker, and next action without horizontal page scrolling.
- At 320 px, all primary controls remain usable and no meaningful text is clipped.
- An incomplete onboarding draft can be resumed in two taps or fewer from the Pipeline screen.
- Offline saves and pending synchronization are visible and accurately described.
- Every persisted application status maps to one unambiguous user-facing state.
- Application cards display realistic data without becoming taller than necessary for triage.
- All seven onboarding steps remain available and preserve existing business behavior.
- Admin decisions, signing readiness, contract completion, and disbursement state remain distinguishable.
- The Account Officer experience works on desktop without losing the mobile hierarchy.
- No unrelated user changes are overwritten.

