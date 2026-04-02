export type EngineType = 'html' | 'typst'

const TYPST_PATTERN = /^#(set|let|import|show|page|table)\b|#\w+\(/m

/**
 * Detect the rendering engine from template content.
 * Typst templates use directives like `#set`, `#let`, `#import`, etc.
 */
export function detectEngine(template: string): EngineType {
  return TYPST_PATTERN.test(template) ? 'typst' : 'html'
}
