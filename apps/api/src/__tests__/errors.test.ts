import { describe, test, expect } from 'bun:test'
import { AppError } from '../lib/errors'

describe('AppError', () => {
  const makeError = () =>
    new AppError(
      404,
      'https://typeset.dev/errors/not-found',
      'Not Found',
      'The requested resource does not exist.'
    )

  test('extends Error', () => {
    const err = makeError()
    expect(err instanceof Error).toBe(true)
  })

  test('constructor sets message from detail', () => {
    const err = makeError()
    expect(err.message).toBe('The requested resource does not exist.')
  })

  test('constructor sets name to AppError', () => {
    const err = makeError()
    expect(err.name).toBe('AppError')
  })

  test('constructor sets status', () => {
    const err = makeError()
    expect(err.status).toBe(404)
  })

  test('constructor sets type', () => {
    const err = makeError()
    expect(err.type).toBe('https://typeset.dev/errors/not-found')
  })

  test('constructor sets title', () => {
    const err = makeError()
    expect(err.title).toBe('Not Found')
  })

  test('constructor sets detail', () => {
    const err = makeError()
    expect(err.detail).toBe('The requested resource does not exist.')
  })

  test('errors field is undefined when not provided', () => {
    const err = makeError()
    expect(err.errors).toBeUndefined()
  })

  test('constructor sets errors array when provided', () => {
    const errors = [{ field: 'email', message: 'must be valid', code: 'invalid_email' }]
    const err = new AppError(
      422,
      'https://typeset.dev/errors/validation',
      'Validation Error',
      'Invalid input.',
      errors
    )
    expect(err.errors).toEqual(errors)
  })

  test('can be caught as an Error', () => {
    let caught: unknown
    try {
      throw makeError()
    } catch (e) {
      caught = e
    }
    expect(caught instanceof Error).toBe(true)
    expect((caught as AppError).status).toBe(404)
  })
})
