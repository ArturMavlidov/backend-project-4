const getFullSource = (protocol, domain, src) => {
  if (src?.[0] === '/') {
    return protocol + '//' + domain + src
  }

  return src
}

export const getLinksFromHtmlElems = (htmlElems, type, pageUrl) => {
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
