import type { ProblemDetails } from './types'

export class TypesetError extends Error {
  public readonly status: number
  public readonly type: string
  public readonly title: string
  public readonly detail: string
  public readonly instance: string
  public readonly errors?: Array<{ field: string; message: string; code: string }>

  constructor(problem: ProblemDetails) {
    super(problem.detail)
    this.name = 'TypesetError'
    this.status = problem.status
    this.type = problem.type
    this.title = problem.title
    this.detail = problem.detail
    this.instance = problem.instance
    this.errors = problem.errors
  }

  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }
}
