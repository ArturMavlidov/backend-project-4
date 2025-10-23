import Listr from 'listr'
import * as cheerio from 'cheerio'
import fs from 'fs/promises'
import path from 'path'
import { addLogger } from 'axios-debug-log'

import { getLinksFromHtmlElems, replaceUrl, downloadResource } from './helpers/index.js'
import { logger } from './logger.js'
import { axios } from './axiosInstance.js'

addLogger(axios)

export const loadPage = (pageUrl, outputDirname = process.cwd(), timeout = 15000) => {
  const replacedUrl = replaceUrl(pageUrl)
  const urlExtname = path.extname(pageUrl)
  const isUrlHtml = urlExtname === '.html'
  const fileName = replacedUrl + (isUrlHtml ? '' : '.html')
  const filePath = path.join(outputDirname, fileName)

  return fs
    .access(outputDirname)
    .catch((err) => {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new Error(`No access to ${outputDirname}`)
      }

      if (err.code === 'ENOENT') {
        throw new Error(`No such file or directory: ${outputDirname}`)
      }

      throw err
    })
    .then(() =>
      axios
        .get(pageUrl, { timeout })
        .then(({ data }) => data),
    )
    .then((pageContent) => {
      const $ = cheerio.load(pageContent)

      const images = $('img')
      const links = $('link')
      const scripts = $('script')

      const mapper = [
        { elems: images, type: 'image' },
        { elems: links, type: 'link' },
        { elems: scripts, type: 'script' },
      ]

      const resources = mapper
        .flatMap(({ elems, type }) => getLinksFromHtmlElems(elems, type, pageUrl))

      if (!resources.length) {
        logger('No resources')
        return fs.writeFile(filePath, pageContent).then(() => filePath)
      }

      const promises = resources.map((resource) => {
        const { src, type, element } = resource

        return {
          title: src,
          task: ctx => downloadResource(src, type, element, ctx),
        }
      })

      const context = { results: [] }
      const tasks = new Listr(promises, { concurrent: true })

      return tasks.run(context)
        .then((ctx) => {
          const resources = ctx.results
          const replacedUrl = replaceUrl(pageUrl)
          const filesDirectoryName = replacedUrl + '_files'
          const filesOutputDirname = path.join(
            outputDirname,
            filesDirectoryName,
          )

          const data = {
            $,
            resources,
            filesOutputDirname,
            filesDirectoryName,
            pageContent,
          }

          return fs
            .access(filesOutputDirname)
            .then(() => data)
            .catch((err) => {
              if (err.code === 'EACCES' || err.code === 'EPERM') {
                throw new Error(`No access to ${outputDirname}`)
              }

              return fs
                .mkdir(filesOutputDirname)
                .then(() => data)
                .catch((err) => {
                  if (err.code === 'ENOENT') {
                    throw new Error(`No such file or directory: ${outputDirname}`)
                  }

                  throw err
                })
            })
        })
        .then((data) => {
          const { $, resources, filesOutputDirname, filesDirectoryName } = data

          const mapResourceTypesToHtmlAttr = {
            image: 'src',
            script: 'src',
            link: 'href',
          }

          const promises = resources.map((resource) => {
            const {
              resourceContent,
              resourceLink,
              resourceType,
              resourceHtmlElement,
            } = resource

            const resourceExtName = path.extname(resourceLink)
            const resourceNameWithoutExtname = resourceLink.slice(
              0,
              resourceLink.length - resourceExtName.length,
            )

            let resourceFileName
                  = replaceUrl(resourceNameWithoutExtname) + resourceExtName

            const $element = $(resourceHtmlElement)

            if (
              resourceType === 'link'
              && $element.attr('rel') === 'canonical'
            ) {
              resourceFileName += '.html'
            }

            const recourceFilePath = path.join(
              filesOutputDirname,
              resourceFileName,
            )

            const attrib = mapResourceTypesToHtmlAttr[resourceType]

            $element.attr(attrib, `${filesDirectoryName}/${resourceFileName}`)

            return fs
              .writeFile(recourceFilePath, resourceContent)
              .catch(console.log)
          })

          return Promise.all(promises).then(() => $.html())
        })
        .then(html => fs.writeFile(filePath, html))
        .then(() => logger('Created file: ' + filePath))
        .then(() => filePath)
    })
    .catch((err) => {
      logger('Error:', err)

      if (err.code === 'ENOTFOUND') {
        console.error(`Page not found ${pageUrl}`)
      }

      if (err.code === 'ECONNABORTED') {
        console.error(`The page is not responding ${pageUrl}`)
      }

      console.error(`Error: ${err.message}`)

      throw err
    })
}

export default loadPage
