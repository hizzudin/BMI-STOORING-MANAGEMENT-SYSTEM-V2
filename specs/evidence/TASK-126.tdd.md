# TASK-126 Web shell and design kit

Rules: NFR-08, NFR-09, NFR-10, C-01 to C-34 (shared controls of this task), NAV-1 to NAV-8, DEC-81, DEC-82, DEC-84, DEC-94, DEC-96.

## What changed

- `apps/web/components/kit/`: `Button` (primary, secondary, danger outlined, ghost), `BusyButton` (C-34), `StatusPill` (always a word, NFR-10), `Tabs` (C-06, same page), `ConfirmDialog` (C-12, C-14, C-16, C-32), `useLeaveGuard` (C-12, C-13), `DataTable` (NFR-08: every column sortable and filterable, C-07 row selection, C-33 search), `Icon` (one outline set, own paths).
- `apps/web/components/shell/AppShell.tsx`: the floating rail capsule (logo circle opening the dashboard, one circular item per menu entry with tooltip and waiting count, the expand toggle, the user's circle at the foot), the main sheet, the user menu panel (C-04). `PageHead` puts the title, actions and the bell in one header row inside the sheet (ui.md 7.2, DEC-94).
- `apps/web/components/settings/SettingsHome.tsx` and `app/settings/page.tsx`: the three groups of Settings cards (NAV-6); Users and roles is not there.
- `apps/web/app/globals.css`: tokens and kit rules re-written for the product from the artboards' values; nothing imported from Design Artifact. `public/bmi-logo.png` is the client's logo (DEC-81).
- `app/kit/page.tsx` + `components/dev/KitPreview.tsx`: a development-only gallery (404 in production) used for the `qa` comparison. Its rail lists every ui.md menu item; the real menu comes from capabilities in TASK-106 (NAV-9).
- `DESIGN.md`: page colour #EEF3F5 and headline 24px / 1.2, corrected to the artboards (DEC-96: the artboard wins).

## How the spec was read

- The artboard places the user's circle at the foot of the rail and the page header inside the sheet; ui.md 7.2 puts the bell with the page actions. The first draft had a separate header bar; it was rebuilt before closing.
- Notification settings is shown disabled with "Release 2" (REQ-NTF-003 is P1).
- Text is English only until the translation (Q-05).

## Evidence

- RED: the shell tests failed while the user circle sat in a header bar and `PageHead` did not exist.
- GREEN: 22 web tests pass (kit, shell, settings, page); typecheck and lint pass; Prettier clean.
- _Verify_ `qa` at 1280 x 800, app `/kit` against the artboards, measured in the browser:
  - AppShellCollapsed: rail 72 x 764 at 18,18, radius 36, Float lift; logo 44 px in a 52 px circle; items 48 px, petrol, active red; count badge 20 x 18 at the same corner; toggle and user circle 40 px at 682 and 730. Identical. Expanded: rail 240, labels and counts shown, sheet moves aside.
  - Settings: sheet 1154 wide at 108, radius 30, padding 22/26/26; h1 24 px; cards 265 x 68, padding 16/18, no border; icon circles 36 px. Identical except a 6 px lower title because the bell (40 px) shares the header row.
  - UserMenu: right panel 460 wide, radius 26, padding 18, scrim rgba(20,38,46,.55); Change password, Notification settings, Sign out, Close.
  - LeaveConfirm, DiscardConfirm, DeactivateMaster: dialog 440 x 153 (artboard 155), radius 26, padding 22/24, title 17 px, cancel focused, danger action outlined at the right; texts as on the artboards.
- `node specs/tools/check-coverage.mjs --tests`: Coverage OK.
