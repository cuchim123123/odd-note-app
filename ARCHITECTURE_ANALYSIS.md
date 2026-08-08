# ODD Note App - Comprehensive Architecture Analysis

**Project Context:** A distributed, real-time collaborative note-taking workspace application built with clean/hexagonal architecture, DDD, CQRS, and EDA patterns for maximum maintainability and scalability.

---

## 1. Project Structure Overview

### Monorepo Organization (pnpm workspaces)
```
odd-note-app/
├── apps/
│   ├── api/          # Backend NestJS application (CQRS + DDD)
│   ├── web/          # Frontend React/Vite SPA
├── packages/
│   ├── validation/   # Shared Zod validation schemas
│   ├── tsconfig/     # TypeScript configuration inheritance
│   ├── eslint-config/# ESLint config inheritance
├── infrastructure/   # Docker and deployment configs
├── e2e/             # Playwright end-to-end tests
└── tools/           # Development utilities and test servers
```

### Technology Stack

**Backend:**
- **Framework:** NestJS v10 with TypeScript
- **Database:** PostgreSQL (via Prisma ORM)
- **Event Store:** MongoDB (read models/projections)
- **Cache/Messaging:** Redis (pubsub, idempotency locks, snapshots)
- **Message Broker:** Kafka (event streaming, cross-module communication)
- **Real-time Collaboration:** Socket.IO + Yjs (CRDT for operational transformation)
- **File Storage:** MinIO (S3-compatible)
- **Architecture Patterns:** CQRS, Event Sourcing, DDD, Hexagonal Architecture
- **Testing:** Vitest, Playwright

**Frontend:**
- **Framework:** React 18.3 with TypeScript
- **State Management:** Zustand (stores)
- **Data Fetching:** TanStack React Query (@tanstack/react-query)
- **Rich Text Editor:** TipTap (with Yjs collaboration extension)
- **Styling:** Tailwind CSS + Radix UI (accessible components)
- **Real-time:** Socket.IO client + Yjs protocol
- **Routing:** React Router v7
- **Forms:** React Hook Form + Zod validation

**Infrastructure:**
- **Containerization:** Docker + Docker Compose
- **Package Manager:** pnpm v10
- **Quality Tools:** ESLint, Prettier, Husky, CommitLint
- **Testing:** Playwright for E2E, Vitest for unit tests

---

## 2. Architectural Patterns & Design Principles

### 2.1 Clean/Hexagonal Architecture

The API follows strict layering with clear boundaries:

```
presentation (HTTP Controllers, WebSocket Handlers)
    ↓
application (Commands, Queries, Event Mappers, DTOs)
    ↓
domain (Aggregates, Entities, Value Objects, Domain Events, Errors)
    ↓
infrastructure (Persistence, External Services, Framework Adapters)
```

**Key Principle:** Direction of dependency always flows **inward** toward domain. Infrastructure never directly touches domain logic.

#### Layer Responsibilities:

**Domain Layer** (`apps/api/src/shared/domain/`)
- Pure business logic, framework-agnostic
- **AggregateRoot**: Base class for domain aggregates (tracks domain events)
- **DomainEvent**: Base interface for all domain events
- **Value Objects**: Immutable, type-safe primitives (e.g., `NoteTitle`, `SharePermission`)
- **Entities**: Domain objects with identity
- **Domain Errors**: Custom exception hierarchy for business rule violations

**Application Layer** (`apps/api/src/modules/*/application/`)
- **CQRS Handlers:**
  - `CommandHandlers`: Orchestrate state changes via `ICommandHandler<T>`
  - `QueryHandlers`: Read-optimized queries via `IQueryHandler<T>`
- **Services**: Domain/infrastructure coordination
- **Mappers:**
  - `IDomainEventMapper`: Maps domain events → outbox messages (Kafka topics)
  - `IInternalCommandMapper`: Maps Kafka topics → internal commands
- **DTOs**: Request/response contracts
- **Ports (Interfaces):** Dependency inversion contracts
  - Repository ports (write model)
  - DAO ports (read model)
  - External service ports

**Presentation Layer** (`apps/api/src/modules/*/presentation/`)
- **HTTP Controllers**: REST endpoints, request validation, authorization
- **Kafka Consumers**: Event pattern handlers for incoming integration events
- **WebSocket Handlers**: Real-time collaboration events

**Infrastructure Layer** (`apps/api/src/shared/infrastructure/` + module-specific)
- **Persistence:**
  - `PrismaService`: PostgreSQL ORM wrapper
  - Repositories: Implement domain repository interfaces
  - DAOs: SQL/MongoDB queries for read models
- **Messaging:**
  - Kafka producer/consumer via NestJS microservices
  - OutboxProcessor: Transactional outbox pattern implementation
- **External Adapters:**
  - Redis service (caching, pubsub, idempotency)
  - MongoDB service (read models/event store)
  - S3/MinIO adapter (file uploads)
  - SMTP mailer (email notifications)

---

### 2.2 Domain-Driven Design (DDD)

