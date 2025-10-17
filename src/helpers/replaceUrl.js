export const replaceUrl = (url = '') => {
  return url.replace(/https?:\/\//, '').replace(/[./]/g, '-')
}
