# Authentication Flow for POST /notes

## Complete Auth Chain

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HTTP Request                                 │
│  POST /notes                                                         │
│  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   │
│  Content-Type: application/json                                      │
│  { "title": "My Note", "content": "..." }                          │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1️⃣  NestJS Route Handler Decorator                                 │
│                                                                      │
│  @Controller('notes')                                               │
│  @UseGuards(AccessTokenGuard) ◄── Auth Guard Applied!              │
│  export class CreateNoteHttpController {                            │
│    @Post()                                                          │
│    async create(...)                                                │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2️⃣  AccessTokenGuard (Shared Middleware)                           │
│  📄 File: apps/api/src/shared/presentation/http/guards/            │
│           access-token.guard.ts                                     │
│                                                                      │
│  implements CanActivate {                                           │
│    canActivate(context: ExecutionContext): boolean {               │
│      ✓ Extract "Authorization: Bearer ..." header                  │
│      ✓ Throw 401 if missing/invalid format                         │
│      ✓ Parse JWT token                                             │
│      ✓ Verify signature using JwtConfigService                    │
│      ✓ Validate payload structure (must have 'sub' and type ≠ 'refresh')
│      ✓ Throw 401 if invalid/expired                                │
│      ✓ Attach payload to request.user                              │
│      ✓ Return true (allow request to proceed)                      │
│    }                                                                │
│  }                                                                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
            ✅ Auth Valid? Continue : ❌ Throw 401
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3️⃣  CurrentUser Decorator (Parameter Extractor)                   │
│  📄 File: apps/api/src/shared/presentation/http/decorators/        │
│           current-user.decorator.ts                                 │
│                                                                      │
│  @CurrentUser() userId: string                                      │
│  ↓                                                                  │
│  createParamDecorator((_data, context) => {                        │
│    const request = context.switchToHttp().getRequest();            │
│    return request.user?.sub ?? '';  // Extract user ID from JWT    │
│  })                                                                 │
│                                                                      │
│  Result: userId = "user-1" (from JWT payload.sub)                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4️⃣  Request Handler (Controller Method)                            │
│  📄 File: apps/api/src/modules/notes/presentation/http/            │
│           commands/create-note/create-note.http.controller.ts     │
│                                                                      │
│  async create(                                                      │
│    @CurrentUser() userId: string,  ◄── "user-1" (from JWT)        │
│    @Body(...) body: CreateNoteInput                                │
│  ) {                                                                │
│    const result = await this.commandBus.execute(                   │
│      new CreateNoteCommand(                                         │
│        userId,       ◄── Owner ID (verified authenticated user)   │
│        body.title,                                                 │
│        body.content,                                               │
│        body.labels                                                 │
│      )                                                              │
│    );                                                               │
│    return { id: result.id };                                        │
│  }                                                                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5️⃣  CreateNoteHandler (Application Layer)                          │
│  📄 File: apps/api/src/modules/notes/application/commands/         │
│           create-note/create-note.handler.ts                       │
│                                                                      │
│  @CommandHandler(CreateNoteCommand)                                │
│  export class CreateNoteHandler {                                   │
│    async execute(command: CreateNoteCommand): Promise<...> {       │
│      // command.userId is the authenticated owner                  │
│      const note = NoteEntity.create(                               │
│        command.userId,  ◄── Ownership bound to authenticated user │
│        title                                                       │
│      );                                                             │
│                                                                      │
│      await this.unitOfWork.execute(async (ctx) => {               │
│        await ctx.repos.note.create(note);  // Create-only, no upsert
│        // ...                                                       │
│      });                                                            │
│    }                                                                │
│  }                                                                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6️⃣  NoteEntity.create() (Domain Layer)                             │
│                                                                      │
│  public static create(                                              │
│    ownerId: string,  ◄── Immutable ownership binding              │
│    title: NoteTitle                                                │
│  ): NoteEntity {                                                    │
│    const noteId = NoteId.from(uuidv7());  ◄── Server-generated ID │
│    return new NoteEntity({                                          │
│      ownerId,        ◄── Ownership recorded in aggregate          │
│      title,                                                        │
│      isShared: false,                                              │
│      shares: [],                                                   │
│      isProtected: false,                                           │
│      createdAt: new Date(),                                        │
│      updatedAt: new Date(),                                        │
│    }, noteId);                                                      │
│  }                                                                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7️⃣  Persistence (Infrastructure Layer)                            │
│  📄 File: apps/api/src/modules/notes/infrastructure/              │
│           persistence/repositories/prisma-note.repository.ts       │
│                                                                      │
│  async create(note: NoteEntity): Promise<void> {                   │
│    await this.prisma.note.create({                                │
│      data: {                                                       │
│        id: note.id,                                                │
│        userId: note.ownerId,  ◄── Ownership persisted in DB       │
│        title: note.title,                                          │
│        content: null,                                              │
│        isShared: note.isShared,                                    │
│        createdAt: note.createdAt,                                  │
│        updatedAt: note.updatedAt,                                  │
│      },                                                             │
│    });  ◄── .create() NEVER upserts!                              │
│  }                                                                  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ✅ Response 201 Created                                            │
│  { "id": "018f9abc-1234-5678-90ab-cdef01234567" }                 │
│                                                                      │
│  Note is now in database with:                                      │
│  - id: server-generated (UUIDv7)                                   │
│  - userId: authenticated user's ID                                 │
│  - title: request body                                             │
│  - ownership: immutable, cannot be changed                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Security Points

### 1. **Access Token Guard** (Entry Point)
- **Location**: `apps/api/src/shared/presentation/http/guards/access-token.guard.ts`
- **Responsibilities**:
  - ✅ Extracts JWT from `Authorization: Bearer` header
  - ✅ Validates signature using secret from config
  - ✅ Rejects expired/invalid tokens (401 Unauthorized)
  - ✅ Verifies token type is not 'refresh' (access tokens only)
  - ✅ Attaches verified payload to `request.user`

- **Throws on**:
  - Missing header
  - Invalid format
  - Invalid/expired token
  - Wrong token type

### 2. **CurrentUser Decorator** (Parameter Injection)
- **Location**: `apps/api/src/shared/presentation/http/decorators/current-user.decorator.ts`
- **Responsibilities**:
  - ✅ Extracts `sub` (subject/user ID) from JWT payload
  - ✅ Injects into handler as `userId` parameter

- **Guarantees**:
  - User ID came from verified JWT signature
  - Unauthenticated requests never reach this point

### 3. **Ownership Binding** (Domain Layer)
- **Location**: `apps/api/src/modules/notes/domain/entities/note.entity.ts`
- **Responsibilities**:
  - ✅ Receives `ownerId` from authenticated controller
  - ✅ Binds ownership immutably to aggregate
  - ✅ No way to override or change owner after creation

### 4. **Create-Only Persistence** (Infrastructure Layer)
- **Location**: `apps/api/src/modules/notes/infrastructure/persistence/repositories/prisma-note.repository.ts`
- **Responsibilities**:
  - ✅ Uses `.create()` only, never `.upsert()`
  - ✅ Cannot accidentally update existing note
  - ✅ ID must already exist in aggregate (server-generated)

---

## Auth Defense Layers

| Layer | Component | Protects Against |
|-------|-----------|------------------|
| **Request** | ZodValidationPipe | Invalid/malicious JSON, `id` field injection |
| **Route Guard** | AccessTokenGuard | Unauthenticated requests, token replay |
| **Parameter** | CurrentUser decorator | Spoofed user ID in request body |
| **Handler** | Command routing | Cross-module unauthorized access |
| **Domain** | NoteEntity.create() | Ownership tampering after creation |
| **Database** | Prisma.create() | Silent overwrites (no upsert) |

---

## JWT Token Structure

### Payload (verified by AccessTokenGuard)
```json
{
  "sub": "user-1",           // Subject (user ID)
  "email": "user@example.com",
  "type": "access",          // Must NOT be "refresh"
  "iat": 1691500000,         // Issued at
  "exp": 1691501900          // Expires (15 minutes)
}
```

### Token Generation (in Auth Module)
- **Location**: `apps/api/src/modules/auth/`
- Generated on login/registration
- Signed with `JWT_ACCESS_SECRET` from environment
- TTL: 15 minutes (configured via `JWT_ACCESS_EXPIRES_IN`)

---

## Attack Prevention

### Scenario 1: Forge JWT
❌ Attacker tries to create fake token
- **Defense**: `JwtService.verify()` checks signature with secret
- **Result**: `UnauthorizedException` thrown

### Scenario 2: Modify User ID in Token
❌ Attacker changes `sub` field
- **Defense**: Token signature invalidates on any payload change
- **Result**: `UnauthorizedException` thrown

### Scenario 3: Supply User ID in Request Body
❌ Attacker sends `{ userId: "victim-user-id", title: "..." }`
- **Defense**: Ignored! UserID comes from JWT only, not body
- **Result**: Note created with authenticated user as owner

### Scenario 4: Supply Note ID to Overwrite Another Note
❌ Attacker sends `{ id: "victim-note-id", title: "..." }`
- **Defense 1**: Schema strips `id` field (Zod)
- **Defense 2**: Command has no `id` parameter
- **Defense 3**: Repository uses `.create()` (insert-only, no upsert)
- **Result**: New server-generated ID, original note untouched

### Scenario 5: Use Refresh Token Instead of Access Token
❌ Attacker supplies refresh token in Authorization header
- **Defense**: Guard checks `payload.type !== 'refresh'`
- **Result**: `UnauthorizedException` thrown

---

## Complete Request Example

```bash
# 1. User receives JWT from login endpoint
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"..."}' \
  -w "\n%{json}"
# Response: { "accessToken": "eyJhbGci..." }

# 2. Create note with authenticated request
curl -X POST http://localhost:3000/notes \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Note",
    "content": "<p>Hello</p>",
    "id": "fake-id"  ← STRIPPED by Zod schema
  }'
# Response 201: { "id": "018f9abc-..." } (server-generated)

# 3. Verify ownership
curl -X GET http://localhost:3000/notes/018f9abc-... \
  -H "Authorization: Bearer eyJhbGci..."
# Response: { "id": "018f9abc-...", "userId": "user-1", "title": "My Note" }
```

---

## Configuration (Environment)

**File**: `.env` (or `docker-compose.yml`)

```env
JWT_ACCESS_SECRET=<your-secret-key-min-32-chars>
JWT_REFRESH_SECRET=<different-secret-key-min-32-chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

**Note**: Secrets are loaded by `JwtConfigService` in the config module.

---

## Summary

The authentication flow for POST /notes is **multi-layered and robust**:

1. ✅ **HTTP Guard** (`AccessTokenGuard`) validates JWT signature
2. ✅ **Parameter Decorator** (`@CurrentUser()`) extracts verified user ID
3. ✅ **Domain Logic** binds ownership immutably to aggregate
4. ✅ **Persistence** uses insert-only `.create()`, preventing overwrites
5. ✅ **Schema Validation** strips unknown fields like `id`

**Result**: Even if attacker knows another user's note ID, they cannot overwrite it because:
- User ID is verified via JWT (not from request body)
- Database uses `.create()` (never `.upsert()`)
- Ownership is bound in domain aggregate
- ID field in request is silently stripped
