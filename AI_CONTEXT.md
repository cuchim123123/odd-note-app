# AI Context — odd-note-app

> Update this file whenever the repository structure, architecture, or implementation state changes in a meaningful way.
> Goal: preserve working context for future AI sessions and reduce re-analysis time.

## Project Summary

`odd-note-app` is a pnpm monorepo for a production-grade collaborative note management system.
The implementation follows an incremental workflow and currently prioritizes **Phase A: Account Management**.

The app is intentionally being built with clean architecture, strong typing, shared validation, and small committed steps.

## Repository Layout

```text
odd-note-app/
├─ apps/
 Auth config is centralized in `apps/api/src/config/auth-config.module.ts`
├─ infrastructure/
│  ├─ docker/     # reserved, currently empty
 `apps/api/src/config/auth-config.module.ts` exposes auth-specific runtime config such as password salt rounds
├─ commitlint.config.cjs
├─ eslint.config.mjs
 `apps/api/src/auth/auth.module.ts` imports `AuthConfigModule` for auth runtime config access

- Package manager: `pnpm`
 Auth config module extraction
- Database: `Prisma` + PostgreSQL
- Auth: bcrypt for password hashing, JWT for access/refresh tokens
- Runtime style: incremental, small, reviewable changes only

## Current Stack Snapshot

### Root

- `package.json` defines repo-wide scripts: `lint`, `format`, `typecheck`, `test`, `hooks:install`
- lint-staged formats JSON/Markdown/YAML and auto-fixes JS/TS with ESLint
- repo uses `typescript`, `eslint`, `prettier`, `husky`, `lint-staged`, `commitlint`

### `apps/api`

- NestJS 10 backend
- Prisma client generated from `apps/api/prisma/schema.prisma`
- Global validation pipe uses `nestjs-zod` in `apps/api/src/main.ts`
- Config validation is centralized in `apps/api/src/config/env.validation.ts`
- JWT config module wires JWT DI only; token signing logic lives in `apps/api/src/config/jwt-config.service.ts`
- Auth module currently supports register/login with token issuance
- Refresh tokens are persisted in PostgreSQL and stored as `sha256` hashes

### `apps/web`

- React 18 + Vite scaffold exists
- Current UI is only a placeholder scaffold in `apps/web/src/App.tsx`
- No production features implemented yet

### `packages/validation`

- Shared framework-agnostic Zod schemas
- `registerSchema` and `loginSchema` are currently the key auth contracts
- Shared package exports from `packages/validation/src/index.ts`

## Backend Current Structure

### Config

- JWT config service extraction
  - `User`
  - `VerificationToken`
  - `PasswordResetToken`
  - `RefreshToken`
  - enums `UserRole`, `TokenType`

### Auth

- `apps/api/src/auth/auth.module.ts` wires controller + service
- `apps/api/src/auth/auth.module.ts` imports both `AuthConfigModule` and `JwtConfigModule` for auth runtime dependencies
- `apps/api/src/auth/auth.controller.ts` exposes `POST /auth/register` and `POST /auth/login`
- `apps/api/src/auth/auth.service.ts` handles register/login, password hashing, token generation, and refresh-token persistence
- `apps/api/src/auth/auth.types.ts` holds auth result/profile/token types
- `apps/api/src/auth/dto/` contains Nest boundary DTOs for Zod schemas

### Shared Validation Pattern

- Pure Zod contract stays in `packages/validation`
- NestJS DTO wrappers exist only at API boundary
- The global `nestjs-zod` pipe validates request bodies cleanly
- This avoids mixing framework concerns into shared schema packages

## Current Auth Implementation Notes

- Registration:
  - normalizes email
  - checks for existing user
  - hashes password with bcrypt
  - creates user
  - issues access/refresh tokens
  - stores refresh token hash in DB
- Login:
  - normalizes email
  - validates credentials
  - issues access/refresh tokens
  - stores refresh token hash in DB
- Refresh token storage uses `crypto.createHash('sha256')`, not bcrypt
  - reason: refresh tokens should be hashed with a fast one-way digest, not a password hash algorithm

## Important Files To Watch

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.types.ts`
- `apps/api/src/auth/dto/index.ts`
- `apps/api/src/config/jwt-config.module.ts`
- `apps/api/src/config/jwt-config.service.ts`
- `apps/api/src/config/env.validation.ts`
- `apps/api/prisma/schema.prisma`
- `packages/validation/src/auth/register.schema.ts`
- `packages/validation/src/index.ts`
- `apps/web/src/App.tsx`

## Current Status

### Done

- Monorepo baseline and tooling
- NestJS backend scaffold
- Prisma schema foundation
- Shared validation package
- Register/login endpoints
- JWT infrastructure
- Token issuance on auth
- Refresh token persistence
- Shared auth types extracted from service

### Not Yet Built

- Email verification flow
- Password reset flow
- Notes CRUD
- Note sharing and permissions
- Realtime collaboration with Yjs/Socket.IO
- Offline sync / IndexedDB
- Redis adapter / queues / presence
- Frontend product UI
- Docker / Nginx deployment setup

## Update Rules For Future Sessions

When making meaningful changes, update this file with:

- new folder/file paths
- new module responsibilities
- current implementation status
- architectural decisions that matter later
- files that future AI should inspect first

Keep this file current. It is the session memory anchor.
```
