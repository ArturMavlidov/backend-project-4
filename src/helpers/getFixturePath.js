import path from 'path'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'

export const getFixturePath = filename => path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
  '__fixtures__',
  filename,
)

export const getFixtureContent = (filename) => {
  const file = getFixturePath(filename)

  return readFile(file, {
    encoding: 'utf-8',
  })
}

export default getFixturePath
