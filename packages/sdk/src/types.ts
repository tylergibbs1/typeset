// ── Render ─────────────────────────────────────────────

export type PageSize = 'a4' | 'letter' | 'legal'
export type Orientation = 'portrait' | 'landscape'
export type Format = 'pdf' | 'docx' | 'html'
export type Engine = 'html' | 'typst'

export interface RenderOptions {
  pageSize?: PageSize
  orientation?: Orientation
  margin?: { top?: string; right?: string; bottom?: string; left?: string }
  locale?: string
  smartLayout?: boolean
  verify?: boolean
}

export interface RenderRequest {
  template: string
  data?: Record<string, unknown>
  format?: Format
  engine?: Engine
  options?: RenderOptions
}

export interface AsyncRenderRequest extends RenderRequest {
  webhook?: {
    url: string
    headers?: Record<string, string>
    secret?: string
  }
}

export interface RenderResponse {
  data: {
    runId: string
    url: string
    expiresAt: string
    verification: {
      status: 'passed' | 'failed' | 'skipped'
      score: number
      issues: string[]
    }
    metadata: {
      pages: number
      sizeBytes: number
      renderTimeMs: number
      templateHash: string
      dataHash: string
    }
  }
}

export interface AsyncRenderResponse {
  data: {
    runId: string
    status: 'queued'
    estimatedSeconds: number
    links: {
      self: string
      cancel: string
    }
  }
}

// ── Runs ───────────────────────────────────────────────

export type RunStatus = 'queued' | 'rendering' | 'verifying' | 'completed' | 'failed'

export interface Run {
  id: string
  orgId: string
  status: RunStatus
  engine: Engine
  templateId?: string
  templateHash: string
  dataHash: string
  format: Format
  storageKey?: string
  pages?: number
  sizeBytes?: number
  renderTimeMs?: number
  verificationStatus?: 'passed' | 'failed' | 'skipped'
  verificationScore?: string
  verificationIssues?: string[]
  errorType?: string
  errorDetail?: string
  createdAt: string
  completedAt?: string
}

export interface ListRunsParams {
  limit?: number
  cursor?: string
  status?: RunStatus
  template_id?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    cursor: string | null
    hasMore: boolean
  }
}

// ── Extract ────────────────────────────────────────────

export interface ExtractRequest {
  document: {
    type: 'url' | 'base64'
    url?: string
    data?: string
    mimeType?: string
  }
  schema?: Record<string, unknown>
  options?: {
    tableFormat?: 'markdown' | 'html' | null
    extractHeaders?: boolean
    extractFooters?: boolean
    pages?: number[]
  }
}

export interface ExtractResponse {
  data: {
    pages: Array<{
      index: number
      markdown: string
      images: Array<{ id: string; bbox: object; base64?: string }>
      tables: Array<{ id: string; content: string; format: string }>
    }>
    annotation?: Record<string, unknown>
    usage: { pagesProcessed: number; docSizeBytes: number }
  }
}

// ── Templates ──────────────────────────────────────────

export interface CreateTemplateRequest {
  name: string
  content: string
  description?: string
}

export interface Template {
  id: string
  name: string
  content: string
  contentHash: string
  description?: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface TemplateFromDocRequest {
  document: {
    type: 'url' | 'base64'
    url?: string
    data?: string
    mimeType?: string
  }
}

export interface TemplateFromDocResponse {
  data: {
    template: string
    detectedFields: Array<{
      name: string
      type: 'text' | 'number' | 'date' | 'currency' | 'list'
      sampleValue: string
    }>
  }
}

// ── Errors ─────────────────────────────────────────────

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  errors?: Array<{ field: string; message: string; code: string }>
}
