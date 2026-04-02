import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { RenderOptions, RenderResult } from '../types'

const TYPST_BIN = process.env.TYPST_BIN ?? 'typst'

export async function renderTypst(
  template: string,
  data: Record<string, unknown>,
  options: RenderOptions
): Promise<RenderResult> {
  const start = performance.now()
  const workDir = await mkdtemp(join(tmpdir(), 'typeset-'))

  try {
    await Promise.all([
      Bun.write(join(workDir, 'template.typ'), template),
      Bun.write(join(workDir, 'data.json'), JSON.stringify(data)),
    ])

    const outputPath = join(workDir, 'output.pdf')

    const args = [
      TYPST_BIN,
      'compile',
      join(workDir, 'template.typ'),
      outputPath,
      '--input',
      `page-size=${options.pageSize ?? 'a4'}`,
      '--input',
      `orientation=${options.orientation ?? 'portrait'}`,
    ]

    const proc = Bun.spawn(args, {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(`Typst compilation failed (exit ${exitCode}): ${stderr}`)
    }

    const pdfFile = Bun.file(outputPath)
    const buffer = new Uint8Array(await pdfFile.arrayBuffer())
    const renderTimeMs = Math.round(performance.now() - start)

    // Count pages by matching PDF page object markers
    const pdfText = new TextDecoder('latin1').decode(buffer)
    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g)
    const pages = pageMatches ? pageMatches.length : 1

    return { buffer, pages, renderTimeMs }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
