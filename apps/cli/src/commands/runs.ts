import { Command } from 'commander'
import { getClient } from '../lib/client'

export const runsCommand = new Command('runs')
  .description('List and inspect pipeline runs')

runsCommand
  .command('list')
  .description('List recent runs')
  .option('--limit <n>', 'Number of runs to show', '10')
  .option('--status <status>', 'Filter by status')
  .action(async (opts) => {
    try {
      const client = getClient()
      const result = await client.listRuns({
        limit: parseInt(opts.limit),
        status: opts.status,
      })

      if (result.data.length === 0) {
        console.log('No runs found.')
        return
      }

      console.log(`${'ID'.padEnd(22)} ${'Status'.padEnd(12)} ${'Pages'.padEnd(6)} ${'Time'.padEnd(8)} Created`)
      console.log('-'.repeat(80))

      for (const run of result.data) {
        console.log(
          `${run.id.padEnd(22)} ${run.status.padEnd(12)} ${String(run.pages ?? '-').padEnd(6)} ${String(run.renderTimeMs ? `${run.renderTimeMs}ms` : '-').padEnd(8)} ${run.createdAt}`
        )
      }

      if (result.pagination.hasMore) {
        console.log(`\n... more runs available (cursor: ${result.pagination.cursor})`)
      }
    } catch (err) {
      console.error('Failed to list runs:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
  })

runsCommand
  .command('get <id>')
  .description('Get details of a specific run')
  .action(async (id: string) => {
    try {
      const client = getClient()
      const result = await client.getRun(id)
      console.log(JSON.stringify(result.data, null, 2))
    } catch (err) {
      console.error('Failed to get run:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
  })
