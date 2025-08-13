import os from 'os'
import path from 'path'
import fs from 'fs/promises'

import { loadPage } from '../src/index'

let directoryPath

beforeEach(async () => {
  const tmpDir = os.tmpdir()

  await fs
    .mkdtemp(`${tmpDir}${path.sep}`)
    .then(folder => (directoryPath = folder))
})

test('loadPage result', async () => {
  const filePath = await loadPage({
    directoryPath,
    pageUrl: 'https://ru.hexlet.io/courses',
  })

  expect(filePath).toBe(`${directoryPath}/ru-hexlet-io-courses.html`)
})
