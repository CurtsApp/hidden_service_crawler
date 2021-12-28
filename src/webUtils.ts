import { URL } from "./URL";
const {
  SocksProxyAgent
} = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');

export const VALID_STATUS_CODES = [200];

export function getPage(url) {
  const http = require('http');

  return new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
    // Might have to swap between http and https if sites use https
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0' },
      agent
    };

    http.get(url, options, res => {

      switch (res.statusCode) {
        case 200:
          let page = '';
          res.on('data', (data) => {
            page += data;
          });
          res.on('end', () => {
            resolve({ page: page, status: res.statusCode });
          });
          break;

        case 302:
          // Found. aka Moved temporarily but search engines shouldn't index the change (gonna index it anyways for now)
        case 307:
        // Moved temporarily
        case 301:
          // Moved permanetly
          /*
          Raw Headers example
          rawHeaders: [
            'Date',
            'Tue, 28 Dec 2021 21:10:14 GMT',
            'Content-Type',
            'text/html',
            'Transfer-Encoding',
            'chunked',
            'Connection',
            'close',
            'Location',
            'https://27m3p2uv7igmj6kvd4ql3cct5h3sdwrsajovkkndeufumzyfhlfev4qd.onion/'
          ]
          */
          let newLocation = res.rawHeaders[res.rawHeaders.findIndex(e => e === "Location") + 1];
          let locationURL = (new URL(newLocation)).getFull();          
          console.log(`Redirectiong to: ${locationURL}`);
          
          getPage(locationURL).then(res => resolve(res)).catch(e => reject(e));
          break;
        case 404:
          resolve({ page: null, status: res.statusCode });
          break;
        default:
          throw new Error(`New status code: ${res.statusCode}`);
      }
    }).on('error', error => {
      reject(error);
    });
  });
}

export const VALID_ONION_REGEX = '[a-zA-Z0-9@:%_+~#?&=]{10,256}\\.onion[a-zA-Z0-9@:%_+~#?&=/.]*';

export function getPageLinks(pageString) {
  let getOnionsRegEx = new RegExp(VALID_ONION_REGEX, 'g');

  let matches = [];
  let match = getOnionsRegEx.exec(pageString);
  while (match != null) {
    matches.push(match[0]);
    match = getOnionsRegEx.exec(pageString);
  }

  return matches;
}

export function getPageTitle(pageString) {
  let getTitleRegEx = new RegExp('<[tT][iI][tT][lL][eE]>.*<\/[tT][iI][tT][lL][eE]>');

  let match = getTitleRegEx.exec(pageString);
  if (match != null) {
    let matchString = match[0];
    matchString = matchString.slice(7, -8);
    return matchString;
  }
  return null;
}