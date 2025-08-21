#!/usr/bin/env node
import { Command } from 'commander'
import { loadPage } from '../src/index.js'

const program = new Command()

program
  .name('page-loader')
  .description('Page loader utility')
  .arguments('url')
  .option('-V, --version', 'output the version number')
  .option('-o --output [dir]', 'output dir', process.cwd())
  .action(() => {
    const [url] = program.args
    const directoryPath = program.opts().output

    loadPage({ directoryPath, pageUrl: url }).catch(() => {})
  })

program.parse()
