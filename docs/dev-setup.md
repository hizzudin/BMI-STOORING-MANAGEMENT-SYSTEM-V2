# Local development setup

The local services are PostgreSQL 16 and Redis inside WSL Ubuntu 24.04, with no Docker (design.md D-01). The API, web app and tests run on Windows and reach the services on `localhost`.

## First time

1. The distro lives on D: (`D:\wsl\Ubuntu-24.04`). Move a fresh one with `wsl --shutdown`, then `wsl --manage Ubuntu-24.04 --move D:\wsl\Ubuntu-24.04`.
2. Install the services; the script is safe to run again. Run it from PowerShell, because Git Bash rewrites `/mnt/...` paths:

   ```powershell
   wsl -d Ubuntu-24.04 -u root -- bash "/mnt/d/project/BMI Stooring System v2/docs/dev-setup-wsl.sh"
   ```

3. Keep browsers off the small C: drive: `PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright` (user environment variable).

## Every working session: keep WSL alive

WSL stops as soon as no process is attached, and every later start takes about a minute before PostgreSQL accepts connections. Leave this running in a terminal while you work:

```powershell
wsl -d Ubuntu-24.04 -u root -- sleep infinity
```

If tests report `ECONNREFUSED` on 5432 or 6379, this is the first thing to check. `wsl: Failed to start the systemd user session` is printed at every start and is harmless here: PostgreSQL and Redis are system services.

## Connection values

| Service | Value |
| --- | --- |
| PostgreSQL | `postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev` |
| Redis | `redis://localhost:6379` |

The `bmi` role and its password exist only on this machine: it is a local development role, bound to the private WSL network, and it may create the test databases of design.md D-02. Staging and production credentials live only in Secret Manager.

The server time zone is UTC (NFR-14) and Redis uses `maxmemory-policy noeviction`, which BullMQ needs.

## Checking the services

```powershell
wsl -d Ubuntu-24.04 -u root -- env PGPASSWORD=bmi_local_dev psql -h localhost -U bmi -d bmi_dev -Atc "select version()" -c "show timezone"
wsl -d Ubuntu-24.04 -u root -- redis-cli ping
```

## Local trial (DEC-113, DEC-130, ADR-0003)

Try the system in a browser with dummy data:

```powershell
pnpm trial
```

It builds the shared package and the API, creates the local database `bmi_trial` when it is missing, migrates it, seeds it once, then runs the API (port 3001) and the web app (`http://localhost:3000`) in the same terminal. Ctrl+C stops both. Running it again keeps the data and the passwords.

To start again from the same dummy data (new passwords):

```powershell
pnpm trial:reset
```

It drops and recreates `bmi_trial` only; `bmi_dev` and the test databases are never touched. The seed refuses any database that is not `bmi_trial` on `localhost` or `127.0.0.1` (`TRIAL_DATABASE_URL` overrides the default `postgres://bmi:bmi_local_dev@localhost:5432/bmi_trial`). Redis is optional for the trial.

**Accounts.** One per role. The passwords are made at random on each seed and written to `.data/trial-accounts.md` (gitignored); they are never in the repository, because it is public.

| Role | Email |
| --- | --- |
| System Admin | `system-admin@trial.test` |
| Planner | `planner@trial.test` |
| Supervisor | `supervisor@trial.test` |
| GM | `gm@trial.test` |
| Access Manager | `access-manager@trial.test` |
| Mechanic | `mechanic@trial.test` |
| Warehouse Manager | `warehouse-manager@trial.test` |
| Field Coordinator | `field-coordinator@trial.test` |
| Driver | `driver@trial.test` |
| Accounting | `accounting@trial.test` |

**Data.**
- Live mode.
- Four vehicles: three tractor heads and one trailer. Their documents come with TASK-601.
- The step modules Stock, Part Purchase and Mechanic Action.
- One SPK in each of the nine statuses, made by the Planner. Statuses whose screens come later show read only. Things to try:
  - **Tyre rotation (Draft):** has steps, so the Planner can submit it until the step composer comes (TASK-207).
  - **Brake pads front (Pending approval):** a Supervisor approves or rejects it under Approvals.
  - **Clutch replacement (Rejected):** the Planner opens it from the Rejected tab.

Each later task adds the dummy data its feature needs to `apps/api/src/infra/db/trial/trial-seed.ts`. The values are typed by hand, never read from the artboards (ADR-0001).

## Viewing the design artifact

`node specs/tools/serve-artifact.mjs` serves `Design Artifact/` on port 4173.
