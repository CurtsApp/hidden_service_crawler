import { URL } from "./URL";
const {
  SocksProxyAgent
} = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');

const MAX_REDIRECT_CNT = 3;
export const VALID_STATUS_CODES = [200];

export function getPage(url: URL, redirectCount: number = 0) {
  const http = require('http');
  const https = require('https');

  return new Promise((resolve: (result: { page: string, status: number }) => void, reject) => {
    // Might have to swap between http and https if sites use https
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0' },
      agent
    };

    let webProtocol = url.protocol === "https" ? https : http;

    webProtocol.get(url.getFull(), options, res => {

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
          if(redirectCount > MAX_REDIRECT_CNT) {
            console.log(`Max redirect count reacted for: ${url}`)
            resolve({ page: null, status: res.statusCode });
            return;
          }
          //console.log(`Requested redirect (${res.statusCode})from: ${url}`);
          //console.log(res.headers);
          let locationURL = null;
          try {
            locationURL = new URL(res.headers.location);          
          } catch {
            locationURL = new URL(addPath(url, res.headers.location));
          }
          
          console.log(`Redirectiong (${res.statusCode})...\nFrom: ${url}\nTo:   ${locationURL}`);          
          getPage(locationURL, redirectCount + 1).then(res => resolve(res)).catch(e => reject(e));
          break;
        case 500:
          // Internal Server Error
        case 405:
          // Method not allowed
        case 404:
          // Not found
          resolve({ page: null, status: res.statusCode });
          break;
        default:
          throw new Error(`New status code: ${res.statusCode}. From \n${url}`);
      }
    }).on('error', error => {
      reject(error);
    });
  });
}

function addPath(url: URL, path: string) {
  if(path[0] !== "/") {
    path = `/${path}`;
  }
  return `${url.protocol}://${url.hostName}.onion${path}`;
}

export const VALID_ONION_REGEX = '(http:\\/\\/|https:\\/\\/)?[a-zA-Z0-9@:%_+~#?&=]{10,256}\\.onion[a-zA-Z0-9@:%_+~#?&=/.]*';

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