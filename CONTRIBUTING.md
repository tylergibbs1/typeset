# Contributing to Typeset

Thanks for your interest in contributing to Typeset.

## Getting Started

```bash
git clone https://github.com/tylergibbs1/typeset.git
cd typeset
bun install
docker compose up -d
bun scripts/seed.ts
```

## Development

Start the API in dev mode:

```bash
cd apps/api && bun run dev
```

Start the docs site:

```bash
cd apps/docs && npx next dev --port 3001
```

## Testing

Run all tests before submitting a PR:

```bash
bun test
```

For integration tests (requires a running API):

```bash
bun scripts/battle-test.ts
```

## Code Style

- TypeScript strict mode everywhere
- No `any` types unless absolutely necessary
- Prefer `const` over `let`
- Use Zod for runtime validation at system boundaries
- RFC 9457 for all error responses
- Tests go in `__tests__/` directories next to the code they test

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `bun test` to ensure all tests pass
5. Commit with a clear message
6. Open a PR against `main`

## Project Structure

| Directory | Description |
|-----------|-------------|
| `packages/engine` | Core rendering engine (MIT) |
| `packages/db` | Database schema (MIT) |
| `packages/sdk` | TypeScript SDK (MIT) |
| `apps/api` | Hono API server |
| `apps/worker` | Trigger.dev background tasks |
| `apps/cli` | CLI tool |
| `apps/docs` | Documentation site |
| `scripts/` | Test suites and seed scripts |

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Bun version, Node version)
