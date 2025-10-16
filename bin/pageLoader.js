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

    loadPage(url, directoryPath)
      .catch((error) => {
        if (error.code === 'ENOTFOUND') {
          console.error(`Page not found ${url}`)
          process.exit(1)
        }

        if (error.code === 'ECONNABORTED') {
          console.error(`The page is not responding ${url}`)
          process.exit(1)
        }

        console.error(`Error: ${error.message}`)
        process.exit(1)
      })
  })

program.parse()
