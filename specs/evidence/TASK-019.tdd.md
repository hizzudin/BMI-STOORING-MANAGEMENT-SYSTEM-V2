# TASK-019 Design artifact: one page per screen

Spec and visual task (DEC-107, PRD v2.18). No code and no requirement change.

## What changed

- 61 module files holding 155 screens became 180 pages: 179 screens plus `index.html`.
- 25 new pages: the dialogs, panels and states that `ui-action-map.md` names without an artboard, the Chassis and parts tab, and `SupervisorMobileHistory`, which was an empty anchor.
- Thin artboards that only held a note (`VehicleEdit`, `PartEdit`, `FCCreateSPK`, `CreateSPKFromAlert`, `ScheduleDispatcher`, `StepLocked`, `SPKDocumentCheck`, ...) are full pages now.
- In-page tabs work: SPK list, SPK detail, Vehicles, Documents, Invoices, Requests, Notifications. Tab names follow REQ-SPK-010 and 7.4.
- Each dashboard has its own actions per 7.9. Buttons and rows link to their target; the Dashboard rail item opens the role's dashboard.
- A retired-name leftover on the printed SPK was fixed, and `check-coverage.mjs` now also catches its upper-case form.

## Checks

| Check | Result |
| --- | --- |
| All 180 pages in Chromium: script errors, nearly empty page, horizontal overflow at 1400 px, missing title | 0 problems |
| Every in-page tab shows content | 0 problems |
| Relative links and images | 0 broken |
| One section per page, balanced tags | 0 problems |
| Controls of `ui-action-map.md` found on their page | 332 checked; the gaps left are listed below |
| `check-coverage.mjs --tests` | Coverage OK |

## Known gaps

- Text search for controls, so a match proves the label exists, not its look.
- Left on purpose: vehicle tabs repeat Add vehicle in 7.9 but the artboard keeps it on the list; `Resume` lives on `StepPaused`; sample names differ from 7.9's example (`SPK-2611040181`); a few labels differ in wording (`SPKDocumentCheck`, `FCRequests` row Open).
- `Save draft`, `Save`, `Remove` and similar stay on the page: they change no screen.
- Master-detail rows do not change the right panel: sample data is static.
- Reports (P1), `SettingsIntegrations` (P1) and new dialogs were designed from the spec text in the kit's style and have not been reviewed by the product owner.
- About 15 of the 180 pages were looked at by eye as screenshots; the rest passed the automatic checks only.
