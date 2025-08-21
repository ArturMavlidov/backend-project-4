import nock from "nock";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { format } from "prettier";

import { loadPage } from "../src/index";
import { getFixtureContent } from "../src/helpers/index";

const pageUrl = "https://ru.hexlet.io/courses";
let directoryPath;

beforeAll(async () => {
  nock.disableNetConnect();

  const html = await getFixtureContent("courses.html");

  nock("https://ru.hexlet.io").get(/[^/courses]/).reply(200, "").persist();
  nock("https://ru.hexlet.io").get("/courses").reply(200, html).persist();
  nock('https://non-exists')
    .get('/')
    .replyWithError(Object.assign(new Error('error'), { code: 'ENOTFOUND' }))
    .persist();
});

beforeEach(async () => {
  const tmpDir = os.tmpdir();

  await fs
    .mkdtemp(`${tmpDir}${path.sep}`)
    .then((folder) => (directoryPath = folder));
});

test("loadPage result", async () => {
  const filePath = await loadPage({
    directoryPath,
    pageUrl,
  });

  expect(filePath).toBe(`${directoryPath}/ru-hexlet-io-courses.html`);
});

test("loadPage html content", async () => {
  const filePath = await loadPage({
    directoryPath,
    pageUrl,
  });

  const [html, expectedHtml] = await Promise.all([
    fs.readFile(filePath, "utf-8"),
    getFixtureContent("courses_result.html"),
  ]);

  const [prettifiedHtml, prettifiedExpectedHtml] = await Promise.all([
    format(html, { parser: "html" }),
    format(expectedHtml, { parser: "html" }),
  ]);

  expect(prettifiedHtml).toBe(prettifiedExpectedHtml);
});

test("loadPage non-existent page", async () => {
  try {
    await loadPage({
      directoryPath,
      pageUrl: "https://non-exists"
    });

    throw new Error('Expected function to throw');
  } catch (error) {
    expect(error.code).toBe('ENOTFOUND');
  }
});