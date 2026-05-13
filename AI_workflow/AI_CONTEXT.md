# AI Context — odd-note-app

> Purpose: concise, current project state and prioritized plan for the AI assistant.

## Canonical references (read-only)

- `AI_workflow/Project_requirement.txt` — assignment scope and required features (source of truth)
- `AI_workflow/AI_CONTEXT.md` — current implementation status (this file)
- `AI_workflow/AI_RECALL_PROMPT.md` — agent operating rules

## Snapshot (short)

- Monorepo: `pnpm` workspaces
- Backend: `NestJS` + `Prisma` + PostgreSQL (Docker)
- Frontend: `React 18` + `Vite` + React Query + Zustand
- Validation: shared `zod` package under `packages/validation`

## What has been implemented recently

- Full auth domain: register/login/refresh/logout, email verification tokens, transactional register flow, JWT + refresh token lifecycle.
- Recipient-based sharing MVP (owner can share; recipients have shared-with-me view).
- Frontend: notes UI, autosave, single create/edit editor (TipTap), label management, basic attachments, note protection (password), and settings.
- Offline/PWA foundation: service worker, `manifest.json`, IndexedDB caching for notes, mutation queue + replay. (Kept deliberately minimal per requirements.)

## Current Goal & Constraints

- Finish only features explicitly required by `Project_requirement.txt`. Do NOT add unrelated capabilities (e.g. push notifications, realtime editing via WebSockets) unless requested.
- Prioritize correctness, required UX (autosave, single create/edit, verify account banner, live search, labels, sharing basic flows), and reproducible deployment via `docker-compose`.

## Prioritized Plan (short)

1. Verify Account Flows — registration, activation email + banner, auto-login after registration, login redirect, password reset (link/OTP). Fix any regression.
2. Single Create/Edit + Autosave — confirm a single UI for both create/edit, autosave reliability, and delete confirmation UX.
3. Labels & Live Search — label CRUD/rename/delete semantics and 300ms live search across title+content.
4. Sharing (minimal) — ensure sharing validates recipient email, owner can view recipients and revoke, and permissions (READ/EDIT) enforced. No realtime required.
5. Responsive fixes — address blocking layout issues on mobile/tablet/desktop.
6. E2E tests — run Playwright; fix failing tests only when they cover required features above.
7. Deployment packaging & README — ensure `docker-compose` reproducibility and concise run instructions.

## Current status (delta since last update)

- Offline/PWA: implemented (service worker, IndexedDB cache, mutation queue). Kept minimal.
- Work-in-progress: account-flows verification, single create/edit autosave verification, labels/search, and sharing validation.

## Immediate next action

- Run verification for Account Flows and create minimal fixes if gaps are found. This is the top priority because auth correctness is gating other features and grading criteria.

## Update rule

- Update this file only when the repo state or priorities change materially. Keep entries short and factual.
