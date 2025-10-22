import { axios } from '../axiosInstance.js'

export const downloadResource = (src, type, element, ctx) => {
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
      console.error(`Request to ${err.config.url || src} failed with code ${err.code}`)
      throw err
    })
}
