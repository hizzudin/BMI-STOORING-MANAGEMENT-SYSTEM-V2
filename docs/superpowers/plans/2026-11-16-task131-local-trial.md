# TASK-131 plan: local trial (one command, dummy data, every role signs in)

Branch `feat/phase1-task131-local-trial`. Spec: DEC-113, ADR-0003 (amended), DEC-130 (PRD v2.42, commit 00a2a23). No migration, no new runtime dependency.

## Goal

The owner can try the system on a local computer:
- `pnpm trial` builds, prepares `bmi_trial` and starts the API and web app with dummy data;
- `pnpm trial:reset` brings the same data back.

**Done when:**
- every role signs in and sees its menu;
- the Planner saves a new SPK and submits a seeded draft with steps, and a Supervisor approves it in the browser;
- reset gives the same data again;
- the seed refuses a non-local database;
- CI runs the seed against its scratch database.

## Architecture

### Location
`apps/api/src/infra/db/trial/`, beside the e2e command. ADR-0003 named `apps/api/seeds/local/`, but the API build compiles only `src/` (`rootDir: src`). The ADR line is updated to the real path.

### `trial/trial-target.ts`
`trialDatabaseUrl(env)`:
- reads `TRIAL_DATABASE_URL`, with the default `postgres://bmi:bmi_local_dev@localhost:5432/bmi_trial`;
- refuses, with one sentence, a host that is not `localhost` or `127.0.0.1`, and a database whose name is not `bmi_trial` (DEC-130: never `bmi_dev`).

### `trial/trial-seed.ts`
`seedTrial(client, { now, password })` is plain data typed by hand (ADR-0001) and returns the accounts with their passwords. It writes:
- **Accounts:** one per role of `ROLES` (10). Names are typed by hand; emails are `<role>@trial.test`; each has a random password.
- **Live mode** (`system_mode`).
- **Vehicles:**
  - the chassis layouts Tractor 4x2 and Trailer 3 axles;
  - the classes Tractor head (Powered) and Trailer tail (Towed);
  - four vehicles, one of them a trailer.

  The document types already come from migration 0007; the documents come with TASK-601.
- **Step modules,** with their PRD codes: Stock (Warehouse Manager), Part_Purchase (Field Coordinator) and Mechanic_Action (Mechanic). They use `ON CONFLICT (code) DO NOTHING`, so the registry of TASK-207 wins when it exists.
- **Nine SPKs, one per status,** created by the Planner and numbered from `spk_number_seq` (NFR-15). The steps and `spk_approvals` rows agree with the status:

  | Status | Steps | spk_approvals rows |
  | --- | --- | --- |
  | Draft | 2 Locked (the one the Verify submits) | none |
  | Pending_Approval | Locked | Submit |
  | Rejected | Locked | Submit, then Reject by the Supervisor with a reason |
  | Active | 1 Open, the others Locked | Submit, Approve |
  | In_Progress | 1 Verified, 2 Open with an assignee | Submit, Approve |
  | Pending_Verification | all Submitted or Verified | Submit, Approve |
  | Pending_Amendment | the open step frozen | Submit, Approve; `status_before_amendment` set if §9.6 has it |
  | Completed | all Verified | Submit, Approve, Request_Completion, completion Approve |
  | Cancelled | Locked | `cancel_reason` set |

  The urgencies and vehicles vary.
- **Approval switch:** the Planner approval switch stays off.

### `trial/trial-cli.ts` (built to `dist/infra/db/trial/trial-cli.js`)
- **Without `--reset`:**
  - check the target;
  - create `bmi_trial` through the `postgres` database when it is missing;
  - migrate;
  - seed only when `users` is empty (an existing trial keeps its data and passwords).
- **With `--reset`:** drop with `FORCE`, create, migrate and seed.
- **After seeding:** write `.data/trial-accounts.md` (role, name, email, password) and print the emails and the file path, never a password.

### `scripts/trial.mjs` (root, no dependency)
1. `pnpm --filter @bmi/shared build` and `pnpm --filter @bmi/api build`.
2. Run the trial CLI; `--reset` stops after this step.
3. Spawn `node apps/api/dist/main.js` with `DATABASE_URL` set to `bmi_trial`, and `pnpm --filter @bmi/web dev`.
4. Prefix their output with `[api]` and `[web]`, print the URL `http://localhost:3000` and the accounts file, and stop both on Ctrl+C.

### Root and CI
- **`package.json` scripts:** `"trial": "node scripts/trial.mjs"` and `"trial:reset": "node scripts/trial.mjs --reset"`.
- **`ci.yml`:** a step "Local trial seed follows the migrations" runs `node apps/api/dist/infra/db/trial/trial-cli.js --reset` against the CI Postgres on localhost (ADR-0003 consequence).

### Docs
- **`docs/dev-setup.md`, new Local trial section:**
  - the two commands;
  - what the data holds;
  - the email of each role and where the passwords are;
  - that Redis is optional for the trial.
- **`.claude/launch.json`:** the `api-trial` configuration (API on `bmi_trial`) is committed for the preview tools.

## Tests (written first, run red before the code)

### Integration (`test/integration/trial/trial-seed.test.ts`)
Runs against the test database, never `bmi_trial`.
- **DEC-130 target:** `localhost` and `127.0.0.1` with `bmi_trial` are accepted; another host, `bmi_dev`, or another name are refused with the sentence.
- **DEC-113 accounts:** one account per role. Each account signs in through the real API with the password the seed returned, and each holds its role.
- **DEC-130 SPKs:** nine SPKs, one per status, numbered `SPK-\d{10}`. For each, the steps and approval rows agree with the table above. The Draft has steps, so its creator may submit it, and a Supervisor may then approve it through the API.
- **Seed-once:** a second `seedTrial` on a seeded database is refused, because the CLI only seeds an empty one.

### Unit
`trial-target` cases, which need no database.

### Verify (browser, done by me before the PR)
- `pnpm trial:reset`, then `pnpm trial`.
- Sign in as each role and check its menu.
- As the Planner: Create SPK, then Save draft; then submit the seeded draft.
- As the Supervisor: Approvals, then Approve.
- `pnpm trial:reset` gives the nine SPKs again.

## Review focus
1. **DATABASE_URL pointing at production or staging:** the target refuses any host other than localhost and any name other than `bmi_trial`. Owned by the target tests.
2. **`pnpm trial` run twice:** the second run keeps the data and passwords. Owned by the seed-once test.
3. **Seed rows that break a constraint or a state rule:** they are inserted through the migrations' schema in one transaction, and the per-status checks catch them. Owned by the SPK test.
4. **A password reaching the repository or the console:** passwords are written only to `.data/` (gitignored), and the CLI prints emails only. Owned by review and the secret scan.
5. **A migration added later breaks the seed:** the CI step runs the seed after every migration. Owned by CI.

## Out of scope
- Vehicle documents (TASK-601).
- Real step content (TASK-207).
- Data for later features, which each task adds to `seedTrial`.

## Execution
Native, in this session.
- **Skills:** the always-on skills; postgres-patterns and database-migrations for the seed; tdd-workflow; living-docs-governance for the docs.
