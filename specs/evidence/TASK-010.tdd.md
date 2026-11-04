# TASK-010 OpenAPI pipeline

Rule: DEC-66; also NFR-04 for the validation pipe. PRD §8.2 "Build the API contract first".

## RED (commit f3c9bea)

- `@bmi/api-client`: `TypeError: createApiClient is not a function`.
- `@bmi/shared`: `Cannot find module './health.js'`.
- `@bmi/api`: `Cannot find module '../../../src/http/openapi/document.js'`.

## GREEN

| What is guaranteed | Test | Result |
| --- | --- | --- |
| Every served route is in the OpenAPI document and nothing else is | `http/openapi.test.ts` | pass |
| The document takes its schema from the shared Zod schema; the real `/health` satisfies it | same file | 2 pass |
| A valid body arrives parsed; an invalid one answers 400 naming the field (NFR-04) | same file | 2 pass |
| The client calls a contract path against the base URL; an error status is not data | `packages/api-client/src/client.test.ts` | 2 pass |
| The web app reaches the API through the client | `apps/web/lib/api.test.ts` | 1 pass |

## _Verify_

- `pnpm gen:client` exit 0, and `pnpm typecheck` exit 0 compiles `apps/web/lib/api.ts` and `apps/mobile/src/api.ts` against the generated client.
- A stale client fails: with the route summary changed in `document.ts`, `pnpm check:client` exited 1 and showed the diff. With nothing changed it exited 0. The change was restored. `ci.yml` runs this exact command, but has not run on GitHub (TASK-008).

Full local chain before the last type fix: coverage, secrets, format, lint, layers, `test:coverage` and E2E all exit 0; `typecheck` exit 0 after the fix.

## Notes

- `z.toJSONSchema` of Zod 4 builds the schemas. `@asteasolutions/zod-to-openapi` was tried and dropped: it patches schema methods, and Zod 4 copies methods when a schema is created, so schemas of `@bmi/shared` could not use it.
- The route list in `document.ts` is written by hand; the test above fails when it and the controllers differ.
- TanStack Query (D-04) arrives with the first screen that fetches.
