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

### Completed Tasks

1. ✅ Account Flows — registration + auto-login, email verification page + banner, login redirect, password reset endpoints all verified
2. ✅ Single Create/Edit + Autosave — unified editor UI with 650ms autosave debounce, native delete confirmation
3. ✅ Labels & Live Search — CRUD with rename/delete propagation, 300ms live search over title+content
4. ✅ Sharing (minimal) — recipient email validation, READ/EDIT permissions, owner revoke capability
5. ✅ Responsive Design — mobile/tablet/desktop layouts using Tailwind breakpoints
6. ✅ E2E Tests — framework in place; browser install completed

### Remaining Tasks

7. Deployment packaging & reproducible docker-compose instructions
8. Documentation & README with environment setup

## Current status (delta since last update)

- **Offline/PWA**: Fully implemented (service worker, IndexedDB cache with persistence, mutation queue + replay on reconnect)
- **Auth Domain**: Complete (register/login/logout/refresh, email verification, password reset, JWT lifecycle)
- **Notes CRUD**: Complete (single create/edit editor, autosave, labels, attachments, protection, sharing)
- **Core UX**: All required flows verified; ready for production testing
- **Latest commit**: Added email verification page and login redirect to saved location (commit f0c3a01)

## Next Steps

1. Create minimal README with: how to run locally, environment variables, PWA notes, and deployment instructions
2. Verify docker-compose reproducibility
3. Final lint/typecheck pass before submission

## Update rule

- Update this file only when the repo state or priorities change materially. Keep entries short and factual.
