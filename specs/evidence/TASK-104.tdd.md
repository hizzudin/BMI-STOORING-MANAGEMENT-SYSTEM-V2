# TASK-104 Sign-in, password rules and reset, first sign-in change, lockout, sessions

Requirements: REQ-IAM-001, REQ-IAM-009. Rules: NFR-05, NFR-11, DQ-02, DEC-102, DEC-114. Tables: users, auth_sessions, password_reset_tokens (§9.2).

## Spec first (DEC-114, PRD v2.25)

Owner decisions before code: REQ-IAM-009 follows DEC-102 (reset link by email, works once, 60 minutes); §9.2 gains `auth_sessions` and `password_reset_tokens`, tokens stored only as SHA-256 hashes; the end-to-end FLW-AM-04 (unlock on AMAccountForm) runs with its screen in TASK-107, while TASK-104 tests lock and unlock through the API. design.md 5.1 describes the design.

## What changed

- API: migration `0003_auth_sessions_reset.sql` and its Drizzle tables; `core/iam/AuthService` (sign-in with the 5-failure lock of 15 minutes, refresh with rotation, sign out, change password, forgot and reset password, unlock and temporary password for TASK-107) behind the ports of `ports/iam.ts`; adapters for scrypt hashing, HS256 access tokens, Drizzle gateways, a console email adapter (local trial prints the link) and the system clock; `http/auth` with the routes `POST /auth/sign-in|refresh|sign-out|change-password|forgot-password|reset-password` and `GET /me`, the `SessionGuard` (bearer or HttpOnly cookie, Origin check for cookie writes, first-sign-in restriction) and the refusal filter (401, 423, 400, 403).
- Shared: `PasswordSchema` and the auth request and response schemas, so web, phone and API apply one rule.
- Client: regenerated `@bmi/api-client` from the new contract.
- Web: `/login`, `/change-password`, `/forgot-password`, `/reset-password` (WebLogin, ChangePassword, ForgotPassword, ResetPassword), the `/api` same-origin proxy, the lazy `authApi`, form and note styles.
- E2E: Playwright starts the API on a fresh `bmi_e2e` database built by `pnpm --filter @bmi/api e2e:db` with accounts whose passwords are made per run.
- Artboard: ForgotPassword now says the link expires after 60 minutes (DEC-114).

## How the spec was read

- ChangePassword: the artboard shows New and Repeat only (first sign-in); the action map asks the current password for a change. Both hold: the first sign-in does not ask it again, a change from the user menu does.
- After a reset the sign-in page shows "Your password is changed. Sign in with the new one."; Forgot password always answers the same way, so no account can be discovered. Both are feedback the spec needs and the artboards do not draw.
- After sign-in the browser goes to `/`; the role's dashboard and the Access Manager's Users and roles arrive with their tasks (TASK-106 decides the menu).
- Sign-in, refresh, forgot and reset carry no Idempotency-Key: no account is known yet (idempotency_keys.user_id); repeating them is harmless.

## Evidence

- RED: the 21 integration tests failed before the routes existed; the web tests failed before the screens existed.
- GREEN: `int "REQ-IAM-001|REQ-IAM-009|NFR-05"` and the DEC-102/DEC-114 tests: 21 passed. Whole API integration suite: 93 of 94 passed in one run; the one failure was `TX-01 applies the files in numbered order` timing out while creating a database under disk load, and it passed alone (4 of 4). Shared: 8 schema tests. Web: 51 tests, coverage 96.6 % statements, 99.1 % functions.
- `qa` at 1280 x 800 against the artboards, measured in the browser: WebLogin, ChangePassword, ForgotPassword and ResetPassword sheets 980 x 349 at y 40, fields 451 x 59, inputs radius 14, notes radius 18, buttons and links in the same places within 2 px.
- Real flow on the local API: the QA account signed in, was sent to Change password, saved a new password and reached `/`; `/api/me` answered for it; `document.cookie` stayed empty (HttpOnly); Forgot password printed the link in the API log; the link set a new password and returned to sign in with the note.
- _Verify_ `e2e auth`: 5 passed (4 auth specs and the smoke spec) against the API on a fresh `bmi_e2e` database. The first local run timed out while opening Chromium with four workers on this machine; with one worker it passes. Two spec fixes followed: the refusal is found by its class because Next.js keeps an empty `role=alert` route announcer, and `expect` waits 20 s because a sign-in hashes at the production scrypt cost.
- Layer rules, lint, typecheck, format, secret scan and `check-coverage.mjs --tests` pass.
