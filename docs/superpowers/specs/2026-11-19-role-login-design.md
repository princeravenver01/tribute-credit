# Tribute Credit Role Login Design

## Intent

Create one modern, professional authentication experience for the three public Tribute Credit portals while making each role immediately recognizable:

- Borrower: `credit.tribute-grace.com`
- Account Officer: `ao-credit.tribute-grace.com`
- Administrator: `admin-credit.tribute-grace.com`

The login experience must be mobile-first, formal enough for a financial cooperative, and consistent with the existing green-and-white Borrower/AO interfaces and white-and-red Admin interface.

## Goals

- Present the official Tribute Credit identity clearly without duplicating the logo wordmark.
- Use one shared login structure and component system across all three portals.
- Give each portal a clear role identity without creating three unrelated designs.
- Make login comfortable on phones, tablets, and desktop screens.
- Preserve the existing email/password authentication flow while preparing it for production hardening.
- Provide clear loading, validation, failure, and disabled states.
- Remove demo content and development-only credentials before public deployment.

## Non-goals

- No social login, biometric login, OTP, or multi-factor authentication in this design pass.
- No new borrower registration flow.
- No public role selector or central portal hub on the deployed role subdomains.
- No dashboard, loan, or administrative workflow redesign.
- No separate public Disbursement portal; disbursement remains an authenticated staff workflow.

## Constraints

- Preserve the current portal routes and successful-login destinations.
- Use the existing Tribute Credit logo asset, design tokens, icons, and typography.
- Do not add a new UI library or font dependency.
- Admin remains a light theme with restrained red accents.
- Borrower and AO remain white with Tribute green accents.
- The smallest supported viewport is 320 pixels wide.
- Each hostname must allow only its intended role and redirect to its own login when authentication is absent or invalid.

## Approaches Considered

### A. Branded split layout — selected

A cooperative identity panel sits beside a focused login panel on wide screens. On mobile, the identity compresses into a compact header above the form. This gives the portals a formal institutional presence while keeping the actual sign-in task simple.

### B. Minimal centered card

A single centered card would be simpler but would not distinguish the three portals strongly enough on desktop.

### C. Dashboard preview layout

A dashboard preview would make each role recognizable, but it would add visual weight, expose unnecessary interface details before authentication, and require more maintenance.

## Shared Desktop Layout

The page uses a two-column composition contained within a refined surface rather than a floating card over a strong gradient.

### Identity panel

- Official Tribute Credit logo/wordmark at the top with correct aspect ratio.
- Small portal designation: Member Portal, Account Officer Portal, or Admin Portal.
- Short role-specific welcome statement.
- One concise security/support note near the bottom.
- Subtle background treatment using the portal accent and neutral shapes; no stock photography or decorative dashboard preview.

### Authentication panel

- Welcome title and concise instruction.
- Email field with visible label.
- Password field with visible label and show/hide control.
- Forgot-password action only when a functional recovery workflow exists; otherwise it is omitted rather than rendered as a dead link.
- Full-width primary sign-in button.
- Inline generic authentication error region.
- Small support/legal line below the form.

The form is the first interactive region in keyboard order. Decorative content is excluded from the accessibility tree.

## Mobile Layout

- Single-column white page with a compact brand header.
- Official logo remains readable and is not repeated as separate text when the asset already contains the wordmark.
- Portal label appears as quiet supporting text rather than a large badge.
- Form begins high enough that the sign-in button remains reachable without unnecessary scrolling on common phone heights.
- Minimum 48-pixel interactive controls with clear focus and pressed states.
- Side padding remains comfortable at 320 pixels with no horizontal overflow.
- Safe-area spacing is respected at the top and bottom.
- The identity panel's long descriptive copy and decorative background are removed on mobile.

## Role Variants

### Borrower Portal

- Accent: emerald/Tribute green.
- Label: `Member Portal`.
- Title: `Welcome back`.
- Supporting copy: `Sign in to view your loans, payments, savings, and account.`
- Primary action: `Sign in to Member Portal`.
- Tone is welcoming but still formal.

### Account Officer Portal

- Accent: deep cooperative green.
- Label: `Account Officer Portal`.
- Title: `Sign in to Field Desk`.
- Supporting copy: `Access borrower assessments, applications, disbursement confirmation, and account records.`
- Primary action: `Sign in to Field Desk`.
- Include a restrained `Authorized personnel only` notice.

### Admin Portal

- Base: white and neutral gray.
- Accent: restrained crimson red.
- Label: `Administration Portal`.
- Title: `Sign in to Admin Console`.
- Supporting copy: `Access approvals, governance, users, products, reports, and system settings.`
- Primary action: `Sign in to Admin Console`.
- Include a restrained `Restricted administrative access` notice without alarm-like animation or excessive warning styling.

## Form Behavior and States

### Default

- Empty fields; no production credentials are prefilled.
- Browser password managers remain supported through correct input names and autocomplete attributes.

### Focus and validation

- Focus uses a visible accent-colored ring in addition to the border change.
- Client validation identifies the specific field and does not erase entered values.
- Error text is associated with its field for assistive technology.

### Password visibility

- A labeled toggle changes between masked and visible password states.
- The control remains reachable by keyboard and announces its current action.

### Submitting

- The button becomes disabled and shows a small progress indicator with `Signing in…`.
- Duplicate submissions are prevented.

### Authentication failure

- Display a generic message such as `The email or password is incorrect.`
- Do not reveal whether an email exists, whether a user belongs to another portal, or database details.

### Wrong-role account

- Display `This account cannot access this portal.` without exposing the account's actual role.
- Remain on the same subdomain; do not automatically send users to another privileged portal.

### Service failure

- Display `We could not sign you in right now. Please try again.`
- Do not expose stack traces, SQL errors, or internal configuration.

## Production Authentication Requirements

- Remove built-in demo accounts, generic password overrides, and demo credential panels.
- Require a strong production `JWT_SECRET`; the application must not start with a known default secret in production.
- Validate the requested portal role on the server before creating a session.
- Verify the signed session and role for protected pages and API routes, not merely the existence of a cookie.
- Use secure, HTTP-only, same-site cookies in production.
- Add login rate limiting and basic audit logging before public release.
- Do not include `.env.local` or database credentials in the deployment archive or repository.

## Shared Component Structure

- `RoleLoginShell`: shared responsive identity/form layout.
- `RoleLoginForm`: shared email, password, status, and submission behavior.
- `portalConfig`: trusted server-defined portal label, accent, expected role, destination, and copy.
- Each route supplies only its approved role configuration; the browser must not be able to choose an arbitrary role through request data.

Inline page-level style objects will be replaced with shared CSS modules and existing design tokens so responsive behavior and form states remain consistent.

## Acceptance Criteria

- All three login routes use the same layout system and official logo.
- Borrower and AO use green identity treatments; Admin uses white with red accents.
- No login page displays a demo email, demo password, or prefilled credentials.
- No cross-portal navigation is shown on the three production subdomains.
- Desktop uses the split layout; mobile uses a single-column form without overflow at 320 pixels.
- All labels, errors, password controls, and submit states are keyboard and screen-reader accessible.
- A successful login reaches only the matching portal destination.
- A missing, invalid, expired, or wrong-role session cannot access another portal's pages or APIs.
- Existing loan, assessment, disbursement, and administrative functionality remains unchanged.

## Approval Gate

No login implementation or production deployment begins until this design is approved.
