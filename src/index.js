import originalAxios from "axios";
import { addLogger } from 'axios-debug-log'
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";

import { logger } from './logger.js'

const replaceUrl = (url) => {
  return url.replace(/https:\/\//, "").replace(/[./]/g, "-");
};

const axios = originalAxios.create({})
addLogger(axios)

const getFullSource = (protocol, domain, src) => {
  if (src?.[0] === "/") {
    return protocol + "//" + domain + src;
  }

  return src;
}

const getLinksFromHtmlElems = (htmlElems, type, pageUrl) => {
  const url = new URL(pageUrl);
  const protocol = url.protocol;
  const domain = url.hostname;

  return htmlElems
    .filter((_, el) => {
      const src = getFullSource(protocol, domain, el.attribs.src || el.attribs.href);
      if (!src) return false;

      let resourceUrl = new URL(src);
      const resourceUrlDomain = resourceUrl.hostname;

      return resourceUrlDomain === domain;
    })
    .map((_, el) => {
      const src = getFullSource(protocol, domain, el.attribs.src || el.attribs.href);
      return { src, type, element: el };
    })
    .toArray();
};

export const loadPage = ({ directoryPath, pageUrl }) => {
  const url = new URL(pageUrl);
  const domain = url.hostname;
  const replacedUrl = replaceUrl(pageUrl);
  const fileName = replacedUrl + ".html";
  const filePath = path.join(directoryPath, fileName);

  return axios
    .get(pageUrl)
    .then(({ data }) => data)
    .then((pageContent) => {
      const $ = cheerio.load(pageContent);

      const images = $("img");
      const links = $("link");
      const scripts = $("script");

      const imagesLinks = getLinksFromHtmlElems(images, 'image', pageUrl)
      const scriptsLinks = getLinksFromHtmlElems(scripts, 'script', pageUrl)
      const linksSources = getLinksFromHtmlElems(links, 'link', pageUrl)

      const resources = [...imagesLinks, ...scriptsLinks, ...linksSources];

      if (!resources.length) {
        logger("No resources")
        return fs.writeFile(filePath, pageContent).then(() => filePath);
      }

      const promises = resources.map((resource) => {
        const { src, type, element } = resource;

        const responseType = type === "image" ? "blob" : "text";

        return axios
          .get(src, { responseType })
          .then(({ data }) => {
            return {
              resourceContent: data,
              resourceLink: src,
              resourceType: type,
              resourceHtmlElement: element,
            };
          })
          // .catch(() => ({
          //     resourceContent: "",
          //     resourceLink: src,
          //     resourceType: type,
          //     resourceIdx: idx,
          // }))
      });

      return Promise.all(promises)
        .then((resources) => {
          const replacedUrl = replaceUrl(pageUrl);
          const filesDirectoryName = replacedUrl + "_files";
          const filesDirectoryPath = path.join(
            directoryPath,
            filesDirectoryName
          );

          const data = {
            $,
            resources,
            filesDirectoryPath,
            filesDirectoryName,
            pageContent,
          };

          return fs
            .access(filesDirectoryPath)
            .then(() => data)
            .catch(() => fs.mkdir(filesDirectoryPath).then(() => data));
        })
        .then((data) => {
          const {
            $,
            resources,
            filesDirectoryPath,
            filesDirectoryName,
          } = data;

          const mapResourceTypeToHtml = {
            image: "src",
            script:"src",
            link: "href",
          };

          const promises = resources.map((resource) => {
            const { resourceContent, resourceLink, resourceType, resourceHtmlElement } =
              resource;

            const resourceExtName = path.extname(resourceLink);
            const resourceNameWithoutExtname = resourceLink.slice(
              0,
              resourceLink.length - resourceExtName.length
            );

            let resourceFileName =
              replaceUrl(resourceNameWithoutExtname) +
              resourceExtName;

            const recourceFilePath = path.join(
              filesDirectoryPath,
              resourceFileName
            );

            const attrib = mapResourceTypeToHtml[resourceType];
            const $element = $(resourceHtmlElement);

            if (resourceType === "link" && $element.attr('rel') === 'canonical') {
              resourceFileName += ".html"
            }

            $element.attr(attrib, `${filesDirectoryName}/${resourceFileName}`);

            return fs.writeFile(recourceFilePath, resourceContent);
          });

          return Promise.all(promises).then(() => $.html());
        })
        .then((html) => fs.writeFile(filePath, html))
        .then(() => logger("Created file: " + filePath))
        .then(() => filePath);
    })
    .catch((err) => logger("Error:", err))
  };
