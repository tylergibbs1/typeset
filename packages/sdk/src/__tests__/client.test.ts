import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { TypesetClient } from '../client'
import { TypesetError } from '../errors'
import type { ProblemDetails } from '../types'

// ── TypesetError ─────────────────────────────────────────────────────────────

describe('TypesetError', () => {
  const problem: ProblemDetails = {
    type: 'https://typeset.dev/errors/validation',
    title: 'Validation Error',
    status: 422,
    detail: 'The request body is invalid.',
    instance: 'req_abc123',
    errors: [{ field: 'template', message: 'required', code: 'required' }],
  }

  test('constructor sets message from detail', () => {
    const err = new TypesetError(problem)
    expect(err.message).toBe('The request body is invalid.')
  })

  test('constructor sets name to TypesetError', () => {
    const err = new TypesetError(problem)
    expect(err.name).toBe('TypesetError')
  })

  test('constructor sets status', () => {
    const err = new TypesetError(problem)
    expect(err.status).toBe(422)
  })

  test('constructor sets type', () => {
    const err = new TypesetError(problem)
    expect(err.type).toBe('https://typeset.dev/errors/validation')
  })

  test('constructor sets title', () => {
    const err = new TypesetError(problem)
    expect(err.title).toBe('Validation Error')
  })

  test('constructor sets detail', () => {
    const err = new TypesetError(problem)
    expect(err.detail).toBe('The request body is invalid.')
  })

  test('constructor sets instance', () => {
    const err = new TypesetError(problem)
    expect(err.instance).toBe('req_abc123')
  })

  test('constructor sets errors array', () => {
    const err = new TypesetError(problem)
    expect(err.errors).toEqual([{ field: 'template', message: 'required', code: 'required' }])
  })

  test('is an instance of Error', () => {
    const err = new TypesetError(problem)
    expect(err instanceof Error).toBe(true)
  })

  test('isRetryable is false for 422', () => {
    const err = new TypesetError({ ...problem, status: 422 })
    expect(err.isRetryable).toBe(false)
  })

  test('isRetryable is true for 429', () => {
    const err = new TypesetError({ ...problem, status: 429 })
    expect(err.isRetryable).toBe(true)
  })

  test('isRetryable is true for 500', () => {
    const err = new TypesetError({ ...problem, status: 500 })
    expect(err.isRetryable).toBe(true)
  })

  test('isRetryable is true for 503', () => {
    const err = new TypesetError({ ...problem, status: 503 })
    expect(err.isRetryable).toBe(true)
  })

  test('isRateLimited is true for 429', () => {
    const err = new TypesetError({ ...problem, status: 429 })
    expect(err.isRateLimited).toBe(true)
  })

  test('isRateLimited is false for 500', () => {
    const err = new TypesetError({ ...problem, status: 500 })
    expect(err.isRateLimited).toBe(false)
  })

  test('isRateLimited is false for 422', () => {
    const err = new TypesetError({ ...problem, status: 422 })
    expect(err.isRateLimited).toBe(false)
  })
})

// ── TypesetClient ─────────────────────────────────────────────────────────────

