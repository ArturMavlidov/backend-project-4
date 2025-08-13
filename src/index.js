import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'

const getFileNameFromUrl = (url) => {
  return url.replace(/https:\/\//, '').replace(/[./]/g, '-') + '.html'
}

export const loadPage = ({ directoryPath, pageUrl }) => {
  const fileName = getFileNameFromUrl(pageUrl)
  const filePath = path.join(directoryPath, fileName)

  return axios
    .get(pageUrl)
    .then(({ data }) => data)
    .then(pageContent => fs.appendFile(filePath, pageContent))
    .then(() => filePath)
}
