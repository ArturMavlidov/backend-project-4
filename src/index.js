import originalAxios from 'axios'
import Listr from 'listr'
import { addLogger } from 'axios-debug-log'
import * as cheerio from 'cheerio'
import fs from 'fs/promises'
import path from 'path'

import { logger } from './logger.js'

const replaceUrl = (url = '') => {
  return url.replace(/https?:\/\//, '').replace(/[./]/g, '-')
}

const axios = originalAxios.create({
  timeout: 10000,
})
addLogger(axios)

const getFullSource = (protocol, domain, src) => {
  if (src?.[0] === '/') {
    return protocol + '//' + domain + src
  }

  return src
}

const getLinksFromHtmlElems = (htmlElems, type, pageUrl) => {
  const url = new URL(pageUrl)
  const protocol = url.protocol
  const domain = url.hostname

  return htmlElems
    .filter((_, el) => {
      const src = getFullSource(
        protocol,
        domain,
        el.attribs.src || el.attribs.href,
      )
      if (!src) return false

      console.log(src, 'recourseSrc')

      let resourceUrl = new URL(src)
      const resourceUrlDomain = resourceUrl.hostname

      return resourceUrlDomain === domain
    })
    .map((_, el) => {
      const src = getFullSource(
        protocol,
        domain,
        el.attribs.src || el.attribs.href,
      )
      return { src, type, element: el }
    })
    .toArray()
}

export const loadPage = ({ directoryPath = process.cwd(), pageUrl, timeout = 15000 }) => {
  const replacedUrl = replaceUrl(pageUrl)
  const fileName = replacedUrl + '.html'
  const filePath = path.join(directoryPath, fileName)

  return axios
    .get(pageUrl, { timeout })
    .then(({ data }) => data)
    .then((pageContent) => {
      const $ = cheerio.load(pageContent)

      const images = $('img')
      const links = $('link')
      const scripts = $('script')

      const imagesLinks = getLinksFromHtmlElems(images, 'image', pageUrl)
      const scriptsLinks = getLinksFromHtmlElems(scripts, 'script', pageUrl)
      const linksSources = getLinksFromHtmlElems(links, 'link', pageUrl)

      const resources = [...imagesLinks, ...scriptsLinks, ...linksSources]

      if (!resources.length) {
        logger('No resources')
        return fs.writeFile(filePath, pageContent).then(() => filePath)
      }

      const promises = resources.map((resource) => {
        const { src, type, element } = resource

        return {
          title: src,
          task: (ctx) => {
            return axios
              .get(src, { responseType: 'arraybuffer' })
              .then(({ data }) => {
                ctx.results.push({
                  resourceContent: data,
                  resourceLink: src,
                  resourceType: type,
                  resourceHtmlElement: element,
                })

                return data
              })
              .catch((err) => {
                console.error(
                  `Request to ${err.config.url || src} failed with code ${err.code}`,
                )

                throw err
              })
          },
        }
      })

      const context = { results: [] }
      const tasks = new Listr(promises, { concurrent: true })

      return tasks.run(context)
        .then((ctx) => {
          const resources = ctx.results
          const replacedUrl = replaceUrl(pageUrl)
          const filesDirectoryName = replacedUrl + '_files'
          const filesDirectoryPath = path.join(
            directoryPath,
            filesDirectoryName,
          )

          const data = {
            $,
            resources,
            filesDirectoryPath,
            filesDirectoryName,
            pageContent,
          }

          return fs
            .access(filesDirectoryPath)
            .then(() => data)
            .catch((err) => {
              if (err.code === 'EACCES' || err.code === 'EPERM') {
                throw new Error(`No access to ${directoryPath}`)
              }

              return fs
                .mkdir(filesDirectoryPath)
                .then(() => data)
                .catch((err) => {
                  if (err.code === 'ENOENT') {
                    throw new Error(`No such file or directory: ${directoryPath}`)
                  }

                  throw err
                })
            })
        })
        .then((data) => {
          const { $, resources, filesDirectoryPath, filesDirectoryName } = data

          const mapResourceTypeToHtml = {
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
              filesDirectoryPath,
              resourceFileName,
            )

            const attrib = mapResourceTypeToHtml[resourceType]

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

      throw err
    })
}

export default loadPage
