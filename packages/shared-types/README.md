# @ecards/shared-types

Shared TypeScript types for the E-Cards system.

## Purpose

Single source of truth for:
- Domain models (User, Template, Batch, etc.)
- API contracts (Request/Response types)
- Shared enumerations

## Structure

```
src/
├── domain/          # Domain models
│   ├── user.ts
│   ├── template.ts
│   ├── batch.ts
│   └── index.ts
├── api/             # API contracts
│   ├── requests.ts
│   ├── responses.ts
│   └── index.ts
└── index.ts         # Package entry
```

## Usage

### In TypeScript projects

```typescript
import type { Template, Batch, CreateTemplateRequest } from '@ecards/shared-types';
```

### Build

```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode
npm run clean        # Remove build artifacts
```

## Conventions

1. **Types, not Interfaces**: Use `type` for all definitions
2. **Explicit exports**: Export each type individually
3. **No business logic**: Pure type definitions only
4. **Immutable dates**: Use `Date` type (not string)
5. **Optional fields**: Use `?` for optional properties

## Adding New Types

1. Add type definition in appropriate domain file
2. Export from domain `index.ts`
3. Re-export from package `index.ts`
4. Run `npm run build`
5. Types are available to all consuming packages

## License

MIT
