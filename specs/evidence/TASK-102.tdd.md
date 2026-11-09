# TASK-102 State machine tables and transition()

Rules: SM-SPK, SM-STEP, SM-VEH, SM-DOC, SM-TYRE, SM-GR, SM-SA, SM-TC, SM-TR, SM-RD, SM-CR, SM-SCH, SM-INV, SM-BRK, DEC-15, DEC-16. No acceptance criterion names this task.

## What changed

`packages/shared/src/machines`: one table per machine of PRD §3 and `transition(machine, state, event)`, which returns the next state or throws `TransitionRefused`. SM-VEH is `deriveVehicleStatus` by precedence; SM-DOC adds `docStatusByDates`; SM-STEP adds `stepState`, so a stored In_Progress step with the paused flag is Paused.

Who may fire an event and its guards (creator, approver, reasons, filled sections) are server policies of later tasks; these tables only decide which pairs exist and where they lead.

## How the spec was read

- The test types each table again from PRD §3, so a machine is checked against the spec and not against itself: exact states, exact finals, every listed pair accepted, every other (state, event) refused, and no pair the spec does not list.
- T15 "any open status" is every status except Completed and Cancelled, so Draft and Rejected too.
- T9 and T10 go back to the saved status, which can only be Active or In_Progress (T8 starts only there).
- SM-RD: the receipt that settles the last tyre closes the dispatch, from Sent or Partial.
- SM-SCH has only Place, the daily Missed and the roll-forward of §3.7; moving a card by hand is not in §3 and is left to the schedule task.
- Skip (SM-STEP) is P1: refused unless Release 2 is switched on.
- Event names are the code names of the PRD wording (Approve, CreatorCancel, ApproverCancel and so on).

## Evidence

- RED: the new test file failed because `./index.js` did not exist.
- GREEN: 247 tests pass; the _Verify_ line `-t "SM-"`: 162 passed, 85 skipped by the filter.
- Coverage of `@bmi/shared`: lines 132/132, branches 71/71, functions 36/36; the 90 percent gate passes.
- Repository: typecheck, lint, format and layer rules pass.