Each module represents a **bounded context** with clear responsibility:

#### Bounded Contexts:

**Auth Module** (`apps/api/src/modules/auth/`)
- User registration, login, email verification
- Password reset with time-limited tokens
- JWT token generation and refresh
- Domain: User aggregates, PasswordResetToken entities
- Events: `UserRegisteredDomainEvent`

**Notes Module** (`apps/api/src/modules/notes/`)
- Note CRUD operations with real-time collaboration
- Note sharing with permission levels (READ, EDIT)
- Password protection for notes
- Revision history and restoration
- Domain: Note aggregate with shares, protection, revisions
- Events: `NoteCreatedDomainEvent`, `NoteSharedDomainEvent`, `NotePasswordSetDomainEvent`, etc.

**Collaboration Module** (`apps/api/src/modules/collaboration/`)
- Real-time WebSocket coordination via Socket.IO
- Yjs protocol sync for operational transformation
- Presence tracking (who's editing)
- Cursor positions and typing indicators
- Does NOT modify domain state directly—broadcasts changes from Notes module

**Notifications Module** (`apps/api/src/modules/notifications/`)
- Kafka consumer for domain events (e.g., `NoteShared`)
- Creates notification records in read model
- WebSocket broadcast of new notifications
- Idempotency via `eventId` field (tracks which domain events created notifications)

**Billing Module** (`apps/api/src/modules/billing/`)
- Payment and subscription management
- Multiple aggregate roots: `Payment`, `Subscription`
- Integration events: `PaymentCompletedDomainEvent`, `SubscriptionActivatedDomainEvent`
- Demonstrates CQRS with complex state machines

**Uploads Module** (`apps/api/src/modules/uploads/`)
- S3/MinIO presigned URL generation
- File upload orchestration
- Manages file metadata

#### Aggregate Patterns:

**Note Aggregate (notes module)**
```typescript
// Core aggregate root
class Note extends AggregateRoot {
  id: string;
  userId: string;
  title: NoteTitle;      // Value object
  content: string;
  shares: NoteShare[];   // Child entities
  protection?: NoteProtection;
  revisions: NoteRevision[];
  
  // Business logic methods (emit domain events)
  create(title, content) → NoteCreatedDomainEvent
  share(recipientEmail, permission) → NoteSharedDomainEvent
  updateTitle(newTitle) → NoteTitleUpdatedDomainEvent
  setPassword(hash) → NotePasswordSetDomainEvent
  delete() → NoteDeletedDomainEvent
  
  // Validation
  canUserEdit(userId): boolean
  hasAccess(userId): boolean
}
```

**Value Objects** (immutable, identity by value):
- `NoteTitle`: Enforces min/max length, trims whitespace
- `SharePermission`: Enum-like (READ | EDIT)
- `BillingEntityId`, `Money`, `PlanVersion`: Billing domain

---

### 2.3 CQRS (Command Query Responsibility Segregation)

**Strict separation of write and read models:**

#### Write Path (Command):
```
HTTP POST /notes
  ↓
UpdateNoteController (validation, auth)
  ↓
UpdateNoteCommand (data object)
  ↓
UpdateNoteHandler (ICommandHandler)
  ├─ Load aggregate from repository
  ├─ Execute business logic (aggregate.updateTitle(...))
  ├─ Collect domain events from aggregate
  └─ Store aggregate + persist events to outbox
  ↓
UnitOfWork.execute() (Prisma transaction)
  ├─ Save aggregate to PostgreSQL
  ├─ Map domain events → OutboxMessageDraft[]
  └─ INSERT into OutboxMessage table (Kafka relay)
  ↓
OutboxProcessor (polls every 10s)
  ├─ Fetch PENDING outbox messages
  └─ Publish to Kafka topics
```

#### Read Path (Query):
```
HTTP GET /notes?search=...
  ↓
ListNotesController
  ↓
ListNotesQuery (data object)
  ↓
ListNotesQueryHandler (IQueryHandler)
  ├─ Bypass domain/repository layers
  └─ Query MongoDB read model directly (optimized for reads)
  ↓
MongoNoteQueryDao (read model)
  ├─ Fetch pre-computed note projections
  └─ Apply filters, sorting, pagination
  ↓
Response (fast, denormalized data)
```

**Key Benefits:**
- Write side: Strong consistency, domain logic protection
- Read side: Blazing-fast queries, denormalized data, no N+1 problems
- Independent scaling: Optimize each path separately

---

### 2.4 Event-Driven Architecture (EDA)

#### Event Flow:

1. **Domain Event Emitted** (during aggregate operation)
   ```typescript
   class Note extends AggregateRoot {
     share(recipientEmail, permission) {
       this.addDomainEvent(new NoteSharedDomainEvent({
         aggregateId: this.id,
         aggregateVersion: this.version,
         eventId: uuidv7(),  // Idempotency key
         ownerId: this.userId,
         recipientEmail,
         permission,
         occurredOn: new Date(),
       }));
     }
   }
   ```

2. **Command Handler Saves Aggregate**
   ```typescript
   @CommandHandler(ShareNoteCommand)
   execute(command) {
     return unitOfWork.execute(async ({ repos }) => {
       const note = await repos.note.findById(command.noteId);
       note.share(command.recipientEmail, command.permission);
       await repos.note.save(note);  // Triggers event collection
     });
   }
   ```

3. **UnitOfWork Persists Events to Outbox**
   ```typescript
   class BasePrismaUnitOfWork {
     async execute<T>(work: () => Promise<T>) {
       await tx.$transaction(async (tx) => {
         const result = await work(ctx);  // Execute command
         
         // Collect events from tracked aggregates
         const events = trackedAggregates
           .flatMap(agg => agg.domainEvents);
         
         // Map to outbox messages
         const outboxMessages = this.eventMapper.map(events);
         
         // Persist to DB in same transaction
         await tx.outboxMessage.createMany({ data: outboxMessages });
         return result;
       });
     }
   }
   ```

4. **Outbox Processor Publishes to Kafka**
   ```typescript
   @Cron(CronExpression.EVERY_10_SECONDS)
   async processOutboxMessages() {
     const messages = await prisma.$queryRaw`
       UPDATE "OutboxMessage"
       SET status = 'PROCESSING'
       WHERE status = 'PENDING'
         AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= now())
       FOR UPDATE SKIP LOCKED
       RETURNING *
     `;
     
     for (const msg of messages) {
       try {
         await firstValueFrom(
           this.kafkaClient.emit(msg.topic, msg.payload)
         );
         await this.markProcessed(msg.id);
       } catch (err) {
         await this.scheduleRetry(msg.id);  // Exponential backoff
       }
     }
   }
   ```

