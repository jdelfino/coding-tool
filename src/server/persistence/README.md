# Persistence Layer

This directory contains the persistence layer for the coding tool. The architecture follows the **Repository Pattern** with well-defined interfaces that abstract storage implementation details.

## Architecture Goals

1. **Single source of truth** - All data operations go through repository interfaces
2. **Implementation agnostic** - Easy to swap storage backends (local files → remote API → database)
3. **Type-safe** - Strong TypeScript contracts prevent data inconsistencies
4. **Future-proof** - Async interfaces support both local and remote storage
5. **Clean separation** - No storage logic leaks into business logic

## Directory Structure

```
persistence/
├── interfaces.ts          # Repository interface definitions
├── types.ts              # Persistence-specific types
├── local-storage.ts      # Local file-based implementation (TODO)
├── session-repository.ts # Session operations implementation (TODO)
├── problem-repository.ts # Problem operations implementation (TODO)
├── revision-repository.ts # Revision operations implementation (TODO)
└── README.md            # This file
```

## Core Interfaces

### IStorageBackend
Base interface for all storage backends with lifecycle management:
- `initialize()` - Set up connections/resources
- `shutdown()` - Clean up gracefully
- `health()` - Check availability

### ISessionRepository
Manages coding session data:
- Create, read, update, delete sessions
- Query active sessions
- Search by join code
- Pagination support

### IProblemRepository
Manages problem specifications:
- Store and retrieve problems
- Search and filter by tags/difficulty
- Problem library management

### IRevisionRepository
Manages code revision history:
- Store student code snapshots
- Retrieve revision history
- Track chronological changes
- Support instructor review

## Key Types

### StorageConfig
Configuration for storage backends (type, credentials, caching options)

### PersistenceError
Custom error type with specific error codes (NOT_FOUND, ALREADY_EXISTS, etc.)

### StorageMetadata
Timestamps and versioning for stored items

### CodeRevision
Student code snapshot with execution results

### ProblemSpec
Problem definition with title, description, starter code, tags

## Usage Pattern

```typescript
// Future implementation example
import { ISessionRepository } from './persistence/interfaces';
import { LocalSessionRepository } from './persistence/local-storage';

// Create repository instance
const sessionRepo: ISessionRepository = new LocalSessionRepository({
  baseDir: './data/sessions'
});

// Initialize
await sessionRepo.initialize();

// Use repository
const session = await sessionRepo.getSession(sessionId);
if (session) {
  await sessionRepo.updateSession(sessionId, { active: false });
}

// Clean up
await sessionRepo.shutdown();
```

## Migration Path

### Phase 1: Interface Definition (COMPLETE)
✅ Define all interfaces and types
✅ Document expected behavior

### Phase 2: Local Implementation (TODO - coding-tool-uvn.2)
- Implement file-based storage for local development
- JSON files in `data/` directory
- In-memory caching for performance

### Phase 3: Integration (TODO - coding-tool-uvn.3)
- Migrate session-manager.ts to use repositories
- Update websocket-handler.ts
- Remove direct storage logic from business code

### Phase 4: Remote Backend (FUTURE)
- Implement REST API client as alternative backend
- No changes to calling code (interface stays the same)
- Configuration-based storage selection

## Design Decisions

### Why Promises everywhere?
Even though local file operations could be synchronous, we use Promises throughout to maintain consistency and enable future async backends (databases, APIs) without interface changes.

### Why null instead of throwing?
We return `null` for "not found" to distinguish between expected non-existence and actual errors. Only throw `PersistenceError` for real problems (connection failed, permission denied, etc.).

### Why Partial<T> for updates?
Using `Partial<T>` allows selective updates without requiring the entire object. This is more efficient and safer than replacing whole objects.

### Why separate metadata?
`StorageMetadata` is kept separate (with `_metadata` prefix) to avoid polluting domain objects and to make it easy to strip before sending to clients.

## Next Steps

1. Implement `LocalSessionRepository` extending `ISessionRepository`
2. Implement `LocalProblemRepository` extending `IProblemRepository`
3. Implement `LocalRevisionRepository` extending `IRevisionRepository`
4. Create factory function for repository instantiation
5. Migrate existing in-memory storage in `session-manager.ts`
6. Add comprehensive tests
