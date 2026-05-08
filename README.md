# odd-note-app

Production-grade collaborative note management system (incremental build).

## Current Status

- Monorepo workspace baseline is initialized.
- Root tooling: ESLint, Prettier, Husky, lint-staged, commitlint.
- Empty app manifests for `apps/api` and `apps/web` are created.

## Requirements Priority

Implementation order follows `Project_requirement.txt`:

1. Account management (`2.1`)
2. Simple note management (`2.2`)
3. Advanced note management (`2.3`)
4. Additional requirements (`2.4`)

## Local Setup (current scaffold)

```bash
pnpm install
pnpm hooks:install
pnpm format:check
```

## Monorepo Layout

- `apps/web` - React frontend (to be scaffolded next)
- `apps/api` - NestJS backend (to be scaffolded next)
- `packages/shared` - shared schemas/types/constants
- `packages/eslint-config` - reusable eslint config
- `packages/tsconfig` - reusable tsconfig presets
- `infrastructure/docker` - docker-compose and service configs
- `infrastructure/nginx` - reverse proxy configs
