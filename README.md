# Typeset

Deterministic document pipelines. Render, verify, extract.

```
input data → template → render → verify → extract → loop
```

Typeset is a document computation engine. Every document generation is a pipeline run: deterministic, auditable, verifiable. The same input + template always produces the same output. The output is verified against the input via OCR. The verification result is stored alongside the output.

## Quick Start

```bash
# Clone and install
git clone https://github.com/tylergibbs1/typeset.git
cd typeset
bun install

# Set up local infrastructure
docker compose up -d  # Postgres + Redis
cp apps/api/.env.example apps/api/.env
# Fill in your keys in .env

# Push database schema
cd packages/db && bunx drizzle-kit push && cd ../..

# Seed a test API key
bun scripts/seed.ts

# Start the API
cd apps/api && bun run dev
```

Render your first PDF:

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer ts_test_full_localdev0000000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "<h1>Hello {{name}}</h1>",
    "data": {"name": "World"}
  }'
```

## Two Rendering Engines

### HTML (default)

Standard HTML/CSS templates rendered via Playwright + Chromium. Supports any web content.

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "<html><body><h1>{{title}}</h1><p>{{body}}</p></body></html>",
    "data": {"title": "Report", "body": "Content here"},
    "engine": "html"
  }'
```

### Typst

Native document markup compiled via the Typst binary. Tables break across pages with repeating headers automatically. No browser needed.

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "engine": "typst",
    "template": "#let data = json(\"data.json\")\n#set page(paper: \"a4\")\n= Invoice \\##data.invoiceNumber\n*Client:* #data.client\n#table(\n  columns: (1fr, auto),\n  table.header[*Item*][*Price*],\n  ..for item in data.items { (item.name, item.price) },\n)",
    "data": {
      "invoiceNumber": "001",
      "client": "Acme Corp",
      "items": [{"name": "Widget", "price": "$10"}, {"name": "Gadget", "price": "$25"}]
    }
  }'
```

| | HTML (Playwright) | Typst |
|---|---|---|
| Render time | ~500ms | ~500ms |
| PDF size | ~90KB | ~30KB |
| Dependencies | Chromium (~400MB) | Typst binary (~30MB) |
| Pagination | AI layout engine | Native |
| Template syntax | HTML/CSS + Handlebars | Typst markup |

## API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/render` | Sync render — returns signed URL |
| `POST` | `/v1/render/async` | Async render — returns run ID, processes via Trigger.dev |
| `GET` | `/v1/runs` | List pipeline runs with pagination |
| `GET` | `/v1/runs/:id` | Get a run with full lineage |
| `POST` | `/v1/extract` | Extract structured data from a document (Mistral OCR) |
| `POST` | `/v1/templates` | Save a template |
| `GET` | `/v1/templates` | List templates |
| `GET` | `/v1/templates/:id` | Get a template |
| `POST` | `/v1/template-from-doc` | Upload a document, get a template back |

### Authentication

```bash
Authorization: Bearer ts_test_full_<key>
```

Keys are SHA-256 hashed before storage. Scoped by permission (`render`, `extract`, `template`, `full`) and by environment (`ts_test_` vs `ts_live_`).

### Response Format

Every response is JSON. Every response includes:
- `X-Request-Id` header
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `Typeset-Version` header (date-based, Stripe model)

Errors follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details:

```json
{
  "type": "https://typeset.dev/errors/not-found",
  "title": "Not found",
  "status": 404,
  "detail": "Run run_abc123 not found",
  "instance": "req_xyz789"
}
```

### Idempotency

All `POST` endpoints accept `Idempotency-Key`. Same key returns the same response without re-executing.

## Architecture

```
typeset/
├── packages/
│   ├── engine/        # OSS core — Playwright + Typst rendering, AI layout, template injection
│   ├── db/            # Drizzle ORM schema + Supabase connection
│   └── sdk/           # @typeset/sdk — typed TypeScript client
├── apps/
│   ├── api/           # Hono + Bun API server
│   ├── worker/        # Trigger.dev background tasks (render, verify, webhook)
│   └── cli/           # typeset CLI
└── scripts/           # Seed, test suites
```

## Infrastructure

| Service | Provider |
|---------|----------|
| Database | Supabase (Postgres) |
| Cache | Upstash Redis |
| Storage | Cloudflare R2 |
| Background Jobs | Trigger.dev |
| AI Layout | OpenAI (GPT-5.4) |
| Document OCR | Mistral (mistral-ocr-latest) |

### Environment Variables

```bash
DATABASE_URL=postgresql://...          # Supabase pooler connection
UPSTASH_REDIS_REST_URL=https://...     # Upstash Redis REST
UPSTASH_REDIS_REST_TOKEN=...
R2_ACCOUNT_ID=...                      # Cloudflare R2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=typeset-docs
TRIGGER_SECRET_KEY=tr_dev_...          # Trigger.dev
OPENAI_API_KEY=sk-proj-...             # AI layout engine
MISTRAL_API_KEY=...                    # OCR verification + extraction
```

## AI Layout Engine

When `smartLayout: true` (default for HTML engine), templates are analyzed by GPT-5.4 to determine optimal page breaks, table splitting, and orphan/widow prevention. The AI returns structured layout decisions that are applied as CSS before rendering.

Falls back to heuristic-only mode when the API key is missing or the call fails. Never blocks rendering.

## Closed-Loop Verification

The core differentiator: render a document, OCR it with Mistral, compare every field against the input data.

```
render(template + data) → PDF → Mistral OCR → compare fields → score
```

Verification results are stored on the run:
- `verification.status`: `passed` | `failed` | `skipped`
- `verification.score`: 0-1 confidence
- `verification.issues`: `["Missing field: vendor_name"]`

## Testing

```bash
# Unit tests (179 tests)
bun test

# Integration tests (34 tests)
bun scripts/battle-test.ts

# Quality tests — content correctness, XSS, determinism (27 tests)
bun scripts/quality-test.ts

# Closed-loop OCR verification (6 tests)
MISTRAL_API_KEY=... bun scripts/closed-loop-test.ts

# Realistic document tests — invoices, offer letters, NDAs, financial reports (9 tests)
MISTRAL_API_KEY=... bun scripts/realistic-test.ts
```

## CLI

```bash
# Local render
typeset render template.html data.json -o output.pdf

# Typst render
typeset render template.typ data.json -o output.pdf --engine typst

# Remote render via API
typeset render template.html data.json --remote --api-key ts_live_...

# Extract from document
typeset extract invoice.pdf --schema schema.json

# Dev server with hot reload
typeset dev --port 3333

# List runs
typeset runs list --limit 10
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| API | Hono |
| Validation | Zod |
| Monorepo | Turborepo + Bun workspaces |
| Rendering (HTML) | Playwright |
| Rendering (Typst) | Typst CLI |
| AI Layout | Vercel AI SDK + OpenAI |
| Document OCR | Mistral SDK |
| Database | Drizzle ORM + Supabase |
| Cache | Upstash Redis |
| Storage | Cloudflare R2 |
| Background Jobs | Trigger.dev |
| Testing | bun:test |

## License

MIT (packages/engine, packages/db, packages/sdk, apps/cli)
