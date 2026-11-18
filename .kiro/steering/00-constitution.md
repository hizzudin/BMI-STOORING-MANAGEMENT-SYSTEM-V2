---
inclusion: always
---

# Project constitution (shared by Kiro and Claude Code)

Two agents build this repository: Claude Code and Kiro. Both follow one constitution, `CLAUDE.md`,
included below. It binds Kiro exactly as it binds Claude. When this steering and `CLAUDE.md`
disagree, `CLAUDE.md` wins; when `CLAUDE.md` and `PRD.md` disagree, `PRD.md` wins.

#[[file:CLAUDE.md]]

## How the constitution maps onto Kiro

- **Skills.** Kiro has no Skill tool. Every project skill is copied to `.kiro/skills/<name>/` (the
  skills steering lists them all). For each name on a task's _Skill_ line, read
  `.kiro/skills/<name>/SKILL.md`; a prefix such as `ecc:` or `superpowers:` is dropped. The folder
  always exists: `pnpm check:kiro-skills` fails in CI when a named skill is missing.
- **Asking the product owner.** The owner writes Indonesian; answer and ask in Indonesian. Ask only
  what the PRD, its decisions and the artboards leave open. One decision per question, two or
  three options, your recommendation first with "(Recommended)". Wait for the answer; never guess.
  Every answer becomes the next `DEC-nnn` (see the task-cycle steering).
- **Start of every session.** Read `specs/CONTEXT.md` first, then the collaboration steering
  (claims), then `specs/requirements.md`, `specs/design.md` and `specs/tasks.md`.
- **Hooks.** Claude's local hooks (GateGuard, design hook) do not run in Kiro. The gates of the
  tech steering still apply to every task.
- **Language of the code and specs.** English, as in the rest of the repository.
