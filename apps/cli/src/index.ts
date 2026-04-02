#!/usr/bin/env bun
import { Command } from 'commander'
import { renderCommand } from './commands/render'
import { extractCommand } from './commands/extract'
import { runsCommand } from './commands/runs'
import { devCommand } from './commands/dev'

const program = new Command()

program
  .name('typeset')
  .description('Typeset — Deterministic document pipelines')
  .version('0.0.1')

program.addCommand(renderCommand)
program.addCommand(extractCommand)
program.addCommand(runsCommand)
program.addCommand(devCommand)

program.parse()
