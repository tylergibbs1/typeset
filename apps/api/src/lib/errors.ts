import type { Context } from 'hono'

interface ProblemDetails {
  type: string
  title: string
  detail: string
  errors?: Array<{ field: string; message: string; code: string }>
}

export function problemDetails(c: Context, status: number, problem: ProblemDetails) {
  return c.json(
    {
      type: problem.type,
      title: problem.title,
      status,
      detail: problem.detail,
      instance: c.get('requestId') as string,
      ...(problem.errors ? { errors: problem.errors } : {}),
    },
    status as any
  )
}

export class AppError extends Error {
  constructor(
    public status: number,
    public type: string,
    public title: string,
    public detail: string,
    public errors?: Array<{ field: string; message: string; code: string }>
  ) {
    super(detail)
    this.name = 'AppError'
  }
}
