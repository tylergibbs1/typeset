const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export function nanoid(size = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  let id = ''
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length]
  }
  return id
}

export function runId(): string {
  return `run_${nanoid()}`
}

export function templateId(): string {
  return `tpl_${nanoid()}`
}
