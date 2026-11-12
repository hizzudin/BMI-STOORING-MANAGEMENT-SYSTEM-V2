# TASK-121 Create SPK header and Submit for approval

Requirements: REQ-SPK-001, REQ-SPK-002, REQ-SPK-013, REQ-SPK-015. Rules: BR-01, BR-02, DEC-85, DEC-92, DEC-126; transitions T1, T2, T5 of SM-SPK; REQ-NTF-005 for the submit notice. Journey: FLW-PLN-01 as far as this task goes. Tables: spks, spk_approvals, vehicles, audit_logs, notifications.

## Spec first (DEC-126, PRD v2.38)

The step composer, the parts catalog and the SPK list come later. The owner decided:

- TASK-121 builds the common fields, Cancel, Save draft and Submit with its notices.
- The Steps section, palette, Checks and presets stay hidden until TASK-207 and TASK-208.
- Submit is refused for an SPK without a step ("Add at least one step before submitting.").
- PartPicker moves to the Stock module (TASK-306).
- Create SPK opens from the Surat Perintah Kerja menu and from the vehicle page (C-11).

Before the code, the CreateSPK artboard gained the "Vehicle goes to the workshop" checkbox that REQ-SPK-001 and REQ-SPK-017 require, and its urgency options took the order of REQ-SPK-015 (Low, Normal, High, Urgent).

## What changed

- **Shared:** `schemas/spks.ts` (priorities, SPK view, form options, create, save and submit requests); `create_spk` on the vehicle actions.
- **API:**
  - `SpkService`, with one policy table for edit and submit (spk.create, Draft or Rejected, creator only) and the `/spks` routes.
  - T1: refused for an unknown or Inactive vehicle; the number comes from the stored format; the source is Manual_Planner or Manual_Admin.
  - C-15: save at the version on screen.
  - T2 and T5: the step check (DEC-126); then Pending_Approval, one `spk_approvals` Submit row, and the notice to Supervisors, GM and System Admin, plus Planners while the switch covers spk_creation.
  - Audit on every write.
  - The SPK gateway gained the view with vehicle and step count, save, status, approval row and the vehicles for the form.
  - The vehicle policy table gained `create_spk`.
- **Web:**
  - `/spk` shows the header with Create SPK.
  - `/spk/new?vehicle=` and `/spk/:id/edit` show CreateSPK:
    - the common fields;
    - Cancel with C-12;
    - Save draft, which follows the new draft to its edit page and says "Saved." there;
    - Submit, which saves first;
    - read only, with status and urgency pills, once the SPK left Draft or Rejected.
  - VehicleOverview has a Create SPK button.
- **E2E:** `create-spk.spec.ts`, FLW-PLN-01 for this task: from the vehicle page, Save draft, then Submit refused without a step.

## Evidence

- **RED:**
  - `spk/create-spk.test.ts` and the web tests were written before the code.
  - The first E2E run caught a real bug the unit test missed, because it mocked navigation: after Save draft the page moves to a new route and lost "Saved.". The redirect now carries `?saved=1`.
- **GREEN:**
  - `create-spk.test.ts` 7:
    - Draft with number, source and audit;
    - Manual_Admin, and a Mechanic refused;
    - Inactive vehicle refused and not offered;
    - save at version, 409 when stale, and only the creator, with a 404 for an unknown SPK;
    - Submit refused without a step;
    - T2 with the approval row, the notices by role and the switch case;
    - request checks.
  - Vehicle and open-SPK tests: 10 of 10 with `create_spk`.
  - Web: CreateSPK 8 and vehicles 14.
  - E2E: 16 of 16.
- **QA** at 1440 x 900 against CreateSPK, on the local database:
  - It had to be switched to Live for the check, because Setup mode removes spk.*, and was set back afterwards.
  - The header card matches the artboard (title and vehicle, category and urgency, workshop flag, description), as does the button bar.
  - Save draft gave SPK-2611120001 with the Draft and High pills and "Saved.".
  - Fixed: the divider under the checkbox.
  - Kept: the vehicle is a select (the artboard shows a filled input).
