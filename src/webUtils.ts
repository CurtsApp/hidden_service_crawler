const {
  SocksProxyAgent
} = require('socks-proxy-agent');

const agent = new SocksProxyAgent('socks5h://127.0.0.1:9050');

export function getPage(url) {
  const http = require('http');

  return new Promise((resolve, reject) => {
    // Might have to swap between http and https if sites use https
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0' },
      agent
    };

    http.get(url, options, res => {
      let page = '';

      res.on('data', (data) => {
        page += data;
      });

      res.on('end', () => {
        resolve(page);
      });
    }).on('error', error => {
      reject(error);
    });
  });
}

// Useful for debugging
export function printPage(url) {
  getPage(url).then(page => console.log(page)).catch(e => console.log(e));
}

export function getPageLinks(pageString) {
  let getOnionsRegEx = new RegExp('[a-zA-Z0-9@:%_+~#?&=]{10,256}.onion[a-zA-Z0-9@:%_+~#?&=/.]*', 'g');

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