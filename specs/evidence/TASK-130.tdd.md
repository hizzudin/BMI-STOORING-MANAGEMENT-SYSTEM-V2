# TASK-130 In-app notifications foundation

Requirements: REQ-NTF-001, REQ-NTF-005. Rules: C-03, DEC-27, DEC-118, DEC-125. Tables: notifications, notification_deliveries (§9.12). Screen: NotificationCenter.

## Spec first (DEC-125, PRD v2.37)

PRD 8.3 asks for an outbox with a dedupe key, but §9.12 had no column for it. The owner decided:

- `notifications.dedupe_key` is unique per user, so an event written twice gives each recipient one notice.
- The Planner approval switch notice goes to Supervisors and GMs as kind Approval and opens nothing: a click only marks it read.
- The bell badge refreshes on page load, when the panel opens, and every 60 seconds.

The data model in `docs/prd/data-model.md` was changed before the migration.

## What changed

- **Migration 0010:** both tables. `device_id` is a plain column until `push_devices` arrives with mobile push (the DEC-124 rule).
- **Shared:** `schemas/notifications.ts` (kinds, the five tabs and their kinds, the poll interval, list and count responses).
- **API:**
  - The notification port and gateway, where `send` is the outbox: written in the caller's transaction with `ON CONFLICT DO NOTHING`, plus an InApp delivery row, Sent.
  - `NotificationService` and `/notifications`: list, unread count, read one, read all; own notices only.
  - `PlannerApprovalService` now sends the four switch notices in the transaction of its audit record.
- **Web:**
  - `NotificationCenter` panel: tabs with unread counts, Unread pill, Mark all read, Close and Escape; a click reads the notice and opens its link.
  - `SignedInShell` reads the badge and polls every 60 s; `AppFrame` wires the API.

## Evidence

- **RED:** `notifications/notifications.test.ts` and the web tests were written before the code; the first API run was then blocked by the stopped local database and passed once it was restarted.
- **GREEN:**
  - `notifications.test.ts` 5:
    - on, changed and off reach every active Supervisor and GM, and only them;
    - the InApp delivery is Sent, and the ended switch gives one notice despite two end-job runs;
    - the same key written twice gives one notice;
    - list newest first with unread per tab, read one (404 for another user), read all, unread count;
    - 401 without a session.
  - The Planner approval, drift and conventions tests: 21 of 21 with the above.
  - Web shell tests 17 of 17, including `notification-center.test.tsx` 6: tabs and counts, link opens, no-link only read, Mark all read, Close and Escape with a refusal, WIB times, and badge polling every 60 s.
- **QA** at 1440 x 900 against NotificationCenter on the local database, with QA notices on the local System Admin account:
  - The panel, Mark all read, Close, tabs with counts (wrapping like the artboard), rows with bold unread titles and the Unread pill, and the body with time all match.
  - Clicking the switch notice only marked it read (badge 4 to 3).
  - Kept: the artboard tints some icons red without a rule in the spec; all icons stay neutral.
- Full runs:
  - shared 299 tests, 100 %;
  - web 127, 88.4 %;
  - API 192 of 192, 96.5 %;
  - e2e 15 of 15, with the bell on every page.
- Types, lint, layers and secrets are clean. Format is clean except the local, untracked design-hook cache.