describe('TypesetClient', () => {
  describe('constructor defaults', () => {
    test('uses https://api.typeset.dev as default baseUrl', () => {
      const client = new TypesetClient({ apiKey: 'test-key' })
      // Access private field via cast to verify default
      expect((client as any).baseUrl).toBe('https://api.typeset.dev')
    })

    test('strips trailing slash from baseUrl', () => {
      const client = new TypesetClient({ apiKey: 'test-key', baseUrl: 'https://example.com/' })
      expect((client as any).baseUrl).toBe('https://example.com')
    })

    test('uses provided baseUrl', () => {
      const client = new TypesetClient({ apiKey: 'test-key', baseUrl: 'https://custom.example.com' })
      expect((client as any).baseUrl).toBe('https://custom.example.com')
    })

    test('uses 2026-04-01 as default version', () => {
      const client = new TypesetClient({ apiKey: 'test-key' })
      expect((client as any).version).toBe('2026-04-01')
    })

    test('uses provided version', () => {
      const client = new TypesetClient({ apiKey: 'test-key', version: '2025-01-01' })
      expect((client as any).version).toBe('2025-01-01')
    })

    test('stores the apiKey', () => {
      const client = new TypesetClient({ apiKey: 'my-api-key' })
      expect((client as any).apiKey).toBe('my-api-key')
    })
  })

  describe('render() — request headers', () => {
    let capturedRequest: Request | undefined

    beforeEach(() => {
      capturedRequest = undefined
      // Mock global fetch to capture the request and return a success response
      globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedRequest = new Request(input, init)
        return new Response(
          JSON.stringify({ data: { url: 'https://example.com/doc.pdf', runId: 'run_abc' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })
    })

    test('sends Authorization header with Bearer token', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test-123' })
      await client.render({ template: '<p>hello</p>' })
      expect(capturedRequest?.headers.get('Authorization')).toBe('Bearer sk-test-123')
    })

    test('sends Content-Type: application/json header', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test' })
      await client.render({ template: '<p>hello</p>' })
      expect(capturedRequest?.headers.get('Content-Type')).toBe('application/json')
    })

    test('sends Typeset-Version header with default version', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test' })
      await client.render({ template: '<p>hello</p>' })
      expect(capturedRequest?.headers.get('Typeset-Version')).toBe('2026-04-01')
    })

    test('sends Typeset-Version header with custom version', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test', version: '2025-06-01' })
      await client.render({ template: '<p>hello</p>' })
      expect(capturedRequest?.headers.get('Typeset-Version')).toBe('2025-06-01')
    })

    test('does not send Idempotency-Key header when not provided', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test' })
      await client.render({ template: '<p>hello</p>' })
      expect(capturedRequest?.headers.get('Idempotency-Key')).toBeNull()
    })

    test('sends Idempotency-Key header when provided', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test' })
      await client.render({ template: '<p>hello</p>' }, { idempotencyKey: 'idem-key-xyz' })
      expect(capturedRequest?.headers.get('Idempotency-Key')).toBe('idem-key-xyz')
    })

    test('sends POST to /v1/render', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test' })
      await client.render({ template: '<p>hello</p>' })
      expect(capturedRequest?.method).toBe('POST')
      expect(capturedRequest?.url).toContain('/v1/render')
    })

    test('sends request body as JSON', async () => {
      const client = new TypesetClient({ apiKey: 'sk-test' })
      await client.render({ template: '<p>hello</p>' })
      const body = await capturedRequest?.json()
      expect(body).toEqual({ template: '<p>hello</p>' })
    })
  })

  describe('render() — error handling', () => {
    test('throws TypesetError on non-ok response', async () => {
      const problemPayload: ProblemDetails = {
        type: 'https://typeset.dev/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid API key.',
        instance: 'req_xyz',
      }

      globalThis.fetch = mock(async () =>
        new Response(JSON.stringify(problemPayload), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const client = new TypesetClient({ apiKey: 'bad-key' })
      let thrown: unknown
      try {
        await client.render({ template: '<p>hello</p>' })
      } catch (e) {
        thrown = e
      }

      expect(thrown instanceof TypesetError).toBe(true)
      const err = thrown as TypesetError
      expect(err.status).toBe(401)
      expect(err.title).toBe('Unauthorized')
      expect(err.detail).toBe('Invalid API key.')
    })

    test('thrown TypesetError has correct instance field', async () => {
      const problemPayload: ProblemDetails = {
        type: 'https://typeset.dev/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Template not found.',
        instance: 'req_999',
      }

      globalThis.fetch = mock(async () =>
        new Response(JSON.stringify(problemPayload), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const client = new TypesetClient({ apiKey: 'sk-test' })
      let thrown: unknown
      try {
        await client.render({ template: '<p>test</p>' })
      } catch (e) {
        thrown = e
      }

      const err = thrown as TypesetError
      expect(err.instance).toBe('req_999')
    })
  })
})
