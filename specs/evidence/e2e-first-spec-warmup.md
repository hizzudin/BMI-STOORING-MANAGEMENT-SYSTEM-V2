# Evidence: the first E2E spec timed out after a build (chore, no TASK)

## Symptom

`pnpm e2e` failed its first spec (`access-history-flw-am-05`) now and then with a 30 s test timeout,
each time at a different step (the sign-in redirect, the Password field, a dialog); every later spec
passed, and a rerun passed.

## Cause (measured, Windows 10, 4 cores)

- Playwright 1.64 starts the `webServer` processes before `globalSetup`, so when the first spec
  starts the stack is up but cold. Only the first spec pays the first browser launch, the first
  page, the first render of `/login` and its chunks, and the first sign-in, all inside its own 30 s.
- Trace of the first spec against the second in the same run: `/login` 1.5 s server time against
  0.3 s warm, sign-in 2.5 s against 1.1 s, browser launch 0.8 to 3.0 s, first page 0.6 to 7.9 s.
- Right after a build those first reads queue behind the antivirus and the disk: Windows Defender
  (`MsMpEng`) used up to 161 % CPU and the disk queue was saturated (`% Disk Time` up to 8189) while
  global setup and the first spec ran. Other agent sessions' hook processes added CPU load.
- The slowest runs followed the longest builds: a 56 s compile gave 31.4 s (failed), 44 s gave
  30.3 s (passed by a hair), 110 s gave 26.6 s; runs after a build replayed from cache gave 4 to 12 s.
- Ruled out: the API (sign-in POST 1.2 s in a 21 s spec), the database rebuild (no pool connection
  is open when it is dropped), the Redis queue (used only with an end time).

## Fix

`e2e/global-setup.ts` warms the stack after the database rebuild, where no test timeout applies:
one Chromium launch and visit to `/login`, and one sign-in for an address no account has (it reads
the database and hashes, and writes nothing; the answer must be 401). It logs its duration. No
retries, timeouts or assertions changed.

## Verification

Three runs in a row of `turbo run e2e --force` (the `pnpm e2e` pipeline with a forced build), each
after clearing `apps/web/.next/cache`, so every run built cold right before the tests:

| Run | Compile | Warm-up | First spec | Result    |
| --- | ------- | ------- | ---------- | --------- |
| 1   | 24.2 s  | 3168 ms | 3.3 s      | 27 passed |
| 2   | 14.9 s  | 2780 ms | 3.7 s      | 27 passed |
| 3   | 14.6 s  | 2583 ms | 3.7 s      | 27 passed |

Earlier runs without the warm-up (or with only a fetch warm-up) gave a first spec of 4.0 to 31.4 s
under the same conditions. These three compiles were shorter than the 110 s worst case seen once,
so a very slow build can still cost more, but that cost now falls in global setup.