5. **Integration Event Consumed by Other Modules**
   ```typescript
   @Controller()
   export class NoteSharedConsumer {
     @EventPattern('NoteShared')
     async handle(@Payload() event: NoteSharedPayload) {
       // Notifications module creates notification record
       // Loads enriched data from DB
       // Publishes to WebSocket
       // Idempotent via eventId field
     }
   }
   ```

6. **Projection Consumer Updates Read Model**
   ```typescript
   @Controller()
   export class NoteProjectionConsumer {
     @EventPattern('NoteShared')
     async handle(event: NoteSharedProjectionEvent) {
       // MongoDB atomic update with guards
       await noteModel.updateOne(
         {
           _id: event.aggregateId,
           aggregateVersion: { $lt: event.aggregateVersion },
           lastEventId: { $ne: event.eventId },  // Idempotency
         },
         {
           $push: { shares: ... },
           $set: {
             aggregateVersion: event.aggregateVersion,
             lastEventId: event.eventId,
           },
         }
       );
     }
   }
   ```

---

### 2.5 Transactional Outbox Pattern

**Problem Solved:** Dual-write issue (update DB + publish event atomically)

**Solution:**
- Events persisted to relational DB in same transaction as aggregate
- Outbox processor polls DB and publishes to Kafka
- Retry logic with exponential backoff (10s → 30s → 2m → 10m → 1h)
- Dead-letter queue for failed messages (manual inspection required)
- Exactly-once semantics via idempotent consumers (eventId)

**Retry Policy:**
```
Attempt 1 → wait 10s
Attempt 2 → wait 30s
Attempt 3 → wait 2m
Attempt 4 → wait 10m
Attempt 5 → wait 1h
Attempt 6+ → DEAD_LETTERED (manual intervention needed)
```

**Concurrency Safety:** `FOR UPDATE SKIP LOCKED` ensures horizontally-scaled processors don't double-process.

---

### 2.6 Event Sourcing (Implicit)

