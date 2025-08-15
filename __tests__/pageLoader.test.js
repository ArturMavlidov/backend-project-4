import nock from 'nock'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import * as cheerio from 'cheerio'

import { loadPage } from '../src/index'
import { getFixtureContent } from '../src/helpers/index'

const pageUrl = 'https://ru.hexlet.io/courses'
let directoryPath

beforeAll(() => {
  // nock.disableNetConnect()

  const html = getFixtureContent('courses.html')

  nock('https://ru.hexlet.io').get('/courses').reply(200, html).persist()
})

beforeEach(async () => {
  const tmpDir = os.tmpdir()

  await fs
    .mkdtemp(`${tmpDir}${path.sep}`)
    .then(folder => (directoryPath = folder))
})

test('loadPage result', async () => {
  const filePath = await loadPage({
    directoryPath,
    pageUrl,
  })

  expect(filePath).toBe(`${directoryPath}/ru-hexlet-io-courses.html`)
})

test('loadPage html img src', async () => {
  const filePath = await loadPage({
    directoryPath,
    pageUrl,
  })

  const html = await fs.readFile(filePath, 'utf-8')
  const $ = cheerio.load(html)

  expect($('img').attr('src')).toBe('ru-hexlet-io-courses_files/ru-hexlet-io-ru-hexlet-io-habrastorage-org-webt-ox--u-os-ox-uosc_ucrfqq2ysvuxitfkqrw.png')
})
