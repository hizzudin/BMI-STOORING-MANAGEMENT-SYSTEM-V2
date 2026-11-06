# TASK-101 Shared enums, decimal money, WIB time, number format, numbering

Rules: NFR-09, NFR-14, NFR-15, NFR-16, DEC-30, DEC-46, DEC-110. No acceptance criterion or flow names this task.

## What changed

| Module | Guarantee |
| --- | --- |
| `packages/shared/src/enums` | Every enum of section 9.1, once. A test compares them with `docs/prd/data-model.md`, so spec and code cannot drift |
| `packages/shared/src/money` | Exact decimals through big.js; 2 decimals for amounts, 4 for average costs; half up; unit price rounded before the line is multiplied; PPN on the subtotal in whole rupiah |
| `packages/shared/src/format` | 48.210 km, Rp 1.240.000, 2,4 mm |
| `packages/shared/src/time/wib.ts` | YYYY-MM-DD and HH:MM:SS in WIB, checked against Intl for Asia/Jakarta; daily job time 00:30 |
| `packages/shared/src/numbering` | One configuration: CODE-yymmddNNNN for every code, invoices NNNN/BMI/dd-mm-yy; WIB date; four digits, widening |

## Evidence

- RED: `pnpm --filter @bmi/shared test`: 5 of 7 test files failed because the modules did not exist, 7 of 12 collected tests failed.
- GREEN, the _Verify_ line: `pnpm --filter @bmi/shared test -t "NFR-09|NFR-14|NFR-15|NFR-16"`: 66 passed, 5 skipped by the filter.
- Whole package: 71 passed. Coverage: lines 78/78, branches 24/24, functions 20/20; the 90 percent gate passes.
- Repository: typecheck, lint, format, layer rules and secret scan pass.
- `pnpm test`: `@bmi/web#test` failed once and passed when rerun with no code change; the failing output was not kept, so its cause is not known.
- Not run locally: the API integration tests and E2E. This task does not change them; CI runs them.

## Known gaps

- NFR-09 asks for a translatable interface. TASK-126 also carries NFR-09 and builds the interface, so translation is not in this task.
- NFR-15 asks that formats change without code changes. They are the setting `app_settings.numbering_formats`, checked with `NumberingConfigSchema`; TASK-120 seeds and reads it. No screen edits it (OQ-6). An earlier version of this note said the PRD had no stored setting, which was wrong.
- A negative amount shows as -Rp 1.000. The PRD names no form for it.

## Review fixes (DEC-111, PRD v2.22)

- RED: `pnpm --filter @bmi/shared test`: 15 of 85 tests failed, including the enum drift test after `Part_Item_Alert` entered the data model.
- GREEN: 85 passed; the _Verify_ line: 80 passed, 5 skipped by the filter. Coverage: lines 88/88, branches 35/35, functions 24/24.
- Repository: typecheck, lint, format, layer rules, secret scan and PRD coverage pass.
- `pnpm test`: `@bmi/web#test` failed once more and passed on the next run with no code change. The passing run took 60,35 s, 83 percent of it starting jsdom, close to the 60 s worker start limit named by the earlier error. This points at a slow start on this machine; the failing output was not kept, so it is not proven. Not changed here.
