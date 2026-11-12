# TASK-125 TDD Evidence Summary

**Task:** SPK List tabs and SPK Detail with step cards and stamps
**PRD:** REQ-SPK-010, REQ-SPK-011
**Date:** 2026-11-13

## Verification Results

### Build
pnpm turbo run build --filter=@bmi/web
Compiled successfully in 2.5s
Finished TypeScript in 8.1s
Generating static pages (17/17) in 2.3s

### Coverage Check
node specs/tools/check-coverage.mjs --tests
82 test files scanned, 40 finished tasks
Required: 261 REQ, 146 AC, 94 tables
Coverage OK

### API Contract
pnpm gen:client - GET /spks with query params, GET /spks/{id}/detail

## Key Fixes Applied
- StatusPill: variant -> tone
- Button: removed asChild/size
- Icons: match PATHS keys
- PageHead: status + actions props
- DataTable: correct column structure
- API: SpkListQuerySchema + query
- Outcome: result.message

## Files Modified
- apps/web/components/spk/SpkList.tsx
- apps/web/components/spk/SpkDetail.tsx
- apps/api/src/http/spks/spks.controller.ts
- apps/api/src/http/openapi/document.ts
- apps/api/src/http/contract.ts
- apps/web/lib/spks-api.ts
- apps/web/app/(app)/spk/[id]/page.tsx

## Status: COMPLETE
Build passes, Coverage OK, API contract updated, Design Artifact aligned
