# Scratch File and Root Directory Convention

## Overview

The repository root must only contain files that are part of the project's
published interface: configuration files (`package.json`, `tsconfig.json`,
`next.config.ts`, etc.), canonical documentation (`README.md`, `CHANGELOG.md`,
`CONTRIBUTING.md`, `LICENSE`), and tooling entry points.

**Scratch files, task notes, deliverable reports, and audit summaries must
never be committed to the repository root or tracked in git.**

---

## Allowed files in the repository root

| File / Pattern                                  | Purpose                   |
| ----------------------------------------------- | ------------------------- |
| `package.json`, `package-lock.json`             | Node.js manifest          |
| `tsconfig*.json`, `next.config.ts`              | Build configuration       |
| `eslint.config.js`, `.prettierrc.json`          | Linting / formatting      |
| `vitest.config.ts`, `playwright.config.ts`      | Test runners              |
| `Dockerfile`, `docker-compose*.yml`             | Container definitions     |
| `vercel.json`, `.env.example`                   | Deployment / env template |
| `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`  | Canonical docs            |
| `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`  | Legal / policy            |
| `.gitignore`, `.editorconfig`, `.gitleaks.toml` | Repo hygiene              |

---

## Gitignored scratch / temp patterns

The following patterns are blocked by `.gitignore` and must never appear in the root:

| Pattern                                      | What it blocks                           |
| -------------------------------------------- | ---------------------------------------- |
| `task*.md`                                   | Per-issue task notes (e.g. `task1.md`)   |
| `scratch/`, `*.scratch.md`, `*.tmp.md`       | Personal scratch directories / files     |
| `IMPLEMENTATION_*.md`, `*_IMPLEMENTATION.md` | Inline implementation summaries          |
| `PR_DESCRIPTION*.md`                         | PR draft notes (use the PR body instead) |
| `DELIVERABLES*.txt`                          | Completion checklists                    |
| `ACCEPTANCE_VERIFICATION*.md`                | Acceptance reports                       |
| `ERROR_HANDLER_AUDIT*.md`                    | Audit summaries                          |
| `*_COMPLETION_REPORT.md`                     | Completion reports                       |
| `*_AUDIT.md`                                 | Audit output files                       |

If you need to keep any of these, move their useful content into `CHANGELOG.md`
or a file under `docs/` **before** closing the PR.

---

## Where scratch content belongs

| Content type                       | Correct location                        |
| ---------------------------------- | --------------------------------------- |
| Implementation notes worth keeping | `CHANGELOG.md` → `[Unreleased]` section |
| Architecture decisions             | `docs/adr/ADR-NNN-title.md`             |
| API or error response docs         | `docs/api/`                             |
| Operational runbooks               | `docs/runbooks/`                        |
| Personal task notes                | `scratch/` (gitignored — local only)    |

---

## History

- **Issue #1541** — Removed `task1.md`, `task2.md`, `DELIVERABLES.txt`,
  `ACCEPTANCE_VERIFICATION.md`, and `ERROR_HANDLER_AUDIT.md` from the root.
  Added gitignore guards to prevent recurrence.
