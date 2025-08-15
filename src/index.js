import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs/promises'
import path from 'path'

const replaceUrl = (url) => {
  return url.replace(/https:\/\//, '').replace(/[./]/g, '-')
}

export const loadPage = ({ directoryPath, pageUrl }) => {
  const url = new URL(pageUrl)
  const domain = url.hostname
  const replacedUrl = replaceUrl(pageUrl)
  const fileName = replacedUrl + '.html'
  const filePath = path.join(directoryPath, fileName)

  return axios
    .get(pageUrl)
    .then(({ data }) => data)
    .then((pageContent) => {
      const $ = cheerio.load(pageContent)

      const images = $('img')
      const imagesLinks = images
        .map((_, el) => {
          return el.attribs.src
        })
        .toArray()

      if (!imagesLinks.length) {
        return fs.writeFile(filePath, pageContent).then(() => filePath)
      }

      const promises = imagesLinks.map((image) => {
        return axios.get(image, { responseType: 'blob' }).then(({ data }) => {
          return { imageContent: data, imageName: image }
        })
      })

      return Promise.all(promises)
        .then((images) => {
          const replacedUrl = replaceUrl(pageUrl)
          const filesDirectoryName = replacedUrl + '_files'
          const filesDirectoryPath = path.join(
            directoryPath,
            filesDirectoryName,
          )

          const data = {
            images,
            filesDirectoryPath,
            filesDirectoryName,
            pageContent,
          }

          return fs
            .access(filesDirectoryPath)
            .then(() => data)
            .catch(() => fs.mkdir(filesDirectoryPath).then(() => data))
        })
        .then((data) => {
          const {
            images,
            filesDirectoryPath,
            filesDirectoryName,
            pageContent,
          } = data

          const $ = cheerio.load(pageContent)
          const htmlImages = $('img')

          const replacedDomain = replaceUrl(domain)

          const promises = images.map((image, idx) => {
            const { imageContent, imageName } = image
            const imageExtName = path.extname(imageName)
            const imageNameWithoutExtname = imageName.slice(
              0,
              imageName.length - imageExtName.length,
            )
            const imageFileName
              = replacedDomain
                + '-'
                + replaceUrl(imageNameWithoutExtname)
                + imageExtName
            const imageFilePath = path.join(filesDirectoryPath, imageFileName)

            htmlImages[idx].attribs.src
              = filesDirectoryName + '/' + replacedDomain + '-' + imageFileName

            return fs.writeFile(imageFilePath, imageContent)
          })

          return Promise.all(promises).then(() => $.html())
        })
        .then(html => fs.writeFile(filePath, html))
        .then(() => filePath)
    })
}
