<h1 align="center"><code>typeset</code></h1>

<p align="center">
  Deterministic document pipelines. Render, verify, extract.
</p>

<div align="center">
  <a href="https://github.com/tylergibbs1/typeset/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/tylergibbs1/typeset" alt="License">
  </a>
  <a href="https://github.com/tylergibbs1/typeset/stargazers">
    <img src="https://img.shields.io/github/stars/tylergibbs1/typeset?style=social" alt="Stars">
  </a>
</div>

---

**Typeset** turns a template plus JSON data into a PDF, then checks the PDF against the data with OCR. It is for teams generating invoices, contracts, and reports who need the same input to always produce the same, verifiable output. Open source and available as a hosted service.

## Quick Start

These examples call the hosted API. To run everything on your machine instead, see [Self-Hosting](#self-hosting).

### Render a PDF

```bash
curl -X POST https://api.typeset.dev/v1/render \
  -H "Authorization: Bearer ts_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "<h1>Invoice #{{number}}</h1><p>Total: {{total}}</p>",
    "data": {"number": "INV-001", "total": "$1,250.00"}
  }'
```

<details>
<summary><b>TypeScript SDK</b></summary>

```typescript
import { TypesetClient } from '@typeset/sdk';

const typeset = new TypesetClient({ apiKey: 'ts_live_YOUR_KEY' });

const result = await typeset.render({
  template: '<h1>Invoice #{{number}}</h1><p>Total: {{total}}</p>',
  data: { number: 'INV-001', total: '$1,250.00' },
});

console.log(result.data.url);        // signed PDF URL
console.log(result.data.metadata);   // { pages: 1, sizeBytes: 74659, renderTimeMs: 516 }
```

</details>

<details>
<summary><b>Typst Engine</b></summary>

```bash
curl -X POST https://api.typeset.dev/v1/render \
  -H "Authorization: Bearer ts_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "engine": "typst",
    "template": "#let data = json(\"data.json\")\n= Invoice \\##data.number\nTotal: #data.total",
    "data": {"number": "INV-001", "total": "$1,250.00"}
  }'
```

</details>

<details>
<summary><b>CLI</b></summary>

```bash
# Local render
typeset render template.html data.json -o invoice.pdf

# Remote render via API
typeset render template.html data.json --remote --api-key ts_live_...
```

</details>

### Extract structured data

```bash
curl -X POST https://api.typeset.dev/v1/extract \
  -H "Authorization: Bearer ts_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "document": {"type": "url", "url": "https://example.com/invoice.pdf"}
  }'
```

### Verify a render

```bash
curl -X POST https://api.typeset.dev/v1/render \
  -H "Authorization: Bearer ts_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "<h1>{{company}}</h1><p>Total: {{total}}</p>",
    "data": {"company": "Acme Corp", "total": "$5,000"},
    "options": {"verify": true}
  }'
```

Response includes verification:

```json
{
  "verification": {
    "status": "passed",
    "score": 1.0,
    "issues": []
  }
}
```

## How It Works

Every document generation is a pipeline run: deterministic, auditable, verifiable. The same input + template always produces the same output, and the output is verified against the input via OCR.

```
input data → template → render → verify → extract → loop
```

Each run records the template hash, data hash, verification result, and a signed URL for the PDF, so you can trace any document back to what produced it.

## Features

- **Two rendering engines**: HTML (Playwright) for web-native templates, Typst for native pagination and 3x smaller PDFs
- **AI layout intelligence**: GPT-5.4 analyzes your template and optimizes page breaks, table splitting, orphan/widow prevention
- **Closed-loop verification**: Render a PDF, OCR it with Mistral, compare every field against input data — store the score
- **Full lineage**: Every render creates a run with template hash, data hash, verification result, and signed URL
- **Deterministic**: Same input + template = same output. Always.
- **Structured extraction**: Pull data from any document with schema-driven OCR
- **Open source**: Engine, SDK, CLI, and database schema are MIT-licensed

**Core Endpoints**

| Feature | Description |
|---------|-------------|
| [**Render**](#render-a-pdf) | HTML or Typst template + data → PDF with AI layout optimization |
| [**Verify**](#verify-a-render) | OCR a rendered PDF and compare every field against the input |
| [**Extract**](#extract-structured-data) | Pull structured data from any document via Mistral OCR |

**More**

| Feature | Description |
|---------|-------------|
| **Async Render** | Queue long-running renders with webhook delivery |
| **Templates** | Save, version, and reuse templates with content hashing |
| **Template from Doc** | Upload a PDF, get an HTML or Typst template back |
| **Idempotency** | Same `Idempotency-Key` returns the same response without re-rendering |
| **Run Lineage** | Full audit trail — what input produced this PDF, when, with what result |

## Self-Hosting

Typeset is fully self-hostable. You own your data, your templates, and your rendered documents.

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- Docker (for local Postgres)
- Playwright Chromium (installed automatically)
- Typst binary (optional, for Typst engine)

### Local mode (no external services)

The fastest way to try it. Uses SQLite (`typeset.db`), an in-memory store for rate limits and idempotency, and local file storage under `.storage/`. It seeds an org and the API key `ts_test_full_localdev0000000000000000` on first run.

```bash
git clone https://github.com/tylergibbs1/typeset.git
cd typeset
bun install
cd apps/api && bun run dev:local
```

Then call `http://localhost:3000/v1/render` with that key. Set `OPENAI_API_KEY` and `MISTRAL_API_KEY` to enable AI layout and OCR verification.

### Full setup

```bash
git clone https://github.com/tylergibbs1/typeset.git
cd typeset
bun install

# Start Postgres + Redis
docker compose up -d

# Configure
cp apps/api/.env.example apps/api/.env
# Edit .env with your keys

# Push database schema
cd packages/db && bunx drizzle-kit push && cd ../..

# Seed test API key
bun scripts/seed.ts

# Start
cd apps/api && bun run dev
```

### Required services

| Service | Required | Options |
|---------|----------|---------|
| PostgreSQL | Yes | Docker, Supabase, Neon, RDS (`DATABASE_URL`) |
| Redis | Yes | Upstash Redis REST API (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) |
| Object Storage | Optional | Cloudflare R2 (`R2_*`); falls back to local `.storage/` when `R2_ACCESS_KEY_ID` is unset |
| Trigger.dev | Optional | For async render, verify, and webhooks (`TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`) |
| OpenAI API | Optional | For AI layout engine (`OPENAI_API_KEY`) |
| Mistral API | Optional | For OCR verification + extraction (`MISTRAL_API_KEY`) |

See [`apps/api/.env.example`](apps/api/.env.example) for the full list.

### Docker

```bash
docker build -t typeset-api -f apps/api/Dockerfile .
docker run -p 3000:3000 --env-file apps/api/.env typeset-api
```

## Architecture

```
typeset/
├── packages/
│   ├── engine/        # OSS core — dual rendering (Playwright + Typst), AI layout, template injection
│   ├── db/            # Drizzle ORM schema + connection
│   └── sdk/           # @typeset/sdk — typed TypeScript client
├── apps/
│   ├── api/           # Hono + Bun API server
│   ├── worker/        # Trigger.dev background tasks (render, verify, webhook)
│   └── cli/           # typeset CLI
└── scripts/           # Seed, test suites
```

### Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| API Framework | Hono |
| Rendering (HTML) | Playwright + Chromium |
| Rendering (Typst) | Typst CLI |
| AI Layout | OpenAI GPT-5.4 via Vercel AI SDK |
| Document OCR | Mistral (`mistral-ocr-latest`) |
| Database | Drizzle ORM + PostgreSQL |
| Cache | Upstash Redis |
| Storage | Cloudflare R2 |
| Background Jobs | Trigger.dev |
| Validation | Zod |
| Testing | bun:test |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/render` | Sync render — returns signed URL |
| `POST` | `/v1/render/async` | Async render — queues via Trigger.dev |
| `GET` | `/v1/runs` | List pipeline runs |
| `GET` | `/v1/runs/:id` | Get run with full lineage |
| `POST` | `/v1/extract` | Extract structured data via OCR |
| `POST` | `/v1/templates` | Save a template |
| `GET` | `/v1/templates` | List templates |
| `GET` | `/v1/templates/:id` | Get a template |
| `POST` | `/v1/template-from-doc` | Generate template from existing document |

All responses follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) error format. Every response includes `X-Request-Id`, rate limit headers, and `Typeset-Version`.

## Testing

```bash
# Unit tests (179 tests)
bun test

# Integration tests — API contracts (34 tests)
bun scripts/battle-test.ts

# Quality tests — content correctness, XSS prevention, determinism (27 tests)
bun scripts/quality-test.ts

# Closed-loop OCR verification (6 tests)
MISTRAL_API_KEY=... bun scripts/closed-loop-test.ts

# Realistic document tests — invoices, offer letters, NDAs, financial reports (9 tests)
MISTRAL_API_KEY=... bun scripts/realistic-test.ts
```

## Contributing

We welcome contributions. See our [contributing guide](CONTRIBUTING.md) for details.

**Development setup:**

```bash
git clone https://github.com/tylergibbs1/typeset.git
cd typeset
bun install
docker compose up -d
bun scripts/seed.ts
cd apps/api && bun run dev
```

Run tests before submitting:

```bash
bun test
```

## License

The Typeset engine, SDK, CLI, and database schema are licensed under [MIT](LICENSE).

The hosted API and worker are source-available for inspection.

---

<p align="center">
  <sub>Built with ink and intention.</sub>
</p>
