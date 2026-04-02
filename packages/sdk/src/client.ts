import { TypesetError } from './errors'
import type {
  RenderRequest,
  RenderResponse,
  AsyncRenderRequest,
  AsyncRenderResponse,
  Run,
  ListRunsParams,
  PaginatedResponse,
  ExtractRequest,
  ExtractResponse,
  CreateTemplateRequest,
  Template,
  TemplateFromDocRequest,
  TemplateFromDocResponse,
  ProblemDetails,
} from './types'

export interface TypesetClientOptions {
  apiKey: string
  baseUrl?: string
  version?: string
}

export class TypesetClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly version: string

  constructor(opts: TypesetClientOptions) {
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? 'https://api.typeset.dev').replace(/\/$/, '')
    this.version = opts.version ?? '2026-04-01'
  }

  // ── Render ─────────────────────────────────────────

  async render(request: RenderRequest, opts?: { idempotencyKey?: string }): Promise<RenderResponse> {
    return this.post('/v1/render', request, opts?.idempotencyKey)
  }

  async renderAsync(request: AsyncRenderRequest, opts?: { idempotencyKey?: string }): Promise<AsyncRenderResponse> {
    return this.post('/v1/render/async', request, opts?.idempotencyKey)
  }

  // ── Runs ───────────────────────────────────────────

  async getRun(id: string): Promise<{ data: Run }> {
    return this.get(`/v1/runs/${id}`)
  }

  async listRuns(params?: ListRunsParams): Promise<PaginatedResponse<Run>> {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.cursor) search.set('cursor', params.cursor)
    if (params?.status) search.set('status', params.status)
    if (params?.template_id) search.set('template_id', params.template_id)
    const qs = search.toString()
    return this.get(`/v1/runs${qs ? `?${qs}` : ''}`)
  }

  async waitForRun(id: string, opts?: { pollIntervalMs?: number; timeoutMs?: number }): Promise<{ data: Run }> {
    const interval = opts?.pollIntervalMs ?? 1000
    const timeout = opts?.timeoutMs ?? 120_000
    const deadline = Date.now() + timeout

    while (Date.now() < deadline) {
      const result = await this.getRun(id)
      if (result.data.status === 'completed' || result.data.status === 'failed') {
        return result
      }
      await new Promise((r) => setTimeout(r, interval))
    }

    throw new Error(`Run ${id} did not complete within ${timeout}ms`)
  }

  // ── Extract ────────────────────────────────────────

  async extract(request: ExtractRequest): Promise<ExtractResponse> {
    return this.post('/v1/extract', request)
  }

  // ── Templates ──────────────────────────────────────

  async createTemplate(request: CreateTemplateRequest): Promise<{ data: { id: string; version: number; hash: string; createdAt: string } }> {
    return this.post('/v1/templates', request)
  }

  async listTemplates(params?: { limit?: number; cursor?: string }): Promise<PaginatedResponse<Pick<Template, 'id' | 'name' | 'version' | 'createdAt'>>> {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.cursor) search.set('cursor', params.cursor)
    const qs = search.toString()
    return this.get(`/v1/templates${qs ? `?${qs}` : ''}`)
  }

  async getTemplate(id: string): Promise<{ data: Template }> {
    return this.get(`/v1/templates/${id}`)
  }

  async templateFromDoc(request: TemplateFromDocRequest): Promise<TemplateFromDocResponse> {
    return this.post('/v1/template-from-doc', request)
  }

  // ── HTTP ───────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Typeset-Version': this.version,
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const problem = (await res.json()) as ProblemDetails
      throw new TypesetError(problem)
    }

    return res.json() as Promise<T>
  }

  private get<T>(path: string): Promise<T> {
    return this.request('GET', path)
  }

  private post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    return this.request('POST', path, body, idempotencyKey)
  }
}
