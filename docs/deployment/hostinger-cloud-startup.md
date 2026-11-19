# Hostinger Cloud Startup deployment

Deploy this repository as three Node.js Web Apps. Each app uses the same commit, database, and `JWT_SECRET`; Hostinger assigns one production hostname to each app.

| Portal | Hostname | Login |
| --- | --- | --- |
| Borrower | `credit.tribute-grace.com` | `/borrower/login` |
| Account Officer | `ao-credit.tribute-grace.com` | `/officer/login` |
| Admin and disbursement | `admin-credit.tribute-grace.com` | `/admin/login` |

## 1. Preserve the current sites

Before changing DNS or removing the Coming Soon pages, download a backup of each existing site and export its current DNS records. Record the previous deployment or document-root target so rollback is quick.

## 2. Prepare MySQL once

1. Create one production MySQL database and a dedicated database user in Hostinger.
2. Import `database/schema.sql` once through phpMyAdmin or Hostinger's database import tool.
3. Do not import development user records. The schema intentionally creates no login accounts.

For a database running on the same Hostinger server, use `DB_HOST=127.0.0.1`. If Hostinger displays a different database host in hPanel, use that exact value instead.

## 3. Create the three apps

Create three Node.js Web Apps from the same repository and production commit. Configure all three with:

- Node.js 22
- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start`
- Production mode enabled

Assign the Borrower, Account Officer, and Admin hostnames from the table above to their matching Web Apps. Enable SSL for every hostname before testing authentication.

## 4. Set shared environment variables

Copy the names from `.env.example` into every app. All three apps must use identical database values and the same unique `JWT_SECRET`:

```text
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=<hostinger database user>
DB_PASSWORD=<hostinger database password>
DB_NAME=<hostinger database name>
DB_SSL=false
JWT_SECRET=<one cryptographically random value of at least 32 characters>
```

Generate the JWT secret with a password manager or a cryptographically secure generator. Never reuse a human password, commit the value, or give each portal a different value.

## 5. Create the first administrator once

Temporarily add `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_MEMBER_NO` to one app. The password must be at least 12 characters and must not be a demo password. From that app's terminal, run:

```text
npm run create-admin
```

Confirm the command succeeds, then remove `INITIAL_ADMIN_PASSWORD` from the environment. New Account Officers and Admins can then be created from Manage Users.

## 6. Production smoke tests

Run these smoke tests before directing users to the portals:

1. Open each hostname at `/` and confirm it redirects to its own login.
2. Sign in with the matching role and confirm the dashboard loads.
3. Try an Admin session on the AO and Borrower hosts; confirm access is rejected and the session is cleared.
4. Confirm the Admin can open loan approvals and the disbursement workflow.
5. Confirm an AO can open applications, credit assessments, borrowers, and disbursements.
6. Confirm a Borrower sees only their own dashboard, loans, savings, and account settings.
7. Change a test password, sign out, and sign in again.
8. Submit a small controlled test application and verify it reaches the correct AO and Admin stages.
9. Check Hostinger application and MySQL logs for authentication, database, or proxy errors.

## 7. Cutover and rollback

After smoke tests pass, reduce DNS TTL if necessary, point all three subdomains to their Web Apps, and monitor logs during the first day.

If a blocking issue appears, rollback by restoring the previous DNS or site target captured in step 1, restoring the database backup if the schema/data was changed, and redeploying the last known-good commit. Keep the Coming Soon backups until the production portals have been stable and verified.
