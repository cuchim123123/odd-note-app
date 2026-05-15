# odd-note-app

Secure, offline-first note management application with rich text editing, label organization, sharing, and password protection.

## ✅ Completed Features

### Account Management (2.1)

- User registration with bcrypt password hashing
- Automatic login after registration
- Email verification with activation links
- Unverified account banner (prominent notification)
- Password reset via email (OTP/link support)
- Login redirect to previously attempted route
- Session management with JWT + refresh tokens

### Simple Note Management (2.2)

- Grid and list view layouts (switchable)
- Single create/edit UI (no separate screens)
- Autosave with 650ms debounce
- Delete confirmation dialog
- Image attachments (upload + display)
- Pin/unpin notes (pinned always appear first)
- Sort by creation or last modified time
- **Live search** with 300ms debounce across title + content
- **Label management** (create, rename, delete, filter)
- Label rename propagates to all associated notes

### Advanced Note Management (2.3)

- **Password protection** (per-note encryption; users set unique passwords)
- **Share notes** by registered email with permission levels (READ/EDIT)
- **Shared-with-me view** (shows who shared, timestamp, permission level)
- Special icons for shared/pinned/protected notes (grid + list views)
- Recipient email validation (must be registered user)
- Owner can revoke access anytime

### Additional Requirements (2.4)

- **Responsive Design** (mobile/tablet/desktop)
- **Offline-first PWA**: Service Worker + IndexedDB caching + mutation queue
- Works offline; syncs data when reconnected
- Settings page (font size, dark/light theme)
- **Deployment ready**: docker-compose configuration

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for development)
- pnpm (recommended) or npm

### Local Development

```bash
# Install dependencies
pnpm install

# Start Docker services (PostgreSQL, MinIO, API)
docker compose up -d --build api

# Start the dev server in another terminal
cd apps/web
pnpm dev
```

The app will be available at `http://localhost:5173/`.

### Docker Hot Reload

If you want to edit code locally without rebuilding images every time, use the dev overlay:

```bash
pnpm docker:dev
```

That starts the API and web containers in watch mode with the repo mounted into the containers.
The web app runs at `http://localhost:5174/` in this temporary dev setup.

### Environment Variables

Create `.env.local` in the `apps/api` directory (docker-compose handles most of this):

```env
# Auth
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Email (for activation + password reset)
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/odd_note_app

# File Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=uploads

# App
API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173

# Test Endpoints (for E2E tests)
ALLOW_TEST_ENDPOINTS=1
```

## 🧪 Testing

### Unit Tests

```bash
pnpm test
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
pnpm exec playwright install

# Run tests
pnpm test:e2e

# UI mode for debugging
pnpm test:e2e:ui
```

## 📦 Deployment

### Using Docker Compose

```bash
# Build and start all services
docker compose up -d --build

# The app is accessible at http://localhost:5173
```

### Database Setup

```bash
# Migrations are applied automatically on API startup
docker compose exec api pnpm prisma migrate deploy
```

### Offline/PWA Features

- Service Worker automatically caches notes and API responses
- Notes persist in IndexedDB for offline viewing
- Mutations are queued and replayed when connection is restored
- Works on mobile browsers (iOS Safari, Chrome, etc.)
- Install as app: "Add to Home Screen" from mobile browser

## Requirements Priority

Implementation order follows `Project_requirement.txt`:

1. Account management (`2.1`)
2. Simple note management (`2.2`)
3. Advanced note management (`2.3`)
4. Additional requirements (`2.4`)

## Local Setup (current scaffold)

## 🛠️ Development Commands

```bash
# Format code
pnpm format

# Lint
pnpm lint

# Type check
pnpm typecheck

# Build for production
pnpm build

# Generate Prisma client (after schema changes)
pnpm exec prisma generate
```

## Monorepo Layout

- `apps/api` - NestJS backend with Prisma ORM
- `apps/web` - React 18 + Vite frontend
- `packages/validation` - Zod schemas (shared validation)
- `packages/eslint-config` - Shared ESLint rules
- `packages/tsconfig` - Shared TypeScript configs
- `e2e/` - Playwright E2E tests
- `infrastructure/` - Docker & Nginx configs

## 📝 Key Implementation Notes

### Auth Flow

- Passwords are bcrypt-hashed; never stored in plaintext
- JWT + refresh token pattern for session management
- Email verification links are one-time use
- Password reset requires valid token validation

### Offline Sync

- Service Worker intercepts network requests
- IndexedDB stores notes locally; mutations queue if offline
- On reconnect, queued changes replay in order
- Conflict resolution: server version wins on sync

### Performance

- Autosave uses 650ms debounce to reduce API calls
- Live search uses 300ms debounce
- Notes are paginated; lazy-loaded on scroll
- Images are stored on MinIO; URLs are served via nginx

### Security

- CORS enabled for `http://localhost:5173` (dev)
- Password-protected notes: per-note encryption key derived from password
- Share permissions validated server-side
- JWTs expire after 15min (refresh tokens last 7 days)

## 📄 License

MIT
