# TASK-021 Every running code follows CODE-yymmddNNNN

Spec and visual task (DEC-110, PRD v2.21). No code used these formats yet.

## What changed

- NFR-15: CR, GR, GRC, GI, SA, OB, TR, RD, TC and TY join SPK and RB in CODE-yymmddNNNN, with one running number per code.
- Customer invoices keep NNNN/BMI/dd-mm-yy (DEC-46), by owner decision.
- Data model comments, `tyre_code` length and sample numbers in the spec and artboards are updated.

## Verify

- `node specs/tools/check-coverage.mjs --tests`: Coverage OK.