While not full Event Sourcing (events aren't the source of truth), the pattern is **event-centric**:

- Aggregates maintain state in PostgreSQL
- Domain events capture **what happened** (immutable facts)
- Projection consumers replay events to build read models in MongoDB
- Revision/audit trail via events
- Can rebuild read models by replaying Kafka stream

Example: `NoteRevision` tracks snapshots of document state at key checkpoints.

---

## 3. Module Deep Dives

### 3.1 Notes Module Architecture

```
notes/
├── domain/
│   ├── entities/
│   │   ├── note.entity.ts          # Note aggregate root
│   │   └── note-share.entity.ts    # Child entity
│   ├── value-objects/
│   │   ├── note-title.vo.ts        # Immutable, validated
│   │   └── share-permission.vo.ts  # Enum-like
│   ├── errors/
│   │   └── note.errors.ts          # DomainException hierarchy
│   └── events/
│       ├── note-created.domain-event.ts
│       ├── note-shared.domain-event.ts
│       └── ... (10+ more)
├── application/
│   ├── commands/
│   │   ├── create-note/create-note.command.ts
│   │   ├── create-note/create-note.handler.ts
│   │   ├── share-note/share-note.command.ts
│   │   ├── share-note/share-note.handler.ts
│   │   └── ... (20+ more)
│   ├── queries/
│   │   ├── list-notes/list-notes.query.ts
│   │   └── list-notes/list-notes.query-handler.ts
│   ├── ports/
│   │   ├── repositories/note.repository.port.ts
│   │   ├── dao/note-query.dao.port.ts
│   │   └── ... (10+ more)
│   ├── mappers/
│   │   └── integration-event.mapper.ts    # Domain events → Kafka messages
│   └── services/
│       └── replay.coordinator.ts          # Revision restoration
├── infrastructure/
│   ├── persistence/
│   │   ├── prisma-note.repository.ts      # Implements write-side repo port
│   │   ├── prisma-unit-of-work.ts         # Transactional boundaries
│   │   └── transactions/                  # Transaction contexts
│   ├── projection/
│   │   ├── schemas/
│   │   │   ├── note-projection.schema.ts  # MongoDB schema for reads
│   │   │   └── note-revision-projection.schema.ts
│   │   ├── consumers/
│   │   │   ├── note-projection.consumer.ts       # Kafka consumer
│   │   │   ├── note-share-projection.consumer.ts # Updates shares
│   │   │   └── note-revision-projection.consumer.ts
│   │   ├── dao/
│   │   │   ├── mongo-note-query.dao.ts    # Implements read DAO port
│   │   │   └── mongo-note-revision-query.dao.ts
│   │   └── events/
│   │       └── projection-events.ts       # Interfaces for projection consumers
│   └── adapters/
│       └── document-sync.adapter.ts       # Yjs/CRDT coordination
└── presentation/
    ├── http/
    │   ├── note.controller.ts             # REST endpoints
    │   ├── note-sharing.controller.ts     # Sharing endpoints
    │   └── dto/
    │       ├── note.response.dto.ts       # API contracts
    │       └── create-note.request.dto.ts
    └── websocket/
        └── note-collaboration.gateway.ts  # Socket.IO handler
```

#### Key Flow: Create Note
```
POST /notes { title, content }
  ↓
NoteController.create()
  ├─ @CurrentUser() userId
  ├─ Validate input (Zod schema)
  └─ commandBus.execute(new CreateNoteCommand(...))
  ↓
CreateNoteHandler.execute()
  ├─ unitOfWork.execute(async ({ repos }) => {
  │   const note = Note.create(userId, title, content)
  │   note.addDomainEvent(new NoteCreatedDomainEvent(...))
  │   await repos.note.save(note)
  │   return { id: note.id }
  │ })
  ↓
PrismaNoteUnitOfWork.execute()
  ├─ Start Prisma transaction
  ├─ Save aggregate to PostgreSQL
  ├─ Collect domain events
  ├─ Map to OutboxMessageDraft[]
  ├─ INSERT into OutboxMessage table
  └─ COMMIT transaction
  ↓
OutboxProcessor (polls every 10s)
  ├─ Fetch PENDING outbox messages
  └─ emit('NoteCreated', { aggregateId, title, ownerId, ... })
  ↓
Kafka topic: NoteCreated
  ├─ NoteProjectionConsumer subscribes
  │   └─ Updates MongoDB read model (upsert)
  ├─ NotificationsConsumer (if shared to others)
  │   └─ Creates Notification records
  └─ CollaborationGateway broadcasts
      └─ Emits socket.io event to connected clients
```

---

### 3.2 Real-Time Collaboration (Yjs + CRDT)

**Problem:** Multiple users editing simultaneously, need operational transformation (OT) or CRDT.

**Solution:** **Yjs library** with CRDT (Conflict-free Replicated Data Type)
- Clients maintain local Yjs document state
- Changes broadcast via Socket.IO (binary Yjs update messages)
- Server relays updates to all connected clients
- No centralized conflict resolution needed—CRDT handles it mathematically

#### WebSocket Event Types (from `collaboration.constants.ts`):

**Client → Server:**
- `note:join` - Client joins collaboration session
- `note:leave` - Client stops editing
- `yjs:sync-step-1` / `yjs:sync-step-3` - CRDT sync handshake
- `yjs:update` - Binary CRDT state update (operations)
- `note:typing` - Typing indicator (stale after 5s)

**Server → Client:**
- `yjs:sync-step-2` - Server's CRDT state snapshot
- `yjs:update` - Relayed updates from other clients
- `collaborator:joined` / `collaborator:left`
- `presence:list` - Current users editing
- `typing:list` - Who's currently typing
- `note:updated` - Note metadata changes (permissions, etc.)

#### Redis Coordination:

```typescript
REDIS_KEYS: {
  PARTICIPANTS: 'collab:note:${noteId}:participants'  // Active editors
  TYPING: 'collab:note:${noteId}:typing'              // Typing users
  SNAPSHOT: 'collab:note:${noteId}:snapshot'          // CRDT state
}
```

Socket.IO adapter uses Redis for horizontal scaling (multiple servers can relay messages).

---

### 3.3 Notifications Module

**Event-Driven Notification System:**

```
NoteSharedDomainEvent
  ↓
OutboxProcessor publishes to Kafka: 'NoteShared'
  ↓
NoteSharedConsumer (Notifications module)
  ├─ Fetch note details from DB (read model)
  ├─ Check idempotency via eventId
  ├─ Create Notification record
  ├─ Update UserNotificationStat.unreadCount
  └─ Broadcast via WebSocket
  ↓
Client receives socket.io event: 'notification:new'
  └─ Updates UI immediately (Zustand store)
```

**Idempotency Protection:**
```typescript
// Kafka consumer checks eventId to prevent duplicate notifications
const existingNotification = await prisma.notification.findUnique({
  where: { eventId }
});
if (existingNotification) {
  return;  // Already processed
}
```

---

### 3.4 Projection Consumers (MongoDB)

**Read Model Building:**

Instead of querying write model (PostgreSQL) for every read, maintain denormalized copies in MongoDB:

```typescript
// NoteProjectionConsumer listens to events
@EventPattern('NoteCreated')
async onCreate(event: NoteCreatedProjectionEvent) {
  // Upsert with idempotency guard
  await noteModel.updateOne(
    { _id: event.aggregateId },
    {
      $setOnInsert: {
        title: event.title,
        userId: event.userId,
        shares: [],
        labels: [],
      },
      $set: {
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.eventId,  // Guard against duplicates
        projectionUpdatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}
```

**Benefits:**
- Denormalized structure optimized for query patterns
- Atomic MongoDB updates with version guards
- Multiple projections (read models) of same events
- Can rebuild by replaying Kafka topic

---

## 4. Database Schema & Persistence

### 4.1 Write Model (PostgreSQL via Prisma)

**Key Tables:**

```prisma
// User
model User {
  id String @id @default(cuid())
  email String @unique
  passwordHash String
  notes Note[]                    // 1:N relationship
  noteSharesOwned NoteShare[]     // Shares user owns
  noteSharesReceived NoteShare[]  // Shares received by user
  notifications Notification[]
  notificationStat UserNotificationStat?
}

// Note Aggregate
model Note {
  id String @id @default(cuid())
  userId String
  title String
  content String
  shares NoteShare[]              // Child entities
  protection NoteProtection?      // Optional password protection
  revisions NoteRevision[]        // Version history
  updates NoteUpdate[]            // Transient collaboration updates
  labels String[]                 // Denormalized for quick filtering
  isPinned Boolean
  isShared Boolean                // Computed from shares.length
  user User @relation(fields: [userId])
  
  @@index([userId])
  @@index([isPinned])
  @@index([updatedAt])
}

// Child Entity: Share
model NoteShare {
  id String @id @default(cuid())
  noteId String
  ownerId String
  recipientId String?             // NULL until user accepts invite
  recipientEmail String           // Always populated for invites
  permission SharePermission      // READ | EDIT
  note Note @relation(fields: [noteId])
  owner User @relation("NoteSharesOwned")
  recipient User? @relation("NoteSharesReceived")
  
  @@unique([noteId, recipientEmail])
  @@index([noteId])
  @@index([ownerId])
}

// Password-Protected Notes
model NoteProtection {
  id String @id @default(cuid())
  noteId String @unique
  passwordHash String             // bcrypt hash
  note Note @relation(fields: [noteId])
}

// Revision Snapshot
model NoteRevision {
  id String @id @default(cuid())
  noteId String
  content String                  // Full document content at checkpoint
  seq String                       // BigInt as string (Yjs clock)
  createdBy String
  note Note @relation(fields: [noteId])
}

// Real-time Updates (Yjs operations cache)
model NoteUpdate {
  id String @id @default(cuid())
  noteId String
  update Bytes                     // Binary Yjs update
  seq String                       // Sequence number
  note Note @relation(fields: [noteId])
}
```

### 4.2 Read Model (MongoDB)

**Denormalized Projection Schema:**

```typescript
// Note Projection
interface NoteProjection {
  _id: string;                    // noteId
  userId: string;
  title: string;
  isPinned: boolean;
  isProtected: boolean;
  isShared: boolean;
  labels: string[];
  
  // Embedded shares (denormalized)
  shares: {
    shareId: string;
    recipientId?: string;
    recipientEmail: string;
    recipientDisplayName: string;
    permission: 'READ' | 'EDIT';
    sharedAt: Date;
  }[];
  
  createdAt: Date;
  updatedAt: Date;
  
  // Versioning for idempotency
  aggregateVersion: number;
  lastEventId: string;            // UUIDv7 from domain event
  projectionUpdatedAt: Date;
}

// Revision Projection
interface NoteRevisionProjection {
  _id: string;                    // revisionId
  noteId: string;
  targetSeq: string;              // Yjs clock
  label: string | null;           // User label for snapshot
  createdBy: string;
  content: string;
  createdAt: Date;
  
  aggregateVersion: number;
  lastEventId: string;
}
```

**MongoDB ensures atomic updates with version guards:**
```typescript
// Only update if our event version is newer
db.notes.updateOne(
  {
    _id: noteId,
    aggregateVersion: { $lt: eventVersion },  // Reject out-of-order
    lastEventId: { $ne: eventId }             // Prevent duplicates
  },
  { $set: { /* changes */ } }
);
```

---

## 5. Dependency Inversion & Port-Adapter Pattern

### 5.1 Port Definitions (Interfaces)

Ports define contracts for external dependencies:

```typescript
// Repository Port (Write Model)
export const NOTE_REPOSITORY = Symbol('NOTE_REPOSITORY');
export interface INoteRepository {
  findById(id: string): Promise<Note | null>;
  save(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
}

// DAO Port (Read Model)
export const NOTE_QUERY_DAO = Symbol('NOTE_QUERY_DAO');
export interface INoteQueryDao {
  findById(id: string): Promise<NoteResponseDto | null>;
  listByUserId(userId: string, filters): Promise<NoteResponseDto[]>;
  search(query: string): Promise<NoteResponseDto[]>;
}

// External Service Port
export const DOCUMENT_SYNC_PORT = Symbol('DOCUMENT_SYNC_PORT');
export interface IDocumentSyncPort {
  startSync(noteId: string): Promise<void>;
  stopSync(noteId: string): Promise<void>;
}

// Unit of Work Pattern
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export interface UnitOfWork {
  execute<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
```

### 5.2 Adapter Implementations

```typescript
// PostgreSQL Repository Adapter
@Injectable()
export class PrismaNoteRepository implements INoteRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: AggregateTracker
  ) {}
  
  async findById(id: string): Promise<Note | null> {
    const dto = await this.prisma.note.findUnique({ where: { id } });
    if (!dto) return null;
    const aggregate = Note.fromPersistence(dto);
    this.tracker.track(aggregate);  // Track for event collection
    return aggregate;
  }
  
  async save(note: Note): Promise<void> {
    const dto = note.toPersistence();
    await this.prisma.note.update({
      where: { id: note.id },
      data: dto,
    });
  }
}

// MongoDB DAO Adapter (Read Model)
@Injectable()
export class MongoNoteQueryDao implements INoteQueryDao {
  constructor(@InjectModel('Note') private noteModel: Model<any>) {}
  
  async listByUserId(userId: string, filters): Promise<NoteResponseDto[]> {
    const notes = await this.noteModel
      .find({ userId, ...filters })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    return notes.map(this.toResponseDto);
  }
}
```

### 5.3 Injection & Registration

```typescript
// In module's .module.ts
@Module({
  providers: [
    {
      provide: NOTE_REPOSITORY,
      useClass: PrismaNoteRepository,  // Concrete implementation
    },
    {
      provide: NOTE_QUERY_DAO,
      useClass: MongoNoteQueryDao,
    },
    {
      provide: DOCUMENT_SYNC_PORT,
      useClass: YjsDocumentSyncAdapter,
    },
  ],
})
export class NotesModule {}

// In handler, inject via symbol
@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly repo: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT) private readonly sync: IDocumentSyncPort,
  ) {}
}
```

---

## 6. Error Handling & Validation

### 6.1 Domain Errors (Custom Exceptions)

```typescript
// notes/domain/errors/note.errors.ts
export class NoteDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NoteNotFoundError extends NoteDomainError {
  constructor(noteId: string) {
    super(`Note with id "${noteId}" not found`);
  }
}

export class NotePermissionDeniedError extends NoteDomainError {
  constructor(userId: string, action: string) {
    super(`User "${userId}" is not permitted to ${action}`);
  }
}

export class NoteAlreadySharedError extends NoteDomainError {
  constructor(noteId: string, recipientEmail: string) {
    super(`Note "${noteId}" already shared with "${recipientEmail}"`);
  }
}
```

### 6.2 Application-Level Validation

Uses **Zod** for schema validation:

```typescript
// shared/validation/notes/note.schema.ts
import { z } from 'zod';

export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(100_000).optional(),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

// In controller
@Post()
async create(@Body() input: any) {
  const validated = CreateNoteSchema.parse(input);  // Throws on invalid
  return this.commandBus.execute(new CreateNoteCommand(validated));
}
```

### 6.3 Presentation-Level Error Handling

```typescript
// Error interceptor catches domain/app exceptions
@Catch(NoteDomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: NoteDomainError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.status(400).json({
      error: exception.name,
      message: exception.message,
    });
  }
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests (Vitest)

Domain layer tested in isolation:
```typescript
describe('Note Aggregate', () => {
  it('should share note with valid recipient email', () => {
    const note = Note.create('user-1', 'My Note', 'Content');
    note.share('recipient@email.com', SharePermission.READ);
    
    expect(note.domainEvents).toHaveLength(1);
    expect(note.domainEvents[0]).toBeInstanceOf(NoteSharedDomainEvent);
  });
  
  it('should throw error when sharing with invalid email', () => {
    const note = Note.create('user-1', 'My Note', 'Content');
    expect(() => {
      note.share('invalid-email', SharePermission.READ);
    }).toThrow(InvalidEmailError);
  });
});
```

### 7.2 Integration Tests

Handler + Repository + Database:
```typescript
describe('CreateNoteHandler', () => {
  it('should create note and emit domain event', async () => {
    const handler = app.get(CreateNoteHandler);
    const result = await handler.execute(
      new CreateNoteCommand('user-1', 'Test Note', 'Content')
    );
    
    const savedNote = await noteRepo.findById(result.id);
    expect(savedNote.title).toBe('Test Note');
  });
});
```

### 7.3 End-to-End Tests (Playwright)

Real browser + API:
```typescript
test('should create, edit, and delete note', async ({ page }) => {
  await registerAndLogin(page);
  
  // Create
  await page.click('button[aria-label="Create new note"]');
  await page.fill('input[placeholder*="title"]', 'E2E Test Note');
  await page.waitForTimeout(3500);  // Wait for autosave
  
  // Verify
  await expect(page.locator('.note-item')).toContainText('E2E Test Note');
  
  // Edit
  await page.locator('.tiptap').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Updated content');
  await page.waitForTimeout(2000);
  
  // Delete
  await page.click('button[aria-label="Delete note"]');
  await page.click('button:has-text("Delete")');
  await expect(page.locator('.note-item')).not.toContainText('E2E Test Note');
});
```

---

## 8. Scalability & Performance Patterns

### 8.1 Horizontal Scaling

**Stateless API Layer:**
- Multiple NestJS instances behind load balancer
- Socket.IO adapter uses Redis for cross-instance communication
- OutboxProcessor uses `FOR UPDATE SKIP LOCKED` for concurrent safety
- Idempotency locks in Redis prevent duplicate processing

**Distributed Event Processing:**
- Kafka partitions events by `billingEntityId` (or similar)
- Multiple consumer instances read from same consumer group
- Exactly-once semantics via eventId + database idempotency

### 8.2 Caching Strategy

```typescript
// Redis caching for frequently read data
const cacheKey = `note:${noteId}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

const note = await noteQueryDao.findById(noteId);
await redis.set(cacheKey, note, 'EX', 3600);  // TTL 1 hour
return note;
```

### 8.3 Database Indexing

PostgreSQL:
```prisma
model Note {
  userId String
  isPinned Boolean
  updatedAt DateTime
  
  @@index([userId])       // Find user's notes
  @@index([isPinned])     // Filter pinned
  @@index([updatedAt])    // Sort by recent
}
```

MongoDB:
- Projection consumers create compound indexes for queries
- Atomic updates use covered queries when possible

### 8.4 Query Optimization

- CQRS read model (MongoDB) eliminates joins
- Pagination via limit/offset or cursor
- Denormalization trades write complexity for read speed
- Full-text search on denormalized fields

---

## 9. Key Architectural Decisions

### 9.1 Why Yjs (CRDT) for Collaboration?

- **Conflict-free by design:** No server arbitration needed
- **Offline-first:** Clients work disconnected, sync when reconnected
- **Operational Transform alternative:** Better than OT for peer-to-peer
- **Binary protocol:** Efficient network usage
- **Framework integration:** TipTap Yjs extension for rich text

### 9.2 Why Separate Write & Read Models?

- **Independent optimization:** Write side normalized for consistency, read side denormalized for speed
- **Read performance:** MongoDB queries vastly faster than SQL joins
- **Scalability:** Read replicas don't block writes
- **Event sourcing ready:** Can rebuild read models from events

### 9.3 Why Kafka for Event Streaming?

- **Durability:** Events persisted to disk, reliable replay
- **Consumer groups:** Multiple independent consumers (notifications, projections, analytics)
- **Partitioning:** Events ordered per entity, parallel across entities
- **Replayability:** Can rebuild read models by replaying topic

### 9.4 Why PostgreSQL (Relational) for Write Side?

- **ACID transactions:** Atomic outbox pattern
- **Strong consistency:** Aggregate state authoritative
- **Mature ecosystem:** Prisma ORM, excellent tooling
- **Constraints:** Database-level validation (unique shares, foreign keys)

---

## 10. Cross-Cutting Concerns

### 10.1 Authentication & Authorization

```typescript
// JWT-based (not session-based)
@Controller('/notes')
export class NoteController {
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    // Guard ensures only authenticated requests reach handler
    return this.queryBus.execute(new ListNotesQuery(user.id));
  }
}

// Domain logic enforces authorization
async shareNote(userId: string, noteId: string, recipientEmail: string) {
  const note = await this.noteRepo.findById(noteId);
  
  // Throw if user doesn't own note
  if (note.userId !== userId) {
    throw new NotePermissionDeniedError(userId, 'share');
  }
  
  note.share(recipientEmail, SharePermission.READ);
}
```

### 10.2 Logging & Observability

```typescript
// Structured logging
private readonly logger = new Logger(UpdateNoteHandler.name);

logger.log(`Updating note ${noteId} for user ${userId}`);
logger.error(`Failed to update note`, error);

// Request correlation via X-Request-ID header
// Distributed tracing via Kafka correlationId field
```

### 10.3 Idempotency

**Multiple layers:**

1. **EventId** (UUIDv7): Unique per domain event
   - Prevents notification duplicates
   - Guards projection updates: `lastEventId: { $ne: event.eventId }`

2. **Idempotency Key**: Client-provided for requests
   - Redis lock: `idempotency:${namespace}:${key}`
   - Guards command re-execution (e.g., RestoreRevisionCommand)

3. **Database constraints:**
   - Unique indexes prevent duplicate records
   - MongoDB `upsert` with version guards

---

## 11. Deployment & Infrastructure

### 11.1 Docker Compose Services

```yaml
services:
  redis:7          # Caching, pubsub, locks
  postgres:15      # Write model (aggregates)
  mongodb:latest   # Read model (projections)
  minio:latest     # S3-compatible file storage
  kafka:latest     # Event streaming (if applicable)
  api:NestJS       # Application server
  nginx:latest     # Reverse proxy, static hosting
```

### 11.2 Production Readiness

- Health checks on all services
- Database migrations via Prisma CLI
- Environment variable configuration
- Structured logging (JSON format)
- Error tracking (Sentry optional)
- Rate limiting on public endpoints
- CORS configuration

---

## 12. Development Workflow

### 12.1 Local Development

```bash
# Start services
docker compose -f docker-compose.dev.yml up -d

# Run API in watch mode
pnpm --filter @odd-note-app/api dev

# Run Web in dev mode
pnpm --filter @odd-note-app/web dev

# Run E2E tests
pnpm test:e2e

# Database migrations
pnpm --filter @odd-note-app/api prisma:migrate
```

### 12.2 CI/CD (Implied)

- Linting: `pnpm lint`
- Type checking: `pnpm typecheck`
- Unit tests: `pnpm test`
- E2E tests: `pnpm test:e2e`
- Docker build & push
- Kubernetes deployment (optional)

---

## 13. Key Takeaways

| Aspect | Pattern | Benefit |
|--------|---------|---------|
| **Write Logic** | CQRS + Aggregates | Consistency, domain focus |
| **Read Performance** | Denormalized projections | Sub-100ms queries |
| **Event Durability** | Transactional outbox | No dual-write issues |
| **Concurrency** | Yjs CRDT | Conflict-free merging |
| **Idempotency** | Multi-layer guards | Safe retries |
| **Scalability** | Event-driven, stateless | Horizontal scaling |
| **Testability** | Hexagonal architecture | Unit test domain in isolation |
| **Maintainability** | Bounded contexts, DDD | Clear responsibility boundaries |

---

## 14. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Web App                             │
│  (Zustand store, TanStack Query, Socket.IO, Yjs CRDT)           │
└────────────────┬────────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    HTTP REST         WebSocket (Socket.IO)
    (CRUD)            (Real-time collaboration)
        │                 │
┌───────┴─────────────────┴──────────────────────────────────────┐
│                    NestJS API (Port 3000)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Presentation (Controllers, WebSocket Gateways)          │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────┴───────────────────────────────────────┐   │
│  │  Application (CQRS: Commands, Queries, DTOs)             │   │
│  │  └─ CommandBus, QueryBus, EventBus (NestJS/CQRS)       │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────┴───────────────────────────────────────┐   │
│  │  Domain (Aggregates, Entities, Value Objects, Events)    │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────┴───────────────────────────────────────┐   │
│  │  Infrastructure                                           │   │
│  │  ├─ Persistence: PostgreSQL (Prisma), MongoDB            │   │
│  │  ├─ Messaging: Kafka, Redis pubsub                       │   │
│  │  ├─ OutboxProcessor: Event → Kafka relay                │   │
│  │  └─ Projection Consumers: Kafka → MongoDB updates       │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
        │              │                │
        │              │                │
        ▼              ▼                ▼
   PostgreSQL      MongoDB            Kafka
   (Write Side)    (Read Models)   (Event Stream)
   Aggregates      Projections     Integration Events
   Outbox          Revisions       Retry Queue
                   Snapshots       DLQ

        │
        ├─ Redis
        │  ├─ Caching
        │  ├─ Pubsub (collaboration)
        │  ├─ Idempotency locks
        │  └─ Typing indicators
        │
        ├─ MinIO (S3)
        │  └─ File uploads
        │
        ├─ SMTP
        │  └─ Email verification
        │
        └─ Socket.IO Adapter (Redis)
           └─ Horizontal scale coordination
```

---

## Conclusion

This architecture embodies **enterprise-grade design patterns** with:

✅ **Maintainability**: Clear layering, hexagonal/DDD separation  
✅ **Scalability**: Stateless API, event-driven, horizontal scale-out  
✅ **Reliability**: Transactional outbox, idempotency guards, retry logic  
✅ **Performance**: CQRS read models, denormalized MongoDB, caching  
✅ **Real-time**: CRDT-based collaboration, WebSocket push  
✅ **Testability**: Isolated domain logic, mockable ports, E2E coverage  

The system prioritizes **correctness and consistency** while providing the **read performance and real-time experience** users expect from modern collaborative apps.
