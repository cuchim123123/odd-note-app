# @odd-note-app/web

React frontend for note management, collaboration, and offline-first experience.

## Current Status

The frontend is largely implemented for core flows (auth, note CRUD, sharing, offline basics). A small set of UI polish tasks remain, notably:

- Formatting toolbar in the rich editor (planned toolbar UI present as a TODO)
- Some offline sync edge cases and retry/conflict behaviors
- Minor browser-specific E2E flakiness (Firefox timing/input differences)

If you are contributing, start by running the app locally and reproducing the E2E tests (Chromium/WebKit are stable in CI runs).

## Quick Start (dev)

```powershell
Set-Location 'd:\odd-todo-app\odd-note-app'
pnpm install

# Start backend API (Docker)
docker compose up -d --build api

# Start frontend (separate terminal)
Set-Location 'd:\odd-todo-app\odd-note-app\apps\web'
pnpm dev
```

## Notes for contributors

- The project contains Playwright E2E tests in `e2e/` (see `package.json` scripts).
- To enable test-only helper endpoints, set `ALLOW_TEST_ENDPOINTS=1` in API environment when running tests.
- See `SUBMISSION_SUMMARY.md` for a consolidated status and testing notes.
