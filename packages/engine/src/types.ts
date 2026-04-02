export type PageSize = 'a4' | 'letter' | 'legal'
export type Orientation = 'portrait' | 'landscape'

export interface Margins {
  top: string
  right: string
  bottom: string
  left: string
}

export interface RenderOptions {
  pageSize: PageSize
  orientation: Orientation
  margin: Margins
  locale?: string
  smartLayout?: boolean
}

export interface RenderResult {
  buffer: Uint8Array
  pages: number
  renderTimeMs: number
}

export const PAGE_DIMENSIONS: Record<PageSize, { width: string; height: string }> = {
  a4: { width: '210mm', height: '297mm' },
  letter: { width: '8.5in', height: '11in' },
  legal: { width: '8.5in', height: '14in' },
}
